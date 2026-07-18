#!/usr/bin/env node
// SUGGEST-3 — offline eval harness for the CDE lexical suggest.
//
// Measures the SHIPPED retrieve-then-rank pipeline (src/stores/cdeSuggestRanker.mjs,
// the same module the picker uses) against labeled fixtures derived from the
// published catalog itself, and prints a decision rubric: is lexical good enough,
// or is the return on SUGGEST-2 (embeddings) / SUGGEST-4 (LLM re-rank) worth it?
//
// Labels (no human annotation needed — the catalog supplies them):
//   • preferred_question_text → CDE : typing a CDE's own question text should
//     surface that CDE. This is what the picker's "suggest as you type" does.
//   • aliases → CDE                 : typing a known alias should surface the CDE.
//
// Circularity guard (the crux). If the query IS a candidate's field and we score
// that field, the target trivially wins — a meaningless 100%. So we run two modes:
//   • hot  : all fields scored (upper bound; the field is present verbatim).
//   • cold : the queried field is EXCLUDED from retrieval + ranking, measuring
//            whether the OTHER fields (name/definition/source/[aliases]) recover
//            the CDE. Cold is the number that should drive the decision.
//
// Two-stage split. recall is decomposed into:
//   • retrieval-recall@RETRIEVE : did stage-1 (coarse) keep the target at all?
//   • rank-recall@k | retrieved : given it was retrieved, did stage-2 rank it top-k?
// If retrieval is the bottleneck → better recall wanted (embeddings, SUGGEST-2).
// If ranking is the bottleneck → better ordering wanted (LLM re-rank, SUGGEST-4).
//
// Pure Node, no new deps. Data source: the published records.jsonl (fetched from
// the catalog CDN or a local file). See eval/cde-suggest/README.md.
//
// NOTE: retrieval here is substring-faithful to the app's SQL WHERE/coarse-score
// (same COARSE weights, same ILIKE-substring semantics) but runs a full JS scan
// instead of DuckDB — identical selection, just slower. Ranking calls the shipped
// rankCandidates directly, so stage-2 is byte-for-byte the production ranker.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    SEARCH_COLS,
    RETRIEVE,
    COARSE,
    norm,
    tokenize,
    rankCandidates,
} from '../../src/stores/cdeSuggestRanker.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---- args -------------------------------------------------------------------
function parseArgs(argv) {
    const a = {
        base: 'https://cde-catalog.pennsieve.net', // dev catalog CDN
        jsonl: '', // explicit records.jsonl path/url (overrides base resolution)
        cv: '', // catalog_version label when using --jsonl (else resolved from base)
        sample: 1000, // labeled queries per field-set (0 = all)
        maxAliases: 8, // aliases considered per CDE (bounds alias fixtures)
        seed: 1337,
        ks: [1, 5, 10, 20],
        out: resolve(HERE, 'last-report.json'),
    }
    for (let i = 2; i < argv.length; i++) {
        const [k, vRaw] = argv[i].includes('=') ? argv[i].split(/=(.*)/s) : [argv[i], argv[i + 1]]
        const takeNext = () => (argv[i].includes('=') ? vRaw : argv[++i])
        switch (k) {
            case '--base': a.base = takeNext(); break
            case '--jsonl': a.jsonl = takeNext(); break
            case '--cv': a.cv = takeNext(); break
            case '--sample': a.sample = Number(takeNext()); break
            case '--max-aliases': a.maxAliases = Number(takeNext()); break
            case '--seed': a.seed = Number(takeNext()); break
            case '--ks': a.ks = takeNext().split(',').map(Number).filter((n) => n > 0); break
            case '--out': a.out = resolve(process.cwd(), takeNext()); break
            case '--help': case '-h': a.help = true; break
            default: if (k.startsWith('--')) console.error(`(ignoring unknown arg ${k})`)
        }
    }
    return a
}

const HELP = `SUGGEST-3 CDE suggest eval

Usage: node eval/cde-suggest/run-eval.mjs [options]

  --base <url>        catalog CDN base (default https://cde-catalog.pennsieve.net)
  --jsonl <path|url>  explicit cde records.jsonl (skips latest/manifest resolution)
  --cv <version>      catalog_version label for the report when using --jsonl
  --sample <n>        labeled queries per field-set; 0 = all (default 1000)
  --max-aliases <n>   aliases considered per CDE (default 8)
  --seed <n>          PRNG seed for sampling (default 1337)
  --ks <a,b,c>        recall@k cutoffs (default 1,5,10,20)
  --out <path>        JSON report output (default eval/cde-suggest/last-report.json)

Data: fetches {base}/cde/latest.json -> manifest.json -> the cde model's
records.jsonl, or reads --jsonl directly. A local file may be plain .jsonl.`

// ---- deterministic sampling -------------------------------------------------
function mulberry32(seed) {
    let s = seed >>> 0
    return () => {
        s |= 0; s = (s + 0x6d2b79f5) | 0
        let t = Math.imul(s ^ (s >>> 15), 1 | s)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
function sampleN(arr, n, rnd) {
    if (!n || n >= arr.length) return arr
    // Partial Fisher-Yates on a copy — first n are a uniform sample.
    const a = arr.slice()
    for (let i = 0; i < n; i++) {
        const j = i + Math.floor(rnd() * (a.length - i))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a.slice(0, n)
}

// ---- load catalog -----------------------------------------------------------
async function fetchText(url) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
    return res.text()
}
async function fetchJson(url) {
    return JSON.parse(await fetchText(url))
}

async function resolveJsonlUrl(base) {
    const b = base.replace(/\/+$/, '')
    const latest = await fetchJson(`${b}/cde/latest.json`)
    const cv = latest.catalog_version
    if (!cv) throw new Error('latest.json has no catalog_version')
    const manifest = await fetchJson(`${b}/cde/versions/${cv}/manifest.json`)
    const models = Object.fromEntries((manifest.models || []).map((m) => [m.name, m.version]))
    if (!models.cde) throw new Error('manifest has no cde model')
    return {
        cv,
        url: `${b}/cde/versions/${cv}/metadata/models/cde/versions/${models.cde}/records.jsonl`,
    }
}

// Parse one records.jsonl body → array of the `data` payloads (the CDE records).
// Publish format is one {"id":..,"data":<record>} object per line; tolerate a
// bare record object per line too.
function parseJsonl(text) {
    const out = []
    for (const line of text.split('\n')) {
        const s = line.trim()
        if (!s) continue
        let obj
        try {
            obj = JSON.parse(s)
        } catch {
            continue
        }
        const rec = obj && typeof obj === 'object' && 'data' in obj ? obj.data : obj
        if (rec && typeof rec === 'object') out.push(rec)
    }
    return out
}

async function loadCatalog(args) {
    let cv = args.cv || 'unknown'
    let text
    if (args.jsonl) {
        if (/^https?:\/\//.test(args.jsonl)) {
            text = await fetchText(args.jsonl)
        } else {
            text = await readFile(resolve(process.cwd(), args.jsonl), 'utf8')
        }
    } else {
        const r = await resolveJsonlUrl(args.base)
        cv = r.cv
        console.error(`resolved catalog ${cv} -> ${r.url}`)
        text = await fetchText(r.url)
    }
    const records = parseJsonl(text)
    return { cv, records }
}

// ---- candidate model --------------------------------------------------------
// A candidate carries exactly the fields the ranker reads. We also precompute
// normalized per-column strings once (nname/nquestion/naliases/ndef/nsource) so
// the full-scan retrieval doesn't re-normalize per query.
function buildCandidates(records) {
    const cands = []
    for (const r of records) {
        const pid = r.persistent_id
        if (!pid) continue
        const aliases = Array.isArray(r.aliases) ? r.aliases : []
        const cand = {
            id: r.id ?? pid,
            persistent_id: pid,
            cde_name: r.cde_name ?? null,
            preferred_question_text: r.preferred_question_text ?? null,
            cde_definition: r.cde_definition ?? null,
            cde_source: r.cde_source ?? null,
            cde_data_type: r.cde_data_type ?? null,
            aliases,
        }
        const naliases = aliases.map(norm).join(' · ')
        cand._n = {
            cde_name: norm(cand.cde_name),
            preferred_question_text: norm(cand.preferred_question_text),
            aliases: naliases,
            cde_definition: norm(cand.cde_definition),
            cde_source: norm(cand.cde_source),
        }
        cand._nameLen = cand._n.cde_name.length || Infinity
        cands.push(cand)
    }
    return cands
}

// ---- retrieval (full scan, substring-faithful to the app's SQL) -------------
// cols = the search columns in play (cold mode drops the queried field).
// A candidate qualifies (SQL WHERE) if any token is a substring of any allowed
// column; its coarse score uses the shared COARSE weights.
function retrieve(cands, phrase, terms, cols) {
    const allow = new Set(cols)
    const phraseCols = Object.keys(COARSE.phrase).filter((c) => allow.has(c))
    const tokenCols = Object.keys(COARSE.token).filter((c) => allow.has(c))
    const whereCols = SEARCH_COLS.filter((c) => allow.has(c))

    const scored = []
    for (const c of cands) {
        const n = c._n
        // WHERE: any token in any allowed column.
        let qualifies = false
        for (const col of whereCols) {
            const text = n[col]
            if (!text) continue
            for (const tok of terms) if (text.includes(tok)) { qualifies = true; break }
            if (qualifies) break
        }
        if (!qualifies) continue
        // Coarse score.
        let s = 0
        for (const col of phraseCols) if (n[col].includes(phrase)) s += COARSE.phrase[col]
        for (const tok of terms) {
            for (const col of tokenCols) if (n[col].includes(tok)) s += COARSE.token[col]
        }
        scored.push([c, s, c._nameLen])
    }
    scored.sort((a, b) => b[1] - a[1] || a[2] - b[2])
    return scored.slice(0, RETRIEVE).map((x) => x[0])
}

// ---- fixtures ---------------------------------------------------------------
// A field-set maps a display field to labeled (query -> relevant pids). Multiple
// CDEs can share a question/alias, so relevance is a set; a query "hits" at k if
// ANY relevant pid is in the top-k (first-relevant rank drives MRR).
function buildFixtures(cands, field, maxAliases) {
    const byQuery = new Map() // normQuery -> { query, relevant:Set<pid> }
    const add = (raw, pid) => {
        const q = String(raw ?? '')
        if (norm(q).length < 2) return
        const k = norm(q)
        let e = byQuery.get(k)
        if (!e) { e = { query: q, relevant: new Set() }; byQuery.set(k, e) }
        e.relevant.add(pid)
    }
    for (const c of cands) {
        if (field === 'aliases') {
            for (const al of c.aliases.slice(0, maxAliases)) add(al, c.persistent_id)
        } else {
            add(c[field], c.persistent_id)
        }
    }
    return [...byQuery.values()]
}

// ---- eval one field-set × mode ----------------------------------------------
function evalSet(cands, fixtures, field, mode, ks) {
    const cold = mode === 'cold'
    const cols = cold ? SEARCH_COLS.filter((c) => c !== field) : SEARCH_COLS
    const exclude = cold ? new Set([field]) : new Set()
    const maxK = Math.max(...ks)

    let n = 0
    let retrievalHits = 0 // relevant present in the retrieved set
    let mrr = 0
    const recallAtK = Object.fromEntries(ks.map((k) => [k, 0])) // overall
    const rankRecallAtK = Object.fromEntries(ks.map((k) => [k, 0])) // among retrieved

    for (const fx of fixtures) {
        const tokens = tokenize(fx.query).slice(0, 6)
        const terms = tokens.length ? tokens : [fx.query.toLowerCase()]
        const phrase = norm(fx.query)

        const retrieved = retrieve(cands, phrase, terms, cols)
        const inRetrieved = retrieved.some((c) => fx.relevant.has(c.persistent_id))

        // Stage-2: the shipped ranker over the retrieved candidates.
        const ranked = rankCandidates(retrieved, fx.query, '', exclude)
        let rank = Infinity
        for (let i = 0; i < ranked.length; i++) {
            if (fx.relevant.has(ranked[i].persistent_id)) { rank = i + 1; break }
        }

        n++
        if (inRetrieved) retrievalHits++
        if (rank !== Infinity) mrr += 1 / rank
        for (const k of ks) {
            if (rank <= k) recallAtK[k]++
            if (inRetrieved && rank <= k) rankRecallAtK[k]++
        }
        void maxK
    }

    const div = (x) => (n ? x / n : 0)
    const divR = (x) => (retrievalHits ? x / retrievalHits : 0)
    return {
        field,
        mode,
        n_queries: n,
        recall: Object.fromEntries(ks.map((k) => [k, +div(recallAtK[k]).toFixed(4)])),
        precision_at_1: +div(recallAtK[1] || 0).toFixed(4), // == hit@1 (single/first relevant)
        mrr: +div(mrr).toFixed(4),
        retrieval_recall_at_RETRIEVE: +div(retrievalHits).toFixed(4),
        rank_recall_given_retrieved: Object.fromEntries(ks.map((k) => [k, +divR(rankRecallAtK[k]).toFixed(4)])),
    }
}

// ---- field fill-rates (SUGGEST-5 overlap) -----------------------------------
function fillRates(cands) {
    const total = cands.length
    const nonEmpty = (v) => (Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()))
    const fields = ['cde_name', 'preferred_question_text', 'cde_definition', 'cde_source', 'aliases', 'cde_data_type']
    const out = {}
    for (const f of fields) {
        const c = cands.reduce((acc, x) => acc + (nonEmpty(x[f]) ? 1 : 0), 0)
        out[f] = { filled: c, total, pct: total ? +(100 * c / total).toFixed(1) : 0 }
    }
    return out
}

// ---- decision rubric --------------------------------------------------------
// Drive the recommendation off the COLD numbers (the honest ones). Distinguish a
// retrieval bottleneck (→ SUGGEST-2 embeddings) from a ranking bottleneck
// (→ SUGGEST-4 LLM re-rank).
function rubric(results) {
    const cold = results.filter((r) => r.mode === 'cold')
    if (!cold.length) return { verdict: 'no cold results', notes: [] }
    const avg = (sel) => cold.reduce((a, r) => a + sel(r), 0) / cold.length
    const r5 = avg((r) => r.recall[5] ?? 0)
    const r20 = avg((r) => r.recall[20] ?? 0)
    const mrr = avg((r) => r.mrr)

    let verdict
    if (r5 >= 0.85) {
        verdict = 'LEXICAL SUFFICIENT — ship SUGGEST-1 as the default; SUGGEST-2/4 low priority.'
    } else if (r5 >= 0.6) {
        verdict = 'LEXICAL DECENT — worth investing in the tail (SUGGEST-2 embeddings and/or SUGGEST-4 re-rank).'
    } else {
        verdict = 'LEXICAL INSUFFICIENT — prioritize SUGGEST-2 (embeddings) for semantic recall.'
    }

    // Per-field bottleneck attribution — the two field-sets often fail for
    // OPPOSITE reasons (retrieval vs ranking), so averaging would hide the
    // actionable signal. A low retrieval-recall means the target never enters
    // the candidate set (semantic gap → SUGGEST-2); a high retrieval-recall with
    // weak top-k means candidates are present but mis-ordered (→ SUGGEST-4).
    const bottlenecks = []
    const notes = []
    for (const r of cold) {
        const retr = r.retrieval_recall_at_RETRIEVE
        const rg5 = r.rank_recall_given_retrieved[5] ?? 0
        const r1 = r.recall[1] ?? 0
        const label = r.field.replace('preferred_question_text', 'question')
        let kind, note
        if (retr < 0.85) {
            kind = 'retrieval'
            note = `${label}: RETRIEVAL-limited — cold retrieval-recall@${RETRIEVE}=${pctv(retr)} (target absent from candidates ${pctv(1 - retr)} of the time). Substring lexical misses paraphrase/synonymy → SUGGEST-2 embeddings.`
        } else if (rg5 < 0.9 || r1 < 0.75) {
            kind = 'ranking'
            note = `${label}: RANKING-limited — target retrieved ${pctv(retr)} of the time, but rank-recall@5|retrieved=${pctv(rg5)} and hit@1=${pctv(r1)}. Candidates present, mis-ordered → SUGGEST-4 LLM re-rank of the top-N.`
        } else {
            kind = 'none'
            note = `${label}: lexical strong — retrieval-recall=${pctv(retr)}, recall@5=${pctv(r.recall[5] ?? 0)}.`
        }
        bottlenecks.push({ field: r.field, kind, retrieval_recall: retr, rank_recall_at_5_given_retrieved: rg5, hit_at_1: r1 })
        notes.push(note)
    }
    notes.push(`overall (cold, avg of field-sets): recall@5=${pctv(r5)}  recall@20=${pctv(r20)}  MRR=${mrr.toFixed(3)}`)
    return {
        verdict,
        cold_recall_at_5: +r5.toFixed(4),
        cold_recall_at_20: +r20.toFixed(4),
        cold_mrr: +mrr.toFixed(4),
        bottlenecks,
        notes,
    }
}
function pctv(x) { return `${(100 * x).toFixed(1)}%` }

// ---- reporting --------------------------------------------------------------
function pct(x) { return `${(100 * x).toFixed(1)}%` }
function printTable(results, ks) {
    const head = ['field', 'mode', 'n', ...ks.map((k) => `R@${k}`), 'MRR', `retr@${RETRIEVE}`]
    const rows = results.map((r) => [
        r.field.replace('preferred_question_text', 'question'),
        r.mode,
        String(r.n_queries),
        ...ks.map((k) => pct(r.recall[k] ?? 0)),
        r.mrr.toFixed(3),
        pct(r.retrieval_recall_at_RETRIEVE),
    ])
    const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)))
    const fmt = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ')
    console.log('\n' + fmt(head))
    console.log(widths.map((w) => '-'.repeat(w)).join('  '))
    for (const row of rows) console.log(fmt(row))
}

// ---- main -------------------------------------------------------------------
async function main() {
    const args = parseArgs(process.argv)
    if (args.help) { console.log(HELP); return }

    console.error('loading catalog…')
    const { cv, records } = await loadCatalog(args)
    const cands = buildCandidates(records)
    console.error(`catalog ${cv}: ${records.length} records, ${cands.length} with persistent_id`)
    if (!cands.length) throw new Error('no candidates with persistent_id — wrong data source?')

    const rnd = mulberry32(args.seed)
    const fills = fillRates(cands)
    const results = []
    for (const field of ['preferred_question_text', 'aliases']) {
        const all = buildFixtures(cands, field, args.maxAliases)
        const fixtures = sampleN(all, args.sample, rnd)
        console.error(
            `field ${field}: ${all.length} labeled queries` +
            (fixtures.length < all.length ? ` (sampling ${fixtures.length})` : ''),
        )
        if (!fixtures.length) continue
        for (const mode of ['hot', 'cold']) {
            const r = evalSet(cands, fixtures, field, mode, args.ks)
            r.labeled_total = all.length
            results.push(r)
        }
    }

    const decision = rubric(results)
    const report = {
        generated_at: new Date().toISOString(),
        catalog_version: cv,
        catalog_records: records.length,
        candidates_with_pid: cands.length,
        retrieve_depth: RETRIEVE,
        sample_per_field: args.sample,
        ks: args.ks,
        field_fill_rates: fills,
        results,
        decision,
    }

    printTable(results, args.ks)
    console.log('\nField fill-rates (SUGGEST-5 signal):')
    for (const [f, s] of Object.entries(fills)) console.log(`  ${f.padEnd(24)} ${String(s.filled).padStart(7)} / ${s.total}  (${s.pct}%)`)
    console.log('\nDecision:')
    console.log('  ' + decision.verdict)
    for (const note of decision.notes) console.log('  • ' + note)

    if (!existsSync(dirname(args.out))) await mkdir(dirname(args.out), { recursive: true })
    await writeFile(args.out, JSON.stringify(report, null, 2))
    console.log(`\nJSON report → ${args.out}`)
}

main().catch((e) => {
    console.error('\nEVAL FAILED:', e?.message || e)
    if (String(e?.message || e).includes('fetch') || String(e).includes('ENOTFOUND') || String(e).includes('403')) {
        console.error('  (catalog CDN can be unreachable on VPN. Pass a local file with --jsonl,')
        console.error('   or produce one from the published parquet — see eval/cde-suggest/README.md.)')
    }
    process.exit(1)
})
