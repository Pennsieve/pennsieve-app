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
const TABLE = 'cde_catalog' // slim list projection (browse/search/facets)
const FULL_TABLE = 'cde_full' // full records, materialized lazily on first detail

// Fallback projection: derive the slim list columns from the full records.parquet
// (id, data JSON) for releases published before records-list.parquet existed. The
// column set/names match the publisher's slim projection so all list queries work.
const LIST_FROM_FULL_COLUMNS = [
    'id',
    "(data::JSON) ->> 'persistent_id' AS persistent_id",
    "(data::JSON) ->> 'canonical_key' AS canonical_key",
    "(data::JSON) ->> 'cde_name' AS cde_name",
    "(data::JSON) ->> 'preferred_question_text' AS preferred_question_text",
    "(data::JSON) ->> 'cde_definition' AS cde_definition",
    "(data::JSON) ->> 'cde_source' AS cde_source",
    "(data::JSON) ->> 'steward_org' AS steward_org",
    "(data::JSON) ->> 'cde_data_type' AS cde_data_type",
    "(data::JSON) ->> 'copyright_status' AS copyright_status",
    "(data::JSON) ->> 'registration_status' AS registration_status",
    "to_json((data::JSON) -> 'aliases') AS aliases",
    "CASE WHEN json_type((data::JSON) -> 'permissible_values') = 'ARRAY'" +
        " THEN json_array_length((data::JSON) -> 'permissible_values') ELSE 0 END AS permissible_values_count",
].join(', ')

export const useCdeCatalogStore = defineStore('cdeCatalog', () => {
    const duck = useDuckDBStore()

    const loading = ref(false)
    const loaded = ref(false)
    const error = ref('')
    const catalogVersion = ref('')

    let connectionId = null
    let loadPromise = null
    let fullLoaded = false
    let fullLoadPromise = null
    let models = {} // model name -> published version, from the release manifest
    let bundlesLoaded = false
    let membershipCache = null // persistent_id -> [bundle_name, ...]
    let relLoaded = false
    let classificationsLoaded = false
    let facetMap = null // persistent_id -> { diseases:Set, domains:Set }
    let facetValuesCache = null

    const baseUrl = computed(() => (site.cdeCatalogUrl || '').replace(/\/+$/, ''))
    const isConfigured = computed(() => !!baseUrl.value)

    // Parquet artifacts (columnar + zstd), read via DuckDB HTTP range requests.
    const modelRecordsUrl = (name) =>
        `${baseUrl.value}/cde/versions/${catalogVersion.value}` +
        `/metadata/models/${name}/versions/${models[name]}/records.parquet`
    // Slim list projection of the cde model (flattened display/search columns,
    // no heavy blobs) — a fraction of records.parquet, and no per-row JSON parse.
    const cdeListUrl = () =>
        `${baseUrl.value}/cde/versions/${catalogVersion.value}` +
        `/metadata/models/cde/versions/${models.cde}/records-list.parquet`
    const relationshipsUrl = () =>
        `${baseUrl.value}/cde/versions/${catalogVersion.value}/metadata/relationships.parquet`

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

                // Load only the slim list projection up front — browse, search and
                // facets run entirely on it (flat columns, no JSON parse). The full
                // records (permissible values, references, xrefs) load lazily on the
                // first detail/attach; pure browsing never pays for them.
                try {
                    await duck.loadParquetUrl(cdeListUrl(), TABLE, { materialize: true }, VIEWER_ID, `cde_list_${cv}`)
                } catch (e) {
                    // Older releases predate the slim projection — derive the same
                    // list columns from the full records.parquet so the catalog still
                    // works (just without the smaller/faster list read).
                    console.warn('CDE slim list projection unavailable; deriving from full records', e)
                    await duck.loadParquetUrl(
                        modelRecordsUrl('cde'),
                        TABLE,
                        { materialize: true, columns: LIST_FROM_FULL_COLUMNS },
                        VIEWER_ID,
                        `cde_list_fallback_${cv}`
                    )
                }
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

    // Free-text search over the slim list columns (name, question text, definition,
    // source, aliases). This intentionally does NOT match text buried in the heavy
    // blobs (permissible-value labels, references) — those aren't in the list file.
    // Returns list records, shortest name first (more-exact matches surface first).
    const SEARCH_COLS = ['cde_name', 'preferred_question_text', 'cde_definition', 'cde_source', 'aliases']
    const search = async (term, limit = 25) => {
        await ensureLoaded()
        const t = (term || '').trim()
        const n = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 25

        const where = t ? `WHERE ${searchPredicate(t)}` : ''
        const query =
            `SELECT * FROM ${TABLE} ${where}` +
            ` ORDER BY length(cde_name) NULLS LAST LIMIT ${n}`
        const rows = await duck.executeQuery(query, connectionId)
        return rows.map(mapListRow).filter(Boolean)
    }

    const searchPredicate = (t) => {
        const lit = escapeLiteral(t)
        return '(' + SEARCH_COLS.map((c) => `${c} ILIKE '%${lit}%'`).join(' OR ') + ')'
    }

    // Materialize the full cde records lazily — only when a detail/attach needs the
    // heavy fields (permissible values, references, xrefs). One-time ~4MB read.
    const ensureFullLoaded = async () => {
        await ensureLoaded()
        if (fullLoaded) return
        if (fullLoadPromise) return fullLoadPromise
        fullLoadPromise = (async () => {
            await duck.loadParquetUrl(
                modelRecordsUrl('cde'),
                FULL_TABLE,
                { materialize: true, columns: 'id, data::JSON AS data' },
                VIEWER_ID,
                `cde_full_${catalogVersion.value}`
            )
            fullLoaded = true
            fullLoadPromise = null
        })()
        return fullLoadPromise
    }

    // Resolve a single CDE's FULL record by its stable persistent_id (detail view,
    // attach/hydrate). Triggers the lazy full-records load.
    const getByPersistentId = async (persistentId) => {
        if (!persistentId) return null
        await ensureFullLoaded()
        const query =
            `SELECT to_json(data) AS data FROM ${FULL_TABLE}` +
            ` WHERE (to_json(data) ->> 'persistent_id') = '${escapeLiteral(persistentId)}' LIMIT 1`
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
        await duck.loadParquetUrl(relationshipsUrl(), 'cde_rel', { materialize: true }, VIEWER_ID, `cde_rel_${catalogVersion.value}`)
        relLoaded = true
    }
    const ensureBundlesLoaded = async () => {
        await ensureLoaded()
        if (bundlesLoaded) return
        await duck.loadParquetUrl(
            modelRecordsUrl('bundle'),
            'cde_bundle',
            { materialize: true, columns: 'id, data::JSON AS data' },
            VIEWER_ID,
            `cde_bundle_${catalogVersion.value}`
        )
        await ensureRelationshipsLoaded()
        bundlesLoaded = true
    }
    // cde_classification records carry the disease (`context`) and `domain` facets.
    // The publisher promotes those facet fields to top-level parquet columns, so we
    // load this as a VIEW: facet queries reference cls.context/domain/tier directly
    // and DuckDB pushes the projection down to the remote scan (reads only those
    // columns, not the whole record blob). They link to CDEs via CLASSIFIES edges.
    const ensureClassificationsLoaded = async () => {
        await ensureLoaded()
        if (classificationsLoaded) return
        await duck.loadParquetUrl(
            modelRecordsUrl('cde_classification'),
            'cde_cls',
            { materialize: false },
            VIEWER_ID,
            `cde_cls_${catalogVersion.value}`
        )
        await ensureRelationshipsLoaded()
        classificationsLoaded = true
    }

    // persistent_id -> { diseases:Set, domains:Set, tiers:Set, pairs:Set } from
    // the classification edges. `tiers` is all tiers across diseases; `pairs`
    // holds `${disease} ${tier}` so tier can be filtered within a disease
    // (a CDE may be Core for one disease and Supplemental for another).
    const getFacetMap = async () => {
        if (facetMap) return facetMap
        await ensureClassificationsLoaded()
        // cls.context/domain/tier are promoted parquet columns. `context` is a real
        // disease only when the classification is rooted under "Disease" (NINDS);
        // other stewards root their trees under collection/domain names that aren't
        // diseases. Take path[0] from the record blob and only treat Disease-rooted
        // contexts as diseases (domain/tier are unaffected).
        const query = `
            SELECT cde.persistent_id AS pid,
                   cls.context AS disease,
                   cls.domain AS domain,
                   cls.tier AS tier,
                   ((cls.data::JSON) -> 'path' ->> 0) AS path_root
            FROM ${TABLE} cde
            JOIN cde_rel cl ON cl.target_record_id = CAST(cde.id AS VARCHAR) AND cl.relationship_type = 'CLASSIFIES'
            JOIN cde_cls cls ON CAST(cls.id AS VARCHAR) = cl.source_record_id`
        const rows = await duck.executeQuery(query, connectionId)
        const map = new Map()
        for (const r of rows) {
            if (!r.pid) continue
            let e = map.get(r.pid)
            if (!e) {
                e = { diseases: new Set(), domains: new Set(), tiers: new Set(), pairs: new Set() }
                map.set(r.pid, e)
            }
            const isDisease = r.path_root === 'Disease'
            if (r.disease && isDisease) e.diseases.add(r.disease)
            if (r.domain) e.domains.add(r.domain)
            if (r.tier) {
                e.tiers.add(r.tier)
                if (r.disease && isDisease) e.pairs.add(`${r.disease} ${r.tier}`)
            }
        }
        facetMap = map
        return map
    }

    // Order tiers by recommendation priority (best first) for the filter UI.
    const TIER_ORDER = ['Core', 'Recommended', 'Supplemental - Highly Recommended', 'Supplemental', 'Basic']
    const tierRank = (t) => {
        const i = TIER_ORDER.indexOf(t)
        return i === -1 ? 99 : i
    }

    // Distinct facet values for the filter UI: { diseases, domains, tiers }.
    const getFacetValues = async () => {
        if (facetValuesCache) return facetValuesCache
        const map = await getFacetMap()
        const diseases = new Set()
        const domains = new Set()
        const tiers = new Set()
        for (const e of map.values()) {
            e.diseases.forEach((d) => diseases.add(d))
            e.domains.forEach((d) => domains.add(d))
            e.tiers.forEach((t) => tiers.add(t))
        }
        facetValuesCache = {
            diseases: [...diseases].sort(),
            domains: [...domains].sort(),
            tiers: [...tiers].sort((a, b) => tierRank(a) - tierRank(b)),
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
            SELECT * FROM ${TABLE}
            WHERE CAST(id AS VARCHAR) IN (
                SELECT cl.target_record_id
                FROM cde_bundle b
                JOIN cde_rel po ON po.target_record_id = CAST(b.id AS VARCHAR) AND po.relationship_type = 'PART_OF'
                JOIN cde_rel cl ON cl.source_record_id = po.source_record_id AND cl.relationship_type = 'CLASSIFIES'
                WHERE (to_json(b.data) ->> 'bundle_name') = '${escapeLiteral(bundleName)}'
            )
            ORDER BY length(cde_name) NULLS LAST`
        const rows = await duck.executeQuery(query, connectionId)
        return rows.map(mapListRow).filter(Boolean)
    }

    // persistent_id -> [bundle_name, ...] for every CDE that belongs to a bundle.
    // Computed once and cached (used to annotate search results with the bundle
    // they're part of, without hiding them).
    const getBundleMembership = async () => {
        if (membershipCache) return membershipCache
        await ensureBundlesLoaded()
        const query = `
            SELECT cde.persistent_id AS pid, to_json(b.data) ->> 'bundle_name' AS bundle_name
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
    // annotated with `_bundles`, the bundles it belongs to). With no term/facet
    // it browses — all bundles + a sample of CDEs; a term filters both; a facet
    // narrows CDEs and hides the (cross-disease) bundles.
    const searchCatalog = async (term, opts = {}) => {
        const { limit = 25 } = opts
        // Facets are multi-select: OR within a dimension, AND across dimensions.
        const diseases = asList(opts.disease)
        const domains = asList(opts.domain)
        const tiers = asList(opts.tier)
        await ensureBundlesLoaded()
        const t = (term || '').trim()
        const hasFacet = diseases.length > 0 || domains.length > 0 || tiers.length > 0

        const [allBundles, membership] = await Promise.all([listBundles(), getBundleMembership()])
        // Facets are CDE-level; when one is active we're doing targeted element
        // search, so hide the (cross-disease) bundle groupings.
        const bundles = hasFacet
            ? []
            : t
              ? allBundles.filter((b) => b.bundle_name.toLowerCase().includes(t.toLowerCase()))
              : allBundles

        // Always list CDEs — a sample when browsing (no term/facet), narrowed as
        // the user types or applies facets.
        const facets = hasFacet ? await getFacetMap() : null
        const raw = await search(t, hasFacet ? 500 : limit)
        const cdes = raw
            .filter((c) => {
                if (!hasFacet) return true
                const f = facets.get(c.persistent_id)
                if (!f) return false
                if (diseases.length && !diseases.some((d) => f.diseases.has(d))) return false
                if (domains.length && !domains.some((d) => f.domains.has(d))) return false
                if (tiers.length) {
                    // Tier is per (CDE × disease): within a selected disease if any
                    // are chosen, otherwise the tier in any disease.
                    const ok = diseases.length
                        ? tiers.some((tv) => diseases.some((d) => f.pairs.has(`${d} ${tv}`)))
                        : tiers.some((tv) => f.tiers.has(tv))
                    if (!ok) return false
                }
                return true
            })
            .slice(0, limit)
            .map((c) => ({ ...c, _bundles: membership.get(c.persistent_id) || [] }))
        return { bundles, cdes }
    }

    // Paginated CDE search for the gallery — search + facet filtering + count all
    // run in SQL (LIMIT/OFFSET) so it scales as the catalog grows. Facets are
    // multi-select: OR within a dimension, AND across dimensions; tier is matched
    // within the selected disease(s) if any are chosen. Returns { cdes, total }.
    const searchCdesPaged = async (term, opts = {}) => {
        const { page = 0, pageSize = 25 } = opts
        const diseases = asList(opts.disease)
        const domains = asList(opts.domain)
        const tiers = asList(opts.tier)
        await ensureLoaded()
        if (diseases.length || domains.length || tiers.length) await ensureClassificationsLoaded()

        const clauses = []
        const t = (term || '').trim()
        if (t) clauses.push(searchPredicate(t))

        // Correlated EXISTS against the classification edges for this CDE.
        const classExists = (cond) =>
            `EXISTS (
                SELECT 1 FROM cde_rel cl
                JOIN cde_cls cls ON CAST(cls.id AS VARCHAR) = cl.source_record_id
                WHERE cl.target_record_id = CAST(${TABLE}.id AS VARCHAR)
                  AND cl.relationship_type = 'CLASSIFIES' AND ${cond})`
        if (diseases.length) clauses.push(classExists(`cls.context IN (${sqlList(diseases)})`))
        if (domains.length) clauses.push(classExists(`cls.domain IN (${sqlList(domains)})`))
        if (tiers.length) {
            clauses.push(
                classExists(
                    diseases.length
                        ? `cls.context IN (${sqlList(diseases)}) AND cls.tier IN (${sqlList(tiers)})`
                        : `cls.tier IN (${sqlList(tiers)})`
                )
            )
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

        const countRows = await duck.executeQuery(`SELECT COUNT(*) AS n FROM ${TABLE} ${where}`, connectionId)
        const total = Number(countRows[0]?.n || 0)

        const query =
            `SELECT * FROM ${TABLE} ${where}` +
            ` ORDER BY length(cde_name) NULLS LAST` +
            ` LIMIT ${Math.max(1, pageSize)} OFFSET ${Math.max(0, page) * pageSize}`
        const rows = await duck.executeQuery(query, connectionId)
        return { cdes: rows.map(mapListRow).filter(Boolean), total }
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
        searchCdesPaged,
    }
})

async function fetchJson(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
    return res.json()
}

// parseRow: full record (the `data` JSON payload) — used for detail/attach.
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

// mapListRow: a slim list record built from the flattened list-projection columns
// (no heavy blobs). permissible_values_count lets the UI show "N values" without
// the values; the full record (values/references/xrefs) is fetched on demand via
// getByPersistentId when a CDE is opened or attached.
function mapListRow(row) {
    if (!row || (!row.persistent_id && !row.id)) return null
    let aliases = null
    if (typeof row.aliases === 'string' && row.aliases.trim()) {
        try {
            aliases = JSON.parse(row.aliases)
        } catch {
            aliases = null
        }
    }
    return {
        id: row.id ?? null,
        persistent_id: row.persistent_id ?? null,
        canonical_key: row.canonical_key ?? null,
        cde_name: row.cde_name ?? null,
        preferred_question_text: row.preferred_question_text ?? null,
        cde_definition: row.cde_definition ?? null,
        cde_source: row.cde_source ?? null,
        steward_org: row.steward_org ?? null,
        cde_data_type: row.cde_data_type ?? null,
        copyright_status: row.copyright_status ?? null,
        registration_status: row.registration_status ?? null,
        aliases,
        permissible_values_count: Number(row.permissible_values_count ?? 0),
    }
}

// Escape a value used inside a single-quoted SQL string literal.
function escapeLiteral(s) {
    return String(s).replace(/'/g, "''")
}

// Normalize a facet arg (scalar, array, or empty) to a list of non-empty strings.
function asList(v) {
    const arr = Array.isArray(v) ? v : v == null ? [] : [v]
    return arr.filter((x) => x != null && String(x).trim() !== '')
}

// Render a list of values as a SQL IN-list of quoted literals.
function sqlList(vals) {
    return vals.map((v) => `'${escapeLiteral(v)}'`).join(', ')
}
