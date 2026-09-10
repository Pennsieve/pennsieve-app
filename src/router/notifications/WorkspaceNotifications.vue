<template>
  <bf-page class="bf-workspace-notifications">
    <template #heading>
      <bf-rafter
        class="primary"
        :org-id="orgId"
      >
        <template #breadcrumb>
          <org-breadcrumb page-name="Notifications" />
        </template>
      </bf-rafter>
    </template>

    <template #stage>
      <router-view name="stage" />
    </template>
  </bf-page>
</template>

<script>
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";

export default {
  name: 'WorkspaceNotifications',
  components: {
    BfRafter,
    OrgBreadcrumb
  },
  props: {
    orgId: {
      type: String,
      default: ''
    }
  }
}
</script>
