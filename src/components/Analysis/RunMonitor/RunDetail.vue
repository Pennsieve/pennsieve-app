<script setup>
import { computed, ref, reactive, watch, onMounted, onBeforeUnmount, onUnmounted, getCurrentInstance } from "vue";
import { runScopeChannel } from "@/realtime/channels";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";
import { useVueFlow, VueFlow, Handle, Position } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import dagre from "@dagrejs/dagre";
import EventBus from "../../../utils/event-bus";
import BfButton from "../../shared/bf-button/BfButton.vue";
import IconRotateRight from "../../icons/IconRotateRight.vue";
import IconFile from "../../icons/IconFile.vue";
import IconCollection from "../../icons/IconCollection.vue";
import IconCopyDocument from "../../icons/IconCopyDocument.vue";
import IconArrowRight from "../../icons/IconArrowRight.vue";
import IconControllerPlay from "../../icons/IconControllerPlay.vue";
import IconXCircle from "../../icons/IconXCircle.vue";
import { endInteractiveSession } from "@/composables/useJupyterSession";
import { markSessionEnded, sessionEnded, endingPhase } from "./endedSessions";
import AnalysisFilesTable from "../../FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "../../datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue";
import { useGetToken } from "@/composables/useGetToken";
import { getView } from "@/utils/viewsService";
import CompactFlowNode from "../WorkflowGraph/CompactFlowNode.vue";
import GraphDensityToggle from "../WorkflowGraph/GraphDensityToggle.vue";
import { layoutBox, useGraphDensity } from "../WorkflowGraph/graphDensity";
import { formatResources, formatRunTime, nodeDurationSec } from "../WorkflowGraph/nodeFacts";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import LayerNameSelector from "./LayerNameSelector.vue";
import TargetDatasetField from "./TargetDatasetField.vue";
import { targetWritesToDataset, targetParamFields, buildDataTargets, targetDatasetId, datasetName, shownTargetParams } from "./dataTargets";
import DownloadItem from "@/components/downloads/DownloadItem.vue";
import { useDownloadsStore } from "@/stores/downloadsStore";

const ASSET_TYPE_OPTIONS = ["timeseries-zarr","ome-zarr", "thumb"];
// The download target's notify param (download-service's notify).
const DOWNLOAD_NOTIFY_OPTIONS = [
  { value: "auto", label: "Email me unless I'm watching" },
  { value: "email", label: "Always email me" },
  { value: "none", label: "Don't email me" },
];
const ASSET_TYPE_CUSTOM = "__custom__";
const customAssetTypeNodes = reactive(new Set());

import {
  statusClass,
  statusBorderColor,
  nodeBorderColor,
  statusDotClass,
  statusLabel,
  isTerminalStatus,
  labelForDagNode,
  getTargetTypeLabel,
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
  validateRunName,
  runDisplayName,
  RUN_NAME_MAX_LENGTH,
} from "./runHelpers";
import { sourceLabel, sourceHints, hintLine, portsOfStep, missingFilesMessage } from "../WorkflowGraph/sourceInputs";
import { portEdges, stepPoints } from "../WorkflowGraph/runPorts";
import PortChips from "../WorkflowGraph/PortChips.vue";
import LlmMark from "../WorkflowGraph/LlmMark.vue";
import { inputHandleId } from "../WorkflowBuilder/inputPorts";
import { portHandleId, portOfHandle } from "../WorkflowBuilder/outputPorts";
import { stepNames } from "../WorkflowBuilder/stepNames";

// Shown in a workspace (/:orgId/analysis/runs/...) and in My Workspace
// (/my-workspace/analysis/runs/...), where there's no organization and a run
// has no dataset. Route names there carry a "my-" prefix.
const isMyWorkspace = computed(() => !route.params.orgId);
const scopedRoute = (name, params = {}) => ({ name: isMyWorkspace.value ? `my-${name}` : name, params });

const props = defineProps({
  runId: { type: String, default: "" },
});

const { onNodeClick, onPaneClick, fitView, updateNodeData } = useVueFlow();

const store = useStore();
const router = useRouter();
const route = useRoute();
const realtime = getCurrentInstance()?.appContext.config.globalProperties.$realtime;

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

// Configure mode state
const initiateForm = ref({ workflowId: "", computeNodeId: "", datasetId: "", name: "" });
const runNameError = ref("");
const configDefinition = ref(null);
const dataSourceFiles = reactive({});
const nodeConfigs = reactive({});
const isExecuting = ref(false);
const errorBanner = ref("");
const errorBannerNodeId = ref("");
const rerunSource = ref(null);
// The node's data layers the source run mounted (set through the API; the
// app doesn't attach any itself). Carried over on a rerun so "Rerun with
// configuration" doesn't silently drop them.
const configLayers = ref([]);

// File picker dialog state
const filePickerVisible = ref(false);
// The picker names the input its source feeds and what that input takes
// (sourceInputs.js): "Select files for signals", "signals takes CSV files".
const sourcePicker = computed(() => {
  const id = filePickerNodeId.value;
  const dag = configDefinition.value?.dag || [];
  const name = id ? sourceLabel(id, dag, "") : "";
  return {
    title: name ? `Select files for ${name}` : "Select Files",
    hint: id ? hintLine(sourceHints(id, dag, portsOfStep(dag, availableApplications.value))) : "",
  };
});
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

// Dataset name for run details (browse mode)
const runDatasetName = ref("");
const runDatasetAccessible = ref(false);

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

const DEFAULT_COMPUTE_TYPES = ["standard", "lambda", "gpu"];

// Display label for a compute type; "gpu" should read as "GPU", others Title-cased.
const formatComputeTypeLabel = (ct) => {
  if (!ct) return "";
  if (ct === "gpu") return "GPU";
  return ct.charAt(0).toUpperCase() + ct.slice(1);
};

// Ensure "gpu" is always selectable, even when the API-supplied list omits it.
const withGpu = (types) =>
  types.includes("gpu") ? types : [...types, "gpu"];

const getComputeTypesForTarget = (targetType) => {
  if (!targetType) return [];
  const tt = targetTypes.value.find((t) => t.targetType === targetType);
  const types = tt?.runtimeConfig?.computeTypes;
  return types && types.length ? withGpu(types) : [];
};

const getComputeTypesForProcessor = (sourceUrl) => {
  if (!sourceUrl) return DEFAULT_COMPUTE_TYPES;
  const app = availableApplications.value.find((a) => a.source?.url === sourceUrl);
  const types = app?.runtimeConfig?.computeTypes;
  return types && types.length ? withGpu(types) : DEFAULT_COMPUTE_TYPES;
};

// Compliant compute nodes require ECS execution for per-execution isolation, so
// the lambda target is offered but disabled (a Lambda mounts the shared
// per-node filesystem and can't be isolated per run). Basic/secure are
// unaffected. Mirrors the converter's compliant rejection.
const LAMBDA_COMPLIANT_MSG =
  "Lambda isn't available on compliant compute nodes — they require ECS execution so each run is isolated.";
const configureNodeIsCompliant = computed(() => {
  const n = computeNodes.value.find(
    (cn) => cn.uuid === initiateForm.value.computeNodeId
  );
  return (n?.deploymentMode || "basic").toLowerCase() === "compliant";
});
const isComputeTypeDisabled = (ct) =>
  ct === "lambda" && configureNodeIsCompliant.value;
// Don't leave a disabled value selected — fall back to standard on compliant.
const computeTypeForMode = (ct) =>
  configureNodeIsCompliant.value && ct === "lambda" ? "standard" : ct;

/* Version helpers — match WorkflowBuilder */
const normalizeUrl = (url) => {
  if (!url) return "";
  return url.replace(/\.git$/, "").replace(/\/$/, "");
};

const latestVersion = (app) => {
  const versions = app?.versions || [];
  if (versions.length === 0) return null;
  return [...versions].sort(
    (a, b) =>
      (new Date(b.createdAt).getTime() || 0) -
      (new Date(a.createdAt).getTime() || 0),
  )[0];
};

const sortedVersions = (app) => {
  const versions = app?.versions || [];
  return [...versions].sort(
    (a, b) =>
      (new Date(b.createdAt).getTime() || 0) -
      (new Date(a.createdAt).getTime() || 0),
  );
};

const versionOptionLabel = (app, v) => {
  const latest = latestVersion(app);
  return latest && v.version === latest.version
    ? `${v.version} (latest)`
    : v.version;
};

const findMatchedApp = (sourceUrl) => {
  if (!sourceUrl) return null;
  const normalized = normalizeUrl(sourceUrl);
  return (
    availableApplications.value.find(
      (app) =>
        normalizeUrl(app.sourceUrl) === normalized ||
        normalizeUrl(app.source?.url) === normalized
    ) || null
  );
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

const runName = computed(() => {
  const activity = selectedWorkflowActivity.value;
  const raw = activity?.name || "";
  return typeof raw === "string" ? raw.trim() : "";
});

/*
  Interactive (Jupyter) session entry point. A run is offered a notebook when its
  DAG contains an interactive processor and the run is still active (the step
  pauses the workflow while the user works). The connect endpoint is the source
  of truth — the notebook page handles "still starting" / "no session" itself.
*/
const interactiveProcessor = computed(() => {
  const dag = selectedWorkflowActivity.value?.dag || [];
  return dag.find((d) => d.runtimeConfig?.interactive || d.interactive) || null;
});

/*
  Results download: a run whose DAG ends in a download target gets a zip of
  its results from download-service, its creator's. The downloads store
  follows the archive (polling it while it's prepared, which also tells the
  service not to email).
*/
const downloads = useDownloadsStore();
const downloadTarget = computed(() => {
  const dag = selectedWorkflowActivity.value?.dag || [];
  return dag.find((d) => d.type === "data-target" && d.targetType === "download") || null;
});
const runArchive = computed(() => {
  const runId = selectedWorkflowActivity.value?.uuid;
  return runId && downloadTarget.value ? downloads.forRun(runId) : null;
});
const resultsHint = computed(() => {
  const status = selectedWorkflowActivity.value?.status;
  if (isTerminalStatus(status) && status !== "SUCCEEDED") {
    return "The run ended before its results were packaged.";
  }
  return "A zip of the results appears here when the run's download step finishes.";
});
// The archive exists once the download target has asked for it: look again
// when the run or the target's status changes, until it's found.
watch(
  () => [selectedWorkflowActivity.value?.uuid, selectedWorkflowActivity.value?.status, downloadTarget.value?.status],
  ([runId]) => {
    if (runId && downloadTarget.value && !runArchive.value) downloads.loadRuns().catch(() => {});
  },
  { immediate: true }
);

// A results zip made just now (the run finished while, or just before, this
// page was open) is announced: the downloads panel opens on it and a toast
// says so. Older zips are only listed under Results. Once per zip per tab,
// remembered in sessionStorage (a convenience: without it, at most once per
// visit to the page).
const ANNOUNCE_WITHIN_MS = 5 * 60 * 1000;
const ANNOUNCED_KEY = "pennsieve.runArchivesAnnounced";
const wasAnnounced = (id) => {
  try {
    return JSON.parse(sessionStorage.getItem(ANNOUNCED_KEY) || "[]").includes(id);
  } catch {
    return false;
  }
};
const markAnnounced = (id) => {
  try {
    const ids = JSON.parse(sessionStorage.getItem(ANNOUNCED_KEY) || "[]");
    sessionStorage.setItem(ANNOUNCED_KEY, JSON.stringify([...ids, id].slice(-50)));
  } catch {
    // not remembered
  }
};
watch(runArchive, (archive, previous) => {
  if (!archive || previous?.id === archive.id || wasAnnounced(archive.id)) return;
  const age = Date.now() - Date.parse(archive.createdAt || 0);
  if (!(age >= 0 && age < ANNOUNCE_WITHIN_MS)) return;
  markAnnounced(archive.id);
  downloads.panelOpen = true;
  EventBus.$emit("toast", {
    detail: { type: "success", msg: "The run's results are ready to download." },
  });
});

// A session ended here or in the notebook: the run saves it and finishes
// (endedSessions), so End and Open are no longer offered.
const sessionEnding = computed(() => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.uuid || !interactiveProcessor.value) return null;
  const step = nodes.value.find((n) => n.id === interactiveProcessor.value.id);
  return endingPhase({
    ended: sessionEnded(activity.uuid),
    runStatus: activity.status,
    sessionStepStatus: step?.data?.status,
  });
});
const ENDING_MESSAGE = {
  saving: "Session ended. Saving the notebook and its output files; the workflow continues once they're saved. This can take a few minutes.",
  finishing: "Session ended and saved. Running the rest of the workflow…",
};

const interactiveSessionAvailable = computed(() => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.uuid || !interactiveProcessor.value || sessionEnding.value) return false;
  return !isTerminalStatus(activity.status);
});

const openNotebook = () => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.uuid) return;
  router.push(
    isMyWorkspace.value
      ? { name: "my-run-notebook", params: { runId: activity.uuid } }
      : { name: "run-notebook", params: { orgId: route.params.orgId, runId: activity.uuid } }
  );
};

// Terminate the interactive session without opening the notebook: ends it
// cleanly so the workflow resumes to the next step. Confirmed via the in-app
// Pennsieve dialog (not the browser prompt).
const endingSession = ref(false);
const confirmEndOpen = ref(false);
const endSession = () => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.uuid || endingSession.value) return;
  confirmEndOpen.value = true;
};
const confirmEndSession = async () => {
  const activity = selectedWorkflowActivity.value;
  if (!activity?.uuid) return;
  endingSession.value = true;
  try {
    await endInteractiveSession(activity.uuid);
    markSessionEnded(activity.uuid);
    confirmEndOpen.value = false;
  } catch (e) {
    errorBanner.value = e?.message || "Could not end the interactive session.";
  } finally {
    endingSession.value = false;
  }
};

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
// Compact (one line) or detailed nodes: the viewer's choice, shared with
// the workflow builder. Laid out with the box of the current choice.
const { detailed, setDetailed } = useGraphDensity();
const DETAILED_BOX = { width: NODE_WIDTH, height: NODE_HEIGHT, nodesep: 120, ranksep: 150 };

const autoLayout = () => {
  if (nodes.value.length === 0) return;
  const box = layoutBox(detailed.value, DETAILED_BOX);
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: box.nodesep, ranksep: box.ranksep });
  for (const node of nodes.value) g.setNode(node.id, { width: box.width, height: box.height });
  for (const edge of edges.value) g.setEdge(edge.source, edge.target);
  dagre.layout(g);
  nodes.value = nodes.value.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - box.width / 2, y: pos.y - box.height / 2 } };
  });
  setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50);
};

// This page saves no positions, so a graph is laid out for its node size:
// compact always gets a tight layout of its own; detailed keeps the
// definition's saved positions, where it has them.
const needsLayout = (result) => result.needsAutoLayout || !detailed.value;

const changeDensity = (value) => {
  if (value === detailed.value) return;
  setDetailed(value);
  redrawGraph();
  autoLayout();
};

// The graph's nodes and edges again from what it shows (the run, or the
// workflow being configured), keeping where the nodes are: on a change of
// density (ports or not) and when the apps, with their ports, come in.
const redrawGraph = () => {
  const source = mode.value === "browse" ? selectedWorkflowActivity.value : configDefinition.value;
  if (!source || !nodes.value.length) return;
  const result = mode.value === "browse" ? runToNodesAndEdges(source) : definitionToNodesAndEdges(source);
  const at = new Map(nodes.value.map((n) => [n.id, n.position]));
  nodes.value = result.nodes.map((n) => ({ ...n, position: at.get(n.id) || n.position }));
  edges.value = result.edges;
};
watch(() => availableApplications.value.length, redrawGraph);

// What a step's app.yml declares, for its card: its ports (the detailed
// card's connection points) and whether it calls language models.
const stepManifest = (dag, id) => {
  const m = portsOfStep(dag, availableApplications.value)(id);
  return {
    manifestPorts: m ? { inputs: m.inputs || [], outputs: m.outputs || [] } : null,
    llm: !!m?.runtime?.llm,
  };
};

// The edges: in the detailed view, each link on the ports it joins (two
// links between the same steps are two lines); in compact, one line per
// dependency.
const graphEdges = (dag, resultNodes, stroke) => {
  if (detailed.value) return portEdges(dag, resultNodes, (src) => ({ stroke: stroke(src) }));
  const resultEdges = [];
  for (const d of dag) {
    for (const dep of d.dependsOn || []) {
      resultEdges.push({ id: `e${dep}-${d.id}`, source: dep, target: d.id, animated: false, style: { stroke: stroke(dep) } });
    }
  }
  return resultEdges;
};

// A detailed step's connection points on one side, and where each sits:
// over (or under) its port's chip. 11px: the card's padding and border.
const pointsOf = (id, data, side) => stepPoints(id, data.manifestPorts, edges.value, side);
const hasPortChips = (id, data, side) => pointsOf(id, data, side).some((p) => p.port);
const pointStyle = (points, p) =>
  points.length > 1 ? { left: `calc(11px + (100% - 22px) * ${p.at}) !important` } : undefined;

// Titles that tell steps apart, numbered top to bottom when two share a
// name ("test-ports-processor (1)", "(2)"), as in the builder.
const canvasTitles = computed(() =>
  stepNames(
    [...nodes.value].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0)),
    (n) => (n.type === "data-target" ? n.data?.targetType || n.data?.label : n.data?.label)
  )
);
const titleOf = (id, data) => canvasTitles.value.get(id) || data.targetType || data.label;

// A step that finished needs no badge: the ✓ by its title and its green
// border say so. Pending, running, failed and canceled steps keep theirs.
const doneStep = (data) => mode.value === "browse" && data.status === "SUCCEEDED";

// A source with one file shows its name; with more, how many.
const sourceDetail = (data) => {
  if (data.packageCount === 1) {
    const name = browseFileInfo.value[data.packageIds[0]]?.name;
    if (name) return name;
  }
  return `${data.packageCount} file${data.packageCount !== 1 ? "s" : ""}`;
};

// A target's params on its card, without those at their default or the
// path prefix a line from an output's port already shows.
const targetParamsShown = (id, data) =>
  shownTargetParams(
    data.params,
    getTargetTypeDefinition(data.targetType)?.params,
    detailed.value && edges.value.some((e) => e.target === id && portOfHandle(e.sourceHandle))
  );

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
        label: labelForDagNode(d, availableApplications.value, targetTypes.value, dag),
        nodeType: d.type,
        sourceUrl: d.sourceUrl,
        targetType: d.targetType || null,
        computeType: d.computeType || getComputeTypesForTarget(d.targetType)?.[0] || null,
        ...(d.type === "processor" && stepManifest(dag, d.id)),
        defaultParams: d.defaultParams || {},
      },
      position: hasSavedPositions && d.position && typeof d.position.x === "number"
        ? { x: d.position.x, y: d.position.y }
        : { x: 0, y: 0 },
    };
  });
  const dagMap = Object.fromEntries(dag.map((d) => [d.id, d]));
  const resultEdges = graphEdges(dag, resultNodes, (src) => nodeBorderColor(dagMap[src]?.type, null));
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
      if (src?.kind === "viewVersion") {
        // A public dataset, taken in as a dataset view (viewsService).
        extra.view = { viewId: src.viewId, viewVersion: src.viewVersion };
      } else {
        extra.packageIds = src?.packageIds || [];
        extra.packageCount = extra.packageIds.length;
      }
    } else if (d.type === "data-target") {
      extra.targetType = d.targetType || null;
      const cfg = runProcessorConfigs.find((c) => c.nodeId === d.id);
      extra.computeType = cfg?.executionTarget || d.computeType || null;
      const targetParams = runDataTargets[d.id]?.params || {};
      extra.params = Object.entries(targetParams).map(([key, value]) => ({ key, value: String(value) }));
      extra.defaultParams = targetParams;
      extra.datasetId = targetWritesToDataset(d.targetType) ? targetDatasetId(runDataTargets[d.id], run.datasetId) : "";
    } else {
      const cfg = runProcessorConfigs.find((c) => c.nodeId === d.id);
      extra.executionTarget = cfg?.executionTarget || null;
      Object.assign(extra, stepManifest(dag, d.id));
      extra.cpu = cfg?.cpu || null;
      extra.memory = cfg?.memory || null;
      const nodeParams = runProcessorParams[d.id] || {};
      extra.params = Object.entries(nodeParams).map(([key, value]) => ({ key, value: String(value) }));
    }
    return {
      id: d.id,
      type: nodeType,
      data: {
        label: labelForDagNode(d, availableApplications.value, targetTypes.value, dag),
        status: d.status || "NOT_STARTED",
        processorType: d.type,
        sourceUrl: d.sourceUrl,
        version: d.tag || null,
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
  const resultEdges = graphEdges(dag, resultNodes, (src) => nodeBorderColor(dagMap[src]?.type, dagMap[src]?.status));
  return { nodes: resultNodes, edges: resultEdges, needsAutoLayout: !hasSavedPositions };
};

/*
  Live-update event handlers
*/
const parseEventData = (data) => {
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return data; }
  }
  return data;
};

// Re-reads the shown run (its status and its steps') and redraws the graph,
// keeping where the user placed the nodes.
const refreshSelectedRun = async () => {
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
};

// A fallback for live updates: while the shown run isn't finished, check it
// now and then. An update sent before the page subscribed, or lost on a
// reconnect, would otherwise leave it looking stuck until a reload.
const RUN_POLL_MS = 20000;
let runPollTimer = null;
const scheduleRunPoll = () => {
  clearTimeout(runPollTimer);
  runPollTimer = null;
  const activity = selectedWorkflowActivity.value;
  if (mode.value !== "browse" || !activity?.uuid || isTerminalStatus(activity.status)) return;
  runPollTimer = setTimeout(async () => {
    if (document.visibilityState === "visible") {
      try {
        await refreshSelectedRun();
      } catch (err) {
        console.warn("Run refresh failed:", err?.message || err);
      }
    }
    scheduleRunPoll();
  }, RUN_POLL_MS);
};

const onRunStatusUpdate = async (raw) => {
  const data = parseEventData(raw);
  store.commit("analysisModule/UPDATE_RUN_STATUS", { runId: data.runId, status: data.status });

  const currentRunId = selectedWorkflowActivity.value?.uuid;
  if (data.runId === currentRunId) {
    if (isTerminalStatus(data.status)) {
      store.commit("analysisModule/SET_SELECTED_WORKFLOW_ACTIVITY", {
        ...selectedWorkflowActivity.value,
        status: data.status,
      });
      await refreshSelectedRun();
    } else {
      store.commit("analysisModule/SET_SELECTED_WORKFLOW_ACTIVITY", {
        ...selectedWorkflowActivity.value,
        status: data.status,
      });
    }
  }
};

const onProcessorStatusUpdate = (raw) => {
  const data = parseEventData(raw);
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
const fetchRunDatasetName = async (datasetId) => {
  if (!datasetId) {
    runDatasetName.value = "";
    return;
  }
  try {
    const token = await useGetToken();
    const url = `${config.value.apiUrl}/datasets/${datasetId}?api_key=${token}`;
    const response = await useSendXhr(url);
    if (response?.content?.name) {
      runDatasetName.value = response.content.name;
      runDatasetAccessible.value = true;
    } else {
      runDatasetName.value = "You don't have access to this dataset";
      runDatasetAccessible.value = false;
    }
  } catch {
    runDatasetName.value = "You don't have access to this dataset";
    runDatasetAccessible.value = false;
  }
};

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
      // Single-file sources show the file's name on their cards.
      for (const n of result.nodes) {
        if (n.type === "data-source" && n.data.packageCount === 1) fetchPackageNames(n.data.packageIds);
      }
      if (needsLayout(result)) autoLayout();
      else setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50);
    }
    if (activity?.datasetId) {
      fetchRunDatasetName(activity.datasetId);
    }
  } catch (err) {
    console.error("Failed to load run details:", err);
    EventBus.$emit("toast", { detail: { type: "error", msg: "Failed to load run details." } });
  } finally {
    isLoading.value = false;
  }
};

const copyRunId = async () => {
  const uuid = selectedWorkflowActivity.value?.uuid;
  if (!uuid) return;
  try {
    await navigator.clipboard.writeText(uuid);
    EventBus.$emit("toast", { detail: { type: "info", msg: "Run ID copied to clipboard" } });
  } catch {
    console.error("Failed to copy Run ID");
  }
};

const goBack = () => {
  store.dispatch("analysisModule/setSelectedWorkflowActivity", null);
  router.push(scopedRoute("runs"));
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
  initiateForm.value = { workflowId, computeNodeId, datasetId, name: "" };
  runNameError.value = "";
  // Preserve any data layers from the source run so the rerun re-attaches them.
  configLayers.value = Array.isArray(source?.layers) ? [...source.layers] : [];

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
        // Values: the run being rerun, then the definition's defaults on the
        // node, then the registry's (workflow-service applies them in that order).
        const targetParams = targetParamFields(paramDefs, {
          sourceParams: srcTargetParams,
          definitionDefaults: d.defaultParams || {},
        });
        nodeConfigs[d.id] = {
          computeType: computeTypeForMode(srcCfg?.executionTarget || d.computeType || fallback),
          targetType: d.targetType || null,
          // The target's own dataset; "" means the run's.
          datasetId: source?.dataTargets?.[d.id]?.datasetId || "",
          params: targetParams,
        };
      } else if (d.type !== "data-source") {
        // Build schema-driven params from paramSchema + resolvedParams
        const schema = d.paramSchema || [];
        const resolved = d.resolvedParams || {};
        const schemaParams = schema.map((pd) => ({
          name: pd.name,
          type: pd.type || "string",
          description: pd.description || "",
          required: pd.defaultValue == null || pd.defaultValue === undefined,
          validValues: pd.validValues || [],
          resolvedDefault: resolved[pd.name] != null ? String(resolved[pd.name]) : (pd.defaultValue != null ? String(pd.defaultValue) : ""),
          value: srcParams[pd.name] != null
            ? String(srcParams[pd.name])
            : (resolved[pd.name] != null ? String(resolved[pd.name]) : ""),
        }));
        const schemaNames = new Set(schema.map((pd) => pd.name));
        const extraParams = Object.entries(srcParams)
          .filter(([key]) => !schemaNames.has(key))
          .map(([key, value]) => ({ key, value: String(value) }));

        const matchedApp = findMatchedApp(d.sourceUrl);
        nodeConfigs[d.id] = {
          executionTarget: computeTypeForMode(srcCfg?.executionTarget || d.computeType || "standard"),
          version: srcCfg?.version || d.tag || latestVersion(matchedApp)?.version || "",
          cpu: srcCfg?.cpu || (d.runtimeConfig?.cpu ? String(d.runtimeConfig.cpu) : ""),
          memory: srcCfg?.memory || (d.runtimeConfig?.memory ? String(d.runtimeConfig.memory) : ""),
          // Interactive (Jupyter) override. Seeded from the run/definition/app if
          // already declared (forward-compatible once the app registry +
          // workflow-service carry it); otherwise off, and the user can toggle it
          // here so the run launches an interactive session.
          interactive:
            srcCfg?.interactive ??
            d.runtimeConfig?.interactive ??
            matchedApp?.runtimeConfig?.interactive ??
            false,
          sessionType:
            srcCfg?.sessionType ||
            d.runtimeConfig?.sessionType ||
            matchedApp?.runtimeConfig?.sessionType ||
            "jupyter",
          schemaParams,
          extraParams,
        };
      }
    });

    rerunSource.value = null;

    const result = definitionToNodesAndEdges(definition);
    nodes.value = result.nodes;
    edges.value = result.edges;
    if (needsLayout(result)) autoLayout();
    else setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50);

    mode.value = "configure";
    selectedNode.value = null;
    accordionActiveNames.value = ["information"];
  } catch (err) {
    console.error("Failed to load workflow definition:", err);
    EventBus.$emit("toast", { detail: { type: "error", msg: "Failed to load workflow definition." } });
    router.push(scopedRoute("runs"));
  }
};

const cancelConfigure = () => {
  mode.value = "browse";
  configDefinition.value = null;
  configLayers.value = [];
  Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
  Object.keys(nodeConfigs).forEach((k) => delete nodeConfigs[k]);
  nodes.value = [];
  edges.value = [];
  selectedNode.value = null;
  router.push(scopedRoute("runs"));
};

/*
  Execute Workflow
*/
const executeWorkflow = async () => {
  const dag = configDefinition.value?.dag || [];

  const nameResult = validateRunName(initiateForm.value.name);
  runNameError.value = nameResult.error || "";
  if (!nameResult.valid) {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: nameResult.error },
    });
    return;
  }

  // Validate data sources have files selected
  const missingSources = dataSourceNodes.value.filter(
    (d) => !dataSourceFiles[d.id] || dataSourceFiles[d.id].length === 0
  );
  if (missingSources.length > 0) {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: missingFilesMessage(missingSources.map((d) => d.id), configDefinition.value?.dag || []) },
    });
    return;
  }

  for (const [nodeId, cfg] of Object.entries(nodeConfigs)) {
    const dagNode = dag.find((n) => n.id === nodeId);
    if (!dagNode) continue;

    // Validate data-target required params
    if (dagNode.type === "data-target") {
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

    // Validate processor required params
    if (dagNode.type === "processor") {
      const missing = (cfg.schemaParams || []).filter((p) => p.required && !p.value?.trim());
      if (missing.length > 0) {
        const nodeLabel = labelForDagNode(dagNode, availableApplications.value, targetTypes.value, dag) || nodeId;
        const names = missing.map((p) => p.name).join(", ");
        EventBus.$emit("toast", {
          detail: { type: "error", msg: `${nodeLabel}: missing required parameter${missing.length > 1 ? "s" : ""} ${names}` },
        });
        return;
      }
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
        // Interactive (Jupyter) override → workflow-service applies it to the run
        // DAG node's runtimeConfig (interactive waitForTaskToken step).
        if (cfg.interactive) {
          entry.interactive = true;
          entry.sessionType = cfg.sessionType || "jupyter";
        }
        processorConfigs.push(entry);
      }
    });

    const processorParams = {};
    Object.entries(nodeConfigs).forEach(([nodeId, cfg]) => {
      const dagNode = dag.find((n) => n.id === nodeId);
      if (dagNode?.type === "data-target" || dagNode?.type === "data-source") return;
      const obj = {};
      if (cfg.schemaParams) {
        cfg.schemaParams.forEach((p) => { if (p.name && p.value) obj[p.name] = p.value; });
      }
      if (cfg.extraParams) {
        cfg.extraParams.forEach((p) => { if (p.key) obj[p.key] = p.value; });
      }
      if (Object.keys(obj).length > 0) processorParams[nodeId] = obj;
    });

    const dataTargets = buildDataTargets(dag, nodeConfigs, initiateForm.value.datasetId);

    const trimmedName = nameResult.value;
    const payload = {
      workflowInstanceConfiguration: {
        workflowId: initiateForm.value.workflowId,
        computeNodeId: initiateForm.value.computeNodeId,
        ...(processorConfigs.length > 0 && { processorConfigs }),
      },
      datasetId: initiateForm.value.datasetId,
      dataSources,
      ...(trimmedName && { name: trimmedName }),
      ...(Object.keys(dataTargets).length > 0 && { dataTargets }),
      ...(Object.keys(processorParams).length > 0 && { processorParams }),
      ...(configLayers.value.length > 0 && { layers: configLayers.value }),
    };

    await store.dispatch("analysisModule/createRun", payload);
    EventBus.$emit("toast", { detail: { type: "success", msg: "Workflow executed successfully." } });

    router.push(scopedRoute("runs"));
  } catch (err) {
    console.error("Failed to execute workflow:", err);
    const msg = err?.message || "Failed to execute workflow.";
    errorBanner.value = msg;
    errorBannerNodeId.value = initiateForm.value.computeNodeId || "";
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

  // Seed the store with existing selections so the table pre-selects them
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  const existingFiles = dataSourceFiles[nodeId] || [];
  if (existingFiles.length > 0) {
    // Group files by parentId for the store
    const byParent = {};
    for (const file of existingFiles) {
      const pid = file.content?.parentId || "root";
      if (!byParent[pid]) byParent[pid] = [];
      byParent[pid].push(file);
    }
    for (const [parentId, files] of Object.entries(byParent)) {
      store.commit("analysisModule/SET_SELECTED_FILES", { selectedFiles: files, parentId });
    }
  }

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

const onFileSelect = (selectedFiles, parentId) => {
  const nodeId = filePickerNodeId.value;
  if (!nodeId) return;

  // Update the store so navigating folders preserves selections
  store.commit("analysisModule/SET_SELECTED_FILES", { selectedFiles, parentId: parentId || "root" });

  // Rebuild dataSourceFiles from the full store state
  const allFiles = [];
  const storeFiles = store.state.analysisModule.selectedFilesForAnalysis;
  for (const pid in storeFiles) {
    allFiles.push(...storeFiles[pid]);
  }
  dataSourceFiles[nodeId] = allFiles;
};

const closeFilePicker = () => {
  filePickerVisible.value = false;
  filePickerNodeId.value = null;
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
};

const fileCountForNode = (nodeId) => {
  return (dataSourceFiles[nodeId] || []).length;
};

const nodeUnmetCount = (nodeId, nodeType) => {
  if (mode.value !== "configure") return 0;
  if (nodeType === "data-source") {
    return fileCountForNode(nodeId) === 0 ? 1 : 0;
  }
  const cfg = nodeConfigs[nodeId];
  if (!cfg) return 0;
  if (nodeType === "data-target") {
    return (cfg.params || []).filter((p) => p.required && !p.value?.trim()).length;
  }
  // processor
  return (cfg.schemaParams || []).filter((p) => p.required && !p.value?.trim()).length;
};

const removeFileFromNode = (nodeId, index) => {
  if (!dataSourceFiles[nodeId]) return;
  dataSourceFiles[nodeId].splice(index, 1);
};

// Browse mode: resolve package IDs to names
const browseFileInfo = ref({});

const fetchPackageNames = async (packageIds) => {
  if (!packageIds || packageIds.length === 0) return;
  const token = await useGetToken();
  const idsToFetch = packageIds.filter((id) => !browseFileInfo.value[id]);
  for (const id of idsToFetch) {
    try {
      const url = `${config.value.apiUrl}/packages/${id}?api_key=${token}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const pkg = await resp.json();
        browseFileInfo.value[id] = {
          name: pkg.content?.name || id,
          packageType: pkg.content?.packageType || "",
        };
      }
    } catch {
      // leave as ID if fetch fails
    }
  }
};

watch(
  () => selectedNode.value,
  (node) => {
    if (node?.type === "data-source" && mode.value === "browse" && node.data?.packageIds?.length > 0) {
      fetchPackageNames(node.data.packageIds);
    }
    if (node?.type === "data-source" && mode.value === "browse" && node.data?.view) {
      fetchViewInfo(node.data.view);
    }
  }
);

// Browse mode: a view source's dataset, by view id. The view summary names
// its source dataset version: { name, version, doi, entryCount, totalSize }.
const browseViewInfo = ref({});

const fetchViewInfo = async ({ viewId }) => {
  if (browseViewInfo.value[viewId]) return;
  try {
    const view = await getView(viewId);
    const src = view.sources?.[0] || {};
    browseViewInfo.value[viewId] = {
      datasetId: src.datasetId,
      name: src.name || view.name,
      version: src.version,
      doi: src.doi,
      entryCount: view.entryCount,
      totalSize: view.totalSize,
    };
  } catch (err) {
    browseViewInfo.value[viewId] = { error: err?.message || "Could not read the dataset." };
  }
};

// Public dataset sources name their dataset on the card.
watch(
  () => nodes.value.filter((n) => n.data?.view).map((n) => n.data.view.viewId).join(","),
  () => {
    for (const n of nodes.value) if (n.data?.view) fetchViewInfo(n.data.view);
  },
  { immediate: true }
);

const formatViewSize = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};

/*
  Node params helpers (configure mode)
*/
const addExtraParam = (nodeId) => {
  if (!nodeConfigs[nodeId]) return;
  if (!nodeConfigs[nodeId].extraParams) nodeConfigs[nodeId].extraParams = [];
  nodeConfigs[nodeId].extraParams.push({ key: "", value: "" });
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
  Download all logs as zip
*/
const downloadingLogs = ref(false);
const downloadAllLogs = async () => {
  const runId = selectedWorkflowActivity.value?.uuid || props.runId;
  if (!runId) return;
  downloadingLogs.value = true;
  try {
    const token = await useGetToken();
    const url = `${config.value.api2Url}/compute/workflows/runs/${runId}/logs?format=zip`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error("Failed to fetch logs download URL");
    const data = await resp.json();
    if (data.url) {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `run-${runId}-logs.zip`;
      a.click();
    } else {
      throw new Error("No download URL returned");
    }
  } catch (err) {
    console.error("Failed to download logs:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to download logs." },
    });
  } finally {
    downloadingLogs.value = false;
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
  return d ? labelForDagNode(d, availableApplications.value, targetTypes.value, activity.dag) : nodeId;
};

// Detailed cards: how long a step ran (ticking while it runs), its resources
// and, once the run's metrics are in, its cost.
const nowTick = ref(Date.now());
let nowTimer = null;
onMounted(() => {
  nowTimer = setInterval(() => (nowTick.value = Date.now()), 15000);
});
onBeforeUnmount(() => clearInterval(nowTimer));

const nodeCostLabel = (nodeId) => {
  const nm = runMetrics.value?.nodeMetrics?.find((m) => m.nodeId === nodeId);
  const cost = Number(nm?.estimatedCost);
  return nm && cost > 0 ? formatCost(cost) : "";
};
const nodeRunTime = (data) => formatRunTime(nodeDurationSec(data, nowTick.value));
const processorFacts = (id, data) =>
  [data.version, formatResources(data.cpu, data.memory), nodeRunTime(data), nodeCostLabel(id)].filter(Boolean);
const targetFacts = (data) => [nodeRunTime(data)].filter(Boolean);
const viewSourceLabel = (view) => {
  const info = view && browseViewInfo.value[view.viewId];
  if (!info || info.error) return "Public dataset";
  return [info.name, info.version && `v${info.version}`, info.entryCount != null && `${info.entryCount} files`]
    .filter(Boolean)
    .join(" · ");
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

const rerunFromRun = async () => {
  const activity = selectedWorkflowActivity.value;
  if (!activity) return;
  store.commit("analysisModule/SET_PENDING_RUN_CONFIG", {
    workflowId: activity.workflowUuid || "",
    computeNodeId: activity.computeNodeUuid || "",
    datasetId: activity.datasetId || "",
    rerunSource: activity,
  });
  router.push(scopedRoute("run-configure"));
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
  // Live updates for every run in the workspace (or the user's own runs).
  // Subscribed before anything loads, so an update sent while the page is
  // loading isn't missed.
  if (realtime) {
    analyticsChannel = realtime.subscribe(
      // The route's workspace, not activeOrganization: that stays set in My
      // Workspace, where a personal run's events go to the user's channel.
      runScopeChannel(route.params.orgId, store.state.profile?.id)
    );
    store.commit("analysisModule/SET_ANALYTICS_CHANNEL", analyticsChannel);
    analyticsChannel.bind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.bind("workflow-processor-status", onProcessorStatusUpdate);
  }

  await Promise.all([
    store.dispatch("analysisModule/fetchComputeNodes"),
    store.dispatch("analysisModule/fetchTargetTypes"),
    store.dispatch("analysisModule/fetchApplications"),
  ]);

  // Check for pending configure mode
  const pendingConfig = store.state.analysisModule.pendingRunConfig;
  if (pendingConfig) {
    store.commit("analysisModule/CLEAR_PENDING_RUN_CONFIG");
    if (!isMyWorkspace.value) fetchDatasetOptions();
    await initiateWorkflowFromConfig(pendingConfig);
  } else if (props.runId) {
    if (!store.getters["analysisModule/workflowInstances"]?.length) {
      await store.dispatch("analysisModule/fetchWorkflowInstances");
    }
    await loadRun(props.runId);
    scheduleRunPoll();
  } else {
    // No pending config and no runId — nothing to show, redirect to runs
    router.replace(scopedRoute("runs"));
    return;
  }

});

// Handle same-component navigation (e.g. run-detail → run-configure)
watch(
  () => route.name,
  async (newName) => {
    if (newName === "run-configure" || newName === "my-run-configure") {
      const pendingConfig = store.state.analysisModule.pendingRunConfig;
      if (pendingConfig) {
        store.commit("analysisModule/CLEAR_PENDING_RUN_CONFIG");
        if (!isMyWorkspace.value) fetchDatasetOptions();
        await initiateWorkflowFromConfig(pendingConfig);
      }
    }
  }
);

onBeforeUnmount(() => {
  clearTimeout(runPollTimer);
  if (analyticsChannel) {
    analyticsChannel.unbind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.unbind(
      "workflow-processor-status",
      onProcessorStatusUpdate
    );
    analyticsChannel.unsubscribe();
    analyticsChannel = null;
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
            :disabled="isExecuting"
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
          {{ runName || runTimeLabel }}
          <span v-if="runName && runTimeLabel" class="header-workflow-name">{{ runTimeLabel }}</span>
          <span v-if="runWorkflowName" class="header-workflow-name">{{ runWorkflowName }}</span>
        </span>
        <div v-if="sessionEnding" class="header-actions">
          <span class="session-ending-status"><span class="session-ending-spinner" />Ending session…</span>
        </div>
        <div v-else-if="interactiveSessionAvailable" class="header-actions">
          <bf-button class="secondary" :disabled="endingSession" @click="endSession">
            {{ endingSession ? 'Ending…' : 'End Session' }}
          </bf-button>
          <bf-button class="primary" @click="openNotebook">Open Notebook</bf-button>
        </div>
      </template>
    </div>

    <!-- End-session confirmation (Pennsieve dialog, not the browser prompt) -->
    <el-dialog
      v-model="confirmEndOpen"
      title="End interactive session?"
      width="460px"
      :close-on-click-modal="!endingSession"
      :show-close="!endingSession"
      align-center
    >
      <p style="margin: 0; color: #4d4d4d; line-height: 1.5;">
        Ending the session shuts down the notebook kernel and resumes the
        workflow at the next step. Any unsaved notebook changes will be lost —
        open the notebook first if you need to save your work.
      </p>
      <template #footer>
        <bf-button class="secondary mr-8" :disabled="endingSession" @click="confirmEndOpen = false">
          Cancel
        </bf-button>
        <bf-button class="red" :disabled="endingSession" @click="confirmEndSession">
          {{ endingSession ? 'Ending…' : 'End Session' }}
        </bf-button>
      </template>
    </el-dialog>

    <!-- Error Banner -->
    <div v-if="mode === 'browse' && sessionEnding" class="info-banner" role="status">
      {{ ENDING_MESSAGE[sessionEnding] }}
    </div>
    <div v-if="errorBanner" class="error-banner">
      <span class="error-banner-msg">
        {{ errorBanner }}
        <router-link
          v-if="errorBannerNodeId"
          :to="scopedRoute('compute-node-management', { nodeId: errorBannerNodeId })"
          class="error-banner-link"
        >View allowed processors</router-link>
      </span>
      <button class="error-banner-close" @click="errorBanner = ''">&times;</button>
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
                {{ sessionEnding ? "Ending session" : statusLabel(selectedWorkflowActivity?.status) }}
              </span>
              <GraphDensityToggle :detailed="detailed" @update:detailed="changeDensity" />
              <button class="auto-layout-btn" @click="autoLayout">
                Auto Layout
              </button>
            </div>

            <!-- Processor node template -->
            <template #node-default="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'browse' ? statusBorderColor(data.status) : '#cccccc', '--handle-target-color': incomingEdgeColor(id) }">
                <!-- Detailed: a connection point per input port (and the
                     step's main one when a line uses it); compact: one. -->
                <template v-if="detailed">
                  <Handle
                    v-for="p in pointsOf(id, data, 'in')"
                    :id="p.port ? inputHandleId(p.name) : 'target'"
                    :key="`in:${p.name}`"
                    type="target"
                    :position="Position.Top"
                    :style="pointStyle(pointsOf(id, data, 'in'), p)"
                  />
                </template>
                <Handle v-else id="target" type="target" :position="Position.Top" />
                <CompactFlowNode
                  v-if="!detailed"
                  kind="processor"
                  :label="titleOf(id, data)"
                  :status="mode === 'browse' ? data.status : ''"
                  :runtime="mode === 'browse' ? data.executionTarget : nodeConfigs[id]?.executionTarget"
                  :unmet="nodeUnmetCount(id, 'processor')"
                  :actions-on-hover="false"
                >
                  <LlmMark v-if="data.llm" compact />
                  <template v-if="mode === 'browse' && interactiveSessionAvailable && id === interactiveProcessor?.id">
                    <button
                      class="node-action node-action--end"
                      title="End session — resumes the workflow"
                      :disabled="endingSession"
                      @click="endSession"
                    >
                      <IconXCircle :width="14" :height="14" color="#c14d49" />
                    </button>
                    <button
                      class="node-action node-action--play"
                      :class="{ 'node-action--waiting': data.status === 'STARTED' }"
                      title="Interactive notebook is waiting for you — open it"
                      @click="openNotebook"
                    >
                      <IconControllerPlay :width="18" :height="11" color="#011f5b" />
                    </button>
                  </template>
                </CompactFlowNode>
                <div v-else class="custom-node" :class="mode === 'browse' ? [statusClass(data.status), 'app-step'] : 'processor-node'">
                  <span v-if="nodeUnmetCount(id, 'processor') > 0" class="node-unmet-badge">{{ nodeUnmetCount(id, 'processor') }}</span>
                  <div
                    v-if="mode === 'browse' && interactiveSessionAvailable && id === interactiveProcessor?.id"
                    class="node-actions"
                    @click.stop
                  >
                    <button
                      class="node-action node-action--end"
                      title="End session — resumes the workflow"
                      :disabled="endingSession"
                      @click="endSession"
                    >
                      <IconXCircle :width="14" :height="14" color="#c14d49" />
                    </button>
                    <button
                      class="node-action node-action--play"
                      :class="{ 'node-action--waiting': data.status === 'STARTED' }"
                      title="Interactive notebook is waiting for you — open it"
                      @click="openNotebook"
                    >
                      <IconControllerPlay :width="18" :height="11" color="#011f5b" />
                    </button>
                  </div>
                  <PortChips v-if="hasPortChips(id, data, 'in')" :points="pointsOf(id, data, 'in')" side="in" />
                  <div class="node-header">
                    <span class="node-title" :title="titleOf(id, data)">{{ titleOf(id, data) }}</span>
                    <LlmMark v-if="data.llm" />
                    <span v-if="doneStep(data)" class="node-done" title="Complete" aria-label="Complete">✓</span>
                  </div>
                  <div class="node-tags">
                    <span v-if="mode === 'browse' && data.executionTarget" class="node-type-badge exec-badge">{{ data.executionTarget }}</span>
                    <span v-if="mode === 'configure' && nodeConfigs[id]?.executionTarget" class="node-type-badge exec-badge">{{ nodeConfigs[id].executionTarget }}</span>
                    <span v-if="mode === 'browse' && !doneStep(data)" class="node-status-badge" :class="statusDotClass(data.status)">{{ statusLabel(data.status) }}</span>
                  </div>
                  <div v-if="mode === 'browse' && processorFacts(id, data).length" class="node-facts">
                    {{ processorFacts(id, data).join(" · ") }}
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
                  <PortChips v-if="hasPortChips(id, data, 'out')" :points="pointsOf(id, data, 'out')" side="out" />
                </div>
                <template v-if="detailed">
                  <Handle
                    v-for="p in pointsOf(id, data, 'out')"
                    :id="p.port ? portHandleId(p.name) : 'source'"
                    :key="`out:${p.name}`"
                    type="source"
                    :position="Position.Bottom"
                    :style="pointStyle(pointsOf(id, data, 'out'), p)"
                  />
                </template>
                <Handle v-else id="source" type="source" :position="Position.Bottom" />
              </div>
            </template>

            <!-- Data-source node template -->
            <template #node-data-source="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'configure' && fileCountForNode(id) > 0 ? '#17BB62' : '#6366f1' }">
                <CompactFlowNode
                  v-if="!detailed"
                  kind="source"
                  :label="titleOf(id, data)"
                  :unmet="nodeUnmetCount(id, 'data-source')"
                  :detail="mode === 'configure'
                    ? `${fileCountForNode(id)} file${fileCountForNode(id) !== 1 ? 's' : ''} selected`
                    : data.view
                    ? 'Public dataset'
                    : data.packageCount != null
                    ? sourceDetail(data)
                    : ''"
                />
                <div v-else class="custom-node data-source-node" :class="{ 'has-files': mode === 'configure' && fileCountForNode(id) > 0 }">
                  <span v-if="nodeUnmetCount(id, 'data-source') > 0" class="node-unmet-badge">{{ nodeUnmetCount(id, 'data-source') }}</span>
                  <div class="node-header">
                    <span class="node-title" :title="titleOf(id, data)">{{ titleOf(id, data) }}</span>
                  </div>
                  <div class="node-tags">
                    <span v-if="mode === 'browse' && data.view" class="node-tag-info" :title="viewSourceLabel(data.view)">
                      {{ viewSourceLabel(data.view) }}
                    </span>
                    <span v-else-if="mode === 'browse' && data.packageCount != null" class="node-tag-info" :title="sourceDetail(data)">
                      {{ sourceDetail(data) }}
                    </span>
                    <template v-if="mode === 'configure'">
                      <span class="node-tag-info">
                        {{ fileCountForNode(id) }} file{{ fileCountForNode(id) !== 1 ? 's' : '' }} selected
                      </span>
                    </template>
                  </div>
                  <div v-if="mode === 'configure'" class="node-config-hint">Click to select files</div>
                </div>
                <Handle id="source" type="source" :position="Position.Bottom" />
              </div>
            </template>

            <!-- Data-target node template -->
            <template #node-data-target="{ data, id }">
              <div :style="{ '--node-border-color': mode === 'browse' ? (data.status && data.status !== 'NOT_STARTED' ? statusBorderColor(data.status) : '#64748b') : '#64748b', '--handle-target-color': incomingEdgeColor(id) }">
                <Handle id="target" type="target" :position="Position.Top" />
                <CompactFlowNode
                  v-if="!detailed"
                  kind="target"
                  :label="titleOf(id, data)"
                  :status="mode === 'browse' ? data.status : ''"
                  :runtime="nodeConfigs[id]?.computeType || data.computeType"
                  :unmet="nodeUnmetCount(id, 'data-target')"
                />
                <div v-else class="custom-node data-target-node" :class="mode === 'browse' ? statusClass(data.status) : ''">
                  <span v-if="nodeUnmetCount(id, 'data-target') > 0" class="node-unmet-badge">{{ nodeUnmetCount(id, 'data-target') }}</span>
                  <div class="node-header">
                    <span class="node-title" :title="titleOf(id, data)">{{ titleOf(id, data) }}</span>
                    <span v-if="doneStep(data)" class="node-done" title="Complete" aria-label="Complete">✓</span>
                  </div>
                  <div class="node-tags">
                    <span v-if="nodeConfigs[id]?.computeType || data.computeType" class="node-type-badge exec-badge">
                      {{ nodeConfigs[id]?.computeType || data.computeType }}
                    </span>
                    <span v-if="mode === 'browse' && !doneStep(data)" class="node-status-badge" :class="statusDotClass(data.status)">{{ statusLabel(data.status) }}</span>
                  </div>
                  <div v-if="mode === 'browse' && targetFacts(data).length" class="node-facts">
                    {{ targetFacts(data).join(" · ") }}
                  </div>
                  <div class="node-body">
                    <div v-if="mode === 'browse' && targetParamsShown(id, data).length > 0" class="param-preview">
                      <div v-for="(p, i) in targetParamsShown(id, data).slice(0, 3)" :key="i" class="param-row">
                        <span class="param-key">{{ p.key }}</span>
                        <span v-if="p.value" class="param-val">{{ p.value }}</span>
                      </div>
                      <span v-if="targetParamsShown(id, data).length > 3" class="param-more">+{{ targetParamsShown(id, data).length - 3 }} more</span>
                    </div>
                    <template v-if="mode === 'configure'">
                      <div v-if="nodeConfigs[id]?.params?.length > 0" class="param-preview">
                        <div v-for="(p, i) in nodeConfigs[id].params.slice(0, 3)" :key="i" class="param-row">
                          <span class="param-key">{{ p.name || p.key }}</span>
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
                    <el-option
                      v-for="ct in getComputeTypesForProcessor(selectedNode.data?.sourceUrl)"
                      :key="ct"
                      :label="formatComputeTypeLabel(ct)"
                      :value="ct"
                      :disabled="isComputeTypeDisabled(ct)"
                    >
                      <el-tooltip
                        :disabled="!isComputeTypeDisabled(ct)"
                        :content="LAMBDA_COMPLIANT_MSG"
                        placement="right"
                      >
                        <span>{{ formatComputeTypeLabel(ct) }}</span>
                      </el-tooltip>
                    </el-option>
                  </el-select>
                </div>
                <div class="config-field">
                  <label>Interactive Notebook</label>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <el-switch v-model="nodeConfigs[selectedNode.id].interactive" />
                    <span class="version-hint">Run this step as a live Jupyter notebook — the workflow pauses until you close the session.</span>
                  </div>
                </div>
                <div class="config-field">
                  <label>Version</label>
                  <el-select
                    v-model="nodeConfigs[selectedNode.id].version"
                    size="small"
                    style="width: 100%"
                    placeholder="latest"
                    :disabled="sortedVersions(findMatchedApp(selectedNode.data?.sourceUrl)).length <= 1"
                  >
                    <el-option
                      v-for="v in sortedVersions(findMatchedApp(selectedNode.data?.sourceUrl))"
                      :key="v.version"
                      :label="versionOptionLabel(findMatchedApp(selectedNode.data?.sourceUrl), v)"
                      :value="v.version"
                    />
                  </el-select>
                  <span
                    v-if="sortedVersions(findMatchedApp(selectedNode.data?.sourceUrl)).length <= 1"
                    class="version-hint"
                  >No other versions available</span>
                </div>

                <!-- CPU / Memory (Standard only) -->
                <template v-if="nodeConfigs[selectedNode.id].executionTarget === 'standard'">
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

                <!-- Schema-driven params -->
                <div v-if="nodeConfigs[selectedNode.id].schemaParams?.length > 0" class="config-field">
                  <label>Parameters</label>
                  <div
                    v-for="param in nodeConfigs[selectedNode.id].schemaParams"
                    :key="param.name"
                    class="target-param"
                  >
                    <div class="target-param-header">
                      <span class="target-param-name">{{ param.name }}</span>
                      <span v-if="param.required" class="target-param-required">required</span>
                    </div>
                    <el-tooltip
                      v-if="param.description"
                      :content="param.description"
                      placement="left"
                    >
                      <div class="target-param-description">{{ param.description }}</div>
                    </el-tooltip>
                    <el-select
                      v-if="param.validValues && param.validValues.length > 0"
                      v-model="param.value"
                      size="small"
                      :placeholder="param.resolvedDefault ? `default: ${param.resolvedDefault}` : (param.required ? 'Required' : 'Optional')"
                      clearable
                      style="width: 100%"
                    >
                      <el-option
                        v-for="v in param.validValues"
                        :key="v"
                        :label="v"
                        :value="v"
                      />
                    </el-select>
                    <template v-else-if="param.name === 'ASSET_TYPE'">
                      <el-select
                        :model-value="
                          ASSET_TYPE_OPTIONS.includes(param.value) || (!param.value && !customAssetTypeNodes.has(selectedNode.id))
                            ? (param.value ?? '')
                            : ASSET_TYPE_CUSTOM
                        "
                        size="small"
                        placeholder="Select asset type..."
                        clearable
                        style="width: 100%"
                        @update:model-value="
                          (val) => {
                            if (val === ASSET_TYPE_CUSTOM) {
                              customAssetTypeNodes.add(selectedNode.id);
                              param.value = '';
                            } else {
                              customAssetTypeNodes.delete(selectedNode.id);
                              param.value = val;
                            }
                          }
                        "
                      >
                        <el-option
                          v-for="v in ASSET_TYPE_OPTIONS"
                          :key="v"
                          :label="v"
                          :value="v"
                        />
                        <el-option
                          :key="ASSET_TYPE_CUSTOM"
                          label="Other (custom)"
                          :value="ASSET_TYPE_CUSTOM"
                        />
                      </el-select>
                      <el-input
                        v-if="customAssetTypeNodes.has(selectedNode.id) || (param.value && !ASSET_TYPE_OPTIONS.includes(param.value))"
                        v-model="param.value"
                        size="small"
                        placeholder="Enter custom asset type..."
                        style="margin-top: 4px"
                      />
                    </template>
                    <el-input
                      v-else
                      v-model="param.value"
                      size="small"
                      :placeholder="param.resolvedDefault ? `default: ${param.resolvedDefault}` : (param.required ? 'Required' : 'Optional')"
                    />
                  </div>
                </div>

                <!-- Extra free-form params -->
                <div class="config-field">
                  <label v-if="!nodeConfigs[selectedNode.id].schemaParams?.length">Parameters</label>
                  <label v-else-if="nodeConfigs[selectedNode.id].extraParams?.length > 0">Additional Parameters</label>
                  <div
                    v-for="(param, index) in nodeConfigs[selectedNode.id].extraParams"
                    :key="index"
                    class="param-row"
                  >
                    <el-input v-model="param.key" size="small" placeholder="Key" class="param-key" />
                    <el-input v-model="param.value" size="small" placeholder="Value" class="param-value" />
                    <button class="param-remove-btn" @click="nodeConfigs[selectedNode.id].extraParams.splice(index, 1)">&times;</button>
                  </div>
                  <button class="text-link-btn" @click="addExtraParam(selectedNode.id)">+ Add parameter</button>
                </div>
              </div>

              <button class="text-link-btn" @click="selectedNode = null">
                Clear selection
              </button>
            </template>

            <!-- CONFIGURE MODE: Selected data-target node -->
            <template v-else-if="mode === 'configure' && selectedNode && selectedNode.type === 'data-target' && nodeConfigs[selectedNode.id]">
              <h4 class="sidebar-section-title">Data Target Configuration</h4>
              <div v-if="!getTargetTypeDefinition(selectedNode.data?.targetType)" class="target-type-missing">
                Target type "{{ selectedNode.data?.targetType }}" is no longer available, so it has no parameters or runtimes here. Edit the workflow and choose a current target type.
              </div>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Target Type</span>
                  <span class="info-value">{{ getTargetTypeLabel(selectedNode.data?.targetType, targetTypes) || 'N/A' }}</span>
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
                      :label="formatComputeTypeLabel(ct)"
                      :value="ct"
                      :disabled="isComputeTypeDisabled(ct)"
                    >
                      <el-tooltip
                        :disabled="!isComputeTypeDisabled(ct)"
                        :content="LAMBDA_COMPLIANT_MSG"
                        placement="right"
                      >
                        <span>{{ formatComputeTypeLabel(ct) }}</span>
                      </el-tooltip>
                    </el-option>
                  </el-select>
                </div>

                <!-- Which dataset the target writes to (the run's, by default) -->
                <div
                  v-if="targetWritesToDataset(selectedNode.data?.targetType)"
                  class="config-field"
                >
                  <TargetDatasetField
                    v-model="nodeConfigs[selectedNode.id].datasetId"
                    :run-dataset-id="initiateForm.datasetId"
                    :datasets="datasetOptions"
                  />
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
                    </div>
                    <div v-if="param.description" class="target-param-description">{{ param.description }}</div>
                    <LayerNameSelector
                      v-if="nodeConfigs[selectedNode.id].targetType === 'persistent-layer' && param.name === 'layerName'"
                      v-model="param.value"
                      :compute-node-id="initiateForm.computeNodeId"
                    />
                    <el-select
                      v-else-if="nodeConfigs[selectedNode.id].targetType === 'download' && param.name === 'notify'"
                      v-model="param.value"
                      size="small"
                      style="width: 100%"
                    >
                      <el-option
                        v-for="o in DOWNLOAD_NOTIFY_OPTIONS"
                        :key="o.value"
                        :label="o.label"
                        :value="o.value"
                      />
                    </el-select>
                    <template v-else-if="param.name === 'ASSET_TYPE'">
                      <el-select
                        :model-value="
                          ASSET_TYPE_OPTIONS.includes(param.value) || (!param.value && !customAssetTypeNodes.has(selectedNode.id))
                            ? (param.value ?? '')
                            : ASSET_TYPE_CUSTOM
                        "
                        size="small"
                        placeholder="Select asset type..."
                        clearable
                        style="width: 100%"
                        @update:model-value="
                          (val) => {
                            if (val === ASSET_TYPE_CUSTOM) {
                              customAssetTypeNodes.add(selectedNode.id);
                              param.value = '';
                            } else {
                              customAssetTypeNodes.delete(selectedNode.id);
                              param.value = val;
                            }
                          }
                        "
                      >
                        <el-option
                          v-for="v in ASSET_TYPE_OPTIONS"
                          :key="v"
                          :label="v"
                          :value="v"
                        />
                        <el-option
                          :key="ASSET_TYPE_CUSTOM"
                          label="Other (custom)"
                          :value="ASSET_TYPE_CUSTOM"
                        />
                      </el-select>
                      <el-input
                        v-if="customAssetTypeNodes.has(selectedNode.id) || (param.value && !ASSET_TYPE_OPTIONS.includes(param.value))"
                        v-model="param.value"
                        size="small"
                        placeholder="Enter custom asset type..."
                        style="margin-top: 4px"
                      />
                    </template>
                    <el-input
                      v-else
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
              <h4 class="sidebar-section-title">Source Files</h4>
              <div v-if="dataSourceFiles[selectedNode.id]?.length > 0" class="selected-files-list">
                <div
                  v-for="(file, idx) in dataSourceFiles[selectedNode.id]"
                  :key="file.content?.id || idx"
                  class="selected-file-item"
                >
                  <IconCollection v-if="file.content?.packageType === 'Collection'" :width="14" :height="14" class="selected-file-icon collection" />
                  <IconFile v-else :width="14" :height="14" class="selected-file-icon" />
                  <span class="selected-file-name">{{ file.content?.name || 'Unnamed file' }}</span>
                  <button class="selected-file-remove" @click="removeFileFromNode(selectedNode.id, idx)" title="Remove file">&times;</button>
                </div>
              </div>
              <div v-else class="selected-files-empty">
                No files selected yet.
              </div>
              <div class="info-actions">
                <button class="text-link-btn" @click="openFilePicker(selectedNode.id)">{{ fileCountForNode(selectedNode.id) > 0 ? 'Change files' : 'Select files' }}</button>
              </div>
            </template>

            <!-- CONFIGURE MODE: no node selected — show summary -->
            <template v-else-if="mode === 'configure'">
              <h4 class="sidebar-section-title">Configuration Summary</h4>
              <div class="info-card">
                <div class="info-row info-row-stacked">
                  <label class="info-label" for="run-name-input">Run Name <span class="info-label-hint">(optional)</span></label>
                  <input
                    id="run-name-input"
                    v-model="initiateForm.name"
                    class="run-name-input"
                    :class="{ 'has-error': !!runNameError }"
                    type="text"
                    :maxlength="RUN_NAME_MAX_LENGTH"
                    placeholder="e.g. Sleep-stage-batch-01"
                    @input="runNameError = ''"
                    @blur="runNameError = validateRunName(initiateForm.name).error || ''"
                  />
                  <span v-if="runNameError" class="run-name-error">{{ runNameError }}</span>
                  <span v-else class="run-name-hint">
                    Up to {{ RUN_NAME_MAX_LENGTH }} characters — letters, numbers, spaces, hyphens, underscores, periods.
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">Workflow</span>
                  <span class="info-value">{{ configDefinition?.name || 'N/A' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Compute Node</span>
                  <span class="info-value">{{ computeNodeName(initiateForm.computeNodeId) }}</span>
                </div>
                <div v-if="!isMyWorkspace" class="info-row">
                  <span class="info-label">Dataset</span>
                  <span class="info-value">
                    {{ datasetOptions.find(d => d.content?.id === initiateForm.datasetId)?.content?.name || initiateForm.datasetId }}
                  </span>
                </div>
                <div v-if="configLayers.length" class="info-row">
                  <span class="info-label">Reference data</span>
                  <span class="info-value">{{ configLayers.join(', ') }}</span>
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
              <template v-if="selectedNode.data?.view">
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">Name</span>
                    <span class="info-value">{{ selectedNode.data?.label || 'Unnamed' }}</span>
                  </div>
                  <template v-for="info in [browseViewInfo[selectedNode.data.view.viewId]]" :key="selectedNode.data.view.viewId">
                    <div v-if="!info" class="info-row">
                      <span class="info-value">Loading…</span>
                    </div>
                    <div v-else-if="info.error" class="info-row">
                      <span class="info-value">{{ info.error }}</span>
                    </div>
                    <template v-else>
                      <div class="info-row">
                        <span class="info-label">Public dataset</span>
                        <span class="info-value">
                          <router-link
                            v-if="info.datasetId"
                            :to="{ name: 'public-dataset', params: { datasetId: info.datasetId } }"
                          >{{ info.name }}</router-link>
                          <template v-else>{{ info.name }}</template>
                        </span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Version</span>
                        <span class="info-value">{{ info.version }}</span>
                      </div>
                      <div v-if="info.doi" class="info-row">
                        <span class="info-label">DOI</span>
                        <span class="info-value">
                          <a :href="`https://doi.org/${info.doi}`" target="_blank" rel="noopener">{{ info.doi }}</a>
                        </span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Files</span>
                        <span class="info-value">{{ info.entryCount }} · {{ formatViewSize(info.totalSize) }}</span>
                      </div>
                    </template>
                  </template>
                </div>
                <p class="configure-hint">
                  The notebook downloads the files it needs from this dataset.
                </p>
              </template>
              <template v-else>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{ selectedNode.data?.label || 'Unnamed' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Files</span>
                  <span class="info-value">{{ selectedNode.data?.packageCount || 0 }} file{{ selectedNode.data?.packageCount !== 1 ? 's' : '' }}</span>
                </div>
              </div>
              <h4 class="sidebar-section-title">Source Files</h4>
              <div v-if="selectedNode.data?.packageIds?.length > 0" class="selected-files-list">
                <div
                  v-for="pkgId in selectedNode.data.packageIds"
                  :key="pkgId"
                  class="selected-file-item"
                >
                  <IconCollection v-if="browseFileInfo[pkgId]?.packageType === 'Collection'" :width="14" :height="14" class="selected-file-icon collection" />
                  <IconFile v-else :width="14" :height="14" class="selected-file-icon" />
                  <span class="selected-file-name">{{ browseFileInfo[pkgId]?.name || pkgId }}</span>
                </div>
              </div>
              </template>
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
                <div v-if="selectedNode.data?.version" class="info-row">
                  <span class="info-label">Version</span>
                  <span class="info-value">{{ selectedNode.data.version }}</span>
                </div>
                <div v-if="selectedNode.data?.datasetId" class="info-row">
                  <span class="info-label">Writes to</span>
                  <span class="info-value">{{ datasetName(selectedNode.data.datasetId, datasetOptions) }}</span>
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
                <div v-if="runName" class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value truncate-value">
                    <span class="truncate-text" :title="runName">{{ runName }}</span>
                  </span>
                </div>
                <div v-if="runWorkflowName" class="info-row">
                  <span class="info-label">Workflow</span>
                  <span class="info-value truncate-value">
                    <router-link
                      v-if="selectedWorkflowActivity.workflowUuid"
                      :to="scopedRoute('workflow-detail', { uuid: selectedWorkflowActivity.workflowUuid })"
                      :title="runWorkflowName"
                      class="truncate-text"
                    >
                      {{ runWorkflowName }}
                    </router-link>
                    <span v-else class="truncate-text" :title="runWorkflowName">{{ runWorkflowName }}</span>
                  </span>
                </div>
                <div v-if="selectedWorkflowActivity.datasetId" class="info-row">
                  <span class="info-label">Dataset</span>
                  <span v-if="!runDatasetName" class="info-value">Loading...</span>
                  <span v-else-if="runDatasetAccessible" class="info-value">
                    <router-link :to="{ name: 'dataset-overview', params: { datasetId: selectedWorkflowActivity.datasetId } }">
                      {{ runDatasetName }}
                    </router-link>
                  </span>
                  <span v-else class="info-value no-access">{{ runDatasetName }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Run ID</span>
                  <span class="info-value info-url run-id-value">
                    <span class="run-id-text" :title="selectedWorkflowActivity.uuid">{{ selectedWorkflowActivity.uuid }}</span>
                    <button class="copy-id-btn" @click="copyRunId" title="Copy Run ID">
                      <IconCopyDocument :width="12" :height="12" />
                    </button>
                  </span>
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
                  <span class="info-value truncate-value">
                    <router-link
                      :to="scopedRoute('compute-node-management', { nodeId: selectedWorkflowActivity.computeNodeUuid })"
                      :title="computeNodeName(selectedWorkflowActivity.computeNodeUuid)"
                      class="truncate-text"
                    >
                      {{ computeNodeName(selectedWorkflowActivity.computeNodeUuid) }}
                    </router-link>
                  </span>
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
              </div>
              <template v-if="downloadTarget">
                <h4 class="sidebar-section-title">Results</h4>
                <div class="info-card results-card">
                  <DownloadItem v-if="runArchive" :download="runArchive" />
                  <p v-else class="results-hint">{{ resultsHint }}</p>
                </div>
              </template>
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

              <bf-button class="secondary export-run-btn" :disabled="downloadingLogs" @click="downloadAllLogs">
                {{ downloadingLogs ? 'Downloading...' : 'Download Logs & Configuration' }}
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
      :title="sourcePicker.title"
      width="800px"
      :close-on-click-modal="false"
      @close="closeFilePicker"
    >
      <div class="file-picker-content">
        <p v-if="sourcePicker.hint" class="file-picker-hint">{{ sourcePicker.hint }}</p>
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
          <div class="receipt-title">{{ runName || runWorkflowName || 'Workflow Run' }}</div>
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

        <div v-if="runMetrics.nodeMetrics?.some(nm => nm.computeType === 'gpu')" class="receipt-gpu-notice">
          GPU instance costs are estimates and may not reflect spin-down time.
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
          <div class="receipt-title">{{ runName || selectedWorkflowActivity?.workflowName || 'Workflow' }}</div>
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

.info-banner {
  padding: 10px 16px;
  background: #EEF2FF;
  border-bottom: 1px solid #C7D2FE;
  color: #1E3A8A;
  font-size: 13px;
  line-height: 1.4;
}
.session-ending-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4B5563;
}
.session-ending-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #C7D2FE;
  border-top-color: #4F46E5;
  border-radius: 50%;
  animation: session-ending-spin 0.9s linear infinite;
}
@keyframes session-ending-spin {
  to {
    transform: rotate(360deg);
  }
}
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #FEE2E2;
  border-bottom: 1px solid #FECACA;
  color: #991B1B;
  font-size: 13px;
  line-height: 1.4;

  .error-banner-msg {
    flex: 1;
    font-weight: 500;
  }

  .error-banner-link {
    margin-left: 8px;
    color: #991B1B;
    text-decoration: underline;
    font-weight: 600;

    &:hover {
      color: #7F1D1D;
    }
  }

  .error-banner-close {
    background: none;
    border: none;
    color: #991B1B;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
    margin-left: 12px;
    line-height: 1;
    opacity: 0.6;
    transition: opacity 0.2s;

    &:hover {
      opacity: 1;
    }
  }
}

.builder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 24px;
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
.node-unmet-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: theme.$red_1;
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  line-height: 1;
}

/* Interactive processor affordances: End session (✕) + Open notebook (▶). */
.node-actions {
  position: absolute;
  top: -12px;
  right: -10px;
  display: flex;
  gap: 5px;
  z-index: 2;
}
.node-action {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid #b3bcce; /* purple_0_7 */
  background: #fff;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.node-action:disabled {
  opacity: 0.5;
  cursor: default;
}
.node-action--play:hover {
  background: #e6e9ef; /* purple_tint */
  animation: none;
}
/* Pulse only while the interactive step is actually running (STARTED) — i.e.
   the session is live and waiting for the user. */
.node-action--waiting {
  box-shadow: 0 0 0 0 rgba(1, 31, 91, 0.5);
  animation: nb-waiting-pulse 2s infinite;
}
.node-action--waiting:hover {
  animation: none;
}
/* The play glyph only fills the left half of its 0 0 20 12 viewBox, so nudge
   it right to optically center within the round button. */
.node-action--play svg {
  transform: translateX(5px);
}
.node-action--end {
  border-color: #f0c0bb;
}
.node-action--end:hover {
  background: #feeeec; /* red_tint */
  border-color: #c14d49; /* red_2 */
}
@keyframes nb-waiting-pulse {
  0% { box-shadow: 0 0 0 0 rgba(1, 31, 91, 0.45); }
  70% { box-shadow: 0 0 0 7px rgba(1, 31, 91, 0); }
  100% { box-shadow: 0 0 0 0 rgba(1, 31, 91, 0); }
}

/* The builder's cards: the background says what a step is (a source's
   indigo, a target's slate), the border how it's doing. An app's card is
   white on a run, as the status colours clash with its orange; it has the
   orange only while the run is being configured (no status yet). */
.custom-node {
  position: relative;
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 8px 10px;
  min-width: 250px;
  max-width: 350px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  cursor: pointer;
  text-align: left;
  z-index: 1;

  &:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
  }

  .node-title {
    font-weight: 600;
    font-size: 15px;
    color: theme.$black;
    flex: 1;
    min-width: 0;
    line-height: 1.3;
    text-align: left;
    // One line; the full name on hover.
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .node-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 4px;

    &:empty {
      display: none;
    }
  }

  &.processor-node {
    --port-chip-bg: #{theme.$white};
    background: theme.$orange_tint;
    border-color: theme.$orange_2;
  }

  // An app step on a run: white, with the processor orange as a strip on
  // the left (as on the compact cards), so the border can say its status.
  &.app-step::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 4px;
    border-radius: 3px 0 0 3px;
    background: theme.$orange_2;
  }

  // Finished: a ✓ by the title, in place of a status badge.
  .node-done {
    flex-shrink: 0;
    font-size: 15px;
    font-weight: 700;
    color: theme.$status_green;
  }

  .node-tag-info {
    font-size: 10px;
    color: theme.$gray_4;
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // Run time, resources and cost under a detailed card's badges.
  .node-facts {
    margin-top: 4px;
    font-size: 11px;
    color: theme.$gray_4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
      border-radius: 2px;
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

    // How it runs, not how it's doing: neutral, so colour stays with status.
    &.exec-badge {
      background: none;
      border: 1px solid theme.$gray_3;
      padding: 1px 7px;
      color: theme.$gray_5;
      font-weight: 600;
    }
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

.results-card {
  .results-hint {
    margin: 0;
    font-size: 13px;
    color: theme.$gray_4;
  }
}

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

.truncate-value {
  min-width: 0;
}

.truncate-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}


.run-id-value {
  min-width: 0;
}

.run-id-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.copy-id-btn,
.nav-btn {
  background: none;
  border: none;
  cursor: pointer !important;
  padding: 2px;
  opacity: 0.4;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  transition: opacity 0.2s ease;
  color: inherit;
  text-decoration: none;

  &:hover {
    opacity: 1;
  }

  :deep(svg) {
    cursor: pointer !important;
    pointer-events: none;
  }
}

.no-access {
  color: theme.$orange_2;
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

.info-row-stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.info-label-hint {
  font-weight: 400;
  color: theme.$gray_4;
  text-transform: none;
  letter-spacing: 0;
}

.run-name-input {
  width: 100%;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$black;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: theme.$purple_3;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }

  &.has-error {
    border-color: #e02d2d;
    box-shadow: 0 0 0 2px rgba(224, 45, 45, 0.12);
  }
}

.run-name-hint {
  font-size: 11px;
  color: theme.$gray_4;
  line-height: 1.4;
}

.run-name-error {
  font-size: 11px;
  color: #e02d2d;
  line-height: 1.4;
}

.runtime-tag {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 2px;
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

.version-hint {
  font-size: 11px;
  color: theme.$gray_4;
  font-style: italic;
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

.target-type-missing {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
  line-height: 1.4;
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

.selected-files-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 4px;
}

.selected-file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 12px;
}

.selected-file-icon {
  flex-shrink: 0;
  color: theme.$purple_2;
}

.selected-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: theme.$black;
}

.selected-file-remove {
  background: none;
  border: none;
  color: theme.$gray_4;
  font-size: 14px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;

  &:hover { color: theme.$red_1; }
}

.selected-files-empty {
  font-size: 12px;
  color: theme.$gray_4;
  padding: 6px 0;
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
  border-radius: 3px;
  white-space: nowrap;

  &.lambda {
    background: #fef3c7;
    color: #92400e;
  }

  &.ecs, &.standard {
    background: #e0f7fa;
    color: #1e40af;
  }

  &.gpu {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
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

.receipt-gpu-notice {
  font-size: 11px;
  color: #D97706;
  background: rgba(#F59E0B, 0.08);
  padding: 6px 10px;
  border-radius: 4px;
  margin-top: 8px;
  line-height: 1.4;
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
.file-picker-hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: #6b7280;
}
</style>
