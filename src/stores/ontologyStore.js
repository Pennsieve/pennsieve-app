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
    const loaded = ref(false) // every ontology loaded (ensureLoaded)
    const error = ref('')
    const available = ref([]) // registry entries [{ ontology, slug, build, path, edges_path, ... }]
    const sources = ref([]) // loaded [{ ontology, ontology_version, count, table, edgesTable }]

    let connectionId = null
    let registryPromise = null
    let loadAllPromise = null
    const ontologyPromises = {} // ontology name -> in-flight load (single-flight per ontology)

    const baseUrl = computed(() => (site.cdeCatalogUrl || '').replace(/\/+$/, ''))
    const isConfigured = computed(() => !!baseUrl.value)

    // Fetch the registry (cheap: one small JSON) and open the DuckDB connection —
    // but load NO slices. This is all the browser needs before it can list the
    // ontologies and lazily load the selected one. Single-flight.
    const ensureRegistry = async () => {
        if (available.value.length) return
        if (registryPromise) return registryPromise
        if (!baseUrl.value) {
            error.value = 'Catalog URL is not configured (site.cdeCatalogUrl).'
            throw new Error(error.value)
        }
        registryPromise = (async () => {
            try {
                const registry = await fetchJson(`${baseUrl.value}/ontology/sources.json`)
                const ontologies = registry.ontologies || []
                if (!ontologies.length) throw new Error('ontology registry is empty')
                available.value = ontologies
                const { connectionId: cid } = await duck.createConnection(VIEWER_ID)
                connectionId = cid
            } catch (e) {
                error.value = e?.message || String(e)
                throw e
            } finally {
                registryPromise = null
            }
        })()
        return registryPromise
    }

    // Load one ontology's term + edges views on demand (single-flight per ontology).
    // Each is registered as a VIEW (materialize:false): DuckDB reads the parquet
    // footer, then range-fetches only the row-groups/columns a query touches (and
    // caches them) — no upfront full download. Loading just the selected ontology
    // keeps the browser's first paint fast; the picker loads them all via
    // ensureLoaded for cross-ontology search.
    const ensureOntology = async (ontologyName) => {
        await ensureRegistry()
        if (sources.value.some((s) => s.ontology === ontologyName)) return
        if (ontologyPromises[ontologyName]) return ontologyPromises[ontologyName]
        const o = available.value.find((e) => e.ontology === ontologyName)
        if (!o) return

        loading.value = true
        ontologyPromises[ontologyName] = (async () => {
            try {
                const table = 'onto_' + String(o.slug || '').replace(/[^a-z0-9_]/gi, '_')
                // Slice is immutable per build, so key the cached load by build.
                const loads = [
                    duck.loadParquetUrl(`${baseUrl.value}/${o.path}`, table, { materialize: false }, VIEWER_ID, `${table}_${o.build}`),
                ]
                // is_a edges sidecar (sorted by parent) — a fast children lookup for
                // the tree. Optional: older slices predate it, in which case children()
                // falls back to scanning the parents column. Loaded in parallel.
                let edgesTable = null
                if (o.edges_path) {
                    edgesTable = table + '_edges'
                    loads.push(
                        duck.loadParquetUrl(`${baseUrl.value}/${o.edges_path}`, edgesTable, { materialize: false }, VIEWER_ID, `${edgesTable}_${o.build}`)
                    )
                }
                await Promise.all(loads)
                if (!sources.value.some((s) => s.ontology === ontologyName)) {
                    sources.value = [
                        ...sources.value,
                        { ontology: o.ontology, ontology_version: o.ontology_version, count: o.count, table, edgesTable },
                    ]
                }
            } catch (e) {
                error.value = e?.message || String(e)
                throw e
            } finally {
                loading.value = false
                delete ontologyPromises[ontologyName]
            }
        })()
        return ontologyPromises[ontologyName]
    }

    // Load every ontology (cross-ontology search). Single-flight; ontologies load
    // in parallel rather than one blocking round-trip each.
    const ensureLoaded = async () => {
        if (loaded.value) return
        if (loadAllPromise) return loadAllPromise
        loadAllPromise = (async () => {
            try {
                await ensureRegistry()
                await Promise.all(available.value.map((o) => ensureOntology(o.ontology)))
                loaded.value = true
            } finally {
                loadAllPromise = null
            }
        })()
        return loadAllPromise
    }

    // Search-as-you-type over label + synonyms (+ exact curie), across all (or a
    // filtered subset of) loaded ontologies. Obsolete terms are excluded. Returns
    // [{ curie, iri, label, synonyms, definition, ontology, ontology_version }],
    // best matches first.
    const search = async (rawTerm, { limit = 20, ontologies = null } = {}) => {
        const term = String(rawTerm || '').trim()
        if (!term) return []
        // Scoped search (the browser) loads only the named ontologies; an unscoped
        // search (the picker) loads all for cross-ontology matching.
        if (ontologies && ontologies.length) {
            await ensureRegistry()
            await Promise.all(ontologies.map((o) => ensureOntology(o)))
        } else {
            await ensureLoaded()
        }

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

    // Union of every loaded slice, obsolete terms excluded. Excluding them here
    // keeps the whole is_a graph (roots/children/lineage/descendants/ancestors)
    // free of deprecated concepts — which matters because obsolete OBO terms have
    // their is_a parents stripped, so they would otherwise surface as spurious roots.
    const unionAll = () =>
        sources.value
            .map((s) => `SELECT curie, label, ontology, parents FROM ${s.table} WHERE COALESCE(obsolete, false) = false`)
            .join(' UNION ALL ')

    const mapRows = (rows) =>
        (rows || []).map((r) => ({
            curie: r.curie == null ? '' : String(r.curie),
            label: r.label == null ? '' : String(r.label),
            ontology: r.ontology == null ? '' : String(r.ontology),
        }))

    // Descendants of a term (the subtree) — the enumerable set an "ontology subtree
    // value set" is built from. Two granularity controls:
    //   maxDepth   — include only terms within N is_a levels of the root (null = all).
    //   leavesOnly — keep only the most-specific terms in scope (no child in the set).
    // Excludes the root itself unless includeSelf. Returns [{ curie, label, ontology }].
    const descendants = async (curie, { includeSelf = false, maxDepth = null, leavesOnly = false, limit = 5000 } = {}) => {
        await ensureLoaded()
        if (!sources.value.length) return []
        const c = esc(curie)
        // Bound recursion by depth when set: only expand a node's children while its
        // own depth is below the cap (root = depth 0).
        const depthGuard =
            maxDepth != null && maxDepth >= 0 ? `WHERE s.depth < ${Math.floor(Number(maxDepth))}` : ''

        const filters = []
        if (!includeSelf) filters.push(`curie <> '${c}'`)
        if (leavesOnly) {
            // A leaf in scope = a subtree node that no other subtree node lists as a
            // parent (i.e. it has no in-scope children).
            filters.push(
                `curie NOT IN (SELECT DISTINCT p FROM sub, unnest(string_split(sub.parents, '|')) AS u(p) WHERE p <> '')`
            )
        }
        const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''

        const query = `
            WITH RECURSIVE all_terms AS (${unionAll()}),
            sub AS (
                SELECT curie, label, ontology, parents, 0 AS depth FROM all_terms WHERE curie = '${c}'
                UNION
                SELECT t.curie, t.label, t.ontology, t.parents, s.depth + 1
                FROM all_terms t JOIN sub s ON list_contains(string_split(t.parents, '|'), s.curie)
                ${depthGuard}
            )
            SELECT DISTINCT curie, label, ontology FROM sub ${where} LIMIT ${Number(limit) || 5000}
        `
        return mapRows(await duck.executeQuery(query, connectionId))
    }

    // One full term record by exact curie — hydrates the detail panel when a term
    // is reached by tree/breadcrumb navigation (search already returns full rows).
    // Returns the normalized row or null.
    const getByCurie = async (curie) => {
        await ensureRegistry()
        if (!sources.value.length) return null
        const c = esc(curie)
        const tables = sources.value.map((s) => `SELECT ${COLUMNS} FROM ${s.table}`)
        const query = `
            WITH terms AS (${tables.join(' UNION ALL ')})
            SELECT ${COLUMNS} FROM terms WHERE curie = '${c}' LIMIT 1
        `
        const rows = await duck.executeQuery(query, connectionId)
        return rows && rows.length ? normalizeRow(rows[0]) : null
    }

    const mapTree = (rows) =>
        (rows || []).map((r) => ({
            curie: r.curie == null ? '' : String(r.curie),
            label: r.label == null ? '' : String(r.label),
            ontology: r.ontology == null ? '' : String(r.ontology),
            has_children: !!r.has_children,
        }))

    const tableFor = (ontology) => (sources.value.find((s) => s.ontology === ontology) || {}).table

    // Top-level terms of one ontology — a tree root = a term none of whose parents
    // are in this ontology's slice (parents empty, or all point outside). Each row
    // carries has_children so the tree can decide whether to render an expand arrow.
    const roots = async (ontology, { limit = 300 } = {}) => {
        await ensureOntology(ontology)
        const table = tableFor(ontology)
        if (!table) return []
        const query = `
            WITH all_terms AS (SELECT curie, label, ontology, parents FROM ${table} WHERE COALESCE(obsolete, false) = false)
            SELECT r.curie, r.label, r.ontology,
                EXISTS (SELECT 1 FROM all_terms t WHERE list_contains(string_split(t.parents, '|'), r.curie)) AS has_children
            FROM all_terms r
            WHERE r.parents IS NULL OR r.parents = ''
                OR NOT EXISTS (SELECT 1 FROM all_terms p WHERE list_contains(string_split(r.parents, '|'), p.curie))
            ORDER BY lower(r.label)
            LIMIT ${Number(limit) || 300}
        `
        return mapTree(await duck.executeQuery(query, connectionId))
    }

    // Direct is_a children of a term (one level) — the lazy-load unit for the tree
    // and the "narrower terms" list in the detail panel. has_children lets the tree
    // show an expand arrow without a follow-up query.
    //
    // Prefer the per-ontology edges sidecar (sorted by parent): `WHERE parent = X`
    // prunes to a few row groups over range requests, and child_has_children is
    // precomputed. Fall back to scanning the parents string column for slices
    // published before edges existed.
    const children = async (curie, { limit = 3000 } = {}) => {
        await ensureRegistry()
        if (!sources.value.length) return []
        const c = esc(curie)
        const lim = Number(limit) || 3000

        const edgeTables = sources.value.map((s) => s.edgesTable).filter(Boolean)
        if (edgeTables.length) {
            const union = edgeTables
                .map(
                    (t) =>
                        `SELECT child AS curie, child_label AS label, child_ontology AS ontology, child_has_children AS has_children FROM ${t} WHERE parent = '${c}'`
                )
                .join(' UNION ALL ')
            const query = `SELECT curie, label, ontology, has_children FROM (${union}) ORDER BY lower(label) LIMIT ${lim}`
            return mapTree(await duck.executeQuery(query, connectionId))
        }

        const query = `
            WITH all_terms AS (${unionAll()})
            SELECT k.curie, k.label, k.ontology,
                EXISTS (SELECT 1 FROM all_terms t WHERE list_contains(string_split(t.parents, '|'), k.curie)) AS has_children
            FROM all_terms k
            WHERE list_contains(string_split(k.parents, '|'), '${c}')
            ORDER BY lower(k.label)
            LIMIT ${lim}
        `
        return mapTree(await duck.executeQuery(query, connectionId))
    }

    // Ancestors ordered general→specific (root first) with each term's min distance
    // from the start — the breadcrumb trail above the tree. Recursion is depth-capped
    // to stay bounded on diamond-shaped DAGs. Returns [{ curie, label, ontology, depth }].
    const lineage = async (curie, { limit = 100, maxDepth = 50 } = {}) => {
        await ensureRegistry()
        if (!sources.value.length) return []
        const c = esc(curie)
        const query = `
            WITH RECURSIVE all_terms AS (${unionAll()}),
            acc AS (
                SELECT curie, label, ontology, parents, 0 AS depth FROM all_terms WHERE curie = '${c}'
                UNION ALL
                SELECT t.curie, t.label, t.ontology, t.parents, a.depth + 1
                FROM all_terms t JOIN acc a ON list_contains(string_split(a.parents, '|'), t.curie)
                WHERE a.depth < ${Math.floor(Number(maxDepth)) || 50}
            )
            SELECT curie, label, ontology, min(depth) AS depth
            FROM acc WHERE curie <> '${c}'
            GROUP BY curie, label, ontology
            ORDER BY depth DESC
            LIMIT ${Number(limit) || 100}
        `
        const rows = await duck.executeQuery(query, connectionId)
        return (rows || []).map((r) => ({
            curie: r.curie == null ? '' : String(r.curie),
            label: r.label == null ? '' : String(r.label),
            ontology: r.ontology == null ? '' : String(r.ontology),
            depth: r.depth == null ? 0 : Number(r.depth),
        }))
    }

    // Ancestors of a term (path toward the roots) — breadcrumb context / broadening.
    const ancestors = async (curie, { limit = 200 } = {}) => {
        await ensureLoaded()
        if (!sources.value.length) return []
        const c = esc(curie)
        const query = `
            WITH RECURSIVE all_terms AS (${unionAll()}),
            acc AS (
                SELECT curie, label, ontology, parents FROM all_terms WHERE curie = '${c}'
                UNION
                SELECT t.curie, t.label, t.ontology, t.parents
                FROM all_terms t JOIN acc ON list_contains(string_split(acc.parents, '|'), t.curie)
            )
            SELECT DISTINCT curie, label, ontology FROM acc WHERE curie <> '${c}' LIMIT ${Number(limit) || 200}
        `
        return mapRows(await duck.executeQuery(query, connectionId))
    }

    return {
        loading, loaded, error, available, sources, isConfigured,
        ensureRegistry, ensureOntology, ensureLoaded,
        search, descendants, ancestors,
        getByCurie, roots, children, lineage,
    }
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
