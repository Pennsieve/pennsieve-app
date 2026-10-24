<script setup>
import RouterTabs from '@/components/shared/routerTabs/routerTabs.vue'
import { useStore } from 'vuex'
import { runPageIsNotebook } from '@/components/Analysis/RunMonitor/notebookHelpers'

const store = useStore()
// A run's page sits under no tab's path: it lights up Notebooks for a
// notebook's run, else Workflows (as do configuring a run and a new
// workflow).
const runPage = (route) => route.name === 'my-run-detail'
const isNotebook = (route) => runPageIsNotebook(route, store.getters['analysisModule/workflowInstances'])

// Analysis outside any workspace, laid out like a workspace's Analysis page.
const tabs = [
  {
    name: 'Gallery',
    to: 'my-gallery',
  },
  {
    name: 'Notebooks',
    to: 'my-notebooks',
    activeWhen: (route) => runPage(route) && isNotebook(route),
  },
  {
    name: 'Workflows',
    to: 'my-workflows',
    activeWhen: (route) =>
      (runPage(route) && !isNotebook(route)) || ['my-run-configure', 'my-workflow-create'].includes(route.name),
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
      <router-tabs :tabs="tabs" />
    </div>
    <router-view />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/theme';

.content-tabs {
  background: white;
  border-bottom: 1px solid theme.$gray_2;
  padding: 0 32px;
}
</style>
