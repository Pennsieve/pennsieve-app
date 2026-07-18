// @/stores/cdeSuggestRanker.js
//
// The CDE lexical-suggest ranker (SUGGEST-1), extracted so the shipped picker
// (cdeCatalogStore) and the offline eval harness (eval/cde-suggest) run the
// EXACT same scoring. Pure JS — no Vue, no DuckDB, no app imports — so it loads
// unchanged under Vite (browser) and Node (the eval `.mjs`).
//
// Two stages, entirely client-side over the slim list (no infra, no LLM):
//   1. Retrieval — a coarse score narrows the catalog to the best RETRIEVE
//      candidates (recall). In the app this runs as DuckDB SQL; the SQL is built
//      from the COARSE weights below so it can't drift from stage 2 / the eval.
//   2. Rank — score each candidate by weighted token coverage across
//      name/question/aliases/definition + exact/prefix bonuses (precision).
//
// The optional `exclude`/`cols` params default to the shipped behavior. The eval
// uses them for its "cold" mode: when the query IS a candidate's own field
// (e.g. the CDE's preferred_question_text), scoring that field is circular, so
// cold mode excludes it to measure what the *other* fields can recover.

// Slim-list columns the suggest matches against (name, question, definition,
// source, aliases) — the heavy blobs aren't in the list projection.
export const SEARCH_COLS = ['cde_name', 'preferred_question_text', 'cde_definition', 'cde_source', 'aliases']

// How many candidates stage-1 retrieval keeps before ranking.
export const RETRIEVE = 300

// Coarse retrieval weights. The store builds its SQL CASE-score from these and
// the eval scores in JS from these — one source of truth for both.
//   phrase: the whole query as a substring of the field.
//   token:  a single query token as a substring of the field.
export const COARSE = {
    phrase: { cde_name: 200, preferred_question_text: 80 },
    token: { cde_name: 6, preferred_question_text: 4, aliases: 3, cde_definition: 1 },
}

const EMPTY = new Set()

const SUGGEST_STOP = new Set([
    'the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'for', 'on', 'by', 'with',
    'is', 'are', 'at', 'as', 'de', 'per',
])

export function norm(s) {
    return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Split into meaningful lowercased tokens (drop 1-char + stopwords).
export function tokenize(s) {
    return (norm(s).match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !SUGGEST_STOP.has(t))
}

// Map a property's chosen type to the CDE's cde_data_type vocabulary.
export function compatibleType(propType, cdeType) {
    const p = norm(propType)
    const c = norm(cdeType)
    if (!p || !c) return false
    if (p === 'number' || p === 'integer' || p === 'long' || p === 'double') return c === 'number'
    if (p === 'date' || p === 'datetime') return c === 'date'
    if (p === 'boolean' || p === 'enum') return c === 'value list'
    if (p === 'string' || p === 'text') return c === 'text' || c === 'value list'
    return false
}

// The aliases field is stored as a JSON-array string in the slim parquet column,
// so the ranker's alias text mirrors what SQL ILIKE sees. Accept either an array
// (eval loads from records.jsonl) or an already-joined string.
function aliasText(aliases) {
    return Array.isArray(aliases) ? aliases.map(norm).join(' · ') : norm(aliases)
}

// Score one candidate against the query. Higher = more relevant.
// `exclude` (a Set of column names) drops those fields from scoring — used by the
// eval's cold mode; empty by default, so the app's ranking is unchanged.
export function scoreCandidate(c, qNorm, qTokens, dataType, exclude = EMPTY) {
    const name = exclude.has('cde_name') ? '' : norm(c.cde_name)
    const question = exclude.has('preferred_question_text') ? '' : norm(c.preferred_question_text)
    const aliases = exclude.has('aliases') ? '' : aliasText(c.aliases)
    const def = exclude.has('cde_definition') ? '' : norm(c.cde_definition)
    const source = exclude.has('cde_source') ? '' : norm(c.cde_source)

    let s = 0
    // Exact / prefix / substring on the label fields.
    if (name === qNorm || question === qNorm) s += 120
    else if (name.startsWith(qNorm) || question.startsWith(qNorm)) s += 50
    else if (name.includes(qNorm) || question.includes(qNorm)) s += 25

    // Weighted token coverage: a token counts once, at its best-scoring field.
    const fields = [[name, 6], [question, 4], [aliases, 3], [def, 1], [source, 0.5]]
    let matched = 0
    for (const t of qTokens) {
        let best = 0
        for (const [text, w] of fields) if (text.includes(t)) best = Math.max(best, w)
        if (best > 0) {
            s += best
            matched++
        }
    }
    // Reward covering more of the query (penalize 1-of-3-token matches).
    const coverage = qTokens.length ? matched / qTokens.length : 0
    s *= 0.4 + 0.6 * coverage

    if (dataType && compatibleType(dataType, c.cde_data_type)) s += 5
    // Prefer concise names on ties.
    s -= Math.min(name.length, 80) * 0.03
    return s
}

// Rank retrieved candidates by relevance to the query (stable, best first).
export function rankCandidates(cands, query, dataType, exclude = EMPTY) {
    const qNorm = norm(query)
    const qTokens = tokenize(query)
    return cands
        .map((c, i) => ({ c, i, s: scoreCandidate(c, qNorm, qTokens, dataType, exclude) }))
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map((x) => x.c)
}

// Coarse stage-1 retrieval score for one candidate (JS mirror of the store's SQL
// CASE-score, from the shared COARSE weights). `cols` restricts the fields
// considered (cold mode passes SEARCH_COLS minus the queried field).
export function coarseScore(c, phraseNorm, terms, cols = SEARCH_COLS) {
    const allow = new Set(cols)
    const field = (col) => {
        if (!allow.has(col)) return ''
        if (col === 'aliases') return aliasText(c.aliases)
        return norm(c[col])
    }
    let s = 0
    for (const [col, w] of Object.entries(COARSE.phrase)) {
        if (field(col).includes(phraseNorm)) s += w
    }
    for (const tok of terms) {
        for (const [col, w] of Object.entries(COARSE.token)) {
            if (field(col).includes(tok)) s += w
        }
    }
    return s
}

// Does the candidate match the retrieval WHERE clause — any query token as a
// substring of any allowed search column? (Stage-1 qualifier, before scoring.)
export function coarseQualifies(c, terms, cols = SEARCH_COLS) {
    const allow = cols.filter((col) => SEARCH_COLS.includes(col))
    for (const col of allow) {
        const text = col === 'aliases' ? aliasText(c.aliases) : norm(c[col])
        if (!text) continue
        for (const tok of terms) if (text.includes(tok)) return true
    }
    return false
}
