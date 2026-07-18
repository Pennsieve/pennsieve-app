// @/stores/ontologyStore.js
//
// Client-side ontology term search (ONT-2). Loads the published ontology slices
// (open annotation ontologies MONDO/HPO/UBERON/NCIt + a static UCUM unit list)
// from the catalog bucket into DuckDB-WASM via the shared duckdbStore, then does
// search-as-you-type over label/synonyms — zero-API-latency, offline, the same
// read path as the CDE catalog. Slices are public, so no auth.
//
// Each ontology is published + versioned independently: a single registry
// (ontology/sources.json) points at each ontology's current slice
// (ontology/<slug>/versions/<build>/<slug>.parquet), so ontologies can be added
// or refreshed one at a time.
//
// Used to link a standard ontology term to a dataset tag / custom-model property.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as site from '@/site-config/site.json'
import { useDuckDBStore } from '@/stores/duckdbStore'

const VIEWER_ID = 'ontology'

// The columns every slice shares (see cde-service ONT-1).
const COLUMNS = 'curie, iri, label, synonyms, definition, ontology, ontology_version'

// Escape a user term for inlining into a single-quoted SQL literal.
const esc = (s) => String(s || '').replace(/'/g, "''")

export const useOntologyStore = defineStore('ontology', () => {
    const duck = useDuckDBStore()

    const loading = ref(false)
    const loaded = ref(false)
    const error = ref('')
    const sources = ref([]) // [{ ontology, ontology_version, count, table }]

    let connectionId = null
    let loadPromise = null

    const baseUrl = computed(() => (site.cdeCatalogUrl || '').replace(/\/+$/, ''))
    const isConfigured = computed(() => !!baseUrl.value)

    // Read the registry and load every listed ontology's current slice into its
    // own DuckDB table (search UNIONs across them). Single-flight.
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
                const registry = await fetchJson(`${baseUrl.value}/ontology/sources.json`)
                const ontologies = registry.ontologies || []
                if (!ontologies.length) throw new Error('ontology registry is empty')

                const loadedSources = []
                for (const o of ontologies) {
                    const table = 'onto_' + String(o.slug || '').replace(/[^a-z0-9_]/gi, '_')
                    // Slice is immutable per build, so key the cached load by build.
                    await duck.loadParquetUrl(
                        `${baseUrl.value}/${o.path}`,
                        table,
                        { materialize: true },
                        VIEWER_ID,
                        `${table}_${o.build}`
                    )
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

    return { loading, loaded, error, sources, isConfigured, ensureLoaded, search }
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
