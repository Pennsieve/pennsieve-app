<template>
  <div class="dataset-settings-view">
    <router-view name="stage" />
  </div>
</template>

<script>
export default {
  name: 'DatasetSettingsView',

  props: {
    orgId: {
      type: String,
      default: ''
    }
  },
}
</script>

<style scoped>
.dataset-settings-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
