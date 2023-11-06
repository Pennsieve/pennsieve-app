<script setup>
import { useRoute } from "vue-router";
let route = useRoute();
</script>

<template >
  <locked-banner slot="banner" />

  <bf-rafter slot="heading">

    <template #breadcrumb v-if="route.meta.showBackToFiles">
      <a @click="$router.go(-1)" class="link-to-files">
        <IconArrowLeft
          :height="10"
          :width="10"
        />
        Back to Files
      </a>

    </template>

    <template #heading>
      <h1
        class="flex-heading"
      >
        {{pageName}}
      </h1>
    </template>
  </bf-rafter>
</template>



<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";


export default {
  name: 'SecondaryPageHeader',
  components: {
    BfRafter,
    IconArrowLeft,
    LockedBanner
  },
  computed: {

    pageName: function() {
      const r = useRoute()
      console.log(r)

      switch (r.name) {
        case "dataset-settings":
          return "Dataset Settings"
        case "dataset-files":
          return "Files"
        case "file-record":
          return "File Details"
        case "publishing-settings":
          return "Dataset Publishing"
        case "dataset-activity":
          return "Dataset Activity"
        case "integrations-settings":
          return "Dataset Integrations"


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
