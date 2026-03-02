<template>
  <div class="workspace-settings-dashboard">
    <!-- Show dashboard cards - child routes will be handled by parent router-view -->
    <div class="dashboard-grid">
      <workspace-settings-card
        title="General Settings"
        description="Configure workspace name, appearance, and basic settings"
        :route="{ name: 'workspace-general' }"
        icon="settings"
      />

      <workspace-settings-card
        title="Dataset Statuses"
        description="Manage custom workflow statuses for datasets"
        :route="{ name: 'workspace-dataset-statuses' }"
        icon="dataset-status"
      />

      <workspace-settings-card
        title="Data Use Agreements"
        description="Manage data use agreements and compliance settings"
        :route="{ name: 'workspace-data-use-agreements' }"
        icon="security"
      />

<!--      <workspace-settings-card-->
<!--        title="Usage Analytics"-->
<!--        description="View storage usage and workspace activity metrics"-->
<!--        :route="{ name: 'workspace-usage-analytics' }"-->
<!--        icon="analytics"-->
<!--      />-->

      <workspace-settings-card
        title="Compute Nodes"
        description="Manage compute nodes and analysis infrastructure"
        :route="{ name: 'compute-nodes' }"
        icon="compute"
      />

<!--      <workspace-settings-card-->
<!--        title="Advanced Settings"-->
<!--        description="Backup, export, and other advanced configuration options"-->
<!--        :coming-soon="true"-->
<!--        icon="database"-->
<!--      />-->
    </div>
  </div>
</template>

<script>
import WorkspaceSettingsCard from './WorkspaceSettingsCard.vue'

export default {
  name: 'WorkspaceSettingsDashboard',

  components: {
    WorkspaceSettingsCard
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.workspace-settings-dashboard {
  max-width: 1200px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  margin: 32px;
  
  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}
</style>