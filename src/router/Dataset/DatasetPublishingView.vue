<template>
  <div class="dataset-publishing-view">
    <router-view name="stage" />
  </div>
</template>

<script>
export default {
  name: 'DatasetPublishingView',

  props: {
    orgId: {
      type: String,
      default: ''
    }
  },
}
</script>

<style scoped>
.dataset-publishing-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
