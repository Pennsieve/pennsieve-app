<script setup>
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount, onUnmounted, getCurrentInstance } from "vue";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";
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
import {
  statusClass,
  statusBorderColor,
  nodeBorderColor,
  statusDotClass,
  statusLabel,
  isTerminalStatus,
  labelForDagNode,
  formatTime,
  formatDuration,
  formatCost,
  formatModelName,
  formatBytes,
  formatDurationSec,
  formatMetricKey,
  formatMetricValue,
  formatResourceLabel,
  computeNodeName as computeNodeNameFn,
  getUserName as getUserNameFn,
  FARGATE_CPU_OPTIONS,
  getMemoryOptionsForCpu,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "./runHelpers";

const props = defineProps({
  runId: { type: String, default: "" },
});

const { onNodeClick, onPaneClick, fitView, updateNodeData } = useVueFlow();

const store = useStore();
const router = useRouter();
const route = useRoute();
const pusher = getCurrentInstance()?.appContext.config.globalProperties.$pusher;

/*
  Local State
*/
const mode = ref("browse"); // 'browse' | 'configure'
const selectedNode = ref(null);
const accordionActiveNames = ref(["information"]);
const nodes = ref([]);
const edges = ref([]);
const isLoading = ref(false);
let analyticsChannel = null;
let analyticsChannelName = null;

// Configure mode state
const initiateForm = ref({ workflowId: "", computeNodeId: "", datasetId: "" });
const configDefinition = ref(null);
const dataSourceFiles = reactive({});
const nodeConfigs = reactive({});
const isExecuting = ref(false);
const rerunSource = ref(null);

// File picker dialog state
const filePickerVisible = ref(false);
const filePickerNodeId = ref(null);
const filePickerFiles = ref([]);
const filePickerAncestorList = ref([]);
const filePickerCurrentFile = ref({ content: { name: "" } });
const clearSelectedValues = ref(false);

// Logs dialog state
const logsDialogVisible = ref(false);
const logsMessages = ref([]);
const logsLoading = ref(false);
const logsNodeId = ref("");
const logsNodeLabel = ref("");

// Metrics dialog state
const metricsDialogVisible = ref(false);
const durationDialogVisible = ref(false);
const nodeMetricsDialogVisible = ref(false);
const cancelRunDialogVisible = ref(false);
const cancellingRun = ref(false);

// Dataset options for configure summary
const datasetOptions = ref([]);
const datasetSearchLoading = ref(false);

/*
  Store computed
*/
const selectedWorkflowActivity = computed(
  () => store.getters["analysisModule/selectedWorkflowActivity"]
);
const computeNodes = computed(
  () => store.getters["analysisModule/computeNodes"] || []
);
const availableApplications = computed(
  () => store.getters["analysisModule/applications"] || []
);
const targetTypes = computed(
  () => store.getters["analysisModule/targetTypes"] || []
);
const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);
const config = computed(() => store.state.config);

const computeNodeName = (uuid) => computeNodeNameFn(uuid, computeNodes.value);
const getUserName = (userId) => getUserNameFn(userId, profile.value, orgMembers.value);

const incomingEdgeColor = (nodeId) => {
  const edge = edges.value.find((e) => e.target === nodeId);
  return edge?.style?.stroke || "#cccccc";
};

const getComputeTypesForTarget = (targetType) => {
  if (!targetType) return [];
  const tt = targetTypes.value.find((t) => t.targetType === targetType);
  return tt?.computeTypes || [];
};

const getTargetTypeDefinition = (targetType) => {
  if (!targetType) return null;
  return targetTypes.value.find((t) => t.targetType === targetType) || null;
};

/*
  Run title
*/
const runTimeLabel = computed(() => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.uuid) return "";
  const timeStr = formatTime(activity.startedAt);
  return timeStr !== "N/A" ? timeStr : activity.uuid;
});

const runWorkflowName = computed(() => {
  const activity = selectedWorkflowActivity.value;
  return activity?.workflowName || "";
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
const autoLayout = () => {
  if (nodes.value.length === 0) return;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 120, ranksep: 150 });
  for (const node of nodes.value) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges.value) g.setEdge(edge.source, edge.target);
  dagre.layout(g);
  nodes.value = nodes.value.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
  setTimeout(() => fitView({ padding: 0.2 }), 50);
};

/*
  Convert a workflow definition's dag to VueFlow nodes/edges (for configure mode)
*/
const definitionToNodesAndEdges = (definition) => {
  const dag = definition.dag || definition.processors || [];
  if (dag.length === 0) return { nodes: [], edges: [], needsAutoLayout: true };
  const hasSavedPositions = dag.some((d) => d.position && typeof d.position.x === "number");
  const resultNodes = dag.map((d) => {
    const nodeType = d.type === "data-source" ? "data-source" : d.type === "data-target" ? "data-target" : "default";
    return {
      id: d.id,
      type: nodeType,
      data: {
        label: labelForDagNode(d, availableApplications.value),
        nodeType: d.type,
        sourceUrl: d.sourceUrl,
        targetType: d.targetType || null,
        computeType: d.computeType || getComputeTypesForTarget(d.targetType)?.[0] || null,
      },
      position: hasSavedPositions && d.position && typeof d.position.x === "number"
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
  Convert run data to VueFlow nodes/edges (for browse mode)
*/
const runToNodesAndEdges = (run) => {
  const dag = run.dag || [];
  if (dag.length === 0) return { nodes: [], edges: [], needsAutoLayout: true };
  const hasSavedPositions = dag.some((d) => d.position && typeof d.position.x === "number");
  const runDataSources = run.dataSources || {};
  const runDataTargets = run.dataTargets || {};
  const runProcessorConfigs = run.processorConfigs || [];
  const runProcessorParams = run.processorParams || {};

  const resultNodes = dag.map((d) => {
    const nodeType = d.type === "data-source" ? "data-source" : d.type === "data-target" ? "data-target" : "default";
    const extra = {};
    if (d.type === "data-source") {
      const src = runDataSources[d.id];
      extra.packageCount = src?.packageIds?.length || 0;
    } else if (d.type === "data-target") {
      extra.targetType = d.targetType || null;
      const cfg = runProcessorConfigs.find((c) => c.nodeId === d.id);
      extra.computeType = cfg?.executionTarget || d.computeType || null;
      const targetParams = runDataTargets[d.id]?.params || {};
      extra.params = Object.entries(targetParams).map(([key, value]) => ({ key, value: String(value) }));
    } else {
      const cfg = runProcessorConfigs.find((c) => c.nodeId === d.id);
      extra.executionTarget = cfg?.executionTarget || null;
      const nodeParams = runProcessorParams[d.id] || {};
      extra.params = Object.entries(nodeParams).map(([key, value]) => ({ key, value: String(value) }));
    }
    return {
      id: d.id,
      type: nodeType,
      data: {
        label: labelForDagNode(d, availableApplications.value),
        status: d.status || "NOT_STARTED",
        processorType: d.type,
        sourceUrl: d.sourceUrl,
        startedAt: d.startedAt,
        completedAt: d.completedAt,
        ...extra,
      },
      position: hasSavedPositions && d.position && typeof d.position.x === "number"
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
  store.commit("analysisModule/UPDATE_RUN_STATUS", { runId: data.runId, status: data.status });

  const currentRunId = selectedWorkflowActivity.value?.uuid;
  if (data.runId === currentRunId) {
    if (isTerminalStatus(data.status)) {
      store.commit("analysisModule/SET_SELECTED_WORKFLOW_ACTIVITY", {
        ...selectedWorkflowActivity.value,
        status: data.status,
      });
      await store.dispatch("analysisModule/setSelectedWorkflowActivity", selectedWorkflowActivity.value);
      const activity = selectedWorkflowActivity.value;
      if (activity?.dag?.length > 0) {
        const result = runToNodesAndEdges(activity);
        const posMap = new Map();
        nodes.value.forEach((n) => posMap.set(n.id, n.position));
        nodes.value = result.nodes.map((n) => ({
          ...n,
          position: posMap.get(n.id) || n.position,
        }));
        if (result.edges.length > 0) edges.value = result.edges;
      }
    } else {
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
  store.commit("analysisModule/UPDATE_NODE_STATUS", { nodeId: data.nodeId, status: data.status });
  updateNodeData(data.nodeId, { status: data.status });
  edges.value = edges.value.map((edge) => {
    if (edge.source === data.nodeId) {
      return { ...edge, style: { ...edge.style, stroke: statusBorderColor(data.status) } };
    }
    return edge;
  });
};

/*
  Load run (browse mode)
*/
const loadRun = async (runId) => {
  if (!runId) return;
  isLoading.value = true;
  try {
    const instances = store.getters["analysisModule/workflowInstances"] || [];
    const run = instances.find((r) => r.uuid === runId) || { uuid: runId };
    await store.dispatch("analysisModule/setSelectedWorkflowActivity", run);
    const activity = selectedWorkflowActivity.value;
    if (activity && activity.dag && activity.dag.length > 0) {
      const result = runToNodesAndEdges(activity);
      nodes.value = result.nodes;
      edges.value = result.edges;
      if (result.needsAutoLayout) autoLayout();
      else setTimeout(() => fitView({ padding: 0.2 }), 50);
    }
  } catch (err) {
    console.error("Failed to load run details:", err);
    EventBus.$emit("toast", { detail: { type: "error", msg: "Failed to load run details." } });
  } finally {
    isLoading.value = false;
  }
};

const goBack = () => {
  store.dispatch("analysisModule/setSelectedWorkflowActivity", null);
  router.push({ name: "runs" });
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
    if (node.type === "data-source") {
      openFilePicker(node.id);
      return;
    }
    if (!accordionActiveNames.value.includes("information")) {
      accordionActiveNames.value = [...accordionActiveNames.value, "information"];
    }
    return;
  }

  const activity = selectedWorkflowActivity.value;
  if (activity && activity.dag) {
    const proc = activity.dag.find((p) => p.id === node.id);
    if (proc) store.dispatch("analysisModule/setSelectedProcessor", proc);
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
  Configure mode — initiate workflow from pending config
*/
const initiateWorkflowFromConfig = async (pendingConfig) => {
  const { workflowId, computeNodeId, datasetId, rerunSource: source } = pendingConfig;
  initiateForm.value = { workflowId, computeNodeId, datasetId };

  try {
    const definition = await store.dispatch("analysisModule/fetchWorkflowDefinition", workflowId);
    configDefinition.value = definition;

    Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
    Object.keys(nodeConfigs).forEach((k) => delete nodeConfigs[k]);

    const dag = definition.dag || definition.processors || [];
    const sourceConfigs = source?.processorConfigs || [];
    const sourceParams = source?.processorParams || {};

    dag.forEach((d) => {
      const srcCfg = sourceConfigs.find((c) => c.nodeId === d.id);
      const srcParams = sourceParams[d.id] || {};

      if (d.type === "data-target") {
        const fallback = getComputeTypesForTarget(d.targetType)?.[0] || null;
        const srcTargetParams = source?.dataTargets?.[d.id]?.params || {};
        const ttDef = getTargetTypeDefinition(d.targetType);
        const paramDefs = ttDef?.params || [];
        const targetParams = paramDefs.map((pd) => ({
          name: pd.name,
          type: pd.type || "string",
          description: pd.description || "",
          required: !!pd.required,
          value: srcTargetParams[pd.name] != null ? String(srcTargetParams[pd.name]) : (pd.defaultValue != null ? String(pd.defaultValue) : ""),
        }));
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
          cpu: srcCfg?.cpu || "",
          memory: srcCfg?.memory || "",
          params,
        };
      }
    });

    rerunSource.value = null;

    const result = definitionToNodesAndEdges(definition);
    nodes.value = result.nodes;
    edges.value = result.edges;
    if (result.needsAutoLayout) autoLayout();
    else setTimeout(() => fitView({ padding: 0.2 }), 50);

    mode.value = "configure";
    selectedNode.value = null;
    accordionActiveNames.value = ["information"];
  } catch (err) {
    console.error("Failed to load workflow definition:", err);
    EventBus.$emit("toast", { detail: { type: "error", msg: "Failed to load workflow definition." } });
    router.push({ name: "runs" });
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
  router.push({ name: "runs" });
};

/*
  Execute Workflow
*/
const executeWorkflow = async () => {
  const dag = configDefinition.value?.dag || [];
  for (const [nodeId, cfg] of Object.entries(nodeConfigs)) {
    const dagNode = dag.find((n) => n.id === nodeId);
    if (dagNode?.type !== "data-target") continue;
    const missing = (cfg.params || []).filter((p) => p.required && !p.value.trim());
    if (missing.length > 0) {
      const nodeLabel = dagNode.targetType || nodeId;
      const names = missing.map((p) => p.name).join(", ");
      EventBus.$emit("toast", {
        detail: { type: "error", msg: `${nodeLabel}: missing required parameter${missing.length > 1 ? "s" : ""} ${names}` },
      });
      return;
    }
  }

  isExecuting.value = true;
  try {
    const dataSources = {};
    Object.entries(dataSourceFiles).forEach(([nodeId, files]) => {
      const ids = files.map((f) => f.content?.id).filter(Boolean);
      dataSources[nodeId] = { packageIds: ids };
    });

    const processorConfigs = [];
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      const dagNode = dag.find((n) => n.id === nodeId);
      if (!dagNode) return;
      if (dagNode.type === "data-target") {
        if (cfg.computeType) processorConfigs.push({ nodeId, executionTarget: cfg.computeType });
      } else if (dagNode.type !== "data-source") {
        const entry = { nodeId };
        if (cfg.executionTarget) entry.executionTarget = cfg.executionTarget;
        if (cfg.version) entry.version = cfg.version;
        if (cfg.cpu) entry.cpu = cfg.cpu;
        if (cfg.memory) entry.memory = cfg.memory;
        processorConfigs.push(entry);
      }
    });

    const processorParams = {};
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      if (cfg.params && cfg.params.length > 0) {
        const obj = {};
        cfg.params.forEach((p) => { if (p.key) obj[p.key] = p.value; });
        if (Object.keys(obj).length > 0) processorParams[nodeId] = obj;
      }
    });

    const dataTargets = {};
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      const dagNode = dag.find((n) => n.id === nodeId);
      if (dagNode?.type === "data-target" && cfg.params && cfg.params.length > 0) {
        const obj = {};
        cfg.params.forEach((p) => { if (p.name && p.value) obj[p.name] = p.value; });
        if (Object.keys(obj).length > 0) dataTargets[nodeId] = { params: obj };
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

    await store.dispatch("analysisModule/createRun", payload);
    EventBus.$emit("toast", { detail: { type: "success", msg: "Workflow executed successfully." } });

    router.push({ name: "runs" });
  } catch (err) {
    console.error("Failed to execute workflow:", err);
    EventBus.$emit("toast", { detail: { type: "error", msg: "Failed to execute workflow." } });
  } finally {
    isExecuting.value = false;
  }
};

/*
  File Picker
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
        filePickerAncestorList.value = filePickerAncestorList.value.slice(
          0,
          idx
        );
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
  logsNodeId.value = nodeId;
  logsNodeLabel.value = label || nodeId;
  logsMessages.value = [];
  logsLoading.value = true;
  logsDialogVisible.value = true;

  try {
    const token = await useGetToken();
    const runId = selectedWorkflowActivity.value?.uuid || props.runId;
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
    await store.dispatch(
      "analysisModule/setSelectedWorkflowActivity",
      selectedWorkflowActivity.value
    );
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
  Metrics helpers
*/
const runMetrics = computed(
  () => selectedWorkflowActivity.value?.metrics || null
);

const nodeMetricLabel = (nodeId) => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.dag) return nodeId;
  const d = activity.dag.find((n) => n.id === nodeId);
  return d ? labelForDagNode(d, availableApplications.value) : nodeId;
};

const selectedNodeMetrics = computed(() => {
  if (!selectedNode.value || !runMetrics.value?.nodeMetrics) return null;
  return (
    runMetrics.value.nodeMetrics.find(
      (nm) => nm.nodeId === selectedNode.value.id
    ) || null
  );
});

/*
  Rerun & Export
*/
const exportRunConfig = () => {
  const activity = selectedWorkflowActivity.value;
  if (!activity) return;
  const json = JSON.stringify(activity, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `run-${activity.uuid}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const rerunFromRun = async () => {
  const activity = selectedWorkflowActivity.value;
  if (!activity) return;
  store.commit("analysisModule/SET_PENDING_RUN_CONFIG", {
    workflowId: activity.workflowUuid || "",
    computeNodeId: activity.computeNodeUuid || "",
    datasetId: activity.datasetId || "",
    rerunSource: activity,
  });
  router.push({ name: "run-configure" });
};

/*
  Fetch dataset options for configure summary
*/
const fetchDatasetOptions = async (query = "") => {
  datasetSearchLoading.value = true;
  try {
    const token = await useGetToken();
    const params = toQueryParams({
      limit: 25, offset: 0, query,
      orderBy: "IntId", orderDirection: "Desc",
      type: "research", api_key: token,
    });
    const url = `${config.value.apiUrl}/datasets/paginated?${params}`;
    const response = await useSendXhr(url);
    datasetOptions.value = response?.datasets || response || [];
  } catch (err) {
    datasetOptions.value = [];
  } finally {
    datasetSearchLoading.value = false;
  }
};

/*
  Lifecycle
*/
onMounted(async () => {
  await Promise.all([
    store.dispatch("analysisModule/fetchComputeNodes"),
    store.dispatch("analysisModule/fetchTargetTypes"),
  ]);

  // Check for pending configure mode
  const pendingConfig = store.state.analysisModule.pendingRunConfig;
  if (pendingConfig) {
    store.commit("analysisModule/CLEAR_PENDING_RUN_CONFIG");
    fetchDatasetOptions();
    await initiateWorkflowFromConfig(pendingConfig);
  } else if (props.runId) {
    if (!store.getters["analysisModule/workflowInstances"]?.length) {
      await store.dispatch("analysisModule/fetchWorkflowInstances");
    }
    await loadRun(props.runId);
  }

  // Subscribe to Pusher
  if (pusher) {
    const rawOrgId = store.state.activeOrganization?.organization?.id;
    const rawUserId = store.state.profile?.id;
    const orgUuid = rawOrgId?.replace(/^N:organization:/, "");
    const userUuid = rawUserId?.replace(/^N:user:/, "");
    analyticsChannelName = orgUuid
      ? `organization-${orgUuid}-analytics`
      : `user-${userUuid}-analytics`;
    analyticsChannel = pusher.subscribe(analyticsChannelName);
    store.commit("analysisModule/SET_ANALYTICS_CHANNEL", analyticsChannel);
    analyticsChannel.bind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.bind("workflow-processor-status", onProcessorStatusUpdate);
  }
});

// Handle same-component navigation (e.g. run-detail → run-configure)
watch(
  () => route.name,
  async (newName) => {
    if (newName === "run-configure") {
      const pendingConfig = store.state.analysisModule.pendingRunConfig;
      if (pendingConfig) {
        store.commit("analysisModule/CLEAR_PENDING_RUN_CONFIG");
        fetchDatasetOptions();
        await initiateWorkflowFromConfig(pendingConfig);
      }
    }
  }
);

onBeforeUnmount(() => {
  if (analyticsChannel) {
    analyticsChannel.unbind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.unbind(
      "workflow-processor-status",
      onProcessorStatusUpdate
    );
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
  <div class="run-detail">
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
          <a class="header-back-link" @click="goBack">Runs</a>
          <span class="header-breadcrumb-sep">/</span>
          {{ runTimeLabel }}
          <span v-if="runWorkflowName" class="header-workflow-name">{{ runWorkflowName }}</span>
        </span>
      </template>
    </div>

    <div class="builder-content">
      <!-- Canvas (LEFT) -->
      <div class="workflow-canvas">
        <div v-if="nodes.length === 0 && isLoading" class="empty-canvas">
          <span class="loading-text">Loading run...</span>
        </div>

        <div v-else-if="nodes.length === 0" class="empty-canvas">
          <h3>Loading run details</h3>
          <p>Please wait...</p>
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
              <span v-if="mode === 'browse'" class="header-status-badge" :class="statusDotClass(selectedWorkflowActivity?.status)">
                {{ statusLabel(selectedWorkflowActivity?.status) }}
              </span>
              <button class="auto-layout-btn" @click="autoLayout">
                Auto Layout
              </button>
            </div>

            <!-- Processor node template -->
            <template #node-default="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'browse' ? statusBorderColor(data.status) : '#cccccc', '--handle-target-color': incomingEdgeColor(id) }">
                <Handle type="target" :position="Position.Top" />
                <div class="custom-node" :class="mode === 'browse' ? statusClass(data.status) : ''">
                  <div class="node-header">
                    <span class="node-title">{{ data.label }}</span>
                  </div>
                  <div class="node-tags">
                    <span v-if="mode === 'browse' && data.executionTarget" class="node-type-badge exec-badge">{{ data.executionTarget }}</span>
                    <span v-if="mode === 'configure' && nodeConfigs[id]?.executionTarget" class="node-type-badge exec-badge">{{ nodeConfigs[id].executionTarget }}</span>
                    <span v-if="mode === 'browse'" class="node-status-badge" :class="statusDotClass(data.status)">{{ statusLabel(data.status) }}</span>
                  </div>
                  <div v-if="(mode === 'browse' && data.params?.length > 0) || (mode === 'configure' && nodeConfigs[id])" class="node-config-summary">
                    <div v-if="mode === 'browse' && data.params?.length > 0" class="param-preview">
                      <div v-for="(p, i) in data.params.slice(0, 3)" :key="i" class="param-row">
                        <span class="param-key">{{ p.key }}</span>
                        <span v-if="p.value" class="param-val">{{ p.value }}</span>
                      </div>
                      <span v-if="data.params.length > 3" class="param-more">+{{ data.params.length - 3 }} more</span>
                    </div>
                    <template v-if="mode === 'configure' && nodeConfigs[id]">
                      <div v-if="nodeConfigs[id].params?.length > 0" class="param-preview">
                        <div v-for="(p, i) in nodeConfigs[id].params.slice(0, 3)" :key="i" class="param-row">
                          <span class="param-key">{{ p.key }}</span>
                          <span v-if="p.value" class="param-val">{{ p.value }}</span>
                        </div>
                        <span v-if="nodeConfigs[id].params.length > 3" class="param-more">+{{ nodeConfigs[id].params.length - 3 }} more</span>
                      </div>
                      <div class="node-config-hint">Click to configure</div>
                    </template>
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
                    <span class="node-title">{{ data.label }}</span>
                  </div>
                  <div class="node-tags">
                    <span class="node-type-badge source-badge">Source</span>
                    <span v-if="mode === 'browse' && data.packageCount != null" class="node-tag-info">
                      {{ data.packageCount }} file{{ data.packageCount !== 1 ? 's' : '' }}
                    </span>
                    <template v-if="mode === 'configure'">
                      <span class="node-tag-info">
                        {{ fileCountForNode(id) }} file{{ fileCountForNode(id) !== 1 ? 's' : '' }} selected
                      </span>
                    </template>
                  </div>
                  <div v-if="mode === 'configure'" class="node-config-hint">Click to select files</div>
                </div>
                <Handle type="source" :position="Position.Bottom" />
              </div>
            </template>

            <!-- Data-target node template -->
            <template #node-data-target="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'browse' ? (data.status && data.status !== 'NOT_STARTED' ? statusBorderColor(data.status) : '#64748b') : '#64748b', '--handle-target-color': incomingEdgeColor(id) }">
                <Handle type="target" :position="Position.Top" />
                <div class="custom-node data-target-node" :class="mode === 'browse' ? statusClass(data.status) : ''">
                  <div class="node-header">
                    <span class="node-title">{{ data.targetType || data.label }}</span>
                  </div>
                  <div class="node-tags">
                    <span class="node-type-badge target-badge">Target</span>
                    <span v-if="nodeConfigs[id]?.computeType || data.computeType" class="node-type-badge exec-badge">
                      {{ nodeConfigs[id]?.computeType || data.computeType }}
                    </span>
                    <span v-if="mode === 'browse'" class="node-status-badge" :class="statusDotClass(data.status)">{{ statusLabel(data.status) }}</span>
                  </div>
                  <div class="node-body">
                    <div v-if="mode === 'browse' && data.params?.length > 0" class="param-preview">
                      <div v-for="(p, i) in data.params.slice(0, 3)" :key="i" class="param-row">
                        <span class="param-key">{{ p.key }}</span>
                        <span v-if="p.value" class="param-val">{{ p.value }}</span>
                      </div>
                      <span v-if="data.params.length > 3" class="param-more">+{{ data.params.length - 3 }} more</span>
                    </div>
                    <template v-if="mode === 'configure'">
                      <div v-if="nodeConfigs[id]?.params?.length > 0" class="param-preview">
                        <div v-for="(p, i) in nodeConfigs[id].params.slice(0, 3)" :key="i" class="param-row">
                          <span class="param-key">{{ p.key }}</span>
                          <span v-if="p.value" class="param-val">{{ p.value }}</span>
                        </div>
                        <span v-if="nodeConfigs[id].params.length > 3" class="param-more">+{{ nodeConfigs[id].params.length - 3 }} more</span>
                      </div>
                      <div class="node-config-hint">Click to configure</div>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </VueFlow>
        </div>
      </div>

      <!-- Sidebar (RIGHT) -->
      <div class="applications-sidebar">
        <bf-button
          v-if="mode === 'browse' && selectedWorkflowActivity && !isTerminalStatus(selectedWorkflowActivity.status)"
          class="new-workflow-btn danger"
          @click="cancelRunDialogVisible = true"
        >
          Cancel Run
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
                    @change="() => { nodeConfigs[selectedNode.id].cpu = ''; nodeConfigs[selectedNode.id].memory = '' }"
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

                <!-- CPU / Memory (ECS only) -->
                <template v-if="nodeConfigs[selectedNode.id].executionTarget === 'ecs'">
                  <div class="config-field">
                    <label>CPU</label>
                    <el-select
                      v-model="nodeConfigs[selectedNode.id].cpu"
                      size="small"
                      style="width: 100%"
                      placeholder="Default"
                      clearable
                      @change="() => { nodeConfigs[selectedNode.id].memory = '' }"
                    >
                      <el-option
                        v-for="cpu in FARGATE_CPU_OPTIONS"
                        :key="cpu"
                        :label="`${cpu} (${(cpu / 1024).toFixed(cpu >= 1024 ? 0 : 2)} vCPU)`"
                        :value="cpu"
                      />
                    </el-select>
                  </div>
                  <div class="config-field">
                    <label>Memory</label>
                    <el-select
                      v-model="nodeConfigs[selectedNode.id].memory"
                      size="small"
                      style="width: 100%"
                      placeholder="Default"
                      clearable
                      :disabled="!nodeConfigs[selectedNode.id].cpu"
                    >
                      <el-option
                        v-for="mem in getMemoryOptionsForCpu(nodeConfigs[selectedNode.id].cpu)"
                        :key="mem"
                        :label="formatResourceLabel(mem)"
                        :value="mem"
                      />
                    </el-select>
                  </div>
                </template>

                <!-- Lambda memory -->
                <template v-if="nodeConfigs[selectedNode.id].executionTarget === 'lambda'">
                  <div class="config-field">
                    <label>Memory (MB)</label>
                    <el-input
                      v-model="nodeConfigs[selectedNode.id].memory"
                      size="small"
                      placeholder="Default (e.g. 3008)"
                      type="number"
                      :min="128"
                      :max="10240"
                    />
                  </div>
                </template>

                <!-- Per-node params -->
                <div class="config-field">
                  <label>Parameters</label>
                  <div
                    v-for="(param, index) in nodeConfigs[selectedNode.id].params"
                    :key="index"
                    class="param-row"
                  >
                    <el-input v-model="param.key" size="small" placeholder="Key" class="param-key" />
                    <el-input v-model="param.value" size="small" placeholder="Value" class="param-value" />
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

                <!-- Target type params -->
                <div v-if="nodeConfigs[selectedNode.id].params.length > 0" class="config-field">
                  <label>Parameters</label>
                  <div
                    v-for="param in nodeConfigs[selectedNode.id].params"
                    :key="param.name"
                    class="target-param"
                  >
                    <div class="target-param-header">
                      <span class="target-param-name">{{ param.name }}</span>
                      <span v-if="param.required" class="target-param-required">required</span>
                      <span v-else class="target-param-optional">optional</span>
                    </div>
                    <div v-if="param.description" class="target-param-description">{{ param.description }}</div>
                    <el-input
                      v-model="param.value"
                      size="small"
                      :placeholder="param.required ? 'Required' : 'Optional'"
                    />
                  </div>
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

              <div v-if="selectedNode.data?.params?.length > 0" class="info-card params-card">
                <h5 class="params-title">Parameters</h5>
                <div v-for="(p, i) in selectedNode.data.params" :key="i" class="info-row">
                  <span class="info-label">{{ p.key }}</span>
                  <span class="info-value">{{ p.value }}</span>
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
                  <span class="metrics-summary-value">Logs</span>
                  <span class="metrics-summary-label">View</span>
                </div>
              </div>

              <button class="text-link-btn" @click="selectedNode = null">
                Clear selection
              </button>
            </template>

            <!-- BROWSE MODE: Run Info (no node selected) -->
            <template v-else-if="mode === 'browse' && selectedWorkflowActivity?.uuid">
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

              <bf-button class="secondary rerun-config-btn" @click="rerunFromRun">
                <IconRotateRight :width="14" :height="14" />
                Rerun with configuration
              </bf-button>

              <bf-button class="secondary export-run-btn" @click="exportRunConfig">
                Export Run Config
              </bf-button>
            </template>

            <div v-else class="info-empty">
              Loading run details...
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

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
      <div class="logs-toolbar">
        <button class="logs-refresh-btn" :disabled="logsLoading" @click="openLogs(logsNodeId, logsNodeLabel)">
          <IconRotateRight :width="14" :height="14" />
          Refresh
        </button>
      </div>
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
        <div class="receipt-header">
          <div class="receipt-title">{{ runWorkflowName || 'Workflow Run' }}</div>
          <div class="receipt-date">{{ formatTime(selectedWorkflowActivity?.startedAt) }}</div>
        </div>

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
      background: var(--handle-target-color, #cccccc) !important;
      box-shadow: 0 0 0 1px var(--handle-target-color, #cccccc);
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
@use "../../../styles/element/select";

.run-detail {
  height: calc(100vh - 112px);
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

  .header-back-link {
    color: theme.$purple_3;
    cursor: pointer;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }

  .header-breadcrumb-sep {
    color: theme.$gray_4;
    font-weight: 400;
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
    &.dot-blue { background-color: #06b6d4; }
    &.dot-amber { background-color: #f59e0b; }
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
    &.dot-blue { background-color: #06b6d4; }
    &.dot-amber { background-color: #f59e0b; }
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
      outline: 2px solid theme.$purple_1;
      outline-offset: 2px;
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
  text-align: left;
  z-index: 1;

  &:hover { box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15); }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
  }

  .node-title {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
    flex: 1;
    line-height: 1.3;
    text-align: left;
  }

  .node-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
  }

  .node-tag-info {
    font-size: 10px;
    color: theme.$gray_4;
    white-space: nowrap;
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
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.dot-gray { background: theme.$gray_2; color: theme.$gray_5; }
    &.dot-blue { background: #e0f7fa; color: #0e7490; }
    &.dot-green { background: rgba(23, 187, 98, 0.12); color: #17BB62; }
    &.dot-red { background: #fee2e2; color: #b91c1c; }
    &.dot-amber { background: #fef3c7; color: #92400e; }
  }

  .node-config-summary {
    margin-top: 6px;
    text-align: left;

    .runtime-tag {
      margin-bottom: 4px;
    }
  }

  .param-preview {
    margin-top: 4px;
    text-align: left;

    .param-row {
      display: flex;
      align-items: baseline;
      gap: 4px;
      font-size: 10px;
      line-height: 1.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .param-key {
      color: theme.$gray_5;
      font-weight: 500;
      flex-shrink: 0;

      &::after {
        content: ":";
      }
    }

    .param-val {
      color: theme.$gray_4;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .param-more {
      font-size: 10px;
      color: theme.$gray_4;
      font-style: italic;
    }
  }

  .node-config-hint {
    font-size: 11px;
    color: theme.$purple_1;
    margin-top: 6px;
    font-style: italic;
    text-align: left;
  }

  .node-file-count {
    font-size: 12px;
    color: theme.$gray_5;
    margin-top: 4px;
  }

  &.gray-node { border-color: theme.$gray_4; }
  &.blue-node { border-color: #06b6d4; }
  &.blue-node.animate { animation: node-pulse 3s ease-in-out infinite; }
  &.green-node { border-color: theme.$status_green; }
  &.red-node { border-color: theme.$status_red; }

  &.data-source-node {
    border-color: #6366f1;
    background: #eef2ff;

    &.has-files { border-color: theme.$status_green; }
    &.green-node { border-color: theme.$status_green; }
    &.red-node { border-color: theme.$status_red; }
    &.blue-node { border-color: #06b6d4; }
  }

  &.data-target-node {
    background: #f1f5f9;
    border-color: #64748b;

    &.green-node { border-color: theme.$status_green; }
    &.red-node { border-color: theme.$status_red; }
    &.blue-node { border-color: #06b6d4; }

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
    &.exec-badge { background: rgba(5, 150, 105, 0.12); color: #047857; }
  }
}

@keyframes node-pulse {
  0% { background: #f8faff; box-shadow: 0 0 6px rgba(6, 182, 212, 0.3); }
  50% { background: #e0f7fa; box-shadow: 0 0 18px rgba(6, 182, 212, 0.5); }
  100% { background: #f8faff; box-shadow: 0 0 6px rgba(6, 182, 212, 0.3); }
}

/* Status dots */
.status-dot {
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
  border-left: 1px solid theme.$gray_3;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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

/* Information panel */
.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
  margin-bottom: 12px;

  .params-title {
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_5;
    margin: 0 0 6px 0;
  }
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

.target-param {
  margin-bottom: 10px;
  padding: 8px;
  background: theme.$gray_1;
  border-radius: 4px;
}

.target-param-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.target-param-name {
  font-size: 12px;
  font-weight: 600;
  color: theme.$black;
}

.target-param-required {
  font-size: 10px;
  font-weight: 600;
  color: theme.$status_red;
  text-transform: uppercase;
}

.target-param-optional {
  font-size: 10px;
  font-weight: 500;
  color: theme.$gray_4;
  text-transform: uppercase;
}

.target-param-description {
  font-size: 11px;
  color: theme.$gray_4;
  margin-bottom: 6px;
  line-height: 1.3;
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
.export-run-btn {
  margin-top: 8px;
  width: 100%;
  justify-content: center;
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
    background: #e0f7fa;
    color: #1e40af;
  }
}

.receipt-status {
  font-weight: 600;
  font-size: 12px;

  &.dot-green { color: #15803d; }
  &.dot-red { color: #b91c1c; }
  &.dot-blue { color: #0e7490; }
  &.dot-amber { color: #92400e; }
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

/* Logs dialog */
.logs-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.logs-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

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

:deep(.el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
