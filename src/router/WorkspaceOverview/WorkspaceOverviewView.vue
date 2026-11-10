<template>
  <bf-page id="page">
    <!-- As every page: the breadcrumb as the title (Workspace / Insights) -->
    <template #heading>
      <bf-rafter class="primary" :org-id="orgId">
        <template #breadcrumb>
          <org-breadcrumb page-name="Insights" />
        </template>
      </bf-rafter>
    </template>
    <template #stage>
      <WorkspaceOverview :org-id="orgId" />
    </template>
  </bf-page>
</template>

<script>
import BfPage from '@/components/layout/BfPage/BfPage.vue'
import BfRafter from '@/components/shared/bf-rafter/BfRafter.vue'
import OrgBreadcrumb from '@/components/shared/OrgBreadcrumb/OrgBreadcrumb.vue'
import WorkspaceOverview from '@/components/WorkspaceOverview/WorkspaceOverview.vue'

export default {
  name: 'WorkspaceOverviewView',
  components: { BfPage, BfRafter, OrgBreadcrumb, WorkspaceOverview },
  props: {
    orgId: { type: String, default: '' },
  },
}
</script>
