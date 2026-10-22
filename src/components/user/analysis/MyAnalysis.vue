<script setup>
import RouterTabs from '@/components/shared/routerTabs/routerTabs.vue'

// Analysis outside any workspace, laid out like a workspace's Analysis page.
// Compute Nodes is the only tab so far; runs, workflows and applications
// need the run-tenant work before they make sense here.
const tabs = [
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
