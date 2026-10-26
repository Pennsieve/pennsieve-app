<script setup>
import { computed, ref, watch, onMounted } from "vue";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";

import BfButton from "../../shared/bf-button/BfButton.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import IconPennsieveMark from "../../icons/IconPennsieveMark.vue";
import WorkflowThumbnail from "../WorkflowGraph/WorkflowThumbnail.vue";
import { ioSummary, appNames, usageLine } from "./workflowSummary";
import { applyFilters, libraryWorkflows, outputOptions, sortWorkflows, SORTS } from "./galleryFilter";

defineProps({
  // Inside the Workflows tab's Library, whose bar has the New Workflow button.
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
const scopeFilter = ref("workspace"); // "workspace" | "public" | "pennsieve" (public, official only)
const inputFilter = ref("any"); // "any" | "dataset" | "none"
const outputFilter = ref("any"); // "any" | a target type

// The sort is the viewer's, kept in this browser.
const SORT_KEY = "pennsieve.gallery.workflowSort";
const storedSort = () => {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return SORTS.some((o) => o.value === v) ? v : "recommended";
  } catch {
    return "recommended";
  }
};
const sortBy = ref(storedSort());
watch(sortBy, (v) => {
  try {
    localStorage.setItem(SORT_KEY, v);
  } catch {
    // not remembered; it still applies now
  }
});
const pageSize = ref(10);
const currentPage = ref(1);
const isLoadingAll = ref(false);

const workflows = computed(
  () => store.state.analysisModule.workflows || []
);
// What the cards name: target types (outputs) and applications (steps).
const targetTypes = computed(() => store.getters["analysisModule/targetTypes"] || []);
const applications = computed(() => store.getters["analysisModule/applications"] || []);
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
  { label: "Pennsieve", value: "pennsieve" },
]);

// Pennsieve's are the public ones it has reviewed (official).
const isPublicScope = computed(() => scopeFilter.value !== "workspace");

const outputChoices = computed(() => outputOptions(workflows.value, targetTypes.value));
const filtersSet = computed(
  () => !!searchQuery.value.trim() || inputFilter.value !== "any" || outputFilter.value !== "any"
);
function clearFilters() {
  searchQuery.value = "";
  inputFilter.value = "any";
  outputFilter.value = "any";
}

const filteredWorkflows = computed(() =>
  sortWorkflows(
    applyFilters(libraryWorkflows(workflows.value), {
      query: searchQuery.value,
      input: inputFilter.value,
      output: outputFilter.value,
      officialOnly: scopeFilter.value === "pennsieve",
      applications: applications.value,
      targetTypes: targetTypes.value,
    }),
    sortBy.value,
    { applications: applications.value }
  )
);

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


// Run from a card: the tab's Live view, with the run wizard open on this
// workflow (notebooks aren't listed; they start on the Notebooks tab).
const runWorkflow = (wf) => {
  router.push({ name: isMyWorkspace.value ? "my-workflows" : "workflows", query: { run: wf.uuid } });
};

// Re-fetch all when the status or scope filter changes
watch([statusFilter, isPublicScope], () => {
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
      <!-- Search over the filters, as wide as them; sort and status on the right -->
      <div class="list-toolbar">
        <el-input
          v-model="searchQuery"
          placeholder="Search by name, app, input or output…"
          clearable
          class="workflows-search-input toolbar-search"
        />
        <label class="sort-control toolbar-sort">
          Sort
          <el-select v-model="sortBy" size="small" class="sort-select">
            <el-option v-for="o in SORTS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>

        <div class="filter-row toolbar-filters">
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

          <el-select v-model="inputFilter" size="small" class="io-select" aria-label="Input">
            <el-option label="Any input" value="any" />
            <el-option label="Takes a dataset" value="dataset" />
            <el-option label="No input" value="none" />
          </el-select>
          <el-select v-model="outputFilter" size="small" class="io-select" aria-label="Output">
            <el-option label="Any output" value="any" />
            <el-option v-for="o in outputChoices" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </div>

        <el-select v-model="statusFilter" size="small" class="status-select toolbar-status" aria-label="Status">
          <el-option v-for="option in filterOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </div>

      <p v-if="scopeFilter === 'pennsieve'" class="scope-hint">
        Workflows Pennsieve has reviewed and validated. They can be run from any workspace.
      </p>
      <p v-else-if="isPublicScope" class="scope-hint">
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
                <span class="wf-usage-text">{{ usageLine(wf, formatRelativeTime) }}</span>
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
        <button v-if="filtersSet" type="button" class="clear-filters" @click="clearFilters">Clear search and filters</button>
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

/* Lined up with the toolbar above and the Analysis tabs (32px). */
.workflows-container {
  padding: 20px 32px;
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
  /* The sort lines up with the bottom of the (taller) search box. */
  align-items: flex-end;
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
  /* The row's width up to the sort, so it lines up with the cards below. */
  flex: 1;
}
/* Search over the filters and as wide as them (the left column is sized by
   the filters); sort and status on the right, each on its row. */
.list-toolbar {
  display: grid;
  grid-template-columns: max-content 1fr auto;
  grid-template-areas:
    "search . sort"
    "filters . status";
  align-items: end;
  gap: 16px;
  margin-bottom: 16px;
}
.toolbar-search {
  grid-area: search;
  width: 100%;
}
.toolbar-sort {
  grid-area: sort;
  justify-self: end;
}
.list-toolbar .toolbar-filters {
  grid-area: filters;
  margin-bottom: 0;
}
.list-toolbar .toolbar-status {
  grid-area: status;
  justify-self: end;
  margin-left: 0;
}
/* Narrower: the input and output filters go, and the search fills its row
   next to Sort; the scope buttons sit next to Status. */
@media (max-width: 1100px) {
  .list-toolbar {
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "search sort"
      "filters status";
  }
  .list-toolbar .io-select {
    display: none;
  }
  .list-toolbar .scope-buttons {
    border-right: none;
  }
}
/* Narrowest: the select alone says what it sorts by. */
@media (max-width: 640px) {
  .toolbar-sort {
    font-size: 0;
  }
}
.sort-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: theme.$gray_5;
}
.sort-select {
  width: 160px;
}
.io-select {
  width: 150px;
}
.status-select {
  width: 110px;
  margin-left: auto;
}
.clear-filters {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}

/* One row: scope chips | input, output | status at the end, all 24px tall
   and centred on one line. */
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.status-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.scope-buttons {
  padding-right: 12px;
  border-right: 1px solid theme.$gray_2;
}

.scope-hint {
  margin: -8px 0 16px;
  font-size: 12px;
  color: theme.$gray_5;
  line-height: 1.4;
}

/* As tall as the small selects beside them (24px). */
.filter-btn {
  height: 24px;
  padding: 0 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 22px;

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

$card-height: 172px;

/* Wide cards, two to a row where they fit, of one height with a square
   graph, as the apps' (ApplicationsGrid): the rows line up. */
.workflows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

.wf-card {
  display: flex;
  height: $card-height;
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
  flex: 0 0 $card-height;
  box-sizing: border-box;
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
/* What the card is (public, archived…), in its top-right corner: the
   badges line up down the grid. */
.wf-badge {
  flex-shrink: 0;
  margin-left: auto;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_6;
}
/* One line: the first apps, then +n. */
.wf-apps {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.wf-app {
  flex-shrink: 0;
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
/* One line each: the usage gives way (…) to the buttons, which never wrap. */
.wf-usage {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.wf-usage-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wf-actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.wf-action {
  white-space: nowrap;
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
/* Pennsieve's mark sits where the other badges do, in the top-right corner. */
.official-mark {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;
  color: theme.$purple_3;
}
.official-mark + .wf-badge {
  margin-left: 0;
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
