<script setup>
import RouterTabs from '@/components/shared/routerTabs/routerTabs.vue'

// Analysis outside any workspace, laid out like a workspace's Analysis page.
const tabs = [
  {
    name: 'Notebooks',
    to: 'my-notebooks',
  },
  {
    name: 'Workflows',
    to: 'my-workflows',
  },
  {
    name: 'Applications',
    to: 'my-applications',
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
