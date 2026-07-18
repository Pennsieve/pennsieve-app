// @/stores/ontologyStore.js
//
// Client-side ontology term search (ONT-2). Loads the published ontology slices
// (open annotation ontologies MONDO/HPO/UBERON/NCIt + a static UCUM unit list)
// from the catalog bucket into DuckDB-WASM via the shared duckdbStore, then does
// search-as-you-type over label/synonyms — zero-API-latency, offline, the same
// read path as the CDE catalog. Slices are public, so no auth.
//
// Used by the property editor to link a standard ontology term to a custom-model
// property (an `x-pennsieve-concept` annotation). Read-only; the term is
// snapshotted onto the property at pick time.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from '@/site-config/site.json'
import { useDuckDBStore } from '@/stores/duckdbStore'

const VIEWER_ID = 'ontology'

// One value-list of the columns every slice shares (see cde-service ONT-1).
const COLUMNS = 'curie, iri, label, synonyms, definition, ontology, ontology_version'

// Escape a user term for inlining into a single-quoted SQL literal.
const esc = (s) => String(s || '').replace(/'/g, "''")

export const useOntologyStore = defineStore('ontology', () => {
    const duck = useDuckDBStore()

    const loading = ref(false)
    const loaded = ref(false)
    const error = ref('')
    const version = ref('') // our slice-build version
    const sources = ref([]) // [{ ontology, ontology_version, count, table }]

    let connectionId = null
    let loadPromise = null

    const baseUrl = computed(() => (site.cdeCatalogUrl || '').replace(/\/+$/, ''))
    const isConfigured = computed(() => !!baseUrl.value)

    const sliceUrl = (path) => `${baseUrl.value}/ontology/versions/${version.value}/${path}`

    // Resolve the current slice build and load every slice into DuckDB (one table
    // per ontology; search UNIONs across them). Single-flight.
    const ensureLoaded = async () => {
        if (loaded.value) return
        if (loadPromise) return loadPromise
        if (!baseUrl.value) {
            error.value = 'Catalog URL is not configured (site.cdeCatalogUrl).'
            throw new Error(error.value)
        }

        loading.value = true
        error.value = ''
        loadPromise = (async () => {
            try {
                const latest = await fetchJson(`${baseUrl.value}/ontology/latest.json`)
                const v = latest.version
                if (!v) throw new Error('ontology latest.json has no version')
                version.value = v

                const manifest = await fetchJson(`${baseUrl.value}/ontology/versions/${v}/manifest.json`)
                const ontologies = manifest.ontologies || []
                if (!ontologies.length) throw new Error('ontology manifest is empty')

                const loadedSources = []
                for (const o of ontologies) {
                    const table = 'onto_' + o.path.replace(/\.parquet$/i, '').replace(/[^a-z0-9_]/gi, '_')
                    await duck.loadParquetUrl(sliceUrl(o.path), table, { materialize: true }, VIEWER_ID, `${table}_${v}`)
                    loadedSources.push({
                        ontology: o.ontology,
                        ontology_version: o.ontology_version,
                        count: o.count,
                        table,
                    })
                }
                sources.value = loadedSources

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

    // Search-as-you-type over label + synonyms (+ exact curie), across all (or a
    // filtered subset of) loaded ontologies. Obsolete terms are excluded. Returns
    // [{ curie, iri, label, synonyms, definition, ontology, ontology_version }],
    // best matches first.
    const search = async (rawTerm, { limit = 20, ontologies = null } = {}) => {
        const term = String(rawTerm || '').trim()
        if (!term) return []
        await ensureLoaded()

        const t = esc(term)
        const like = `'%${t}%'`
        const tables = sources.value
            .filter((s) => !ontologies || ontologies.includes(s.ontology))
            .map((s) => `SELECT ${COLUMNS} FROM ${s.table} WHERE COALESCE(obsolete, false) = false`)
        if (!tables.length) return []

        const query = `
            WITH terms AS (${tables.join(' UNION ALL ')})
            SELECT ${COLUMNS}
            FROM terms
            WHERE label ILIKE ${like} OR synonyms ILIKE ${like} OR curie ILIKE '${t}%'
            ORDER BY
                (lower(label) = lower('${t}')) DESC,          -- exact label
                (lower(curie) = lower('${t}')) DESC,          -- exact curie
                (label ILIKE '${t}%') DESC,                   -- label prefix
                length(label) ASC
            LIMIT ${Number(limit) || 20}
        `
        const rows = await duck.executeQuery(query, connectionId)
        return (rows || []).map(normalizeRow)
    }

    return { loading, loaded, error, version, sources, isConfigured, ensureLoaded, search }
})

// DuckDB rows come back as Arrow rows; normalize to plain objects/strings.
function normalizeRow(r) {
    const g = (k) => {
        const v = r[k]
        return v == null ? '' : String(v)
    }
    return {
        curie: g('curie'),
        iri: g('iri'),
        label: g('label'),
        synonyms: g('synonyms'),
        definition: g('definition'),
        ontology: g('ontology'),
        ontology_version: g('ontology_version'),
    }
}

async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-cache' })
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
    return res.json()
}
