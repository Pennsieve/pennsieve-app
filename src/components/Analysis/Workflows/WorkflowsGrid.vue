<script setup>
import { computed, ref, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

import BfButton from "../../shared/bf-button/BfButton.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";

const store = useStore();
const router = useRouter();

const searchQuery = ref("");
const statusFilter = ref("active");
const pageSize = ref(10);
const currentPage = ref(1);
const isSearching = ref(false);
const isLoadingMore = ref(false);

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

const paginatedWorkflows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredWorkflows.value.slice(start, start + pageSize.value);
});

// Expose one extra page beyond what's loaded whenever the server has
// more results, so el-pagination shows a "next" button that triggers a
// cursor-based fetch.
const paginationTotal = computed(() => {
  const loaded = filteredWorkflows.value.length;
  return nextCursor.value ? loaded + pageSize.value : loaded;
});

const onPageChange = async (newPage) => {
  currentPage.value = newPage;
  const required = newPage * pageSize.value;
  if (
    required > filteredWorkflows.value.length &&
    nextCursor.value &&
    !isLoadingMore.value
  ) {
    await loadMore();
  }
};

watch(filteredWorkflows, () => {
  currentPage.value = 1;
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

const formatRelativeTime = (dateString) => {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
};

const lastRunInfo = (wf) => {
  const m = wf?.metrics;
  const ts =
    wf?.lastRunAt ||
    m?.lastRunAt ||
    m?.lastRunCompletedAt ||
    m?.lastCompletedAt ||
    null;
  const status =
    wf?.lastRunStatus || m?.lastRunStatus || m?.lastStatus || null;
  const totalRuns = m?.totalRuns ?? 0;
  if (totalRuns === 0) {
    return { label: "Never run", statusKey: "gray" };
  }
  const rel = formatRelativeTime(ts);
  return {
    label: rel ? `Last run · ${rel}` : `${totalRuns} runs`,
    statusKey: lastRunStatusKey(status, m?.successRate),
  };
};

const lastRunStatusKey = (status, successRate) => {
  if (status) {
    const s = String(status).toLowerCase();
    if (["succeeded", "success", "completed"].includes(s)) return "enabled";
    if (["failed", "error", "errored"].includes(s)) return "failed";
    if (["running", "pending", "queued"].includes(s)) return "pending";
  }
  if (typeof successRate === "number") {
    if (successRate >= 75) return "enabled";
    if (successRate < 25) return "failed";
    return "pending";
  }
  return "gray";
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
  <div class="workflows-container">
    <!-- Info Section -->
    <div class="info-section">
      <div class="info-card">
        <h3>Compute Workflows</h3>
        <p>
          Workflows chain processors together into a pipeline that runs on
          Pennsieve compute nodes. Each workflow can be executed on demand or
          scheduled, with runtime metrics surfaced per run.
        </p>
        <div class="info-card-actions">
          <bf-button @click="goToCreate">+ New Workflow</bf-button>
        </div>
      </div>
    </div>

    <!-- Workflows Section -->
    <div class="workflows-section">
      <div class="workflows-section-header">
        <h3>Workflows</h3>
        <el-input
          v-model="searchQuery"
          placeholder="Search workflows..."
          size="default"
          clearable
          class="workflows-search-input"
        />
      </div>

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

      <div v-if="filteredWorkflows.length > 0" class="workflows-grid">
        <div
          v-for="wf in paginatedWorkflows"
          :key="wf.uuid"
          class="wf-card"
          @click="goToDetail(wf)"
        >
          <div class="wf-header">
            <div class="wf-info">
              <h3>
                <button
                  type="button"
                  class="wf-name-link"
                  @click.stop="goToDetail(wf)"
                >
                  {{ wf.name }}
                </button>
              </h3>
              <div class="wf-subtitle">Workflow</div>
              <div v-if="wf.description" class="wf-description">
                {{ wf.description }}
              </div>
              <div class="wf-tags">
                <span
                  class="tag"
                  :class="wf.isActive ? 'active' : 'inactive'"
                >
                  {{ wf.isActive ? 'Active' : 'Inactive' }}
                </span>
                <span class="tag nodes">
                  {{ (wf.dag || []).length }} nodes
                </span>
                <span class="tag created">
                  {{ new Date(wf.createdAt).toLocaleDateString() }}
                </span>
              </div>
            </div>

            <div
              class="last-run-pill"
              :class="lastRunInfo(wf).statusKey"
            >
              <span class="last-run-dot" />
              {{ lastRunInfo(wf).label }}
            </div>
          </div>

          <div class="wf-card-actions">
            <div v-if="getWorkflowMetrics(wf)" class="wf-metrics">
              <span class="metric-item">
                <span class="metric-value">
                  {{ getWorkflowMetrics(wf).totalRuns }}
                </span>
                <span class="metric-label">runs</span>
              </span>
              <span class="metric-divider" />
              <span class="metric-item">
                <span class="metric-value">
                  {{ Math.round(getWorkflowMetrics(wf).successRate) }}%
                </span>
                <span class="metric-label">success</span>
              </span>
              <span class="metric-divider" />
              <span class="metric-item">
                <span class="metric-value">
                  {{ formatDuration(getWorkflowMetrics(wf).avgDurationSec) }}
                </span>
                <span class="metric-label">avg duration</span>
              </span>
            </div>
            <span v-else class="empty-footer-text">No runs to report</span>

            <button
              type="button"
              class="card-action-link"
              @click.stop="goToDetail(wf)"
            >
              <span>View details</span>
              <span class="arrow">&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <IconAnalysis :width="48" :height="48" color="#9ca3af" />
        <span v-if="isSearching">Searching...</span>
        <span v-else-if="workflows.length === 0 && !searchQuery">
          No workflows yet
        </span>
        <span v-else>No workflows match your filters</span>
      </div>

      <el-pagination
        v-if="paginationTotal > 0"
        class="workflows-pagination"
        :page-size="pageSize"
        :pager-count="5"
        :current-page="currentPage"
        layout="prev, pager, next"
        :total="paginationTotal"
        :disabled="isLoadingMore"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../../../styles/element/input";

.workflows-container {
  max-width: 1000px;
  margin: 0;
  padding: 16px 24px;
}

.info-section {
  margin-bottom: 32px;
}

.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 24px;

  h3 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0 0 12px 0;
  }

  .info-card-actions {
    margin-top: 16px;
  }
}

.workflows-section {
  margin-bottom: 48px;
}

.workflows-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0;
  }
}

.workflows-search-input {
  max-width: 320px;
}

.status-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
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

.workflows-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wf-card {
  background: white;
  border: 1px solid theme.$gray_2;
  padding: 20px;
  transition: border-color 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: theme.$gray_3;
  }
}

.wf-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.wf-info {
  flex: 1;
  min-width: 0;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }
}

.wf-name-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: theme.$gray_6;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: theme.$purple_2;
    text-decoration: underline;
  }
}

.wf-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 6px;
  font-weight: 400;
}

.wf-description {
  font-size: 13px;
  color: theme.$gray_5;
  margin: 4px 0 8px 0;
  line-height: 1.4;
  word-break: break-word;
}

.last-run-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;

  .last-run-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &.gray {
    background: theme.$gray_2;
    color: theme.$gray_5;
    .last-run-dot { background: theme.$gray_4; }
  }

  &.enabled {
    background: rgba(theme.$status_green, 0.12);
    color: theme.$status_green;
    .last-run-dot { background: theme.$status_green; }
  }

  &.pending {
    background: rgba(#F59E0B, 0.12);
    color: #B45309;
    .last-run-dot { background: #F59E0B; }
  }

  &.failed {
    background: rgba(#EF4444, 0.12);
    color: #DC2626;
    .last-run-dot { background: #DC2626; }
  }
}

.wf-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.active {
      background: rgba(theme.$status_green, 0.12);
      color: theme.$status_green;
    }

    &.inactive {
      background: theme.$gray_2;
      color: theme.$gray_5;
    }

    &.nodes,
    &.created {
      background: theme.$gray_1;
      color: theme.$gray_5;
    }
  }
}

.wf-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid theme.$gray_2;
  flex-wrap: wrap;
}

.wf-metrics {
  display: flex;
  align-items: center;
  gap: 12px;
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

.empty-footer-text {
  font-size: 12px;
  color: theme.$gray_4;
  font-style: italic;
}

.card-action-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$purple_3;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  .arrow {
    transition: transform 0.15s ease;
  }

  &:hover .arrow {
    transform: translateX(2px);
  }
}

.workflows-pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  --el-pagination-hover-color: #{theme.$purple_3};
}

.empty-state {
  text-align: center;
  padding: 32px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  color: theme.$gray_5;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
</style>
