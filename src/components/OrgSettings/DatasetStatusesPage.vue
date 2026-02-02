<template>
  <bf-stage 
    slot="stage"
    element-loading-background="transparent"
  >
    <div class="settings-page">
      <dataset-statuses-form />
    </div>
  </bf-stage>
</template>

<script>
import DatasetStatusesForm from './forms/DatasetStatusesForm.vue'

export default {
  name: 'DatasetStatusesPage',

  components: {
    DatasetStatusesForm
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.settings-page {
  padding: 32px;
}
</style>