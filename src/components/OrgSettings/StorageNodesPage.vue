<template>
  <bf-stage
    slot="stage"
    element-loading-background="transparent"
  >
    <div class="settings-page">
      <storage-nodes-form />
    </div>
  </bf-stage>
</template>

<script>
import StorageNodesForm from './forms/StorageNodesForm.vue'

export default {
  name: 'StorageNodesPage',

  components: {
    StorageNodesForm
  }
}
</script>

<style scoped lang="scss">
.settings-page {
  padding: 32px 0;
}
</style>
