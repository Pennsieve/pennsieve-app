<template>
  <bf-page class="bf-people-list">
    <template #heading>
      <bf-rafter
        class="primary"
        :org-id="orgId"
      >
        <template #breadcrumb>
          <org-breadcrumb page-name="People" />
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
  name: 'BfPeople',
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


}
</script>
