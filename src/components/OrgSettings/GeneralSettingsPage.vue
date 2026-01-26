<template>
  <bf-stage 
    slot="stage"
    element-loading-background="transparent"
  >
    <div class="settings-page">
      <general-settings-form />
    </div>
  </bf-stage>
</template>

<script>
import GeneralSettingsForm from './forms/GeneralSettingsForm.vue'

export default {
  name: 'GeneralSettingsPage',

  components: {
    GeneralSettingsForm
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.settings-page {
  padding: 32px;
}
</style>