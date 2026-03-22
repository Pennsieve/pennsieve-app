<template>
  <bf-page class="bf-people-list">
    <template #heading>
      <bf-rafter
        slot="heading"
        class="primary"
        :org-id="orgId"
      >
        <template #breadcrumb>
          <org-breadcrumb
            page-name="Teams"
            :sub-page-name="currentSubPage"
            :page-route="currentSubPage ? { name: 'teams-list' } : null"
          />
        </template>
      </bf-rafter>
      <router-view name="stage" />
    </template>
  </bf-page>
</template>

<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";

export default {
  name: 'BfTeams',
  components: {
    BfRafter,
    OrgBreadcrumb
  },
  // From Router
  props: {
    orgId: {
      type: String,
      default: ''
    },
    datasetId: {
      type: String,
      default: ''
    }
  },

  computed: {
    currentSubPage() {
      if (this.$route.name === 'team-members-list') {
        return 'Team Members'
      }
      return ''
    }
  }
}
</script>
