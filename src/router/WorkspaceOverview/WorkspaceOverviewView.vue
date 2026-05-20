<template>
  <bf-page id="page">
    <template #stage>
      <WorkspaceOverview :org-id="orgId" />
    </template>
  </bf-page>
</template>

<script>
import BfPage from '@/components/layout/BfPage/BfPage.vue'
import WorkspaceOverview from '@/components/WorkspaceOverview/WorkspaceOverview.vue'

export default {
  name: 'WorkspaceOverviewView',
  components: { BfPage, WorkspaceOverview },
  props: {
    orgId: { type: String, default: '' },
  },
}
</script>
