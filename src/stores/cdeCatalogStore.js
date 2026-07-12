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
    let models = {} // model name -> published version, from the release manifest
    let bundlesLoaded = false
    let membershipCache = null // persistent_id -> [bundle_name, ...]
    let relLoaded = false
    let classificationsLoaded = false
    let facetMap = null // persistent_id -> { diseases:Set, domains:Set }
    let facetValuesCache = null

    const baseUrl = computed(() => (site.cdeCatalogUrl || '').replace(/\/+$/, ''))
    const isConfigured = computed(() => !!baseUrl.value)

    const modelRecordsUrl = (name) =>
        `${baseUrl.value}/cde/versions/${catalogVersion.value}` +
        `/metadata/models/${name}/versions/${models[name]}/records.jsonl`
    const relationshipsUrl = () =>
        `${baseUrl.value}/cde/versions/${catalogVersion.value}/metadata/relationships.csv`

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
                models = Object.fromEntries((manifest.models || []).map((m) => [m.name, m.version]))
                if (!models.cde) throw new Error('catalog manifest has no cde model')

                await duck.loadFile(modelRecordsUrl('cde'), 'jsonl', TABLE, {}, VIEWER_ID, `cde_catalog_${cv}`)
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

    // Bundle membership is a two-hop join over the relationship edges:
    // bundle <-PART_OF- classification -CLASSIFIES-> cde. Load the bundle records
    // + relationship edges lazily (only when bundle features are used); the cde
    // table is already loaded by ensureLoaded.
    // Relationship edges (CLASSIFIES / PART_OF / …) are shared by the bundle and
    // classification (disease/domain) joins — load once.
    const ensureRelationshipsLoaded = async () => {
        await ensureLoaded()
        if (relLoaded) return
        await duck.loadFile(relationshipsUrl(), 'csv', 'cde_rel', {}, VIEWER_ID, `cde_rel_${catalogVersion.value}`)
        relLoaded = true
    }
    const ensureBundlesLoaded = async () => {
        await ensureLoaded()
        if (bundlesLoaded) return
        await duck.loadFile(modelRecordsUrl('bundle'), 'jsonl', 'cde_bundle', {}, VIEWER_ID, `cde_bundle_${catalogVersion.value}`)
        await ensureRelationshipsLoaded()
        bundlesLoaded = true
    }
    // cde_classification records carry the disease (`context`) and `domain` facets;
    // they link to CDEs via CLASSIFIES edges.
    const ensureClassificationsLoaded = async () => {
        await ensureLoaded()
        if (classificationsLoaded) return
        await duck.loadFile(modelRecordsUrl('cde_classification'), 'jsonl', 'cde_cls', {}, VIEWER_ID, `cde_cls_${catalogVersion.value}`)
        await ensureRelationshipsLoaded()
        classificationsLoaded = true
    }

    // persistent_id -> { diseases:Set, domains:Set } from the classification edges.
    const getFacetMap = async () => {
        if (facetMap) return facetMap
        await ensureClassificationsLoaded()
        const query = `
            SELECT to_json(cde.data) ->> 'persistent_id' AS pid,
                   to_json(cls.data) ->> 'context' AS disease,
                   to_json(cls.data) ->> 'domain' AS domain
            FROM ${TABLE} cde
            JOIN cde_rel cl ON cl.target_record_id = CAST(cde.id AS VARCHAR) AND cl.relationship_type = 'CLASSIFIES'
            JOIN cde_cls cls ON CAST(cls.id AS VARCHAR) = cl.source_record_id`
        const rows = await duck.executeQuery(query, connectionId)
        const map = new Map()
        for (const r of rows) {
            if (!r.pid) continue
            let e = map.get(r.pid)
            if (!e) {
                e = { diseases: new Set(), domains: new Set() }
                map.set(r.pid, e)
            }
            if (r.disease) e.diseases.add(r.disease)
            if (r.domain) e.domains.add(r.domain)
        }
        facetMap = map
        return map
    }

    // Distinct facet values for the filter UI: { diseases:[...], domains:[...] }.
    const getFacetValues = async () => {
        if (facetValuesCache) return facetValuesCache
        const map = await getFacetMap()
        const diseases = new Set()
        const domains = new Set()
        for (const e of map.values()) {
            e.diseases.forEach((d) => diseases.add(d))
            e.domains.forEach((d) => domains.add(d))
        }
        facetValuesCache = {
            diseases: [...diseases].sort(),
            domains: [...domains].sort(),
        }
        return facetValuesCache
    }

    // List bundles that have at least one member CDE, with member counts.
    const listBundles = async () => {
        await ensureBundlesLoaded()
        const query = `
            SELECT to_json(b.data) ->> 'bundle_name' AS bundle_name,
                   to_json(b.data) ->> 'domain' AS domain,
                   COUNT(DISTINCT cl.target_record_id) AS member_count
            FROM cde_bundle b
            LEFT JOIN cde_rel po ON po.target_record_id = CAST(b.id AS VARCHAR) AND po.relationship_type = 'PART_OF'
            LEFT JOIN cde_rel cl ON cl.source_record_id = po.source_record_id AND cl.relationship_type = 'CLASSIFIES'
            GROUP BY 1, 2
            HAVING member_count > 0
            ORDER BY bundle_name`
        const rows = await duck.executeQuery(query, connectionId)
        return rows.map((r) => ({
            bundle_name: r.bundle_name,
            domain: r.domain,
            member_count: Number(r.member_count),
        }))
    }

    // Resolve the member CDE records of a bundle (deduped; a CDE classified into
    // the bundle under multiple contexts appears once).
    const getBundleMembers = async (bundleName) => {
        if (!bundleName) return []
        await ensureBundlesLoaded()
        const query = `
            SELECT to_json(data) AS data FROM ${TABLE}
            WHERE CAST(id AS VARCHAR) IN (
                SELECT cl.target_record_id
                FROM cde_bundle b
                JOIN cde_rel po ON po.target_record_id = CAST(b.id AS VARCHAR) AND po.relationship_type = 'PART_OF'
                JOIN cde_rel cl ON cl.source_record_id = po.source_record_id AND cl.relationship_type = 'CLASSIFIES'
                WHERE to_json(b.data) ->> 'bundle_name' = '${escapeLiteral(bundleName)}'
            )
            ORDER BY length(to_json(data) ->> 'cde_name') NULLS LAST`
        const rows = await duck.executeQuery(query, connectionId)
        return rows.map(parseRow).filter(Boolean)
    }

    // persistent_id -> [bundle_name, ...] for every CDE that belongs to a bundle.
    // Computed once and cached (used to annotate search results with the bundle
    // they're part of, without hiding them).
    const getBundleMembership = async () => {
        if (membershipCache) return membershipCache
        await ensureBundlesLoaded()
        const query = `
            SELECT to_json(cde.data) ->> 'persistent_id' AS pid, to_json(b.data) ->> 'bundle_name' AS bundle_name
            FROM ${TABLE} cde
            JOIN cde_rel cl ON cl.target_record_id = CAST(cde.id AS VARCHAR) AND cl.relationship_type = 'CLASSIFIES'
            JOIN cde_rel po ON po.source_record_id = cl.source_record_id AND po.relationship_type = 'PART_OF'
            JOIN cde_bundle b ON CAST(b.id AS VARCHAR) = po.target_record_id`
        const rows = await duck.executeQuery(query, connectionId)
        const map = new Map()
        for (const r of rows) {
            if (!r.pid || !r.bundle_name) continue
            const arr = map.get(r.pid) || []
            if (!arr.includes(r.bundle_name)) arr.push(r.bundle_name)
            map.set(r.pid, arr)
        }
        membershipCache = map
        return map
    }

    // Unified search returning both bundles and individual CDEs (each CDE
    // annotated with `_bundles`, the bundles it belongs to). With no term, lists
    // all bundles (browse) and no CDEs (type to search elements).
    const searchCatalog = async (term, opts = {}) => {
        const { disease = '', domain = '', limit = 25 } = opts
        await ensureBundlesLoaded()
        const t = (term || '').trim()
        const hasFacet = !!disease || !!domain

        const [allBundles, membership] = await Promise.all([listBundles(), getBundleMembership()])
        // Facets are CDE-level; when one is active we're doing targeted element
        // search, so hide the (cross-disease) bundle groupings.
        const bundles = hasFacet
            ? []
            : t
              ? allBundles.filter((b) => b.bundle_name.toLowerCase().includes(t.toLowerCase()))
              : allBundles

        let cdes = []
        if (t || hasFacet) {
            const facets = hasFacet ? await getFacetMap() : null
            // Search wide, then narrow by facet client-side (catalog is small).
            const raw = await search(t, hasFacet ? 500 : limit)
            cdes = raw
                .filter((c) => {
                    if (!hasFacet) return true
                    const f = facets.get(c.persistent_id)
                    if (disease && !(f && f.diseases.has(disease))) return false
                    if (domain && !(f && f.domains.has(domain))) return false
                    return true
                })
                .slice(0, limit)
                .map((c) => ({ ...c, _bundles: membership.get(c.persistent_id) || [] }))
        }
        return { bundles, cdes }
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
        listBundles,
        getBundleMembers,
        getBundleMembership,
        getFacetValues,
        searchCatalog,
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
