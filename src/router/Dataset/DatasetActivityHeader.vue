<script setup>
import { useRoute } from "vue-router";
let route = useRoute();
</script>

<template >
  <locked-banner slot="banner" />

  <bf-rafter slot="heading">

    <template #heading>
      <h1
        class="flex-heading"
      >
        {{pageName}}
      </h1>
    </template>

    <template #tabs>
      <ul
        slot="tabs"
        class="tabs unstyled"
      >
        <li
          v-for="tab in tabs"
          :key="tab.route.name"
        >
          <router-link :to="tab.route">
            {{ tab.label }}
          </router-link>
        </li>
      </ul>
    </template>

  </bf-rafter>
</template>



<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";


export default {
  name: 'DatasetActivityHeader',
  components: {
    BfRafter,
    IconArrowLeft,
    LockedBanner
  },
  computed: {

    /**
     * Compute publishing tab based on user's publisher role
     * @returns {Array}
     */
    tabs: function() {
      return [
        {
          route: {
            name: 'activity-log',
          },
          label: 'Activity Log',
        },
        {
          route: {
            name: 'upload-manifests',
          },
          label: 'Upload Manifests',
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
@import '../../assets/_variables.scss';

.link-to-files {
  color: $white;
}
</style>
