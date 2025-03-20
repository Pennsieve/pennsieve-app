<script setup>
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import BfRafter from "../../components/shared/bf-rafter/BfRafter.vue";
import IconArrowLeft from "../../components/icons/IconArrowLeft.vue";
import LockedBanner from "../../components/datasets/LockedBanner/LockedBanner.vue";
import { getPreviousCollection } from "../index.js"; 

const route = useRoute();
const router = useRouter();

function backToFiles(){
    const { datasetId } = route.params;
  const previousCollection = getPreviousCollection(); // ✅ Get stored collection ID

  if (previousCollection) {
    router.push({
      name: "collection-files",
      params: { datasetId, fileId: previousCollection },
    });
  } else {
    router.push({
      name: "dataset-files",
      params: { datasetId },
    });
  }
}

</script>

<template>
  <locked-banner slot="banner" />

  <bf-rafter slot="heading">
    <template #breadcrumb v-if="route.meta.showBackToFiles">
      <a @click="backToFiles()" class="link-to-files">
        <IconArrowLeft :height="10" :width="10" />
        Back to Files
      </a>
    </template>

    <template #heading>
      <div class="title-wrapper">
        <h1 class="flex-heading">
          Files
        </h1>
      </div>
    </template>
  </bf-rafter>
</template>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.flex-heading {
  background-color: $purple_1;
}

.el-collapse-item__header {
  background: $purple_2;
}

.link-to-files {
  color: $white;
  cursor: pointer;
}
</style>