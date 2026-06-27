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
- **Open detail**: decide whether to reuse the existing dataset routes with a read-only flag, or add parallel routes under the Public Datasets tab — TBD in Phase 2.

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
- [ ] Define the minimal `ReadOnlyDatasetSource` interface (§4a) from Phase 1 needs (Q7).
- [ ] Create store: source-agnostic Pinia store keyed by `sourceType`, with a `discover` adapter.
- [ ] Verify discover API responses (shape, pagination, fields available).

### Phase 1 — Browse (read-only list, no search)
- [ ] Add a third **"Public Datasets"** tab to `SharedWithMe.vue`'s `el-tabs`.
- [ ] Build list view (paginated card grid), mirroring the existing "Shared With Me" tab + `BfDatasetList` patterns.
- [ ] Wire pagination to the store / `discover` adapter. (Search deferred to v2.)

### Phase 2 — Dataset Detail (read-only, mirrors workspace nav)
- [ ] Decide route strategy: reuse existing dataset routes with a read-only flag vs. parallel routes (§4b).
- [ ] Overview section (adapt `DatasetOverview.vue`).
- [ ] Files browsing (adapt `DatasetFilesView.vue` / `BfDatasetFiles.vue` + `SecondaryPageHeaderFiles`).
- [ ] Metadata section (adapt `metadata` view).
- [ ] Strip/disable all write actions.

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
- [ ] Keyword search over public datasets (`searchDatasets` / discover search endpoint).
- [ ] Facets/filters.

## 7. Notes / Decisions Log

- **Placement**: Public Datasets is a new third tab in `SharedWithMe.vue` (`/my-workspace/shared`), beside "Shared Workspaces" and "Shared With Me".
- **Views (2nd effort)**: created like a public dataset (cut a versioned release exposing a file subset) but kept **private**; surfaced under the existing "Shared With Me" tab, not the Public tab.
- **Unifying model**: public datasets and views are both **read-only versioned release snapshots**, differing in visibility + which tab they appear in, sharing the §4a abstraction for detail / pipeline-input / collection.
- **Detail view**: mirror existing workspace dataset nav (overview + metadata + files), read-only, write actions stripped (§4b).
- **Store**: dedicated `readOnlyDatasetStore.js` keyed by `sourceType` (not in `collectionStore.js`).
- **Auth**: token sent by default; required for private views + collection actions.
- **Search**: deferred to v2.
- **Pipeline input**: contract deferred to the interactive-notebook effort.
