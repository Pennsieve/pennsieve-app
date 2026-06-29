<template>
  <bf-stage slot="stage">
    <div class="public-dataset-detail">
      <div v-if="store.isLoadingCurrent" class="state" v-loading="true">
        <p>Loading dataset...</p>
      </div>

      <div v-else-if="store.currentError || !store.current" class="state">
        <h3>Unable to load this dataset</h3>
        <p>The dataset may not exist or is no longer public.</p>
      </div>

      <router-view
        v-else
        :key="`${datasetId}-${store.current.version}`"
        :dataset="store.current"
      />
    </div>
  </bf-stage>
</template>

<script setup>
import { computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import BfStage from "@/components/layout/BfStage/BfStage.vue";

const route = useRoute();
const store = useReadOnlyDatasetStore();

const datasetId = computed(() => route.params.datasetId);
// Optional ?version=N — defaults to latest when absent.
const version = computed(() => route.query.version || null);

const load = () => {
  if (datasetId.value) {
    store.fetchDataset(datasetId.value, version.value, "discover");
    store.fetchVersions(datasetId.value, "discover");
  }
};

onMounted(load);
watch([datasetId, version], load);
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.public-dataset-detail {
  padding: 16px 0;
}

.state {
  padding: 48px 24px;
  text-align: center;
  color: theme.$gray_4;

  h3 {
    color: theme.$gray_5;
    font-weight: 300;
    margin: 0 0 8px 0;
  }
}
</style>
