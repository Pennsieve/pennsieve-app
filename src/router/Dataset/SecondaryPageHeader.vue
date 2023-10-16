<script setup>
import { useRoute } from "vue-router";
let route = useRoute();
</script>

<template >
  <bf-rafter slot="heading">
    <template #banner>
      <locked-banner slot="banner" />
    </template>

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
        <IconLockFilled
          v-if="datasetLocked"
          class="mr-8"
          color="#71747C"
          :height="24"
          :width="24"
        />{{pageName}}
      </h1>
    </template>
  </bf-rafter>
</template>



<script>

import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import {mapGetters, mapState} from "vuex";
import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";


export default {
  name: 'SecondaryPageHeader',
  components: {
    BfRafter,
    IconArrowLeft
  },
  computed: {
    ...mapGetters([
      'datasetLocked'
    ]),
    pageName: function() {
      const r = useRoute()

      switch (r.name) {
        case "dataset-settings":
          return "Dataset Settings"
        case "dataset-files":
          return "Files"
        case "file-record":
          return "File Details"

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
