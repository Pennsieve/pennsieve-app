<template>
  <el-dialog
    :model-value="visible"
    title="Add to Collection"
    width="480px"
    @update:model-value="$emit('update:visible', $event)"
    @open="onOpen"
  >
    <p class="dialog-subtitle">
      Add <strong>{{ datasetName }}</strong> to one of your collections.
    </p>

    <div v-if="isLoading" class="state" v-loading="true">
      <p>Loading collections…</p>
    </div>

    <template v-else>
      <ul v-if="collections.length" class="collection-list">
        <li v-for="c in collections" :key="c.id" class="collection-row">
          <div class="collection-info">
            <span class="collection-name">{{ c.name }}</span>
            <span class="collection-count">{{ c.datasetCount }} datasets</span>
          </div>
          <span v-if="added.has(c.id)" class="added">Added ✓</span>
          <el-button
            v-else
            size="small"
            :loading="busyId === c.id"
            @click="addToCollection(c)"
          >
            Add
          </el-button>
        </li>
      </ul>
      <p v-else class="empty">You don't have any collections yet — create one below.</p>

      <div class="create-new">
        <el-input
          v-model="newName"
          placeholder="New collection name"
          size="small"
          @keyup.enter="createAndAdd"
        />
        <el-button
          size="small"
          type="primary"
          :disabled="!newName.trim()"
          :loading="isCreating"
          @click="createAndAdd"
        >
          Create &amp; Add
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { useCollectionsStore } from "@/stores/collectionStore.js";

const props = defineProps({
  visible: { type: Boolean, default: false },
  doi: { type: String, default: "" },
  datasetName: { type: String, default: "this dataset" },
});
defineEmits(["update:visible"]);

const store = useCollectionsStore();

const collections = ref([]);
const isLoading = ref(false);
const isCreating = ref(false);
const busyId = ref(null);
const newName = ref("");
const added = ref(new Set());

const onOpen = async () => {
  added.value = new Set();
  newName.value = "";
  isLoading.value = true;
  try {
    collections.value = await store.getUserCollections();
  } catch (e) {
    console.error("Failed to load collections:", e);
    collections.value = [];
  } finally {
    isLoading.value = false;
  }
};

const addToCollection = async (collection) => {
  if (!props.doi) {
    ElMessage.error("This dataset has no DOI and can't be added to a collection.");
    return;
  }
  busyId.value = collection.id;
  try {
    await store.editCollectionDataset(collection.id, [props.doi], null);
    added.value.add(collection.id);
    ElMessage.success(`Added to “${collection.name}”.`);
  } catch (e) {
    console.error("Failed to add to collection:", e);
    ElMessage.error("Failed to add to collection.");
  } finally {
    busyId.value = null;
  }
};

const createAndAdd = async () => {
  const name = newName.value.trim();
  if (!name) return;
  if (!props.doi) {
    ElMessage.error("This dataset has no DOI and can't be added to a collection.");
    return;
  }
  isCreating.value = true;
  try {
    const nodeId = await store.createNewCollection({
      name,
      description: "",
      license: "",
      tags: [],
    });
    if (!nodeId) throw new Error("No collection id returned");
    await store.editCollectionDataset(nodeId, [props.doi], null);
    ElMessage.success(`Created “${name}” and added this dataset.`);
    newName.value = "";
    // Refresh so the new collection appears in the list (marked added).
    collections.value = await store.getUserCollections();
    added.value.add(nodeId);
  } catch (e) {
    console.error("Failed to create collection:", e);
    ElMessage.error("Failed to create collection.");
  } finally {
    isCreating.value = false;
  }
};
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.dialog-subtitle {
  font-size: 14px;
  color: theme.$gray_5;
  margin: 0 0 16px 0;
}

.state {
  padding: 24px;
  text-align: center;
  color: theme.$gray_4;
}

.collection-list {
  list-style: none;
  margin: 0 0 16px 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
}

.collection-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid theme.$gray_1;
}

.collection-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.collection-name {
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-count {
  font-size: 12px;
  color: theme.$gray_4;
}

.added {
  font-size: 13px;
  font-weight: 600;
  color: theme.$green_1;
}

.empty {
  font-size: 14px;
  color: theme.$gray_4;
  margin: 0 0 16px 0;
}

.create-new {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid theme.$gray_2;
}
</style>
