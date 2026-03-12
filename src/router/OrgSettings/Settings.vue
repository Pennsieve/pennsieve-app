<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      :title="pageTitle"
      class="primary"
      :compact="true"
    >
      <template #breadcrumb>
        <div class="breadcrumb-nav">
          <!-- Root workspace link -->
          <router-link :to="{ name: 'datasets-list' }" class="breadcrumb-link">
            {{ workspaceName }}
          </router-link>

          <!-- Settings link if on sub-page -->
          <template v-if="isSettingsSubPage">
            <span class="breadcrumb-separator">/</span>
            <router-link :to="{ name: 'workspace-settings-overview' }" class="breadcrumb-link">
              Settings
            </router-link>
          </template>

          <!-- Compute Nodes link if on node detail page -->
          <template v-if="isComputeNodeDetail">
            <span class="breadcrumb-separator">/</span>
            <router-link :to="{ name: 'compute-nodes' }" class="breadcrumb-link">
              Compute Nodes
            </router-link>
          </template>

          <!-- Current page (non-clickable) -->
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ currentPageTitle }}</span>
        </div>
      </template>
      <template #description>
        <p>{{ pageDescription }}</p>
      </template>
    </bf-rafter>
    <router-view name="stage" />
  </bf-page>
</template>

<script>
import BfRafter from '@/components/shared/bf-rafter/BfRafter.vue'
import { mapState } from 'vuex'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'

export default {
  name: 'BfSettings',

  components: {
    BfRafter
  },

  computed: {
    ...mapState([
      'activeOrganization'
    ]),

    pageTitle() {
      if (this.isComputeNodeDetail) {
        return this.currentPageTitle
      }
      return 'Workspace Settings'
    },

    pageDescription() {
      const descriptions = {
        'workspace-settings-overview': 'Manage your workspace configuration, integrations, and team settings.',
        'workspace-general': 'Configure workspace name, appearance, and basic settings.',
        'workspace-dataset-statuses': 'Manage custom workflow statuses for datasets.',
        'workspace-data-use-agreements': 'Manage data use agreements and compliance settings.',
        'workspace-usage-analytics': 'View storage usage and workspace activity metrics.',
        'compute-nodes': 'Manage compute nodes and analysis infrastructure.',
        'compute-node-management': 'Manage compute node details, permissions, and secrets.'
      }
      return descriptions[this.$route.name] || 'Manage your workspace configuration, integrations, and team settings.'
    },

    workspaceName() {
      return this.activeOrganization?.organization?.name || 'Workspace'
    },

    currentPageTitle() {
      if (this.isComputeNodeDetail) {
        const computeResourcesStore = useComputeResourcesStore()
        const nodeId = this.$route.params.nodeId
        for (const [, nodes] of computeResourcesStore.scopedComputeNodes.entries()) {
          const node = nodes.find(n => n.uuid === nodeId)
          if (node) return node.name
        }
        return 'Compute Node'
      }
      const routeTitles = {
        'workspace-settings-overview': 'Settings',
        'workspace-general': 'General Settings',
        'workspace-dataset-statuses': 'Dataset Statuses',
        'workspace-data-use-agreements': 'Data Use Agreements',
        'workspace-usage-analytics': 'Usage Analytics',
        'compute-nodes': 'Compute Resources'
      }
      return routeTitles[this.$route.name] || 'Settings'
    },

    isComputeNodeDetail() {
      return this.$route.name === 'compute-node-management'
    },

    isSettingsSubPage() {
      const subPages = [
        'workspace-general',
        'workspace-dataset-statuses',
        'workspace-data-use-agreements',
        'workspace-usage-analytics',
        'compute-nodes',
        'compute-node-management'
      ]
      return subPages.includes(this.$route.name)
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.breadcrumb-nav {
  display: flex;
  align-items: center;
  font-size: 14px;

  .breadcrumb-link {
    color: theme.$gray_4;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .breadcrumb-separator {
    margin: 0 8px;
    color: #71767C;
  }

  .breadcrumb-current {
    color: #000;
    font-weight: 500;
  }
}
</style>
