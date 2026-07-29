// Durable journal of files that finished their S3 PUT but have not yet been
// confirmed finalized by the server.
//
// Why this exists: uploads are two-phase. The browser PUTs bytes straight to
// the storage bucket, then POSTs /upload/manifest/files/finalize so the server
// creates the package rows. Between those two steps the file exists in S3 but
// is invisible in the app — its manifest_files row is still `Registered`. If
// the tab is refreshed, closed, or crashes in that window, the finalize call
// for those files is never made and nothing client-side remembers they were
// owed. The upload-service reconcile sweep does eventually rescue them, but it
// runs once a day with a 6h grace period, so the files surface one to two days
// later — long after the user believed the upload was done.
//
// Writing the (uploadId, size, sha256) triple to localStorage the moment a PUT
// completes makes that window survivable: on the next app load we replay the
// leftovers. Those three fields are exactly what the finalize endpoint needs,
// and they're only knowable client-side (sha256 comes back on the S3 multipart
// completion response), so there is no server-side equivalent of this replay.
//
// Finalize is idempotent per uploadId — the server short-circuits anything
// already in `Finalized` status — so a redundant replay is harmless.
//
// Every operation is best-effort. localStorage throws in Safari private mode
// and when the origin is over quota; a journal failure must never break an
// upload that would otherwise succeed, so all access is wrapped and failures
// degrade to "no journal" rather than propagating.

const STORAGE_KEY = 'pennsieve.finalizeJournal.v1'

// Bounds so a pathological run can't wedge the origin's storage quota. 5k
// entries is ~700 KB of JSON, comfortably inside the usual 5 MB budget and
// well above any realistic count of *unfinalized* files (they're removed as
// soon as the server confirms them, so steady state is near zero).
const MAX_ENTRIES = 5000

// Entries older than this are dropped unread. By then the server-side
// reconcile sweep has long since handled the file one way or the other, so
// replaying is pointless and we'd only be resurrecting stale uploadIds.
const TTL_MS = 7 * 24 * 60 * 60 * 1000

const read = () => {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        // Corrupt or inaccessible — treat as empty rather than throwing into
        // the upload path.
        return []
    }
}

const write = (entries) => {
    try {
        if (entries.length === 0) {
            window.localStorage.removeItem(STORAGE_KEY)
            return
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (e) {
        // Quota exceeded or storage disabled. Nothing useful to do — the
        // upload itself is unaffected, we just lose crash-recovery for it.
        console.warn('finalizeJournal: unable to persist', e)
    }
}

const isFresh = (entry, now) =>
    entry && typeof entry.uploadId === 'string' && now - (entry.ts || 0) < TTL_MS

// add records files whose S3 PUT just completed. Called once per file, right
// after the PUT resolves and before the finalize POST is attempted.
export const add = (entries) => {
    if (!entries || entries.length === 0) return
    const now = Date.now()
    const existing = read().filter((e) => isFresh(e, now))
    const seen = new Set(existing.map((e) => e.uploadId))
    for (const e of entries) {
        if (!e || !e.uploadId || seen.has(e.uploadId)) continue
        existing.push({ ...e, ts: now })
        seen.add(e.uploadId)
    }
    // Keep the newest when over the cap — the oldest entries are the ones the
    // server-side sweep is most likely to have already dealt with.
    write(existing.slice(-MAX_ENTRIES))
}

// remove drops entries the server has made a determination about, whether the
// outcome was success or a per-file rejection. Only request-level failures
// (network error, 5xx, expired token) leave entries in place, because those
// are the cases where a retry can still change the outcome.
export const remove = (uploadIds) => {
    if (!uploadIds || uploadIds.length === 0) return
    const drop = new Set(uploadIds)
    const now = Date.now()
    write(read().filter((e) => isFresh(e, now) && !drop.has(e.uploadId)))
}

// groups returns the outstanding entries bucketed by the tuple that has to be
// constant across a single finalize request: the manifest it belongs to, the
// dataset used for authorization, and the conflict strategy the user chose for
// that batch. Replaying with a different onConflict than the user picked would
// silently change whether their files replace or coexist with existing ones,
// so the choice is journaled alongside the file.
export const groups = () => {
    const now = Date.now()
    const out = new Map()
    for (const e of read()) {
        if (!isFresh(e, now)) continue
        if (!e.manifestNodeId || !e.datasetId) continue
        const key = `${e.datasetId}|${e.manifestNodeId}|${e.onConflict || 'keepBoth'}`
        if (!out.has(key)) {
            out.set(key, {
                datasetId: e.datasetId,
                manifestNodeId: e.manifestNodeId,
                onConflict: e.onConflict || 'keepBoth',
                files: [],
            })
        }
        out.get(key).files.push({
            uploadId: e.uploadId,
            size: e.size,
            sha256: e.sha256,
        })
    }
    return [...out.values()]
}

// count is used by the unload guard to decide whether leaving the page would
// strand anything.
export const count = () => {
    const now = Date.now()
    return read().filter((e) => isFresh(e, now)).length
}

// prune expires stale entries. Called on load before a replay so the TTL is
// enforced even if the user never uploads again.
export const prune = () => {
    const now = Date.now()
    const entries = read()
    const fresh = entries.filter((e) => isFresh(e, now))
    if (fresh.length !== entries.length) write(fresh)
}

export default { add, remove, groups, count, prune }
