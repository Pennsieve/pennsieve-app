<template >
  <bf-rafter
    class="primary"
  >
    <template #breadcrumb>
      <org-breadcrumb page-name="Datasets" />
    </template>
  </bf-rafter>
</template>

<script>
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../components/shared/OrgBreadcrumb/OrgBreadcrumb.vue";

export default {
  name: 'DatasetListHeader',
  components: {
    OrgBreadcrumb,
    BfRafter
  },
}
</script>
