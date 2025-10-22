<template>
  <div class="collections-list">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      <p>Loading collections...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button @click="getCollections" class="retry-button">Try Again</button>
    </div>

    <!-- Collections list -->
    <div v-else-if="collections.length > 0" class="collections-section">
      <div class="collections-list-container">
        <collections-card
          v-for="collection in collections"
          :key="collection.id"
          :collection="collection"
          class="collection-item"
        />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-content">
        <div class="empty-icon">
          <IconCollection :width="64" :height="64" color="#cbd5e0" />
        </div>
        <h2>No Collections Found</h2>
        <p v-if="searchQuery">
          No collections match your search for "{{ searchQuery }}". Try
          adjusting your search terms.
        </p>
        <p v-else>
          You don't have any collections yet. Collections help organize and
          share related datasets.
        </p>
        <button
          v-if="!searchQuery"
          class="btn-create"
          @click="createCollection"
        >
          Create Your First Collection
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  watch,
  onMounted,
  withDefaults,
  defineProps,
  defineExpose,
} from "vue";
import { useSendXhr } from "@/mixins/request/request_composable.js";
import { useGetToken } from "@/composables/useGetToken.js";
import * as siteConfig from "@/site-config/site.json";
import { useCollectionsStore } from "@/stores/collectionStore.js";
import CollectionsCard from "./CollectionsCard.vue";
import IconCollection from "../../icons/IconCollection.vue";
import { stringify } from "uuid";

defineOptions({ name: "CollectionsList" });

// Props with defaults
const props = defineProps({
  user: {
    type: Boolean,
    default: false,
  },
  searchQuery: {
    type: String,
    default: null,
  },
});
//emits
const emit = defineEmits(["create-collection"]);
//pinia
const collectionStore = useCollectionsStore();
// State
const collections = ref([]);
const allCollections = ref([]);
const isLoading = ref(false);
const error = ref("");
const offset = ref(0);
const pageSize = ref(25);
const page = ref(1);
const totalCollectionsCount = ref(0);

// Methods
const filterCollections = (query) => {
  if (!query || query.trim() === "") {
    collections.value = [...allCollections.value];
    return;
  }
  const searchTerm = query.toLowerCase().trim();
  collections.value = allCollections.value.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm) ||
      c.description.toLowerCase().includes(searchTerm) ||
      `${c.ownerFirstName} ${c.ownerLastName}`
        .toLowerCase()
        .includes(searchTerm)
  );
};

const getCollections = async () => {
  isLoading.value = true;
  error.value = "";
  try {
    const response = await collectionStore.getUserCollections();
    
    // Ensure we always have an array
    const collectionsData = Array.isArray(response) ? response : (response?.collections || []);
    allCollections.value = collectionsData;
    
    filterCollections(props.searchQuery);
    totalCollectionsCount.value =
      response?.totalCount || allCollections.value.length;
  } catch (err) {
    console.error("Error fetching collections:", err);
    error.value = "Failed to load collections. Please try again.";
    collections.value = [];
    allCollections.value = [];
  } finally {
    isLoading.value = false;
  }
};

const createCollection = () => {
  emit("create-collection");
};

const addNewCollection = (collection) => {
  const transformed = {
    id: collection.nodeId,
    name: collection.name,
    description: collection.description || "",
    datasetCount: collection.size || 0,
    userRole: collection.userRole || "Owner",
    banners: collection.banners || [],
    state: collection.state || "private",
    doi: collection.doi,
    ownerFirstName: collection.ownerFirstName || "",
    ownerLastName: collection.ownerLastName || "",
    revisedAt: collection.revisedAt,
    versionPublishedAt: collection.versionPublishedAt,
  };

  allCollections.value.unshift(transformed);
  filterCollections(props.searchQuery);
  totalCollectionsCount.value += 1;
};

// Lifecycle
onMounted(() => {
  getCollections();
});

// Watchers
watch(
  () => props.searchQuery,
  (newQuery) => {
    filterCollections(newQuery);
  }
);

// Expose methods to parent
defineExpose({
  getCollections,
  addNewCollection,
});
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.collections-list {
  min-height: 400px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;

  .loading-spinner {
    margin-bottom: 16px;

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid theme.$gray_2;
      border-top: 4px solid theme.$purple_2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }

  p {
    color: theme.$gray_5;
    font-size: 16px;
  }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;

  .error-message {
    color: theme.$red_1;
    font-size: 16px;
    margin-bottom: 16px;
    text-align: center;
  }

  .retry-button {
    padding: 8px 16px;
    background: theme.$purple_2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s ease;

    &:hover {
      background: theme.$purple_3;
    }
  }
}

.collections-section {
  .collections-list-container {
    background: white;
    border-radius: 4px;
    border: 1px solid theme.$gray_2;
    overflow: hidden;

    .collection-item {
      width: 100%;
    }
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;

  .empty-content {
    text-align: center;
    max-width: 500px;

    .empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    h2 {
      font-size: 24px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 16px 0;
    }

    p {
      font-size: 16px;
      color: theme.$gray_5;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }

    .btn-create {
      background: theme.$purple_2;
      color: theme.$white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s ease;

      &:hover {
        background: theme.$purple_3;
      }
    }
  }
}

// Animation for spinner
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
