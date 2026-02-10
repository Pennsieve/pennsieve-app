<template>
  <bf-stage
    slot="stage"
    element-loading-background="transparent"
  >
    <workspace-settings-dashboard />
  </bf-stage>
</template>

<script>
import WorkspaceSettingsDashboard from './WorkspaceSettingsDashboard.vue'

export default {
  name: 'OrgSettings',

  components: {
    WorkspaceSettingsDashboard
  }
}
</script>

<style lang="scss" scoped>
/* Styles are now contained within WorkspaceSettingsDashboard and its child components */
</style>
