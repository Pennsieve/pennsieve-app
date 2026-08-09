# Surfacing Virus-Scan Status in pennsieve-app — Planning Doc

> Status: **DRAFT v0.1** — backend is built and partly shipped; this doc covers the app-side surfacing that has never been specified.
> Upstream reference: `pennsieve/scan-service/docs/developer.md` (§7 value vocabulary, §12 quarantine policy, §14.2 roadmap) and `docs/user-guide.md`.
> This doc replaces the single roadmap line in scan-service `developer.md` §14.2: *"Enforcement (pennsieve-app / agent) — surface `scan_status` in file detail / dataset table; disable download controls for non-clean states."*

## 0. What this is

scan-service runs ClamAV against uploaded files and records a verdict per file. The verdict is currently invisible in the app. `user-guide.md` already tells users *"You can see the scan outcome for any file in the Pennsieve UI under the file's detail view"* — **that statement is aspirational and currently false.** This doc plans the work that makes it true.

Two things are in scope: **surfacing** the verdict, and **making download gating legible** when the API starts refusing files.

## 1. Where the status actually lives

`files.scan_status TEXT NOT NULL DEFAULT 'pending'` in each org's Postgres schema, with a CHECK constraint enumerating the valid values.

- Migration: `pennsieve-db-migrations/migrations/organization/V20260420120100__add_scan_status_to_files.sql`
- Companion columns: `scan_engine`, `scanned_at`, `scan_skip_reason`
- Written **directly by the scanner Lambda** (`scan-service/cmd/scanner/main.go`) over the RDS proxy. There is **no scan-service HTTP API** — the app can only reach this through pennsieve-api / packages-service.

### Merge state (as of 2026-08-09) — this is the critical path

| Repo | Change | State |
|---|---|---|
| `pennsieve-db-migrations` | `scan_status` + companion columns | **merged** |
| `scan-service` | scanner writes the verdict | **merged, deployed to dev** |
| `packages-service` | `POST /download-manifest` gating; per-entry `scanStatus`, top-level `blocked[]`, `header.blockedCount` | **merged** 2026-04-22 — [PR #56](https://github.com/Pennsieve/packages-service/pull/56) (`068e06e`) |
| `pennsieve-api` | `scanStatus` on `FileContent`/`SimpleFileContent`; `DownloadItemResponse.scanStatus`; `DownloadManifestDTO.blocked`; 403 gating on 3 presign routes | **OPEN, UNREVIEWED** — [PR #377](https://github.com/Pennsieve/pennsieve-api/pull/377), branch `feature_scan_status_gating` (`3e51e5dd`, `7694a1e4`) |

**Nothing in this plan can ship until [PR #377](https://github.com/Pennsieve/pennsieve-api/pull/377) merges.** It is the only thing that puts `scanStatus` on a listing endpoint the app calls. Opened 2026-04-22, last touched 2026-05-05, still `REVIEW_REQUIRED` — it has never been reviewed. Getting it reviewed and merged is the single highest-value action on this whole effort, and is worth doing independently of any UI work.

Two adjacent items, both resolved — recorded here so they aren't re-investigated:

- packages-service [PR #59](https://github.com/Pennsieve/packages-service/pull/59) (rescan trigger on package restore) is **closed, not merged**. Superseded by scan-service PR #15, which resolves delete-marker'd keys via `ListObjectVersions` + `GetObject?versionId=` inside the scanner (`b1b3ec6`, merged). The restore path is covered.
- scan-service has **no open PRs**, but `6e58c85` ("Fix freshclam never running: grant EventBridge invoke + add alarms") sits pushed on `fix/freshclam-eventbridge-permission-and-alarm` with no PR and is not in main. **The signature refresh is nonetheless working in both dev and prod** (verified in §1a: 4 invocations/day, zero errors, sigs refreshed today) — so the remaining value of that branch is the CloudWatch alarms, not the fix. Worth opening a PR for the alarms so a future regression is detected.

### What the API gives us once merged

`scanStatus: Option[String]` appears on `FileContent` / `SimpleFileContent`, so it rides along on:

```
GET /packages/:id/sources          (paginated and non-paginated)
GET /packages/:id/sources-paged
GET /packages/:id/files
GET /packages/:id/view
```

Plus the download shapes:

```jsonc
// GET /packages/:pkgId/files/:id  → DownloadItemResponse
{ "url": "https://…", "scanStatus": "clean" }     // 403 when infected/failed

// POST /download-manifest → DownloadManifestDTO
{
  "header": { "count": 12, "size": 40213, "blockedCount": 2 },
  "data":    [ { "nodeId": "…", "fileName": "…", "scanStatus": "clean", "url": "…", … } ],
  "blocked": [ { "nodeId": "…", "fileName": "…", "packageName": "…", "scanStatus": "infected" } ]
}
```

`blocked[]` entries deliberately carry **no presigned URL**.

Two caveats for anyone coding against this:

- **packages-service's OpenAPI spec is stale.** `terraform/packages-service.yml` still documents `header{count,size}` and `data[]` without `scanStatus`, `blocked`, or `blockedCount`. The Go structs in `api/models/download.go` are the accurate contract.
- **Until PR #377 merges, pennsieve-api will still hand out a presigned URL for an infected file.** Only packages-service's `/download-manifest` blocks today. This is a security argument for merging #377, independent of any UI work.

## 1a. Operational reality (measured 2026-08-09)

Both dev and prod are deployed and healthy. The scan-service roadmap's "Prod rollout" line is stale — prod has been live since at least 2026-06-04.

| Check | dev | prod |
|---|---|---|
| freshclam schedule | 4×/day, **0 errors/14d** | 4×/day, **0 errors/14d** |
| Signature DB freshness | refreshed 2026-08-09 03:10Z | refreshed 2026-08-09 04:33Z |
| Scanner errors / 14d | 0 | 0 (1,385 invocations) |
| Queue + DLQ depth | 0 / 0 | 0 / 0 |
| Verdicts / 30d | 1,334 clean · 10 format_validated · 2 unscanned | 14,274 clean · 6 format_validated · 188 unscanned |
| `infected` / `failed` ever seen | **0** | **0** |

The engine reports `clamav-1.4.4` (docs say 1.4.3 — cosmetic drift). The scanner itself is working correctly and is not the problem.

### ~54% of current prod uploads take the legacy path and are skipped by design

Prod SNS `file-finalized` topic, trailing 30 days:

```
NumberOfMessagesPublished     31,695
NumberOfNotificationsDelivered 14,527   (45.8%)
NumberOfNotificationsFilteredOut 17,167 (54.2%)   ← legacy uploads bucket, skipped
```

The subscription filter is `{"s3Bucket":[{"anything-but":"pennsieve-prod-uploads-v2-use1"}]}`. `PublishFileFinalized` is called once per file at `ImportFiles` time for both upload paths (`upload-service-v2/lambda/upload/handler/store.go:328`) using `f.S3Bucket` as committed at that moment; for the legacy path that is still the uploads bucket, so the event is filtered and nothing re-publishes after the Fargate move.

**This is expected behaviour** (documented limitation §14.1 item 2) — the legacy agent-based upload path is being deprecated shortly, after which all uploads go direct-to-storage and are scanned. No fix is needed here. Dev already filters only ~1.8% (2 of 110), which is what the steady state should look like.

**What it means for this plan:** those ~17k/30d files are at `scan_status='pending'` and stay there. Deprecating the path stops new ones accruing but does **not** heal rows already written — that needs the backfill reconciler (`developer.md` §14.1 item 6). So for as long as the app ships before *both* the deprecation and a backfill land, `pending` describes a large, permanent slice of the prod corpus rather than a transient state. That is the input to the badge decision in §2, and it argues for shipping the UI without a `pending` badge rather than for delaying the UI.

## 2. Value vocabulary and UI mapping

Eight values are legal; **only six are ever written**. Don't build UI affordances for the other two beyond a safe fallback.

| Value | Written? | Severity | Badge | Blocks download? |
|---|---|---|---|---|
| `infected` | yes | danger | red, always shown | **yes — 403** |
| `failed` | yes | danger | red, always shown | **yes — 403** |
| `unscanned` | yes | info | yellow, shown | no |
| `pending` | yes | in-progress | blue/muted, shown | no |
| `clean` | yes | ok | **none** | no |
| `format_validated` | yes | ok | **none** | no |
| `scanning` | **never** | in-progress | treat as `pending` | no |
| `not_required` | **never** | ok | none | no |
| `null` / absent | pre-migration rows | ok | **none** | no |

Rules that matter:

- **Absent means clean, and absent is rare.** `scanStatus` is `omitempty` on both the Go and Scala side, so it can be missing from the JSON entirely. But the column is `NOT NULL DEFAULT 'pending'`, which means the migration backfilled *every* pre-existing row to `pending` — there are no NULLs in practice. The optionality is defensive. Treat absent as unremarkable/clean (matching `normalizeScanStatus`, `packages-service/.../download.go:208`), and do the same for any unrecognized future value. **Absent ≠ pending.**
- **The badge rule is by context, not by state.**
  - **Single-file contexts** (detail page, browser sidebar, source-files table) show **every** state explicitly, including a positive "no threats detected" confirmation for `clean`. Here the user is asking a direct question about one file, and silence is ambiguous — an unbadged row is indistinguishable from a broken feature. A green check is the answer to "is this file safe?"
  - **Multi-row list contexts** (the file browser table) badge **only** the attention states — `infected`, `failed`, `unscanned`. 14,274 of 14,468 prod files in 30 days are `clean`; a green pill on every row is noise that destroys the signal value of the red one.
- **Don't badge `pending` in list contexts.** Per §1a, a large share of existing prod files are `pending` and stay that way until a backfill runs — the legacy-path deprecation stops new ones accruing but doesn't rewrite existing rows. In single-file contexts `pending` is still shown, but with honest copy ("Not yet scanned"), not a spinner implying imminent resolution.
- **Only `object_type = 'source'` files are ever scanned or reported.** View and derived files have no verdict, by design. Don't render a scan affordance for them.

### `format_validated` is not `clean`

No antivirus ran — the scanner parsed the file header only. `scan_engine` will read `dicom` / `tiff` / `nifti` (the validator name), not `clamav-<version>`. For a scientific-data platform this will be a large fraction of the corpus, so badging it in lists would be noise; but the distinction is real and matters for a compliance conversation. **Recommendation: unbadged in lists, but shown explicitly on the detail page** alongside `scan_engine`, with copy that says header-validated rather than virus-scanned.

### `scan_skip_reason` is operator text, not user copy

It is free text, not an enum. It holds `size`, `format_invalid_oversized`, **or a raw clamd error string** like `clamdscan error exit=2: ...`. Never switch on it, and don't render it verbatim to end users. Map the two known policy values to real copy; hide anything else behind an admin/debug affordance.

### The virus name is not persisted anywhere

On a signature hit the scanner logs the threat name to CloudWatch (`main.go:656`) and writes only `scan_status='infected'` to Postgres. **The API cannot tell us what was detected.** The infected banner therefore cannot say *what* the file matched — copy must stay at "this file matched a known threat signature; contact your workspace administrator." Showing the detection name would require a scan-service schema change; out of scope here, worth raising if support asks for it.

### `PackageState.INFECTED` is a red herring

`core-models/.../PackageState.scala:61` defines `case object INFECTED`, and `BfDownloadFile.vue:223` mentions it in a comment. **Nothing anywhere writes it.** It is a vestigial enum value. All scan signal comes from `files.scan_status`; do not build against package state.

## 3. The granularity problem (the one real design decision)

**`scan_status` is per source file. The file browser renders packages.**

- `BfDatasetFiles.vue` lists children via `GET /packages/{id}?includeAncestors=true&limit=&offset=`, which returns `PackageDTO`s. These have `content.state` but **no `objects.source`**, so no scan data.
- `FileDetails.vue` already fetches `sources-paged`, which **will** carry `scanStatus` per file for free.

There is **no package-level aggregate anywhere in the API**, and deriving one client-side would require `?include=sources` on a paginated folder listing — an unacceptable payload blowup for large folders.

This cleanly splits the work: **the detail page is free; the browser list needs a backend addition.**

### If we add an aggregate: worst-wins precedence

A package's scan status is the most severe status among its source files:

```
infected > failed > unscanned > pending/scanning > format_validated > clean > not_required
```

`unscanned` outranks `pending` deliberately: `pending` is transient and self-resolving, `unscanned` is terminal and means the file will never get a verdict. A package with one unscanned 4 GB file and one pending small file should read as `unscanned`.

## 4. Surfaces — what to show where

### 4a. Package detail page (`FileDetails.vue`) — primary surface

This is where `user-guide.md` promises the information lives, and it needs no new backend work beyond the API merge.

1. **"Scan status" property row** next to the existing "File status" at `FileDetails.vue:125`, using `<concept-instance-static-property>` with the default slot. **This row always renders, for every state** — a positive confirmation that Pennsieve scanned the file is the main user-visible payoff of running the scanner, and it's what makes the feature legible rather than invisible. Silence would read as "not implemented".

Copy spec — icon + label + secondary line:

| Status | Icon | Label | Secondary line | Needs extra DTO fields? |
|---|---|---|---|---|
| `clean` | ✓ green | **No threats detected** | `Scanned {scanned_at} · ClamAV {scan_engine}` | **yes** |
| `format_validated` | ✓ green | **Format validated** | `File header verified — not virus-scanned.` (+ `{scanned_at}`) | partial |
| `unscanned` | — grey | **Not scanned** | mapped from `scan_skip_reason`: `size` → "File is above the automatic scan size limit." | **yes** |
| `pending` | — grey | **Not yet scanned** | *(none — do not imply an ETA, see §1a)* | no |
| `infected` | ⚠ red | **Threat detected** | `Download blocked. Do not open or share this file — contact your workspace administrator.` | no |
| `failed` | ⚠ amber | **Scan could not complete** | `Download blocked. Contact Pennsieve support.` | no |
| absent | *(omit row)* | — | — | — |

> **Resolved — all four fields now on PR #377.** The branch originally exposed only `scanStatus`. `scannedAt`, `scanEngine`, and `scanSkipReason` have been added so the detail copy above can be implemented in full.
>
> This wasn't a three-line change. `File` was exactly 20 params and `AllFilesView` maps it with `File.tupled` ([FilesTable.scala:146](../pennsieve-api/core/src/main/scala/com/pennsieve/db/FilesTable.scala:146)), which is defined as `(this.apply _).tupled`. Flattening three more fields would put `File` at 23, past Scala 2.13's ceiling — there is no `Function23`, so `File.tupled` stops compiling and the tuple projection breaks with it.
>
> Resolution: the four scan columns are grouped into a nested `FileScanInfo(status, scannedAt, engine, skipReason)`. Slick projects a nested tuple as a **single** element, so `filesSelect` stays at 20 and `File.tupled` keeps working. Call sites move from `file.scanStatus` to `file.scan.status`.
>
> **The wire format is deliberately left flat** — `FileContent` / `SimpleFileContent` expose `scanStatus`, `scannedAt`, `scanEngine`, `scanSkipReason` as sibling JSON fields. Grouping is an internal mapping concern; clients already reading `scanStatus` are unaffected. **No Postgres changes** — all four columns have existed since migration `V20260420120100`.

Notes: `format_validated` gets a green check but distinct copy — it passed a structural header check, not an AV scan, and `scan_engine` will read `dicom`/`tiff`/`nifti`. `failed` is amber rather than red because it means "we don't know", not "this is dangerous", even though it blocks downloads identically. The `unscanned` secondary line must be mapped copy, never the raw `scan_skip_reason` (§2).
2. **Warning banner** above the info block (~`FileDetails.vue:108`), for `infected` / `failed` **only**. Model on `LockedBanner.vue`, which is the established "something is wrong with this thing" bar. This is the one place we should interrupt the user.
3. **Scan column in `SourceFilesTable.vue`** — the only place individual files are ever listed, and the only place per-file granularity is honest. It already computes an unused per-row `status` (`SourceFilesTable.vue:506-516`), so the hook exists. This table is bounded (one package's sources) and the user has deliberately drilled in, so **show the green check for `clean` here too** — icon-only with the label on hover, to keep the column narrow. The attention-only rule applies to the unbounded dataset browser, not here.

Note `fileStatusLabel` (`FileDetails.vue:572`) already switches "File status" ↔ "Package status" for multi-source packages; the scan row should follow the same convention.

### 4b. File browser list — pick one

**Option A — package-level aggregate in the API** — **DECLINED.** Per-row badges are not being built. The aggregate is real backend cost (a `PackageManager` query change) and can only ever show attention states, whereas the sidebar gives every file a visible confirmation for a fraction of the effort. Revisit only if users report missing at-a-glance quarantine signal in large folders. Kept here for the rationale.

Add `scanStatus` to `PackageDTO`, computed worst-wins per §3. Then:
- decorate rows in `BfDatasetFiles.vue:1064` and `:1012`, exactly the way `icon` / `subtype` are already decorated;
- render the badge in `BfFileLabel.vue` alongside the existing `.status-label` spans (`:118-141`).

One component change propagates the badge to the browser, trash, move dialog, analysis tables and `SourceFilesTable` for free, because they all render `BfFileLabel`. Cost is a `PackageManager` query change in pennsieve-api.

**Option B — sidebar only, no backend change** — **CHOSEN, implemented.**

`FileMetadataInfo.vue` only renders on **single** selection, so we can fetch `?include=sources` for that one package on select and add a "Scan status" row (`FileMetadataInfo.vue:20` + a key in `getFileInfo`, `:219-253`). ~10 lines, zero API work beyond the merge, and it covers the "I want to check this file" intent.

Being a single-file context, this uses the **full** §4a copy spec including the positive `clean` confirmation — not the list-context attention-only rule. It's the cheapest way to give every file in the browser a visible "yes, we scanned this" without touching the table at all, and for that reason it may be worth more than the per-row badge.

**Option C — aggregate pill, no per-row column**

Reuse the `BfUploadInfo` floating-pill pattern (`BfUploadInfo.vue:10-28`) for "N files quarantined in this dataset". Cheap and high-signal, but needs a count endpoint.

**Recommendation: 4a + Option B first** (ships the moment the API branch merges), then Option A if per-row badges prove necessary.

### 4c. Download gating — make refusals legible

The API will start returning 403 and dropping files from manifests. Right now the app would swallow both silently.

- `BfDownloadFile.vue:320-324` does `if (!url) return false` and falls back to zipit. A 403 on an infected file currently becomes a silent zipit fallback rather than an explanation. Needs an explicit 403 branch → error toast naming the file and the reason.
- Bulk download is a form POST to zipit (`BfDownloadFile.vue:3`). Per the gating commit's own audit, **zipit ignores the new `blocked[]` array**, so blocked files vanish from the zip with no notice. Either zipit surfaces `blockedCount`, or the app pre-checks the manifest before handing off. This needs an owner — it is not currently anyone's task.
- The existing `DOWNLOADABLE_STATES` allowlist (`BfDownloadFile.vue:206-235`) is package-state based and stays as-is; scan gating is a separate, orthogonal check.

## 5. Freshness — how the badge updates

**There is no polling in the file browser and none at all on the detail page.**

- The browser refreshes on Pusher `upload-event` → `debouncedSilentFetch` (`BfDatasetFiles.vue:559-583`, debounce at `:604`).
- `FileDetails` fetches `proxyRecord` once per `fileId` (`:1189-1197`) and never refreshes.

**The problem:** scans complete *after* upload, so the existing `upload-event` will not fire again when a verdict lands. A `pending → clean` transition is invisible until a manual reload.

Options, in order of preference:

1. **Scanner publishes a completion event** that reaches the existing `dataset-{uuid}` Pusher channel. Correct, reuses the whole existing refresh path, but requires scan-service work (it currently only writes to Postgres).
2. **Bounded poll on the detail page** while status is `pending` — e.g. 5 s interval, give up after ~2 min. `ActivityMonitor.vue:234` is the in-repo precedent. Cheap, self-limiting, and matches the documented "resolves within seconds" expectation.
3. **Do nothing.** `pending` is genuinely short-lived; a stale badge that resolves on next navigation may be acceptable for v1.

Recommend **2** for v1 and **1** as the durable fix.

## 6. Phasing

| Phase | Scope | Depends on |
|---|---|---|
| **0** | Review + merge [pennsieve-api PR #377](https://github.com/Pennsieve/pennsieve-api/pull/377); deploy to dev | — |
| **1** | Detail page: property row, `scan_skip_reason`, infected/failed banner, `SourceFilesTable` column | Phase 0 |
| **2** | Download legibility: 403 branch in `BfDownloadFile`, decide zipit `blocked[]` ownership | Phase 0 |
| **3** | Browser sidebar row (Option B) — **done, pending Phase 0 to light up** | Phase 0 |
| **4** | Detail-page poll while `pending` (or scanner completion event) | Phase 1 |
| ~~5~~ | ~~`PackageDTO.scanStatus` aggregate + per-row badge~~ — **declined**, see §4b | — |

Phases 1–3 are independent of each other and can go in parallel once Phase 0 lands.

**Downloadability is unchanged for everything except `infected` / `failed`.** `unscanned` files stay downloadable by design — `scanStatusBlocks` in both packages-service (`download.go:200`) and pennsieve-api (`PackagesController.scala:121`) lists only those two. This is the deliberate permissive posture from `developer.md` §12.2 option B, and it matters given ~188 prod files per 30 days land `unscanned` on size alone. The UI must label them without implying they're blocked.

Per the repo convention (`feedback_pennsieve_app_two_pr_workflow`): one epic branch off `main`, draft PR to `main` carrying all commits, plus separate PRs to `dev` for testing/deploy.

## 7. Open decisions

1. **Do we want per-row badges in the browser at all**, or is detail + sidebar enough for v1? This is the Option A / Option B fork and the only one with real backend cost.
2. **Who owns the zipit `blocked[]` gap?** Silently-incomplete zips are the worst failure mode in this whole surface, and it is currently unassigned.
3. **`failed` presentation.** It blocks download identically to `infected` but means "we don't know", not "this is dangerous". Same red badge, or a distinct treatment? Users will read a red badge as "virus".
4. **Admin affordance.** `developer.md` §12.1 anticipates a review queue for infected/failed files. Out of scope here, but the detail-page banner should leave room for a future "request review" action.
5. **`pending` is not transient today — RESOLVED, do not badge it.** Two causes: (a) the migration added the column as `NOT NULL DEFAULT 'pending'`, so every pre-rollout file was backfilled to `pending`; (b) legacy-path uploads are skipped by design (§1a) and land at `pending`. Neither is healed by the upcoming deprecation — both need the backfill reconciler (`developer.md` §14.1 item 6). Badge only terminal states in v1; revisit after deprecation + backfill.
7. **Sequencing against the legacy-path deprecation.** Once deprecation lands, new uploads are all scanned and `pending` becomes genuinely transient — but existing rows don't change until a backfill runs. Worth confirming the backfill reconciler is scheduled alongside the deprecation, since the two together are what make a pending spinner honest. Doesn't block any phase here.
6. **Do we want the detection name?** Not currently persisted (§2). If support or compliance want "what was found", that's a scan-service schema change and should be raised now rather than discovered during Phase 1.

## 8. Change map

| File | Change |
|---|---|
| `src/components/datasets/files/FileDetails/FileDetails.vue` | Scan status property row (`:125`); infected/failed banner (`:108`); optional poll while pending |
| `src/components/datasets/files/FileDetails/SourceFilesTable.vue` | Scan column; reuse existing per-row `status` hook (`:506`) |
| `src/components/datasets/files/Metadata/FileMetadataInfo.vue` | Scan status row (`:20`) + key in `getFileInfo` (`:219`) |
| `src/components/bf-download-file/BfDownloadFile.vue` | Explicit 403 branch (`:320`); bulk `blockedCount` handling |
| `src/components/datasets/files/bf-file/BfFileLabel.vue` | *Option A only* — badge alongside `.status-label` (`:118`) |
| `src/components/datasets/files/BfDatasetFiles.vue` | *Option A only* — decorate rows (`:1064`, `:1012`) |
| new: `src/mixins/scan-status/` or a composable | Value→label/severity/pill map; single source of truth for the §2 table |

Note `FileMetadataInfo_updated.vue` in the same folder is dead code and imported nowhere — do not edit it.

The value→presentation map should live in exactly one module. There are already three duplicated copies of the package-state map in this repo (`BfFileLabel.vue:427`, `TableMenu.vue:164`, `SourceFilesTable.vue:506`); don't make it four for scan status.
