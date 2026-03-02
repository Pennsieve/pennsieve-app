<template>
  <bf-page>
    <bf-rafter 
      slot="heading" 
      :title="pageTitle" 
      class="primary" 
      :compact="true"
    >
      <template #breadcrumb>
        <div class="breadcrumb-nav" v-if="showBreadcrumb">
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
          
          <!-- Current page (non-clickable) -->
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ currentPageTitle }}</span>
        </div>
      </template>
      <template #description>
        <p>{{ pageDescription }}</p>
      </template>
      <template v-if="showTabs" #tabs>
        <router-tabs :tabs="tabs" />
      </template>
    </bf-rafter>
    <router-view name="stage" />
  </bf-page>
</template>

<script>
import BfRafter from '@/components/shared/bf-rafter/BfRafter.vue'
import RouterTabs from '@/components/shared/routerTabs/routerTabs.vue'
import { mapState } from 'vuex'

export default {
  name: 'BfSettings',
  
  components: {
    BfRafter,
    RouterTabs
  },

  computed: {
    ...mapState([
      'activeOrganization'
    ]),
    
    pageTitle() {
      return 'Workspace Settings'
    },
    
    pageDescription() {
      const descriptions = {
        'workspace-settings-overview': 'Manage your workspace configuration, integrations, and team settings.',
        'workspace-general': 'Configure workspace name, appearance, and basic settings.',
        'workspace-dataset-statuses': 'Manage custom workflow statuses for datasets.',
        'workspace-data-use-agreements': 'Manage data use agreements and compliance settings.',
        'workspace-usage-analytics': 'View storage usage and workspace activity metrics.',
        'compute-nodes': 'Manage compute nodes and analysis infrastructure.'
      }
      return descriptions[this.$route.name] || 'Manage your workspace configuration, integrations, and team settings.'
    },
    
    workspaceName() {
      return this.activeOrganization?.organization?.name || 'Workspace'
    },
    
    showBreadcrumb() {
      // Always show breadcrumb for consistency
      return true
    },
    
    currentPageTitle() {
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
    
    isSettingsSubPage() {
      const subPages = [
        'workspace-general',
        'workspace-dataset-statuses', 
        'workspace-data-use-agreements',
        'workspace-usage-analytics',
        'compute-nodes'
      ]
      return subPages.includes(this.$route.name)
    },
    
    showTabs() {
      // Show tabs on sub-pages
      return this.isSettingsSubPage
    },
    
    tabs() {
      if (this.isSettingsSubPage) {
        return [
          {
            to: 'workspace-general',
            name: 'General'
          },
          {
            to: 'workspace-dataset-statuses',
            name: 'Dataset Statuses'
          },
          {
            to: 'workspace-data-use-agreements',
            name: 'Data Use Agreements'
          },
          {
            to: 'compute-nodes',
            name: 'Compute'
          }
        ]
      }
      return []
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
