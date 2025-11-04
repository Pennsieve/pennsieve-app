<template>
  <div class="collection-details">
    <div v-if="isLoading" class="loading-state">
      <div class="loading-content">
        <div class="loader-header"></div>
        <div class="loader-description"></div>
        <div class="loader-datasets">
          <div v-for="n in 3" :key="n" class="loader-dataset"></div>
        </div>
      </div>
    </div>

    <div v-else-if="collection && collection.id" class="collection-content">
      <!-- Collection Header -->
      <div class="discover-content container-fluid">
        <collection-header
          :collection-details="collection"
          :collection-contributors="collectionContributors"
          :last-updated-date="lastUpdatedDate"
          :collection-description="collectionDescription"
          @open-edit-dialog="showEditDialog = true"
          @open-dataset-finder="showDatasetFinder = true"
          @publish-collection="showPublishDialog = true"
        />
      </div>

      <!-- Collection Datasets -->
      <div class="discover-content container-fluid">
        <h3 class="discover-content-title">Collection Datasets</h3>

        <div v-if="datasetList && datasetList.length > 0" class="datasets-list">
          <dataset-card-collections
            v-for="dataset in datasetList"
            :key="dataset.data ? dataset.data.doi : dataset.doi"
            class="mb-16"
            :dataset="dataset.data || dataset"
          />
        </div>

        <div v-else class="no-datasets">
          <h5>This collection has no datasets associated with it.</h5>
          <bf-button class="secondary" @click="showDatasetFinder = true">
            Add Datasets
          </bf-button>
        </div>
      </div>

      <!-- Collection Info Section -->
      <!--      <div class="dataset-info">-->
      <!--        <div class="discover-content container-fluid dataset-info-container">-->
      <!--          <div class="row">-->
      <!--            <div class="col-xs-12">-->
      <!--              <h2>About this collection</h2>-->
      <!--            </div>-->
      <!--          </div>-->
      <!--          -->
      <!--          <div class="row">-->
      <!--            <div class="col-xs-12">-->
      <!--              <h3>Publishing history</h3>-->
      <!--            </div>-->
      <!--          </div>-->
      <!--          -->
      <!--          <div class="row mb-24">-->
      <!--            <div class="col-xs-12 info-publishing-history">-->
      <!--              <div class="info-text">-->
      <!--                <div class="info-text-caps">Originally Published</div>-->
      <!--                <div>{{ originallyPublishedDate }}</div>-->
      <!--              </div>-->
      <!--              <div class="info-text">-->
      <!--                <div class="info-text-caps">Last Updated</div>-->
      <!--                <div>{{ lastUpdatedDate }}</div>-->
      <!--              </div>-->
      <!--            </div>-->
      <!--          </div>-->
      <!--          -->
      <!--          <div class="row share-collection">-->
      <!--            <div class="col-xs-12">-->
      <!--              <h3>Share this collection</h3>-->
      <!--            </div>-->
      <!--          </div>-->
      <!--          -->
      <!--          <div class="row mb-24">-->
      <!--            <div class="col-xs-12">-->
      <!--              <div class="info-icons">-->
      <!--                <button-->
      <!--                  @click="onClickCopy"-->
      <!--                  title="Copy URL to clipboard"-->
      <!--                  class="copy-button"-->
      <!--                >-->
      <!--                  <IconLink-->
      <!--                    title="Copy To Clipboard Icon"-->
      <!--                    class="icon-upload"-->
      <!--                    :height="18"-->
      <!--                    :width="18"-->
      <!--                  />-->
      <!--                </button>-->
      <!--                <span v-if="showCopySuccess" class="copy-success-notification">-->
      <!--                  Link copied to clipboard!-->
      <!--                </span>-->
      <!--              </div>-->
      <!--            </div>-->
      <!--          </div>-->
      <!--          -->
      <!--          <div v-if="datasetTags && datasetTags.length > 0" class="row">-->
      <!--            <div class="col-xs-12">-->
      <!--              <h3>Tags</h3>-->
      <!--              <div class="tags-list">-->
      <!--                <span v-for="tag in datasetTags" :key="tag" class="tag">-->
      <!--                  {{ tag }}-->
      <!--                </span>-->
      <!--              </div>-->
      <!--            </div>-->
      <!--          </div>-->
      <!--        </div>-->
      <!--      </div>-->
    </div>

    <div v-else class="error-state">
      <h3>Collection not found</h3>
      <p>
        The collection you're looking for doesn't exist or has been removed.
      </p>
      <button class="btn-back" @click="goToCollections">
        Back to Collections
      </button>
    </div>

    <!-- Dataset Finder Dialog -->
    <dataset-finder-dialog
      :visible="showDatasetFinder"
      :collection-id="collectionId"
      :current-datasets="datasetList"
      @close="showDatasetFinder = false"
      @datasets-updated="onDatasetsUpdated"
      @error="onDatasetFinderError"
    />

    <!-- Publish Collection Dialog -->
    <publish-collection-dialog
      v-if="showPublishDialog"
      :collection-details="collection"
      @close="showPublishDialog = false"
    />

    <!-- Edit Collection Dialog -->
    <edit-collection-dialog
      v-if="showEditDialog"
      :collection-details="collection"
      @close="showEditDialog = false"
      @collection-updated="onCollectionUpdated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import * as siteConfig from "@/site-config/site.json";
import { useCollectionsStore } from "@/stores/collectionStore";

// Child components (keep your existing imports in <script> or move them here)
import CollectionHeader from "./CollectionHeader.vue";
import DatasetCardCollections from "./DatasetCardCollections.vue";
import DatasetFinderDialog from "./DatasetFinderDialog.vue";
import PublishCollectionDialog from "./PublishCollectionDialog.vue";
import EditCollectionDialog from "./EditCollectionDialog.vue";
import ContributorItem from "./ContributorItem.vue";
import IconLink from "../../icons/IconLink.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

// ---------- props ----------
const props = defineProps<{
  collectionId: string | number;
}>();

// ---------- router / store ----------
const router = useRouter();
const store = useCollectionsStore();

// ---------- state ----------
const collection = ref<any>(null);
const datasetList = computed(() => collection.value?.datasets);
const isLoading = ref(false);
const showCopySuccess = ref(false);
const showDatasetFinder = ref(false);
const showPublishDialog = ref(false);
const showEditDialog = ref(false);

// ---------- computed (parity with Options API) ----------
const collectionDescription = computed(
  () => collection.value?.description || ""
);

const originallyPublishedDate = computed(() => {
  const date =
    collection.value?.firstPublishedAt || collection.value?.createdAt;
  return formatDate(date);
});

const lastUpdatedDate = computed(() => {
  const date =
    collection.value?.revisedAt ||
    collection.value?.versionPublishedAt ||
    collection.value?.updatedAt;
  return formatDate(date);
});

const datasetTags = computed<string[]>(() => collection.value?.tags || []);

const siteUrl = computed(() => {
  const id = collection.value?.id ?? props.collectionId;
  return `${siteConfig.discoverAppUrl}/collections/${id}`;
});

const collectionContributors = computed(() => {
  // Get derivedContributors from the collection data
  const contributors =
    collection.value?.contributors ||
    collection.value?.derivedContributors ||
    [];

  // Remove duplicates based on ORCID (if present) or name combination
  const uniqueContributors = contributors.reduce(
    (unique: any[], contributor: any) => {
      const existing = unique.find((c) => {
        // If both have ORCID, use that for comparison
        if (c.orcid && contributor.orcid) {
          return c.orcid === contributor.orcid;
        }
        // Otherwise, compare by name
        return (
          c.firstName === contributor.firstName &&
          c.lastName === contributor.lastName &&
          c.middleInitial === contributor.middleInitial
        );
      });

      if (!existing) {
        unique.push(contributor);
      }

      return unique;
    },
    []
  );

  return uniqueContributors;
});

// ---------- effects ----------
onMounted(() => {
  getCollectionDetails();
});

watch(
  () => props.collectionId,
  () => {
    getCollectionDetails();
  }
);

watch(showCopySuccess, (v) => {
  if (v) {
    setTimeout(() => (showCopySuccess.value = false), 3000);
  }
});

// ---------- actions ----------
async function getCollectionDetails() {
  isLoading.value = true;
  try {
    const resp = await store.getCollectionDetails(props.collectionId as string);
    collection.value = resp;
  } catch (err) {
    console.error("Error fetching collection details:", err);
    collection.value = null;
  } finally {
    isLoading.value = false;
  }
}

function formatDate(dateString?: string) {
  if (!dateString) return "Unknown";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function onClickCopy() {
  navigator.clipboard.writeText(siteUrl.value);
  showCopySuccess.value = true;
}

function goToCollections() {
  router.push({ name: "my-collections" });
}

function onDatasetsUpdated(changes: { added?: any[]; removed?: any[] }) {
  // Refresh the collection details to reflect updates
  getCollectionDetails();

  const { added = [], removed = [] } = changes || {};
  if (added.length || removed.length) {
    const msg = [
      added.length ? `added ${added.length}` : "",
      removed.length ? `removed ${removed.length}` : "",
    ]
      .filter(Boolean)
      .join(" and ");
  }
}

function onDatasetFinderError(errorMessage: string) {
  console.error("Dataset finder error:", errorMessage);
}

function onCollectionUpdated(updated: any) {
  if (collection.value && updated) {
    collection.value.name = updated.name;
    collection.value.description = updated.description;
    collection.value.license = updated.license;
    collection.value.tags = updated.tags;
  }
}
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.collection-details {
  background-color: #ffffff;
  overflow-x: hidden;
  padding: 32px;
}

.loading-state {
  padding: 40px;

  .loading-content {
    max-width: 1200px;
    margin: 0 auto;

    .loader-header {
      height: 40px;
      background: theme.$gray_1;
      border-radius: 4px;
      margin-bottom: 16px;
      width: 60%;
      animation: pulse 2s infinite;
    }

    .loader-description {
      height: 20px;
      background: theme.$gray_1;
      border-radius: 4px;
      margin-bottom: 32px;
      width: 80%;
      animation: pulse 2s infinite;
    }

    .loader-datasets {
      .loader-dataset {
        height: 120px;
        background: theme.$gray_1;
        border-radius: 4px;
        margin-bottom: 16px;
        animation: pulse 2s infinite;
      }
    }
  }
}

//.collection-content {
//  .discover-content {
//    //max-width: 1200px;
//    //margin: 0 auto;
//    //padding: 0 40px;
//  }
//
//  .container-fluid {
//    width: 100%;
//  }
//}

.discover-content-title {
  color: theme.$purple_1;
  font-size: 16px;
  font-weight: 500;
  line-height: 40px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 32px;
}

.datasets-list {
  .mb-16 {
    margin-bottom: 16px;
  }
}

.no-datasets {
  text-align: center;
  padding: 40px 20px;

  h5 {
    font-size: 16px;
    color: theme.$gray_5;
    margin-bottom: 24px;
    font-weight: 500;
  }

  .btn-browse {
    background: theme.$purple_1;
    color: theme.$white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: theme.$purple_2;
    }
  }
}

.dataset-info {
  background-color: theme.$gray_1;
  border-top: 1px solid theme.$gray_2;
  padding: 40px 0 64px;
  margin-top: 32px;

  .dataset-info-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px;
  }

  .row {
    width: 100%;
    margin-bottom: 24px;

    &.mb-24 {
      margin-bottom: 32px;
    }
  }

  .col-xs-12 {
    width: 100%;
  }

  h2 {
    color: theme.$gray_6;
    font-size: 28px;
    font-weight: 600;
    line-height: 36px;
    margin: 0 0 32px;
  }

  h3 {
    color: theme.$gray_5;
    font-size: 18px;
    font-weight: 600;
    line-height: 24px;
    margin: 0 0 20px;
  }
}

.info-publishing-history {
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (min-width: 48em) {
    flex-direction: row;
    gap: 64px;
  }

  .info-text {
    color: theme.$gray_5;
    font-size: 14px;
    line-height: 20px;

    .info-text-caps {
      text-transform: uppercase;
      color: theme.$gray_4;
      font-size: 11px;
      font-weight: 600;
      line-height: 16px;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
  }
}

.share-collection {
  margin-top: 32px;
}

.info-icons {
  display: flex;
  align-items: center;

  .copy-button {
    background: theme.$white;
    border: 1px solid theme.$gray_3;
    cursor: pointer;
    padding: 10px 12px;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;

    &:hover {
      background: theme.$gray_1;
      border-color: theme.$gray_4;
    }

    .icon-upload {
      color: theme.$gray_5;
    }
  }

  .copy-success-notification {
    color: theme.$green_1;
    margin-left: 12px;
    font-size: 14px;
    font-weight: 500;
  }
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .tag {
    background: theme.$purple_tint;
    color: theme.$purple_1;
    border: 1px solid rgba(theme.$purple_1, 0.2);
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(theme.$purple_1, 0.1);
      border-color: rgba(theme.$purple_1, 0.3);
    }
  }
}

.error-state {
  text-align: center;
  padding: 80px 20px;

  h3 {
    font-size: 24px;
    color: theme.$gray_5;
    margin-bottom: 16px;
  }

  p {
    color: theme.$gray_4;
    font-size: 16px;
    margin-bottom: 32px;
  }

  .btn-back {
    background: theme.$purple_1;
    color: theme.$white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: theme.$purple_2;
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
