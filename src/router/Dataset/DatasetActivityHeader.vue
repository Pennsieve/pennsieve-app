<script setup>
import { useRoute } from "vue-router";
let route = useRoute();
</script>

<template >
  <locked-banner slot="banner" />

  <bf-rafter slot="heading" :breadcrumbs="breadcrumbs">
    <template #tabs>
      <router-tabs :tabs="tabs" class="secondary"/>
    </template>
  </bf-rafter>
</template>



<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";


export default {
  name: 'DatasetActivityHeader',
  components: {
    BfRafter,
    IconArrowLeft,
    LockedBanner,
    RouterTabs
  },
  computed: {
    /**
     * Compute breadcrumbs based on current route
     * @returns {Array}
     */
    breadcrumbs: function() {
      return this.$route.meta.breadcrumbs || []
    },

    /**
     * Compute publishing tab based on user's publisher role
     * @returns {Array}
     */
    tabs: function() {
      return [
        {
          to: 'activity-log',
          name: 'Activity Log',
        },
        {
          to: 'upload-manifests',
          name: 'Upload Manifests',
        },
      ]
    },
    pageName: function() {
      const r = useRoute()

      switch (r.name) {
        case "activity-log":
          return "Activity"
        case "upload-manifests":
          return "Activity"
      }
      return "Unknown"
    }
  }

}
</script>

<style scoped lang="scss">
@use '../../styles/theme';

.link-to-files {
  color: theme.$white;
}
</style>
