<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, getCurrentInstance } from "vue";
import { runScopeChannel } from "@/realtime/channels";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import IconRotateRight from "../../icons/IconRotateRight.vue";
import IconInfoSmall from "../../icons/IconInfoSmall.vue";
import IconControllerPlay from "../../icons/IconControllerPlay.vue";
import IconXCircle from "../../icons/IconXCircle.vue";
import { endInteractiveSession } from "@/composables/useJupyterSession";
import { useGetToken } from "@/composables/useGetToken";
import { useMetricsCounters } from "@/composables/useMetricsCounters";
import { isNotebookWorkflow } from "./notebookHelpers";
import RunHistory from "./RunHistory.vue";
import RunWizardDialog from "./RunWizardDialog.vue";

// In the Workflows tab: no runs yet points to the Library, to start one.
const emit = defineEmits(["open-library"]);
const props = defineProps({
  // Inside the Workflows tab (WorkflowsOverview), which has the toolbar and
  // its Run Workflow button: no header of its own.
  embedded: { type: Boolean, default: false },
  // Leave out standalone notebook sessions (they're on the Notebooks tab); a
  // workflow with a notebook step is a workflow run and stays.
  excludeNotebooks: { type: Boolean, default: false },
});
import {
  statusDotClass,
  statusLabel,
  isTerminalStatus,
  formatTime,
  computeNodeName as computeNodeNameFn,
  getUserName as getUserNameFn,
  runStatusOptions,
  runDisplayName,
} from "./runHelpers";

const store = useStore();
const router = useRouter();
const route = useRoute();
const realtime = getCurrentInstance()?.appContext.config.globalProperties.$realtime;

/*
  Store computed
*/
const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"] || []
);
const hasMoreRuns = computed(
  () => !!store.getters["analysisModule/workflowInstancesCursor"]
);
const computeNodes = computed(
  () => store.getters["analysisModule/computeNodes"] || []
);
// Shown in a workspace (/:orgId/analysis/runs) and in My Workspace
// (/my-workspace/analysis/runs), where there's no organization: runs, nodes and
// workflows are the user's own outside any workspace, and a run can't use a
// dataset yet.
const isMyWorkspace = computed(() => !route.params.orgId);
// A run's page from here says it came from Workflows, so that tab stays
// highlighted there even for a notebook's run (with notebooks included).
const runRoute = (name, runId) => ({
  ...(isMyWorkspace.value
    ? { name: `my-${name}`, params: runId ? { runId } : {} }
    : { name, params: runId ? { runId } : {} }),
  ...(runId && props.embedded && { query: { from: "workflows" } }),
});

// My Workspace offers the user's own workflows (the store's list there) and
// public ones, as its Workflow Library does.
const publicWorkflows = ref([]);
const fetchPublicWorkflows = async () => {
  try {
    const token = await useGetToken();
    const resp = await fetch(`${config.value.api2Url}/compute/workflows/definitions?visibility=public`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    publicWorkflows.value = Array.isArray(result) ? result : result.workflows || [];
  } catch (err) {
    console.error("Failed to fetch public workflows:", err);
    publicWorkflows.value = [];
  }
};
const workflows = computed(() => {
  const own = store.state.analysisModule.workflows || [];
  if (!isMyWorkspace.value) return own;
  const byId = new Map(own.map((w) => [w.uuid, w]));
  for (const w of publicWorkflows.value) if (w?.uuid && !byId.has(w.uuid)) byId.set(w.uuid, w);
  return [...byId.values()];
});

const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);
const config = computed(() => store.state.config);

/*
  Local state
*/
const statusFilter = ref("all");
const workflowFilter = ref("all");
const computeNodeFilter = ref("all");
const isLoading = ref(false);
const isLoadingMore = ref(false);
let analyticsChannel = null;

/*
  Dashboard state
*/
const dashboardRange = ref("allTime");
const dashboardRangeOptions = [
  { label: "Last Month", value: "lastMonth" },
  { label: "Last Year", value: "lastYear" },
  { label: "All time", value: "allTime" },
];

const { counters: orgCounters, isLoading: countersLoading, fetchCounters: fetchOrgCounters } = useMetricsCounters({
  range: dashboardRange,
});

/*
  Dashboard computed
*/
// A run of a notebook workflow itself (Jupyter, R), by its definition or,
// for a public one not in the list, its name.
const workflowsById = computed(() => new Map(workflows.value.map((w) => [w.uuid, w])));
// A notebook's run: its workflow is a notebook, or workflow-service flagged
// the run a live session (for public notebooks this list doesn't hold).
const isNotebookRun = (r) => !!r.interactive || isNotebookWorkflow(workflowsById.value.get(r.workflowUuid));
const shownRuns = computed(() =>
  props.excludeNotebooks ? workflowInstances.value.filter((r) => !isNotebookRun(r)) : workflowInstances.value
);

const activeRuns = computed(() =>
  shownRuns.value.filter((r) => r.status === "NOT_STARTED" || r.status === "STARTED" || r.status === "FINALIZING")
);


const statsOf = (total, succeeded, failed, canceled) => ({
  total,
  succeeded,
  failed,
  canceled,
  successRate: succeeded + failed > 0 ? Math.round((succeeded / (succeeded + failed)) * 100) : 0,
});

// The counters of the workspace (or, in My Workspace, of your own runs),
// counted as each run finishes. With notebooks hidden, their share
// (counters.interactive) is taken out, so the overview matches the list.
const dashboardStats = computed(() => {
  const all = orgCounters.value?.allTime;
  if (!all?.totalRuns) return null;
  const nb = props.excludeNotebooks ? orgCounters.value.interactive?.allTime || {} : {};
  const less = (k) => Math.max(0, (all[k] || 0) - (nb[k] || 0));
  const total = less("totalRuns");
  if (!total) return null;
  return statsOf(total, less("succeeded"), less("failed"), less("canceled"));
});

// Nothing has run at all (not just nothing in a range or filter): one
// welcome in place of an empty overview and list. Notebook sessions may
// have run while they're hidden.
const filtersDefault = computed(
  () => statusFilter.value === "all" && workflowFilter.value === "all" && dashboardRange.value === "allTime"
);
const nothingRun = computed(
  () => !isLoading.value && filtersDefault.value && !shownRuns.value.length && !dashboardStats.value
);
const onlyNotebooks = computed(() => props.excludeNotebooks && workflowInstances.value.length > 0);
const toBuilder = () => router.replace({ query: { ...route.query, view: "builder" } });
const libraryRoute = computed(() => ({ name: isMyWorkspace.value ? "my-workflows" : "workflows", query: { view: "library" } }));

/*
  Filtered Runs
*/
// The runs below the active ones: all that match the filters, less the
// active ones above (unless the status filter asks for those).
const earlierRuns = computed(() =>
  statusFilter.value === "all"
    ? filteredRuns.value.filter((r) => !["NOT_STARTED", "STARTED", "FINALIZING"].includes(r.status))
    : filteredRuns.value
);

const filteredRuns = computed(() => {
  let runs = shownRuns.value;
  if (computeNodeFilter.value !== "all") {
    runs = runs.filter((r) => r.computeNodeUuid === computeNodeFilter.value);
  }
  return [...runs].sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );
});

/*
  Helper wrappers for imported functions
*/
const computeNodeName = (uuid) => computeNodeNameFn(uuid, computeNodes.value);
const getUserName = (userId) => getUserNameFn(userId, profile.value, orgMembers.value);

/*
  Filter params & fetch
*/
const getRunFilterParams = () => {
  const params = {
    status: statusFilter.value !== "all" ? statusFilter.value : undefined,
    workflowId: workflowFilter.value !== "all" ? workflowFilter.value : undefined,
  };

  const now = new Date();
  if (dashboardRange.value === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    params.startDate = start.toISOString();
    params.endDate = now.toISOString();
  } else if (dashboardRange.value === "lastYear") {
    const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    params.startDate = start.toISOString();
    params.endDate = now.toISOString();
  }

  return params;
};

const fetchRunsWithFilters = async () => {
  isLoading.value = true;
  try {
    await store.dispatch("analysisModule/fetchWorkflowInstances", getRunFilterParams());
  } catch (err) {
    console.error("Failed to fetch runs:", err);
  } finally {
    isLoading.value = false;
  }
};

const loadMoreRuns = async () => {
  isLoadingMore.value = true;
  try {
    await store.dispatch("analysisModule/fetchMoreWorkflowInstances", getRunFilterParams());
  } catch (err) {
    console.error("Failed to load more runs:", err);
  } finally {
    isLoadingMore.value = false;
  }
};

watch(statusFilter, () => fetchRunsWithFilters());
watch(workflowFilter, () => fetchRunsWithFilters());
watch(dashboardRange, () => {
  fetchOrgCounters();
  fetchRunsWithFilters();
});

/*
  Navigation
*/
const selectRun = (run) => {
  router.push(runRoute("run-detail", run.uuid));
};

// Open the interactive notebook for a run waiting on a user session. run-notebook
// is a top-level route, so orgId must be passed explicitly (route param, with a
// store fallback).
const openNotebook = (run) => {
  if (isMyWorkspace.value) {
    router.push({ name: "my-run-notebook", params: { runId: run.uuid } });
    return;
  }
  const orgId =
    route.params.orgId || store.state.activeOrganization?.organization?.id;
  router.push({ name: "run-notebook", params: { orgId, runId: run.uuid } });
};

// End the interactive session for a run (clean resume) without opening it.
// Confirmed via the in-app Pennsieve dialog (not the browser prompt).
const endingRunId = ref(null);
const confirmEndRun = ref(null);
const endRunError = ref("");
const endRun = (run) => {
  if (endingRunId.value) return;
  endRunError.value = "";
  confirmEndRun.value = run;
};
const confirmEndSession = async () => {
  const run = confirmEndRun.value;
  if (!run || endingRunId.value) return;
  endingRunId.value = run.uuid;
  endRunError.value = "";
  try {
    await endInteractiveSession(run.uuid);
    confirmEndRun.value = null;
  } catch (e) {
    endRunError.value = e?.message || "Could not end the interactive session.";
  } finally {
    endingRunId.value = null;
  }
};

/*
  The run dialog (RunWizardDialog): "+ Run Workflow", a Library card's Run
  (openWizardDialog with its workflow, from the Workflows tab), a run's
  "Rerun".
*/
const wizardRef = ref(null);
const openWizardDialog = (workflowId) => wizardRef.value?.open(typeof workflowId === "string" ? workflowId : undefined);
const rerunFromRun = (run) => wizardRef.value?.rerun(run);
defineExpose({ openWizardDialog });

/*
  Live-update event handlers (run-level only)
*/
const parseEventData = (data) => {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
};

const onRunStatusUpdate = async (raw) => {
  const data = parseEventData(raw);
  store.commit("analysisModule/UPDATE_RUN_STATUS", {
    runId: data.runId,
    status: data.status,
  });
};

/*
  Lifecycle
*/
onMounted(async () => {
  isLoading.value = true;
  try {
    await Promise.all([
      store.dispatch("analysisModule/fetchWorkflowInstances"),
      store.dispatch("analysisModule/fetchComputeNodes"),
      store.dispatch("analysisModule/fetchWorkflows"),
      fetchOrgCounters(),
      ...(isMyWorkspace.value ? [fetchPublicWorkflows()] : []),
    ]);
  } catch (err) {
    console.error("Failed to load data:", err);
  } finally {
    isLoading.value = false;
  }

  // Live updates for every run in the workspace (or the user's own runs)
  if (realtime) {
    analyticsChannel = realtime.subscribe(
      runScopeChannel(store.state.activeOrganization?.organization?.id, store.state.profile?.id)
    );
    analyticsChannel.bind("workflow-run-status", onRunStatusUpdate);
  }
});

onBeforeUnmount(() => {
  if (analyticsChannel) {
    analyticsChannel.unbind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.unsubscribe();
    analyticsChannel = null;
  }
});
</script>

<template>
  <div class="runs-overview" :class="{ 'is-embedded': embedded }">
    <!-- Header -->
    <div v-if="!embedded" class="builder-header">
      <div class="header-actions">
        <bf-button @click="openWizardDialog">+ Run Workflow</bf-button>
      </div>
    </div>

    <div class="builder-content">
      <!-- Main content area: Dashboard -->
      <div class="runs-main">
        <!-- Active Runs Strip -->
        <div v-if="activeRuns.length > 0" class="dashboard-section">
          <h3 class="dashboard-section-title">
            <span class="active-pulse" />
            {{ activeRuns.length }} Active Run{{ activeRuns.length !== 1 ? 's' : '' }}
          </h3>
          <div class="active-runs-grid">
            <div
              v-for="run in activeRuns"
              :key="run.uuid"
              class="active-run-card"
              @click="selectRun(run)"
            >
              <div
                v-if="run.interactive && run.status === 'STARTED'"
                class="active-run-actions"
                @click.stop
              >
                <button
                  class="active-run-action active-run-action--end"
                  title="End interactive session — resumes the workflow"
                  :disabled="endingRunId === run.uuid"
                  @click="endRun(run)"
                >
                  <IconXCircle :width="15" :height="15" color="#c14d49" />
                </button>
                <button
                  class="active-run-action active-run-action--play"
                  title="Open interactive notebook"
                  @click="openNotebook(run)"
                >
                  <IconControllerPlay :width="16" :height="10" color="#011f5b" />
                </button>
              </div>
              <div class="active-run-name">{{ runDisplayName(run) || 'Unnamed run' }}</div>
              <div v-if="run.name && run.workflowName" class="active-run-subtitle">{{ run.workflowName }}</div>
              <div class="active-run-meta">
                <span class="run-status-dot" :class="statusDotClass(run.status)" />
                <span>{{ statusLabel(run.status) }}</span>
                <span class="active-run-time">{{ formatTime(run.startedAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Nothing has run yet: a welcome, with where to start -->
        <div v-if="nothingRun && !activeRuns.length" class="runs-welcome">
          <IconControllerPlay :width="40" :height="40" color="currentColor" class="runs-welcome-icon" />
          <h3>No workflow runs yet</h3>
          <p v-if="onlyNotebooks">
            Only notebook sessions so far. Tick <strong>Include notebooks</strong> to see them here.
          </p>
          <p v-else>
            When you run a workflow, it shows here: live while it runs, then with its status, logs and cost.
          </p>
          <div class="runs-welcome-actions">
            <bf-button @click="openWizardDialog">Run a workflow</bf-button>
            <template v-if="embedded">
              <bf-button class="secondary" @click="toBuilder">Build a workflow</bf-button>
              <router-link :to="libraryRoute" class="runs-welcome-link">Browse workflows</router-link>
            </template>
          </div>
        </div>

        <template v-else>
        <!-- Aggregate Stats -->
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h3 class="dashboard-section-title">
              Overview
              <el-tooltip content="Counted as each run finishes" placement="top">
                <IconInfoSmall :width="24" :height="24" color="#9ca3af" class="dashboard-info-icon" />
              </el-tooltip>
            </h3>
            <div class="dashboard-range-buttons">
              <button
                v-for="opt in dashboardRangeOptions"
                :key="opt.value"
                class="range-btn"
                :class="{ active: dashboardRange === opt.value }"
                @click="dashboardRange = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <div v-if="countersLoading && !dashboardStats" class="dashboard-empty-range">
            Loading metrics...
          </div>
          <div v-else-if="dashboardStats" class="dashboard-stats">
            <div class="dash-stat">
              <span class="dash-stat-value">{{ dashboardStats.total }}</span>
              <span class="dash-stat-label">Total Runs</span>
            </div>
            <div class="dash-stat">
              <span class="dash-stat-value dash-stat-green">{{ dashboardStats.succeeded }}</span>
              <span class="dash-stat-label">Succeeded</span>
            </div>
            <div class="dash-stat">
              <span class="dash-stat-value dash-stat-red">{{ dashboardStats.failed }}</span>
              <span class="dash-stat-label">Failed</span>
            </div>
            <div class="dash-stat">
              <span class="dash-stat-value">{{ dashboardStats.successRate }}%</span>
              <span class="dash-stat-label">Success Rate</span>
            </div>
          </div>
          <div v-else class="dashboard-empty-range">
            No runs in this time range<template v-if="embedded">
              · <button type="button" class="link-button" @click="emit('open-library')">Start one from the Library</button></template>
          </div>
        </div>

        <!-- Earlier runs: the same list as the Notebooks tab's, with the
             filters above it -->
        <run-history
          :from="embedded ? 'workflows' : ''"
          :title="activeRuns.length ? 'Earlier runs' : 'Runs'"
          :runs="earlierRuns"
          :loading="isLoading"
          :has-more="hasMoreRuns"
          :loading-more="isLoadingMore"
          empty-text="No runs match these filters."
          search-placeholder="Search runs…"
          show-workflow
          :node-name="computeNodeName"
          :user-name="getUserName"
          @load-more="loadMoreRuns"
        >
          <template #filters>
            <el-select v-model="statusFilter" size="small" class="run-filter-select">
              <el-option v-for="opt in runStatusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <el-select v-model="workflowFilter" size="small" class="run-filter-select" filterable>
              <el-option label="All workflows" value="all" />
              <el-option v-for="wf in workflows" :key="wf.uuid" :label="wf.name" :value="wf.uuid" />
            </el-select>
            <el-select v-if="computeNodes.length > 1" v-model="computeNodeFilter" size="small" class="run-filter-select">
              <el-option label="All compute nodes" value="all" />
              <el-option v-for="cn in computeNodes" :key="cn.uuid" :label="cn.name" :value="cn.uuid" />
            </el-select>
          </template>
          <template #actions="{ run }">
            <button class="rerun-btn" title="Rerun with this configuration" @click="rerunFromRun(run)">
              <IconRotateRight :width="16" :height="16" />
            </button>
          </template>
        </run-history>
        </template>
      </div>

    </div>

    <!-- End-session confirmation (Pennsieve dialog, not the browser prompt) -->
    <el-dialog
      :model-value="!!confirmEndRun"
      @update:model-value="(v) => { if (!v && !endingRunId) confirmEndRun = null; }"
      title="End interactive session?"
      width="460px"
      :close-on-click-modal="!endingRunId"
      :show-close="!endingRunId"
      align-center
    >
      <p style="margin: 0; color: #4d4d4d; line-height: 1.5;">
        Ending the session shuts down the notebook kernel and resumes the
        workflow at the next step. Any unsaved notebook changes will be lost —
        open the notebook first if you need to save your work.
      </p>
      <p v-if="endRunError" style="margin: 12px 0 0; color: #c14d49; font-size: 13px;">
        {{ endRunError }}
      </p>
      <template #footer>
        <bf-button class="secondary mr-8" :disabled="!!endingRunId" @click="confirmEndRun = null">
          Cancel
        </bf-button>
        <bf-button class="red" :disabled="!!endingRunId" @click="confirmEndSession">
          {{ endingRunId ? 'Ending…' : 'End Session' }}
        </bf-button>
      </template>
    </el-dialog>

    <RunWizardDialog ref="wizardRef" />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../../../styles/element/select";

.runs-overview {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* In the Workflows tab, which sizes it below its toolbar. */
.runs-overview.is-embedded {
  height: 100%;
}

.builder-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  background-color: theme.$white;
  border-bottom: 1px solid theme.$gray_2;
  min-height: 48px;

  .header-title {
    font-weight: 400;
    font-size: 13px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    gap: 8px;

    &.header-title-primary {
      font-weight: 600;
      font-size: 15px;
      color: theme.$black;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
}

.builder-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* White, with its sections as wide as the Notebooks tab's. */
.runs-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px 32px;
  background: theme.$white;
}
.runs-main > .dashboard-section,

/* Dashboard */
.dashboard-section {
  margin-bottom: 24px;
}

.dashboard-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}

.dashboard-section-title {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_5;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;

  .dashboard-section-header & {
    margin-bottom: 0;
  }
}

.dashboard-info-icon {
  cursor: help;
}

.dashboard-range-buttons {
  display: flex;
  gap: 4px;
}

.range-btn {
  padding: 4px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_5;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

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

.active-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #06b6d4;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(6, 182, 212, 0); }
}

.runs-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 72px 20px;
  border: 1px dashed theme.$gray_3;
  text-align: center;

  h3 {
    margin: 4px 0 0;
    font-size: 16px;
    font-weight: 600;
    color: theme.$gray_6;
  }
  p {
    max-width: 420px;
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: theme.$gray_5;
  }
}
.runs-welcome-icon {
  color: theme.$purple_1;
}
.runs-welcome-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
}
.runs-welcome-link {
  font-size: 14px;
  color: theme.$link-color;
  text-decoration: none;

  &:hover {
    color: theme.$link-color-hover;
  }
}
.link-button {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: theme.$purple_3;
  text-decoration: underline;
  cursor: pointer;
}
.dashboard-empty-range {
  font-size: 13px;
  color: theme.$gray_4;
  padding: 16px 0;
}

.active-runs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.active-run-card {
  position: relative;
  background: theme.$white;
  border: 1px solid #67e8f9;
  border-radius: 4px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #06b6d4;
    box-shadow: 0 2px 8px rgba(6, 182, 212, 0.15);
  }
}

.active-run-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}
.active-run-action {
  width: 28px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #b3bcce;
  background: #fff;
  border-radius: 6px;
  padding: 0;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;

  &:hover {
    background: #e6e9ef;
    border-color: #011f5b;
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
.active-run-action--end:hover {
  background: #feeeec; /* red_tint */
  border-color: #c14d49; /* red_2 */
}
/* The play glyph fills the left half of its 0 0 20 12 viewBox — nudge to center. */
.active-run-action--play svg {
  transform: translateX(4px);
}

.active-run-name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
  margin-bottom: 6px;
}

.active-run-subtitle {
  font-size: 11px;
  color: theme.$gray_4;
  margin-top: -4px;
  margin-bottom: 6px;
}

.active-run-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}

.active-run-time {
  margin-left: auto;
  font-size: 11px;
}

.dashboard-stats {
  display: flex;
  gap: 16px;
}

.dash-stat {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
}

.dash-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: theme.$black;
  line-height: 1.2;
}

.dash-stat-green { color: #17BB62; }
.dash-stat-red { color: #e02d2d; }

.dash-stat-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_4;
  margin-top: 4px;
}






/* Status dots */
.run-status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-gray { background-color: theme.$gray_4; }
  &.dot-blue { background-color: #06b6d4; }
  &.dot-amber { background-color: #f59e0b; }
  &.dot-green { background-color: theme.$status_green; }
  &.dot-red { background-color: theme.$status_red; }
}

/* Rerun, at the end of a row of the earlier runs. */
.rerun-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: none;
  color: theme.$gray_4;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: theme.$purple_1;
    background: rgba(0, 0, 0, 0.05);
  }
}

.run-filter-select {
  width: 160px;
}

.run-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

:deep(.el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

</style>
