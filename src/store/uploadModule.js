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
const FINALIZE_BATCH_SIZE = 250;
const FINALIZE_FLUSH_MS = 5000;

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
    totalFilesInBatch: 0
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

            let uploadDestination = {
                path: helpers.getFileLocation(targetPackage),
                file: files[0]
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

        // Sequential per-file uploads, matching the existing behaviour.
        // Concurrency is a follow-up — the agent uses a worker pool here.
        for (const [key, value] of state.uploadFileMap) {
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

        // Final flush for any remainder below the batch threshold.
        if (state.pendingFinalize.length > 0) {
            await dispatch('flushFinalizeBatch')
        }

        commit('SET_UPLOAD_COMPLETE', true)
    },

    // POST /upload/manifest/files/finalize with the currently-queued files.
    // Per-file success -> REMOVE_COMPLETED_FILE (clears the row from the
    // upload UI); per-file failure -> SET_FILE_STATUS=failed so the user
    // sees which file didn't make it. Request-level failures mark every
    // queued file as failed so the UI never silently "forgets" them.
    flushFinalizeBatch: async ({ rootState, state, commit }) => {
        if (state.pendingFinalize.length === 0) return
        const batch = state.pendingFinalize.slice()
        commit('CLEAR_FINALIZE_QUEUE')

        const datasetId = router.currentRoute.value.params.datasetId
        const endpoint = `${rootState.config.api2Url}/upload/manifest/files/finalize`
        const url = `${endpoint}?${toQueryParams({ dataset_id: datasetId })}`
        const apiKey = await useGetToken()

        const body = {
            manifestNodeId: state.manifestNodeId,
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
                    commit('REMOVE_COMPLETED_FILE', mapKey)
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

        const uploadMap = new Map()
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
        state.uploadProgress.total = total

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
