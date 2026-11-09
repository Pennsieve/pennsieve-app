<template>
  <bf-stage slot="stage">
    <!-- The dataset's actions, on the right of the page's title row as an
         app's or workflow's (MyWorkSpacePage: OrgBreadcrumb), on every tab.
         Opening it in a notebook is the main one. -->
    <Teleport v-if="dataset && (dataset.doi || canOpenNotebook)" defer to="#page-title-actions">
      <div class="header-actions">
        <bf-button v-if="dataset.doi" class="compact flex secondary" @click="showAddToCollection = true">
          Add to Collection
        </bf-button>
        <bf-button v-if="canOpenNotebook" class="compact flex" @click="router.push(notebookRoute(dataset))">
          Open in notebook
        </bf-button>
      </div>
    </Teleport>

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

    <add-to-collection-dialog
      v-if="dataset?.doi"
      v-model:visible="showAddToCollection"
      :doi="dataset.doi"
      :dataset-name="dataset.name"
    />
  </bf-stage>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import BfStage from "@/components/layout/BfStage/BfStage.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import AddToCollectionDialog from "./AddToCollectionDialog.vue";
import { viewsServiceUrl } from "@/utils/viewsService";
import { notebookRoute } from "@/utils/publicDatasets";

const route = useRoute();
const router = useRouter();
const store = useReadOnlyDatasetStore();

// The dataset shown, once loaded (none while loading or when it failed).
const dataset = computed(() => (store.isLoadingCurrent || store.currentError ? null : store.current));
const showAddToCollection = ref(false);
// A notebook takes a published version as a view of it (views-service), so
// only where the site has one. The notebook launcher in My Workspace opens
// on this version, its data already chosen.
const canOpenNotebook = computed(
  () => !!viewsServiceUrl() && (dataset.value?.sourceType || "discover") === "discover"
);

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

// Teleported into the page's title row, still this component's scoped
// styles.
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

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
