<template>
  <bf-page class="bf-downloads">
    <template #heading>
      <bf-rafter class="primary" :org-id="orgId">
        <template #breadcrumb>
          <org-breadcrumb page-name="Downloads" />
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
  name: "BfDownloads",
  components: {
    BfRafter,
    OrgBreadcrumb,
  },
  // From Router
  props: {
    orgId: {
      type: String,
      default: "",
    },
  },
};
</script>
