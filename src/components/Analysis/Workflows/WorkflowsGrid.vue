<script setup>
import { computed, ref, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

import BfButton from "../../shared/bf-button/BfButton.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import StageActions from "../../shared/StageActions/StageActions.vue";

const store = useStore();
const router = useRouter();

const searchQuery = ref("");
const statusFilter = ref("active");
const pageSize = ref(20);
const isSearching = ref(false);
const isLoadingMore = ref(false);

const pageSizeOptions = [10, 20, 50, 100];

const workflows = computed(
  () => store.state.analysisModule.workflows || []
);
const nextCursor = computed(
  () => store.state.analysisModule.workflowsNextCursor || ""
);

const filterOptions = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" },
];

const filteredWorkflows = computed(() => {
  return [...workflows.value].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
});

const getWorkflowMetrics = (wf) => {
  const m = wf.metrics;
  if (!m || !m.totalRuns) return null;
  return m;
};

const formatDuration = (v) => {
  if (v == null) return "--";
  if (v < 1) return `${(v * 1000).toFixed(0)}ms`;
  if (v < 60) return `${v.toFixed(1)}s`;
  if (v < 3600) return `${(v / 60).toFixed(1)}m`;
  return `${(v / 3600).toFixed(1)}h`;
};

const formatCost = (v) => {
  if (v == null) return "--";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
};

const goToCreate = () => {
  router.push({ name: "workflow-create" });
};

const goToDetail = (wf) => {
  router.push({ name: "workflow-detail", params: { uuid: wf.uuid } });
};

const getStatusParam = () => {
  return statusFilter.value !== "all" ? statusFilter.value : undefined;
};

const fetchWorkflows = async ({ search, cursor, append } = {}) => {
  await store.dispatch("analysisModule/fetchWorkflows", {
    search: search || undefined,
    cursor: cursor || undefined,
    limit: pageSize.value,
    status: getStatusParam(),
    append: !!append,
  });
};

const loadMore = async () => {
  if (!nextCursor.value || isLoadingMore.value) return;
  isLoadingMore.value = true;
  try {
    await fetchWorkflows({
      search: searchQuery.value.trim() || undefined,
      cursor: nextCursor.value,
      append: true,
    });
  } finally {
    isLoadingMore.value = false;
  }
};

// Debounced server-side search
let searchTimer = null;
watch(searchQuery, (val) => {
  clearTimeout(searchTimer);
  isSearching.value = true;
  searchTimer = setTimeout(async () => {
    try {
      await fetchWorkflows({ search: val.trim() || undefined });
    } finally {
      isSearching.value = false;
    }
  }, 300);
});

// Re-fetch when page size or status filter changes
watch(pageSize, () => {
  fetchWorkflows({ search: searchQuery.value.trim() || undefined });
});

watch(statusFilter, () => {
  fetchWorkflows({ search: searchQuery.value.trim() || undefined });
});

onMounted(async () => {
  await fetchWorkflows();
});
</script>

<template>
  <div class="workflows-grid-page">
    <!-- Header -->
    <div class="builder-header">
      <stage-actions>
        <template #left>
          <el-input
            v-model="searchQuery"
            placeholder="Search workflows..."
            size="small"
            clearable
            class="search-input"
          />
          <div class="status-buttons">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              class="filter-btn"
              :class="{ active: statusFilter === option.value }"
              @click="statusFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </template>
        <template #right>
          <bf-button @click="goToCreate">
            + New Workflow
          </bf-button>
        </template>
      </stage-actions>
    </div>

    <!-- Card Grid -->
    <div v-if="filteredWorkflows.length > 0" class="card-grid">
      <div
        v-for="wf in filteredWorkflows"
        :key="wf.uuid"
        class="wf-card"
        @click="goToDetail(wf)"
      >
        <div class="card-body">
          <div class="card-name">{{ wf.name }}</div>
          <div class="card-description">
            {{ wf.description || '' }}
          </div>
          <div class="card-spacer" />
          <div class="card-meta">
            <span
              class="status-badge"
              :class="wf.isActive ? 'badge-green' : 'badge-gray'"
            >
              {{ wf.isActive ? 'Active' : 'Inactive' }}
            </span>
            <span class="meta-text">{{ (wf.dag || []).length }} nodes</span>
            <span class="meta-text">{{ new Date(wf.createdAt).toLocaleDateString() }}</span>
          </div>
        </div>
        <div v-if="getWorkflowMetrics(wf)" class="card-footer">
          <span class="metric-item">
            <span class="metric-value">{{ getWorkflowMetrics(wf).totalRuns }}</span>
            <span class="metric-label">runs</span>
          </span>
          <span class="metric-divider" />
          <span class="metric-item">
            <span class="metric-value">{{ Math.round(getWorkflowMetrics(wf).successRate) }}%</span>
            <span class="metric-label">success</span>
          </span>
          <span class="metric-divider" />
          <span class="metric-item">
            <span class="metric-value">{{ formatDuration(getWorkflowMetrics(wf).avgDurationSec) }}</span>
            <span class="metric-label">avg duration</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Load More -->
    <div v-if="filteredWorkflows.length > 0 && nextCursor" class="load-more-container">
      <button
        class="load-more-btn"
        :disabled="isLoadingMore"
        @click="loadMore"
      >
        {{ isLoadingMore ? 'Loading...' : 'Load More' }}
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredWorkflows.length === 0" class="empty-state">
      <IconAnalysis :width="48" :height="48" color="#9ca3af" />
      <span v-if="isSearching">Searching...</span>
      <span v-else-if="workflows.length === 0 && !searchQuery">No workflows yet</span>
      <span v-else>No workflows match your filters</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../../../styles/element/input";
@use "../../../styles/element/select";


.workflows-grid-page {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 24px;
}

.builder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px;
  background-color: theme.$white;
}

.header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  background-color: theme.$white;
  min-height: 48px;

  .header-title {
    font-weight: 600;
    font-size: 15px;
    color: theme.$black;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
}

.search-input {
  max-width: 300px;
}

.status-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
}

.filter-btn {
  padding: 4px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.4;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &.active {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-rows: max-content;
  gap: 24px;
  padding: 24px 0;
  flex: 1;
  overflow-y: auto;
}

.wf-card {
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &:hover {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(80, 57, 247, 0.15);
  }
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  flex: 1;
}

.card-name {
  font-size: 16px;
  font-weight: 600;
  color: theme.$black;
}

.card-description {
  font-size: 13px;
  color: theme.$gray_4;
  line-height: 1.4;
  min-height: calc(1.4em * 2);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-spacer {
  flex: 1;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-top: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  border-radius: 0 0 3px 3px;
}

.metric-item {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.metric-value {
  font-size: 14px;
  font-weight: 700;
  color: theme.$black;
}

.metric-label {
  font-size: 10px;
  color: theme.$gray_4;
}

.metric-divider {
  width: 1px;
  height: 14px;
  background: theme.$gray_3;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.badge-gray { background: theme.$gray_2; color: theme.$gray_5; }
  &.badge-green { background: rgba(23, 187, 98, 0.12); color: #17BB62; }
}

.meta-text {
  color: theme.$gray_4;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 16px 24px 24px;
}

.load-more-btn {
  padding: 8px 24px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: theme.$gray_4;
  font-size: 14px;
}
</style>
