<template>
  <bf-stage 
    slot="stage"
    element-loading-background="transparent"
  >
    <div class="settings-page">
      <data-use-agreements-form />
    </div>
  </bf-stage>
</template>

<script>
import DataUseAgreementsForm from './forms/DataUseAgreementsForm.vue'

export default {
  name: 'DataUseAgreementsPage',

  components: {
    DataUseAgreementsForm
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.settings-page {
  padding: 32px;
}
</style>