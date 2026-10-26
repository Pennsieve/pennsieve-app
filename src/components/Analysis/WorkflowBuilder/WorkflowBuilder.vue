<script setup>
import { computed, h, ref, reactive, onMounted, onBeforeUnmount, nextTick, watch } from "vue";

import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";

// Vue Flow Imports
import { useVueFlow, VueFlow, Handle, Position } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import dagre from "@dagrejs/dagre";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowLeft, ArrowRight, RefreshLeft, RefreshRight } from "@element-plus/icons-vue";
import EventBus from "../../../utils/event-bus";
import IconFile from "../../icons/IconFile.vue";
import IconCollection from "../../icons/IconCollection.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import IconInfoSmall from "../../icons/IconInfoSmall.vue";
import IconPencil from "../../icons/IconPencil.vue";
import IconPennsieveMark from "../../icons/IconPennsieveMark.vue";
import {
  STANDARD_CPU_OPTIONS,
  getStandardMemoryOptions,
  LAMBDA_MEMORY_OPTIONS,
  getCpuForMemory,
  formatResourceLabel,
  targetTypeName,
} from "../RunMonitor/runHelpers";
import BfButton from "../../shared/bf-button/BfButton.vue";
import MetricsDashboard from "../Metrics/MetricsDashboard.vue";
import CompactFlowNode from "../WorkflowGraph/CompactFlowNode.vue";
import GraphDensityToggle from "../WorkflowGraph/GraphDensityToggle.vue";
import { COMPACT_BOX, layoutBox, overlaps, recenter, useGraphDensity } from "../WorkflowGraph/graphDensity";
import {
  toParamSchema,
  validateAppConnection,
  validateStepInputs,
} from "../Applications/applicationSchema";
import { useAppManifest } from "@/composables/useAppManifest";
import BuilderBar from "./BuilderBar.vue";
import BuilderPalette from "./BuilderPalette.vue";
import ParamField from "./ParamField.vue";
import { ioLine, sessionTypeOf, versionManifest, shortMediaType } from "./appManifestInfo";
import { appColors } from "../Applications/appDomains";
import { diffLines, manifestDiff, versionWarnings } from "./manifestDiff";
import { builderReadiness } from "./builderReadiness";
import StepPicker from "./StepPicker.vue";
import { useGraphHistory, snapshot } from "./graphHistory";
import { canConnect, neighbourInDirection } from "./graphEditing";
import {
  routedOutputs,
  portHandleId,
  portOfHandle,
  canConnectFromHandle,
  withPortPrefix,
  withoutPortPrefix,
  prefixParamOf,
  PREFIX_PARAMS,
  attachPorts,
} from "./outputPorts";
import { requiredUnset } from "./builderReadiness";
import { fitsAfter } from "./appManifestInfo";

const { onNodeClick, onPaneClick, onConnect, onConnectStart, onConnectEnd, screenToFlowCoordinate, fitView } =
  useVueFlow();

const props = defineProps({
  uuid: {
    type: String,
    default: "",
  },
  // Where the builder's bar goes (a selector), e.g. the Workflows tab's
  // toolbar; empty: above the canvas.
  toolbarTarget: {
    type: String,
    default: "",
  },
});

const router = useRouter();
const route = useRoute();
// A workflow's page leads back to the Workflows tab's Library (My
// Workspace's pages live under My Analysis, with no orgId).
const workflowsRoute = computed(() => ({
  name: route.params.orgId ? "workflows" : "my-workflows",
  query: { view: "library" },
}));

/*
Local State
*/
const isLoading = ref(false);
const nodes = ref([]);
const edges = ref([]);
const workflowName = ref("");
const workflowDescription = ref("");
const draggedApp = ref(null);
const draggedType = ref(null); // 'application', 'data-source', or 'data-target'

// Mode & workflow list state
const mode = ref("browse"); // 'browse' (a saved workflow, read-only) | 'edit' (its owner editing it) | 'create'
const selectedWorkflow = ref(null);
const accordionActiveNames = ref(["workflows"]);

// Information panel state
const isEditingDetails = ref(false);
const editName = ref("");
const editDescription = ref("");
const isSavingDetails = ref(false);
const selectedNode = ref(null); // currently selected node on canvas
const editingTargetNodes = reactive(new Set()); // track which data-target nodes are in edit mode
const sidebarRef = ref(null);

// Resolve the original processor definition for the selected node
const selectedNodeProcessor = computed(() => {
  if (!selectedNode.value || !selectedWorkflow.value) return null;
  const wfNodes = selectedWorkflow.value.dag || [];
  return wfNodes.find((p) => p.id === selectedNode.value.id) || null;
});

// Get parameter schema for selected processor node
const selectedNodeParamSchema = computed(() => {
  const node = selectedNode.value;
  if (!node || node.type !== "default") return [];
  // In browse mode: use paramSchema from the workflow definition DAG node
  if (node.data?.paramSchema?.length > 0) return node.data.paramSchema;
  // Else the pinned version's app.yml (per-version manifests)
  const manifestParams = versionManifest(node.data?.application, node.data?.tag)?.parameters;
  if (manifestParams?.length) return toParamSchema(manifestParams);
  // In create mode: use params from the application (flat key-value object)
  const appParams = node.data?.application?.params;
  if (appParams && typeof appParams === "object" && !Array.isArray(appParams)) {
    return Object.entries(appParams).map(([name, defaultValue]) => ({
      name,
      defaultValue: defaultValue !== "" ? defaultValue : undefined,
    }));
  }
  if (Array.isArray(appParams)) return appParams;
  return [];
});

// Snapshot of original defaultParams + versions (tags) when the workflow is
// loaded, so we can detect edits made in browse mode.
const originalDefaultParams = ref({});
const originalTags = ref({});

const snapshotDefaultParams = () => {
  const snapshot = {};
  const tags = {};
  for (const node of nodes.value) {
    if (node.type !== "default") continue;
    snapshot[node.id] = { ...(node.data?.defaultParams || {}) };
    tags[node.id] = node.data?.tag || "";
  }
  originalDefaultParams.value = snapshot;
  originalTags.value = tags;
};

// Track whether any default-param or version change has been made in browse mode
const hasAnyChanges = computed(() => {
  for (const node of nodes.value) {
    if (node.type !== "default") continue;
    const current = JSON.stringify(node.data?.defaultParams || {});
    const original = JSON.stringify(originalDefaultParams.value[node.id] || {});
    if (current !== original) return true;
    if ((node.data?.tag || "") !== (originalTags.value[node.id] || "")) {
      return true;
    }
  }
  return false;
});

// Save all workflow changes via PATCH /definitions/{id}
const saveWorkflowChanges = async () => {
  const workflow = selectedWorkflow.value;
  if (!workflow?.uuid) return;

  const defaultParams = {};
  const versions = {};
  for (const node of nodes.value) {
    if (node.type !== "default") continue;
    const current = node.data?.defaultParams || {};
    const original = originalDefaultParams.value[node.id] || {};
    const params = {};
    for (const [k, v] of Object.entries(current)) {
      if (v != null && v !== "") params[k] = v;
    }
    // Include node if it has params OR if it originally had params (to clear them)
    if (Object.keys(params).length > 0 || Object.keys(original).length > 0) {
      defaultParams[node.id] = params;
    }
    // Only send a version when it changed to a non-empty value (the API rejects
    // empty version strings).
    const tag = node.data?.tag || "";
    if (tag && tag !== (originalTags.value[node.id] || "")) {
      versions[node.id] = tag;
    }
  }

  const payload = { defaultParams };
  if (Object.keys(versions).length > 0) payload.versions = versions;

  try {
    await store.dispatch("analysisModule/updateWorkflow", {
      uuid: workflow.uuid,
      payload,
    });
    EventBus.$emit("toast", {
      detail: { type: "success", msg: "Workflow changes saved." },
    });
    // Refresh definition to get updated resolvedParams
    const updated = await store.dispatch(
      "analysisModule/fetchWorkflowDefinition",
      workflow.uuid,
    );
    store.commit("analysisModule/SET_SELECTED_WORKFLOW", updated);
    const result = definitionToNodesAndEdges(
      updated,
      availableApplications.value,
    );
    nodes.value = result.needsAutoLayout ? result.nodes : placeSaved(result.nodes);
    edges.value = result.edges;
    snapshotDefaultParams();
    hydrateManifestPorts();
  } catch (err) {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to save workflow changes." },
    });
  }
};

// An app's name: its app.yml's, else its repository's (without its owner).
const appDisplayName = (app) => versionManifest(app)?.name || extractRepoName(app?.sourceUrl) || repoName(app);

/*
  The side panels (palette, inspector) can be folded to a rail; the choice
  is kept in this browser.
*/
const PANELS_KEY = "pennsieve.builder.panels";
const storedPanels = () => {
  try {
    return { palette: true, inspector: true, ...JSON.parse(localStorage.getItem(PANELS_KEY) || "{}") };
  } catch {
    return { palette: true, inspector: true };
  }
};
const panels = ref(storedPanels());
const togglePanel = (which) => {
  panels.value = { ...panels.value, [which]: !panels.value[which] };
  try {
    localStorage.setItem(PANELS_KEY, JSON.stringify(panels.value));
  } catch {
    // not kept
  }
};
// Selecting a step opens the inspector, if folded.
watch(selectedNode, (n) => {
  if (n && !panels.value.inspector) panels.value = { ...panels.value, inspector: true };
});

// The selected app step's manifest: its pinned version's.
const stepManifest = computed(() => {
  const node = selectedNode.value;
  if (node?.type !== "default") return null;
  return versionManifest(node.data?.application, node.data?.tag);
});
const manifestsKnown = computed(() =>
  (availableApplications.value || []).some((a) => (a.versions || []).some((v) => v.manifest)),
);
const ioTypes = (port) => ioLine({ inputs: [port], outputs: [] }).replace(/ → .*$/, "");
const showAdvanced = ref(false);

/*
  A step's app version: pinned (data.tag). Switching shows what changes,
  from the two versions' app.yml (manifestDiff), and warns about what the
  workflow would lose; a newer version is offered as an update.
*/
const newerVersion = computed(() => {
  const node = selectedNode.value;
  if (node?.type !== "default") return null;
  const latest = latestVersion(node.data?.application);
  return latest && node.data.tag && latest.version !== node.data.tag ? latest.version : null;
});
const updateLines = computed(() => {
  const node = selectedNode.value;
  if (!newerVersion.value) return [];
  return diffLines(
    manifestDiff(versionManifest(node.data.application, node.data.tag), versionManifest(node.data.application, newerVersion.value)),
  );
});

const applyVersion = (node, tag) => {
  node.data.tag = tag;
  const m = versionManifest(node.data.application, tag);
  if (m) {
    node.data.paramSchema = toParamSchema(m.parameters || []);
    node.data.manifestPorts = { inputs: m.inputs || [], outputs: m.outputs || [] };
    node.data.hasManifest = true;
  }
  revalidateEdges();
};

const requestVersion = async (tag) => {
  const node = selectedNode.value;
  if (!node || !tag || tag === node.data.tag) return;
  const app = node.data.application;
  const d = manifestDiff(versionManifest(app, node.data.tag), versionManifest(app, tag));
  const lines = diffLines(d);
  const warnings = versionWarnings(d, node.data.defaultParams || {});
  if (lines.length || warnings.length) {
    try {
      await ElMessageBox.confirm(
        h("div", { class: "version-change" }, [
          lines.length ? h("ul", lines.map((l) => h("li", l))) : null,
          ...warnings.map((w) => h("p", { class: "version-warning" }, `⚠ ${w}`)),
        ]),
        `Use version ${tag}?`,
        { confirmButtonText: `Use ${tag}`, cancelButtonText: "Keep current", type: warnings.length ? "warning" : "info" },
      );
    } catch {
      return;
    }
  }
  applyVersion(node, tag);
};

// app.yml as written, in a dialog.
const appYml = ref(null); // { title, text }
const viewAppYml = async (node) => {
  const app = node?.data?.application;
  if (!app?.uuid) return;
  appYml.value = { title: `${node.data.label}: app.yml`, text: "Loading…" };
  const parsed = await loadManifest(app.uuid);
  if (appYml.value) appYml.value.text = parsed?.raw || "This app has no app.yml.";
};

// Set (or, with undefined, clear) a step's override of a parameter.
const setDefaultParam = (paramName, value) => {
  const node = selectedNode.value;
  if (!node) return;
  const updated = { ...(node.data.defaultParams || {}) };
  if (value === undefined) delete updated[paramName];
  else updated[paramName] = value;
  node.data.defaultParams = updated;
};

// Remove a defaultParam override (reverts to app default)
const clearDefaultParam = (paramName) => {
  const node = selectedNode.value;
  if (!node?.data?.defaultParams) return;
  const updated = { ...node.data.defaultParams };
  delete updated[paramName];
  node.data.defaultParams = updated;
};

// Resolve dependency labels for the selected node
const selectedNodeDependencies = computed(() => {
  const proc = selectedNodeProcessor.value;
  if (!proc || !proc.dependsOn || proc.dependsOn.length === 0) return [];
  const wfNodes = selectedWorkflow.value?.dag || [];
  return proc.dependsOn.map((depId) => {
    const depNode = nodes.value.find((n) => n.id === depId);
    const depProc = wfNodes.find((p) => p.id === depId);
    return {
      id: depId,
      label: depNode?.data?.label || depProc?.sourceUrl || depId,
    };
  });
});

const filterOptions = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "inactive" },
  { label: "All", value: "all" },
];

/*
Global State
*/
const store = useStore();
const availableApplications = computed(
  () => store.getters["analysisModule/applications"] || [],
);
const targetTypes = computed(
  () => store.getters["analysisModule/targetTypes"] || [],
);
const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);

const getUserName = (userId) => {
  if (!userId) return "Unknown";
  if (
    profile.value &&
    (profile.value.id === userId || profile.value.intId === userId)
  ) {
    return (
      `${profile.value.firstName} ${profile.value.lastName}`.trim() || "You"
    );
  }
  const member = orgMembers.value.find(
    (m) => m.id === userId || m.intId === userId,
  );
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || "Unknown User";
  }
  return String(userId).includes(":")
    ? String(userId).split(":").pop()
    : String(userId);
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
  if (!targetType) return DEFAULT_COMPUTE_TYPES;
  const tt = targetTypes.value.find((t) => t.targetType === targetType);
  // TODO: use API-driven computeTypes once target types return them reliably
  // return tt?.runtimeConfig?.computeTypes || DEFAULT_COMPUTE_TYPES;
  const types = tt?.runtimeConfig?.computeTypes;
  return types && types.length ? withGpu(types) : DEFAULT_COMPUTE_TYPES;
};

const getComputeTypesForApplication = (application) => {
  const types = application?.runtimeConfig?.computeTypes;
  return types && types.length ? withGpu(types) : DEFAULT_COMPUTE_TYPES;
};

/*
  app.yml defaults
  ----------------
  An application dropped on the canvas comes from the applications *list*, which
  carries no `assets` — so the manifest has to be fetched per application. The
  node is created immediately on its existing defaults and patched in place when
  the manifest arrives; the user is never blocked on the request.

  Only fields the user has not already set are touched, and only compute types
  the builder actually offers are applied.
*/
const { loadManifest } = useAppManifest();

const applyManifestDefaults = async (nodeId, application) => {
  const uuid = application?.uuid;
  if (!uuid) return;

  const parsed = await loadManifest(uuid);
  if (!parsed) return;

  // The node may have been deleted while the request was in flight.
  const node = nodes.value.find((n) => n.id === nodeId);
  if (!node) return;

  const { schema } = parsed;

  // computeType — first declared type that the builder actually supports.
  const declared = schema.runtime?.computeTypes || [];
  const supported = declared.find((t) => DEFAULT_COMPUTE_TYPES.includes(t));
  if (supported) node.data.computeType = supported;

  // cpu / memory — only when the manifest declares them and the node has none.
  if (!node.data.cpu && schema.resources?.cpu != null) {
    node.data.cpu = String(schema.resources.cpu);
  }
  if (!node.data.memory && schema.resources?.memory != null) {
    node.data.memory = String(schema.resources.memory);
  }

  // Parameters — feeds both the parameter list and its editable defaults.
  const paramSchema = toParamSchema(schema.parameters);
  if (paramSchema.length) node.data.paramSchema = paramSchema;

  setManifestPorts(node, parsed);
};

// Ports live on the node so connection checks stay synchronous.
const setManifestPorts = (node, parsed) => {
  node.data.manifestPorts = {
    inputs: parsed.schema.inputs || [],
    outputs: parsed.schema.outputs || [],
  };
  node.data.hasManifest = true;
  // Ports from a draft app.yml (saved in this browser, not released).
  node.data.draftManifest = parsed.draft || null;
  // A reopened workflow's links into data targets leave from the output
  // ports their prefixes name, once the ports are known.
  edges.value = attachPorts(edges.value, nodes.value);
  // A manifest can land after the user has already drawn the edge — the
  // connection was made against no port information at all, so re-check
  // everything now that we have some.
  revalidateEdges();
};

/*
  Ports for nodes that were not dropped in this session
  -----------------------------------------------------
  definitionToNodesAndEdges builds its nodes from a saved definition, which
  carries no manifest — so an opened workflow had nothing to validate against
  until every node was re-dropped by hand. Manifests are memoized per uuid, so
  this costs at most one request per distinct application, once.
*/
const hydrateManifestPorts = async () => {
  const pending = nodes.value.filter(
    (n) => isAppNode(n) && n.data?.application?.uuid && !n.data.manifestPorts,
  );
  if (!pending.length) return;

  await Promise.all(
    pending.map(async (n) => {
      const parsed = await loadManifest(n.data.application.uuid);
      // The node may have been removed while the request was in flight.
      const node = nodes.value.find((x) => x.id === n.id);
      if (node && parsed) setManifestPorts(node, parsed);
    }),
  );

  revalidateEdges();
};

const getTargetTypeParams = (targetType) => {
  if (!targetType) return [];
  const tt = targetTypes.value.find((t) => t.targetType === targetType);
  return tt?.params || [];
};

const getTargetTypeLabel = (targetType) =>
  targetType ? targetTypeName(targetType, targetTypes.value) : "No target selected";

const onTargetTypeChange = (data) => {
  const types = getComputeTypesForTarget(data.targetType);
  data.computeType = types.length ? types[0] : null;
};

const toggleTargetEdit = (nodeId) => {
  if (editingTargetNodes.has(nodeId)) {
    editingTargetNodes.delete(nodeId);
  } else {
    editingTargetNodes.add(nodeId);
  }
};

/*
Filtered Workflow List
*/

/*
Mode Management
*/
const isReadOnly = computed(() => mode.value === "browse");

const enterCreateMode = () => {
  mode.value = "create";
  selectedWorkflow.value = null;
  selectedNode.value = null;
  isEditingDetails.value = false;
  clearWorkflow();
  seedCanvas();
  history.reset();
  accordionActiveNames.value = ["information"];
  store.commit("analysisModule/SET_SELECTED_WORKFLOW", {});
};

const cancelCreate = () => {
  mode.value = "browse";
  selectedWorkflow.value = null;
  selectedNode.value = null;
  clearWorkflow();
  accordionActiveNames.value = ["workflows"];
  store.commit("analysisModule/SET_SELECTED_WORKFLOW", {});
};

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

const findAppByUrl = (applications, sourceUrl) => {
  if (!sourceUrl) return null;
  const normalized = normalizeUrl(sourceUrl);
  return (
    applications.find((app) => normalizeUrl(app.sourceUrl) === normalized) ||
    null
  );
};

const parseGitHubDisplay = (sourceUrl) => {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/\s.]+)/);
  if (!match) return null;
  return `${match[1]}/${match[2].replace(/\.git$/, "")}`;
};

const visibilityLabel = (app) => {
  if (typeof app?.isPrivate !== "boolean") return null;
  return app.isPrivate ? "Private" : "Public";
};

const repoName = (app) =>
  parseGitHubDisplay(app?.sourceUrl) ||
  extractRepoName(app?.sourceUrl) ||
  "Unnamed";

const latestVersion = (app) => {
  const versions = app?.versions || [];
  if (versions.length === 0) return null;
  return [...versions].sort(
    (a, b) =>
      (new Date(b.createdAt).getTime() || 0) -
      (new Date(a.createdAt).getTime() || 0),
  )[0];
};

/*
  Sidebar application search
  --------------------------
  The palette is a flat list of every application in the org, which gets long
  enough to scroll past what you are looking for. Matching is done over the
  text the row actually shows plus the source URL, so typing either the repo
  name or the org narrows it.
*/
const applicationSearch = ref("");

const filteredApplications = computed(() => {
  const query = applicationSearch.value.trim().toLowerCase();
  if (!query) return availableApplications.value;
  return availableApplications.value.filter((app) =>
    [repoName(app), app?.name, app?.description, app?.sourceUrl]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
});

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

const nodeTypeColor = (type) => {
  if (type === "data-source") return "#6366f1";
  if (type === "data-target") return "#64748b";
  return "#cccccc";
};

const definitionToNodesAndEdges = (workflow, applications) => {
  const raw = workflow.dag || [];
  if (raw.length === 0) return { nodes: [], edges: [], needsAutoLayout: false };

  // Normalize IDs
  const idMap = {};
  raw.forEach((p, idx) => {
    idMap[p.id || `_old_${idx}`] = p.id || `proc_${idx}`;
  });
  const processors = raw.map((p, idx) => ({
    ...p,
    id: p.id || `proc_${idx}`,
    dependsOn: (p.dependsOn || [])
      .filter(Boolean)
      .map((dep) => idMap[dep] || dep),
  }));

  // Check if any node has a saved position
  const hasSavedPositions = processors.some(
    (p) => p.position && typeof p.position.x === "number",
  );

  // Build VueFlow nodes
  const resultNodes = processors.map((p) => {
    let label = p.type;
    let nodeType = "default";

    if (p.type === "data-source") {
      label = "Data Source";
      nodeType = "data-source";
    } else if (p.type === "data-target") {
      label = "Data Target";
      nodeType = "data-target";
    } else {
      const matchedApp = findAppByUrl(applications, p.sourceUrl);
      label = matchedApp ? repoName(matchedApp) : extractRepoName(p.sourceUrl);
    }

    const matchedApplication =
      p.type !== "data-source" && p.type !== "data-target"
        ? findAppByUrl(applications, p.sourceUrl) || {}
        : {};

    return {
      id: p.id,
      type: nodeType,
      data: {
        label,
        targetType: p.targetType || null,
        computeType:
          p.computeType ||
          (nodeType === "default"
            ? matchedApplication?.runtimeConfig?.computeTypes?.[0] || "standard"
            : getComputeTypesForTarget(p.targetType)?.[0] || null),
        cpu:
          (p.runtimeConfig?.cpu ? String(p.runtimeConfig.cpu) : "") ||
          (p.cpu ? String(p.cpu) : "") ||
          (matchedApplication?.runtimeConfig?.cpu ? String(matchedApplication.runtimeConfig.cpu) : ""),
        memory:
          (p.runtimeConfig?.memory ? String(p.runtimeConfig.memory) : "") ||
          (p.memory ? String(p.memory) : "") ||
          (matchedApplication?.runtimeConfig?.memory ? String(matchedApplication.runtimeConfig.memory) : ""),
        application: matchedApplication,
        ...(p.runtimeConfig?.interactive && { interactive: true, sessionType: p.runtimeConfig.sessionType || "" }),
        defaultParams: p.defaultParams || {},
        paramSchema: p.paramSchema || [],
        resolvedParams: p.resolvedParams || {},
        tag: p.tag || latestVersion(matchedApplication)?.version || "",
      },
      position:
        hasSavedPositions && p.position
          ? { x: p.position.x, y: p.position.y }
          : { x: 0, y: 0 },
    };
  });

  // Build edges from dependsOn
  const procMap = Object.fromEntries(processors.map((p) => [p.id, p]));
  const resultEdges = [];
  for (const p of processors) {
    for (const dep of p.dependsOn || []) {
      const srcNode = procMap[dep];
      resultEdges.push({
        id: `e${dep}-${p.id}`,
        source: dep,
        target: p.id,
        // Named, so a step with output ports draws it from its main point;
        // attachPorts moves it to a port once the manifest is in.
        sourceHandle: "source",
        targetHandle: "target",
        animated: false,
        style: { stroke: nodeTypeColor(srcNode?.type) },
      });
    }
  }

  return {
    nodes: resultNodes,
    edges: resultEdges,
    needsAutoLayout: !hasSavedPositions,
  };
};

const startEditDetails = () => {
  if (!selectedWorkflow.value) return;
  editName.value = selectedWorkflow.value.name || "";
  editDescription.value = selectedWorkflow.value.description || "";
  isEditingDetails.value = true;
};

const cancelEditDetails = () => {
  isEditingDetails.value = false;
};

const saveDetails = async () => {
  if (!selectedWorkflow.value || !editName.value.trim()) return;
  isSavingDetails.value = true;
  try {
    await store.dispatch("analysisModule/updateWorkflow", {
      uuid: selectedWorkflow.value.uuid,
      payload: {
        name: editName.value,
        description: editDescription.value,
      },
    });
    selectedWorkflow.value = {
      ...selectedWorkflow.value,
      name: editName.value,
      description: editDescription.value,
    };
    isEditingDetails.value = false;
    EventBus.$emit("toast", {
      detail: { type: "success", msg: "Workflow updated." },
    });
  } catch {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to update workflow." },
    });
  } finally {
    isSavingDetails.value = false;
  }
};

const toggleArchive = async () => {
  if (!selectedWorkflow.value) return;
  const newStatus = !selectedWorkflow.value.isActive;
  try {
    await store.dispatch("analysisModule/updateWorkflow", {
      uuid: selectedWorkflow.value.uuid,
      payload: { isActive: newStatus },
    });
    selectedWorkflow.value = { ...selectedWorkflow.value, isActive: newStatus };
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: newStatus ? "Workflow activated." : "Workflow archived.",
      },
    });
  } catch {
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to update workflow status." },
    });
  }
};

/*
Visibility (public / private)
*/
const isSuperAdmin = computed(() => store.getters.isSuperAdmin === true);

const isWorkflowCreator = computed(() => {
  const wf = selectedWorkflow.value;
  if (!wf || !profile.value) return false;
  return (
    profile.value.id === wf.createdBy || profile.value.intId === wf.createdBy
  );
});

// Steps' settings are editable while building (create) or editing (edit).
const canEditConfig = computed(() => mode.value !== "browse");

const isPublicWorkflow = computed(
  () => selectedWorkflow.value?.visibility === "public",
);

// Only the creator may publish. The creator or a super-admin (moderation) may
// unpublish — mirrors the workflow-service authorization rules.
const canPublish = computed(
  () => !isPublicWorkflow.value && isWorkflowCreator.value,
);
const canUnpublish = computed(
  () => isPublicWorkflow.value && (isWorkflowCreator.value || isSuperAdmin.value),
);

const togglePublish = async () => {
  if (!selectedWorkflow.value) return;
  const wf = selectedWorkflow.value;
  const goingPublic = !isPublicWorkflow.value;

  try {
    await ElMessageBox.confirm(
      goingPublic
        ? `Publishing "${wf.name}" makes it discoverable and runnable by anyone across all organizations. Every processor must itself be a public application.`
        : `Unpublishing "${wf.name}" reverts it to private. It will no longer be discoverable by other users and any "Official" badge will be removed.`,
      goingPublic ? "Publish workflow" : "Unpublish workflow",
      {
        confirmButtonText: goingPublic ? "Publish" : "Unpublish",
        cancelButtonText: "Cancel",
        type: "warning",
      },
    );
  } catch {
    return; // user cancelled
  }

  try {
    const action = goingPublic ? "publishWorkflow" : "unpublishWorkflow";
    const updated = await store.dispatch(`analysisModule/${action}`, {
      uuid: wf.uuid,
    });
    selectedWorkflow.value = {
      ...wf,
      visibility: updated?.visibility ?? (goingPublic ? "public" : ""),
      official: updated?.official ?? false,
    };
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: goingPublic ? "Workflow published." : "Workflow unpublished.",
      },
    });
  } catch (err) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: err?.message || "Failed to update workflow visibility.",
      },
    });
  }
};

const selectWorkflow = (workflow) => {
  mode.value = "browse";
  viewingVersion.value = null;
  if (workflow?.uuid && workflow.uuid !== selectedWorkflow.value?.uuid) loadVersions(workflow.uuid);
  selectedWorkflow.value = workflow;
  selectedNode.value = null;
  isEditingDetails.value = false;
  accordionActiveNames.value = ["information", "workflow-metrics"];
  workflowName.value = workflow.name || "";
  workflowDescription.value = workflow.description || "";
  store.commit("analysisModule/SET_SELECTED_WORKFLOW", workflow);

  const result = definitionToNodesAndEdges(
    workflow,
    availableApplications.value,
  );
  nodes.value = result.needsAutoLayout ? result.nodes : placeSaved(result.nodes);
  edges.value = result.edges;
  snapshotDefaultParams();
  // Fire-and-forget: the manifests patch the nodes and re-run the check.
  hydrateManifestPorts();

  if (result.needsAutoLayout) {
    autoLayout();
  } else {
    setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50);
  }
  history.reset();
};

/*
Helpers
*/

const generateNodeId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

const dragOffset = ref({ x: 0, y: 0 });

const onDragStart = (item, event, type = "application") => {
  if (isReadOnly.value) return;
  draggedType.value = type;
  draggedApp.value = type === "application" ? item : null;

  // Capture where within the element the user clicked
  const rect = event.target.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    // Firefox refuses to start a drag unless setData is called inside
    // dragstart. The payload is unused — drop logic reads from refs.
    event.dataTransfer.setData("text/plain", type);
  }
};

const onDrop = (event) => {
  event.preventDefault();
  if (isReadOnly.value) return;

  if (!draggedType.value) return;

  // Convert drop position to flow coordinates, applying the grab offset
  const flowPos = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  });
  const position = {
    x: flowPos.x - dragOffset.value.x,
    y: flowPos.y - dragOffset.value.y,
  };

  const type = draggedType.value === "application" ? "default" : draggedType.value;
  if (type !== "default" || draggedApp.value) addNode(type, draggedApp.value, position);

  draggedApp.value = null;
  draggedType.value = null;
};

/*
  Adding steps
  ------------
  A node of a type ("data-source", "data-target", or "default" for an app),
  at a position. Dragging places it where it's dropped; clicking a palette
  item or a step's + places it below a step, connects it and tidies the
  layout (addStep).
*/
// An app step's domain colour (its pinned version's app.yml tags), for its
// strip on the canvas; none for an app without a domain, which keeps the
// processor's own.
const stepAccent = (data) => (data?.application ? appColors(data.application, data.tag)?.accent || "" : "");

const makeNode = (type, app, position) => {
  const id = generateNodeId();
  if (type === "data-source") {
    return { id, type, data: { label: "Input data" }, position };
  }
  if (type === "data-target") {
    const only = targetTypes.value.length === 1 ? targetTypes.value[0] : null;
    return {
      id,
      type,
      data: {
        label: "Output",
        targetType: only ? only.targetType : null,
        computeType: only?.runtimeConfig?.computeTypes?.[0] || null,
      },
      position,
    };
  }
  return {
    id,
    type: "default",
    data: {
      label: appDisplayName(app),
      application: app,
      // A notebook kernel: a human-in-the-loop step, run as a live session.
      ...(sessionTypeOf(app) && { interactive: true, sessionType: sessionTypeOf(app) }),
      computeType: "standard",
      cpu: "",
      memory: "",
      defaultParams: {},
      paramSchema: [],
      hasManifest: false,
      tag: latestVersion(app)?.version || "",
    },
    position,
  };
};

const addNode = (type, app, position) => {
  const node = makeNode(type, app, position);
  nodes.value.push(node);
  // Fire-and-forget: patches the node in place once app.yml is read.
  if (app) applyManifestDefaults(node.id, app);
  return node;
};

// Connects two steps, with the same checks and feedback as dragging a
// connection between them.
const connectNodes = (sourceId, targetId, sourceHandle) => {
  const src = nodes.value.find((n) => n.id === sourceId);
  const tgt = nodes.value.find((n) => n.id === targetId);
  if (!canConnect(src, tgt, edges.value)) return false;
  const port = portOfHandle(sourceHandle);
  if (port) {
    // An output port routes one output to one data target.
    if (!canConnectFromHandle(src, tgt, sourceHandle)) {
      ElMessage({ type: "info", showClose: true, message: `The ${port} output connects to a data target. Connect apps from the step's main connection point.` });
      return false;
    }
    if (edges.value.some((e) => e.target === targetId)) {
      ElMessage({ type: "info", showClose: true, message: "A data target fed by an output takes that one link. Remove its other link first." });
      return false;
    }
    if (!prefixParamOf(getTargetTypeParams(tgt.data.targetType))) {
      ElMessage({ type: "info", showClose: true, message: "This kind of data target takes a step's whole output, not one output. Connect it from the step's main connection point." });
      return false;
    }
  }
  edges.value.push({
    id: `e${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle: port ? sourceHandle : "source",
    targetHandle: "target",
    animated: false,
    style: { stroke: nodeTypeColor(src.type) },
  });
  // The target takes only this output's folder: OUTPUT_DIR/<port>/.
  if (port) tgt.data.defaultParams = withPortPrefix(tgt.data.defaultParams, port, prefixParamOf(getTargetTypeParams(tgt.data.targetType)));
  reportConnectionCheck(src, tgt);
  revalidateEdges();
  return true;
};

const selectOnly = (id) => {
  nodes.value.forEach((n) => (n.selected = n.id === id));
  edges.value.forEach((e) => (e.selected = false));
  selectedNode.value = nodes.value.find((n) => n.id === id) || null;
};

// Adds a step after another (the selected one when not given), or below the
// whole graph, connects it when the types allow, selects it and lays the
// graph out.
const addStep = (type, app, afterId = selectedNode.value?.id) => {
  if (isReadOnly.value) return null;
  const after = nodes.value.find((n) => n.id === afterId) ||
    [...nodes.value].filter((n) => n.type !== "data-target").sort((a, b) => b.position.y - a.position.y)[0];
  const gap = layoutBox(detailed.value, DETAILED_BOX);
  const position = after
    ? { x: after.position.x, y: after.position.y + gap.height + gap.ranksep }
    : { x: 0, y: 0 };
  const node = addNode(type, app, position);
  if (after) connectNodes(after.id, node.id);
  selectOnly(node.id);
  nextTick(() => autoLayout());
  return node;
};

/*
  Connecting: while a connection is dragged from a step, steps whose inputs
  accept its outputs (as their app.yml files declare) are highlighted, ones
  that don't are dimmed, and ones that can't take it at all (an input, the
  step itself) are faded. Unknown (no declared types) stays as is.
*/
const connectingFrom = ref(null);
onConnectStart(({ nodeId, handleType }) => {
  if (handleType === "source") connectingFrom.value = nodeId;
});
onConnectEnd(() => {
  connectingFrom.value = null;
});
const connectClass = (id) => {
  const fromId = connectingFrom.value;
  if (!fromId || fromId === id) return "";
  const src = nodes.value.find((n) => n.id === fromId);
  const tgt = nodes.value.find((n) => n.id === id);
  if (!canConnect(src, tgt, edges.value)) return "connect-no";
  if (src.type !== "default" || tgt.type !== "default") return "";
  const verdict = fitsAfter(src.data?.manifestPorts, tgt.data?.manifestPorts);
  return verdict === "fits" ? "connect-fits" : verdict === "no" ? "connect-mismatch" : "";
};
const stepWarning = (id) => {
  const node = nodes.value.find((n) => n.id === id);
  const unset = node?.type === "default" ? requiredUnset(node) : [];
  return unset.length ? `No value for ${unset.map((p) => `"${p}"`).join(", ")} (can be given when running)` : "";
};
const portTypes = (port) => (port.mediaTypes || []).map(shortMediaType).join(", ");

// The + under a step: pick what comes next.
const pickerFor = ref(null); // the step the picker adds after
const openStepPicker = (nodeId) => {
  if (isReadOnly.value) return;
  pickerFor.value = nodeId;
};
const onStepPicked = ({ type, app }) => {
  const after = pickerFor.value;
  pickerFor.value = null;
  addStep(type, app, after);
};
const pickerTitle = computed(() => {
  const n = nodes.value.find((x) => x.id === pickerFor.value);
  return n ? `Add a step after ${n.data?.label || "this step"}` : "Add a step";
});

// A new workflow starts with its input, and a + below it.
const seedCanvas = () => {
  if (nodes.value.length) return;
  addNode("data-source", null, { x: 0, y: 0 });
  nextTick(() => setTimeout(() => fitView({ padding: 0.8, maxZoom: 1 }), 50));
};

const onDragOver = (event) => {
  if (isReadOnly.value) return;
  event.preventDefault();
};

// Handle edge connections from user dragging between node handles
onConnect((params) => {
  if (isReadOnly.value) return;

  // Self-loops, duplicates, into an input or out of an output are refused;
  // the rest get a toast and the persistent marks (connectNodes).
  connectNodes(params.source, params.target, params.sourceHandle);
});

/*
  Connection validation
  ---------------------
  Every edge between two application nodes is classified from the ports the
  two app.yml manifests declare. The connection is always made — per the
  ticket a mismatch is a warning the user can proceed past, not a block — but
  the verdict is *persistent*: the edge is restyled and the canvas keeps a
  running list, so the check is still visible after the toast has gone and
  after the workflow is reopened.

  A missing manifest is reported as "not checked" rather than silently passing.
  Staying quiet there was the main reason the validation looked absent: an app
  without app.yml produced exactly the same canvas as a clean bill of health.
*/
const INVALID_EDGE_COLOR = "#e94b4b";
const VALID_EDGE_COLOR = "#17bb62";

// Edges the manifests say are wrong, edges the manifests say are right, and
// edges we had no manifest to judge. A confirmed-good edge is worth showing:
// otherwise a clean workflow and an unvalidated one look identical.
const edgeIssues = ref([]);
const validEdgeCount = ref(0);
const uncheckedEdgeCount = ref(0);

const isAppNode = (node) => node?.type === "default";

// The app steps with a manifest that feed a step: what its inputs can be
// judged against.
const upstreamApps = (targetId) =>
  edges.value
    .filter((e) => e.target === targetId)
    .map((e) => nodes.value.find((n) => n.id === e.source))
    .filter((n) => isAppNode(n) && n.data?.manifestPorts);

const classifyEdge = (edge) => {
  const src = nodes.value.find((n) => n.id === edge.source);
  const tgt = nodes.value.find((n) => n.id === edge.target);
  if (!src || !tgt) return { state: "skip", src, tgt };

  // Only application-to-application links carry port information; a data
  // source or target has no manifest to compare against.
  if (!isAppNode(src) || !isAppNode(tgt)) return { state: "skip", src, tgt };

  const source = src.data?.manifestPorts;
  const target = tgt.data?.manifestPorts;
  if (!source || !target) return { state: "unchecked", src, tgt };

  const { compatible, checked, reason, unmetInputs, metInputs } =
    validateAppConnection(source, target);
  // Manifests present but nothing comparable on the ports — no media types
  // declared on one side. Reported as unchecked, not as a match.
  if (!checked) return { state: "unchecked", src, tgt };
  // With more than one upstream step, a required input may come from
  // another one: the link is fine as long as it feeds something, and the
  // step's own check (stepInputIssues) says what's still missing.
  if (reason === "unmet-required" && upstreamApps(tgt.id).length > 1) {
    return metInputs.length
      ? { state: "ok", src, tgt, metInputs }
      : { state: "invalid", src, tgt, reason: "no-overlap", unmetInputs };
  }
  return compatible
    ? { state: "ok", src, tgt, metInputs }
    : { state: "invalid", src, tgt, reason, unmetInputs };
};

// Required inputs no upstream step provides, for steps fed by more than one
// app (with one, the link itself says so).
const stepInputIssues = () =>
  nodes.value
    .filter((n) => isAppNode(n) && n.data?.manifestPorts && upstreamApps(n.id).length > 1)
    .map((n) => {
      const { checked, unmetRequired } = validateStepInputs(
        upstreamApps(n.id).map((u) => u.data.manifestPorts),
        n.data.manifestPorts,
      );
      return checked && unmetRequired.length
        ? {
            id: `step:${n.id}`,
            targetId: n.id,
            target: n.data.label,
            reason: "missing-required",
            mediaTypes: portMediaTypes(unmetRequired),
          }
        : null;
    })
    .filter(Boolean);

/*
  Media types are what the check compares, so they are also what it reports.
  A port's `name` is the manifest author's local label — two applications that
  interoperate perfectly rarely agree on one — so naming names made a
  media-type verdict read like a name match. Deduped and order-preserving: a
  target with three inputs that all accept NIfTI should say NIfTI once.
*/
const portMediaTypes = (ports) => {
  const seen = [];
  (ports || []).forEach((port) => {
    const types = (port?.mediaTypes || []).length
      ? port.mediaTypes
      : [port?.dataType || "any"];
    types.forEach((t) => {
      if (t && !seen.includes(t)) seen.push(t);
    });
  });
  return seen;
};

/*
  Re-derive every edge's appearance from the current nodes. Cheap (a handful of
  edges, ports already in memory) and idempotent, so it can be called from
  anywhere the graph changes rather than trying to patch single edges.
*/
const revalidateEdges = () => {
  const issues = [];
  let unchecked = 0;
  let validated = 0;

  edges.value = edges.value.map((edge) => {
    const result = classifyEdge(edge);
    const stroke = nodeTypeColor(result.src?.type);
    // Spread the existing edge so anything VueFlow put on it (handles,
    // selection) survives; the label fields are always restated so a
    // connection that stops being invalid loses its marker.
    const next = {
      ...edge,
      style: { stroke },
      label: undefined,
      labelShowBg: undefined,
      labelBgStyle: undefined,
      labelStyle: undefined,
    };

    if (result.state === "invalid") {
      const mediaTypes = portMediaTypes(result.unmetInputs);
      issues.push({
        id: edge.id,
        targetId: edge.target,
        source: result.src.data.label,
        target: result.tgt.data.label,
        reason: result.reason,
        mediaTypes,
      });
      return {
        ...next,
        style: {
          stroke: INVALID_EDGE_COLOR,
          strokeWidth: 2,
          strokeDasharray: "6 4",
        },
        label:
          result.reason === "no-overlap"
            ? "\u26A0 media type mismatch"
            : mediaTypes.length
              ? `\u26A0 needs ${mediaTypes.join(", ")}`
              : "\u26A0 incompatible",
        labelShowBg: true,
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 2,
        labelBgStyle: { fill: "#fdecec", stroke: INVALID_EDGE_COLOR },
        labelStyle: { fill: INVALID_EDGE_COLOR, fontSize: 11, fontWeight: 600 },
      };
    }

    if (result.state === "unchecked") {
      unchecked += 1;
      return { ...next, style: { stroke, strokeDasharray: "2 4" } };
    }

    if (result.state === "ok") {
      validated += 1;
      const mediaTypes = portMediaTypes(result.metInputs);
      return {
        ...next,
        style: { stroke: VALID_EDGE_COLOR, strokeWidth: 2 },
        label: mediaTypes.length ? `\u2713 ${mediaTypes.join(", ")}` : "\u2713",
        labelShowBg: true,
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 2,
        labelBgStyle: { fill: "#eaf9ef", stroke: VALID_EDGE_COLOR },
        labelStyle: { fill: "#0f7a3f", fontSize: 11, fontWeight: 600 },
      };
    }

    return next;
  });

  edgeIssues.value = [...issues, ...stepInputIssues()];
  validEdgeCount.value = validated;
  uncheckedEdgeCount.value = unchecked;
};

const reportConnectionCheck = (srcNode, tgtNode) => {
  const source = srcNode?.data?.manifestPorts;
  const target = tgtNode?.data?.manifestPorts;
  if (!source || !target) return;

  const { compatible, checked, reason, unmetInputs, metInputs } =
    validateAppConnection(source, target);
  // Nothing to compare — no ports, or no media types on them. Silence beats
  // "media types match", which would be a lie, and the edge is already drawn
  // dashed and counted as unchecked on the canvas.
  if (!checked) return;

  // A match shows on the edge itself; only a mismatch is worth a toast.
  if (compatible) return;

  // Fed by other steps too: this link only has to feed something. What the
  // step as a whole still lacks shows in the readiness list.
  const others = upstreamApps(tgtNode.id).filter((n) => n.id !== srcNode.id);
  if (reason === "unmet-required" && others.length && metInputs.length) return;

  const mediaTypes = portMediaTypes(unmetInputs).join(", ");
  const detail =
    reason === "no-overlap"
      ? `${srcNode.data.label} produces no output whose media type matches an ` +
        `input on ${tgtNode.data.label}` +
        `${mediaTypes ? ` (accepts ${mediaTypes})` : ""}.`
      : `${tgtNode.data.label} requires ` +
        `${mediaTypes || "media types"} on input, which ` +
        `${srcNode.data.label} does not produce.`;

  ElMessage({
    type: "warning",
    duration: 6000,
    showClose: true,
    message: `${detail} The connection was made — check it before running.`,
  });
};

// The output port feeding a node, or "" when none does.
const feedingPort = (nodeId) => portOfHandle(edges.value.find((e) => e.target === nodeId && e.sourceHandle)?.sourceHandle);

// Removes the edges that match, and the path prefix an output port's link
// set on its data target.
const dropEdges = (matches) => {
  edges.value.filter(matches).forEach((e) => {
    const port = portOfHandle(e.sourceHandle);
    const tgt = port && nodes.value.find((n) => n.id === e.target);
    if (tgt) tgt.data.defaultParams = withoutPortPrefix(tgt.data.defaultParams, port);
  });
  edges.value = edges.value.filter((e) => !matches(e));
};

const removeNode = (nodeId) => {
  const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return;

  // Remove associated edges
  dropEdges((edge) => edge.source === nodeId || edge.target === nodeId);

  // Remove node
  nodes.value.splice(nodeIndex, 1);
  revalidateEdges();
};

const clearWorkflow = () => {
  nodes.value = [];
  edges.value = [];
  edgeIssues.value = [];
  validEdgeCount.value = 0;
  uncheckedEdgeCount.value = 0;
  workflowName.value = "";
  workflowDescription.value = "";
};

const NODE_WIDTH = 280;
const NODE_HEIGHT = 100;

// Compact (one line) or detailed nodes: the viewer's choice, shared with the
// run page. Laid out with the box of the current choice. Saved positions are
// always for detailed nodes, so a definition looks the same in either.
const { detailed, setDetailed } = useGraphDensity();
const DETAILED_BOX = { width: NODE_WIDTH, height: NODE_HEIGHT, nodesep: 120, ranksep: 150 };
const placeSaved = (laidOut) => (detailed.value ? laidOut : recenter(laidOut, DETAILED_BOX, COMPACT_BOX));
const positionToSave = (node) =>
  detailed.value ? node.position : recenter([node], COMPACT_BOX, DETAILED_BOX)[0].position;

// Switching keeps the arrangement (each node keeps its centre); growing to
// detailed lays the graph out again only if the bigger cards would overlap.
const changeDensity = (value) => {
  if (value === detailed.value) return;
  const from = layoutBox(detailed.value, DETAILED_BOX);
  const to = layoutBox(value, DETAILED_BOX);
  setDetailed(value);
  nodes.value = recenter(nodes.value, from, to);
  if (value && overlaps(nodes.value, to)) autoLayout();
  else setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50);
};

const autoLayout = () => {
  if (nodes.value.length === 0) return;
  const box = layoutBox(detailed.value, DETAILED_BOX);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: box.nodesep, ranksep: box.ranksep });

  for (const node of nodes.value) {
    g.setNode(node.id, { width: box.width, height: box.height });
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
        x: pos.x - box.width / 2,
        y: pos.y - box.height / 2,
      },
    };
  });

  // Fit the view after layout settles
  setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50);
};

/*
Readiness: what blocks saving, and what to check (builderReadiness.js).
*/
const readiness = computed(() =>
  builderReadiness({
    name: workflowName.value,
    nodes: nodes.value,
    edges: edges.value,
    edgeIssues: edgeIssues.value,
  }),
);
const saving = ref(false);

// A readiness item was clicked: show its step.
const onReadinessSelect = (item) => {
  if (!item.nodeId) return;
  openNodeSettings(item.nodeId);
  setTimeout(() => fitView({ nodes: [item.nodeId], padding: 0.6, maxZoom: 1.2, duration: 300 }), 50);
};

const startOver = async () => {
  if (nodes.value.length || workflowName.value) {
    try {
      await ElMessageBox.confirm(
        "This clears the canvas, the name and the description.",
        "Start over?",
        { confirmButtonText: "Start over", cancelButtonText: "Cancel", type: "warning" },
      );
    } catch {
      return;
    }
  }
  clearWorkflow();
  clearDraft();
  selectedNode.value = null;
  seedCanvas();
};

/*
  Undo and redo (graphHistory.js): snapshots of the graph as it settles, so
  every edit, adding, removing, connecting, moving or changing a step's
  settings, can be undone.
*/
const history = useGraphHistory({
  nodes,
  edges,
  enabled: () => !isReadOnly.value,
  onRestore: () => {
    selectedNode.value = null;
    revalidateEdges();
  },
});

/*
  Keyboard: Delete/Backspace removes the selection, Cmd/Ctrl-Z undoes and
  Shift-Cmd/Ctrl-Z (or Ctrl-Y) redoes, arrows move between steps, Esc
  deselects. Not while typing.
*/
const deleteSelection = () => {
  const selectedEdges = edges.value.filter((e) => e.selected).map((e) => e.id);
  const selectedNodes = nodes.value.filter((n) => n.selected).map((n) => n.id);
  if (selectedEdges.length) {
    dropEdges((e) => selectedEdges.includes(e.id));
    revalidateEdges();
  }
  selectedNodes.forEach((id) => removeNode(id));
  if (selectedNodes.length) selectedNode.value = null;
};

const onKeydown = (event) => {
  if (isReadOnly.value) return;
  const t = event.target;
  if (t?.closest?.("input, textarea, select, [contenteditable='true'], .el-select, .el-dialog, .el-popper")) return;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  if (mod && key === "z") {
    event.preventDefault();
    if (event.shiftKey) history.redo();
    else history.undo();
    return;
  }
  if (mod && key === "y") {
    event.preventDefault();
    history.redo();
    return;
  }
  if (mod) return;
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelection();
  } else if (event.key === "Escape") {
    nodes.value.forEach((n) => (n.selected = false));
    edges.value.forEach((e) => (e.selected = false));
    selectedNode.value = null;
    pickerFor.value = null;
  } else if (event.key.startsWith("Arrow")) {
    const from = selectedNode.value?.id;
    const next = from
      ? neighbourInDirection(nodes.value, edges.value, from, event.key.slice(5).toLowerCase())
      : nodes.value[0]?.id;
    if (next) {
      event.preventDefault();
      selectOnly(next);
    }
  }
};
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

const saveWorkflow = async () => {
  if (!workflowName.value.trim()) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Please provide a workflow name.",
      },
    });
    return;
  }

  if (nodes.value.length === 0) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Please add at least one application to the workflow.",
      },
    });
    return;
  }

  const targetWithoutType = nodes.value.find(
    (n) => n.type === "data-target" && !n.data.targetType,
  );
  if (targetWithoutType) {
    // Select the node so the user can see which one needs a target type
    nodes.value.forEach((n) => (n.selected = false));
    const target = nodes.value.find((n) => n.id === targetWithoutType.id);
    if (target) target.selected = true;
    selectedNode.value = targetWithoutType;
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Please select a target type for all data target nodes before saving.",
      },
    });
    return;
  }

  const processors = serializeProcessors();

  const workflowData = {
    name: workflowName.value,
    description: workflowDescription.value,
    processors: processors,
  };

  saving.value = true;
  try {
    const created = await store.dispatch("analysisModule/createWorkflow", workflowData);
    EventBus.$emit("toast", {
      detail: { type: "success", msg: `Saved ${workflowData.name}.`, duration: 5000 },
    });
    clearDraft();
    clearWorkflow();
    // The workflow is created; a failed refresh of the list isn't a failed create
    store.dispatch("analysisModule/fetchWorkflows").catch((err) =>
      console.error("Failed to refresh workflows:", err)
    );
    // Open what was saved, where it can be run.
    if (created?.uuid) {
      router.push(workflowPage(created.uuid));
    } else {
      mode.value = "browse";
    }
  } catch (error) {
    console.error(error);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "There was a problem submitting your request.",
        duration: 6000,
      },
    });
  } finally {
    saving.value = false;
  }
};

// The workflow page of a workflow (opened from the Library).
const workflowPage = (uuid, query) => ({
  name: route.params.orgId ? "workflow-detail" : "my-workflow-detail",
  params: { ...(route.params.orgId && { orgId: route.params.orgId }), uuid },
  ...(query && { query }),
});

// The canvas as workflow-service takes it: one processor per node, with
// what it depends on from the incoming edges.
const serializeProcessors = () => {
  return nodes.value.map((node) => {
    // Build dependsOn from incoming edges (edges whose target is this node)
    const dependsOn = edges.value
      .filter((e) => e.target === node.id)
      .map((e) => e.source);

    const saved = positionToSave(node);
    const position = { x: saved.x, y: saved.y };

    if (node.type === "data-source") {
      return {
        id: node.id,
        type: "data-source",
        dependsOn: [],
        position,
      };
    }

    if (node.type === "data-target") {
      const target = {
        id: node.id,
        type: "data-target",
        targetType: node.data.targetType,
        computeType: node.data.computeType,
        dependsOn: dependsOn,
        position,
      };
      if (
        node.data.defaultParams &&
        Object.keys(node.data.defaultParams).length > 0
      ) {
        target.defaultParams = node.data.defaultParams;
      }
      return target;
    }

    // Default: processor
    const proc = {
      id: node.id,
      type: "processor",
      sourceUrl: node.data.application?.sourceUrl,
      tag: node.data.tag || latestVersion(node.data.application)?.version || "",
      computeType: node.data.computeType || "standard",
      dependsOn: dependsOn,
      position,
    };
    if (node.data.cpu) proc.cpu = node.data.cpu;
    if (node.data.memory) proc.memory = node.data.memory;
    if (node.data.interactive) {
      proc.interactive = true;
      if (node.data.sessionType) proc.sessionType = node.data.sessionType;
    }
    if (
      node.data.defaultParams &&
      Object.keys(node.data.defaultParams).length > 0
    ) {
      proc.defaultParams = node.data.defaultParams;
    }
    return proc;
  });
};

/*
  A saved workflow: read-only, with Edit for its owner and Duplicate to edit
  for everyone else. Saving an edit is a new version of it (workflow-service
  versions); its history lists every version, and an older one can be
  viewed (read-only) or duplicated.
*/
const versions = ref([]); // [{ version, name, note, steps, createdAt, createdBy, official }]
const viewingVersion = ref(null); // an older version shown, or null for the latest
const latestVersionNumber = computed(() => selectedWorkflow.value?.latestVersion || 1);

const loadVersions = async (uuid) => {
  try {
    versions.value = await store.dispatch("analysisModule/fetchWorkflowVersions", uuid);
  } catch {
    versions.value = []; // versions aren't served here (yet)
  }
};

const showVersion = async (n) => {
  const uuid = selectedWorkflow.value?.uuid;
  if (!uuid || mode.value !== "browse") return;
  try {
    if (n === latestVersionNumber.value) {
      const latest = await store.dispatch("analysisModule/fetchWorkflowDefinition", uuid);
      selectWorkflow(latest);
      viewingVersion.value = null;
    } else {
      const v = await store.dispatch("analysisModule/fetchWorkflowVersion", { uuid, version: n });
      selectWorkflow({ ...v, latestVersion: latestVersionNumber.value });
      viewingVersion.value = n;
    }
  } catch (err) {
    EventBus.$emit("toast", { detail: { type: "error", msg: err?.message || "Could not load that version." } });
  }
};

const startEdit = () => {
  if (!isWorkflowCreator.value || viewingVersion.value) return;
  mode.value = "edit";
  selectedNode.value = null;
  workflowName.value = selectedWorkflow.value?.name || "";
  workflowDescription.value = selectedWorkflow.value?.description || "";
  history.reset();
};

const cancelEdit = async () => {
  if (history.canUndo()) {
    try {
      await ElMessageBox.confirm("Your changes to this workflow will be lost.", "Discard changes?", {
        confirmButtonText: "Discard",
        cancelButtonText: "Keep editing",
        type: "warning",
      });
    } catch {
      return;
    }
  }
  selectWorkflow(selectedWorkflow.value);
};

// Whether the canvas has the saved workflow's steps and connections (only
// settings changed): what can still be saved where versions aren't served.
const sameShape = () => {
  const dag = selectedWorkflow.value?.dag || [];
  const ids = (list) => list.map((x) => x).sort().join(",");
  const savedEdges = dag.flatMap((p) => (p.dependsOn || []).map((d) => `${d}>${p.id}`));
  return (
    ids(dag.map((p) => p.id)) === ids(nodes.value.map((n) => n.id)) &&
    ids(savedEdges) === ids(edges.value.map((e) => `${e.source}>${e.target}`))
  );
};

const saveEdit = async () => {
  const wf = selectedWorkflow.value;
  if (!wf?.uuid) return;
  let note = "";
  try {
    const { value } = await ElMessageBox.prompt("What changed? (optional)", `Save version ${latestVersionNumber.value + 1}`, {
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
      inputPlaceholder: "e.g. Raised the threshold; added a plot step",
    });
    note = (value || "").trim();
  } catch {
    return;
  }
  saving.value = true;
  try {
    const saved = await store.dispatch("analysisModule/saveWorkflowVersion", {
      uuid: wf.uuid,
      payload: {
        name: workflowName.value,
        description: workflowDescription.value,
        processors: serializeProcessors(),
        ...(note && { note }),
      },
    });
    EventBus.$emit("toast", { detail: { type: "success", msg: `Saved version ${saved?.latestVersion || ""}.` } });
  } catch (err) {
    if (![404, 501].includes(err?.status)) {
      EventBus.$emit("toast", {
        detail: { type: "error", msg: err?.status === 409 ? "The workflow was saved meanwhile. Cancel, and edit it again." : err?.message || "Could not save." },
      });
      saving.value = false;
      return;
    }
    // Versions aren't served here yet: settings can still be saved in
    // place; changes to the steps can't.
    if (!sameShape()) {
      EventBus.$emit("toast", {
        detail: { type: "error", msg: "Adding, removing or connecting steps of a saved workflow isn't available here yet. Duplicate it instead." },
      });
      saving.value = false;
      return;
    }
    if (workflowName.value !== wf.name || workflowDescription.value !== wf.description) {
      await store.dispatch("analysisModule/updateWorkflow", {
        uuid: wf.uuid,
        payload: { name: workflowName.value, description: workflowDescription.value },
      });
    }
    await saveWorkflowChanges();
  } finally {
    saving.value = false;
  }
  const updated = await store.dispatch("analysisModule/fetchWorkflowDefinition", wf.uuid);
  selectWorkflow(updated);
};

const duplicating = ref(false);
const duplicate = async () => {
  const wf = selectedWorkflow.value;
  if (!wf?.uuid) return;
  duplicating.value = true;
  try {
    const copy = await store.dispatch("analysisModule/duplicateWorkflow", {
      uuid: wf.uuid,
      version: viewingVersion.value || undefined,
    });
    router.push(workflowPage(copy.uuid, { edit: "1" }));
  } catch (err) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: [404, 501].includes(err?.status) ? "Duplicating isn't available here yet." : err?.message || "Could not duplicate.",
      },
    });
  } finally {
    duplicating.value = false;
  }
};

const runThis = () =>
  router.push({ name: route.params.orgId ? "workflows" : "my-workflows", query: { run: selectedWorkflow.value?.uuid } });

/*
  Drafts: a new workflow not yet saved is kept in this browser and offered
  back when the builder opens again.
*/
const DRAFT_KEY = computed(() => `pennsieve.builder.draft.${route.params.orgId || "mine"}`);
let draftTimer = null;
const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY.value);
  } catch {
    // nothing kept
  }
};
watch(
  [nodes, edges, workflowName, workflowDescription],
  () => {
    if (mode.value !== "create") return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (nodes.value.length <= 1 && !workflowName.value.trim()) return;
      const s = snapshot(nodes.value, edges.value);
      s.nodes.forEach((n) => {
        if (n.data.application) n.data.application = { uuid: n.data.application.uuid };
        delete n.data.manifestPorts;
      });
      try {
        localStorage.setItem(
          DRAFT_KEY.value,
          JSON.stringify({ name: workflowName.value, description: workflowDescription.value, ...s, savedAt: Date.now() }),
        );
      } catch {
        // not kept
      }
    }, 800);
  },
  { deep: true },
);

const offerDraft = async () => {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY.value) || "null");
  } catch {
    draft = null;
  }
  if (!draft?.nodes?.length) return;
  try {
    await ElMessageBox.confirm(
      `You have an unsaved workflow${draft.name ? `, "${draft.name}"` : ""}. Resume it?`,
      "Resume your draft?",
      { confirmButtonText: "Resume", cancelButtonText: "Start new", type: "info" },
    );
  } catch {
    clearDraft();
    return;
  }
  const byUuid = (uuid) => availableApplications.value.find((a) => a.uuid === uuid) || { uuid };
  draft.nodes.forEach((n) => {
    if (n.data.application) n.data.application = byUuid(n.data.application.uuid);
  });
  nodes.value = draft.nodes;
  edges.value = draft.edges;
  workflowName.value = draft.name || "";
  workflowDescription.value = draft.description || "";
  hydrateManifestPorts();
  revalidateEdges();
  history.reset();
  nextTick(() => setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50));
};

/*
Fetch Initial Data
*/
onMounted(async () => {
  try {
    isLoading.value = true;

    await Promise.all([
      store.dispatch("analysisModule/fetchApplications"),
      store.dispatch("analysisModule/fetchTargetTypes"),
    ]);

    if (props.uuid) {
      const wf = await store.dispatch(
        "analysisModule/fetchWorkflowDefinition",
        props.uuid,
      );
      if (wf) {
        selectWorkflow(wf);
        // A duplicate opens ready to edit.
        if (route.query.edit === "1" && isWorkflowCreator.value) startEdit();
      }
    } else {
      enterCreateMode();
      await offerDraft();
    }
  } catch (err) {
    console.error(err);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Failed to load data.",
      },
    });
  } finally {
    isLoading.value = false;
  }
});

/*
Event Handler for Node Click
*/
onNodeClick(({ node }) => {
  // Deselect previous
  nodes.value.forEach((n) => (n.selected = false));
  // Select clicked node
  const target = nodes.value.find((n) => n.id === node.id);
  if (target) target.selected = true;

  selectedNode.value = node;
  const toOpen = ["information", "node-metrics"];
  const current = accordionActiveNames.value;
  const missing = toOpen.filter((n) => !current.includes(n));
  if (missing.length) {
    accordionActiveNames.value = [...current, ...missing];
  }
});

onPaneClick(() => {
  nodes.value.forEach((n) => (n.selected = false));
  selectedNode.value = null;
});

const openNodeSettings = (id) => {
  nodes.value.forEach((n) => (n.selected = false));
  const target = nodes.value.find((n) => n.id === id);
  if (target) target.selected = true;
  selectedNode.value = target;

  // Ensure information accordion is open
  if (!accordionActiveNames.value.includes("information")) {
    accordionActiveNames.value = [...accordionActiveNames.value, "information"];
  }

  nextTick(() => {
    sidebarRef.value?.scrollTo({ top: 0, behavior: "smooth" });
  });
};
</script>

<template>
  <div class="workflow-builder">
    <!-- The bar (create mode): in the Workflows tab's toolbar when given
         one (toolbarTarget), else above the canvas. -->
    <Teleport v-if="mode === 'create'" defer :to="toolbarTarget || 'body'" :disabled="!toolbarTarget">
      <div :class="toolbarTarget ? 'builder-bar-host' : 'builder-header'">
        <BuilderBar
          v-model:name="workflowName"
          v-model:description="workflowDescription"
          :readiness="readiness"
          :saving="saving"
          @save="saveWorkflow"
          @start-over="startOver"
          @select="onReadinessSelect"
        />
      </div>
    </Teleport>

    <!-- A saved workflow: read-only, or its owner editing it -->
    <div v-if="mode === 'edit'" class="builder-header">
      <BuilderBar
        v-model:name="workflowName"
        v-model:description="workflowDescription"
        :readiness="readiness"
        :saving="saving"
        :save-label="`Save version ${latestVersionNumber + 1}`"
        editing
        @save="saveEdit"
        @cancel="cancelEdit"
        @select="onReadinessSelect"
      />
    </div>
    <div v-else-if="isReadOnly" class="builder-header">
      <span class="header-title">
        <router-link :to="workflowsRoute" class="header-back-link">
          &larr; Workflows
        </router-link>
        <span class="header-breadcrumb-sep">/</span>
        <span class="header-detail-name">{{
          selectedWorkflow?.name || "Workflow"
        }}</span>
        <el-dropdown v-if="versions.length > 1" trigger="click" @command="showVersion">
          <button type="button" class="version-pill">
            Version {{ viewingVersion || latestVersionNumber }}<template v-if="!viewingVersion"> (latest)</template> ▾
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="v in versions" :key="v.version" :command="v.version">
                <div class="version-item">
                  <span>
                    Version {{ v.version }}
                    <template v-if="v.version === latestVersionNumber"> · latest</template>
                    <template v-if="v.official"> · verified</template>
                  </span>
                  <span class="version-item-meta">
                    {{ v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "" }}<template v-if="v.note"> · {{ v.note }}</template>
                  </span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <span v-else-if="selectedWorkflow?.latestVersion" class="version-pill version-pill--static">
          Version {{ latestVersionNumber }}
        </span>
      </span>
      <div class="header-actions">
        <bf-button v-if="!viewingVersion && selectedWorkflow?.isActive !== false" class="secondary" @click="runThis">
          ▶ Run
        </bf-button>
        <el-tooltip
          v-if="isWorkflowCreator"
          :disabled="!viewingVersion"
          content="Edit works on the latest version; duplicate this one to change it."
          placement="bottom"
        >
          <span>
            <bf-button :disabled="!!viewingVersion" @click="startEdit">Edit</bf-button>
          </span>
        </el-tooltip>
        <bf-button v-else :processing="duplicating" @click="duplicate">Duplicate to edit</bf-button>
        <bf-button v-if="isWorkflowCreator && viewingVersion" class="secondary" :processing="duplicating" @click="duplicate">
          Duplicate this version
        </bf-button>
      </div>
    </div>

    <div class="builder-content">
      <!-- Left: what can be added (create and edit) -->
      <button
        v-if="!isReadOnly && !panels.palette"
        type="button"
        class="panel-rail"
        title="Show the steps you can add"
        aria-label="Show the steps you can add"
        @click="togglePanel('palette')"
      >
        <el-icon><ArrowRight /></el-icon>
        <span class="panel-rail-label">Add steps</span>
      </button>
      <BuilderPalette
        v-if="!isReadOnly && panels.palette"
        :applications="availableApplications"
        :app-name="appDisplayName"
        :step-ports="selectedNode?.type === 'default' ? selectedNode.data?.manifestPorts || null : null"
        :step-label="selectedNode?.data?.label || ''"
        :loading="isLoading"
        @add="(type, app) => addStep(type, app)"
        @dragstart="(app, event, type) => onDragStart(app, event, type)"
        @fold="togglePanel('palette')"
      />

      <!-- Middle: the canvas -->
      <div class="main-panel">
        <!-- Workflow Canvas -->
        <div class="workflow-canvas" @drop="onDrop" @dragover="onDragOver">
          <div v-if="nodes.length === 0" class="empty-canvas">
            <template v-if="mode === 'create'">
              <h3>Drag items here to build your workflow</h3>
              <p>
                Drop data sources, applications, and data targets onto the
                canvas, then connect them by dragging between handles
              </p>
            </template>
            <template v-else>
              <h3>No workflow loaded</h3>
              <p>Return to the workflow library to select a workflow</p>
            </template>
          </div>

          <div class="workflow-builder-flow">
            <VueFlow
              v-model:nodes="nodes"
              v-model:edges="edges"
              :default-viewport="{ zoom: 1 }"
              :min-zoom="0.2"
              :max-zoom="4"
              :nodes-draggable="true"
              :nodes-connectable="!isReadOnly"
              :elements-selectable="true"
              :pan-on-drag="true"
              :zoom-on-scroll="true"
              :delete-key-code="null"
            >
              <Background pattern-color="#aaa" :gap="16" />
              <Controls position="bottom-right" />
              <MiniMap v-if="nodes.length > 6" position="bottom-left" pannable zoomable />

              <div class="canvas-toolbar">
                <GraphDensityToggle
                  v-if="nodes.length > 0"
                  :detailed="detailed"
                  @update:detailed="changeDensity"
                />
                <button
                  v-if="nodes.length > 0"
                  class="auto-layout-btn"
                  @click="autoLayout"
                >
                  Auto Layout
                </button>
                <template v-if="!isReadOnly">
                  <button
                    v-if="edges.some((e) => e.selected)"
                    class="auto-layout-btn"
                    title="Remove the selected connection (Delete)"
                    @click="deleteSelection()"
                  >
                    Remove connection
                  </button>
                  <button class="auto-layout-btn icon-btn" title="Undo (⌘Z)" aria-label="Undo" @click="history.undo()">
                    <el-icon><RefreshLeft /></el-icon>
                  </button>
                  <button class="auto-layout-btn icon-btn" title="Redo (⇧⌘Z)" aria-label="Redo" @click="history.redo()">
                    <el-icon><RefreshRight /></el-icon>
                  </button>
                </template>
              </div>

              <!-- The first step: a hint while only the input is there. -->
              <div v-if="!isReadOnly && nodes.length === 1 && nodes[0].type === 'data-source'" class="first-step-hint">
                Add the first step with the <strong>+</strong> under Input data, or click an app in the list.
                Or start from a workflow in the
                <router-link :to="workflowsRoute" class="first-step-link">Library</router-link>
                and duplicate it.
              </div>

              <template #node-default="{ data, id }">
                <Handle id="target" type="target" :position="Position.Top" />
                <template v-if="!detailed">
                  <Handle
                    v-for="(p, i) in routedOutputs(data.manifestPorts)"
                    :key="p.name"
                    :id="portHandleId(p.name)"
                    type="source"
                    :position="Position.Bottom"
                    class="port-handle port-handle--compact"
                    :style="{ left: `${((i + 1) * 100) / (routedOutputs(data.manifestPorts).length + 2)}%` }"
                    :title="`${p.name}: connect to a data target to send this output there`"
                  />
                </template>
                <CompactFlowNode
                  v-if="!detailed"
                  kind="processor"
                  :label="data.label"
                  :runtime="data.interactive ? 'interactive' : data.computeType"
                  :accent="stepAccent(data)"
                  :class="connectClass(id)"
                >
                    <span
                      v-if="data.draftManifest"
                      class="draft-badge draft-badge--compact"
                      title="Using a draft app.yml saved in this browser, not the released one. Switch to the detailed view to see its inputs and outputs."
                    >Draft</span>
                    <span v-if="stepWarning(id)" class="step-warn" :title="stepWarning(id)" />
                    <button
                      v-if="!isReadOnly"
                      class="settings-btn"
                      @click.stop="openNodeSettings(id)"
                      title="Configure"
                    >
                      <IconPencil :width="12" :height="12" />
                    </button>
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                </CompactFlowNode>
                <div
                  v-else
                  class="custom-node"
                  :class="connectClass(id)"
                  :style="stepAccent(data) ? { boxShadow: `inset 4px 0 0 ${stepAccent(data)}` } : undefined"
                >
                  <div v-if="data.manifestPorts?.inputs?.length" class="node-ports node-ports--in">
                    <span v-for="p in data.manifestPorts.inputs" :key="p.name" class="node-port" :title="p.description">
                      {{ p.name }}<template v-if="portTypes(p)"> · {{ portTypes(p) }}</template>
                    </span>
                  </div>
                  <div class="node-header">
                    <span class="node-type-badge processor-badge">{{ data.interactive ? "Interactive" : "Processor" }}</span>
                    <span class="node-title">{{ data.label }}</span>
                    <span
                      v-if="data.draftManifest"
                      class="draft-badge"
                      title="Using a draft app.yml saved in this browser, not the released one. A release must declare the same outputs for its links to work. Clear the draft in the app.yml builder."
                    >Draft app.yml</span>
                    <span v-if="stepWarning(id)" class="step-warn" :title="stepWarning(id)" />
                    <button
                      v-if="!isReadOnly"
                      class="settings-btn"
                      @click.stop="openNodeSettings(id)"
                      title="Configure"
                    >
                      <IconPencil :width="12" :height="12" />
                    </button>
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                  </div>
                  <div
                    v-if="data.tag || (data.application && latestVersion(data.application))"
                    class="node-description"
                  >
                    <span class="version-tag">{{
                      data.tag || latestVersion(data.application)?.version
                    }}</span>
                    <span
                      v-if="
                        data.tag &&
                        latestVersion(data.application) &&
                        data.tag !== latestVersion(data.application).version
                      "
                      class="version-outdated-badge"
                    >
                      older — latest
                      {{ latestVersion(data.application).version }}
                    </span>
                    <span v-else class="version-latest-badge">latest</span>
                  </div>
                  <div class="node-resources">
                    <template v-if="data.computeType !== 'lambda'">
                      CPU: {{ data.cpu || "N/A" }} |
                    </template>
                    Memory:
                    {{ data.memory ? formatResourceLabel(data.memory) : "N/A" }}
                    <span v-if="data.computeType" class="runtime-tag">{{
                      data.computeType
                    }}</span>
                  </div>
                  <div v-if="data.manifestPorts?.outputs?.length" class="node-ports node-ports--out">
                    <span
                      v-for="p in data.manifestPorts.outputs"
                      :key="p.name"
                      class="node-port"
                      :class="{ 'node-port--routed': routedOutputs(data.manifestPorts).length }"
                      :title="routedOutputs(data.manifestPorts).length ? `${p.description || p.name} — connect to a data target to send it there` : p.description"
                    >
                      {{ p.name }}<template v-if="portTypes(p)"> · {{ portTypes(p) }}</template>
                      <!-- Two or more outputs: each its own connection point -->
                      <Handle
                        v-if="routedOutputs(data.manifestPorts).length"
                        :id="portHandleId(p.name)"
                        type="source"
                        :position="Position.Bottom"
                        class="port-handle"
                      />
                    </span>
                  </div>
                  <div v-else-if="!data.hasManifest" class="node-ports node-ports--none">No manifest</div>
                </div>
                <!-- With output ports, the main point (all outputs, to another
                     app) moves to the side, clear of the ports and the +. -->
                <Handle
                  id="source"
                  type="source"
                  :position="routedOutputs(data.manifestPorts).length ? Position.Right : Position.Bottom"
                  :title="routedOutputs(data.manifestPorts).length ? 'All outputs: connect to another app' : undefined"
                />
                <button
                  v-if="!isReadOnly"
                  type="button"
                  class="add-next nodrag"
                  title="Add a step after this"
                  aria-label="Add a step after this"
                  @click.stop="openStepPicker(id)"
                >+</button>
              </template>

              <template #node-input="{ data, id }">
                <Handle id="target" type="target" :position="Position.Top" />
                <CompactFlowNode
                  v-if="!detailed"
                  kind="processor"
                  :label="data.label"
                >
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                </CompactFlowNode>
                <div v-else class="custom-node input-node">
                  <div class="node-header">
                    <span class="node-title">{{ data.label }}</span>
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                  </div>
                  <div class="node-badge">Start</div>
                  <div
                    v-if="data.tag || (data.application && latestVersion(data.application))"
                    class="node-description"
                  >
                    <span class="version-tag">{{
                      data.tag || latestVersion(data.application)?.version
                    }}</span>
                    <span
                      v-if="
                        data.tag &&
                        latestVersion(data.application) &&
                        data.tag !== latestVersion(data.application).version
                      "
                      class="version-outdated-badge"
                    >
                      older — latest
                      {{ latestVersion(data.application).version }}
                    </span>
                    <span v-else class="version-latest-badge">latest</span>
                  </div>
                  <div
                    v-if="data.application && visibilityLabel(data.application)"
                    class="node-resources"
                  >
                    Visibility: {{ visibilityLabel(data.application) }}
                  </div>
                </div>
                <Handle id="source" type="source" :position="Position.Bottom" />
              </template>

              <template #node-output="{ data, id }">
                <Handle id="target" type="target" :position="Position.Top" />
                <CompactFlowNode
                  v-if="!detailed"
                  kind="processor"
                  :label="data.label"
                >
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                </CompactFlowNode>
                <div v-else class="custom-node output-node">
                  <div class="node-header">
                    <span class="node-title">{{ data.label }}</span>
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                  </div>
                  <div class="node-badge">End</div>
                  <div
                    v-if="data.tag || (data.application && latestVersion(data.application))"
                    class="node-description"
                  >
                    <span class="version-tag">{{
                      data.tag || latestVersion(data.application)?.version
                    }}</span>
                    <span
                      v-if="
                        data.tag &&
                        latestVersion(data.application) &&
                        data.tag !== latestVersion(data.application).version
                      "
                      class="version-outdated-badge"
                    >
                      older — latest
                      {{ latestVersion(data.application).version }}
                    </span>
                    <span v-else class="version-latest-badge">latest</span>
                  </div>
                  <div
                    v-if="data.application && visibilityLabel(data.application)"
                    class="node-resources"
                  >
                    Visibility: {{ visibilityLabel(data.application) }}
                  </div>
                </div>
                <Handle id="source" type="source" :position="Position.Bottom" />
              </template>

              <!-- Data Source Node: output only (feeds into processors) -->
              <template #node-data-source="{ data, id }">
                <CompactFlowNode
                  v-if="!detailed"
                  kind="source"
                  :class="connectClass(id)"
                  :label="data.label"
                >
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                </CompactFlowNode>
                <div v-else class="custom-node data-source-node" :class="connectClass(id)">
                  <div class="node-header">
                    <span class="node-type-badge source-badge">Source</span>
                    <span class="node-title">{{ data.label }}</span>
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                  </div>
                </div>
                <Handle id="source" type="source" :position="Position.Bottom" />
                <button
                  v-if="!isReadOnly"
                  type="button"
                  class="add-next nodrag"
                  title="Add a step after this"
                  aria-label="Add a step after this"
                  @click.stop="openStepPicker(id)"
                >+</button>
              </template>

              <!-- Data Target Node: input only (receives from processors) -->
              <template #node-data-target="{ data, id }">
                <Handle id="target" type="target" :position="Position.Top" />
                <CompactFlowNode
                  v-if="!detailed"
                  kind="target"
                  :class="connectClass(id)"
                  :label="getTargetTypeLabel(data.targetType)"
                  :runtime="data.computeType"
                >
                    <button
                      v-if="!isReadOnly"
                      class="settings-btn"
                      @click.stop="openNodeSettings(id)"
                      title="Configure"
                    >
                      <IconPencil :width="12" :height="12" />
                    </button>
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                </CompactFlowNode>
                <div v-else class="custom-node data-target-node" :class="connectClass(id)">
                  <div class="node-header">
                    <span class="node-type-badge target-badge">Target</span>
                    <span class="node-title">{{
                      getTargetTypeLabel(data.targetType)
                    }}</span>
                    <button
                      v-if="!isReadOnly"
                      class="settings-btn"
                      @click.stop="openNodeSettings(id)"
                      title="Configure"
                    >
                      <IconPencil :width="12" :height="12" />
                    </button>
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                  </div>
                  <div class="node-body">
                    <span v-if="data.computeType" class="runtime-tag">{{
                      data.computeType
                    }}</span>
                  </div>
                </div>
              </template>
            </VueFlow>
          </div>
        </div>
      </div>

      <!-- Sidebar (Right) -->
      <button
        v-if="!panels.inspector"
        type="button"
        class="panel-rail panel-rail--right"
        title="Show details"
        aria-label="Show details"
        @click="togglePanel('inspector')"
      >
        <el-icon><ArrowLeft /></el-icon>
        <span class="panel-rail-label">Details</span>
      </button>
      <div v-else ref="sidebarRef" class="applications-sidebar">
        <div class="insp-top">
          <span>Details</span>
          <button type="button" class="insp-fold" title="Fold the details" aria-label="Fold the details" @click="togglePanel('inspector')">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <!-- Information Section -->
          <el-collapse-item :title="selectedNode ? 'Step' : 'Workflow'" name="information">
            <!-- Selected Node Info -->
            <template v-if="selectedNode">
              <h4 class="sidebar-section-title">{{ selectedNode.data?.label || "Step" }}</h4>
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{
                    selectedNode.data?.label || "Unnamed"
                  }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Kind</span>
                  <span class="info-value">{{
                    { "data-source": "Input data", "data-target": "Output", default: "App" }[selectedNode.type] || selectedNode.type
                  }}</span>
                </div>
                <template v-if="selectedNode.data?.application?.description">
                  <div class="info-row">
                    <span class="info-label">Description</span>
                    <span class="info-value">{{
                      selectedNode.data.application.description
                    }}</span>
                  </div>
                </template>
                <template
                  v-if="selectedNode.data?.application?.applicationType"
                >
                  <div class="info-row">
                    <span class="info-label">App Type</span>
                    <span class="info-value">{{
                      selectedNode.data.application.applicationType
                    }}</span>
                  </div>
                </template>
                <template v-if="selectedNode.type === 'data-target'">
                  <div class="info-row">
                    <span class="info-label">Target Type</span>
                    <span class="info-value" v-if="isReadOnly">{{
                      getTargetTypeLabel(selectedNode.data.targetType)
                    }}</span>
                    <el-select
                      v-else
                      v-model="selectedNode.data.targetType"
                      size="small"
                      placeholder="Select target type"
                      class="info-inline-select"
                      @change="onTargetTypeChange(selectedNode.data)"
                    >
                      <el-option
                        v-for="tt in targetTypes"
                        :key="tt.targetType"
                        :label="targetTypeName(tt.targetType, targetTypes)"
                        :value="tt.targetType"
                      />
                    </el-select>
                  </div>
                </template>
                <template v-if="selectedNode.data?.computeType && isReadOnly">
                  <div class="info-row">
                    <span class="info-label">Compute Type</span>
                    <span class="info-value">{{
                      selectedNode.data.computeType
                    }}</span>
                  </div>
                </template>
              </div>

              <!-- About an app step: from its app.yml -->
              <template v-if="selectedNode.type === 'default'">
                <div class="about">
                  <p v-if="stepManifest?.description" class="about-desc">{{ stepManifest.description }}</p>
                  <template v-if="stepManifest">
                    <div v-if="(stepManifest.inputs || []).length" class="about-ports">
                      <span class="about-label">Takes</span>
                      <span v-for="p in stepManifest.inputs" :key="'i' + p.name" class="about-port" :title="p.description">
                        {{ p.name }}<template v-if="(p.mediaTypes || []).length"> · {{ ioTypes(p) }}</template>
                      </span>
                    </div>
                    <div v-if="(stepManifest.outputs || []).length" class="about-ports">
                      <span class="about-label">Produces</span>
                      <span v-for="p in stepManifest.outputs" :key="'o' + p.name" class="about-port" :title="p.description">
                        {{ p.name }}<template v-if="(p.mediaTypes || []).length"> · {{ ioTypes(p) }}</template>
                      </span>
                    </div>
                  </template>
                  <p v-else-if="manifestsKnown" class="about-none">
                    This app has no app.yml, so its inputs, outputs and parameters aren't described.
                    <router-link
                      v-if="selectedNode.data.application?.ownerId === profile?.id"
                      :to="{ name: route.params.orgId ? 'application-manifest-builder' : 'my-application-manifest-builder' }"
                    >Create one with the manifest builder</router-link>
                  </p>
                  <div class="about-links">
                    <button v-if="selectedNode.data.application?.uuid" type="button" class="text-link-btn" @click="viewAppYml(selectedNode)">
                      View app.yml
                    </button>
                    <router-link
                      v-if="selectedNode.data.application?.uuid"
                      :to="{
                        name: route.params.orgId ? 'application-detail' : 'my-application-detail',
                        params: { ...(route.params.orgId && { orgId: route.params.orgId }), uuid: selectedNode.data.application.uuid },
                      }"
                      class="text-link-btn"
                    >App page →</router-link>
                  </div>
                </div>
              </template>

              <!-- Data target runtime config (editable in create mode) -->
              <template
                v-if="selectedNode.type === 'data-target' && !isReadOnly"
              >
                <h4 class="sidebar-section-title">Runtime Configuration</h4>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">
                      Compute Type
                      <el-tooltip
                        content="Application must be set up for Lambda, if selected"
                        placement="top"
                      >
                        <IconInfoSmall :width="20" :height="20" class="compute-type-info-icon" />
                      </el-tooltip>
                    </span>
                    <el-select
                      v-model="selectedNode.data.computeType"
                      size="small"
                      class="info-inline-select"
                    >
                      <el-option
                        v-for="ct in getComputeTypesForTarget(
                          selectedNode.data.targetType,
                        )"
                        :key="ct"
                        :label="formatComputeTypeLabel(ct)"
                        :value="ct"
                      />
                    </el-select>
                  </div>
                </div>
              </template>

              <!-- Data target parameters -->
              <template
                v-if="
                  selectedNode.type === 'data-target' &&
                  selectedNode.data.targetType
                "
              >
                <h4 class="sidebar-section-title">Parameters</h4>
                <!-- A target's params can be fixed in the workflow (its
                     defaultParams), e.g. PATH_PREFIX to route part of a
                     step's output; a run can still override them. -->
                <div class="info-card">
                  <template
                    v-if="
                      getTargetTypeParams(selectedNode.data.targetType).length >
                      0
                    "
                  >
                    <template
                      v-for="param in getTargetTypeParams(
                        selectedNode.data.targetType,
                      )"
                      :key="param.name"
                    >
                      <!-- Fed by an output port: the prefix is that output's folder -->
                      <ParamField
                        :param="param"
                        :editable="canEditConfig && !(PREFIX_PARAMS.includes(param.name) && feedingPort(selectedNode.id))"
                        :model-value="selectedNode.data.defaultParams?.[param.name]"
                        @update:model-value="(v) => setDefaultParam(param.name, v)"
                      />
                      <p v-if="PREFIX_PARAMS.includes(param.name) && feedingPort(selectedNode.id)" class="port-prefix-note">
                        Set by the <strong>{{ feedingPort(selectedNode.id) }}</strong> output it's connected to: this target takes only
                        that output's folder.
                      </p>
                    </template>
                  </template>
                  <div v-else class="info-row">
                    <span class="info-value">No parameters</span>
                  </div>
                </div>
              </template>

              <!-- The step's app version (pinned), and what an update changes -->
              <template
                v-if="
                  selectedNode.type === 'default' &&
                  selectedNode.data.application?.versions?.length
                "
              >
                <h4 class="sidebar-section-title">Version</h4>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">Version</span>
                    <el-select
                      v-if="canEditConfig"
                      :model-value="selectedNode.data.tag"
                      size="small"
                      class="info-inline-select"
                      @update:model-value="requestVersion"
                    >
                      <el-option
                        v-for="v in sortedVersions(selectedNode.data.application)"
                        :key="v.version"
                        :label="versionOptionLabel(selectedNode.data.application, v)"
                        :value="v.version"
                      />
                    </el-select>
                    <span v-else class="info-value">{{ selectedNode.data.tag || "—" }}</span>
                  </div>
                  <div v-if="newerVersion" class="update-note">
                    <div class="update-head">
                      <span>Update available: <strong>{{ newerVersion }}</strong></span>
                      <button v-if="canEditConfig" type="button" class="text-link-btn" @click="requestVersion(newerVersion)">
                        Update
                      </button>
                    </div>
                    <ul v-if="updateLines.length" class="update-lines">
                      <li v-for="l in updateLines" :key="l">{{ l }}</li>
                    </ul>
                    <p v-else class="update-lines-none">No changes declared in app.yml.</p>
                  </div>
                </div>
              </template>

              <!-- Processor settings (editable in create mode): folded, as
                   the app's own resources usually do. -->
              <template v-if="selectedNode.type === 'default' && !isReadOnly">
                <button type="button" class="advanced-toggle" :aria-expanded="showAdvanced" @click="showAdvanced = !showAdvanced">
                  <span class="advanced-caret" :class="{ open: showAdvanced }">▸</span>
                  Advanced: compute and resources
                </button>
                <div v-show="showAdvanced" class="info-card">
                  <div class="info-row">
                    <span class="info-label">
                      Compute Type
                      <el-tooltip
                        content="Application must be set up for Lambda, if selected"
                        placement="top"
                      >
                        <IconInfoSmall :width="20" :height="20" class="compute-type-info-icon" />
                      </el-tooltip>
                    </span>
                    <el-select
                      v-model="selectedNode.data.computeType"
                      size="small"
                      class="info-inline-select"
                    >
                      <!-- TODO: use API-driven computeTypes once applications return them reliably -->
                      <el-option
                        v-for="ct in getComputeTypesForApplication(
                          selectedNode.data.application,
                        )"
                        :key="ct"
                        :label="formatComputeTypeLabel(ct)"
                        :value="ct"
                      />
                    </el-select>
                  </div>
                  <!-- Standard: CPU then dependent Memory -->
                  <template v-if="selectedNode.data.computeType !== 'lambda'">
                    <div class="info-row">
                      <span class="info-label">CPU</span>
                      <el-select
                        v-model="selectedNode.data.cpu"
                        size="small"
                        placeholder="Default"
                        clearable
                        class="info-inline-select"
                        @change="
                          () => {
                            selectedNode.data.memory = '';
                          }
                        "
                      >
                        <el-option
                          v-for="opt in STANDARD_CPU_OPTIONS"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Memory</span>
                      <el-select
                        v-model="selectedNode.data.memory"
                        size="small"
                        placeholder="Select CPU before Memory"
                        clearable
                        :disabled="!selectedNode.data.cpu"
                        class="info-inline-select"
                      >
                        <el-option
                          v-for="opt in getStandardMemoryOptions(
                            selectedNode.data.cpu,
                          )"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                    </div>
                  </template>
                  <!-- Lambda: Memory + auto-matched CPU -->
                  <template v-else>
                    <div class="info-row">
                      <span class="info-label">CPU</span>
                      <span class="info-auto-value">
                        Set automatically
                      </span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Memory</span>
                      <el-select
                        v-model="selectedNode.data.memory"
                        size="small"
                        placeholder="Default"
                        clearable
                        class="info-inline-select"
                        @change="
                          (val) => {
                            selectedNode.data.cpu = getCpuForMemory(val);
                          }
                        "
                      >
                        <el-option
                          v-for="mem in LAMBDA_MEMORY_OPTIONS"
                          :key="mem"
                          :label="formatResourceLabel(mem)"
                          :value="mem"
                        />
                      </el-select>
                    </div>
                    <p class="runtime-note">
                      Lambda sizes CPU automatically in proportion to the
                      memory you choose — there's no CPU to set here. The
                      Fargate CPU/memory values only apply if the run is
                      overridden to execute as a standard processor.
                    </p>
                  </template>
                </div>
              </template>

              <!-- Parameters, from the app's app.yml (ParamField). -->
              <template
                v-if="
                  selectedNode.type === 'default' &&
                  selectedNodeParamSchema.length > 0
                "
              >
                <h4 class="sidebar-section-title">Parameters</h4>
                <div class="info-card">
                  <ParamField
                    v-for="param in selectedNodeParamSchema"
                    :key="param.name"
                    :param="param"
                    :editable="canEditConfig"
                    :model-value="selectedNode.data.defaultParams?.[param.name]"
                    @update:model-value="(v) => setDefaultParam(param.name, v)"
                  />
                </div>
              </template>

              <!-- Processor configuration -->
              <template v-if="selectedNodeProcessor">
                <h4 class="sidebar-section-title">Configuration</h4>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">ID</span>
                    <span class="info-value info-url">{{
                      selectedNodeProcessor.id
                    }}</span>
                  </div>
                  <template v-if="selectedNodeProcessor.sourceUrl">
                    <div class="info-row">
                      <span class="info-label">Source URL</span>
                      <span class="info-value info-url">{{
                        selectedNodeProcessor.sourceUrl
                      }}</span>
                    </div>
                  </template>
                  <div class="info-row">
                    <span class="info-label">Depends On</span>
                    <span class="info-value">
                      <template v-if="selectedNodeDependencies.length > 0">
                        <span
                          v-for="dep in selectedNodeDependencies"
                          :key="dep.id"
                          class="dep-tag"
                          >{{ dep.label }}</span
                        >
                      </template>
                      <template v-else>None</template>
                    </span>
                  </div>
                </div>
              </template>

              <!-- Source -->
              <template v-if="selectedNode.data?.application?.source">
                <h4 class="sidebar-section-title">Source</h4>
                <div class="info-card">
                  <template v-if="selectedNode.data.application.source.url">
                    <div class="info-row">
                      <span class="info-label">Repository</span>
                      <span class="info-value info-url">{{
                        selectedNode.data.application.source.url
                      }}</span>
                    </div>
                  </template>
                  <template v-if="selectedNode.data.application.source.branch">
                    <div class="info-row">
                      <span class="info-label">Branch</span>
                      <span class="info-value">{{
                        selectedNode.data.application.source.branch
                      }}</span>
                    </div>
                  </template>
                  <template v-if="selectedNode.data.application.source.path">
                    <div class="info-row">
                      <span class="info-label">Path</span>
                      <span class="info-value info-url">{{
                        selectedNode.data.application.source.path
                      }}</span>
                    </div>
                  </template>
                </div>
              </template>

              <button class="text-link-btn" @click="selectedNode = null">
                Clear selection
              </button>
            </template>

            <!-- Building, nothing selected: what's left, and how -->
            <template v-if="!selectedNode && mode !== 'browse'">
              <h4 class="sidebar-section-title">Checklist</h4>
              <ul class="checklist">
                <li v-if="!readiness.items.length" class="checklist-done">Ready to save.</li>
                <li v-for="item in readiness.items" :key="item.id">
                  <button type="button" class="checklist-item" :class="`is-${item.level}`" @click="onReadinessSelect(item)">
                    <span class="checklist-dot" />
                    {{ item.text }}
                  </button>
                </li>
              </ul>
              <h4 class="sidebar-section-title">Tips</h4>
              <ul class="tips">
                <li>Click a step to see and change its settings.</li>
                <li><strong>+</strong> under a step adds the next one; drag between steps to connect them.</li>
                <li><kbd>Delete</kbd> removes the selection; <kbd>⌘Z</kbd> / <kbd>⇧⌘Z</kbd> undo and redo; arrows move between steps.</li>
              </ul>
            </template>

            <!-- Workflow Details -->
            <template v-if="selectedWorkflow && !selectedNode">
              <h4 class="sidebar-section-title">Workflow Details</h4>
              <template v-if="isEditingDetails">
                <div class="info-edit-form">
                  <label class="info-edit-label">Name</label>
                  <el-input v-model="editName" size="small" />
                  <label class="info-edit-label">Description</label>
                  <el-input
                    v-model="editDescription"
                    type="textarea"
                    :rows="3"
                    size="small"
                  />
                  <div class="info-edit-actions">
                    <bf-button class="secondary" @click="cancelEditDetails">
                      Cancel
                    </bf-button>
                    <bf-button
                      :disabled="isSavingDetails || !editName.trim()"
                      @click="saveDetails"
                    >
                      {{ isSavingDetails ? "Saving..." : "Save" }}
                    </bf-button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">Name</span>
                    <span class="info-value">{{ selectedWorkflow.name }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Description</span>
                    <span class="info-value">{{
                      selectedWorkflow.description || "No description"
                    }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Status</span>
                    <span class="info-value">
                      <span
                        class="status-dot"
                        :class="
                          selectedWorkflow.isActive ? 'active' : 'inactive'
                        "
                      />
                      {{ selectedWorkflow.isActive ? "Active" : "Inactive" }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Visibility</span>
                    <span class="info-value">
                      <span
                        class="visibility-badge"
                        :class="isPublicWorkflow ? 'public' : 'private'"
                      >
                        {{ isPublicWorkflow ? "Public" : "Private" }}
                      </span>
                      <el-tooltip
                        v-if="selectedWorkflow.official"
                        content="This workflow has been reviewed and validated by Pennsieve."
                        placement="top"
                      >
                        <span class="official-mark">
                          <IconPennsieveMark
                            :width="15"
                            :height="15"
                            color="currentColor"
                          />
                        </span>
                      </el-tooltip>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Nodes</span>
                    <span class="info-value">{{
                      (selectedWorkflow.dag || []).length
                    }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Created</span>
                    <span class="info-value">{{
                      new Date(selectedWorkflow.createdAt).toLocaleDateString()
                    }}</span>
                  </div>
                  <div v-if="selectedWorkflow.createdBy" class="info-row">
                    <span class="info-label">Created By</span>
                    <span class="info-value">{{
                      getUserName(selectedWorkflow.createdBy)
                    }}</span>
                  </div>
                </div>
                <div class="info-actions">
                  <button class="text-link-btn" @click="startEditDetails">
                    Edit name & description
                  </button>
                </div>
              </template>
            </template>

            <div v-if="!selectedWorkflow && !selectedNode" class="info-empty">
              Select a workflow or click a node to see details
            </div>
          </el-collapse-item>

          <!-- Workflow Metrics Section -->
          <el-collapse-item
            v-if="mode === 'browse' && selectedWorkflow && !selectedNode"
            title="Workflow Metrics"
            name="workflow-metrics"
          >
            <MetricsDashboard
              :key="selectedWorkflow.uuid"
              filter-column="workflowUuid"
              :filter-value="selectedWorkflow.uuid"
              vertical
              hide-header
            />
          </el-collapse-item>

          <!-- Node Metrics Section -->
          <el-collapse-item
            v-if="selectedNode && selectedNodeProcessor?.sourceUrl"
            title="Node Metrics"
            name="node-metrics"
          >
            <MetricsDashboard
              :key="selectedNodeProcessor.sourceUrl"
              filter-column="sourceUrl"
              :filter-value="selectedNodeProcessor.sourceUrl"
              vertical
              hide-header
            />
          </el-collapse-item>

          <!-- Danger Zone (always last) -->
          <el-collapse-item
            v-if="mode === 'browse' && selectedWorkflow && !selectedNode"
            title="Danger Zone"
            name="danger-zone"
            class="danger-collapse-item"
          >
            <div class="danger-zone">
              <div class="danger-row">
                <div class="danger-info">
                  <div class="danger-row-title">
                    {{
                      selectedWorkflow.isActive
                        ? "Archive workflow"
                        : "Activate workflow"
                    }}
                  </div>
                  <p class="danger-row-desc">
                    {{
                      selectedWorkflow.isActive
                        ? "Archiving hides this workflow from the active list. You can reactivate it at any time."
                        : "Reactivate this workflow so it appears in the active list and can be run."
                    }}
                  </p>
                </div>
                <bf-button class="danger-button" @click="toggleArchive">
                  {{ selectedWorkflow.isActive ? "Archive" : "Activate" }}
                </bf-button>
              </div>

              <div v-if="canPublish || canUnpublish" class="danger-row">
                <div class="danger-info">
                  <div class="danger-row-title">
                    {{ isPublicWorkflow ? "Make private" : "Make public" }}
                  </div>
                  <p class="danger-row-desc">
                    <template v-if="isPublicWorkflow">
                      This workflow is public — discoverable and runnable by
                      anyone across all organizations. Making it private also
                      removes any "Official" badge.
                    </template>
                    <template v-else>
                      Publishing makes this workflow discoverable and runnable by
                      anyone across all organizations. Every processor must
                      itself be public.
                    </template>
                  </p>
                </div>
                <bf-button class="danger-button" @click="togglePublish">
                  {{ isPublicWorkflow ? "Make private" : "Make public" }}
                </bf-button>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <StepPicker
      :open="!!pickerFor"
      :title="pickerTitle"
      :applications="filteredApplications"
      :app-name="appDisplayName"
      :app-line="(app) => [ioLine(versionManifest(app)), versionManifest(app)?.description || app.description].filter(Boolean).join(' · ')"
      @pick="onStepPicked"
      @close="pickerFor = null"
    />
    <el-dialog
      :model-value="!!appYml"
      :title="appYml?.title"
      width="640px"
      append-to-body
      @update:model-value="(v) => v || (appYml = null)"
    >
      <pre class="app-yml">{{ appYml?.text }}</pre>
    </el-dialog>
  </div>
</template>

<style lang="scss">
/* these are necessary styles for vue flow */
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/core/dist/theme-default.css";
@import "@vue-flow/minimap/dist/style.css";

/* The "Use version …?" confirmation (rendered outside the builder). */
.version-change {
  ul {
    margin: 0 0 8px;
    padding-left: 18px;
  }
  .version-warning {
    margin: 4px 0 0;
    color: #92400e;
  }
}

/* Handle styles — must be unscoped so VueFlow can render them */
.workflow-builder-flow {
  .vue-flow__node {
    --node-border-color: #cccccc;

    &:has(.input-node) {
      --node-border-color: #17bb62;
    }
    &:has(.output-node) {
      --node-border-color: #17bb62;
    }
    &:has(.data-source-node) {
      --node-border-color: #6366f1;
    }
    &:has(.data-target-node) {
      --node-border-color: #64748b;
    }
  }

  .vue-flow__handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--node-border-color, #cccccc) !important;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px var(--node-border-color, #cccccc);
    cursor: crosshair;
    transition: background-color 0.15s, box-shadow 0.15s;
    z-index: 0;

    /* Invisible expanded hit area so it's easy to grab */
    &::after {
      content: "";
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
      border-radius: 50%;
    }

    &:hover {
      background-color: #111;
      box-shadow: 0 0 0 2px #111;
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

    /* Valid connection target highlight */
    &.valid {
      background-color: #16a34a;
      box-shadow: 0 0 0 2px #16a34a;
    }

    /* Active / connecting state */
    &.connecting {
      background-color: #111;
      box-shadow: 0 0 0 2px #111;
    }
  }
}
</style>

<style lang="scss" scoped>
@use "../../../styles/theme";

.workflow-builder {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.update-note {
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #fcd9a6;
  border-radius: 4px;
  background: #fff8ec;
  font-size: 12px;
  color: theme.$gray_6;
}
.update-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.update-lines {
  margin: 6px 0 0;
  padding-left: 16px;
  color: theme.$gray_5;
}
.update-lines-none {
  margin: 4px 0 0;
  color: theme.$gray_4;
}

.version-pill {
  margin-left: 10px;
  padding: 2px 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
  }
}
.version-pill--static {
  cursor: default;

  &:hover {
    border-color: theme.$gray_2;
  }
}
.version-item {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  padding: 2px 0;
}
.version-item-meta {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: theme.$gray_4;
}

/* The bar's host when it's teleported into the Workflows toolbar. */
.builder-bar-host {
  display: flex;
  flex: 1;
  min-width: 0;
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

  .header-back-link {
    color: theme.$purple_3;
    cursor: pointer;
    font-weight: 500;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .header-breadcrumb-sep {
    color: theme.$gray_4;
    font-weight: 400;
  }

  .header-detail-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .header-name-input {
    width: 220px;
    flex-shrink: 0;
  }

  .header-desc-input {
    width: 280px;
    flex-shrink: 1;
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

.main-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* Folding the side panels: a rail to open one, a button to fold it. */
.panel-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 30px;
  flex-shrink: 0;
  padding: 12px 0;
  border: none;
  border-right: 1px solid theme.$gray_2;
  background: theme.$white;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
    color: theme.$purple_3;
  }
}
.panel-rail--right {
  border-right: none;
  border-left: 1px solid theme.$gray_2;
}
.panel-rail-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 12px;
  font-weight: 500;
}
.insp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -4px 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.insp-fold {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: none;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    background: theme.$gray_0;
    color: theme.$purple_3;
  }
}
.icon-btn {
  display: flex;
  align-items: center;
  padding: 6px 8px;
}
.checklist,
.tips {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 12px;
}
.checklist-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 4px 2px;
  border: none;
  background: none;
  font: inherit;
  color: theme.$gray_6;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
}
.checklist-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  margin-top: 4px;
  border-radius: 50%;
  background: #f59e0b;
}
.checklist-item.is-block .checklist-dot {
  background: theme.$status_red;
}
.checklist-done {
  color: theme.$status_green;
}
.tips li {
  margin-bottom: 6px;
  line-height: 1.4;
  color: theme.$gray_5;
}
kbd {
  padding: 0 4px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 11px;
}

.applications-sidebar {
  position: relative;
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

.new-workflow-btn {
  width: 100%;
}

.filter-btn {
  padding: 5px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

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

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.workflow-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.workflow-list-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_3;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border-color: theme.$purple_1;
    background-color: theme.$purple_tint;
    box-shadow: 0 2px 8px rgba(80, 57, 247, 0.15);
  }

  .wf-item-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .wf-item-info {
    flex: 1;
    min-width: 0;
  }

  .wf-item-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: theme.$black;
  }

  .wf-item-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 4px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .wf-item-meta {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
  }
}

.workflow-list-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.sidebar-accordion {
  border-top: none;
}

.sidebar-section-title {
  margin: 10px 0 6px 0;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_4;
}

.data-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.data-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid theme.$gray_3;
  cursor: grab;
  transition: all 0.2s;

  &:active {
    cursor: grabbing;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:active {
      cursor: not-allowed;
    }
  }

  .data-item-icon {
    flex-shrink: 0;
  }

  .data-item-info {
    flex: 1;
    min-width: 0;
  }

  .data-item-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .data-item-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-top: 2px;
  }
}

.data-source-item {
  background-color: #eef2ff;
  border-color: #6366f1;

  &:not(.disabled):hover {
    border-color: #4f46e5;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  }
}

.data-target-item {
  background-color: #f1f5f9;
  border-color: #64748b;

  &:not(.disabled):hover {
    border-color: #047857;
    box-shadow: 0 2px 8px rgba(5, 150, 105, 0.2);
  }
}

.application-search {
  margin-bottom: 8px;
}

.applications-empty {
  padding: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}

.applications-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.application-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_3;
  cursor: grab;
  transition: all 0.2s;

  &:not(.disabled):hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    cursor: grabbing;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;

    &:active {
      cursor: not-allowed;
    }
  }

  .app-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .app-info {
    flex: 1;
    min-width: 0;
  }

  .app-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: theme.$black;
  }

  .app-type-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 2px 6px;
    border-radius: 3px;
    background: theme.$gray_2;
    color: theme.$gray_5;
    margin-bottom: 4px;
  }

  .app-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 4px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .app-resources {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
  }
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

  h3 {
    margin: 0 0 10px 0;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

/* While connecting: what accepts the connection, what doesn't. */
.connect-fits {
  outline: 2px solid #17bb62;
  outline-offset: 2px;
}
.connect-mismatch {
  opacity: 0.6;
  outline: 2px dashed #e94b4b;
  outline-offset: 2px;
}
.connect-no {
  opacity: 0.35;
}
/* A step with a required parameter without a value. */
.step-warn {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #f59e0b;
}
/* A step's declared inputs (top) and outputs (bottom). */
.node-ports {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  font-size: 10px;
}
.node-ports--in {
  margin-bottom: 6px;
}
.node-ports--out {
  margin-top: 6px;
}
.node-ports--none {
  margin-top: 6px;
  font-style: italic;
  color: theme.$gray_4;
}
.node-port {
  padding: 0 5px;
  border-radius: 3px;
  background: theme.$gray_0;
  color: theme.$gray_5;
}
.draft-badge {
  padding: 0 5px;
  border: 1px dashed theme.$orange_1;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  color: theme.$orange_1;
  white-space: nowrap;
}
.draft-badge--compact {
  margin-right: 4px;
}
.port-prefix-note {
  margin: -4px 0 10px;
  font-size: 12px;
  color: theme.$gray_5;
}
/* An output with its own connection point (two or more outputs). */
.node-port--routed {
  position: relative;
  padding-bottom: 2px;
}
.port-handle {
  width: 9px;
  height: 9px;
  background: theme.$purple_3;
  border: 2px solid theme.$white;
}
/* On the step's bottom edge, under its chip: the chip's bottom is the
   node's padding (14px) plus its border (1px) above the edge. */
.node-port--routed .port-handle {
  bottom: -15px;
}

/* The + under a step: what comes next. Shown on hover and selection. */
.add-next {
  position: absolute;
  left: 50%;
  bottom: -34px;
  z-index: 5;
  width: 22px;
  height: 22px;
  margin-left: -11px;
  padding: 0;
  border: 1px solid theme.$purple_1;
  border-radius: 50%;
  background: theme.$white;
  color: theme.$purple_2;
  font-size: 15px;
  line-height: 19px;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s, background 0.15s;

  &:hover,
  &:focus-visible {
    opacity: 1;
    background: theme.$purple_tint;
    outline: none;
  }
}
.vue-flow__node:hover .add-next,
.vue-flow__node.selected .add-next {
  opacity: 1;
}
.first-step-hint {
  position: absolute;
  left: 50%;
  bottom: 24px;
  z-index: 5;
  transform: translateX(-50%);
  padding: 8px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font-size: 13px;
  color: theme.$gray_5;
}
.first-step-link {
  color: theme.$link-color;
  text-decoration: none;

  &:hover {
    color: theme.$link-color-hover;
  }
}

.about {
  margin: 4px 0 10px;
  font-size: 12px;
}
.about-desc {
  margin: 0 0 8px;
  line-height: 1.4;
  color: theme.$gray_6;
}
.about-ports {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}
.about-label {
  width: 62px;
  color: theme.$gray_4;
}
.about-port {
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  color: theme.$gray_6;
}
.about-none {
  margin: 0 0 6px;
  font-style: italic;
  color: theme.$gray_4;
}
.about-links {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}
.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 12px 0 6px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  cursor: pointer;
}
.advanced-caret {
  font-size: 10px;
  transition: transform 0.12s ease;

  &.open {
    transform: rotate(90deg);
  }
}
.app-yml {
  max-height: 60vh;
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  font-size: 12px;
}

.canvas-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Sits under the toolbar (node size switch and Auto Layout), which owns the
   top-right corner. */
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
    background: theme.$white;
  }
}

.workflow-builder-flow {
  width: 100%;
  height: 100%;

  /* Hide default Vue Flow node styling only within workflow builder */
  :deep(.vue-flow__node) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    width: auto !important;

    &.selected .custom-node {
      border-color: theme.$gray_4;
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
    }
  }
}

.custom-node {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 14px;
  min-width: 250px;
  max-width: 350px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  position: relative;
  z-index: 1;

  &:hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }

  .node-title {
    font-weight: 600;
    font-size: 15px;
    color: theme.$black;
    flex: 1;
    line-height: 1.3;
  }

  .settings-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 3px;
    border-radius: 3px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;

    &:hover {
      color: theme.$purple_1;
      background: rgba(theme.$purple_1, 0.1);
    }
  }

  .remove-btn {
    background: theme.$status_red;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover {
      background: darken(theme.$status_red, 10%);
    }
  }

  .node-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 8px;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .version-tag {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_6;
    background: theme.$gray_1;
    padding: 2px 8px;
    border-radius: 3px;
  }

  .version-latest-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 2px;
    background: rgba(5, 150, 105, 0.12);
    color: #047857;
    white-space: nowrap;
  }

  .version-outdated-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 2px;
    background: rgba(217, 119, 6, 0.12);
    color: #b45309;
    white-space: nowrap;
  }

  .node-resources {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid theme.$gray_2;
    display: flex;
    align-items: center;
    gap: 8px;
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
    margin-left: auto;
  }

  .node-badge {
    margin-top: 8px;
    margin-bottom: 8px;
    padding: 4px 8px;
    background: theme.$gray_2;
    border-radius: 4px;
    font-size: 11px;
    text-align: center;
    font-weight: 600;
  }

  &.input-node {
    border-color: theme.$status_green;

    .node-badge {
      background: theme.$status_green;
      color: white;
    }
  }

  &.output-node {
    border-color: theme.$status_green;

    .node-badge {
      background: theme.$status_green;
      color: white;
    }
  }

  &.data-source-node {
    border-color: #6366f1;
    background: #eef2ff;

    .node-header {
      align-items: center;
      margin-bottom: 0;
    }
  }

  &.data-target-node {
    border-color: #64748b;
    background: #f1f5f9;

    .node-body {
      margin-top: 8px;
    }

    .edit-target-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px;
      border-radius: 3px;
      color: theme.$gray_4;
      display: flex;
      align-items: center;
      transition: color 0.15s, background 0.15s;

      &:hover,
      &.active {
        color: #64748b;
        background: rgba(100, 116, 139, 0.1);
      }
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

    .target-edit {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .target-edit-field {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .target-edit-label {
        font-size: 10px;
        font-weight: 600;
        color: theme.$gray_4;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
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

    &.source-badge {
      background: #6366f1;
      color: white;
    }

    &.processor-badge {
      background: theme.$orange_2;
      color: white;
    }

    &.target-badge {
      background: #64748b;
      color: white;
    }
  }
}

/* Information panel styles */
.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

  .compute-type-info-icon {
    vertical-align: top;
    margin-left: 2px;
    opacity: 0.6;
  }
}

.info-value {
  font-size: 12px;
  color: theme.$black;
  text-align: right;
  word-break: break-word;
}

.info-inline-select {
  width: 130px;

  :deep(.el-select-dropdown__item) {
    display: flex;
    align-items: center;
  }
}

.info-auto-value {
  width: 130px;
  font-size: 12px;
  color: theme.$gray_4;
  font-style: italic;
  text-align: right;
}

.runtime-note {
  font-size: 11px;
  color: theme.$gray_4;
  margin: 8px 0 0 0;
  line-height: 1.4;
  font-style: italic;
}

.info-url {
  font-family: monospace;
  font-size: 11px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;

  &.active {
    background-color: theme.$status_green;
  }

  &.inactive {
    background-color: theme.$gray_4;
  }
}

.info-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

  &:hover {
    text-decoration: underline;
  }
}

.visibility-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;

  &.private {
    background-color: theme.$gray_2;
    color: theme.$gray_5;
  }

  &.public {
    background-color: theme.$green_tint;
    color: theme.$status_green;
  }
}

.official-mark {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  color: theme.$purple_3;
  vertical-align: middle;
}

.danger-collapse-item {
  :deep(.el-collapse-item__header) {
    color: theme.$red_2;
    font-weight: 600;
  }
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &:not(:last-child) {
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(theme.$red_2, 0.2);
  }
}

.danger-info {
  flex: 1;
}

.danger-row-title {
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
  margin-bottom: 4px;
}

.danger-row-desc {
  font-size: 12px;
  color: theme.$gray_5;
  margin: 0;
  line-height: 1.4;
}

.danger-button {
  flex-shrink: 0;
  background: theme.$white;
  color: theme.$red_2;
  border: 1px solid theme.$red_2;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    background: theme.$red_1;
    color: theme.$white;
  }
}

.info-edit-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-edit-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
}

.info-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.dep-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: theme.$gray_2;
  color: theme.$gray_5;
  margin: 1px 3px 1px 0;
}

.info-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.header-title {
  font-weight: 600;
  font-size: 15px;
}

.param-edit-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  min-width: 0;
}

.param-revert-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: theme.$gray_4;
  font-size: 16px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;

  &:hover {
    color: theme.$status_red;
  }
}

.param-value-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 140px;
  cursor: default;
}

.param-default-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: theme.$gray_4;
  cursor: pointer;

  &:hover {
    color: theme.$gray_5;
    .param-edit-icon {
      opacity: 1;
    }
  }
}

.param-edit-icon {
  font-size: 11px;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.param-required-badge {
  font-size: 10px;
  font-weight: 600;
  color: theme.$status_red;
  text-transform: uppercase;
  margin-left: 4px;
}

.version-latest-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 2px;
  background: rgba(5, 150, 105, 0.12);
  color: #047857;
  white-space: nowrap;
  margin-left: 6px;
}

.version-outdated-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 2px;
  background: rgba(217, 119, 6, 0.12);
  color: #b45309;
  white-space: nowrap;
  margin-left: 6px;
}
</style>
