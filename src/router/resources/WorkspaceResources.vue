<template>
  <bf-page class="bf-workspace-resources">
    <template #heading>
      <bf-rafter
        class="primary"
        :org-id="orgId"
      >
        <template #breadcrumb>
          <org-breadcrumb page-name="Resources" />
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
  name: 'WorkspaceResources',
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
