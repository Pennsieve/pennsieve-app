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
  name: 'DatasetMetadataHeader',
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
            name: 'records',
          },
          label: 'Records',
        },
        {
          route: {
            name: 'models',
          },
          label: 'Models',
        },
        {
          route: {
            name: 'relationships',
          },
          label: 'relationships',
        },
        {
          route: {
            name: 'graph',
          },
          label: 'graph',
        },
      ]
    },
    pageName: function() {
      const r = useRoute()

      switch (r.name) {
        case "records":
          return "Metadata Records"
        case "models":
          return "Metadata Models"
        case "relationships":
          return "Metadata Relationships"
        case "graph":
          return "Metadata Graph"
      }
      return "Unknown"
    }
  }

}
</script>

<style lang="scss">
@import '../../assets/_variables.scss';

.link-to-files {
  color: $white;
}
</style>
