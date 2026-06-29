# Public Datasets in My Workspace — Planning Doc

> Status: **DRAFT v0.2** — scope & key decisions resolved; living document, iterate freely.
> Branch: `feat/public-datasets-in-my-workspace`

## 0. Vision & Overall Goals

The long-term arc this work builds toward (multiple efforts):

1. **Navigate public datasets** — users browse Pennsieve **Discover** datasets in the app, the same way they navigate their current workspace datasets. *(This effort.)*
2. **Create shareable read-only "views"** — platform functionality where a user **selects specific files across multiple datasets** and assembles them into a **read-only "view" dataset** that can be **shared independently** with other users. *(Second effort.)*
3. **Pipelines outside a workspace** — ultimately, **any user** can invoke **analytic pipelines** on these read-only datasets **outside the scope of a workspace**, from their personal **"My Workspace"** account. *(Later effort.)*
4. **Analysis outputs** — where the output of such analyses lands (storage, ownership, sharing) is an **open problem to solve later** — explicitly **not in scope now**.

Goals 1–3 are unified by the same primitive: a **read-only, versioned dataset** (public or private) that can be navigated, shared, and fed into compute independent of workspace membership. This doc covers **Goal 1**, designed so Goals 2–3 plug in (see §4a abstraction).

## 1. Goal (this effort = Vision Goal 1)

Make Pennsieve **public (Discover) datasets** read-only accessible from inside **My Workspace**, so users can:

- **Navigate** public datasets in-app (no longer bouncing out to the standalone Discover app). *(Search is v2.)*
- **View dataset details** (metadata, files, banner) within the app.
- **Use public datasets as inputs for analytic pipelines** — reference them in notebooks / compute workflows.
- **Add public datasets to collections** (reuse existing collection integration).

Public datasets are **read-only**: users browse, search, inspect, and consume them as inputs — they do not edit or own them.

### Broader direction (informs the architecture)

Public datasets are the **first concrete type** of a more general concept: a **read-only dataset source** surfaced in My Workspace. A planned **second effort** will let users create a **"view"** — a curated read-only dataset assembled from **subsets of files pulled from one or more existing datasets** in a workspace, shared with others.

So a "view-only dataset" can be either:
1. A **public dataset** from the Discover service (this effort) — a **public release**, or
2. A **view** — created the *same way* as a public dataset (cut a specific **release** exposing a subset of files over existing datasets), but it stays **private** instead of being published to Discover (second effort).

The two share the same **read-only consumption UX**, but their backing implementation likely differs (see §2a): a public dataset is a Discover release; a view is **probably an ordinary org dataset carrying a "view" flag** (hypothesis), exposing a curated subset of files. They differ in **visibility** (public via Discover vs. private/shared-in-org), **where they live** (no-org vs. inside an org), and **how they surface in the UI**. The exact "view" mechanism is **unconfirmed** — see §2a open item.

**Design implication:** build this effort around a generalized read-only dataset abstraction (browse, search, detail, use-as-input, add-to-collection) so the future "views" type slots in as another source rather than a parallel UI. Avoid hard-coupling the UI/store to Discover-specific shapes where a thin adapter would keep it source-agnostic.

## 2. User Stories

- As a workspace user, I can open a "Public Datasets" area in My Workspace and browse the catalog.
- As a user, I can open a public dataset's detail page to inspect overview, metadata, and file tree (read-only) — laid out like a normal workspace dataset.
- _(v2)_ As a user, I can search/filter public datasets by keyword (and facets later).
- As a user, I can select a public dataset (or files within it) as an **input to a notebook / analytic pipeline**.
- As a user, I can add a public dataset to one of my collections.

## 2a. Scoping Model — where data lives & permission boundaries

A core, easy-to-miss distinction: the read-only datasets we're unifying have **different scoping/permission homes**, even though the browse/detail UX is similar.

| Thing | Scope / where it lives | Permission model |
|-------|------------------------|------------------|
| **"My Workspace"** (the section) | **Outside any organization/workspace.** Personal to the user. | Personal account; not org-scoped. |
| **Public datasets** (Discover) | Public, not owned by any org the user belongs to. | Open / public; no org membership needed to read. |
| **"Shared With Me" datasets** | **Inside an organization** — the user holds a **guest account** in that org. | Standard org/dataset permissions, via guest role. |
| **Dataset "views"** *(2nd effort, tentative)* | **Likely inside an organization, as ordinary datasets carrying a new "view" flag** — so they list alongside normal datasets and reuse existing dataset permission handling. | Reuses standard dataset permissions (hypothesis, not confirmed). |

**Why this matters:**
- **"My Workspace" is org-less.** This is the **core difference** from existing functionality: today, data interaction and analysis happen *within* an organization. Goal 3 (pipelines from "My Workspace") deliberately runs **outside** any workspace/org scope — a genuinely new mode, not a reskin of org-scoped compute.
- The §4a read-only abstraction therefore spans **three different backing models** (public/no-org, guest-in-org, org-dataset-with-flag). The *consumption* surface is shared; the *provenance, auth, and permission* paths differ per `sourceType` and must be handled in each adapter.
- **Views ≈ datasets + flag** (if the hypothesis holds) is attractive: it lets views reuse dataset listing, permissions, and detail nav wholesale, with the flag driving read-only behavior. To be confirmed with the platform/backend design for the 2nd effort.

> **Open**: confirm where views live and whether they're literally datasets+flag. If so, the "views" source may not even need a distinct adapter — it could ride the existing dataset APIs with a read-only flag, and §4a's value narrows to the **public/Discover** case. Keep this in mind so we don't over-build the abstraction.

## 3. Current State (codebase findings)

**Existing discover/public plumbing** lives in `src/stores/collectionStore.js` (Pinia):
- `getPublicDatasets(limit, offset)` → `GET {discoverUrl}/datasets?...&datasetType=research&embargo=false`
- `searchDatasets(query, limit, offset)` → `GET {discoverUrl}/search/datasets?...`
- `fetchDatasetCollections(datasetId)` → `GET {discoverUrl}/datasets/{id}/collections`

**Config** (`src/site-config/site.json`): `discoverUrl = https://api.pennsieve.net/discover`.

**My Workspace** shell: `src/router/MyWorkSpace/MyWorkSpacePage.vue`, routed under `/my-workspace` in `src/router/index.js`. Existing child tabs: `shared`, `settings`, `publishing`, `code`.

**The "My Data" / Shared area** — `src/components/user/shared/SharedWithMe.vue` (routed at `/my-workspace/shared`, name `shared-with-me`) renders an `el-tabs` with two panes today:
- **"Shared Workspaces"** (`name="workspaces"`) — workspaces the user can access (`WorkspaceCard`).
- **"Shared With Me"** (`name="datasets"`) — guest datasets shared directly with the user (paginated card grid, loaded from `{api2Url}/datasets/shared-datasets`).

This is where the new public-datasets UI lives (see §Navigation decision below).

**Dataset list patterns to mirror**: `src/components/datasets/dataset-list/BfDatasetList.vue` (search + pagination), `BfDatasetListItem.vue` (card), `DatasetFilterMenu`, `DatasetSortMenu`.

**Store conventions**: new work should use **Pinia** (`src/stores/`, `useXStore`), HTTP via `useSendXhr` + `useGetToken`.

**Gap**: there is no in-app browsing UI for public datasets today; unauthenticated/redirect paths send users to the standalone Discover app (`src/main.js`).

### Confirmed Discover API (verified against live endpoint)

Base: `{discoverUrl}` = `https://api.pennsieve.net/discover`. List/detail are public (no token); search passes `api_key`.

| Purpose | Endpoint | Response |
|---------|----------|----------|
| **List** | `GET /datasets?limit&offset&datasetType=research&embargo=false` | `{ limit, offset, totalCount, datasets[] }` — ~243 datasets in dev |
| **Detail** | `GET /datasets/{id}` | full metadata object (same fields as a list item); **no embedded files** |
| **Files** | `GET /datasets/{id}/versions/{version}/files/browse?limit&offset&path=` | `{ totalCount, files[] }`; entries are `type: "Directory" | "File"`; **path-based folder navigation** via `path=` |
| **Search** *(v2)* | `GET /search/datasets?limit&offset&query&api_key={token}` | same shape as List |

Dataset fields available: `id`, `sourceDatasetId`, `name`, `description`, `banner`, `readme`, `changelog`, `doi`, `version`, `revision`, `size`, `fileCount`, `recordCount`, `modelCount`, `owner*`, `organizationName/Id`, `license`, `tags`, `contributors[]`, `uri`/`arn` (S3), `status`, `versionPublishedAt`, `updatedAt`, `embargo*`, `datasetType`.

Notes:
- Files browse is **paginated + path-scoped** — maps cleanly onto a folder-by-folder file nav (mirrors `BfDatasetFiles`).
- Detail returns metadata only; the files tab is a separate browse call per folder.
- `version` from the detail/list response feeds the files-browse URL.
- The existing `collectionStore.getPublicDatasets` already transforms the list response — reuse that field mapping in the new adapter.

## 4. Functional Scope

### In scope
- New "Public Datasets" section/route within My Workspace.
- List view: paginated browse + keyword search.
- Detail view: read-only metadata + file tree + banner.
- Hook to use a public dataset as a notebook/pipeline input.
- "Add to collection" action.

### Out of scope (for now)
- Editing/owning public datasets.
- Embargoed dataset access flows.
- Faceted/advanced search (candidate for later iteration).
- Replacing the standalone Discover app.
- **Building the "views" feature itself** (second effort) — but we *do* design the abstraction so it can plug in. See §4a.

## 4a. Read-Only Dataset Source Abstraction

To keep this effort from hard-coupling to Discover, model a source-agnostic interface that both public datasets and future "views" implement:

```
ReadOnlyDatasetSource
  - list({ limit, offset, query }) -> { items, totalCount }
  - get(id)                        -> { metadata, files[], banner, sourceType }
  - toPipelineInput(ref)           -> input descriptor for notebooks/compute
```

- **`sourceType`**: `'discover'` (this effort) | `'view'` (future).
- The list/detail UI components consume the abstraction, not Discover endpoints directly.
- Each source type provides an **adapter** mapping its API shape → the common model.
- Phase 1 ships the `discover` adapter; the `view` adapter is added by the second effort with no UI rework.

**Tension to watch:** don't over-abstract before we know the "view" API shape. Keep the interface minimal and driven by what Phase 1 actually needs; widen it only when the second effort lands.

## 4b. Detail view (mirror workspace dataset navigation)

The read-only detail experience should match the existing **workspace dataset navigation** as closely as possible, so a public dataset feels like any other dataset minus edit affordances. Mirror these:

| Section | Existing component / route | Read-only adaptation |
|---------|---------------------------|----------------------|
| Overview | `DatasetOverview.vue` (`dataset-overview`) | metadata/banner/description, no edit |
| Metadata | metadata view (`metadata` route) | view records/models, no edit |
| Files | `DatasetFilesView.vue` + `BfDatasetFiles.vue`, header `SecondaryPageHeaderFiles` (`dataset-files`) | browse file tree, no upload/delete/rename |

- Reuse the same secondary-nav shell so the layout/breadcrumbs feel native.
- Data is sourced from the read-only adapter (Discover endpoints for `sourceType='discover'`), not the workspace dataset APIs.
- Strip/disable write actions (upload, edit metadata, permissions, delete).

**Route strategy (RESOLVED): parallel read-only routes that REUSE the real presentational components.** The container components (`Datasets.vue` shell, `DatasetOverview`) are tightly coupled to Vuex `activeOrganization` + a global `dataset` object + `getPermission()`, so we don't route public datasets *through* them. But the leaf presentational pieces ARE reused for fidelity:
- **Secondary nav** — reuses `BfNavigationItem` (not Vuex-coupled) in a `PublicDatasetNavigation.vue` that mirrors `BfNavigationSecondary`'s container. Registered as the `navigationSecondary` named view on the `my-workspace` route (App.vue renders it when `meta.hideSecondaryNav === false`, which only the `public-dataset` route sets). Result: the real dark left nav column, Overview/Files items.
- **File browser** — reuses the actual `FilesTable` + `BfFileLabel` components. `PublicDatasetFiles.vue` maps Discover file-browse entries onto the `{ content, storage, subtype, icon, type }` row shape those expect (directories → `packageType: 'Collection'` for the folder icon). Same el-table look, icons, columns, selection as workspace datasets.
- Routes: `/my-workspace/public/:datasetId/{overview,files}` (parent `public-dataset` → `PublicDatasetDetail` stage shell that loads the dataset into `readOnlyDatasetStore.current` + renders the nested section `<router-view>`).
- Components: `src/components/datasets/PublicDataset/{PublicDatasetDetail,PublicDatasetNavigation,PublicDatasetOverview,PublicDatasetFiles}.vue`.
- Discover folder entries lack `createdAt`; guarded `FilesTable`'s Date cell to render blank when there's no date (backward-compatible — workspace datasets always supply `createdAt`).
- **Read-only / provenance indicator (UX decision)**: landed on a **~18px gradient vertical strip** down the left of the secondary nav with a rotated "PUBLIC DATASET · READ-ONLY" label and a **gentle, intermittent sheen** (low opacity, 7s loop, sweeps then rests). Reinforced by a **labeled source chip beside the title** (same color/glyph). `sourceType`-driven (`discover` teal, `view` purple). (Tried alternatives along the way — thin border, glossy bevel, static color+glyph, text context bar — the wider strip read best; sheen dialed down from the first cut.)

**Metadata (DEFERRED):** the Metadata nav item is present but disabled ("Soon"). It will be powered by **DuckDB over the dataset's published parquet files** (see `duckdbStore.js`), not the workspace metadata APIs — to be investigated in a later phase.

## Navigation decision (resolved)

Lives in the **"My Data" / Shared area** (`SharedWithMe.vue`, `/my-workspace/shared`), as a **third tab** in the existing `el-tabs`:

| Tab | Contents |
|-----|----------|
| Shared Workspaces | (unchanged) workspaces the user can access |
| Shared With Me | datasets shared specifically with the user **+ (future) private "views"** (read-only releases shared with the user) |
| **Public Datasets** *(new — this effort)* | browse/search public Discover datasets |

Notes:
- Public datasets get their **own tab** (public catalog is large & distinct from things shared *with you*).
- Future private **views** surface under **"Shared With Me"**, not the Public tab — they're shared, not public.
- Both tabs consume the same read-only dataset abstraction (§4a); they differ in data source + visibility, not in the detail / pipeline-input / collection machinery.

## 4c. File Preview / Viewer (plan — mirror discover-app2)

**Approach (revised after reviewing discover-app2 @ latest main)**: do NOT reuse the workspace viewer stack (`ViewerPane` / `static-viewer` / `viewerModule`) — it's package-id + streaming-backend coupled. Instead **mirror pennsieve-discover-app2's viewer system**, which is already designed for public datasets and driven entirely by **public endpoints + reusable `@pennsieve-viz/*` components**.

**Why this is now low-friction:**
- **Deps already present** in pennsieve-app `package.json`: `@pennsieve-viz/core` (`MarkdownViewer`, `TextViewer`, `OrthogonalFrame`), `@pennsieve-viz/micro-ct` (`OmeViewer`), `@pennsieve-viz/tsviewer` (`TSViewer`); plus `vue3-pdf-app`/`pdfjs-dist` for PDF and native `<img>`.
- **All endpoints are public** (discover / api2):
  - presigned file URL → `POST {discoverUrl}/datasets/{id}/versions/{ver}/files/download-manifest` (already wired as `getFileDownloadUrl`) — used as `src` for image/OME.
  - package files (direct open) → `GET {discoverUrl}/packages/{sourcePackageId}/files`.
  - text/markdown content → fetched via zipit (cf. discover `useFileContent`).
  - timeseries / OME-Zarr / neuroglancer assets → `GET {api2Url}/packages/discover/assets?package_id={sourcePackageId}` (returns `assets[]` with `asset_type`, `asset_url`, `status`, optional `cloudfront`).
  - timeseries streaming → public `wss .../streaming/discover/ts/query` + `https .../streaming`.
- **Reference implementation to port**: discover-app2 `config/viewerRegistry.ts` (`resolveViewer(uri, packageType)`) + `pages/package/[id].vue` (resolution → fetch manifest/content/assets → `<component :is>`). Our Discover file-browse already returns `sourcePackageId` per file (set for processed packages like timeseries).

**Plan of record:**
1. Port `viewerRegistry.ts` + `resolveViewer()` into pennsieve-app (add PDF entry).
2. Add store actions on the discover adapter: `getPackageFiles(sourcePackageId)`, `getViewerAssets(sourcePackageId)` (→ `{api2Url}/packages/discover/assets`), `getFileContent(...)` (zipit). Reuse `getFileDownloadUrl` for image/OME `src`.
3. Build a viewer host that mirrors discover's `pages/package/[id].vue`: resolve viewer, fetch the right data, render the `@pennsieve-viz` component (or `<img>`) with `getProps`.
4. Surface it as the **"Preview" section in `PublicDatasetFileDetails`** (matching the workspace File Details layout) and/or a full-page viewer route (discover uses a full `/package/{id}` page).

### Phases (all unblocked — deps + endpoints exist)
- [x] **V1 (DONE)**: inline **Preview** section in `PublicDatasetFileDetails` for **image / text / markdown / OME-TIFF**. Ported `viewerRegistry.js` (`resolveViewer`). All types use the **presigned S3 URL** (`getFileDownloadUrl`): image/OME as `src`/`source`; text/markdown via `getFileContent`, which fetches the presigned URL and reads it as text (NOT zipit — `site.json` `zipitUrl` 301-redirects to `:8443/zipit/` and `fetch` drops the POST body on redirect; the presigned URL is simpler and consistent). Renders `@pennsieve-viz/core` `Markdown`/`TextViewer`, `@pennsieve-viz/micro-ct` `OmeViewer`, or native `<img>`. Unsupported types → "No preview available". (PDF deferred.)
- **V2**: **timeseries** (`TSViewer`) via `/packages/discover/assets` + public streaming endpoints.
- **V3**: **OME-Zarr / neuroglancer** (`OrthogonalFrame`) via assets + cloudfront (ties to existing neuroglancer work).
- Tabular CSV/Parquet (`DataExplorer`/DuckDB) remains a separate track with §4b metadata.

Preview degrades gracefully: unsupported types show "No preview available".

**Open decision**: inline Preview pane in file-details (matches workspace File Details) vs. a full-page viewer route like discover's `/package/{sourcePackageId}` (richer). Lean: inline preview in file-details for V1, full-page later if needed.

## 4d. Metadata (Models / Records) via DuckDB-WASM (plan — multi-phase)

**Goal**: mirror the workspace **Metadata** experience (Models list → Records table → Record detail) for public datasets, read-only. There is **no metadata service** for published datasets — models/records are **files on S3**, queried client-side with **DuckDB-WASM**.

**S3 layout** (confirmed against dataset 5323 v1; relative to dataset root):
- `metadata/models/{model}/versions/{N}/schema.json` — JSON Schema: `{ properties:{ name:{type,description,enum?,"x-pennsieve-key":true} }, required:[] }`. The `x-pennsieve-key` property is the title/key. Model name = directory name; latest = max `versions/{N}`.
- `metadata/models/{model}/versions/{N}/records.jsonl` — one record per line: `{ "id", "data": { <prop>: <value> } }` (note **`data`**, vs workspace records' `value`).
- `metadata/relationships.csv` — `source_record_id, target_record_id, relationship_type`.
- `metadata/files.csv` — `record_id, package_id, path`.

**Existing assets**: `src/stores/duckdbStore.js` (DuckDB-WASM init, connections, `loadFile` for **csv/parquet**, `executeQuery`). Presigned file URLs via `getFileDownloadUrl` (download-manifest). Frontend to mirror: `modelList.vue`, `ListRecords.vue` (columns from `schema.properties` + `formatCellValue`), `RecordSpecViewer.vue`.

**Mapping** workspace → published: model `{name, latest_version.schema}` ← schema.json (`displayName` = humanized dir name; `propertyCount` = #properties; key = `x-pennsieve-key`); record `{id, value}` ← `{id, data}` (alias `data`→`value`); relationships/files ← the two CSVs.

### Phases
- [x] **M0 (DONE)**: `duckdbStore.loadFile` now supports **json/jsonl** (`read_json_auto`, `format='newline_delimited'` for jsonl).
- [x] **M1 (DONE)**: `readOnlyDatasetStore` discover-adapter metadata actions — `listModels(id, version)` (browse `metadata/models`, resolve latest `versions/{N}`, fetch each `schema.json`), `getModel(...)`, `getRecordsUrl(...)`; store action `queryRecords(...)` loads `records.jsonl` into DuckDB and runs `SELECT id, to_json(data) AS data ... LIMIT/OFFSET` (cached by fileId so pagination reuses the table).
- [x] **M2 (DONE)**: enabled the **Metadata** secondary-nav item; `PublicDatasetMetadata.vue` (models grid from schemas) + `PublicDatasetRecords.vue` (DuckDB-backed records table, columns from `schema.properties`, offset pagination). Routes `public-dataset-metadata` (`/metadata`) + `public-dataset-records` (`/metadata/:model`).
- [x] **M3 (DONE)**: records rows clickable → `PublicDatasetRecord.vue` (route `public-dataset-record` at `/metadata/:model/:recordId`). Shows properties (schema + value via `ConceptInstanceStaticProperty`), attached **files** (`files.csv` → links to file-details by path), and **relationships** (`relationships.csv`, in/outbound by type). New store actions `getRecord`, `getRecordRelationships`, `getRecordFiles` (DuckDB over jsonl/csv). Relationship targets show record ids (not yet resolved to labels/models).
- [x] **M4a (DONE)**: relationship targets resolve to **label + owning model** and are **clickable** (navigate across models). Backed by a lazily-built, cached cross-model DuckDB index (`idx_{dataset}_{version}`: id, model, model_version, label via `to_json(data)->>'titleProperty'`); `resolveRecords(...)` queries it. `listModels` now cached per dataset.
- [x] **Resilient JSONL load**: some published `records.jsonl` are **invalid JSON** — the publish pipeline double-escapes embedded quotes (`\\"` instead of `\"`; e.g. dataset 5323 `cde`, ~108/2444 lines). Added `duckdbStore.loadJsonlLenient` (parse line-by-line in JS, skip malformed lines, load cleaned NDJSON); `readOnlyDatasetStore._loadRecords` tries native DuckDB read first, falls back to lenient. **Backend bug flagged** (publish-pipeline serializer escaping quotes twice — fix at source + backfill).
- [x] **M4b (partial)**: records **search** (debounced; `WHERE CAST(to_json(data) AS VARCHAR) ILIKE '%…%'`) + **column sorting** (el-table `sortable="custom"` → `ORDER BY (to_json(data)->>'col') … NULLS LAST`), both server-side in DuckDB with offset pagination. Search/sort reset on model change.
- [ ] **M4c** *(later)*: Explore graph (model/relationship visualization); typed numeric sort; per-column filters.

**Notes**: no auth/cursor — offset pagination or load-all for modest datasets; DuckDB queries run in a worker (already wrapped). Records.jsonl can be large — load on model select, not upfront.

## 4e. Gaps / backlog (what's still missing)

Inventory from the overall review, roughly prioritized:

1. **Use as pipeline / notebook input (Vision Goal 3)** — the headline unmet goal. Run analytic pipelines on a public dataset (or selected files) from "My Workspace", outside an org. Needs the dataset-reference contract with the compute/notebook layer (§4b Q3) + Goal 4 (where outputs land).
2. **Add to collection** — original Phase 3/4; not built. Lower effort (reuse `collectionStore`).
3. **Catalog search** — DONE (v2 section). Facets/filters still open.
4. **Discover parity**: version selector + version history (datasets are versioned; we pin the list's version); README on Overview — DONE; contributors w/ ORCID + external publications + funding; whole-dataset download (vs per-file/zip).
5. **Preview depth**: timeseries (`TSViewer`) = V2, OME-Zarr/neuroglancer (`OrthogonalFrame`) = V3.
6. **Metadata M4c**: Explore graph, typed numeric sort, per-column filters.
7. **Private "views"** (`sourceType:'view'`) — the whole second effort; scaffolding (badges/abstraction) exists.
8. **Polish**: deep-linkable file-folder paths in URL; entry-point discoverability.

## 5. Open Questions

1. ~~**Placement**~~ — RESOLVED, see Navigation decision above.
2. ~~**Detail view**~~ — RESOLVED: **mirror the existing workspace dataset navigation** as closely as possible (overview + metadata + files browsing), in read-only mode. Reuse/adapt: `DatasetOverview.vue` (overview), the metadata view (`metadata` route), and `DatasetFilesView.vue` / `BfDatasetFiles.vue` + `SecondaryPageHeaderFiles` (files nav). See §Detail view below.
3. **Pipeline input** *(DEFERRED — figure out later)*: what the notebook/compute layer expects as a dataset reference (published dataset ID + version? S3 path?). Tied to **Vision Goal 3** — running pipelines on read-only datasets **outside the scope of a workspace**, from "My Workspace". To be pinned down during the interactive-notebook work; §4a's `toPipelineInput` is a placeholder until then. Note: **analysis outputs** (where results land) are explicitly out of scope (Vision Goal 4).
4. ~~**Store**~~ — RESOLVED: dedicated `readOnlyDatasetStore.js` (Pinia) keyed by `sourceType`, so the future "views" source reuses it rather than overloading `collectionStore.js`.
5. ~~**Search**~~ — RESOLVED: **v2**. V1 ships browse + pagination only; keyword search and facets are a follow-up.
6. ~~**Auth**~~ — RESOLVED: calls pass the user token. Public Discover browse may work unauthenticated, but auth is **required** for the future private "views" (non-public read-only datasets) and for collection actions — so the adapter/store sends the token via `useGetToken` by default.
7. **Abstraction boundary** (new): how much of the read-only source interface (§4a) do we commit to now vs. defer until the "views" API shape is known? *(leaning: minimal interface driven by Phase 1 needs)*
8. ~~**Naming**~~ — RESOLVED: tab labeled **"Public Datasets"**; future views go under the existing **"Shared With Me"** tab.

## 6. Iterative Implementation Steps

> Each step is independently shippable / reviewable. Refine as we go.

### Phase 0 — Foundations
- [x] Verify discover API responses (shape, pagination, fields available) — see §3 "Confirmed Discover API".
- [ ] Define the minimal `ReadOnlyDatasetSource` interface (§4a) from Phase 1 needs (Q7).
- [ ] Create store: source-agnostic Pinia store keyed by `sourceType`, with a `discover` adapter.

### Phase 1 — Browse (read-only list, no search)
- [ ] Add a third **"Public Datasets"** tab to `SharedWithMe.vue`'s `el-tabs`.
- [ ] Build list view (paginated card grid), mirroring the existing "Shared With Me" tab + `BfDatasetList` patterns.
- [ ] Wire pagination to the store / `discover` adapter. (Search deferred to v2.)

### Phase 2 — Dataset Detail (read-only, mirrors workspace nav)
- [x] Route strategy decided: **parallel read-only routes** under My Workspace (§4b).
- [x] Detail shell + read-only secondary nav (`PublicDatasetDetail.vue`); store `get()` + `current` state.
- [x] Overview section (`PublicDatasetOverview.vue`): mirrors the **pennsieve-discover-app2 `DatasetHeader`** top section — two-column (title/authors/description/metadata left, banner right) + bordered Files/Storage/Records/License stats row. (`get dataset`/embargo actions omitted — read-only/deferred.)
- [x] Citation block (from Discover's bottom section, surfaced here in Overview): "Cite this dataset" box fed by `https://citation.doi.org/format?doi=…&style=…`, APA/Chicago/IEEE toggle + Crosscite link + copy button.
- [x] Files browsing (`PublicDatasetFiles.vue`): path-scoped, paginated, breadcrumb folder nav via `browseFiles`.
- [x] List cards navigate into the detail.
- [ ] Metadata section — **deferred**, to be powered by DuckDB over published parquet files.
- [x] No write actions present (read-only by construction).
- [x] File details page (`PublicDatasetFileDetails.vue`, route `public-dataset-file-details` at `files/details?path=`): clicking a file in the browser opens a read-only details page mirroring the workspace File Details **properties block** (reuses `ConceptInstanceStaticProperty`): name, type, location, size, created, SHA-256. **Constraint**: the real `FileDetails.vue` (~3.5k lines) is bound to the workspace package/records/relationships/viewer/permissions model, which Discover files don't have — so we mirror only the applicable read-only properties; records/relationships/viewer/edit/download omitted (download + preview are later/DuckDB work).
- [x] **Download**: single file → presigned S3 URL via `POST {discoverUrl}/datasets/{id}/versions/{version}/files/download-manifest` (`{paths:[path]}` → `data[0].url`), triggered with `utils/triggerBrowserDownload`. Multiple files / folders → server-side zip via the existing **zipit** form POST (`{paths, datasetId, version, userToken, rootPath?}`). Available both on the file-details page and from a selection bar in the file browser.
  - ⚠️ **BACKEND FOLLOW-UP (forced download)**: the presigned URLs from `download-manifest` open inline for viewable types (PDF/image/etc.) because the S3 object has no `Content-Disposition: attachment`. A client-side blob-fetch workaround was tried and reverted (blocked by S3 CORS). **Fix server-side**: generate the presigned URLs with `ResponseContentDisposition=attachment` (+ filename). Update wherever `download-manifest` presigns — likely **discover-service** (`downloadManifest` operation in `discover-service/openapi/discover-service.yml`), or add/extend a per-file presign in **packages-service**. Until then, single-file downloads may open in a browser tab instead of saving.
- [ ] _(Polish later)_ deep-linkable file paths in URL (folder nav); render README markdown; in-app preview.

### Phase 3 — Add to Collection
- [ ] Wire "Add to collection" using existing `collectionStore` integration.

### Phase 4 — Use as Pipeline Input *(deferred — contract TBD; Vision Goal 3)*
- [ ] Define the dataset reference contract with notebook/compute layer (Q3) — pipelines run **outside workspace scope**, from "My Workspace".
- [ ] Add "Use in notebook / pipeline" action from list + detail.
- [ ] _(Vision Goal 4 — analysis output handling — separate future effort, out of scope.)_

### Phase 5 — Polish
- [ ] Empty/loading/error states, responsive layout (8px grid).
- [ ] Tests.

### v2 — Search
- [x] Keyword **catalog search** over public datasets — `PublicDatasetList` search box (debounced) → `readOnlyDatasetStore.setQuery` → adapter switches to `GET /discover/search/datasets?query=…` (else the plain list). Empty-state copy adapts to the query.
- [ ] Facets/filters.

### Overview dashboard (README + Citation widgets)
- [x] Overview uses the **dashboard wrapper** (`StaticDashboard` from `pennsieve-dashboard`) as an extensible container. Widgets: **README** (read-only `MarkdownPanelWidget`, `locked`, fed `readme.md` via `getFileContent`) and **Citation** (`CitationPanelWidget` — APA/Chicago/IEEE + copy). Layout adapts (README w8 + Citation w4, or full-width if only one).
- Citation degrades gracefully: `citation.doi.org` returns **404** for unregistered DOIs (common on **dev** — DOIs aren't registered with the resolver), now shown as "citation not available" + Crosscite link instead of an error/retry state. CORS is fine (`*`).

## 7. Notes / Decisions Log

- **Placement (final IA)**: "Shared Workspaces", "Shared With Me", and "Public Datasets" are **three top-level primary-nav entries** in `UserNavigation` (no in-page tabs, no `SharedWithMe` shell — removed). Each is its own flat route under `/my-workspace`:
  - `shared-workspaces` → `/my-workspace/shared-workspaces` → `SharedWorkspaces.vue`
  - `shared-datasets` → `/my-workspace/shared-with-me` → `SharedDatasets.vue`
  - `public-datasets` → `/my-workspace/public-datasets` → `PublicDatasetList.vue`
  - each component wraps itself in `<bf-stage>`; `meta.hideSecondaryNav: true`.
  - Backward-compat: a `shared-with-me` route at `/my-workspace/shared` redirects to `shared-workspaces` (old links / login / guest redirects still work).
  - Public Datasets nav item uses `activeForRoutes: ['public-dataset']` to stay highlighted on the detail pages. Breadcrumb (`MyWorkSpacePage.myDataSection`) maps each route to its own name + self-link.
- **Views (2nd effort)**: created like a public dataset (cut a versioned release exposing a file subset) but kept **private**; surfaced under the existing "Shared With Me" tab, not the Public tab.
- **Unifying model**: public datasets and views are both **read-only versioned release snapshots**, differing in visibility + which tab they appear in, sharing the §4a abstraction for detail / pipeline-input / collection.
- **Detail view**: mirror existing workspace dataset nav (overview + metadata + files), read-only, write actions stripped (§4b).
- **Store**: dedicated `readOnlyDatasetStore.js` keyed by `sourceType` (not in `collectionStore.js`).
- **Auth**: token sent by default; required for private views + collection actions.
- **Search**: deferred to v2.
- **Pipeline input**: contract deferred to the interactive-notebook effort.
