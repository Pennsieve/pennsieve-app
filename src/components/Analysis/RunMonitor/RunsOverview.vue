<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, getCurrentInstance } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import IconRotateRight from "../../icons/IconRotateRight.vue";
import IconInfoSmall from "../../icons/IconInfoSmall.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import { useMetricsCounters } from "@/composables/useMetricsCounters";
import toQueryParams from "@/utils/toQueryParams";
import {
  statusDotClass,
  statusLabel,
  isTerminalStatus,
  formatTime,
  computeNodeName as computeNodeNameFn,
  getUserName as getUserNameFn,
  runStatusOptions,
} from "./runHelpers";

const store = useStore();
const router = useRouter();
const pusher = getCurrentInstance()?.appContext.config.globalProperties.$pusher;

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
const workflows = computed(
  () => store.state.analysisModule.workflows || []
);
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
const accordionActiveNames = ref(["runs"]);
let analyticsChannel = null;
let analyticsChannelName = null;

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
const dashboardRuns = computed(() => workflowInstances.value);

const activeRuns = computed(() =>
  workflowInstances.value.filter((r) => r.status === "NOT_STARTED" || r.status === "STARTED" || r.status === "FINALIZING")
);

const recentCompletedRuns = computed(() =>
  dashboardRuns.value
    .filter((r) => isTerminalStatus(r.status))
    .sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt))
    .slice(0, 5)
);

const dashboardStats = computed(() => {
  const data = orgCounters.value;
  if (!data) return null;

  const bucket = data.allTime || data;
  if (!bucket || !bucket.totalRuns) return null;

  const total = bucket.totalRuns;
  const succeeded = bucket.succeeded || 0;
  const failed = bucket.failed || 0;
  const canceled = bucket.canceled || 0;
  const successRate = (succeeded + failed) > 0
    ? Math.round((succeeded / (succeeded + failed)) * 100)
    : 0;

  return { total, succeeded, failed, canceled, successRate };
});

/*
  Filtered Runs
*/
const filteredRuns = computed(() => {
  let runs = workflowInstances.value;
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
  router.push({ name: "run-detail", params: { runId: run.uuid } });
};

/*
  Wizard state
*/
const wizardVisible = ref(false);
const wizardStep = ref(0);
const wizardForm = ref({ workflowId: "", computeNodeId: "", datasetId: "" });
const rerunSource = ref(null);
const workflowSearch = ref("");
const computeNodeSearch = ref("");
const datasetOptions = ref([]);
const datasetSearchLoading = ref(false);
const datasetSearchQuery = ref("");
let datasetSearchTimer = null;
const wizardStepTitles = ["Select Workflow", "Select Compute Node", "Select Dataset", "Ready to Configure"];

const filteredWizardWorkflows = computed(() => {
  const q = workflowSearch.value.toLowerCase().trim();
  if (!q) return workflows.value;
  return workflows.value.filter(w =>
    w.name?.toLowerCase().includes(q) || w.description?.toLowerCase().includes(q)
  );
});

const filteredWizardComputeNodes = computed(() => {
  const q = computeNodeSearch.value.toLowerCase().trim();
  if (!q) return computeNodes.value;
  return computeNodes.value.filter(cn =>
    cn.name?.toLowerCase().includes(q) || cn.description?.toLowerCase().includes(q)
  );
});

const wizardSelectedWorkflow = computed(() =>
  workflows.value.find(w => w.uuid === wizardForm.value.workflowId) || null
);
const wizardSelectedComputeNode = computed(() =>
  computeNodes.value.find(cn => cn.uuid === wizardForm.value.computeNodeId) || null
);
const wizardSelectedDataset = computed(() =>
  datasetOptions.value.find(d => d.content?.id === wizardForm.value.datasetId) || null
);

const wizardCanNext = computed(() => {
  if (wizardStep.value === 0) return !!wizardForm.value.workflowId;
  if (wizardStep.value === 1) return !!wizardForm.value.computeNodeId;
  if (wizardStep.value === 2) return !!wizardForm.value.datasetId;
  return true;
});

const fetchDatasetOptions = async (query = "") => {
  datasetSearchLoading.value = true;
  try {
    const token = await useGetToken();
    const params = toQueryParams({
      limit: 25,
      offset: 0,
      query,
      orderBy: "IntId",
      orderDirection: "Desc",
      type: "research",
      api_key: token,
    });
    const url = `${config.value.apiUrl}/datasets/paginated?${params}`;
    const response = await useSendXhr(url);
    datasetOptions.value = response?.datasets || response || [];
  } catch (err) {
    console.error("Failed to fetch datasets:", err);
    datasetOptions.value = [];
  } finally {
    datasetSearchLoading.value = false;
  }
};

const onDatasetSearch = (query) => {
  clearTimeout(datasetSearchTimer);
  datasetSearchTimer = setTimeout(() => fetchDatasetOptions(query), 300);
};

const openWizardDialog = () => {
  wizardForm.value = { workflowId: "", computeNodeId: "", datasetId: "" };
  workflowSearch.value = "";
  computeNodeSearch.value = "";
  datasetSearchQuery.value = "";
  wizardStep.value = 0;
  rerunSource.value = null;
  wizardVisible.value = true;
  fetchDatasetOptions();
};

const rerunFromRun = async (run) => {
  try {
    await store.dispatch("analysisModule/setSelectedWorkflowActivity", run);
    const fullRun = store.getters["analysisModule/selectedWorkflowActivity"];
    rerunSource.value = fullRun || run;
  } catch {
    rerunSource.value = run;
  }

  wizardForm.value = {
    workflowId: run.workflowUuid || "",
    computeNodeId: run.computeNodeUuid || "",
    datasetId: run.datasetId || "",
  };
  workflowSearch.value = "";
  computeNodeSearch.value = "";
  wizardStep.value = 3;
  wizardVisible.value = true;
  fetchDatasetOptions();
};

const wizardNext = () => {
  if (wizardStep.value < 3) wizardStep.value++;
};

const wizardBack = () => {
  if (wizardStep.value > 0) wizardStep.value--;
};

const wizardConfirm = () => {
  store.commit("analysisModule/SET_PENDING_RUN_CONFIG", {
    workflowId: wizardForm.value.workflowId,
    computeNodeId: wizardForm.value.computeNodeId,
    datasetId: wizardForm.value.datasetId,
    rerunSource: rerunSource.value,
  });
  wizardVisible.value = false;
  router.push({ name: "run-configure" });
};

/*
  Pusher event handlers (run-level only)
*/
const parsePusherData = (data) => {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
};

const onRunStatusUpdate = async (raw) => {
  const data = parsePusherData(raw);
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
    ]);
  } catch (err) {
    console.error("Failed to load data:", err);
  } finally {
    isLoading.value = false;
  }

  if (pusher) {
    const rawOrgId = store.state.activeOrganization?.organization?.id;
    const rawUserId = store.state.profile?.id;
    const orgUuid = rawOrgId?.replace(/^N:organization:/, '');
    const userUuid = rawUserId?.replace(/^N:user:/, '');
    analyticsChannelName = orgUuid
      ? `organization-${orgUuid}-analytics`
      : `user-${userUuid}-analytics`;

    analyticsChannel = pusher.subscribe(analyticsChannelName);
    analyticsChannel.bind("workflow-run-status", onRunStatusUpdate);
  }
});

onBeforeUnmount(() => {
  if (analyticsChannel) {
    analyticsChannel.unbind("workflow-run-status", onRunStatusUpdate);
    if (pusher && analyticsChannelName) {
      pusher.unsubscribe(analyticsChannelName);
    }
    analyticsChannel = null;
    analyticsChannelName = null;
  }
});
</script>

<template>
  <div class="runs-overview">
    <!-- Header -->
    <div class="builder-header">
      <div class="header-actions">
        <bf-button @click="openWizardDialog">Initiate Workflow</bf-button>
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
              <div class="active-run-name">{{ run.workflowName || 'Unnamed workflow' }}</div>
              <div class="active-run-meta">
                <span class="run-status-dot" :class="statusDotClass(run.status)" />
                <span>{{ statusLabel(run.status) }}</span>
                <span class="active-run-time">{{ formatTime(run.startedAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Aggregate Stats -->
        <div class="dashboard-section">
          <div class="dashboard-section-header">
            <h3 class="dashboard-section-title">
              Overview
              <el-tooltip content="Metrics update approximately every 15 minutes" placement="top">
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
            No runs in this time range
          </div>
        </div>

        <!-- Recent Completions -->
        <div v-if="recentCompletedRuns.length > 0" class="dashboard-section">
          <h3 class="dashboard-section-title">Recent Completions</h3>
          <div class="recent-runs-list">
            <div
              v-for="run in recentCompletedRuns"
              :key="run.uuid"
              class="recent-run-row"
              @click="selectRun(run)"
            >
              <span class="run-status-dot" :class="statusDotClass(run.status)" />
              <span class="recent-run-name">{{ run.workflowName || 'Unnamed' }}</span>
              <span class="recent-run-status">{{ statusLabel(run.status) }}</span>
              <span class="recent-run-time">{{ formatTime(run.completedAt || run.startedAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Empty fallback -->
        <div v-if="!dashboardStats && activeRuns.length === 0" class="empty-canvas">
          <h3>No runs yet</h3>
          <p>Initiate a workflow to see run activity here</p>
        </div>
      </div>

      <!-- Sidebar: Runs list -->
      <div class="applications-sidebar">
        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <el-collapse-item title="Runs" name="runs">
            <div class="filter-bar">
              <el-select
                v-model="statusFilter"
                placeholder="Filter by status"
                size="small"
                class="run-filter-select"
              >
                <el-option
                  v-for="opt in runStatusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-select
                v-model="workflowFilter"
                placeholder="Filter by workflow"
                size="small"
                class="run-filter-select"
              >
                <el-option label="All Workflows" value="all" />
                <el-option
                  v-for="wf in workflows"
                  :key="wf.uuid"
                  :label="wf.name"
                  :value="wf.uuid"
                />
              </el-select>
              <el-select
                v-model="computeNodeFilter"
                placeholder="Filter by compute node"
                size="small"
                class="run-filter-select"
              >
                <el-option label="All Compute Nodes" value="all" />
                <el-option
                  v-for="cn in computeNodes"
                  :key="cn.uuid"
                  :label="cn.name"
                  :value="cn.uuid"
                />
              </el-select>
            </div>

            <div v-if="isLoading" class="loading">Loading runs...</div>
            <div v-else class="workflow-list">
              <div
                v-for="run in filteredRuns"
                :key="run.uuid"
                class="workflow-list-item"
                @click="selectRun(run)"
              >
                <span class="run-status-dot" :class="statusDotClass(run.status)"></span>
                <div class="wf-item-info">
                  <div class="wf-item-name">{{ formatTime(run.startedAt) }}</div>
                  <div class="wf-item-meta">{{ run.workflowName || 'Unnamed workflow' }}</div>
                  <div class="wf-item-meta">{{ computeNodeName(run.computeNodeUuid) }}</div>
                  <div class="wf-item-meta">{{ getUserName(run.createdBy) }}</div>
                </div>
                <button
                  class="rerun-btn"
                  title="Rerun with this configuration"
                  @click.stop="rerunFromRun(run)"
                >
                  <IconRotateRight :width="16" :height="16" />
                </button>
              </div>
              <div v-if="filteredRuns.length === 0" class="workflow-list-empty">
                No runs found
              </div>
              <button
                v-if="hasMoreRuns"
                class="load-more-btn"
                :disabled="isLoadingMore"
                @click="loadMoreRuns"
              >
                {{ isLoadingMore ? 'Loading...' : 'Load more runs' }}
              </button>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <!-- Wizard Dialog -->
    <el-dialog
      v-model="wizardVisible"
      :title="wizardStepTitles[wizardStep]"
      width="560px"
      :close-on-click-modal="false"
    >
      <div class="wizard-body">
        <!-- Progress dots -->
        <div class="wizard-progress">
          <span
            v-for="(title, i) in wizardStepTitles"
            :key="i"
            class="wizard-dot"
            :class="{ active: wizardStep === i, done: wizardStep > i }"
          ></span>
        </div>

        <!-- Step 0: Workflow -->
        <div v-if="wizardStep === 0" class="wizard-step">
          <p class="wizard-step-desc">Choose a workflow definition to run.</p>
          <div v-if="wizardSelectedWorkflow" class="wizard-selection">
            <div class="wizard-selection-header">
              <span class="wizard-selection-name">{{ wizardSelectedWorkflow.name }}</span>
              <button class="wizard-selection-clear" @click="wizardForm.workflowId = ''">&times;</button>
            </div>
            <div v-if="wizardSelectedWorkflow.description" class="wizard-selection-desc">{{ wizardSelectedWorkflow.description }}</div>
            <div class="wizard-selection-meta">{{ (wizardSelectedWorkflow.dag || []).length }} processors</div>
          </div>
          <template v-else>
            <el-input
              v-model="workflowSearch"
              placeholder="Filter workflows..."
              clearable
              class="wizard-search"
            />
            <div class="wizard-cards">
              <div
                v-for="wf in filteredWizardWorkflows"
                :key="wf.uuid"
                class="wizard-card"
                :class="{ disabled: !wf.isActive }"
                @click="wf.isActive && (wizardForm.workflowId = wf.uuid, workflowSearch = '')"
              >
                <div class="wizard-card-name">{{ wf.name }}</div>
                <div v-if="wf.description" class="wizard-card-desc">{{ wf.description }}</div>
                <div class="wizard-card-meta">
                  {{ (wf.dag || []).length }} processors
                  <span v-if="!wf.isActive" class="wizard-card-badge">Archived</span>
                </div>
              </div>
              <div v-if="filteredWizardWorkflows.length === 0" class="wizard-cards-loading">No workflows found</div>
            </div>
          </template>
        </div>

        <!-- Step 1: Compute Node -->
        <div v-if="wizardStep === 1" class="wizard-step">
          <p class="wizard-step-desc">Select the compute node to execute the workflow on.</p>
          <div v-if="wizardSelectedComputeNode" class="wizard-selection">
            <div class="wizard-selection-header">
              <span class="wizard-selection-name">{{ wizardSelectedComputeNode.name }}</span>
              <button class="wizard-selection-clear" @click="wizardForm.computeNodeId = ''">&times;</button>
            </div>
            <div v-if="wizardSelectedComputeNode.description" class="wizard-selection-desc">{{ wizardSelectedComputeNode.description }}</div>
          </div>
          <template v-else>
            <el-input
              v-model="computeNodeSearch"
              placeholder="Filter compute nodes..."
              clearable
              class="wizard-search"
            />
            <div class="wizard-cards">
              <div
                v-for="cn in filteredWizardComputeNodes"
                :key="cn.uuid"
                class="wizard-card"
                @click="wizardForm.computeNodeId = cn.uuid"
              >
                <div class="wizard-card-name">{{ cn.name }}</div>
                <div v-if="cn.description" class="wizard-card-desc">{{ cn.description }}</div>
              </div>
              <div v-if="filteredWizardComputeNodes.length === 0" class="wizard-cards-loading">No compute nodes found</div>
            </div>
          </template>
        </div>

        <!-- Step 2: Dataset -->
        <div v-if="wizardStep === 2" class="wizard-step">
          <p class="wizard-step-desc">Search and select the dataset to process.</p>
          <div v-if="wizardSelectedDataset" class="wizard-selection">
            <div class="wizard-selection-header">
              <span class="wizard-selection-name">{{ wizardSelectedDataset.content?.name }}</span>
              <button class="wizard-selection-clear" @click="wizardForm.datasetId = ''">&times;</button>
            </div>
            <div v-if="wizardSelectedDataset.content?.description" class="wizard-selection-desc">{{ wizardSelectedDataset.content.description }}</div>
          </div>
          <template v-else>
            <el-input
              v-model="datasetSearchQuery"
              placeholder="Search datasets..."
              clearable
              class="wizard-search"
              @input="onDatasetSearch"
            />
            <div class="wizard-cards">
              <div v-if="datasetSearchLoading" class="wizard-cards-loading">Searching...</div>
              <div
                v-for="ds in datasetOptions"
                :key="ds.content?.id"
                class="wizard-card"
                @click="wizardForm.datasetId = ds.content?.id"
              >
                <div class="wizard-card-name">{{ ds.content?.name }}</div>
                <div v-if="ds.content?.description" class="wizard-card-desc">{{ ds.content.description }}</div>
              </div>
              <div v-if="!datasetSearchLoading && datasetOptions.length === 0" class="wizard-cards-loading">No datasets found</div>
            </div>
          </template>
        </div>

        <!-- Step 3: Confirm -->
        <div v-if="wizardStep === 3" class="wizard-step">
          <p class="wizard-step-desc">Review your selections before proceeding.</p>
          <div class="wizard-summary">
            <div class="wizard-summary-row">
              <span class="wizard-summary-label">Workflow</span>
              <span class="wizard-summary-value">{{ wizardSelectedWorkflow?.name || wizardForm.workflowId }}</span>
            </div>
            <div class="wizard-summary-row">
              <span class="wizard-summary-label">Compute Node</span>
              <span class="wizard-summary-value">{{ wizardSelectedComputeNode?.name || wizardForm.computeNodeId }}</span>
            </div>
            <div class="wizard-summary-row">
              <span class="wizard-summary-label">Dataset</span>
              <span class="wizard-summary-value">{{ wizardSelectedDataset?.content?.name || wizardForm.datasetId }}</span>
            </div>
          </div>
          <div v-if="rerunSource" class="wizard-hint">
            All processor parameters and execution targets will be copied from the previous run. You will still need to configure <strong>data source</strong> nodes to select files before executing.
          </div>
          <div v-else class="wizard-hint">
            After clicking <strong>Configure</strong>, you will be able to click on <strong>data source</strong> nodes to select files, and on <strong>processor</strong> nodes to adjust settings before executing the run.
          </div>
        </div>
      </div>

      <template #footer>
        <div class="run-dialog-footer">
          <bf-button class="secondary" @click="wizardVisible = false">Cancel</bf-button>
          <div class="wizard-footer-right">
            <bf-button v-if="wizardStep > 0" class="secondary" @click="wizardBack">Back</bf-button>
            <bf-button v-if="wizardStep < 3" :disabled="!wizardCanNext" @click="wizardNext">Next</bf-button>
            <bf-button v-else @click="wizardConfirm">Configure</bf-button>
          </div>
        </div>
      </template>
    </el-dialog>
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

.runs-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  background: theme.$gray_1;
}

.empty-canvas {
  text-align: center;
  color: theme.$gray_4;
  padding: 60px 20px;

  h3 { margin: 0 0 10px 0; }
  p { margin: 0; font-size: 14px; }
}

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

.active-run-name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
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

.recent-runs-list {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  overflow: hidden;
}

.recent-run-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid theme.$gray_2;
  transition: background 0.15s;

  &:last-child { border-bottom: none; }
  &:hover { background: theme.$gray_1; }
}

.recent-run-name {
  font-weight: 500;
  color: theme.$black;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-run-status {
  font-size: 12px;
  color: theme.$gray_4;
  white-space: nowrap;
}

.recent-run-time {
  font-size: 12px;
  color: theme.$gray_4;
  white-space: nowrap;
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

/* Sidebar */
.applications-sidebar {
  width: 350px;
  background-color: theme.$white;
  border-left: 1px solid theme.$gray_2;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .loading {
    text-align: center;
    padding: 20px;
    color: theme.$gray_4;
  }
}

.sidebar-accordion { border-top: none; }

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.run-filter-select { width: 100%; }

.workflow-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.workflow-list-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .wf-item-info {
    flex: 1;
    min-width: 0;
  }

  .rerun-btn {
    background: none;
    border: none;
    color: theme.$gray_4;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s, background 0.15s;
    flex-shrink: 0;
    align-self: center;

    &:hover {
      color: theme.$purple_1;
      background: rgba(0, 0, 0, 0.05);
    }
  }

  &:hover .rerun-btn {
    opacity: 1;
  }

  .wf-item-name {
    font-weight: 600;
    font-size: 13px;
    color: theme.$black;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .wf-item-meta {
    font-size: 11px;
    color: theme.$gray_4;
    margin-top: 2px;
  }
}

.workflow-list-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.load-more-btn {
  display: block;
  width: 100%;
  padding: 10px;
  border: none;
  background: none;
  color: theme.$purple_1;
  font-size: 13px;
  cursor: pointer;
  border-top: 1px solid theme.$gray_2;

  &:hover:not(:disabled) {
    background: theme.$gray_1;
  }

  &:disabled {
    color: theme.$gray_4;
    cursor: default;
  }
}

/* Dialogs */
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

/* Wizard dialog */
.wizard-body {
  min-height: 320px;
  display: flex;
  flex-direction: column;
}

.wizard-progress {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
}

.wizard-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: theme.$gray_2;
  transition: background 0.2s;

  &.active {
    background: theme.$purple_1;
  }

  &.done {
    background: theme.$green_1;
  }
}

.wizard-step {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.wizard-step-desc {
  font-size: 13px;
  color: theme.$gray_4;
  margin: 0 0 16px 0;
}

.wizard-selection {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  background: theme.$purple_tint;
  border: 1px solid theme.$purple_1;
  margin-bottom: 8px;
}

.wizard-selection-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wizard-selection-name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.wizard-selection-desc {
  font-size: 12px;
  color: theme.$gray_5;
  line-height: 1.4;
}

.wizard-selection-meta {
  font-size: 11px;
  color: theme.$gray_4;
  margin-top: 2px;
}

.wizard-selection-clear {
  background: none;
  border: none;
  font-size: 16px;
  color: theme.$gray_4;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;

  &:hover {
    color: theme.$black;
  }
}

.wizard-search {
  margin-bottom: 12px;
}

.wizard-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.wizard-cards-loading {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.wizard-card {
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover:not(.disabled) {
    border-color: theme.$gray_3;
    background: theme.$gray_1;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.wizard-card-name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
  margin-bottom: 2px;
}

.wizard-card-desc {
  font-size: 12px;
  color: theme.$gray_4;
  line-height: 1.4;
  margin-bottom: 4px;
}

.wizard-card-meta {
  font-size: 11px;
  color: theme.$gray_4;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wizard-card-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_2;
  color: theme.$gray_5;
}

.wizard-summary {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid theme.$gray_2;
  overflow: hidden;
  margin-bottom: 16px;
}

.wizard-summary-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 13px;

  &:not(:last-child) {
    border-bottom: 1px solid theme.$gray_2;
  }
}

.wizard-summary-label {
  color: theme.$gray_4;
  font-weight: 500;
}

.wizard-summary-value {
  color: theme.$black;
  font-weight: 600;
}

.wizard-hint {
  padding: 12px 14px;
  background: theme.$yellow_tint;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;
}

.wizard-footer-right {
  display: flex;
  gap: 8px;
}
</style>
