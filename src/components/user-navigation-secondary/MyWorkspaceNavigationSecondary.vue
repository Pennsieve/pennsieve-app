<template>
  <!-- My Workspace's secondary nav: My Analysis's sections, as a
       workspace's Analysis; else a public dataset's. The route's props (a
       dataset's id) pass through. -->
  <AnalysisNavigationSecondary v-if="inAnalysis" />
  <PublicDatasetNavigation v-else v-bind="$attrs" />
</template>

<script>
import { defineAsyncComponent } from "vue";

export default {
  name: "MyWorkspaceNavigationSecondary",
  components: {
    AnalysisNavigationSecondary: defineAsyncComponent(() => import("../bf-navigation/AnalysisNavigationSecondary.vue")),
    PublicDatasetNavigation: defineAsyncComponent(() => import("../datasets/PublicDataset/PublicDatasetNavigation.vue")),
  },
  inheritAttrs: false,
  computed: {
    inAnalysis() {
      return this.$route.matched.some((r) => r.name === "my-analysis");
    },
  },
};
</script>
