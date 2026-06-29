<template>
  <bf-stage slot="stage">
  <div class="section">
    <div class="section-header">
      <p class="section-description">
        Browse publicly available datasets published to Pennsieve Discover. These datasets are read-only.
      </p>
    </div>

    <div v-if="store.isLoading" class="loading-state" v-loading="store.isLoading">
      <p>Loading public datasets...</p>
    </div>

    <div v-else-if="store.error" class="empty-state">
      <div class="empty-state-content">
        <IconCompass :width="48" :height="48" color="#71747c" />
        <h3>Unable to load public datasets</h3>
        <p>Something went wrong. Please try again.</p>
      </div>
    </div>

    <div v-else-if="store.items.length === 0" class="empty-state">
      <div class="empty-state-content">
        <IconCompass :width="48" :height="48" color="#71747c" />
        <h3>No public datasets</h3>
        <p>There are no public datasets to show right now.</p>
      </div>
    </div>

    <div v-else class="dataset-list">
      <!-- Pagination controls -->
      <div class="dataset-list-controls mb-8">
        <div class="dataset-list-controls-menus">
          <pagination-page-menu
            class="mr-24"
            pagination-item-label="Datasets"
            :page-size="store.limit"
            @update-page-size="onUpdatePageSize"
          />
        </div>

        <el-pagination
          :page-size="store.limit"
          :pager-count="5"
          :current-page="currentPage"
          layout="prev, pager, next"
          :total="store.totalCount"
          @current-change="onPageChange"
        />
      </div>

      <div class="dataset-grid">
        <div
          v-for="dataset in store.items"
          :key="dataset.id"
          class="dataset-card"
          @click="navigateToDataset(dataset)"
        >
          <div class="dataset-card-content">
            <div class="dataset-banner">
              <img
                v-if="dataset.banner"
                :src="dataset.banner"
                :alt="`${dataset.name} banner`"
              />
              <div v-else class="dataset-banner-placeholder">
                <IconCompass :width="24" :height="24" color="#b3bcce" />
              </div>
            </div>
            <div class="dataset-info">
              <div class="dataset-header">
                <h3 class="dataset-name">{{ dataset.name }}</h3>
              </div>
              <p class="dataset-org" v-if="dataset.organizationName">
                {{ dataset.organizationName }}
              </p>
              <p class="dataset-description" v-if="dataset.description">
                {{ truncateDescription(dataset.description) }}
              </p>
              <div class="dataset-meta">
                <span>{{ dataset.fileCount }} files</span>
                <span>{{ formatBytes(dataset.size) }}</span>
                <span v-if="dataset.updatedAt">Updated {{ formatDate(dataset.updatedAt) }}</span>
              </div>
            </div>
            <div class="dataset-arrow">
              <IconArrowRight :width="16" :height="16" color="currentColor" />
            </div>
          </div>
        </div>
      </div>

      <div class="pagination-container">
        <el-pagination
          :page-size="store.limit"
          :current-page="currentPage"
          layout="prev, pager, next"
          :total="store.totalCount"
          @current-change="onPageChange"
        />
      </div>
    </div>
  </div>
  </bf-stage>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useReadOnlyDatasetStore } from "@/stores/readOnlyDatasetStore.js";
import BfStage from "@/components/layout/BfStage/BfStage.vue";
import PaginationPageMenu from "@/components/shared/PaginationPageMenu/PaginationPageMenu.vue";
import IconCompass from "@/components/icons/IconCompass.vue";
import IconArrowRight from "@/components/icons/IconArrowRight.vue";

const store = useReadOnlyDatasetStore();
const router = useRouter();

const navigateToDataset = (dataset) => {
  router.push({ name: "public-dataset-overview", params: { datasetId: dataset.id } });
};

const currentPage = computed(() => Math.floor(store.offset / store.limit) + 1);

const load = () => store.fetchDatasets("discover");

onMounted(load);

const onPageChange = (page) => {
  store.setPage(page);
  load();
};

const onUpdatePageSize = (size) => {
  store.setPageSize(size);
  load();
};

const truncateDescription = (description, length = 160) => {
  if (!description) return "";
  return description.length > length
    ? `${description.slice(0, length)}...`
    : description;
};

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.section {
  margin-bottom: 64px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-header {
  margin-bottom: 32px;

  .section-description {
    font-size: 14px;
    color: theme.$gray_4;
    margin: 0;
    max-width: 600px;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  color: theme.$gray_4;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.empty-state {
  padding: 16px 24px;

  .empty-state-content {
    text-align: center;

    h3 {
      font-size: 18px;
      font-weight: 300;
      color: theme.$gray_5;
      margin: 16px 0 8px 0;
    }

    p {
      font-size: 14px;
      color: theme.$gray_4;
      margin: 0;
    }
  }
}

.dataset-list-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dataset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.dataset-card {
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_1;

    .dataset-arrow {
      transform: translateX(4px);
    }
  }
}

.dataset-card-content {
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.dataset-banner {
  flex-shrink: 0;
  width: 96px;
  height: 96px;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid theme.$gray_2;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .dataset-banner-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: theme.$gray_1;
  }
}

.dataset-arrow {
  color: theme.$gray_4;
  transition: transform 0.2s ease;
  flex-shrink: 0;
  margin-top: 2px;
}

.dataset-info {
  flex: 1;
  min-width: 0;
}

.dataset-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.dataset-name {
  font-size: 16px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0;
  flex: 1;
  min-width: 0;
}

.dataset-org {
  font-size: 12px;
  font-weight: 600;
  color: theme.$purple_2;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px 0;
}

.dataset-description {
  font-size: 14px;
  color: theme.$gray_4;
  margin: 0 0 12px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dataset-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: theme.$gray_4;

  @media (max-width: 480px) {
    flex-direction: column;
    gap: 4px;
  }
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
