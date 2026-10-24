<script setup>
import { computed, ref, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";

import BfButton from "../../shared/bf-button/BfButton.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import IconPennsieveMark from "../../icons/IconPennsieveMark.vue";
import WorkflowThumbnail from "../WorkflowGraph/WorkflowThumbnail.vue";
import { ioSummary, appNames, usageLine } from "./workflowSummary";

defineProps({
  // Inside the Gallery, whose toolbar has the New Workflow button.
  embedded: { type: Boolean, default: false },
});

const store = useStore();
const router = useRouter();
const route = useRoute();

// Shown in a workspace (/:orgId/analysis/workflows) and in My Workspace
// (/my-workspace/analysis/workflows), where "mine" is the user's own workflows
// made outside any workspace.
const isMyWorkspace = computed(() => !route.params.orgId);

const searchQuery = ref("");
const statusFilter = ref("active");
const scopeFilter = ref("workspace"); // "workspace" | "public"
const pageSize = ref(10);
const currentPage = ref(1);
const isLoadingAll = ref(false);

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

const scopeOptions = computed(() => [
  { label: isMyWorkspace.value ? "My workflows" : "This workspace", value: "workspace" },
  { label: "Public", value: "public" },
]);

const isPublicScope = computed(() => scopeFilter.value === "public");

const filteredWorkflows = computed(() => {
  let list = [...workflows.value];
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter((wf) => {
      const name = (wf.name || "").toLowerCase();
      const desc = (wf.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }
  return list.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
});

const paginatedWorkflows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredWorkflows.value.slice(start, start + pageSize.value);
});

const onPageChange = (newPage) => {
  currentPage.value = newPage;
};

watch(filteredWorkflows, () => {
  currentPage.value = 1;
});




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
  // The Workflows tab's Builder view.
  router.push({ name: isMyWorkspace.value ? "my-workflows" : "workflows", query: { view: "builder" } });
};
defineExpose({ goToCreate });

const goToDetail = (wf) => {
  router.push({
    name: isMyWorkspace.value ? "my-workflow-detail" : "workflow-detail",
    params: { uuid: wf.uuid },
  });
};

const getStatusParam = () => {
  return statusFilter.value !== "all" ? statusFilter.value : undefined;
};

const ALL_FETCH_BATCH = 100;
const ALL_FETCH_CAP = 50; // hard stop at 5,000 workflows

const fetchAllWorkflows = async () => {
  if (isLoadingAll.value) return;
  isLoadingAll.value = true;
  const visibility = isPublicScope.value ? "public" : undefined;
  try {
    // First batch replaces, subsequent batches append.
    await store.dispatch("analysisModule/fetchWorkflows", {
      cursor: undefined,
      limit: ALL_FETCH_BATCH,
      status: getStatusParam(),
      visibility,
      append: false,
    });
    let safety = ALL_FETCH_CAP;
    while (nextCursor.value && safety-- > 0) {
      await store.dispatch("analysisModule/fetchWorkflows", {
        cursor: nextCursor.value,
        limit: ALL_FETCH_BATCH,
        status: getStatusParam(),
        visibility,
        append: true,
      });
    }
  } finally {
    isLoadingAll.value = false;
  }
};

// What the cards name: target types (outputs) and applications (steps).
const targetTypes = computed(() => store.getters["analysisModule/targetTypes"] || []);
const applications = computed(() => store.getters["analysisModule/applications"] || []);

// Run from a card: the Workflows tab's Live view, with the run wizard open on
// this workflow.
const runWorkflow = (wf) => {
  router.push({ name: isMyWorkspace.value ? "my-workflows" : "workflows", query: { run: wf.uuid } });
};

// Re-fetch all when the status or scope filter changes
watch([statusFilter, scopeFilter], () => {
  currentPage.value = 1;
  fetchAllWorkflows();
});

onMounted(async () => {
  store.dispatch("analysisModule/fetchTargetTypes").catch(() => {});
  store.dispatch("analysisModule/fetchApplications").catch(() => {});
  await fetchAllWorkflows();
});
</script>

<template>
  <div class="workflows-container">
    <!-- Info Section (the Workflows tab has its own toolbar) -->
    <div v-if="!embedded" class="info-section">
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
          v-if="workflows.length > 0"
          v-model="searchQuery"
          placeholder="Search workflows..."
          size="default"
          clearable
          class="workflows-search-input"
        />
      </div>

      <div class="filter-row">
        <div class="status-buttons scope-buttons">
          <button
            v-for="option in scopeOptions"
            :key="option.value"
            class="filter-btn"
            :class="{ active: scopeFilter === option.value }"
            @click="scopeFilter = option.value"
          >
            {{ option.label }}
          </button>
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
      </div>

      <p v-if="isPublicScope" class="scope-hint">
        Public workflows published across all workspaces. They can be run from
        any workspace; only the creator can edit or unpublish them.
      </p>

      <div v-if="filteredWorkflows.length > 0" class="workflows-grid">
        <!-- A card: the graph on the left; what it is, does and runs on the
             right; Open and Run. -->
        <div
          v-for="wf in paginatedWorkflows"
          :key="wf.uuid"
          class="wf-card"
          :class="{ 'is-inactive': !wf.isActive }"
          role="link"
          tabindex="0"
          @click="goToDetail(wf)"
          @keydown.enter="goToDetail(wf)"
        >
          <div class="wf-thumb">
            <WorkflowThumbnail :dag="wf.dag || []" :aspect="1" />
          </div>
          <div class="wf-body">
            <div class="wf-title">
              <span class="wf-name">{{ wf.name }}</span>
              <el-tooltip
                v-if="wf.official"
                content="Reviewed and validated by Pennsieve."
                placement="top"
              >
                <span class="official-mark" @click.stop>
                  <IconPennsieveMark :width="14" :height="14" color="currentColor" />
                </span>
              </el-tooltip>
              <span v-if="!wf.isActive" class="wf-badge">Inactive</span>
              <span v-else-if="wf.visibility === 'public' && !wf.official" class="wf-badge">Public</span>
            </div>
            <p class="wf-description">{{ wf.description || "No description." }}</p>
            <div class="wf-io">{{ ioSummary(wf, targetTypes) }}</div>
            <div v-if="appNames(wf, applications).length" class="wf-apps">
              <span v-for="name in appNames(wf, applications).slice(0, 3)" :key="name" class="wf-app">{{ name }}</span>
              <span v-if="appNames(wf, applications).length > 3" class="wf-app wf-app--more">
                +{{ appNames(wf, applications).length - 3 }}
              </span>
            </div>
            <div class="wf-foot">
              <span class="wf-usage">
                <span class="last-run-dot" :class="lastRunInfo(wf).statusKey" />
                {{ usageLine(wf, formatRelativeTime) }}
              </span>
              <span class="wf-actions" @click.stop>
                <button type="button" class="wf-action" @click="goToDetail(wf)">Open</button>
                <button v-if="wf.isActive" type="button" class="wf-action wf-action--run" @click="runWorkflow(wf)">
                  ▶ Run
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <IconAnalysis :width="48" :height="48" color="#9ca3af" />
        <span v-if="isLoadingAll">Loading workflows...</span>
        <span v-else-if="workflows.length === 0">No workflows yet</span>
        <span v-else-if="searchQuery">
          No workflows match
          <strong>"{{ searchQuery }}"</strong>
        </span>
        <span v-else>No workflows match your filters</span>
      </div>

      <el-pagination
        v-if="filteredWorkflows.length > 0"
        class="workflows-pagination"
        :page-size="pageSize"
        :pager-count="5"
        :current-page="currentPage"
        layout="prev, pager, next"
        :total="filteredWorkflows.length"
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

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.status-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.scope-buttons {
  padding-right: 16px;
  border-right: 1px solid theme.$gray_2;
}

.scope-hint {
  margin: -8px 0 16px;
  font-size: 12px;
  color: theme.$gray_5;
  line-height: 1.4;
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

/* Wide cards, two to a row where they fit: graphs need width and height. */
.workflows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 16px;
}

.wf-card {
  display: flex;
  min-width: 0;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    outline: none;
  }
  &:hover .wf-actions,
  &:focus-within .wf-actions {
    opacity: 1;
  }
  &.is-inactive {
    opacity: 0.7;
  }
}
/* The graph, on the builder's dotted canvas. */
.wf-thumb {
  flex: 0 0 150px;
  padding: 8px;
  border-right: 1px solid theme.$gray_2;
  background-color: theme.$gray_1;
  background-image: radial-gradient(theme.$gray_3 1px, transparent 1px);
  background-size: 12px 12px;
}
.wf-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 14px 16px 12px;
}
.wf-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.wf-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.wf-badge {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  color: theme.$gray_5;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.wf-description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.wf-io {
  font-size: 12px;
  color: theme.$gray_6;
}
.wf-apps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.wf-app {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 1px 7px;
  border-radius: 3px;
  background: rgba(224, 145, 42, 0.12);
  color: #9a5c0f;
  font-size: 11px;
  font-weight: 500;
}
.wf-app--more {
  background: theme.$gray_0;
  color: theme.$gray_5;
}
.wf-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
}
.wf-usage {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
.wf-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.wf-action {
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.wf-action--run {
  border-color: theme.$purple_3;
  background: theme.$purple_3;
  color: theme.$white;

  &:hover {
    background: theme.$purple_2;
    color: theme.$white;
  }
}
@media (hover: none) {
  .wf-actions {
    opacity: 1;
  }
}

.wf-description {
  font-size: 13px;
  color: theme.$gray_5;
  margin: 4px 0 8px 0;
  line-height: 1.4;
  word-break: break-word;
}

/* A card's last run, as a dot by its usage line. */
.last-run-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: theme.$gray_4;

  &.enabled { background: theme.$status_green; }
  &.pending { background: #f59e0b; }
  &.failed { background: theme.$status_red; }
}
.official-mark {
  display: inline-flex;
  align-items: center;
  color: theme.$purple_3;
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
