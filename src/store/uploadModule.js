import toQueryParams from '../utils/toQueryParams.js'
import { compose, find, join, map, prepend, propEq } from "ramda";
import { Upload } from "@aws-sdk/lib-storage"
import { ChecksumAlgorithm, S3Client } from "@aws-sdk/client-s3"

import { v4 as uuidv4 } from 'uuid';
import router from '@/router'
import EventBus from '../utils/event-bus'
import { useGetToken } from "@/composables/useGetToken";

// Finalize batching matches the agent (pennsieve-agent/pkg/server/upload.go):
// server accepts up to 250 files per POST /upload/manifest/files/finalize call
// and we flush once we hit that bound or the flush interval, whichever first.
//
// Flush interval is 1s (vs. the agent's 5s). Measured end-to-end delay from
// S3 PUT → Pusher "upload-event" is 6–22s in dev; ~5s of that was pure idle
// in this flush interval for small drops. The server-side SQS batching
// window (upload-service-v2 terraform/sqs.tf:26, currently 5s) is the other
// compressible leg. 1s here keeps a little headroom for coalescing when
// many S3 PUTs finish close together, without dominating the latency.
const FINALIZE_BATCH_SIZE = 250;
const FINALIZE_FLUSH_MS = 1000;

// How many S3 PUTs run at once. Browser + AWS SDK lib-storage already
// does 4-way parallelism *within* a file (queueSize: 4) for multipart
// parts; this is cross-file concurrency on top of that. 4 is a balance
// between bandwidth saturation on a typical connection and not
// over-subscribing CPU on the checksum-per-part work.
const UPLOAD_CONCURRENCY = 4;

// Module-level guard to serialize finalize POSTs. Without this, the
// batch-size trigger and the timer-based flush can both capture the same
// pendingFinalize entries and fire duplicate requests — the second POST
// would arrive with an empty batch (CLEAR_FINALIZE_QUEUE already ran) or,
// worse, race on the `batch` snapshot. Not reactive — just a mutex.
let finalizeInFlight = false;

// Refresh storage credentials when the remaining TTL drops below 5 minutes —
// same headroom the agent uses. STS returns ~1h creds.
const CREDENTIAL_REFRESH_HEADROOM_MS = 5 * 60 * 1000;

// macOS screenshots insert U+202F (narrow no-break space) between the time
// and AM/PM, and other Unicode-whitespace variants sneak in from copy/paste.
// S3 rejects presigned GETs whose response-content-disposition is not
// ISO-8859-1 with a 400 (InvalidArgument), so names with these characters
// fail to download. Folding the invisible variants to ASCII space preserves
// the visible filename while keeping the Content-Disposition header valid.
// Non-whitespace non-Latin-1 (CJK, emoji) is left alone — that needs the
// server-side RFC 5987 fix to download correctly.
const INVISIBLE_UNICODE_WS = /[\u00A0\u2000-\u200F\u202F\u205F\u3000\uFEFF]/g;
const sanitizeFileName = (name) => name.replace(INVISIBLE_UNICODE_WS, ' ');

class UploadFile {
    constructor(uploadId, s3Key, targetPath, targetName) {
        this.upload_id = uploadId;
        this.s3_key = s3Key;
        this.target_path = targetPath;
        this.target_name = targetName;
    }
}

const initialState = () => ({
    manifestNodeId: "",
    savedDatasetId: "",
    manifestFiles: [],
    uploadFileMap: new Map(),
    uploadDestination: {},
    // Storage credentials (STS) fetched from /upload/manifest/storage-credentials.
    // Scoped to this manifest's key prefix and expire in ~1h; re-fetched when
    // CREDENTIAL_REFRESH_HEADROOM_MS elapsed before expiry.
    storageCreds: null,           // {accessKeyId, secretAccessKey, sessionToken}
    storageCredsExpiresAt: 0,     // ms since epoch
    storageBucket: "",            // destination bucket (workspace-scoped)
    storageKeyPrefix: "",         // O{org}/D{ds}/{manifestId}
    storageRegion: "us-east-1",
    // Finalize batch — files that finished their S3 PUT and are waiting for
    // the next flush to /upload/manifest/files/finalize.
    pendingFinalize: [],
    isUploading: false,
    uploadComplete: false,
    uploadProgress: { total: 0, loaded: 0 },
    currentTargetPackage: {},
    totalFilesInBatch: 0,
    // Name-conflict resolution for this batch. Server accepts keepBoth
    // (default, auto-rename to " (N)") or replace (soft-delete
    // predecessor and create new). Reset to keepBoth on every new batch
    // so "Replace" stays a deliberate choice, not a sticky preference.
    onConflict: 'keepBoth',
})

export const state = initialState()

const helpers = {
    getFileLocation(pkg) {

        // target location is '' when uploading to root folder (e.g. Dataset)
        if (pkg.content.packageType === 'DataSet') {
            return ''
        }

        const ancestors = pkg.ancestors

        if (ancestors.length > 0) {
            const rootNode = ''

            let path = rootNode
            if (pkg.ancestors && ancestors.length > 0) {
                path = compose(
                    join('/'),
                    prepend(rootNode),
                    map(ancestor => {
                        return ancestor.content.name
                    })
                )(ancestors)
            }

            // remove initial '/' and append target-package name
            return path.slice(1) + '/' + pkg.content.name

        } else {
            
            return pkg.content.name
        }

    }
}

export const mutations = {
    SET_CURRENT_TARGET_PACKAGE(state, currentTargetPackage) {
        state.currentTargetPackage = currentTargetPackage
    },
    SET_STORAGE_CREDS(state, { creds, bucket, keyPrefix, region, expiresAt }) {
        state.storageCreds = creds
        state.storageBucket = bucket
        state.storageKeyPrefix = keyPrefix
        state.storageRegion = region || state.storageRegion
        state.storageCredsExpiresAt = expiresAt
    },
    CLEAR_STORAGE_CREDS(state) {
        state.storageCreds = null
        state.storageCredsExpiresAt = 0
        state.storageBucket = ""
        state.storageKeyPrefix = ""
    },
    ENQUEUE_FINALIZE(state, entry) {
        state.pendingFinalize.push(entry)
    },
    CLEAR_FINALIZE_QUEUE(state) {
        state.pendingFinalize = []
    },
    ADD_FILES_TO_MANIFEST(state, files) {
        state.manifestFiles.push(...files)
    },
    REMOVE_FILE_FROM_MANIFEST(state, f) {
        const idx = find(propEq(f.id, 'id'))(state.manifestFiles)
        state.manifestFiles.splice(idx, 1);
    },
    RESET_MANIFEST_FILES(state) {
      state.manifestFiles = []
    },
    SET_UPLOAD_DESTINATION(state, obj) {
        state.uploadDestination = obj
    },
    SET_MANIFEST_NODE_ID(state, nodeId) {
        state.manifestNodeId = nodeId
    },
    SET_UPLOAD_FILE_MAP(state,uploadFileMap) {
        state.uploadFileMap = uploadFileMap
    },
    SET_FILE_STATUS(state, statusInfo) {
        let curMap = state.uploadFileMap.get(statusInfo.key)
        curMap.status = statusInfo.status
    },
    UPDATE_UPLOAD_PROGRESS(state, progressInfo) {
        let curMap = state.uploadFileMap.get(progressInfo.key)
        const diff = progressInfo.loaded - curMap.progress.loaded
        curMap.progress = {
            loaded: progressInfo.loaded,
            total: progressInfo.total
        }

        // update total progress and loaded
        state.uploadProgress.loaded += diff

    },
    SET_IS_UPLOADING(state, value) {
        state.isUploading = value
    },
    SET_UPLOAD_COMPLETE(state, value) {
        state.uploadComplete = value
    },
    SET_ON_CONFLICT(state, value) {
        // Guard against invalid values at mutation time. Server currently
        // accepts "keepBoth" (default) or "replace"; anything else is
        // coerced to the safe default rather than rejected at the API.
        if (value === 'keepBoth' || value === 'replace') {
            state.onConflict = value
        } else {
            state.onConflict = 'keepBoth'
        }
    },
    SET_TOTAL_FILES_IN_BATCH(state, count) {
        state.totalFilesInBatch = count
    },
    RESET_UPLOADER(state) {
        state.uploadFileMap = new Map()
        state.manifestFiles = []
        state.uploadProgress = {total: 0, loaded:0}
        state.uploadDestination = {}
        state.isUploading = false
        state.uploadComplete = false
        state.totalFilesInBatch = 0
        state.pendingFinalize = []
        state.storageCreds = null
        state.storageCredsExpiresAt = 0
        state.storageBucket = ""
        state.storageKeyPrefix = ""
        state.onConflict = 'keepBoth'
    },
    REMOVE_COMPLETED_FILE(state, key) {
        const fileEntry = state.uploadFileMap.get(key)
        if (fileEntry) {
            // Subtract from total progress
            state.uploadProgress.total -= fileEntry.file.size
            state.uploadProgress.loaded -= fileEntry.progress.loaded
            state.uploadFileMap.delete(key)

            // If no files left, reset the upload state
            if (state.uploadFileMap.size === 0) {
                state.isUploading = false
                state.uploadComplete = false
                state.manifestFiles = []
            }
        }
    },
    CLEAR_COMPLETED_FILES(state) {
        const newMap = new Map()
        for (const [key, value] of state.uploadFileMap) {
            if (value.status !== 'processing') {
                newMap.set(key, value)
            } else {
                // Subtract completed file from progress totals
                state.uploadProgress.total -= value.file.size
                state.uploadProgress.loaded -= value.progress.loaded
            }
        }
        state.uploadFileMap = newMap
        // If no files left, reset the upload state
        if (state.uploadFileMap.size === 0) {
            state.isUploading = false
            state.uploadComplete = false
            state.manifestFiles = []
        }
    }
}

export const actions = {
    setCurrentTargetPackage: ({commit, rootState}, currentTargetPackage) => {
        commit('SET_CURRENT_TARGET_PACKAGE', currentTargetPackage)
    },

    setOnConflict: ({commit}, value) => {
        commit('SET_ON_CONFLICT', value)
    },

    fetchManifestDownloadUrl: async ({commit, rootState}, manifest_id) => {
        try {
            let endpoint = `${rootState.config.api2Url}/upload/manifest/archive`
            const token = await useGetToken()

            const queryParams = toQueryParams({
                manifest_id: manifest_id,
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + token)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'GET',
                headers: myHeaders
            })

            if (resp.ok) {
                return await resp.json()
            } else {
                return Promise.reject(resp)
            }
        } catch (err) {
            return Promise.reject(err)
        }
    },

    archiveManifest: async ({commit, rootState}, {manifest_id, permanent}) => {
        try {
            let endpoint = `${rootState.config.api2Url}/upload/manifest/archive`
            const apiKey = await useGetToken()

            const queryParams = toQueryParams({
                manifest_id: manifest_id,
                remove: permanent
            })

            const url = `${endpoint}?${queryParams}`

            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + apiKey)
            myHeaders.append('Accept', 'application/json')

            const resp = await fetch(url, {
                method: 'POST',
                headers: myHeaders
            })

            if (resp.ok) {
                return await resp.json()
            } else {
                return Promise.reject(resp)
            }
        } catch (err) {
            return Promise.reject(err)
        }
    },

    // Fetch narrow-scoped STS credentials for the storage bucket. The
    // response gives us the destination bucket + a keyPrefix of the form
    // O{org}/D{ds}/{manifestId} and creds valid for ~1h (server-assumed role
    // with a session policy tied to that prefix). Called before sync so
    // every file's s3_key can embed the keyPrefix, and re-called transparently
    // from the AWS-SDK credentials provider when the current set is within
    // CREDENTIAL_REFRESH_HEADROOM_MS of expiring. Mirror of the agent's
    // StorageCredentialsProvider (pkg/server/upload.go:194-312).
    fetchStorageCredentials: async ({ rootState, state, commit }) => {
        if (!state.manifestNodeId) {
            throw new Error("fetchStorageCredentials: no manifestNodeId set; call getManifestNodeId first")
        }
        const datasetId = router.currentRoute.value.params.datasetId
        const endpoint = `${rootState.config.api2Url}/upload/manifest/storage-credentials`
        const apiKey = await useGetToken()
        const url = `${endpoint}?${toQueryParams({ dataset_id: datasetId })}`

        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ manifestNodeId: state.manifestNodeId })
        })
        if (!resp.ok) {
            const text = await resp.text()
            throw new Error(`storage-credentials failed (${resp.status}): ${text}`)
        }
        const data = await resp.json()
        commit('SET_STORAGE_CREDS', {
            creds: {
                accessKeyId: data.accessKeyId,
                secretAccessKey: data.secretAccessKey,
                sessionToken: data.sessionToken,
            },
            bucket: data.bucket,
            keyPrefix: data.keyPrefix,
            region: data.region,
            expiresAt: new Date(data.expiration).getTime(),
        })
        return data
    },

    // Add files to manifest
    addManifestFiles: async ({state, commit}, files, path) => {
        if (state.isUploading) {
            const errMsg = "Cannot add files while upload is in progress."
            Promise.reject(new Error(errMsg)).then(resolved, rejected);
        } else {

            let targetPackage = await state.currentTargetPackage;

            // `file` is the target folder/dataset package — not a dropped
            // File — so downstream consumers (placeholder-row getter, etc.)
            // can match by folder id. Same shape `setUploadDestination`
            // writes on explicit navigation.
            let uploadDestination = {
                path: helpers.getFileLocation(targetPackage),
                file: targetPackage,
            }

            commit('SET_UPLOAD_DESTINATION', uploadDestination)
            commit('SET_UPLOAD_COMPLETE', false)
            commit('ADD_FILES_TO_MANIFEST', files)
        }
    },

    // Remove file from manifest
    removeFromManifest: async({state, commit}, files) => {
        for (let i in files) {
            commit('REMOVE_FILE_FROM_MANIFEST', files[i])
        }
    },

    // Define the packageId where files should be uploaded
    // This can be a folder-package-id or a dataset-package-id
    setUploadDestination: async ({rootState, commit}, targetPackage) => {
        // check that target location is foler
        if (!(targetPackage.content.packageType === 'Collection' || targetPackage.content.packageType === 'DataSet')) {
            const errMsg = 'Error: Trying to set target folder to a non-folder type package'
            Promise.reject(new Error(errMsg)).then(resolved, rejected);
        }

        let uploadDestination = {
            path: helpers.getFileLocation(targetPackage),
            file: targetPackage
        }

        commit('SET_UPLOAD_DESTINATION', uploadDestination)
    },

    // Get or Request a NodeId for a manifest.
    getManifestNodeId: async ({rootState, commit}, evt) => {

        const currentRoute = router.currentRoute.value
        const datasetId = currentRoute.params.datasetId

        if (state.manifestNodeId.length > 0 && datasetId===state.savedDatasetId) {
            return state.manifestNodeId
        } else {
            const endpoint = `${rootState.config.api2Url}/upload/manifest`

            state.savedDatasetId = datasetId;

            const apiKey = await useGetToken()
            const queryParams = toQueryParams({
                dataset_id: datasetId,
            })

            const url = `${endpoint}?${queryParams}`
            const myHeaders = new Headers();
            myHeaders.append('Authorization', 'Bearer ' + apiKey)
            myHeaders.append('Accept', 'application/json')

            try {
                const resp = await fetch(url, {
                    method: "POST",
                    headers: myHeaders,
                    body: JSON.stringify({'DatasetId': datasetId})
                })
                if (resp.ok) {
                    const response = await resp.json()
                    commit('SET_MANIFEST_NODE_ID', response.manifest_node_id)
                    return response.manifest_node_id

                } else {
                    commit('SET_MANIFEST_NODE_ID', '')
                    return new Error(resp.statusText)
                }
            } catch (err) {
                EventBus.$emit('ajaxError', err)
                commit('SET_MANIFEST_NODE_ID', '')
            }
        }

    },

    // Direct-to-storage upload: PUT every file into the workspace storage
    // bucket using short-lived STS creds scoped to this manifest's key
    // prefix, then POST batches to /upload/manifest/files/finalize. No
    // Cognito identity-pool creds, no legacy upload bucket, no Pusher
    // dependency for driving this component's state machine.
    //
    // State transitions per file:
    //   waiting -> uploading -> processing (S3 PUT done, awaiting finalize)
    //           -> complete   (REMOVE_COMPLETED_FILE after finalize 200)
    //           -> failed     (either the PUT or the finalize failed)
    UploadFiles: async ({ rootState, state, dispatch, commit }) => {
        commit('SET_IS_UPLOADING', true)
        commit('SET_TOTAL_FILES_IN_BATCH', state.uploadFileMap.size)

        const datasetId = router.currentRoute.value.params.datasetId
        const tags = `OrgId=${rootState.activeOrganization.organization.id}&DatasetId=${datasetId}`

        // AWS SDK v3 accepts an async provider that can refresh. The SDK
        // calls it when it needs creds; when `expiration` is within the
        // SDK's internal skew window, it re-calls. Our own headroom check
        // sits in front so a long run of uploads never hands stale creds
        // to the SDK in the first place.
        const credentialsProvider = async () => {
            const now = Date.now()
            if (!state.storageCreds ||
                state.storageCredsExpiresAt - now < CREDENTIAL_REFRESH_HEADROOM_MS) {
                await dispatch('fetchStorageCredentials')
            }
            return {
                accessKeyId: state.storageCreds.accessKeyId,
                secretAccessKey: state.storageCreds.secretAccessKey,
                sessionToken: state.storageCreds.sessionToken,
                expiration: new Date(state.storageCredsExpiresAt),
            }
        }

        const s3Client = new S3Client({
            region: state.storageRegion,
            credentials: credentialsProvider,
        })

        // Time-based finalize flush: drains pendingFinalize every
        // FINALIZE_FLUSH_MS so the server starts creating packages while
        // later files are still being PUT, rather than waiting for the
        // whole batch to finish before finalize fires. Critical for the
        // small-drop case (<250 files), which otherwise skipped eager
        // flushing entirely.
        const flushTimer = setInterval(() => {
            if (state.pendingFinalize.length > 0) {
                dispatch('flushFinalizeBatch').catch((e) => console.error(e))
            }
        }, FINALIZE_FLUSH_MS)

        const uploadOne = async (key, value) => {
            try {
                commit('SET_FILE_STATUS', { key, status: "uploading" })

                const uploader = new Upload({
                    client: s3Client,
                    queueSize: 4,
                    leavePartsOnError: false,
                    params: {
                        Bucket: state.storageBucket,
                        Key: value.config.s3_key,
                        Body: value.file,
                        Tagging: tags,
                        // SHA256 is required by the finalize endpoint. The SDK
                        // computes the multipart checksum-of-checksums during
                        // upload and returns it on the completion response.
                        ChecksumAlgorithm: ChecksumAlgorithm.SHA256,
                    },
                })

                uploader.on("httpUploadProgress", (progress) => {
                    commit('UPDATE_UPLOAD_PROGRESS', {
                        key: progress.Key,
                        loaded: progress.loaded,
                        total: progress.total,
                    })
                })

                const result = await uploader.done()
                const sha256 = result.ChecksumSHA256
                if (!sha256) {
                    throw new Error("S3 response missing ChecksumSHA256")
                }

                commit('SET_FILE_STATUS', { key, status: "processing" })
                commit('ENQUEUE_FINALIZE', {
                    uploadId: value.config.upload_id,
                    size: value.file.size,
                    sha256,
                    mapKey: key,
                })

                // Flush opportunistically once we've accumulated a full batch.
                if (state.pendingFinalize.length >= FINALIZE_BATCH_SIZE) {
                    await dispatch('flushFinalizeBatch')
                }
            } catch (e) {
                console.error(e)
                commit('SET_FILE_STATUS', { key, status: "failed" })
                EventBus.$emit('toast', {
                    detail: {
                        msg: `Failed to upload ${value.file.name}: ${e.message || 'Unknown error'}`,
                        type: 'error',
                    },
                })
            }
        }

        // Worker pool — pulls from a shared queue so each worker moves on
        // to the next file as soon as its current PUT finishes. Cross-file
        // concurrency is cheap here (lib-storage's queueSize handles
        // within-file part parallelism).
        const queue = [...state.uploadFileMap]
        const workerCount = Math.min(UPLOAD_CONCURRENCY, queue.length)
        const workers = Array.from({ length: workerCount }, async () => {
            while (queue.length > 0) {
                const next = queue.shift()
                if (!next) return
                await uploadOne(next[0], next[1])
            }
        })

        try {
            await Promise.all(workers)
        } finally {
            clearInterval(flushTimer)
        }

        // Final flush for any remainder below the batch threshold.
        if (state.pendingFinalize.length > 0) {
            await dispatch('flushFinalizeBatch')
        }

        commit('SET_UPLOAD_COMPLETE', true)
    },

    // POST /upload/manifest/files/finalize with the currently-queued files.
    // Per-file success -> SET_FILE_STATUS=finalized; the placeholder row
    // stays visible in the "Importing..." state until the server-side
    // package record shows up in a silent refresh (Pusher `upload-event`
    // triggers that), at which point displayFiles dedupes by name and the
    // placeholder drops out. Removing the map entry here instead would
    // leave a visual gap of several seconds between finalize and Pusher.
    // Per-file failure -> SET_FILE_STATUS=failed so the user sees which
    // file didn't make it. Request-level failures mark every queued file
    // as failed so the UI never silently "forgets" them.
    flushFinalizeBatch: async ({ rootState, state, commit }) => {
        // Serialize concurrent callers (timer-based flush + batch-size
        // trigger + final post-loop flush). The second caller returns
        // immediately; whatever accumulated while the first POST was
        // in flight gets picked up by the next timer tick or the final
        // flush after the worker pool drains.
        if (finalizeInFlight) return
        if (state.pendingFinalize.length === 0) return
        finalizeInFlight = true
        const batch = state.pendingFinalize.slice()
        commit('CLEAR_FINALIZE_QUEUE')

        const datasetId = router.currentRoute.value.params.datasetId
        const endpoint = `${rootState.config.api2Url}/upload/manifest/files/finalize`
        const url = `${endpoint}?${toQueryParams({ dataset_id: datasetId })}`
        const apiKey = await useGetToken()

        const body = {
            manifestNodeId: state.manifestNodeId,
            // Server accepts "keepBoth" (default), "replace", "fail".
            // Omitted / empty resolves to keepBoth server-side; sending it
            // explicitly keeps intent visible in network logs.
            onConflict: state.onConflict || 'keepBoth',
            files: batch.map(b => ({
                uploadId: b.uploadId,
                size: b.size,
                sha256: b.sha256,
            })),
        }

        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
            })
            if (!resp.ok) {
                throw new Error(`finalize failed (${resp.status}): ${await resp.text()}`)
            }
            const data = await resp.json()
            const byUploadId = new Map(batch.map(b => [b.uploadId, b.mapKey]))
            for (const r of data.results || []) {
                const mapKey = byUploadId.get(r.uploadId)
                if (!mapKey) continue
                if (r.status === 'finalized') {
                    commit('SET_FILE_STATUS', { key: mapKey, status: 'finalized' })
                } else {
                    commit('SET_FILE_STATUS', { key: mapKey, status: 'failed' })
                    EventBus.$emit('toast', {
                        detail: {
                            msg: `Failed to finalize ${mapKey}: ${r.error || 'unknown error'}`,
                            type: 'error',
                        },
                    })
                }
            }
        } catch (e) {
            console.error(e)
            for (const b of batch) {
                commit('SET_FILE_STATUS', { key: b.mapKey, status: 'failed' })
            }
            EventBus.$emit('toast', {
                detail: {
                    msg: `Failed to finalize batch: ${e.message || 'Unknown error'}`,
                    type: 'error',
                },
            })
        } finally {
            finalizeInFlight = false
        }
    },

    // Sync Manifest Files with Server. Fetches fresh storage credentials
    // first so the per-file s3_key embeds the workspace-scoped keyPrefix
    // (O{org}/D{ds}/{manifestId}). The server stores the files in
    // manifest_files with Status=Registered; the finalize call later
    // promotes them to Finalized.
    syncManifest: async ({ rootState, state, commit, dispatch }) => {
        if (!state.manifestNodeId) {
            throw new Error("syncManifest: no manifestNodeId; call getManifestNodeId first")
        }

        // Must happen before key assembly — keyPrefix comes from the
        // credentials response.
        await dispatch('fetchStorageCredentials')
        const keyPrefix = state.storageKeyPrefix
        if (!keyPrefix) {
            throw new Error("syncManifest: storage-credentials returned no keyPrefix")
        }

        const datasetId = router.currentRoute.value.params.datasetId
        const endpoint = `${rootState.config.api2Url}/upload/manifest`
        const apiKey = await useGetToken()
        const queryParams = toQueryParams({ dataset_id: datasetId })

        // Merge new-batch entries into any finalized carry-overs from a
        // previous batch (those still need their placeholder rows until
        // Pusher confirms them). s3_key is a fresh UUID so the new entries
        // never collide with existing ones.
        const uploadMap = new Map(state.uploadFileMap)
        const requestFiles = []
        let total = 0
        for (const mf in state.manifestFiles) {
            const uploadId = uuidv4()
            const s3Key = `${keyPrefix}/${uploadId}`
            const curFile = state.manifestFiles[mf]

            let fileLocation = state.uploadDestination.path + curFile.path.substring(0, curFile.path.length - curFile.name.length)
            fileLocation = fileLocation.replace(/^\//, '').replace(/\/$/, '')

            const f = new UploadFile(
                uploadId,
                s3Key,
                fileLocation,
                sanitizeFileName(curFile.name),
            )

            uploadMap.set(s3Key, {
                file: curFile,
                config: f,
                progress: { loaded: 0, total: curFile.total },
                status: "waiting",
            })

            total += curFile.size
            requestFiles.push(f)
        }

        commit("SET_UPLOAD_FILE_MAP", uploadMap)
        // Progress total is the *current batch only*; finalized carry-over
        // entries' bytes were already counted in the previous batch's total
        // and subtracted from loaded/total as they got removed.
        state.uploadProgress.total = total
        state.uploadProgress.loaded = 0

        const requestBody = {
            id: state.manifestNodeId,
            files: requestFiles,
        }

        const url = `${endpoint}?${queryParams}`
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json; charset=utf-8',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
            })
            if (!resp.ok) {
                throw new Error(`sync failed (${resp.status}): ${await resp.text()}`)
            }
        } catch (e) {
            console.error(e)
            throw new Error("Unable to sync manifest.")
        } finally {
            state.manifestFiles = []
        }
    },

    // Reset upload action
    resetUpload: async({ commit}) => {
        commit("RESET_UPLOADER")
    },

    // Remove a single completed file from the upload map
    removeCompletedFile: async({ commit }, key) => {
        commit("REMOVE_COMPLETED_FILE", key)
    },

    // Clear all completed files from the upload map
    clearCompletedFiles: async({ commit }) => {
        commit("CLEAR_COMPLETED_FILES")
    },

    // Remove finalized entries whose target files are now confirmed in the
    // server-side file listing. Called from the DatasetFiles silent refresh
    // so the aggregate pill can stop saying "Importing..." the instant the
    // real package rows show up.
    //
    // Scope: only reconciles when the silent refresh is for the destination
    // folder the upload was dropped into. When files land in a nested
    // subfolder, matching the synthetic parent folder's first-segment name
    // against a Collection child on the server clears every upload sitting
    // under that segment.
    reconcileFinalizedFiles: ({ state, commit }, { folderId, serverChildren }) => {
        const dest = state.uploadDestination
        const destId = dest && dest.file && dest.file.content && dest.file.content.id
        const destPath = (dest && dest.path) || ''
        if (!destId || destId !== folderId) return
        if (!Array.isArray(serverChildren)) return

        const fileNames = new Set()
        const collectionNames = new Set()
        for (const row of serverChildren) {
            const name = row && row.content && row.content.name
            if (!name) continue
            if (row.content.packageType === 'Collection') collectionNames.add(name)
            else fileNames.add(name)
        }

        const toRemove = []
        for (const [key, entry] of state.uploadFileMap) {
            if (entry.status !== 'finalized') continue
            const fullTargetPath = (entry.config && entry.config.target_path) || ''
            let rel = fullTargetPath
            if (destPath && rel.startsWith(destPath)) {
                rel = rel.slice(destPath.length).replace(/^\//, '')
            }
            const name = (entry.config && entry.config.target_name) || (entry.file && entry.file.name) || ''
            if (!rel) {
                // Immediate child of destination — match by filename.
                if (fileNames.has(name)) toRemove.push(key)
            } else {
                // Nested — the server has created the top-level folder, so
                // at least some files in that subtree have landed. Clearing
                // optimistically lets the pill settle; the user sees the
                // real folder row and can navigate in for per-file detail.
                const firstSeg = rel.split('/')[0]
                if (collectionNames.has(firstSeg)) toRemove.push(key)
            }
        }
        for (const k of toRemove) commit('REMOVE_COMPLETED_FILE', k)
    }

}

export const getters = {
    getManifestFiles: state => () => {
        return state.manifestFiles
    },
    getUploadMap: state => () => {
      return state.uploadFileMap
    },
    getIsUploading: state => () => {
        return state.isUploading
    },
    getUploadComplete: state => () => {
        return state.uploadComplete
    },
    getUploadProgress: state => () => {
        return state.uploadProgress
    },
    getTotalFilesInBatch: state => () => {
        return state.totalFilesInBatch
    },
    getUploadDestination: state => () => {
        return state.uploadDestination
    },
    getOnConflict: state => () => {
        return state.onConflict
    },
    // Returns synthetic "placeholder" rows for a given folder view so the
    // DatasetFiles table can show a row for each file that's still
    // uploading/importing (before the server-side package record exists).
    //
    // Scope: placeholders are only surfaced when the user is viewing the
    // destination folder where files were dropped. Uploads landing in a
    // nested subfolder below the destination are rolled up into one
    // synthetic folder row per first-segment. Uploads into a sibling folder
    // of the current view are not shown here (aggregate pill covers that).
    //
    // Placeholder row shape intentionally mirrors a server package row
    // enough that FilesTable/BfFileLabel can render it:
    //   { content: { id, name, state, packageType }, storage, _placeholder, _placeholderStatus, _progress }
    // `_placeholder === true` is the marker every consumer (download
    // gating, viewer gating, selection handling) should check.
    getPlaceholdersForFolder: state => (folderId) => {
        const dest = state.uploadDestination
        const destId = dest && dest.file && dest.file.content && dest.file.content.id
        const destPath = (dest && dest.path) || ''
        if (!destId || destId !== folderId) return []

        const nestedGroups = new Map()
        const immediate = []

        const addRow = ({ key, relPath, name, size, loaded, total, status }) => {
            const isImporting = status === 'processing' || status === 'finalized'
            const phStatus = status === 'failed' ? 'failed'
                : isImporting ? 'importing' : 'uploading'
            const phState = status === 'failed' ? 'ERROR'
                : isImporting ? 'IMPORTING' : 'UPLOADING'
            if (!relPath) {
                immediate.push({
                    storage: size,
                    _placeholder: true,
                    _placeholderStatus: phStatus,
                    _progress: { loaded, total },
                    content: {
                        id: key,
                        name,
                        state: phState,
                        packageType: 'Unknown',
                    },
                })
            } else {
                const firstSeg = relPath.split('/')[0]
                let g = nestedGroups.get(firstSeg)
                if (!g) {
                    g = { count: 0, loaded: 0, total: 0, importingCount: 0, failedCount: 0 }
                    nestedGroups.set(firstSeg, g)
                }
                g.count += 1
                g.loaded += loaded
                g.total += total
                if (isImporting) g.importingCount += 1
                if (status === 'failed') g.failedCount += 1
            }
        }

        // Post-sync phase: uploadFileMap has the authoritative entries with
        // stable s3_key ids and live progress.
        if (state.uploadFileMap.size > 0) {
            for (const [key, entry] of state.uploadFileMap) {
                const fullTargetPath = (entry.config && entry.config.target_path) || ''
                let rel = fullTargetPath
                if (destPath && rel.startsWith(destPath)) {
                    rel = rel.slice(destPath.length).replace(/^\//, '')
                }
                const name = (entry.config && entry.config.target_name) || (entry.file && entry.file.name) || ''
                const size = (entry.file && entry.file.size) || 0
                addRow({
                    key,
                    relPath: rel,
                    name: sanitizeFileName(name),
                    size,
                    loaded: (entry.progress && entry.progress.loaded) || 0,
                    total: (entry.progress && entry.progress.total) || size,
                    status: entry.status || 'waiting',
                })
            }
        } else {
            // Pre-sync phase: syncManifest hasn't committed uploadFileMap yet.
            // Surface rows from the raw manifestFiles so the user sees
            // placeholders the instant they drop, not hundreds of ms later.
            for (let i = 0; i < state.manifestFiles.length; i += 1) {
                const f = state.manifestFiles[i]
                const fullPath = (f && f.path) || (f && f.name) || ''
                const name = (f && f.name) || ''
                const rel = fullPath.length > name.length
                    ? fullPath.slice(0, fullPath.length - name.length).replace(/\/$/, '')
                    : ''
                const size = (f && f.size) || 0
                addRow({
                    key: `pending:${i}:${fullPath}`,
                    relPath: rel,
                    name: sanitizeFileName(name),
                    size,
                    loaded: 0,
                    total: size,
                    status: 'waiting',
                })
            }
        }

        for (const [firstSeg, g] of nestedGroups) {
            const allImporting = g.importingCount === g.count
            const anyFailed = g.failedCount > 0
            immediate.push({
                storage: g.total,
                _placeholder: true,
                _placeholderStatus: anyFailed ? 'failed' : allImporting ? 'importing' : 'uploading',
                _placeholderFileCount: g.count,
                _progress: { loaded: g.loaded, total: g.total },
                content: {
                    id: `placeholder:folder:${folderId}:${firstSeg}`,
                    name: firstSeg,
                    state: anyFailed ? 'ERROR' : allImporting ? 'IMPORTING' : 'UPLOADING',
                    packageType: 'Collection',
                },
            })
        }

        return immediate
    }
}

const uploadModule = {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
}

export default uploadModule
