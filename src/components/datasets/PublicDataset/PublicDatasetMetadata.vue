<template>
  <div class="public-dataset-metadata">
    <div class="section-header">
      <h2>Models</h2>
      <p class="section-description">
        Metadata models published with this dataset. Records are queried directly
        from the dataset's files — read-only.
      </p>
    </div>

    <div v-if="isLoading" class="state" v-loading="true">
      <p>Loading models...</p>
    </div>

    <div v-else-if="error" class="state">
      <h3>Unable to load metadata</h3>
      <p>Something went wrong reading this dataset's models.</p>
    </div>

    <div v-else-if="models.length === 0" class="state">
      <h3>No models</h3>
      <p>This dataset has no published metadata models.</p>
    </div>

    <div v-else class="model-grid">
      <button
        v-for="model in models"
        :key="model.name"
        class="model-card"
        @click="openModel(model)"
      >
        <div class="model-info">
          <h3 class="model-name">{{ model.displayName }}</h3>
          <p class="model-meta">
            {{ model.propertyCount }} {{ model.propertyCount === 1 ? "property" : "properties" }}
          </p>
        </div>
        <IconArrowRight :width="16" :height="16" color="currentColor" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import IconArrowRight from "@/components/icons/IconArrowRight.vue";

const props = defineProps({
  dataset: {
    type: Object,
    required: true,
  },
});

const store = useReadOnlyDatasetStore();
const router = useRouter();

const models = ref([]);
const isLoading = ref(false);
const error = ref(false);

const datasetId = computed(() => props.dataset.id);

const load = async () => {
  isLoading.value = true;
  error.value = false;
  try {
    models.value = await store.listModels(props.dataset.id, props.dataset.version);
  } catch (e) {
    console.error("Error loading models:", e);
    error.value = true;
    models.value = [];
  } finally {
    isLoading.value = false;
  }
};

const openModel = (model) => {
  router.push({
    name: "public-dataset-records",
    params: { datasetId: datasetId.value, model: model.name },
  });
};

onMounted(load);
watch(() => props.dataset.id, load);
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.section-header {
  margin-bottom: 24px;

  h2 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .section-description {
    font-size: 14px;
    color: theme.$gray_4;
    margin: 0;
    max-width: 600px;
  }
}

.state {
  padding: 32px 24px;
  text-align: center;
  color: theme.$gray_4;

  h3 {
    color: theme.$gray_5;
    font-weight: 300;
    margin: 0 0 8px 0;
  }
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.model-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  text-align: left;
  padding: 20px;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  cursor: pointer;
  color: theme.$gray_4;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_1;
  }
}

.model-name {
  font-size: 16px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0 0 4px 0;
}

.model-meta {
  font-size: 12px;
  color: theme.$gray_4;
  margin: 0;
}
</style>
