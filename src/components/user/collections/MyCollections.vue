<template>
  <div class="my-collections">
    <div class="collections-header">
      <p class="page-description">
        Browse and manage your collections. Collections help organize and share
        related datasets.
      </p>

      <div class="header-actions">
        <div class="search-bar">
          <IconSearch :width="20" :height="20" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search collections..."
            class="search-input"
            @input="onSearch"
          />
          <div class="mycollections-head-item">
            <el-tooltip placement="top-start" :teleported="false">
              <template #content>
                <p>
                  Need help? Collections documentation can be found
                  <a
                    href="https://docs.pennsieve.io/docs/my-collections"
                    target="_blank"
                    >here.</a
                  >
                </p>
              </template>
              <IconInfo></IconInfo>
            </el-tooltip>
          </div>
        </div>

        <bf-button class="primary" @click="showCreateDialog">
          Create Collection
        </bf-button>
      </div>
    </div>

    <!-- Use the CollectionsList component -->
    <collections-list
      ref="collectionsList"
      :user="true"
      :search-query="searchQuery"
      :create-collection="showCreateDialog"
    />

    <!-- Create Collection Dialog -->
    <create-collection-dialog
      v-model="createDialogVisible"
      @close="hideCreateDialog"
      @created="onCollectionCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import IconInfo from "@/components/icons/IconInfo.vue";
import IconSearch from "../../icons/IconSearch.vue";
import CollectionsList from "./CollectionsList.vue";
import CreateCollectionDialog from "./CreateCollectionDialog.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

defineOptions({ name: "MyCollections" });

// state
const searchQuery = ref<string>("");
const createDialogVisible = ref(false);

// refs
const collectionsList = ref<InstanceType<typeof CollectionsList> | null>(null);

// handlers
const onSearch = () => {
  // search is reactive via searchQuery prop to CollectionsList
};

const showCreateDialog = () => {
  createDialogVisible.value = true;
};

const hideCreateDialog = () => {
  createDialogVisible.value = false;
};

const onCollectionCreated = (collection: { name: string }) => {
  // Try to insert in-place; otherwise refresh
  const list = collectionsList.value as any;
  if (list?.addNewCollection) {
    list.addNewCollection(collection);
  } else if (list?.getCollections) {
    list.getCollections();
  }

  // success toast
  ElMessage.success(`Collection "${collection.name}" created successfully`);
};
</script>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.my-collections {
  margin: 32px;
}
.mycollections-head-item {
  margin: 5px;
  display: flex;
  justify-content: end;
  a {
    color: #2760ff;
  }
}
.info-icon {
  color: #2760ff;
}
.collections-header {
  margin-bottom: 32px;

  .page-description {
    font-size: 16px;
    color: theme.$gray_5;
    line-height: 1.6;
    margin: 0 0 24px 0;
    max-width: 800px;
  }

  .header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;

    .search-bar {
      position: relative;
      max-width: 400px;
      width: 100%;
      display: flex;
      align-items: center;

      .search-icon {
        position: absolute;
        left: 16px;
        color: theme.$gray_4;
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        padding: 10px 16px 10px 48px;
        border: 1px solid theme.$gray_2;
        border-radius: 4px;
        font-size: 14px;
        background: white;
        transition: all 0.2s ease;

        &::placeholder {
          color: theme.$gray_4;
        }

        &:focus {
          outline: none;
          border-color: theme.$purple_2;
          box-shadow: 0 0 0 2px rgba(77, 98, 140, 0.1);
        }
      }
    }
  }
}

// Responsive design
@media (max-width: 768px) {
  .collections-header {
    .header-actions {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;

      .search-bar {
        max-width: 100%;
      }
    }
  }
}
</style>
