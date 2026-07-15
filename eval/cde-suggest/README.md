# CDE suggest eval (SUGGEST-3)

An offline harness that measures the **shipped** CDE lexical-suggest pipeline and
tells us whether lexical retrieval is good enough, or whether SUGGEST-2
(embeddings) / SUGGEST-4 (LLM re-rank) are worth building.

It reuses the production ranker directly — `src/stores/cdeSuggestRanker.mjs`, the
same module `cdeCatalogStore` uses — so the numbers reflect what users actually
get, not a re-implementation.

## Why this design

- **No human labels needed.** The catalog labels itself: a CDE's own
  `preferred_question_text` and its `aliases` are exactly what a user would type
  to find it. Fixtures are derived from the published records.
- **Circularity guard (the crux).** If the query is a candidate's field and we
  score that field, the target trivially wins. Every field-set is run in two
  modes:
  - `hot` — all fields scored. Upper bound; the field is present verbatim.
  - `cold` — the queried field is **excluded** from both retrieval and ranking.
    Measures whether the *other* fields recover the CDE. **Cold is the number
    that matters.**
- **Two-stage split.** Recall is decomposed so we know *what* to fix:
  - `retrieval-recall@RETRIEVE` — did stage-1 (coarse) keep the target at all?
    Low → the target never enters the candidate set → semantic recall gap →
    **SUGGEST-2 embeddings**.
  - `rank-recall@k | retrieved` — given it was retrieved, did stage-2 rank it
    top-k? Low while retrieval is high → ordering problem → **SUGGEST-4 re-rank**.

## Fidelity

- **Ranking (stage 2)** calls the shipped `rankCandidates` — byte-for-byte the
  production ranker.
- **Retrieval (stage 1)** is substring-faithful to the app's DuckDB SQL: same
  `COARSE` weights, same `ILIKE '%token%'` substring semantics, same
  `ORDER BY score DESC, length(cde_name)` and `LIMIT RETRIEVE`. It runs as a full
  JS scan instead of SQL — identical *selection*, just slower. (The app's SQL
  coarse-score is built from the same `COARSE` constants, so the two cannot
  drift.)

## Run

```bash
# Production catalog (the shipped release):
node eval/cde-suggest/run-eval.mjs --base https://cde-catalog.pennsieve.io

# Dev catalog (default base):
node eval/cde-suggest/run-eval.mjs

# Full (no sampling) — slower, definitive:
node eval/cde-suggest/run-eval.mjs --base https://cde-catalog.pennsieve.io --sample 0

# From a local file (e.g. on VPN, where the CDN is unreachable):
node eval/cde-suggest/run-eval.mjs --jsonl ./cde-records.jsonl
```

### Options

| flag | default | meaning |
|---|---|---|
| `--base <url>` | `https://cde-catalog.pennsieve.net` | catalog CDN base |
| `--jsonl <path\|url>` | — | explicit `cde` records.jsonl; skips latest/manifest resolution |
| `--sample <n>` | `1000` | labeled queries per field-set; `0` = all |
| `--max-aliases <n>` | `8` | aliases considered per CDE |
| `--seed <n>` | `1337` | PRNG seed (sampling is deterministic) |
| `--ks <a,b,c>` | `1,5,10,20` | recall@k cutoffs |
| `--out <path>` | `eval/cde-suggest/last-report.json` | JSON report path |

### Getting a local records.jsonl (VPN)

The catalog CDN is blocked on the Pennsieve VPN. Off-VPN, download once:

```bash
BASE=https://cde-catalog.pennsieve.io
CV=$(curl -s $BASE/cde/latest.json | python3 -c 'import sys,json;print(json.load(sys.stdin)["catalog_version"])')
V=$(curl -s $BASE/cde/versions/$CV/manifest.json | python3 -c 'import sys,json;print(next(m["version"] for m in json.load(sys.stdin)["models"] if m["name"]=="cde"))')
curl -s -o cde-records.jsonl $BASE/cde/versions/$CV/metadata/models/cde/versions/$V/records.jsonl
```

## Output

A table (per field-set × mode), field fill-rates (SUGGEST-5 signal — how many
CDEs even have a question / aliases to match on), and a decision verdict with
bottleneck attribution. Full detail is written to the `--out` JSON.

Interpreting the verdict (driven by **cold** recall@5):

| cold recall@5 | verdict |
|---|---|
| ≥ 85% | lexical sufficient — ship SUGGEST-1; SUGGEST-2/4 low priority |
| 60–85% | lexical decent — invest in the tail (SUGGEST-2 and/or SUGGEST-4) |
| < 60% | lexical insufficient — prioritize SUGGEST-2 (embeddings) |

`report-prod.json` in this directory is a checked-in snapshot from a
representative run (see below).

## Results — prod `20260715T161304Z` (23,350 CDEs, 1,500 sampled queries/set)

| field-set | mode | recall@1 | recall@5 | recall@20 | MRR | retrieval-recall@300 |
|---|---|---|---|---|---|---|
| question | hot | 98.7% | 100.0% | 100.0% | 0.993 | 100.0% |
| question | **cold** | 69.7% | 79.4% | 82.4% | 0.740 | 84.5% |
| aliases | hot | 85.1% | 97.5% | 99.2% | 0.909 | 99.7% |
| aliases | **cold** | 62.3% | 82.0% | 89.5% | 0.711 | 95.3% |

**Verdict: LEXICAL DECENT** (cold recall@5 ≈ 80.7%) — good enough to ship as the
default, with a clear, *field-specific* upgrade path:

- **question text is RETRIEVAL-limited** — cold retrieval-recall caps at 84.5%, so
  ~15% of the time the right CDE never enters the candidate set. Substring lexical
  can't bridge paraphrase/synonymy (a user's phrasing vs. the curated question).
  → **SUGGEST-2 (embeddings)** is where the return is.
- **aliases are RANKING-limited** — the target is retrieved 95.3% of the time but
  only ranked #1 for 62.3% of queries (rank-recall@5|retrieved ≈ 86%). Candidates
  are present, just mis-ordered. → **SUGGEST-4 (LLM re-rank of the top-N)** would
  lift precision@1 without new recall infrastructure.

**Fill-rate caveat (SUGGEST-5).** Only **29.6%** of CDEs have a
`preferred_question_text` and **7.8%** have `aliases`; every CDE has a name +
definition. So the suggest quality above is measured on the minority of CDEs that
carry rich matchable text — improving field coverage (SUGGEST-5) likely moves the
needle as much as a better model.
