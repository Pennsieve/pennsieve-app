<script setup>
import { computed, ref, reactive, onMounted, onBeforeUnmount, onUnmounted } from "vue";
import { useStore } from "vuex";
import { useVueFlow, VueFlow, Handle, Position } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "@dagrejs/dagre";
import EventBus from "../../../utils/event-bus";
import BfButton from "../../shared/bf-button/BfButton.vue";
import AnalysisFilesTable from "../../FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "../../datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";

const { onNodeClick, onPaneClick, fitView } = useVueFlow();

const store = useStore();

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
let pollIntervalId = null;

// Initiate Workflow dialog state
const initiateDialogVisible = ref(false);
const initiateForm = ref({
  workflowId: "",
  computeNodeId: "",
  datasetId: "",
});

// Configure mode state
const configDefinition = ref(null); // the workflow definition fetched for configuration
const dataSourceFiles = reactive({}); // { [nodeId]: File[] }
const nodeConfigs = reactive({}); // { [nodeId]: { executionTarget, version, params: { key: val } } }
const isExecuting = ref(false);

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
  if (d.type === "data-target") return "Data Target";
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
      },
      position:
        hasSavedPositions && d.position && typeof d.position.x === "number"
          ? { x: d.position.x, y: d.position.y }
          : { x: 0, y: 0 },
    };
  });

  const resultEdges = [];
  for (const d of dag) {
    for (const dep of d.dependsOn || []) {
      resultEdges.push({
        id: `e${dep}-${d.id}`,
        source: dep,
        target: d.id,
        animated: false,
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

  const resultNodes = dag.map((d) => {
    const nodeType = d.type === "data-source" ? "data-source"
      : d.type === "data-target" ? "data-target"
      : "default";
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
      },
      position:
        hasSavedPositions && d.position && typeof d.position.x === "number"
          ? { x: d.position.x, y: d.position.y }
          : { x: 0, y: 0 },
    };
  });

  const resultEdges = [];
  for (const d of dag) {
    for (const dep of d.dependsOn || []) {
      resultEdges.push({
        id: `e${dep}-${d.id}`,
        source: dep,
        target: d.id,
        animated: false,
      });
    }
  }

  return { nodes: resultNodes, edges: resultEdges, needsAutoLayout: !hasSavedPositions };
};

/*
  Polling
*/
const stopPolling = () => {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
};

const startPolling = () => {
  stopPolling();
  if (!selectedRun.value) return;

  const currentStatus = selectedWorkflowActivity.value?.status;
  if (isTerminalStatus(currentStatus)) return;

  pollIntervalId = setInterval(async () => {
    if (!selectedRun.value) {
      stopPolling();
      return;
    }
    try {
      await store.dispatch(
        "analysisModule/setSelectedWorkflowActivity",
        selectedWorkflowActivity.value
      );
      const activity = selectedWorkflowActivity.value;
      if (activity && activity.dag && activity.dag.length > 0) {
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
      if (isTerminalStatus(activity?.status)) {
        stopPolling();
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 5000);
};

/*
  Select a run (browse mode)
*/
const selectRun = async (run) => {
  if (mode.value === "configure") return; // don't switch away mid-configure
  stopPolling();
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

    startPolling();
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

const openInitiateDialog = () => {
  initiateForm.value = { workflowId: "", computeNodeId: "", datasetId: "" };
  initiateDialogVisible.value = true;
  fetchDatasetOptions();
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
    initiateDialogVisible.value = false;

    // Reset configuration state
    Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
    Object.keys(nodeConfigs).forEach((k) => delete nodeConfigs[k]);

    // Initialize nodeConfigs for each processor node
    const dag = definition.dag || definition.processors || [];
    dag.forEach((d) => {
      if (d.type !== "data-source" && d.type !== "data-target") {
        nodeConfigs[d.id] = { executionTarget: "lambda", version: "", params: {} };
      }
    });

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
    stopPolling();
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

    // Build processorConfigs array: [{ nodeId, version, executionTarget }]
    const processorConfigs = [];
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      const entry = { nodeId };
      if (cfg.executionTarget) entry.executionTarget = cfg.executionTarget;
      if (cfg.version) entry.version = cfg.version;
      processorConfigs.push(entry);
    });

    const payload = {
      workflowInstanceConfiguration: {
        workflowId: initiateForm.value.workflowId,
        computeNodeId: initiateForm.value.computeNodeId,
        ...(processorConfigs.length > 0 && { processorConfigs }),
      },
      datasetId: initiateForm.value.datasetId,
      dataSources,
      params: {},
    };

    const newRun = await store.dispatch("analysisModule/createRun", payload);

    EventBus.$emit("toast", {
      detail: { type: "success", msg: "Workflow executed successfully." },
    });

    // Clean up configure state and switch to browse
    cancelConfigure();

    // Refresh runs list and auto-select the new run
    await store.dispatch("analysisModule/fetchWorkflowInstances");
    if (newRun && newRun.uuid) {
      await selectRun(newRun);
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
  const key = `param_${Object.keys(nodeConfigs[nodeId].params).length + 1}`;
  nodeConfigs[nodeId].params[key] = "";
};

const removeParam = (nodeId, key) => {
  if (!nodeConfigs[nodeId]) return;
  delete nodeConfigs[nodeId].params[key];
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
    ]);
  } catch (err) {
    console.error("Failed to load data:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to load data." },
    });
  } finally {
    isLoading.value = false;
  }
});

onBeforeUnmount(() => stopPolling());

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
            <span class="header-status-badge" :class="statusDotClass(selectedWorkflowActivity?.status || selectedRun.status)">
              {{ statusLabel(selectedWorkflowActivity?.status || selectedRun.status) }}
            </span>
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
              <button class="auto-layout-btn" @click="autoLayout">
                Auto Layout
              </button>
            </div>

            <!-- Browse mode: status-colored node template -->
            <template #node-default="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node" :class="mode === 'browse' ? statusClass(data.status) : ''">
                <div class="node-header">
                  <span v-if="mode === 'browse'" class="status-dot" :class="statusDotClass(data.status)"></span>
                  <span class="node-title">{{ data.label }}</span>
                </div>
                <div v-if="mode === 'browse'" class="node-status-label">{{ statusLabel(data.status) }}</div>
                <div v-if="mode === 'configure' && nodeConfigs[id]" class="node-config-hint">
                  Click to configure
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <!-- Data-source node template -->
            <template #node-data-source="{ data, id }">
              <div class="custom-node data-source-node" :class="{ 'has-files': mode === 'configure' && fileCountForNode(id) > 0 }">
                <div class="node-header">
                  <span class="node-type-badge source-badge">Source</span>
                  <span class="node-title">{{ data.label }}</span>
                </div>
                <template v-if="mode === 'configure'">
                  <div class="node-file-count">
                    {{ fileCountForNode(id) }} file{{ fileCountForNode(id) !== 1 ? 's' : '' }} selected
                  </div>
                  <div class="node-config-hint">Click to select files</div>
                </template>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <!-- Data-target node template -->
            <template #node-data-target="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node data-target-node">
                <div class="node-header">
                  <span class="node-type-badge target-badge">Target</span>
                  <span class="node-title">{{ data.label }}</span>
                </div>
              </div>
            </template>
          </VueFlow>
        </div>
      </div>

      <!-- Sidebar (RIGHT) -->
      <div class="applications-sidebar">
        <bf-button v-if="mode !== 'configure'" class="new-workflow-btn" @click="openInitiateDialog">
          Initiate Workflow
        </bf-button>

        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <!-- Information Panel -->
          <el-collapse-item title="Information" name="information">

            <!-- CONFIGURE MODE: Selected processor node config -->
            <template v-if="mode === 'configure' && selectedNode && nodeConfigs[selectedNode.id]">
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
                    v-for="(val, key) in nodeConfigs[selectedNode.id].params"
                    :key="key"
                    class="param-row"
                  >
                    <el-input
                      :model-value="key"
                      size="small"
                      placeholder="Key"
                      disabled
                      class="param-key"
                    />
                    <el-input
                      v-model="nodeConfigs[selectedNode.id].params[key]"
                      size="small"
                      placeholder="Value"
                      class="param-value"
                    />
                    <button class="param-remove-btn" @click="removeParam(selectedNode.id, key)">&times;</button>
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
                Click <strong>data-source</strong> nodes to select files.
                Click <strong>processor</strong> nodes to set parameters.
              </p>
            </template>

            <!-- BROWSE MODE: Selected Node Info -->
            <template v-else-if="mode === 'browse' && selectedNode">
              <h4 class="sidebar-section-title">Processor Details</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{ selectedNode.data?.label || 'Unnamed' }}</span>
                </div>
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
                <div v-if="selectedNode.data?.startedAt" class="info-row">
                  <span class="info-label">Started</span>
                  <span class="info-value">{{ formatTime(selectedNode.data.startedAt) }}</span>
                </div>
                <div v-if="selectedNode.data?.completedAt" class="info-row">
                  <span class="info-label">Completed</span>
                  <span class="info-value">{{ formatTime(selectedNode.data.completedAt) }}</span>
                </div>
              </div>
              <div class="info-actions">
                <bf-button
                  v-if="selectedNode.data?.processorType === 'processor'"
                  class="secondary"
                  @click="openLogs(selectedNode.id, selectedNode.data?.label)"
                >
                  Open Logs
                </bf-button>
                <button class="text-link-btn" @click="selectedNode = null">
                  Clear selection
                </button>
              </div>
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
                  <div class="wf-item-name">{{ formatTime(run.startedAt) }}</div>
                  <div class="wf-item-meta">
                    {{ statusLabel(run.status) }}
                    &middot; {{ computeNodeName(run.computeNodeUuid) }}
                  </div>
                  <div class="wf-item-meta">{{ getUserName(run.createdBy) }}</div>
                </div>
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
      v-model="initiateDialogVisible"
      title="Initiate Workflow"
      width="480px"
      :close-on-click-modal="false"
    >
      <div class="run-dialog-form">
        <div class="run-dialog-field">
          <label>Workflow</label>
          <el-select
            v-model="initiateForm.workflowId"
            placeholder="Select a workflow"
            style="width: 100%"
          >
            <el-option
              v-for="wf in workflows"
              :key="wf.uuid"
              :label="wf.name"
              :value="wf.uuid"
              :disabled="!wf.isActive"
            />
          </el-select>
        </div>
        <div class="run-dialog-field">
          <label>Compute Node</label>
          <el-select
            v-model="initiateForm.computeNodeId"
            placeholder="Select a compute node"
            style="width: 100%"
          >
            <el-option
              v-for="cn in computeNodes"
              :key="cn.uuid"
              :label="cn.name"
              :value="cn.uuid"
            />
          </el-select>
        </div>
        <div class="run-dialog-field">
          <label>Dataset</label>
          <el-select
            v-model="initiateForm.datasetId"
            placeholder="Search for a dataset"
            filterable
            remote
            :remote-method="onDatasetSearch"
            :loading="datasetSearchLoading"
            style="width: 100%"
          >
            <el-option
              v-for="ds in datasetOptions"
              :key="ds.content?.id"
              :label="ds.content?.name"
              :value="ds.content?.id"
            />
          </el-select>
        </div>
      </div>
      <template #footer>
        <bf-button class="secondary" @click="initiateDialogVisible = false">Cancel</bf-button>
        <bf-button
          :disabled="!initiateForm.workflowId || !initiateForm.computeNodeId || !initiateForm.datasetId"
          @click="initiateWorkflow"
        >
          Configure
        </bf-button>
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
  </div>
</template>

<style lang="scss">
/* Unscoped styles for VueFlow handle rendering */
@import "@vue-flow/core/dist/style.css";

.run-monitor-flow {
  .vue-flow__handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #6b7280;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #d1d5db;
    z-index: 10;

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
    }

    &.vue-flow__handle-bottom {
      bottom: -5px;
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
    font-weight: 600;
    font-size: 15px;
    color: theme.$black;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-workflow-name {
    font-weight: 400;
    font-size: 13px;
    color: theme.$gray_4;
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

    &.selected .custom-node {
      box-shadow: 0 0 0 2px rgba(80, 57, 247, 0.25);
    }
  }
}

/* Nodes */
.custom-node {
  background: white;
  border: 2px solid theme.$gray_3;
  border-radius: 4px;
  padding: 14px;
  min-width: 250px;
  max-width: 350px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  cursor: pointer;

  &:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }

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

  .node-status-label {
    font-size: 11px;
    color: theme.$gray_4;
    margin-top: 4px;
    padding-left: 20px;
  }

  .node-config-hint {
    font-size: 11px;
    color: theme.$purple_1;
    margin-top: 4px;
    font-style: italic;
  }

  .node-file-count {
    font-size: 12px;
    color: theme.$gray_5;
    margin-top: 4px;
  }

  &.gray-node { border-color: theme.$gray_4; }
  &.blue-node { border-color: #3b82f6; }
  &.blue-node.animate { animation: border-glow-activity 5s ease-in-out infinite; }
  &.green-node { border-color: theme.$status_green; }
  &.red-node { border-color: theme.$status_red; }

  &.data-source-node {
    border-color: theme.$teal_1;
    background: theme.$teal_tint;

    &.has-files {
      border-color: theme.$status_green;
    }
  }

  &.data-target-node {
    border-color: #8b5cf6;
    background: #faf5ff;
  }

  .node-type-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;

    &.source-badge { background: #3b82f6; color: white; }
    &.target-badge { background: #8b5cf6; color: white; }
  }
}

@keyframes border-glow-activity {
  0% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 15px rgba(23, 187, 98, 0.5); }
  100% { box-shadow: 0 0 5px rgba(59, 130, 246, 0.3); }
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
.run-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.run-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 13px;
    font-weight: 600;
    color: theme.$gray_5;
  }
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
</style>
