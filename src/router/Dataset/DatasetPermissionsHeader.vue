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
  name: 'DatasetPermissionsHeader',
  components: {
    BfRafter,
    IconArrowLeft,
    LockedBanner,
    RouterTabs
  },
  computed: {

    /**
     * Compute publishing tab based on user's publisher role
     * @returns {Array}
     */
    tabs: function() {
      return [
        {
          name: 'User Permissions',
          to:  'user-permissions'
        },
        {
          to: 'embargo-permissions',
          name: 'Embargo Permissions',
        },
      ]
    },
    pageName: function() {
      const r = useRoute()

      switch (r.name) {
        case "user-permissions":
          return "Dataset Permissions"
        case "embargo-permissions":
          return "Dataset Permissions"
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
