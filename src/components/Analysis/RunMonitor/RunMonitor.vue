<script setup>
import { computed, ref, reactive, onMounted, onBeforeUnmount, onUnmounted, getCurrentInstance } from "vue";
import { useStore } from "vuex";
import { useVueFlow, VueFlow, Handle, Position } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "@dagrejs/dagre";
import EventBus from "../../../utils/event-bus";
import BfButton from "../../shared/bf-button/BfButton.vue";
import IconRotateRight from "../../icons/IconRotateRight.vue";
import AnalysisFilesTable from "../../FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "../../datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";

const { onNodeClick, onPaneClick, fitView, updateNodeData } = useVueFlow();

const store = useStore();
const pusher = getCurrentInstance()?.appContext.config.globalProperties.$pusher;

/*
  Local State
*/
const mode = ref("browse"); // 'browse' | 'configure'
const selectedRun = ref(null);
const selectedNode = ref(null);
const computeNodeFilter = ref("all");
const accordionActiveNames = ref(["runs"]);
const nodes = ref([]);
const edges = ref([]);
const isLoading = ref(false);
const isLoadingMore = ref(false);
let analyticsChannel = null;
let analyticsChannelName = null;

// Initiate Workflow dialog state
const initiateForm = ref({
  workflowId: "",
  computeNodeId: "",
  datasetId: "",
});
const wizardVisible = ref(false);
const wizardStep = ref(0); // 0=workflow, 1=compute, 2=dataset, 3=confirm
const wizardForm = ref({ workflowId: "", computeNodeId: "", datasetId: "" });

// Configure mode state
const configDefinition = ref(null); // the workflow definition fetched for configuration
const dataSourceFiles = reactive({}); // { [nodeId]: File[] }
const nodeConfigs = reactive({}); // { [nodeId]: { executionTarget, version, params: [{ key, value }] } }
const isExecuting = ref(false);
const rerunSource = ref(null); // the run object to copy config from when rerunning

// File picker dialog state
const filePickerVisible = ref(false);
const filePickerNodeId = ref(null);
const filePickerFiles = ref([]);
const filePickerAncestorList = ref([]);

// Logs dialog state
const logsDialogVisible = ref(false);
const logsMessages = ref([]);
const logsLoading = ref(false);
const logsNodeLabel = ref("");

// Metrics dialog state
const metricsDialogVisible = ref(false);
const durationDialogVisible = ref(false);
const nodeMetricsDialogVisible = ref(false);
const cancelRunDialogVisible = ref(false);
const cancellingRun = ref(false);
const filePickerCurrentFile = ref({ content: { name: "" } });
const clearSelectedValues = ref(false);

/*
  Store computed
*/
const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"] || []
);
const hasMoreRuns = computed(
  () => !!store.getters["analysisModule/workflowInstancesCursor"]
);
const selectedWorkflowActivity = computed(
  () => store.getters["analysisModule/selectedWorkflowActivity"]
);
const computeNodes = computed(
  () => store.getters["analysisModule/computeNodes"] || []
);
const workflows = computed(
  () => store.state.analysisModule.workflows || []
);
const selectedProcessor = computed(
  () => store.getters["analysisModule/selectedProcessor"]
);
const availableApplications = computed(
  () => store.getters["analysisModule/applications"] || []
);
const targetTypes = computed(
  () => store.getters["analysisModule/targetTypes"] || []
);

const getComputeTypesForTarget = (targetType) => {
  if (!targetType) return [];
  const tt = targetTypes.value.find((t) => t.targetType === targetType);
  return tt?.computeTypes || [];
};

const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);
const config = computed(() => store.state.config);

/*
  Run title: workflow definition name + run date/time
*/
const runTimeLabel = computed(() => {
  const run = selectedRun.value;
  if (!run) return '';
  const activity = selectedWorkflowActivity.value;
  const timeStr = formatTime(activity?.startedAt || run.startedAt);
  return timeStr !== 'N/A' ? timeStr : run.uuid;
});

const runWorkflowName = computed(() => {
  const run = selectedRun.value;
  if (!run) return '';
  const activity = selectedWorkflowActivity.value;
  return activity?.workflowName || run.workflowName || '';
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
  In configure mode, check which data-source nodes still need files
*/
const dataSourceNodes = computed(() => {
  if (mode.value !== "configure" || !configDefinition.value) return [];
  return (configDefinition.value.dag || []).filter((d) => d.type === "data-source");
});

const allDataSourcesHaveFiles = computed(() => {
  if (dataSourceNodes.value.length === 0) return true;
  return dataSourceNodes.value.every(
    (d) => dataSourceFiles[d.id] && dataSourceFiles[d.id].length > 0
  );
});

/*
  DAG Layout
*/
const NODE_WIDTH = 280;
const NODE_HEIGHT = 80;

const autoLayout = () => {
  if (nodes.value.length === 0) return;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 120, ranksep: 150 });

  for (const node of nodes.value) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges.value) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  nodes.value = nodes.value.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  setTimeout(() => fitView({ padding: 0.2 }), 50);
};

/*
  Status helpers
*/
const statusClass = (status) => {
  switch (status) {
    case "NOT_STARTED": return "gray-node";
    case "STARTED": return "blue-node animate";
    case "SUCCEEDED": return "green-node";
    case "FAILED": return "red-node";
    default: return "gray-node";
  }
};

const statusBorderColor = (status) => {
  switch (status) {
    case "NOT_STARTED": return "#999999";
    case "STARTED": return "#3b82f6";
    case "SUCCEEDED": return "#17BB62";
    case "FAILED": return "#E94B4B";
    default: return "#999999";
  }
};

const nodeBorderColor = (type, status) => {
  if (status) return statusBorderColor(status);
  if (type === "data-source") return "#6366f1";
  if (type === "data-target") return "#64748b";
  return "#cccccc";
};

const statusDotClass = (status) => {
  switch (status) {
    case "NOT_STARTED": return "dot-gray";
    case "STARTED": return "dot-blue";
    case "SUCCEEDED": return "dot-green";
    case "FAILED": return "dot-red";
    default: return "dot-gray";
  }
};

const statusLabel = (status) => {
  switch (status) {
    case "NOT_STARTED": return "Pending";
    case "STARTED": return "Running";
    case "SUCCEEDED": return "Complete";
    case "FAILED": return "Failed";
    case "CANCELLED": return "Cancelled";
    default: return status || "Unknown";
  }
};

const isTerminalStatus = (status) => {
  return ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
};

/*
  Label helpers
*/
const extractRepoName = (gitUrl) => {
  if (!gitUrl) return "";
  const parts = gitUrl.split("/");
  const name = parts[parts.length - 1] || gitUrl;
  return name.replace(/\.git$/, "");
};

const normalizeUrl = (url) => {
  if (!url) return "";
  return url.replace(/\.git$/, "").replace(/\/$/, "");
};

const findAppByUrl = (sourceUrl) => {
  if (!sourceUrl) return null;
  const normalized = normalizeUrl(sourceUrl);
  return (
    availableApplications.value.find(
      (app) => normalizeUrl(app.source?.url) === normalized
    ) || null
  );
};

const labelForDagNode = (d) => {
  if (d.type === "data-source") return "Data Source";
  if (d.type === "data-target") return d.targetType || "Data Target";
  const matchedApp = findAppByUrl(d.sourceUrl);
  return matchedApp ? matchedApp.name : extractRepoName(d.sourceUrl) || d.type || d.id;
};

/*
  Convert a workflow definition's dag to VueFlow nodes/edges (for configure mode)
*/
const definitionToNodesAndEdges = (definition) => {
  const dag = definition.dag || definition.processors || [];
  if (dag.length === 0) return { nodes: [], edges: [], needsAutoLayout: true };

  const hasSavedPositions = dag.some(
    (d) => d.position && typeof d.position.x === "number"
  );

  const resultNodes = dag.map((d) => {
    const nodeType = d.type === "data-source" ? "data-source" : d.type === "data-target" ? "data-target" : "default";
    return {
      id: d.id,
      type: nodeType,
      data: {
        label: labelForDagNode(d),
        nodeType: d.type,
        sourceUrl: d.sourceUrl,
        targetType: d.targetType || null,
        computeType: d.computeType || getComputeTypesForTarget(d.targetType)?.[0] || null,
      },
      position:
        hasSavedPositions && d.position && typeof d.position.x === "number"
          ? { x: d.position.x, y: d.position.y }
          : { x: 0, y: 0 },
    };
  });

  const dagMap = Object.fromEntries(dag.map((d) => [d.id, d]));
  const resultEdges = [];
  for (const d of dag) {
    for (const dep of d.dependsOn || []) {
      const srcNode = dagMap[dep];
      resultEdges.push({
        id: `e${dep}-${d.id}`,
        source: dep,
        target: d.id,
        animated: false,
        style: { stroke: nodeBorderColor(srcNode?.type, null) },
      });
    }
  }

  return { nodes: resultNodes, edges: resultEdges, needsAutoLayout: !hasSavedPositions };
};

/*
  Convert run data to VueFlow nodes/edges (for browse mode).
  The dag array from GET /runs/{runId} is the source of truth.
  Status is merged from the enriched workflow array.
*/
const runToNodesAndEdges = (run) => {
  const dag = run.dag || [];
  if (dag.length === 0) return { nodes: [], edges: [], needsAutoLayout: true };

  // Status is now merged directly onto each dag node by the store.
  const hasSavedPositions = dag.some(
    (d) => d.position && typeof d.position.x === "number"
  );

  const runDataSources = run.dataSources || {};
  const runDataTargets = run.dataTargets || {};
  const runProcessorConfigs = run.processorConfigs || [];

  const resultNodes = dag.map((d) => {
    const nodeType = d.type === "data-source" ? "data-source"
      : d.type === "data-target" ? "data-target"
      : "default";

    // Enrich node data based on type
    const extra = {};
    if (d.type === "data-source") {
      const src = runDataSources[d.id];
      extra.packageCount = src?.packageIds?.length || 0;
    } else if (d.type === "data-target") {
      extra.targetType = d.targetType || null;
      const cfg = runProcessorConfigs.find((c) => c.nodeId === d.id);
      extra.computeType = cfg?.executionTarget || d.computeType || null;
    } else {
      const cfg = runProcessorConfigs.find((c) => c.nodeId === d.id);
      extra.executionTarget = cfg?.executionTarget || null;
    }

    return {
      id: d.id,
      type: nodeType,
      data: {
        label: labelForDagNode(d),
        status: d.status || "NOT_STARTED",
        processorType: d.type,
        sourceUrl: d.sourceUrl,
        startedAt: d.startedAt,
        completedAt: d.completedAt,
        ...extra,
      },
      position:
        hasSavedPositions && d.position && typeof d.position.x === "number"
          ? { x: d.position.x, y: d.position.y }
          : { x: 0, y: 0 },
    };
  });

  const dagMap = Object.fromEntries(dag.map((d) => [d.id, d]));
  const resultEdges = [];
  for (const d of dag) {
    for (const dep of d.dependsOn || []) {
      const srcNode = dagMap[dep];
      resultEdges.push({
        id: `e${dep}-${d.id}`,
        source: dep,
        target: d.id,
        animated: false,
        style: { stroke: nodeBorderColor(srcNode?.type, srcNode?.status) },
      });
    }
  }

  return { nodes: resultNodes, edges: resultEdges, needsAutoLayout: !hasSavedPositions };
};

/*
  Pusher event handlers
*/
const parsePusherData = (data) => {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
};

const onRunStatusUpdate = async (raw) => {
  const data = parsePusherData(raw);

  // Update the run in the instances list
  store.commit("analysisModule/UPDATE_RUN_STATUS", {
    runId: data.runId,
    status: data.status,
  });

  // If this is the currently selected run, update the detailed view
  const currentRunId = selectedWorkflowActivity.value?.uuid;
  if (data.runId === currentRunId) {
    if (isTerminalStatus(data.status)) {
      // Update status immediately so the UI reflects terminal state
      store.commit("analysisModule/SET_SELECTED_WORKFLOW_ACTIVITY", {
        ...selectedWorkflowActivity.value,
        status: data.status,
      });

      // Delay to allow DynamoDB eventual consistency before fetching metrics
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Full refresh to fetch metrics/costs from the run instance endpoint
      await store.dispatch(
        "analysisModule/setSelectedWorkflowActivity",
        selectedWorkflowActivity.value
      );
      const activity = selectedWorkflowActivity.value;
      if (activity?.dag?.length > 0) {
        const result = runToNodesAndEdges(activity);
        const posMap = new Map();
        nodes.value.forEach((n) => posMap.set(n.id, n.position));
        nodes.value = result.nodes.map((n) => ({
          ...n,
          position: posMap.get(n.id) || n.position,
        }));
        if (result.edges.length > 0) {
          edges.value = result.edges;
        }
      }
    } else {
      // Non-terminal: update status in-place
      store.commit("analysisModule/SET_SELECTED_WORKFLOW_ACTIVITY", {
        ...selectedWorkflowActivity.value,
        status: data.status,
      });
    }
  }
};

const onProcessorStatusUpdate = (raw) => {
  const data = parsePusherData(raw);
  const currentRunId = selectedWorkflowActivity.value?.uuid;
  if (data.runId !== currentRunId) return;

  // Update node status in store
  store.commit("analysisModule/UPDATE_NODE_STATUS", {
    nodeId: data.nodeId,
    status: data.status,
  });

  // Update VueFlow node styling via VueFlow's own API
  updateNodeData(data.nodeId, { status: data.status });

  // Update edge colors for edges sourced from this node
  edges.value = edges.value.map((edge) => {
    if (edge.source === data.nodeId) {
      return {
        ...edge,
        style: { ...edge.style, stroke: statusBorderColor(data.status) },
      };
    }
    return edge;
  });
};

/*
  Select a run (browse mode)
*/
const selectRun = async (run) => {
  if (mode.value === "configure") return; // don't switch away mid-configure
  mode.value = "browse";
  selectedRun.value = run;
  selectedNode.value = null;
  accordionActiveNames.value = ["information", "runs"];

  try {
    await store.dispatch("analysisModule/setSelectedWorkflowActivity", run);

    const activity = selectedWorkflowActivity.value;
    if (activity && activity.dag && activity.dag.length > 0) {
      const result = runToNodesAndEdges(activity);
      nodes.value = result.nodes;
      edges.value = result.edges;

      if (result.needsAutoLayout) {
        autoLayout();
      } else {
        setTimeout(() => fitView({ padding: 0.2 }), 50);
      }
    }
  } catch (err) {
    console.error("Failed to load run details:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to load run details." },
    });
  }
};

const loadMoreRuns = async () => {
  isLoadingMore.value = true;
  try {
    await store.dispatch("analysisModule/fetchMoreWorkflowInstances");
  } catch (err) {
    console.error("Failed to load more runs:", err);
  } finally {
    isLoadingMore.value = false;
  }
};

/*
  Node click handlers
*/
onNodeClick(({ node }) => {
  nodes.value.forEach((n) => (n.selected = false));
  const target = nodes.value.find((n) => n.id === node.id);
  if (target) target.selected = true;
  selectedNode.value = node;

  if (mode.value === "configure") {
    // Data-source node → open file picker
    if (node.type === "data-source") {
      openFilePicker(node.id);
      return;
    }
    // Processor node → show config in sidebar
    if (!accordionActiveNames.value.includes("information")) {
      accordionActiveNames.value = [...accordionActiveNames.value, "information"];
    }
    return;
  }

  // Browse mode — update selected processor in store
  const activity = selectedWorkflowActivity.value;
  if (activity && activity.dag) {
    const proc = activity.dag.find((p) => p.id === node.id);
    if (proc) {
      store.dispatch("analysisModule/setSelectedProcessor", proc);
    }
  }

  if (!accordionActiveNames.value.includes("information")) {
    accordionActiveNames.value = [...accordionActiveNames.value, "information"];
  }
});

onPaneClick(() => {
  nodes.value.forEach((n) => (n.selected = false));
  selectedNode.value = null;
});

/*
  Initiate Workflow dialog — dataset search
*/
const datasetOptions = ref([]);
const datasetSearchLoading = ref(false);
let datasetSearchTimer = null;

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

/*
  Wizard dialog helpers
*/
const wizardStepTitles = ["Select Workflow", "Select Compute Node", "Select Dataset", "Ready to Configure"];

const workflowSearch = ref("");
const computeNodeSearch = ref("");

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

const openWizardDialog = () => {
  wizardForm.value = { workflowId: "", computeNodeId: "", datasetId: "" };
  workflowSearch.value = "";
  computeNodeSearch.value = "";
  wizardStep.value = 0;
  rerunSource.value = null;
  accordionActiveNames.value = ["information"];
  wizardVisible.value = true;
  fetchDatasetOptions();
};

const rerunFromRun = async (run) => {
  // Fetch full run details to get dag config, processorParams, etc.
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
  wizardStep.value = 3; // jump to confirmation
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
  // Copy wizard selections into initiateForm and trigger the existing flow
  initiateForm.value = { ...wizardForm.value };
  wizardVisible.value = false;
  initiateWorkflow();
};

const initiateWorkflow = async () => {
  const { workflowId, computeNodeId, datasetId } = initiateForm.value;
  if (!workflowId || !computeNodeId || !datasetId) {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Please select a workflow, compute node, and dataset." },
    });
    return;
  }

  try {
    // Fetch the workflow definition to get the DAG
    const definition = await store.dispatch(
      "analysisModule/fetchWorkflowDefinition",
      workflowId
    );

    configDefinition.value = definition;
    wizardVisible.value = false;

    // Reset configuration state
    Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
    Object.keys(nodeConfigs).forEach((k) => delete nodeConfigs[k]);

    // Initialize nodeConfigs for each processor and data-target node
    const dag = definition.dag || definition.processors || [];
    const source = rerunSource.value;
    const sourceConfigs = source?.processorConfigs || [];
    const sourceParams = source?.processorParams || {};

    dag.forEach((d) => {
      const srcCfg = sourceConfigs.find((c) => c.nodeId === d.id);
      const srcParams = sourceParams[d.id] || {};

      if (d.type === "data-target") {
        const fallback = getComputeTypesForTarget(d.targetType)?.[0] || null;
        const srcTargetParams = source?.dataTargets?.[d.id]?.params || {};
        const targetParams = Object.entries(srcTargetParams).map(([key, value]) => ({ key, value: String(value) }));
        nodeConfigs[d.id] = {
          computeType: srcCfg?.executionTarget || d.computeType || fallback,
          targetType: d.targetType || null,
          params: targetParams,
        };
      } else if (d.type !== "data-source") {
        const params = Object.entries(srcParams).map(([key, value]) => ({ key, value: String(value) }));
        nodeConfigs[d.id] = {
          executionTarget: srcCfg?.executionTarget || "lambda",
          version: srcCfg?.version || "",
          params,
        };
      }
    });

    // Clear rerun source after applying
    rerunSource.value = null;

    // Render the definition DAG on canvas
    const result = definitionToNodesAndEdges(definition);
    nodes.value = result.nodes;
    edges.value = result.edges;

    if (result.needsAutoLayout) {
      autoLayout();
    } else {
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    }

    // Enter configure mode
    mode.value = "configure";
    selectedRun.value = null;
    selectedNode.value = null;
    accordionActiveNames.value = ["information"];
  } catch (err) {
    console.error("Failed to load workflow definition:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to load workflow definition." },
    });
  }
};

const cancelConfigure = () => {
  mode.value = "browse";
  configDefinition.value = null;
  Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
  Object.keys(nodeConfigs).forEach((k) => delete nodeConfigs[k]);
  nodes.value = [];
  edges.value = [];
  selectedNode.value = null;
  accordionActiveNames.value = ["runs"];
};

/*
  Execute Workflow — actually create the run
*/
const executeWorkflow = async () => {
  isExecuting.value = true;
  try {
    // Build dataSources map (top-level): { nodeId: { packageIds: [...] } }
    const dataSources = {};
    Object.entries(dataSourceFiles).forEach(([nodeId, files]) => {
      const ids = files.map((f) => f.content?.id).filter(Boolean);
      dataSources[nodeId] = { packageIds: ids };
    });

    const dag = configDefinition.value?.dag || [];

    // Build processorConfigs: all runnable nodes (processors + data-targets)
    const processorConfigs = [];
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      const dagNode = dag.find((n) => n.id === nodeId);
      if (!dagNode) return;

      if (dagNode.type === "data-target") {
        // Data-target: executionTarget from computeType
        if (cfg.computeType) {
          processorConfigs.push({ nodeId, executionTarget: cfg.computeType });
        }
      } else if (dagNode.type !== "data-source") {
        // Processor node: version + executionTarget
        const entry = { nodeId };
        if (cfg.executionTarget) entry.executionTarget = cfg.executionTarget;
        if (cfg.version) entry.version = cfg.version;
        processorConfigs.push(entry);
      }
    });

    // Build processorParams: keyed by processor node ID, free-form params
    const processorParams = {};
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      if (cfg.params && cfg.params.length > 0) {
        const obj = {};
        cfg.params.forEach((p) => { if (p.key) obj[p.key] = p.value; });
        if (Object.keys(obj).length > 0) {
          processorParams[nodeId] = obj;
        }
      }
    });

    // Build dataTargets: keyed by data-target node ID
    const dataTargets = {};
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      const dagNode = dag.find((n) => n.id === nodeId);
      if (dagNode?.type === "data-target" && cfg.params && cfg.params.length > 0) {
        const obj = {};
        cfg.params.forEach((p) => { if (p.key) obj[p.key] = p.value; });
        if (Object.keys(obj).length > 0) {
          dataTargets[nodeId] = { params: obj };
        }
      }
    });

    const payload = {
      workflowInstanceConfiguration: {
        workflowId: initiateForm.value.workflowId,
        computeNodeId: initiateForm.value.computeNodeId,
        ...(processorConfigs.length > 0 && { processorConfigs }),
      },
      datasetId: initiateForm.value.datasetId,
      dataSources,
      ...(Object.keys(dataTargets).length > 0 && { dataTargets }),
      ...(Object.keys(processorParams).length > 0 && { processorParams }),
    };

    const newRun = await store.dispatch("analysisModule/createRun", payload);

    EventBus.$emit("toast", {
      detail: { type: "success", msg: "Workflow executed successfully." },
    });

    // Clean up configure state and switch to browse
    cancelConfigure();

    // Refresh runs list and auto-select the new run
    await store.dispatch("analysisModule/fetchWorkflowInstances");
    const runId = newRun?.uuid || newRun?.id || newRun?.runId;
    const runToSelect = runId
      ? workflowInstances.value.find((r) => r.uuid === runId) || newRun
      : workflowInstances.value[0]; // fallback to newest
    if (runToSelect) {
      await selectRun(runToSelect);
    }
  } catch (err) {
    console.error("Failed to execute workflow:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to execute workflow." },
    });
  } finally {
    isExecuting.value = false;
  }
};

/*
  File Picker — browse dataset files for data-source nodes
*/
const openFilePicker = (nodeId) => {
  filePickerNodeId.value = nodeId;
  filePickerFiles.value = [];
  filePickerAncestorList.value = [];
  filePickerCurrentFile.value = { content: { name: "" } };
  clearSelectedValues.value = !clearSelectedValues.value;
  filePickerVisible.value = true;
  fetchDatasetFiles();
};

const fetchDatasetFiles = async () => {
  try {
    const token = await useGetToken();
    const datasetId = initiateForm.value.datasetId;
    const url = `${config.value.apiUrl}/datasets/${datasetId}?api_key=${token}&includeAncestors=true&limit=500&offset=0`;
    const response = await useSendXhr(url);
    filePickerFiles.value = [...(response.children || [])];
  } catch (err) {
    console.error("Failed to fetch files:", err);
  }
};

const onClickFileLabel = async (file) => {
  if (file.content.packageType !== "Collection") return;

  try {
    const token = await useGetToken();
    const url = `${config.value.apiUrl}/packages/${file.content.id}?api_key=${token}&includeAncestors=true&limit=500&offset=0`;
    const response = await useSendXhr(url);
    filePickerFiles.value = [...(response.children || [])];

    // Update breadcrumb
    if (
      !filePickerAncestorList.value.some(
        (a) => a.content.id === filePickerCurrentFile.value.content?.id
      ) &&
      filePickerCurrentFile.value.content?.id
    ) {
      filePickerAncestorList.value = [
        ...filePickerAncestorList.value,
        filePickerCurrentFile.value,
      ];
    }
    filePickerCurrentFile.value = file;
  } catch (err) {
    console.error("Failed to navigate:", err);
  }
};

const handleNavigateBreadcrumb = async (id) => {
  try {
    const token = await useGetToken();
    let url;
    if (!id || id === "root") {
      const datasetId = initiateForm.value.datasetId;
      url = `${config.value.apiUrl}/datasets/${datasetId}?api_key=${token}&includeAncestors=true&limit=500&offset=0`;
      filePickerAncestorList.value = [];
      filePickerCurrentFile.value = { content: { name: "" } };
    } else {
      url = `${config.value.apiUrl}/packages/${id}?api_key=${token}&includeAncestors=true&limit=500&offset=0`;
      const idx = filePickerAncestorList.value.findIndex(
        (a) => a.content.id === id
      );
      if (idx >= 0) {
        filePickerCurrentFile.value = filePickerAncestorList.value[idx];
        filePickerAncestorList.value = filePickerAncestorList.value.slice(0, idx);
      }
    }
    const response = await useSendXhr(url);
    filePickerFiles.value = [...(response.children || [])];
  } catch (err) {
    console.error("Failed to navigate breadcrumb:", err);
  }
};

const onFileSelect = (selectedFiles) => {
  const nodeId = filePickerNodeId.value;
  if (!nodeId) return;
  dataSourceFiles[nodeId] = selectedFiles;
};

const closeFilePicker = () => {
  filePickerVisible.value = false;
  filePickerNodeId.value = null;
};

const fileCountForNode = (nodeId) => {
  return (dataSourceFiles[nodeId] || []).length;
};

/*
  Node params helpers (configure mode)
*/
const addParam = (nodeId) => {
  if (!nodeConfigs[nodeId]) return;
  nodeConfigs[nodeId].params.push({ key: "", value: "" });
};

const removeParam = (nodeId, index) => {
  if (!nodeConfigs[nodeId]) return;
  nodeConfigs[nodeId].params.splice(index, 1);
};

/*
  Logs dialog
*/
const openLogs = async (nodeId, label) => {
  if (!selectedRun.value) return;
  logsNodeLabel.value = label || nodeId;
  logsMessages.value = [];
  logsLoading.value = true;
  logsDialogVisible.value = true;

  try {
    const token = await useGetToken();
    const runId = selectedWorkflowActivity.value?.uuid || selectedRun.value.uuid;
    const url = `${config.value.api2Url}/compute/workflows/runs/${runId}/logs?nodeId=${nodeId}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error("Failed to fetch logs");
    const data = await resp.json();
    logsMessages.value = data.messages || [];
  } catch (err) {
    console.error("Failed to fetch logs:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to fetch logs." },
    });
  } finally {
    logsLoading.value = false;
  }
};

/*
  Cancel run
*/
const cancelRun = async () => {
  if (!selectedWorkflowActivity.value?.uuid) return;
  cancellingRun.value = true;
  try {
    const token = await useGetToken();
    const runId = selectedWorkflowActivity.value.uuid;
    const url = `${config.value.api2Url}/compute/workflows/runs/${runId}/cancel`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 409) {
      const data = await resp.json();
      EventBus.$emit("toast", {
        detail: { type: "info", msg: data.message || "Run is already in a terminal state." },
      });
    } else if (!resp.ok) {
      throw new Error("Failed to cancel run");
    } else {
      EventBus.$emit("toast", {
        detail: { type: "success", msg: "Run cancellation initiated." },
      });
    }
    cancelRunDialogVisible.value = false;
    // Refresh run status
    await store.dispatch("analysisModule/setSelectedWorkflowActivity", selectedWorkflowActivity.value);
  } catch (err) {
    console.error("Failed to cancel run:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to cancel run." },
    });
  } finally {
    cancellingRun.value = false;
  }
};

/*
  Time formatting
*/
const formatTime = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
};

const formatDuration = (start, end) => {
  if (!start || !end) return "N/A";
  const ms = new Date(end) - new Date(start);
  if (isNaN(ms) || ms < 0) return "N/A";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
};

/*
  Metrics helpers
*/
const runMetrics = computed(() => selectedWorkflowActivity.value?.metrics || null);

const formatCost = (cost) => {
  if (cost == null) return "N/A";
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

const formatModelName = (model) => {
  if (!model) return "N/A";
  // Strip AWS Bedrock prefixes like "us." or ARN paths
  return model.replace(/^(us|eu|ap)\./,  "").replace(/^arn:.*\//, "");
};

const formatBytes = (bytes) => {
  if (bytes == null) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDurationSec = (sec) => {
  if (sec == null) return "N/A";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(0);
  return `${m}m ${s}s`;
};

const nodeMetricLabel = (nodeId) => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.dag) return nodeId;
  const d = activity.dag.find((n) => n.id === nodeId);
  return d ? labelForDagNode(d) : nodeId;
};

const selectedNodeMetrics = computed(() => {
  if (!selectedNode.value || !runMetrics.value?.nodeMetrics) return null;
  return runMetrics.value.nodeMetrics.find(
    (nm) => nm.nodeId === selectedNode.value.id
  ) || null;
});

const formatMetricKey = (key) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Sec$/, "(s)")
    .replace(/Ms$/, "(ms)")
    .replace(/Mi B$/, "(MiB)")
    .replace(/ G B/, " GB")
    .trim();
};

const formatMetricValue = (key, value) => {
  if (value == null) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key === "nodeId") return String(value);
    if (key.toLowerCase().includes("cost")) return formatCost(value);
    if (key.toLowerCase().includes("bytes")) return formatBytes(value);
    if (key.toLowerCase().endsWith("sec")) return formatDurationSec(value);
    if (key.toLowerCase().endsWith("ms")) return `${value.toLocaleString()} ms`;
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(3);
  }
  return String(value);
};

/*
  Compute node / user name lookup
*/
const computeNodeName = (uuid) => {
  if (!uuid) return "N/A";
  const node = computeNodes.value.find((n) => n.uuid === uuid);
  return node ? node.name : uuid;
};

const getUserName = (userId) => {
  if (!userId) return "Unknown";
  if (profile.value && (profile.value.id === userId || profile.value.intId === userId)) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || "You";
  }
  const member = orgMembers.value.find((m) => m.id === userId || m.intId === userId);
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || "Unknown User";
  }
  return String(userId).includes(":") ? String(userId).split(":").pop() : String(userId);
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
      store.dispatch("analysisModule/fetchTargetTypes"),
    ]);
  } catch (err) {
    console.error("Failed to load data:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to load data." },
    });
  } finally {
    isLoading.value = false;
  }

  // Subscribe to Pusher analytics channel for real-time status updates
  if (pusher) {
    const rawOrgId = store.state.activeOrganization?.organization?.id;
    const rawUserId = store.state.profile?.id;
    const orgUuid = rawOrgId?.replace(/^N:organization:/, '');
    const userUuid = rawUserId?.replace(/^N:user:/, '');
    analyticsChannelName = orgUuid
      ? `organization-${orgUuid}-analytics`
      : `user-${userUuid}-analytics`;

    analyticsChannel = pusher.subscribe(analyticsChannelName);
    store.commit("analysisModule/SET_ANALYTICS_CHANNEL", analyticsChannel);

    analyticsChannel.bind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.bind("workflow-processor-status", onProcessorStatusUpdate);
  }
});

onBeforeUnmount(() => {
  // Unsubscribe from Pusher analytics channel
  if (analyticsChannel) {
    analyticsChannel.unbind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.unbind("workflow-processor-status", onProcessorStatusUpdate);
    if (pusher && analyticsChannelName) {
      pusher.unsubscribe(analyticsChannelName);
    }
    analyticsChannel = null;
    analyticsChannelName = null;
    store.commit("analysisModule/CLEAR_ANALYTICS_CHANNEL");
  }
});

onUnmounted(() => {
  store.dispatch("analysisModule/setSelectedWorkflowActivity", null);
});
</script>

<template>
  <div class="run-monitor">
    <!-- Header -->
    <div class="builder-header">
      <template v-if="mode === 'configure'">
        <span class="header-title">Configure Workflow</span>
        <div class="header-actions">
          <bf-button class="secondary" @click="cancelConfigure">Cancel</bf-button>
          <bf-button
            :disabled="isExecuting || !allDataSourcesHaveFiles"
            @click="executeWorkflow"
          >
            {{ isExecuting ? 'Executing...' : 'Execute Workflow' }}
          </bf-button>
        </div>
      </template>
      <template v-else>
        <span class="header-title">
          <template v-if="selectedRun">
            {{ runTimeLabel }}
            <span v-if="runWorkflowName" class="header-workflow-name">{{ runWorkflowName }}</span>
          </template>
          <template v-else>
            Runs
          </template>
        </span>
      </template>
    </div>

    <div class="builder-content">
      <!-- Canvas (LEFT) -->
      <div class="workflow-canvas">
        <div v-if="nodes.length === 0" class="empty-canvas">
          <h3>Select a run to view its status</h3>
          <p>Choose a run from the sidebar, or initiate a new workflow</p>
        </div>

        <div class="run-monitor-flow">
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :default-viewport="{ zoom: 1 }"
            :min-zoom="0.2"
            :max-zoom="4"
            :nodes-draggable="true"
            :nodes-connectable="false"
            :elements-selectable="true"
          >
            <Background pattern-color="#aaa" :gap="16" />
            <Controls position="top-left" />

            <div v-if="nodes.length > 0" class="canvas-toolbar">
              <span v-if="selectedRun" class="header-status-badge" :class="statusDotClass(selectedWorkflowActivity?.status || selectedRun.status)">
                {{ statusLabel(selectedWorkflowActivity?.status || selectedRun.status) }}
              </span>
              <button class="auto-layout-btn" @click="autoLayout">
                Auto Layout
              </button>
            </div>

            <!-- Processor node template -->
            <template #node-default="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'browse' ? statusBorderColor(data.status) : '#cccccc' }">
                <Handle type="target" :position="Position.Top" />
                <div class="custom-node" :class="mode === 'browse' ? statusClass(data.status) : ''">
                  <div class="node-header">
                    <span class="node-title">{{ data.label }}</span>
                  </div>
                  <div v-if="mode === 'browse'" class="node-meta">
                    <span v-if="data.executionTarget" class="runtime-tag">{{ data.executionTarget }}</span>
                    <span class="node-status-badge" :class="statusDotClass(data.status)">{{ statusLabel(data.status) }}</span>
                  </div>
                  <div v-if="mode === 'configure' && nodeConfigs[id]" class="node-config-hint">
                    Click to configure
                  </div>
                </div>
                <Handle type="source" :position="Position.Bottom" />
              </div>
            </template>

            <!-- Data-source node template -->
            <template #node-data-source="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'configure' && fileCountForNode(id) > 0 ? '#17BB62' : '#6366f1' }">
                <div class="custom-node data-source-node" :class="{ 'has-files': mode === 'configure' && fileCountForNode(id) > 0 }">
                  <div class="node-header">
                    <span class="node-type-badge source-badge">Source</span>
                    <span class="node-title">{{ data.label }}</span>
                  </div>
                  <div v-if="mode === 'browse' && data.packageCount != null" class="node-meta">
                    {{ data.packageCount }} file{{ data.packageCount !== 1 ? 's' : '' }}
                  </div>
                  <template v-if="mode === 'configure'">
                    <div class="node-file-count">
                      {{ fileCountForNode(id) }} file{{ fileCountForNode(id) !== 1 ? 's' : '' }} selected
                    </div>
                    <div class="node-config-hint">Click to select files</div>
                  </template>
                </div>
                <Handle type="source" :position="Position.Bottom" />
              </div>
            </template>

            <!-- Data-target node template -->
            <template #node-data-target="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'browse' ? (data.status && data.status !== 'NOT_STARTED' ? statusBorderColor(data.status) : '#64748b') : '#64748b' }">
                <Handle type="target" :position="Position.Top" />
                <div class="custom-node data-target-node" :class="mode === 'browse' ? statusClass(data.status) : ''">
                  <div class="node-header">
                    <span class="node-type-badge target-badge">Target</span>
                    <span class="node-title">{{ data.targetType || data.label }}</span>
                  </div>
                  <div class="node-body">
                    <div class="node-meta">
                      <span v-if="nodeConfigs[id]?.computeType || data.computeType" class="runtime-tag">
                        {{ nodeConfigs[id]?.computeType || data.computeType }}
                      </span>
                      <span v-if="mode === 'browse'" class="node-status-badge" :class="statusDotClass(data.status)">{{ statusLabel(data.status) }}</span>
                    </div>
                    <div v-if="mode === 'configure'" class="node-config-hint">Click to configure</div>
                  </div>
                </div>
              </div>
            </template>
          </VueFlow>
        </div>
      </div>

      <!-- Sidebar (RIGHT) -->
      <div class="applications-sidebar">
        <bf-button v-if="mode !== 'configure'" class="new-workflow-btn" @click="openWizardDialog">
          Initiate Workflow
        </bf-button>

        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <!-- Information Panel -->
          <el-collapse-item title="Information" name="information">

            <!-- CONFIGURE MODE: Selected processor node config -->
            <template v-if="mode === 'configure' && selectedNode && selectedNode.type !== 'data-target' && selectedNode.type !== 'data-source' && nodeConfigs[selectedNode.id]">
              <h4 class="sidebar-section-title">Processor Configuration</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{ selectedNode.data?.label || 'Unnamed' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">ID</span>
                  <span class="info-value info-url">{{ selectedNode.id }}</span>
                </div>
              </div>

              <div class="config-form">
                <div class="config-field">
                  <label>Execution Target</label>
                  <el-select
                    v-model="nodeConfigs[selectedNode.id].executionTarget"
                    size="small"
                    style="width: 100%"
                  >
                    <el-option label="Lambda" value="lambda" />
                    <el-option label="ECS" value="ecs" />
                  </el-select>
                </div>
                <div class="config-field">
                  <label>Version</label>
                  <el-input
                    v-model="nodeConfigs[selectedNode.id].version"
                    size="small"
                    placeholder="latest"
                  />
                </div>

                <!-- Per-node params -->
                <div class="config-field">
                  <label>Parameters</label>
                  <div
                    v-for="(param, index) in nodeConfigs[selectedNode.id].params"
                    :key="index"
                    class="param-row"
                  >
                    <el-input
                      v-model="param.key"
                      size="small"
                      placeholder="Key"
                      class="param-key"
                    />
                    <el-input
                      v-model="param.value"
                      size="small"
                      placeholder="Value"
                      class="param-value"
                    />
                    <button class="param-remove-btn" @click="removeParam(selectedNode.id, index)">&times;</button>
                  </div>
                  <button class="text-link-btn" @click="addParam(selectedNode.id)">+ Add parameter</button>
                </div>
              </div>

              <button class="text-link-btn" @click="selectedNode = null">
                Clear selection
              </button>
            </template>

            <!-- CONFIGURE MODE: Selected data-target node -->
            <template v-else-if="mode === 'configure' && selectedNode && selectedNode.type === 'data-target' && nodeConfigs[selectedNode.id]">
              <h4 class="sidebar-section-title">Data Target Configuration</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Target Type</span>
                  <span class="info-value">{{ selectedNode.data?.targetType || 'N/A' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Runtime</span>
                  <span class="info-value">
                    <span class="runtime-tag">{{ nodeConfigs[selectedNode.id].computeType || 'Not set' }}</span>
                  </span>
                </div>
              </div>

              <div class="config-form">
                <div class="config-field">
                  <label>Runtime</label>
                  <el-select
                    v-model="nodeConfigs[selectedNode.id].computeType"
                    size="small"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="ct in getComputeTypesForTarget(selectedNode.data?.targetType)"
                      :key="ct"
                      :label="ct"
                      :value="ct"
                    />
                  </el-select>
                </div>

                <!-- Per-node params -->
                <div class="config-field">
                  <label>Parameters</label>
                  <div
                    v-for="(param, index) in nodeConfigs[selectedNode.id].params"
                    :key="index"
                    class="param-row"
                  >
                    <el-input
                      v-model="param.key"
                      size="small"
                      placeholder="Key"
                      class="param-key"
                    />
                    <el-input
                      v-model="param.value"
                      size="small"
                      placeholder="Value"
                      class="param-value"
                    />
                    <button class="param-remove-btn" @click="removeParam(selectedNode.id, index)">&times;</button>
                  </div>
                  <button class="text-link-btn" @click="addParam(selectedNode.id)">+ Add parameter</button>
                </div>
              </div>

              <button class="text-link-btn" @click="selectedNode = null">
                Clear selection
              </button>
            </template>

            <!-- CONFIGURE MODE: Selected data-source node -->
            <template v-else-if="mode === 'configure' && selectedNode && selectedNode.type === 'data-source'">
              <h4 class="sidebar-section-title">Data Source</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Files</span>
                  <span class="info-value">{{ fileCountForNode(selectedNode.id) }} selected</span>
                </div>
              </div>
              <bf-button class="secondary" @click="openFilePicker(selectedNode.id)">Select Files</bf-button>
            </template>

            <!-- CONFIGURE MODE: no node selected — show summary -->
            <template v-else-if="mode === 'configure'">
              <h4 class="sidebar-section-title">Configuration Summary</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Workflow</span>
                  <span class="info-value">{{ configDefinition?.name || 'N/A' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Compute Node</span>
                  <span class="info-value">{{ computeNodeName(initiateForm.computeNodeId) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Dataset</span>
                  <span class="info-value">
                    {{ datasetOptions.find(d => d.content?.id === initiateForm.datasetId)?.content?.name || initiateForm.datasetId }}
                  </span>
                </div>
              </div>
              <p class="configure-hint">
                Click <strong>data-source</strong> nodes to select files,
                <strong>processor</strong> nodes to set parameters,
                and <strong>data-target</strong> nodes to override the runtime.
              </p>
            </template>

            <!-- BROWSE MODE: Selected Data Source Node -->
            <template v-else-if="mode === 'browse' && selectedNode && selectedNode.type === 'data-source'">
              <h4 class="sidebar-section-title">Data Source</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{ selectedNode.data?.label || 'Unnamed' }}</span>
                </div>
                <div v-if="selectedNode.data?.packageCount != null" class="info-row">
                  <span class="info-label">Files</span>
                  <span class="info-value">{{ selectedNode.data.packageCount }} file{{ selectedNode.data.packageCount !== 1 ? 's' : '' }}</span>
                </div>
              </div>
              <div class="info-actions">
                <button class="text-link-btn" @click="selectedNode = null">
                  Clear selection
                </button>
              </div>
            </template>

            <!-- BROWSE MODE: Selected Node Info (processors & data targets) -->
            <template v-else-if="mode === 'browse' && selectedNode">
              <h4 class="sidebar-section-title">{{ selectedNode.data?.label || 'Node Details' }}</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Status</span>
                  <span class="info-value">
                    <span class="status-dot" :class="statusDotClass(selectedNode.data?.status)"></span>
                    {{ statusLabel(selectedNode.data?.status) }}
                  </span>
                </div>
                <div v-if="selectedNode.data?.processorType" class="info-row">
                  <span class="info-label">Type</span>
                  <span class="info-value">{{ selectedNode.data.processorType }}</span>
                </div>
              </div>

              <div class="metrics-summary">
                <div
                  class="metrics-summary-item"
                  :class="{ clickable: selectedNodeMetrics }"
                  @click="selectedNodeMetrics && (nodeMetricsDialogVisible = true)"
                >
                  <span class="metrics-summary-value">{{ selectedNodeMetrics ? formatDurationSec(selectedNodeMetrics.durationSec) : 'N/A' }}</span>
                  <span class="metrics-summary-label">Duration</span>
                </div>
                <div class="metrics-summary-item">
                  <span class="metrics-summary-value">{{ selectedNodeMetrics?.computeType || selectedNode.data?.executionTarget || 'N/A' }}</span>
                  <span class="metrics-summary-label">Runtime</span>
                </div>
                <div
                  class="metrics-summary-item"
                  :class="{ clickable: selectedNode.data?.processorType === 'processor' }"
                  @click="selectedNode.data?.processorType === 'processor' && openLogs(selectedNode.id, selectedNode.data?.label)"
                >
                  <span class="metrics-summary-value">
                    <IconFile :width="16" :height="16" />
                  </span>
                  <span class="metrics-summary-label">Logs</span>
                </div>
              </div>

              <button class="text-link-btn" @click="selectedNode = null">
                Clear selection
              </button>
            </template>

            <!-- BROWSE MODE: Run Info (no node selected) -->
            <template v-else-if="mode === 'browse' && selectedRun && selectedWorkflowActivity?.uuid">
              <h4 class="sidebar-section-title">Run Details</h4>
              <div class="info-card">
                <div v-if="runWorkflowName" class="info-row">
                  <span class="info-label">Workflow</span>
                  <span class="info-value">{{ runWorkflowName }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Run ID</span>
                  <span class="info-value info-url">{{ selectedWorkflowActivity.uuid }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status</span>
                  <span class="info-value">
                    <span class="status-dot" :class="statusDotClass(selectedWorkflowActivity.status)"></span>
                    {{ statusLabel(selectedWorkflowActivity.status) }}
                  </span>
                </div>
                <div v-if="selectedWorkflowActivity.computeNodeUuid" class="info-row">
                  <span class="info-label">Compute Node</span>
                  <span class="info-value">{{ computeNodeName(selectedWorkflowActivity.computeNodeUuid) }}</span>
                </div>
                <div v-if="selectedWorkflowActivity.createdBy" class="info-row">
                  <span class="info-label">Invoked By</span>
                  <span class="info-value">{{ getUserName(selectedWorkflowActivity.createdBy) }}</span>
                </div>
                <div v-if="selectedWorkflowActivity.startedAt" class="info-row">
                  <span class="info-label">Started</span>
                  <span class="info-value">{{ formatTime(selectedWorkflowActivity.startedAt) }}</span>
                </div>
                <div v-if="selectedWorkflowActivity.completedAt" class="info-row">
                  <span class="info-label">Completed</span>
                  <span class="info-value">{{ formatTime(selectedWorkflowActivity.completedAt) }}</span>
                </div>
                <div v-if="selectedWorkflowActivity.startedAt && selectedWorkflowActivity.completedAt" class="info-row">
                  <span class="info-label">Duration</span>
                  <span class="info-value">{{ formatDuration(selectedWorkflowActivity.startedAt, selectedWorkflowActivity.completedAt) }}</span>
                </div>
                <div v-if="selectedWorkflowActivity.dag" class="info-row">
                  <span class="info-label">Processors</span>
                  <span class="info-value">{{ selectedWorkflowActivity.dag.length }}</span>
                </div>
              </div>
              <!-- Metrics summary -->
              <template v-if="runMetrics">
                <h4 class="sidebar-section-title">Metrics</h4>
                <div class="metrics-summary">
                  <div class="metrics-summary-item clickable" @click="durationDialogVisible = true">
                    <span class="metrics-summary-value">{{ formatDurationSec(runMetrics.executionTimeSec) }}</span>
                    <span class="metrics-summary-label">Duration</span>
                  </div>
                  <div class="metrics-summary-item clickable" @click="metricsDialogVisible = true">
                    <span class="metrics-summary-value">{{ formatCost(runMetrics.totalEstimatedCost) }}</span>
                    <span class="metrics-summary-label">Est. Cost</span>
                  </div>
                  <div class="metrics-summary-item">
                    <span class="metrics-summary-value">{{ runMetrics.packagesProcessed ?? 'N/A' }}</span>
                    <span class="metrics-summary-label">Files</span>
                  </div>
                </div>
              </template>

              <bf-button class="secondary rerun-config-btn" @click="rerunFromRun(selectedWorkflowActivity)">
                <IconRotateRight :width="14" :height="14" />
                Rerun with configuration
              </bf-button>

              <bf-button
                v-if="!isTerminalStatus(selectedWorkflowActivity.status)"
                class="danger cancel-run-btn"
                @click="cancelRunDialogVisible = true"
              >
                Cancel Run
              </bf-button>
            </template>

            <div v-else class="info-empty">
              Select a run to see details
            </div>
          </el-collapse-item>

          <!-- Runs List -->
          <el-collapse-item title="Runs" name="runs">
            <div class="filter-bar">
              <el-select
                v-model="computeNodeFilter"
                placeholder="Filter by compute node"
                size="small"
                class="compute-filter-select"
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
                :class="{
                  selected: selectedRun && selectedRun.uuid === run.uuid,
                  disabled: mode === 'configure',
                }"
                @click="selectRun(run)"
              >
                <span class="run-status-dot" :class="statusDotClass(run.status)"></span>
                <div class="wf-item-info">
                  <div class="wf-item-name">{{ formatTime(run.startedAt) }} </div>
                  <div class="wf-item-meta">{{ run.workflowName || 'Unnamed workflow' }}</div>
                  <div class="wf-item-meta">

                    {{ computeNodeName(run.computeNodeUuid) }}
                  </div>
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

    <!-- Initiate Workflow Dialog -->
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
              placeholder="Search datasets..."
              :model-value="''"
              @input="onDatasetSearch"
              clearable
              class="wizard-search"
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

    <!-- File Picker Dialog -->
    <el-dialog
      v-model="filePickerVisible"
      title="Select Files"
      width="800px"
      :close-on-click-modal="false"
      @close="closeFilePicker"
    >
      <div class="file-picker-content">
        <div class="file-picker-header">
          <span class="selected-count">
            <strong>{{ fileCountForNode(filePickerNodeId) }}</strong>
            file{{ fileCountForNode(filePickerNodeId) !== 1 ? 's' : '' }} selected
          </span>
        </div>

        <div class="file-browser">
          <div class="breadcrumb-wrapper">
            <breadcrumb-navigation
              is-light-background
              :ancestors="filePickerAncestorList"
              :file="filePickerCurrentFile"
              :file-id="filePickerCurrentFile?.content?.id"
              @navigate-breadcrumb="handleNavigateBreadcrumb"
            />
          </div>
          <div class="files-table-container">
            <analysis-files-table
              :data="filePickerFiles"
              :clear-selected-values="clearSelectedValues"
              @selection-change="onFileSelect"
              @click-file-label="onClickFileLabel"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <bf-button class="secondary" @click="closeFilePicker">Done</bf-button>
      </template>
    </el-dialog>

    <!-- Logs Dialog -->
    <el-dialog
      v-model="logsDialogVisible"
      :title="`Logs — ${logsNodeLabel}`"
      width="700px"
      :close-on-click-modal="true"
    >
      <div class="logs-content">
        <div v-if="logsLoading" class="logs-loading">Loading logs...</div>
        <div v-else-if="logsMessages.length === 0" class="logs-empty">
          No log messages available
        </div>
        <div v-else class="logs-list">
          <div
            v-for="(msg, idx) in logsMessages"
            :key="idx"
            class="log-entry"
          >
            <span class="log-timestamp">{{ formatTime(msg.timestamp) }}</span>
            <span class="log-message">{{ msg.message }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <bf-button class="secondary" @click="logsDialogVisible = false">Close</bf-button>
      </template>
    </el-dialog>

    <!-- Metrics Detail Dialog -->
    <el-dialog
      v-model="metricsDialogVisible"
      title="Run Metrics"
      width="560px"
      :close-on-click-modal="true"
    >
      <div v-if="runMetrics" class="metrics-receipt">
        <!-- Header -->
        <div class="receipt-header">
          <div class="receipt-title">{{ runWorkflowName || 'Workflow Run' }}</div>
          <div class="receipt-date">{{ formatTime(selectedWorkflowActivity?.startedAt) }}</div>
        </div>

        <!-- Summary row -->
        <div class="receipt-section">
          <div class="receipt-section-title">Summary</div>
          <div class="receipt-row">
            <span>Total Duration</span>
            <span>{{ formatDurationSec(runMetrics.executionTimeSec) }}</span>
          </div>
          <div class="receipt-row">
            <span>Processors</span>
            <span>{{ runMetrics.processorCount ?? 'N/A' }}</span>
          </div>
          <div class="receipt-row">
            <span>Targets</span>
            <span>{{ runMetrics.targetCount ?? 'N/A' }}</span>
          </div>
          <div class="receipt-row">
            <span>Files Processed</span>
            <span>{{ runMetrics.packagesProcessed ?? 'N/A' }}</span>
          </div>
        </div>

        <!-- Node Metrics -->
        <div v-if="runMetrics.nodeMetrics?.length" class="receipt-section">
          <div class="receipt-section-title">Node Performance</div>
          <div
            v-for="nm in runMetrics.nodeMetrics"
            :key="nm.nodeId"
            class="receipt-node"
          >
            <div class="receipt-node-header">
              <span class="receipt-node-name">{{ nodeMetricLabel(nm.nodeId) }}</span>
              <span class="receipt-node-badge" :class="nm.computeType">{{ nm.computeType }}</span>
            </div>
            <div class="receipt-row">
              <span>Duration</span>
              <span>{{ formatDurationSec(nm.durationSec) }}</span>
            </div>
            <div v-if="nm.billedDurationMs != null" class="receipt-row">
              <span>Billed Duration</span>
              <span>{{ (nm.billedDurationMs / 1000).toFixed(1) }}s</span>
            </div>
            <div v-if="nm.maxMemoryUsedMiB != null" class="receipt-row">
              <span>Memory Used</span>
              <span>{{ nm.maxMemoryUsedMiB }} / {{ nm.memoryConfiguredMiB }} MiB</span>
            </div>
            <div class="receipt-row">
              <span>Status</span>
              <span class="receipt-status" :class="statusDotClass(nm.status)">{{ statusLabel(nm.status) }}</span>
            </div>
          </div>
        </div>

        <!-- Cost Breakdown -->
        <div v-if="runMetrics.costEstimate" class="receipt-section">
          <div class="receipt-section-title">Cost Breakdown</div>

          <div v-if="runMetrics.costEstimate.lambda" class="receipt-cost-group">
            <div class="receipt-cost-group-title">Lambda</div>
            <div class="receipt-row">
              <span>Invocations</span>
              <span>{{ runMetrics.costEstimate.lambda.invocationCount }}</span>
            </div>
            <div class="receipt-row">
              <span>GB-Seconds</span>
              <span>{{ runMetrics.costEstimate.lambda.totalGBSeconds?.toFixed(2) }}</span>
            </div>
            <div class="receipt-row receipt-row-cost">
              <span>Subtotal</span>
              <span>{{ formatCost(runMetrics.costEstimate.lambda.estimatedCost) }}</span>
            </div>
          </div>

          <div v-if="runMetrics.costEstimate.ecs" class="receipt-cost-group">
            <div class="receipt-cost-group-title">ECS</div>
            <div class="receipt-row">
              <span>Tasks</span>
              <span>{{ runMetrics.costEstimate.ecs.taskCount }}</span>
            </div>
            <div class="receipt-row">
              <span>vCPU Hours</span>
              <span>{{ runMetrics.costEstimate.ecs.vcpuHours?.toFixed(4) }}</span>
            </div>
            <div class="receipt-row">
              <span>Memory GB Hours</span>
              <span>{{ runMetrics.costEstimate.ecs.memoryGBHours?.toFixed(4) }}</span>
            </div>
            <div class="receipt-row receipt-row-cost">
              <span>Subtotal</span>
              <span>{{ formatCost(runMetrics.costEstimate.ecs.estimatedCost) }}</span>
            </div>
          </div>

          <div v-if="runMetrics.costEstimate.stepFunctions" class="receipt-cost-group">
            <div class="receipt-cost-group-title">Step Functions</div>
            <div class="receipt-row">
              <span>State Transitions</span>
              <span>{{ runMetrics.costEstimate.stepFunctions.stateTransitions }}</span>
            </div>
            <div class="receipt-row receipt-row-cost">
              <span>Subtotal</span>
              <span>{{ formatCost(runMetrics.costEstimate.stepFunctions.estimatedCost) }}</span>
            </div>
          </div>

          <div v-if="runMetrics.costEstimate.data" class="receipt-cost-group">
            <div class="receipt-cost-group-title">Data Transfer</div>
            <div class="receipt-row">
              <span>Input</span>
              <span>{{ formatBytes(runMetrics.costEstimate.data.inputBytes) }}</span>
            </div>
            <div class="receipt-row receipt-row-cost">
              <span>Subtotal</span>
              <span>{{ formatCost(runMetrics.costEstimate.data.estimatedCost) }}</span>
            </div>
          </div>

          <div v-if="runMetrics.costEstimate.efsThroughput" class="receipt-cost-group">
            <div class="receipt-cost-group-title">EFS Throughput</div>
            <div class="receipt-row">
              <span>Read</span>
              <span>{{ formatBytes(runMetrics.costEstimate.efsThroughput.readBytes) }}</span>
            </div>
            <div class="receipt-row">
              <span>Write</span>
              <span>{{ formatBytes(runMetrics.costEstimate.efsThroughput.writeBytes) }}</span>
            </div>
            <div class="receipt-row receipt-row-cost">
              <span>Subtotal</span>
              <span>{{ formatCost(runMetrics.costEstimate.efsThroughput.estimatedCost) }}</span>
            </div>
          </div>

          <div v-if="runMetrics.costEstimate.cloudWatchLogs" class="receipt-cost-group">
            <div class="receipt-cost-group-title">CloudWatch Logs</div>
            <div class="receipt-row">
              <span>Ingest</span>
              <span>{{ runMetrics.costEstimate.cloudWatchLogs.estimatedIngestGB?.toFixed(6) }} GB</span>
            </div>
            <div class="receipt-row receipt-row-cost">
              <span>Subtotal</span>
              <span>{{ formatCost(runMetrics.costEstimate.cloudWatchLogs.estimatedCost) }}</span>
            </div>
          </div>

          <div v-if="runMetrics.costEstimate.llm" class="receipt-cost-group">
            <div class="receipt-cost-group-title">LLM</div>
            <div class="receipt-row">
              <span>Model</span>
              <span class="receipt-model-name">{{ formatModelName(runMetrics.costEstimate.llm.lastModel) }}</span>
            </div>
            <div class="receipt-row">
              <span>Requests</span>
              <span>{{ runMetrics.costEstimate.llm.requestCount }}</span>
            </div>
            <div class="receipt-row">
              <span>Input Tokens</span>
              <span>{{ runMetrics.costEstimate.llm.inputTokens?.toLocaleString() }}</span>
            </div>
            <div class="receipt-row">
              <span>Output Tokens</span>
              <span>{{ runMetrics.costEstimate.llm.outputTokens?.toLocaleString() }}</span>
            </div>
            <div class="receipt-row receipt-row-cost">
              <span>Subtotal</span>
              <span>{{ formatCost(runMetrics.costEstimate.llm.estimatedCost) }}</span>
            </div>
          </div>
        </div>

        <!-- Total -->
        <div class="receipt-total">
          <span>Total Estimated Cost</span>
          <span>{{ formatCost(runMetrics.totalEstimatedCost) }}</span>
        </div>

        <div v-if="runMetrics.costEstimate?.pricingVersion" class="receipt-footer">
          Pricing: {{ runMetrics.costEstimate.pricingVersion }}
        </div>
      </div>

      <template #footer>
        <bf-button class="secondary" @click="metricsDialogVisible = false">Close</bf-button>
      </template>
    </el-dialog>

    <!-- Duration Breakdown Dialog -->
    <el-dialog
      v-model="durationDialogVisible"
      title="Duration Breakdown"
      width="480px"
      :close-on-click-modal="true"
    >
      <div v-if="runMetrics" class="metrics-receipt">
        <div class="receipt-header">
          <div class="receipt-title">{{ selectedWorkflowActivity?.workflowName || 'Workflow' }}</div>
          <div class="receipt-date">Total: {{ formatDurationSec(runMetrics.executionTimeSec) }}</div>
        </div>

        <div v-if="runMetrics.nodeMetrics?.length" class="receipt-section">
          <div class="receipt-section-title">Node Durations</div>
          <div
            v-for="nm in [...runMetrics.nodeMetrics].sort((a, b) => (b.durationSec || 0) - (a.durationSec || 0))"
            :key="nm.nodeId"
            class="receipt-node"
          >
            <div class="receipt-node-header">
              <span class="receipt-node-name">{{ nodeMetricLabel(nm.nodeId) }}</span>
              <span class="receipt-node-badge" :class="nm.computeType">{{ nm.computeType }}</span>
            </div>
            <div class="receipt-row">
              <span>Duration</span>
              <span>{{ formatDurationSec(nm.durationSec) }}</span>
            </div>
            <div v-if="nm.billedDurationMs != null" class="receipt-row">
              <span>Billed Duration</span>
              <span>{{ (nm.billedDurationMs / 1000).toFixed(1) }}s</span>
            </div>
            <div class="receipt-row">
              <span>Status</span>
              <span class="receipt-status" :class="statusDotClass(nm.status)">{{ statusLabel(nm.status) }}</span>
            </div>
          </div>
        </div>

        <div v-else class="receipt-section">
          <div class="receipt-row">
            <span>No per-node duration data available</span>
          </div>
        </div>
      </div>

      <template #footer>
        <bf-button class="secondary" @click="durationDialogVisible = false">Close</bf-button>
      </template>
    </el-dialog>

    <!-- Node Metrics Detail Dialog -->
    <el-dialog
      v-model="nodeMetricsDialogVisible"
      title="Node Metrics"
      width="480px"
      :close-on-click-modal="true"
    >
      <div v-if="selectedNodeMetrics" class="metrics-receipt">
        <div class="receipt-header">
          <div class="receipt-title">{{ selectedNode?.data?.label || 'Node' }}</div>
          <div class="receipt-date">
            <span class="receipt-node-badge" :class="selectedNodeMetrics.computeType">
              {{ selectedNodeMetrics.computeType }}
            </span>
          </div>
        </div>

        <div class="receipt-section">
          <div
            v-for="(value, key) in selectedNodeMetrics"
            :key="key"
            class="receipt-row"
          >
            <template v-if="key !== 'nodeId'">
              <span>{{ formatMetricKey(key) }}</span>
              <span>{{ formatMetricValue(key, value) }}</span>
            </template>
          </div>
        </div>
      </div>

      <div v-else class="info-empty">
        No metrics available for this node
      </div>

      <template #footer>
        <bf-button class="secondary" @click="nodeMetricsDialogVisible = false">Close</bf-button>
      </template>
    </el-dialog>

    <!-- Cancel Run Confirmation Dialog -->
    <el-dialog
      v-model="cancelRunDialogVisible"
      title="Cancel Run"
      width="500"
      center
      @close="cancelRunDialogVisible = false"
    >
      <span>Are you sure you want to cancel this run?</span>
      <template #footer>
        <div class="cancel-dialog-footer">
          <bf-button class="secondary" @click="cancelRunDialogVisible = false">No</bf-button>
          <bf-button :disabled="cancellingRun" @click="cancelRun">Yes</bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss">
/* Unscoped styles for VueFlow handle rendering */
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";

.run-monitor-flow {
  .vue-flow__handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--node-border-color, #cccccc) !important;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px var(--node-border-color, #cccccc);
    z-index: 0;

    &::after {
      content: "";
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
      border-radius: 50%;
    }

    &.vue-flow__handle-top {
      top: -5px;
      left: 50% !important;
      transform: translateX(-50%) !important;
    }

    &.vue-flow__handle-bottom {
      bottom: -5px;
      left: 50% !important;
      transform: translateX(-50%) !important;
    }
  }
}
</style>

<style lang="scss" scoped>
@use "../../../styles/theme";

.run-monitor {
  height: calc(100vh - 190px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.builder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background-color: theme.$white;
  border-bottom: 1px solid theme.$gray_3;
  min-height: 48px;

  .header-title {
    font-weight: 400;
    font-size: 13px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-workflow-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .header-status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 10px;
    color: white;

    &.dot-gray { background-color: theme.$gray_4; }
    &.dot-blue { background-color: #3b82f6; }
    &.dot-green { background-color: theme.$status_green; }
    &.dot-red { background-color: theme.$status_red; }
  }
}

.builder-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.workflow-canvas {
  flex: 1;
  position: relative;
  background-color: theme.$gray_1;
}

.empty-canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: theme.$gray_4;
  z-index: 5;
  pointer-events: none;

  h3 { margin: 0 0 10px 0; }
  p { margin: 0; font-size: 14px; }
}

.canvas-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;

  .header-status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 10px;
    color: white;

    &.dot-gray { background-color: theme.$gray_4; }
    &.dot-blue { background-color: #3b82f6; }
    &.dot-green { background-color: theme.$status_green; }
    &.dot-red { background-color: theme.$status_red; }
  }
}

.auto-layout-btn {
  padding: 6px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }
}

.run-monitor-flow {
  width: 100%;
  height: 100%;

  :deep(.vue-flow__node) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    width: auto !important;

    &.selected .custom-node {
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
    }
  }
}

/* Nodes */
.custom-node {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 2px;
  padding: 14px;
  min-width: 250px;
  max-width: 350px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
  z-index: 1;

  &:hover { box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15); }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .node-title {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
    flex: 1;
    line-height: 1.3;
  }

  .node-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 11px;
    color: theme.$gray_4;
  }

  .node-status-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 10px;
    white-space: nowrap;

    &.dot-gray { background: theme.$gray_2; color: theme.$gray_5; }
    &.dot-blue { background: #dbeafe; color: #1d4ed8; }
    &.dot-green { background: #dcfce7; color: #15803d; }
    &.dot-red { background: #fee2e2; color: #b91c1c; }
  }

  .node-config-hint {
    font-size: 11px;
    color: theme.$purple_1;
    margin-top: 6px;
    font-style: italic;
  }

  .node-file-count {
    font-size: 12px;
    color: theme.$gray_5;
    margin-top: 4px;
  }

  &.gray-node { border-color: theme.$gray_4; }
  &.blue-node { border-color: #3b82f6; }
  &.blue-node.animate { animation: node-pulse 3s ease-in-out infinite; }
  &.green-node { border-color: theme.$status_green; }
  &.red-node { border-color: theme.$status_red; }

  &.data-source-node {
    border-color: #6366f1;
    background: #eef2ff;

    &.has-files { border-color: theme.$status_green; }
    &.green-node { border-color: theme.$status_green; }
    &.red-node { border-color: theme.$status_red; }
    &.blue-node { border-color: #3b82f6; }
  }

  &.data-target-node {
    background: #f1f5f9;
    border-color: #64748b;

    &.green-node { border-color: theme.$status_green; }
    &.red-node { border-color: theme.$status_red; }
    &.blue-node { border-color: #3b82f6; }

    .node-body {
      margin-top: 6px;
    }

    .runtime-tag {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(100, 116, 139, 0.12);
      color: #64748b;
      white-space: nowrap;
      display: inline-block;
    }
  }

  .node-type-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;

    &.source-badge { background: #6366f1; color: white; }
    &.target-badge { background: #64748b; color: white; }
  }
}

@keyframes node-pulse {
  0% { background: #f8faff; box-shadow: 0 0 6px rgba(59, 130, 246, 0.3); }
  50% { background: #dbeafe; box-shadow: 0 0 18px rgba(59, 130, 246, 0.5); }
  100% { background: #f8faff; box-shadow: 0 0 6px rgba(59, 130, 246, 0.3); }
}

/* Status dots */
.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot-gray { background-color: theme.$gray_4; }
  &.dot-blue { background-color: #3b82f6; }
  &.dot-green { background-color: theme.$status_green; }
  &.dot-red { background-color: theme.$status_red; }
}

.run-status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;

  &.dot-gray { background-color: theme.$gray_4; }
  &.dot-blue { background-color: #3b82f6; }
  &.dot-green { background-color: theme.$status_green; }
  &.dot-red { background-color: theme.$status_red; }
}

/* Sidebar */
.applications-sidebar {
  width: 350px;
  background-color: theme.$white;
  border-left: 1px solid theme.$gray_3;
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

.new-workflow-btn { width: 100%; }
.sidebar-accordion { border-top: none; }

.sidebar-section-title {
  margin: 10px 0 6px 0;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_4;
}

.filter-bar { margin-bottom: 10px; }
.compute-filter-select { width: 100%; }

.workflow-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 500px;
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

  &:hover:not(.disabled) {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border-color: theme.$purple_1;
    background-color: theme.$purple_tint;
    box-shadow: 0 2px 8px rgba(80, 57, 247, 0.15);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

/* Information panel */
.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0;

  &:not(:last-child) {
    border-bottom: 1px solid theme.$gray_2;
  }
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  flex-shrink: 0;
  min-width: 80px;
}

.info-value {
  font-size: 12px;
  color: theme.$black;
  text-align: right;
  word-break: break-word;
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-url {
  font-family: monospace;
  font-size: 11px;
}

.info-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.text-link-btn {
  background: none;
  border: none;
  color: theme.$purple_3;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
  text-align: left;

  &:hover { text-decoration: underline; }
}

.configure-hint {
  font-size: 13px;
  color: theme.$gray_4;
  line-height: 1.5;
  margin-top: 8px;
}

.runtime-tag {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(5, 150, 105, 0.12);
  color: #047857;
  white-space: nowrap;
  display: inline-block;
}

/* Config form in sidebar */
.config-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_5;
  }
}

.param-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;

  .param-key { flex: 1; }
  .param-value { flex: 1; }

  .param-remove-btn {
    background: theme.$status_red;
    color: white;
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }
}

/* Dialogs */
.run-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

/* File picker */
.file-picker-content {
  min-height: 400px;
}

.file-picker-header {
  margin-bottom: 12px;

  .selected-count {
    font-size: 13px;
    color: theme.$gray_5;
  }
}

.file-browser {
  .breadcrumb-wrapper {
    margin-bottom: 8px;
  }

  .files-table-container {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid theme.$gray_2;
  }
}

/* Info actions */
.info-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.rerun-config-btn {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  justify-content: center;
}
.cancel-run-btn {
  margin-top: 8px;
  width: 100%;
  justify-content: center;
  &:hover {
    background: theme.$red_1;
    border-color: theme.$red_1;
    color: white;
  }
}
.cancel-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
}

/* Metrics summary in sidebar */
.metrics-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.metrics-summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 6px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;

  &.clickable {
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;

    &:hover {
      border-color: theme.$purple_2;
      background: theme.$purple_tint;
    }
  }
}

.metrics-summary-value {
  font-size: 16px;
  font-weight: 700;
  color: theme.$black;
}

.metrics-summary-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_4;
  margin-top: 2px;
}

/* Metrics receipt dialog */
.metrics-receipt {
  font-size: 13px;
  line-height: 1.5;
}

.receipt-header {
  text-align: center;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 2px dashed theme.$gray_2;
}

.receipt-title {
  font-size: 16px;
  font-weight: 700;
  color: theme.$black;
}

.receipt-date {
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 2px;
}

.receipt-section {
  margin-bottom: 16px;
}

.receipt-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: theme.$gray_4;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid theme.$gray_2;
}

.receipt-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 13px;
  color: theme.$gray_5;

  &.receipt-row-cost {
    font-weight: 600;
    color: theme.$black;
    border-top: 1px dotted theme.$gray_2;
    padding-top: 4px;
    margin-top: 2px;
  }

  .receipt-model-name {
    font-family: Monaco, monospace;
    font-size: 11px;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.receipt-node {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
}


.receipt-node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.receipt-node-name {
  font-weight: 600;
  font-size: 13px;
  color: theme.$black;
}

.receipt-node-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;

  &.lambda {
    background: #fef3c7;
    color: #92400e;
  }

  &.ecs {
    background: #dbeafe;
    color: #1e40af;
  }
}

.receipt-status {
  font-weight: 600;
  font-size: 12px;

  &.dot-green { color: #15803d; }
  &.dot-red { color: #b91c1c; }
  &.dot-blue { color: #1d4ed8; }
  &.dot-gray { color: theme.$gray_4; }
}

.receipt-cost-group {
  margin-bottom: 10px;
  padding-left: 8px;
}

.receipt-cost-group-title {
  font-size: 12px;
  font-weight: 600;
  color: theme.$black;
  margin-bottom: 4px;
}

.receipt-total {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  margin-top: 8px;
  border-top: 2px dashed theme.$gray_2;
  font-size: 15px;
  font-weight: 700;
  color: theme.$black;
}

.receipt-footer {
  text-align: center;
  font-size: 11px;
  color: theme.$gray_4;
  margin-top: 8px;
}

/* Logs dialog */
.logs-content {
  min-height: 200px;
  max-height: 500px;
  overflow-y: auto;
}

.logs-loading,
.logs-empty {
  text-align: center;
  padding: 40px 20px;
  color: theme.$gray_4;
  font-size: 14px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.6;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
}

.log-entry {
  display: flex;
  gap: 12px;
  padding: 2px 0;

  &:not(:last-child) {
    border-bottom: 1px solid theme.$gray_2;
  }
}

.log-timestamp {
  color: theme.$gray_4;
  white-space: nowrap;
  flex-shrink: 0;
}

.log-message {
  color: theme.$black;
  word-break: break-word;
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
