<script setup>
import RouterTabs from '@/components/shared/routerTabs/routerTabs.vue'
import { useStore } from 'vuex'
import { runPageIsNotebook } from '@/components/Analysis/RunMonitor/notebookHelpers'

const store = useStore()
// A run's page sits under no tab's path: it lights up Notebooks for a
// notebook's run, else Workflows (as do configuring a run, a new workflow
// and a workflow's page). An app's pages are under the Apps tab's path.
const runPage = (route) => route.name === 'my-run-detail'
const isNotebook = (route) => runPageIsNotebook(route, store.getters['analysisModule/workflowInstances'])

// Analysis outside any workspace, laid out like a workspace's Analysis page.
const tabs = [
  {
    name: 'Workflows',
    to: 'my-workflows',
    activeWhen: (route) =>
      (runPage(route) && !isNotebook(route)) ||
      ['my-run-configure', 'my-workflow-create', 'my-workflow-detail'].includes(route.name),
  },
  {
    name: 'Notebooks',
    to: 'my-notebooks',
    activeWhen: (route) => runPage(route) && isNotebook(route),
  },
  {
    name: 'Apps',
    to: 'my-apps',
  },
  {
    name: 'Compute Nodes',
    to: 'my-compute-nodes',
  },
]
</script>

<template>
  <div class="my-analysis">
    <div class="content-tabs">
      <router-tabs class="content-tabs-list" :tabs="tabs" />
      <!-- The current tab's views (AnalysisViewBar); its actions are on the
           title row -->
      <div id="analysis-tab-views" class="tab-views" />
    </div>
    <router-view />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/theme';

.content-tabs {
  display: flex;
  align-items: flex-end;
  gap: 32px;
  box-sizing: border-box;
  height: 44px;
  background: white;
  border-bottom: 1px solid theme.$gray_2;
  padding: 0 32px;
}
/* The tabs at the row's bottom (their underline on its rule). */
.content-tabs-list {
  flex-shrink: 0;
  max-width: 100%;
}
/* The current tab's views (AnalysisViewBar), on the right. */
.tab-views {
  display: flex;
  flex: 1;
  align-self: center;
  justify-content: flex-end;
  min-width: 0;
}
/* A phone: the views on a line below the tabs. */
@media (max-width: 767px) {
  .content-tabs {
    flex-wrap: wrap;
    row-gap: 0;
    height: auto;
    padding: 0 16px;
  }
  /* A long row of tabs scrolls rather than the page. */
  .content-tabs-list {
    overflow-x: auto;
  }
  .tab-views {
    flex-basis: 100%;
    justify-content: flex-start;
    padding: 4px 0 8px;
  }
  .tab-views:empty {
    display: none;
  }
}
</style>
