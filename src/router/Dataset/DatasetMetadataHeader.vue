<script setup>
import { useRoute } from "vue-router";
let route = useRoute();
</script>

<template >
  <div>
    <locked-banner slot="banner" />

    <bf-rafter slot="heading" :link-back=route.meta.backLink :dataset-id="datasetId" :org-id="orgId">


      <template #heading>
        <h1
          class="flex-heading"
        >
          {{pageName}}
        </h1>
      </template>

      <template v-if="hasTabs" #tabs>
        <RouterTabs :tabs="tabs" class="secondary"/>
      </template>

    </bf-rafter>
  </div>

</template>



<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";
import RouterTabs from "../../components/shared/routerTabs/routerTabs.vue";


export default {
  name: 'DatasetMetadataHeader',
  components: {
    BfRafter,
    IconArrowLeft,
    LockedBanner,
    RouterTabs
  },
  props: {
    orgId: {
      type: String,
      default: ''
    },
    datasetId: {
      type: String,
      default: ''
    },
    modelId: {
      type: String,
      default: ''
    },
    instanceId: {
      type: String,
      default: ''
    }
  },
  computed: {

    /**
     * Compute publishing tab based on user's publisher role
     * @returns {Array}
     */
    tabs: function() {
      return [
        {
          to: 'graph',
          name: 'Schema',
        },
        {
          to: 'records',
          name: 'Records',
        },

      ]
    },
    /*
    Don't show tabs in the model-record detail page.
     */
    hasTabs: function() {
      return !this.instanceId
    },
    pageName: function() {
      const r = useRoute()

      switch (r.name) {
        case "records":
          return "Metadata Records"
        case "graph":
          return "Metadata Graph"
        case "metadata-record":
          return "Metadata Record"

      }
      return "Unknown"
    }
  }

}
</script>

<style lang="scss">
@use '../../styles/theme';

.link-to-files {
  color: theme.$white;
}
</style>
