// @/composables/useRouteContext.js
//
// Resolves the current vue-router route to a "chat context" descriptor —
// what file or dataset (if any) the user is currently looking at. Used by
// the Spotlight compose modal to auto-attach the on-screen entity to the
// chat message the user is about to send, so they don't have to navigate
// to Insights and re-explain context.
//
// Returns null when the current route doesn't correspond to a known
// entity (e.g. settings, workspace home) — the Spotlight modal still
// opens, it just shows no auto-attached chip.
//
// Naming notes:
//
//   - `file-record` is the Vue route for the single-file Detail page —
//     the canonical "I'm looking at this file" surface.
//   - `dataset-overview` (and its children like dataset-files, dataset-
//     publishing, etc.) puts us in a dataset context but not on a
//     specific file. For v1 we ONLY auto-attach when we have a specific
//     file — dataset-level attachment is easy to add later but the user
//     intent ("ask about THIS thing") matches file precision better.

import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useStore as useVuexStore } from 'vuex'
import { pathOr } from 'ramda'

// Route names that resolve to a single-file context. Add new ones here
// when more file-detail surfaces ship (e.g. a dedicated viewer route).
const FILE_ROUTE_NAMES = new Set(['file-record'])

// Routes anywhere under a dataset get the dataset attached as context
// when the user isn't on a more-specific file page. Detection is
// keyed on the presence of `:datasetId` in route params — this covers
// every dataset child route (overview, files, publishing, settings,
// etc.) without us having to enumerate them and stay in sync as the
// router evolves.
//
// File detail (FILE_ROUTE_NAMES above) takes priority: when the user
// is looking at a specific file, "this file" is the more useful
// attachment than "this dataset".

/**
 * useRouteContext — returns a reactive `context` ref that updates as the
 * route changes. Shape:
 *
 *   null
 *     | { type: 'file',    packageId, datasetId, name }
 *     | { type: 'dataset', datasetId, name }
 *
 * The `name` field is best-effort: pulled from Vuex when the
 * corresponding page populated it; otherwise null and the consumer
 * (Spotlight chip) shows a neutral fallback like "this file".
 */
export function useRouteContext() {
  const route = useRoute()
  const vuex = useVuexStore()

  const context = computed(() => {
    const routeName = route.name
    const { datasetId, fileId } = route.params || {}

    if (FILE_ROUTE_NAMES.has(routeName) && fileId && datasetId) {
      // Pull a human-readable filename from Vuex when the FileDetails
      // page has populated activeViewer. Shape (from viewerModule):
      //   activeViewer = { content: { id, name, packageType, ... }, ... }
      // We don't *require* the name — passing the packageId structurally
      // is enough for the LLM to do its job. The name just makes the
      // chip readable.
      const activeViewer = pathOr({}, ['viewerModule', 'activeViewer'], vuex.state)
      const name = pathOr(null, ['content', 'name'], activeViewer)
      return {
        type: 'file',
        packageId: fileId,
        datasetId,
        name: name && activeViewer.content?.id === fileId ? name : null,
      }
    }

    // Anywhere else under a dataset → attach the dataset itself.
    // datasetId on params comes from the parent route, so this matches
    // overview / files / publishing / settings / etc. uniformly.
    //
    // Skip the dedicated Insights page — when the user is already on
    // the chat surface, the modal would be pointless and the chip
    // would be misleading (the chat itself is workspace-scoped, not
    // dataset-scoped).
    if (datasetId && routeName !== 'workspace-insights') {
      const stateDataset = pathOr(null, ['dataset', 'content'], vuex.state)
      // Only use the cached name when it matches the current route's
      // datasetId — otherwise we'd attach a stale name from a
      // previously-viewed dataset while the new one loads.
      const name =
        stateDataset && stateDataset.nodeId === datasetId
          ? stateDataset.name
          : null
      return {
        type: 'dataset',
        datasetId,
        name,
      }
    }

    return null
  })

  return { context }
}
