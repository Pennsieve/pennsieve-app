// @/stores/cdeCatalogStore.js
//
// Read-only access to the published CDE catalog for the property-editor CDE
// picker. Resolves the current catalog release (latest.json -> manifest.json ->
// the `cde` model's records.jsonl on CloudFront) and loads it into DuckDB-WASM
// via the shared duckdbStore, then searches it with SQL. The catalog is public,
// so no auth is involved.
//
// This is intentionally lean: search + resolve-by-persistent_id. Richer ranking
// (SUGGEST) can build on the same DuckDB table later.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from '@/site-config/site.json'
import { useDuckDBStore } from '@/stores/duckdbStore'

const VIEWER_ID = 'cde-catalog'
const TABLE = 'cde_catalog'

export const useCdeCatalogStore = defineStore('cdeCatalog', () => {
    const duck = useDuckDBStore()

    const loading = ref(false)
    const loaded = ref(false)
    const error = ref('')
    const catalogVersion = ref('')

    let connectionId = null
    let loadPromise = null

    const baseUrl = computed(() => (site.cdeCatalogUrl || '').replace(/\/+$/, ''))
    const isConfigured = computed(() => !!baseUrl.value)

    // Resolve the current release and load its cde records.jsonl into DuckDB.
    // Single-flight so concurrent callers share one load.
    const ensureLoaded = async () => {
        if (loaded.value) return
        if (loadPromise) return loadPromise

        if (!baseUrl.value) {
            error.value = 'CDE catalog URL is not configured (site.cdeCatalogUrl).'
            throw new Error(error.value)
        }

        loading.value = true
        error.value = ''

        loadPromise = (async () => {
            try {
                const latest = await fetchJson(`${baseUrl.value}/cde/latest.json`)
                const cv = latest.catalog_version
                if (!cv) throw new Error('catalog latest.json has no catalog_version')
                catalogVersion.value = cv

                const manifest = await fetchJson(`${baseUrl.value}/cde/versions/${cv}/manifest.json`)
                const cdeModel = (manifest.models || []).find((m) => m.name === 'cde')
                if (!cdeModel) throw new Error('catalog manifest has no cde model')

                const recordsUrl =
                    `${baseUrl.value}/cde/versions/${cv}` +
                    `/metadata/models/cde/versions/${cdeModel.version}/records.jsonl`

                await duck.loadFile(recordsUrl, 'jsonl', TABLE, {}, VIEWER_ID, `cde_catalog_${cv}`)
                const { connectionId: cid } = await duck.createConnection(VIEWER_ID)
                connectionId = cid
                loaded.value = true
            } catch (e) {
                error.value = e?.message || String(e)
                throw e
            } finally {
                loading.value = false
                loadPromise = null
            }
        })()

        return loadPromise
    }

    // Search the catalog by name / definition / source. Returns an array of CDE
    // record objects (the `data` payload), most name-relevant first.
    const search = async (term, limit = 25) => {
        await ensureLoaded()
        const t = (term || '').trim()
        const n = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 25

        // Search across the whole record (name, definition, source, values, ...)
        // by matching the serialized JSON. Order by name length so shorter,
        // more-exact name matches surface first. Access fields via to_json(...)->>
        // (not struct dot-access) so a key missing on some records is NULL rather
        // than a struct binder error.
        const where = t ? `WHERE CAST(to_json(data) AS VARCHAR) ILIKE '%${escapeLiteral(t)}%'` : ''
        const query =
            `SELECT to_json(data) AS data FROM ${TABLE} ${where}` +
            ` ORDER BY length(to_json(data) ->> 'cde_name') NULLS LAST LIMIT ${n}`

        const rows = await duck.executeQuery(query, connectionId)
        return rows.map(parseRow).filter(Boolean)
    }

    // Resolve a single CDE by its stable persistent_id (e.g. for hydrating an
    // existing binding when editing a property).
    const getByPersistentId = async (persistentId) => {
        if (!persistentId) return null
        await ensureLoaded()
        const query =
            `SELECT to_json(data) AS data FROM ${TABLE}` +
            ` WHERE to_json(data) ->> 'persistent_id' = '${escapeLiteral(persistentId)}' LIMIT 1`
        const rows = await duck.executeQuery(query, connectionId)
        return rows.length ? parseRow(rows[0]) : null
    }

    return {
        loading,
        loaded,
        error,
        catalogVersion,
        isConfigured,
        ensureLoaded,
        search,
        getByPersistentId,
    }
})

async function fetchJson(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
    return res.json()
}

function parseRow(row) {
    let d = row?.data
    if (typeof d === 'string') {
        try {
            d = JSON.parse(d)
        } catch {
            return null
        }
    }
    return d && typeof d === 'object' ? d : null
}

// Escape a value used inside a single-quoted SQL string literal.
function escapeLiteral(s) {
    return String(s).replace(/'/g, "''")
}
