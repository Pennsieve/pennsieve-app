<template>
  <bf-page>
    <bf-rafter
      slot="heading"
      class="primary"
    >
      <template #breadcrumb>
        <org-breadcrumb
          page-name="Settings"
          :crumbs="breadcrumbCrumbs"
          :page-route="{ name: 'workspace-settings-overview' }"
        />
      </template>
    </bf-rafter>
    <router-view name="stage" />
  </bf-page>
</template>

<script>
import BfRafter from '@/components/shared/bf-rafter/BfRafter.vue'
import OrgBreadcrumb from '@/components/shared/OrgBreadcrumb/OrgBreadcrumb.vue'

export default {
  name: 'BfSettings',

  components: {
    BfRafter,
    OrgBreadcrumb
  },

  computed: {
    breadcrumbCrumbs() {
      const routeTitles = {
        'workspace-general': 'General Settings',
        'workspace-dataset-statuses': 'Dataset Statuses',
        'workspace-data-use-agreements': 'Data Use Agreements',
        'workspace-usage-analytics': 'Usage Analytics',
        'workspace-storage-nodes': 'Storage Nodes',
      }
      const subPageTitle = routeTitles[this.$route.name]
      if (subPageTitle) {
        return [{ name: subPageTitle }]
      }
      return []
    }
  }
}
</script>
