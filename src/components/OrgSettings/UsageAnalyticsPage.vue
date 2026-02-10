<template>
  <bf-stage 
    slot="stage"
    element-loading-background="transparent"
  >
    <div class="settings-page">
      <usage-analytics-view />
    </div>
  </bf-stage>
</template>

<script>
import UsageAnalyticsView from './forms/UsageAnalyticsView.vue'

export default {
  name: 'UsageAnalyticsPage',

  components: {
    UsageAnalyticsView
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.settings-page {
  padding: 32px;
}
</style>