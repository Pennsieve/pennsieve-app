<template>
  <bf-stage 
    slot="stage"
    element-loading-background="transparent"
  >
    <div class="settings-page">
      <general-settings-form />
      <workspace-logo-form />
    </div>
  </bf-stage>
</template>

<script>
import GeneralSettingsForm from './forms/GeneralSettingsForm.vue'
import WorkspaceLogoForm from './forms/WorkspaceLogoForm.vue'

export default {
  name: 'GeneralSettingsPage',

  components: {
    GeneralSettingsForm,
    WorkspaceLogoForm
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.settings-page {
  padding: 32px 0;
}
</style>