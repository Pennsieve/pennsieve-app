<script setup>
import { computed, h, ref, reactive, onMounted, onBeforeUnmount, nextTick, watch, provide } from "vue";

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
import LlmMark from "../WorkflowGraph/LlmMark.vue";
import RunWizardDialog from "../RunMonitor/RunWizardDialog.vue";
import RuntimeMark from "../WorkflowGraph/RuntimeMark.vue";
import GraphDensityToggle from "../WorkflowGraph/GraphDensityToggle.vue";
import { COMPACT_BOX, layoutBox, overlaps, recenter, useGraphDensity } from "../WorkflowGraph/graphDensity";
import {
  toParamSchema,
  validateAppConnection,
  validateStepInputs,
} from "../Applications/applicationSchema";
import { useAppManifest } from "@/composables/useAppManifest";
import BuilderBar from "./BuilderBar.vue";
import WorkflowExampleLink from "../Workflows/WorkflowExampleLink.vue";
import BuilderPalette from "./BuilderPalette.vue";
import ParamField from "./ParamField.vue";
import { ioLine, sessionTypeOf, versionManifest, shortMediaType, stepVariant } from "./appManifestInfo";
import {
  modelLine,
  modelLineText,
  nodesHaveGpus,
  switchableVariants,
  switchVariant,
  titleWithVariant,
  effectiveVariant,
  variantFallback,
  variantParamNote,
  variantSetParams,
  variantUnavailable,
} from "./appVariants";
import { domainOfTag, domainColors } from "../Applications/appDomains";
import { diffLines, manifestDiff, versionWarnings } from "./manifestDiff";
import { builderReadiness, readinessLabel } from "./builderReadiness";
import { stepNames } from "./stepNames";
import StepPicker from "./StepPicker.vue";
import LinkEdge from "./LinkEdge.vue";
import { sourceLabel, sourceHints, hintLine } from "../WorkflowGraph/sourceInputs";
import { canvasDefinition, toInterfaceDefinition } from "./builderInterface";
import { workflowLayouts } from "../RunMonitor/runLayout";
import IoPill from "../WorkflowGraph/IoPill.vue";
import { isFeatureEnabled } from "@/utils/features";
import { useGraphHistory, snapshot } from "./graphHistory";
import { workflowPermissions } from "./workflowPermissions";
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
import {
  routedInputs,
  inputHandleId,
  inputOfHandle,
  edgeId,
  linkAllowed,
  linksOf,
  edgesForStep,
  attachInputPorts,
  linkKeys,
  edgeLink,
  linkPorts,
} from "./inputPorts";
import { requiredUnset } from "./builderReadiness";
import { fitsAfter } from "./appManifestInfo";

const { onNodeClick, onPaneClick, onConnect, onConnectStart, onConnectEnd, onEdgeUpdate, screenToFlowCoordinate, fitView } =
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
const draggedVariant = ref(""); // a palette variant chip's id, else the default

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
  const manifestParams = versionManifest(node.data?.application, node.data?.tag, node.data?.variant)?.parameters;
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
  return versionManifest(node.data?.application, node.data?.tag, node.data?.variant);
});
const manifestsKnown = computed(() =>
  (availableApplications.value || []).some((a) => (a.versions || []).some((v) => v.manifest)),
);
const ioTypes = (port) => ioLine({ inputs: [port], outputs: [] }).replace(/ → .*$/, "");

/*
  The app step's panel: what the app is (its app.yml as the step loaded
  it), and where each input comes from and each output goes on the canvas.
*/
const stepAbout = computed(() => {
  const node = selectedNode.value;
  if (node?.type !== "default") return null;
  const about = node.data?.manifestAbout;
  const released = stepManifest.value;
  const version = (node.data?.application?.versions || []).find((v) => v.version === node.data?.tag);
  return {
    description: about?.description || released?.description || node.data?.application?.description || "",
    maintainers: about?.maintainers?.length ? about.maintainers : released?.maintainers || [],
    tags: about?.tags?.length ? about.tags : released?.tags || [],
    license: version?.license || "",
  };
});
const tagStyle = (tag) => {
  const c = domainColors(domainOfTag(tag));
  return { background: c.bg, color: c.ink, borderColor: c.line };
};
const nodeLabel = (id) => nodes.value.find((n) => n.id === id)?.data?.label || "a step";
// Where the step's inputs come from: the steps linked into it.
const stepSources = computed(() => {
  const node = selectedNode.value;
  if (!node) return [];
  return edges.value.filter((e) => e.target === node.id).map((e) => nodeLabel(e.source));
});
// Each output's links: by its port, or through "all outputs".
const stepPorts = computed(() => {
  const node = selectedNode.value;
  if (node?.type !== "default") return { inputs: [], outputs: [], routed: false, allTo: [] };
  const ports = node.data?.manifestPorts || stepManifest.value || { inputs: [], outputs: [] };
  const routed = routedOutputs(ports).length > 0;
  const out = edges.value.filter((e) => e.source === node.id);
  const portName = (e) => portOfHandle(e.sourceHandle);
  return {
    inputs: ports.inputs || [],
    outputs: (ports.outputs || []).map((p) => ({
      ...p,
      to: routed ? out.filter((e) => portName(e) === p.name).map((e) => nodeLabel(e.target)) : [],
    })),
    routed,
    allTo: out.filter((e) => !portName(e)).map((e) => nodeLabel(e.target)),
  };
});
const showAdvanced = ref(false);
// An app step's panel: Settings (what you set) or About (what the app is).
// Settings when the workflow can be edited, About when it can't.
const stepTab = ref("settings");
watch(
  () => selectedNode.value?.id,
  () => {
    stepTab.value = canEditConfig.value ? "settings" : "about";
  }
);

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
    manifestDiff(
      versionManifest(node.data.application, node.data.tag, node.data.variant),
      versionManifest(node.data.application, newerVersion.value, node.data.variant),
    ),
  );
});

const applyVersion = (node, tag) => {
  // A variant the version doesn't have: the version's default, and a word
  // that it is ("v0.2.2 has no GPU variant; using the default").
  const fallback = variantFallback(node.data.application, node.data.tag, tag, node.data.variant);
  node.data.tag = tag;
  if (!stepVariant(node.data.application, tag, node.data.variant)) delete node.data.variant;
  if (fallback) ElMessage({ type: "info", showClose: true, message: `${fallback}.` });
  const m = versionManifest(node.data.application, tag, node.data.variant);
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
  const d = manifestDiff(versionManifest(app, node.data.tag, node.data.variant), versionManifest(app, tag, node.data.variant));
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

/*
  A step's app variant (docs/app-variants.md, section 6): a switch beside the
  version when its version has two or more (a CPU and a GPU build). The
  compute type, cpu and memory and the parameters the step didn't set follow
  the variant (appVariants.switchVariant); values it set stay, with a note.
  Ports are the same for every variant; should they differ, the switch asks
  first, as a version change does. GPU variants are off where no compute
  node has GPUs. Apps without variants show none of this.
*/
const computeNodesHere = computed(() => store.getters["analysisModule/computeNodes"] || []);
const gpusHere = computed(() => nodesHaveGpus(computeNodesHere.value));
const stepVariants = computed(() => {
  const node = selectedNode.value;
  if (node?.type !== "default") return [];
  return switchableVariants(node.data?.application, node.data?.tag);
});
const stepVariantId = computed(() => {
  const node = selectedNode.value;
  return effectiveVariant(node?.data?.application, node?.data?.tag, node?.data?.variant)?.id || "";
});
const stepVariantInfo = computed(() => stepVariants.value.find((v) => v.id === stepVariantId.value) || null);
const variantOptionTitle = (v) =>
  [v.description, v.gpu && "Runs on a GPU", variantUnavailable(v, { gpus: gpusHere.value })].filter(Boolean).join("\n");
// Notes from the last switch: values the step set that differ from the new
// variant's default.
const variantNotes = ref([]);
watch(
  () => selectedNode.value?.id,
  () => (variantNotes.value = [])
);

const requestVariant = async (id) => {
  const node = selectedNode.value;
  if (!node || !id || id === stepVariantId.value) return;
  const app = node.data.application;
  const s = switchVariant(node.data, app, id);
  if (s.portLines.length) {
    try {
      await ElMessageBox.confirm(
        h("div", { class: "version-change" }, [h("ul", s.portLines.map((l) => h("li", l)))]),
        "This variant's inputs and outputs differ",
        { confirmButtonText: "Switch", cancelButtonText: "Keep current", type: "warning" },
      );
    } catch {
      return;
    }
  }
  if (s.variant) node.data.variant = s.variant;
  else delete node.data.variant;
  node.data.computeType = s.computeType;
  node.data.cpu = s.cpu;
  node.data.memory = s.memory;
  if (s.manifest) {
    node.data.paramSchema = toParamSchema(s.manifest.parameters || []);
    node.data.manifestPorts = { inputs: s.manifest.inputs || [], outputs: s.manifest.outputs || [] };
  }
  variantNotes.value = s.kept.map(
    (k) => `${k.label} stays ${k.value}, as you set it; this variant's default is ${k.variantDefault || "unset"}.`,
  );
  revalidateEdges();
};

// The parameters the step's variants set differently (DynaSD's Detector):
// shown first, under the variant switch, each with what every variant
// defaults it to; the rest under Parameters.
const variantParamNames = computed(() => {
  const node = selectedNode.value;
  if (node?.type !== "default") return [];
  return variantSetParams(node.data?.application, node.data?.tag);
});
const variantParams = computed(() =>
  variantParamNames.value.map((name) => selectedNodeParamSchema.value.find((p) => p.name === name)).filter(Boolean),
);
const otherParams = computed(() => selectedNodeParamSchema.value.filter((p) => !variantParamNames.value.includes(p.name)));
const variantParamNoteOf = (name) => {
  const node = selectedNode.value;
  return variantParamNote(node?.data?.application, node?.data?.tag, node?.data?.variant, name);
};
// The card's line of those values ("Detector: oncet"), or "".
const stepModelLine = (data) => modelLineText(modelLine(data?.application, data?.tag, data?.variant, data?.defaultParams));

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
  // A target moves results, so it never runs on a GPU.
  const noGpu = (list) => list.filter((t) => t !== "gpu");
  return noGpu(types && types.length ? types : DEFAULT_COMPUTE_TYPES);
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
  // A step of a variant: its runtime and parameter defaults are the
  // variant's (the version's resolved manifest for it), not app.yml's top
  // level. Inputs and outputs are the same for every variant.
  const variant = node.data.variant ? versionManifest(application, node.data.tag, node.data.variant) : null;
  const runtime = variant?.runtime || {};

  // computeType — first declared type that the builder actually supports.
  const declared = runtime.computeTypes?.length ? runtime.computeTypes : schema.runtime?.computeTypes || [];
  const supported = declared.find((t) => DEFAULT_COMPUTE_TYPES.includes(t));
  if (supported) node.data.computeType = supported;

  // cpu / memory — only when the manifest declares them and the node has none.
  const cpu = runtime.cpu || schema.resources?.cpu;
  const memory = runtime.memory || schema.resources?.memory;
  if (!node.data.cpu && cpu != null) {
    node.data.cpu = String(cpu);
  }
  if (!node.data.memory && memory != null) {
    node.data.memory = String(memory);
  }

  // Parameters — feeds both the parameter list and its editable defaults.
  const paramSchema = toParamSchema(variant?.parameters?.length ? variant.parameters : schema.parameters);
  if (paramSchema.length) node.data.paramSchema = paramSchema;

  setManifestPorts(node, parsed);
};

// Ports live on the node so connection checks stay synchronous.
const setManifestPorts = (node, parsed) => {
  node.data.manifestPorts = {
    inputs: parsed.schema.inputs || [],
    outputs: parsed.schema.outputs || [],
  };
  // What the step's panel says about the app, from the same app.yml.
  node.data.manifestAbout = {
    description: parsed.meta?.description || "",
    maintainers: parsed.meta?.maintainers || [],
    tags: parsed.schema?.tags || [],
  };
  node.data.hasManifest = true;
  // A reopened workflow's links into data targets leave from the output
  // ports their prefixes name, once the ports are known.
  edges.value = attachInputPorts(attachPorts(edges.value, nodes.value), nodes.value);
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
  applyPortPrefix(data);
};

// A target fed by an output port takes that output's folder, in the prefix
// parameter its type reads (PATH_PREFIX or pathPrefix). A type that takes
// no prefix can't take part of an output: the port's link is removed.
const applyPortPrefix = (data) => {
  // The settings panel's data may be the step's or a copy: find the step.
  const node = nodes.value.find((n) => n.data === data) || nodes.value.find((n) => n.id === selectedNode.value?.id);
  const edge = node && edges.value.find((e) => e.target === node.id && portOfHandle(e.sourceHandle));
  if (!edge) return;
  const port = portOfHandle(edge.sourceHandle);
  const key = prefixParamOf(getTargetTypeParams(data.targetType));
  node.data.defaultParams = withoutPortPrefix(node.data.defaultParams, port);
  if (key) {
    node.data.defaultParams = withPortPrefix(node.data.defaultParams, port, key);
    return;
  }
  dropEdges((e) => e.id === edge.id);
  revalidateEdges();
  ElMessage({ type: "info", showClose: true, message: `This kind of data target takes a step's whole output, so the link from the ${port} output was removed. Connect it from "all outputs" instead.` });
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
// The builder saves inputs and outputs (features.workflowInterface).
const interfaceOn = isFeatureEnabled("workflowInterface");
// Where a new output can go, to start with.
const DEFAULT_ACCEPTS = ["Pennsieve Dataset", "download"];

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

// The minimap, from this many steps: below it, fit-to-view does the job.
const MINIMAP_FROM = 15;
const minimapColor = (node) => {
  if (node.type === "data-source") return "#6366f1";
  if (node.type === "data-target") return "#64748b";
  return "#E0912A"; // the processor orange ($orange_2)
};

const nodeTypeColor = (type) => {
  if (type === "data-source") return "#6366f1";
  if (type === "data-target") return "#64748b";
  return "#cccccc";
};

const definitionToNodesAndEdges = (workflow, applications) => {
  // A workflow's inputs and outputs drawn as its source and target nodes.
  const raw = canvasDefinition(workflow).dag || [];
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
        // The app variant the step runs; none for the version's default.
        ...(p.variant && { variant: p.variant }),
        // An input's or output's own name and settings (its panel).
        ...(p.name && { name: p.name }),
        ...(p.input?.optional && { optional: true }),
        ...(p.output?.accepts?.length && { accepts: [...p.output.accepts] }),
        ...(p.output?.required && { required: true }),
      },
      position:
        hasSavedPositions && p.position
          ? { x: p.position.x, y: p.position.y }
          : { x: 0, y: 0 },
    };
  });

  // Build edges from the steps' links (inputs) and dependsOn
  const procMap = Object.fromEntries(processors.map((p) => [p.id, p]));
  const resultEdges = [];
  for (const p of processors) {
    resultEdges.push(
      ...edgesForStep(p, ({ source, target, data }) => ({
        id: data ? `e${source}:${data.output || ""}-${target}:${data.input}` : `e${source}-${target}`,
        source,
        target,
        // Named, so a step with ports draws it from its main points;
        // attachPorts and attachInputPorts move it to its ports once the
        // manifests are in. A link keeps its input and output until then.
        sourceHandle: "source",
        targetHandle: "target",
        ...(data && { data }),
        animated: false,
        style: { stroke: nodeTypeColor(procMap[source]?.type) },
      }))
    );
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

// What the user may do with the selected workflow: workflow-service's
// permissions (its creator, the workspace's admins, super-admins on public
// ones), or the creator check when the server doesn't send them.
const permissions = computed(() =>
  workflowPermissions(selectedWorkflow.value, { profile: profile.value, isSuperAdmin: isSuperAdmin.value }),
);
const canEditWorkflow = computed(() => permissions.value.canEdit);

// Who may remove the workflow's example: who may edit it, as the workflow
// says (permissions.canEdit), else its creator.
const canEditExample = computed(() => canEditWorkflow.value);

// Steps' settings are editable while building (create) or editing (edit).
const canEditConfig = computed(() => mode.value !== "browse");

const isPublicWorkflow = computed(
  () => selectedWorkflow.value?.visibility === "public",
);

// Publish / unpublish as workflow-service allows (permissions).
const canPublish = computed(
  () => !isPublicWorkflow.value && permissions.value.canPublish,
);
const canUnpublish = computed(
  () => isPublicWorkflow.value && permissions.value.canUnpublish,
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
  markLayoutSaved();
  history.reset();
};

/*
  Layout of a saved workflow: its owner can move steps, inputs and outputs
  (or Tidy up) while viewing it, and save where they are, in place on the
  latest version: positions never change what runs, so no new version.
*/
const layoutOf = () =>
  Object.fromEntries(
    nodes.value.map((n) => {
      const p = positionToSave(n);
      return [n.id, { x: Math.round(p.x), y: Math.round(p.y) }];
    })
  );
const savedLayout = ref({});
const markLayoutSaved = () => {
  savedLayout.value = layoutOf();
};
const canSaveLayout = computed(() => mode.value === "browse" && canEditWorkflow.value && !viewingVersion.value);
const layoutChanged = computed(() => {
  if (!canSaveLayout.value) return false;
  const saved = savedLayout.value;
  return nodes.value.some((n) => {
    const p = positionToSave(n);
    const was = saved[n.id];
    return !was || Math.abs(Math.round(p.x) - was.x) > 0 || Math.abs(Math.round(p.y) - was.y) > 0;
  });
});
const savingLayout = ref(false);
const saveLayout = async () => {
  const wf = selectedWorkflow.value;
  if (!wf?.uuid || !layoutChanged.value) return;
  savingLayout.value = true;
  try {
    const positions = layoutOf();
    await store.dispatch("analysisModule/updateWorkflow", { uuid: wf.uuid, payload: { positions } });
    // Its runs are drawn with this layout: read it again there.
    workflowLayouts.forget(wf.uuid);
    markLayoutSaved();
    EventBus.$emit("toast", { detail: { type: "success", msg: "Layout saved." } });
  } catch (err) {
    console.error(err);
    EventBus.$emit("toast", { detail: { type: "error", msg: "Could not save the layout." } });
  } finally {
    savingLayout.value = false;
  }
};
const undoMoves = () => {
  const saved = savedLayout.value;
  const back = detailed.value ? (p) => p : (p) => recenter([{ position: p }], DETAILED_BOX, COMPACT_BOX)[0].position;
  nodes.value = nodes.value.map((n) => (saved[n.id] ? { ...n, position: back({ ...saved[n.id] }) } : n));
};

/*
Helpers
*/

const generateNodeId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

const dragOffset = ref({ x: 0, y: 0 });

const onDragStart = (item, event, type = "application", variant = "") => {
  if (isReadOnly.value) return;
  draggedType.value = type;
  draggedApp.value = type === "application" ? item : null;
  draggedVariant.value = type === "application" ? variant || "" : "";

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
  if (type !== "default" || draggedApp.value) addNode(type, draggedApp.value, position, draggedVariant.value);

  draggedApp.value = null;
  draggedVariant.value = "";
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
// Whether a step's app calls language models through Pennsieve: its version's
// app.yml declares runtime.llm (LLM access is opt-in). Shown as an icon.
const usesLLM = (data) => !!versionManifest(data?.application, data?.tag, data?.variant)?.runtime?.llm;
// variant: the app variant to run (a palette chip's id); none, or the
// default, runs the version's default.
const makeNode = (type, app, position, variant = "") => {
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
        // A new output can go to a dataset or a download unless the author
        // says otherwise (those the registry has).
        ...(interfaceOn && {
          accepts: DEFAULT_ACCEPTS.filter((t) => targetTypes.value.some((tt) => tt.targetType === t)),
        }),
      },
      position,
    };
  }
  const tag = latestVersion(app)?.version || "";
  const chosen = stepVariant(app, tag, variant);
  // Where it runs, until its app.yml is read (applyManifestDefaults): a GPU
  // variant on a GPU from the start.
  const runsOn = (versionManifest(app, tag, chosen)?.runtime?.computeTypes || []).find((t) => DEFAULT_COMPUTE_TYPES.includes(t));
  return {
    id,
    type: "default",
    data: {
      label: appDisplayName(app),
      application: app,
      // A notebook kernel: a human-in-the-loop step, run as a live session.
      ...(sessionTypeOf(app) && { interactive: true, sessionType: sessionTypeOf(app) }),
      computeType: (chosen && runsOn) || "standard",
      cpu: "",
      memory: "",
      defaultParams: {},
      paramSchema: [],
      hasManifest: false,
      tag,
      ...(chosen && { variant: chosen }),
    },
    position,
  };
};

const addNode = (type, app, position, variant = "") => {
  const node = makeNode(type, app, position, variant);
  nodes.value.push(node);
  // Fire-and-forget: patches the node in place once app.yml is read.
  if (app) applyManifestDefaults(node.id, app);
  return node;
};

// Connects two steps, with the same checks and feedback as dragging a
// connection between them.
const LINK_REFUSED = {
  "input-taken": (input) => `The ${input} input already has a link. Remove it first.`,
  "unknown-input": (input) => `This step has no ${input} input.`,
  "port-to-all": () => "Connect an output to one of the step's inputs.",
  mixed: () => "These steps are already linked the other way: link them all to inputs, or all to the step's top point.",
  duplicate: () => "These points are already linked.",
};

const connectNodes = (sourceId, targetId, sourceHandle, targetHandle) => {
  const src = nodes.value.find((n) => n.id === sourceId);
  const tgt = nodes.value.find((n) => n.id === targetId);
  if (!canConnect(src, tgt, edges.value)) return false;
  const port = portOfHandle(sourceHandle);
  const input = inputOfHandle(targetHandle);
  if (tgt.type === "default") {
    const verdict = linkAllowed(src, tgt, sourceHandle, targetHandle, edges.value);
    if (!verdict.ok) {
      ElMessage({ type: "info", showClose: true, message: LINK_REFUSED[verdict.reason]?.(input) || "These points can't be linked." });
      return false;
    }
  }
  if (port) {
    // An output port routes one output to one data target, or to an app.
    if (!canConnectFromHandle(src, tgt, sourceHandle)) {
      ElMessage({ type: "info", showClose: true, message: `The ${port} output connects to a data target or to another app's input.` });
      return false;
    }
  }
  if (port && tgt.type === "data-target") {
    if (edges.value.some((e) => e.target === targetId)) {
      ElMessage({ type: "info", showClose: true, message: "A data target fed by an output takes that one link. Remove its other link first." });
      return false;
    }
    // No type picked yet: the prefix is set when it is (onTargetTypeChange).
    if (tgt.data.targetType && !prefixParamOf(getTargetTypeParams(tgt.data.targetType))) {
      ElMessage({ type: "info", showClose: true, message: "This kind of data target takes a step's whole output, not one output. Connect it from the step's main connection point." });
      return false;
    }
  }
  const handles = { sourceHandle: port ? sourceHandle : "source", targetHandle: input ? targetHandle : "target" };
  edges.value.push({
    id: edgeId(sourceId, targetId, handles.sourceHandle, handles.targetHandle),
    source: sourceId,
    target: targetId,
    ...handles,
    animated: false,
    style: { stroke: nodeTypeColor(src.type) },
  });
  // A data target takes only this output's folder: OUTPUT_DIR/<port>/.
  if (port && tgt.type === "data-target" && tgt.data.targetType) tgt.data.defaultParams = withPortPrefix(tgt.data.defaultParams, port, prefixParamOf(getTargetTypeParams(tgt.data.targetType)));
  reportConnectionCheck(src, tgt, edges.value[edges.value.length - 1]);
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
const addStep = (type, app, afterId = selectedNode.value?.id, variant = "") => {
  if (isReadOnly.value) return null;
  const after = nodes.value.find((n) => n.id === afterId) ||
    [...nodes.value].filter((n) => n.type !== "data-target").sort((a, b) => b.position.y - a.position.y)[0];
  const gap = layoutBox(detailed.value, DETAILED_BOX);
  const position = after
    ? { x: after.position.x, y: after.position.y + gap.height + gap.ranksep }
    : { x: 0, y: 0 };
  const node = addNode(type, app, position, variant);
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
// A link's label names types as the port chips do (CSV, not text/csv), so
// labels on links into neighbouring inputs fit side by side.
const shortTypes = (mediaTypes) => [...new Set(mediaTypes.map(shortMediaType))].join(", ");

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
  connectNodes(params.source, params.target, params.sourceHandle, params.targetHandle);
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

  // A link to a named input: this output (or all of them) against that input.
  const joined = linkPorts(edgeLink(edge, tgt, edges.value), source, target);
  if (joined) {
    const link = validateAppConnection({ outputs: joined.outputs }, { inputs: [joined.input] });
    if (!link.checked) return { state: "unchecked", src, tgt };
    return link.compatible
      ? { state: "ok", src, tgt, metInputs: link.metInputs }
      : { state: "invalid", src, tgt, reason: link.reason, unmetInputs: link.unmetInputs };
  }

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
// app or with links to inputs (with one plain link, the link itself says
// so). An input with a link is provided; the others are judged against the
// steps linked to "all inputs".
const linkedInputNames = (n) =>
  new Set(edges.value.filter((e) => e.target === n.id).map((e) => edgeLink(e, n, edges.value)?.input).filter(Boolean));
const stepInputIssues = () =>
  nodes.value
    .filter((n) => isAppNode(n) && n.data?.manifestPorts && (upstreamApps(n.id).length > 1 || linkedInputNames(n).size))
    .map((n) => {
      const linked = linkedInputNames(n);
      const plainSources = edges.value
        .filter((e) => e.target === n.id && !edgeLink(e, n, edges.value))
        .map((e) => nodes.value.find((x) => x.id === e.source))
        .filter((x) => isAppNode(x) && x.data?.manifestPorts);
      const { checked, unmetRequired } = validateStepInputs(
        plainSources.map((u) => u.data.manifestPorts),
        { ...n.data.manifestPorts, inputs: (n.data.manifestPorts.inputs || []).filter((p) => !linked.has(p.name)) },
      );
      return checked && unmetRequired.length
        ? {
            id: `step:${n.id}`,
            targetId: n.id,
            target: nodeName(n),
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
// A link's label in a box (detailed view).
const labelBox = (fill, border, text) => ({
  labelShowBg: true,
  labelBgPadding: [6, 3],
  labelBgBorderRadius: 2,
  labelBgStyle: { fill, stroke: border },
  labelStyle: { fill: text, fontSize: 11, fontWeight: 600 },
});

// The compact view's lone ✓ or ✕: no box, just a halo in the canvas colour so
// the line doesn't run through it.
const bareMark = (color) => ({
  labelShowBg: false,
  labelStyle: {
    fill: color,
    fontSize: 16,
    fontWeight: 700,
    stroke: "#f7f7f7",
    strokeWidth: 4,
    paintOrder: "stroke",
  },
});

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
      const link = edgeLink(edge, result.tgt, edges.value);
      issues.push({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        source: nodeName(result.src),
        target: nodeName(result.tgt),
        reason: result.reason,
        mediaTypes,
        needs: shortTypes(mediaTypes),
        ...(link && { output: link.output || "", input: link.input }),
      });
      return {
        ...next,
        style: {
          stroke: INVALID_EDGE_COLOR,
          strokeWidth: 2,
          strokeDasharray: "6 4",
        },
        // Compact: the verdict only (the issues list has the detail).
        label: !detailed.value
          ? "\u2715"
          : result.reason === "no-overlap"
            ? "\u26A0 media type mismatch"
            : mediaTypes.length
              ? `\u26A0 needs ${shortTypes(mediaTypes)}`
              : "\u26A0 incompatible",
        ...(detailed.value
          ? labelBox("#fdecec", INVALID_EDGE_COLOR, INVALID_EDGE_COLOR)
          : bareMark(INVALID_EDGE_COLOR)),
      };
    }

    if (result.state === "unchecked") {
      unchecked += 1;
      return { ...next, style: { stroke, strokeDasharray: "2 4" } };
    }

    // Input data into an app, or an app into a target: nothing to check,
    // but say what flows there, in grey.
    const flows = detailed.value ? flowTypes(edge) : "";
    if (result.state === "skip" && flows) {
      return {
        ...next,
        label: flows,
        ...labelBox("#f3f4f6", "#d1d5db", "#4b5563"),
      };
    }

    if (result.state === "ok") {
      validated += 1;
      const mediaTypes = portMediaTypes(result.metInputs);
      return {
        ...next,
        // The usual weight: a link that fits needs no attention; the ✓ says
        // it. A link that doesn't fit stays heavier (dashed, red).
        style: { stroke: VALID_EDGE_COLOR },
        label: mediaTypes.length && detailed.value ? `\u2713 ${shortTypes(mediaTypes)}` : "\u2713",
        ...(detailed.value
          ? labelBox("#eaf9ef", VALID_EDGE_COLOR, "#0f7a3f")
          : bareMark("#0f7a3f")),
      };
    }

    return next;
  });

  edgeIssues.value = [...issues, ...stepInputIssues()];
  validEdgeCount.value = validated;
  uncheckedEdgeCount.value = unchecked;
};

// What flows over a link that isn't checked: into an app, the types its
// linked input takes (all its inputs' on "all inputs"); into a target, the
// types of the output feeding it (all outputs' from "all outputs"). "" when
// the app.yml says nothing about them.
const flowTypes = (edge) => {
  const src = nodes.value.find((n) => n.id === edge.source);
  const tgt = nodes.value.find((n) => n.id === edge.target);
  let ports = [];
  if (src?.type === "data-source" && isAppNode(tgt)) {
    const inputs = tgt.data?.manifestPorts?.inputs || [];
    const link = edgeLink(edge, tgt, edges.value);
    ports = link ? inputs.filter((p) => p.name === link.input) : inputs;
  } else if (isAppNode(src) && tgt?.type === "data-target") {
    const outputs = src.data?.manifestPorts?.outputs || [];
    const port = portOfHandle(edge.sourceHandle);
    ports = port ? outputs.filter((p) => p.name === port) : outputs;
  } else {
    return "";
  }
  const layouts = ports.flatMap((p) => [].concat(p.conformsTo || []).slice(-1)).map((c) => String(c).split("@")[0].toUpperCase());
  const types = ports.flatMap((p) => p.mediaTypes || []);
  return [...new Set([...layouts, ...types.map(shortMediaType)])].join(", ");
};

const reportConnectionCheck = (srcNode, tgtNode, edge) => {
  const source = srcNode?.data?.manifestPorts;
  const target = tgtNode?.data?.manifestPorts;
  if (!source || !target) return;

  // A link to a named input: that output (or any of them) against that input.
  const joined = edge && linkPorts(edgeLink(edge, tgtNode, edges.value), source, target);
  if (joined) {
    const link = validateAppConnection({ outputs: joined.outputs }, { inputs: [joined.input] });
    if (!link.checked || link.compatible) return;
    const accepts = portMediaTypes([joined.input]).join(", ");
    ElMessage({
      type: "warning",
      duration: 6000,
      showClose: true,
      message:
        `${joined.outputs.length === 1 ? `The ${joined.outputs[0].name} output of ${srcNode.data.label} doesn't` : `No output of ${srcNode.data.label}`} ` +
        `match the ${joined.input.name} input of ${tgtNode.data.label}${accepts ? ` (accepts ${accepts})` : ""}. ` +
        "The connection was made — check it before running.",
    });
    return;
  }

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

// A step's one-line summary: version, CPU and memory ("v1.3.6 · 1 vCPU ·
// 2 GB"). Where it runs, when not the default, is a mark (RuntimeMark).
const stepMeta = (data) => {
  const version = data.tag || latestVersion(data.application)?.version || "";
  const cpu = data.computeType !== "lambda" && data.cpu ? `${+(Number(data.cpu) / 1024).toFixed(2)} vCPU` : "";
  const memory = data.memory ? formatResourceLabel(data.memory) : "";
  return [version, cpu, memory].filter(Boolean).join(" · ");
};
// The folded resources line: "1 vCPU · 2 GB · Standard".
const resourcesSummary = (data) => {
  const cpu = data?.computeType !== "lambda" && data?.cpu ? `${+(Number(data.cpu) / 1024).toFixed(2)} vCPU` : "";
  const memory = data?.memory ? formatResourceLabel(data.memory) : "";
  const where = data?.computeType ? computeTypeName(data.computeType) : "";
  return [cpu, memory, where].filter(Boolean).join(" · ");
};
const computeTypeName = (t) => ({ gpu: "GPU", lambda: "Lambda" })[t] || t.charAt(0).toUpperCase() + t.slice(1);

// Where output port i of n sits on the step's bottom edge: the middle of
// its column. The detailed card has 11px of padding and border each side;
// the compact one spreads them evenly. !important beats the connectors'
// own left: 50%.
const portHandleLeft = (i, n) =>
  detailed.value
    ? `calc(11px + (100% - 22px) * ${(i + 0.5) / n}) !important`
    : `${((i + 1) * 100) / (n + 1)}% !important`;

// The output port feeding a node, or "" when none does.
const feedingPort = (nodeId) => portOfHandle(edges.value.find((e) => e.target === nodeId && e.sourceHandle)?.sourceHandle);

// Removes the edges that match, and the path prefix an output port's link
// set on its data target.
const dropEdges = (matches) => {
  edges.value.filter(matches).forEach((e) => {
    const port = portOfHandle(e.sourceHandle);
    const tgt = port && nodes.value.find((n) => n.id === e.target && n.type === "data-target");
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
  // Labels say more in detail: the types; compact shows only ✓ or ✕.
  revalidateEdges();
  if (value && overlaps(nodes.value, to)) autoLayout();
  else setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 50);
};

// An input or output is a pill, smaller than a step's card: laid out at its
// own size, so the gaps around it are the steps' gaps.
const PILL_BOX = { width: 200, height: 44 };
const layoutSizeOf = (node, box) =>
  node.type === "data-source" || node.type === "data-target" ? PILL_BOX : box;

const autoLayout = () => {
  if (nodes.value.length === 0) return;
  const box = layoutBox(detailed.value, DETAILED_BOX);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: box.nodesep, ranksep: box.ranksep });

  for (const node of nodes.value) {
    const size = layoutSizeOf(node, box);
    g.setNode(node.id, { width: size.width, height: size.height });
  }
  for (const edge of edges.value) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  nodes.value = nodes.value.map((node) => {
    const pos = g.node(node.id);
    const size = layoutSizeOf(node, box);
    return {
      ...node,
      position: {
        x: pos.x - size.width / 2,
        y: pos.y - size.height / 2,
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
    nameOf: nodeName,
  }),
);
const saving = ref(false);

// A readiness item was clicked: show its step.
const panelTitleRef = ref(null);
const onReadinessSelect = (item) => {
  // The name: its field at the top of the panel.
  if (item.id === "name") {
    panelTitleRef.value?.focus();
    return;
  }
  // A link: select it, and show the two steps it joins.
  const edge = item.edgeId && edges.value.find((e) => e.id === item.edgeId);
  if (edge) {
    nodes.value.forEach((n) => (n.selected = false));
    edges.value.forEach((e) => (e.selected = e.id === edge.id));
    selectedNode.value = null;
    setTimeout(() => fitView({ nodes: [edge.source, edge.target], padding: 0.4, maxZoom: 1.2, duration: 300 }), 50);
    return;
  }
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
// A link's × (LinkEdge) removes it.
const removeLink = (id) => {
  if (isReadOnly.value) return;
  dropEdges((e) => e.id === id);
  revalidateEdges();
};
provide("removeLink", removeLink);
provide("linksEditable", () => !isReadOnly.value);

// Dragging an end of a link to another point moves it: the new link is
// checked as one drawn there, and the old one stays if it's refused.
onEdgeUpdate(({ edge, connection }) => {
  if (isReadOnly.value) return;
  const old = edges.value.find((e) => e.id === edge.id);
  if (!old) return;
  dropEdges((e) => e.id === edge.id);
  const moved = connectNodes(connection.source, connection.target, connection.sourceHandle, connection.targetHandle);
  if (!moved) {
    edges.value.push(old);
    // An output port's link to a data target set its prefix: set it again.
    const port = portOfHandle(old.sourceHandle);
    const tgt = port && nodes.value.find((n) => n.id === old.target && n.type === "data-target");
    if (tgt?.data.targetType) tgt.data.defaultParams = withPortPrefix(tgt.data.defaultParams, port, prefixParamOf(getTargetTypeParams(tgt.data.targetType)));
    revalidateEdges();
  }
});

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

  const workflowData = {
    name: workflowName.value,
    description: workflowDescription.value,
    ...definitionPayload(),
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

// What saving sends for the canvas: its inputs, outputs and steps where
// workflow-service takes a workflow's interface (and the canvas can be one),
// else its processors, source and target nodes included.
const definitionPayload = () => {
  const processors = serializeProcessors();
  if (!isFeatureEnabled("workflowInterface")) return { processors };
  const byId = new Map(nodes.value.map((n) => [n.id, n]));
  const iface = toInterfaceDefinition(processors, {
    nameOf: (id) => nodeName(byId.get(id)),
    routedPortsOf: (id) => routedOutputs(byId.get(id)?.data?.manifestPorts).map((p) => p.name),
    extrasOf: (id) => {
      const d = byId.get(id)?.data || {};
      return { optional: !!d.optional, accepts: d.accepts || [], required: !!d.required };
    },
  });
  return iface || { processors };
};

// The canvas as workflow-service takes it: one processor per node, with
// what it depends on from the incoming edges.
const serializeProcessors = () => {
  return nodes.value.map((node) => {
    // Build dependsOn from incoming edges (edges whose target is this node),
    // each step once: two links can join the same steps
    const dependsOn = [...new Set(edges.value.filter((e) => e.target === node.id).map((e) => e.source))];

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
    // Which input each link feeds, and from which output (ports)
    const inputs = linksOf(node, edges.value);
    if (inputs.length) proc.inputs = inputs;
    // The app variant, when not the version's default (empty: the default).
    if (node.data.variant) proc.variant = node.data.variant;
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
  A saved workflow: read-only, with Edit for those who may edit it (its
  creator, the workspace's admins, super-admins on public ones) and
  Duplicate to edit for everyone else. Saving an edit is a new version of it (workflow-service
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
  if (!canEditWorkflow.value || viewingVersion.value) return;
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
  const dag = canvasDefinition(selectedWorkflow.value || {}).dag || [];
  const ids = (list) => list.map((x) => x).sort().join(",");
  return (
    ids(dag.map((p) => p.id)) === ids(nodes.value.map((n) => n.id)) &&
    ids(linkKeys(dag)) === ids(linkKeys(serializeProcessors()))
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
        ...definitionPayload(),
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
  workflowLayouts.forget(wf.uuid);
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

// The run dialog, here, on this workflow.
const runDialog = ref(null);
const runThis = () => runDialog.value?.open(selectedWorkflow.value?.uuid);

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

const readDraft = () => {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY.value) || "null");
    return draft?.nodes?.length ? draft : null;
  } catch {
    return null;
  }
};

const applyDraft = (draft) => {
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
  The builder's landing: what opening it offers before anything is built
  (a new workflow from scratch, the draft kept in this browser, one from the
  Library, or one of the user's own), so it doesn't open on a list of what
  an empty workflow lacks. Readiness shows once building has started.
*/
const landing = ref(false);
const landingDraft = ref(null);
const started = computed(
  () => mode.value !== "create" || (!landing.value && (!!workflowName.value.trim() || nodes.value.length > 1 || edges.value.length > 0))
);
const myWorkflows = computed(() => {
  const me = store.state.profile?.id;
  return (store.state.analysisModule.workflows || [])
    .filter((w) => w.createdBy === me && w.isActive !== false)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .slice(0, 5);
});
const draftAge = (draft) => {
  const mins = Math.round((Date.now() - (draft?.savedAt || Date.now())) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};
const startFromScratch = () => {
  clearDraft();
  landing.value = false;
};
const resumeDraft = () => {
  applyDraft(landingDraft.value);
  landing.value = false;
};
// Adding a step (an app clicked or dragged in) starts too.
watch(
  () => nodes.value.length,
  (n) => {
    if (landing.value && n > 1) landing.value = false;
  }
);

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
        if (route.query.edit === "1" && canEditWorkflow.value) startEdit();
      }
    } else {
      enterCreateMode();
      landingDraft.value = readDraft();
      landing.value = true;
      if (!(store.state.analysisModule.workflows || []).length) {
        store.dispatch("analysisModule/fetchWorkflows").catch(() => {});
      }
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

onPaneClick(() => deselectStep());

// Back to the workflow: no step selected.
function deselectStep() {
  nodes.value.forEach((n) => (n.selected = false));
  selectedNode.value = null;
}

// Input data is named after the app inputs it's linked to ("signals"), as
// on the run dialogs and a run's page (sourceInputs.js); other steps by
// their label.
const linkedSteps = computed(() =>
  nodes.value.filter((n) => n.type === "default").map((n) => ({ id: n.id, inputs: linksOf(n, edges.value) }))
);
// A step's own name: input data after the inputs it feeds, an output after
// what it is, an app by its label.
const baseName = (n) => {
  if ((n?.type === "data-source" || n?.type === "data-target") && n.data?.name) return n.data.name;
  if (n?.type === "data-source") return sourceLabel(n.id, linkedSteps.value);
  if (n?.type === "data-target") return n.data?.targetType ? getTargetTypeLabel(n.data.targetType) : "Output";
  // An app with variants: "<app> · <variant>" (the step can't be renamed).
  if (n?.type === "default") return titleWithVariant(n.data?.label || "", n.data?.application, n.data?.tag, n.data?.variant);
  return n?.data?.label || "";
};
// Names that tell steps apart, numbered when two share one (stepNames.js),
// on the canvas and in the panel alike.
const stepNameMap = computed(() => stepNames(stepListNodes.value, baseName));
const nodeName = (n) => (n ? stepNameMap.value.get(n.id) || baseName(n) : "");
const sourceFeeds = (id) =>
  hintLine(sourceHints(id, linkedSteps.value, (stepId) => nodes.value.find((n) => n.id === stepId)?.data?.manifestPorts));

// The workflow's steps, top to bottom as on the canvas, for the panel's list.
const stepListNodes = computed(() =>
  [...nodes.value].sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0))
);
// What a step's row says beside its name: what input data feeds, what feeds
// an output (and which of its outputs), an app's version.
const stepListMeta = (n) => {
  const byId = (id) => nodes.value.find((x) => x.id === id);
  if (n.type === "data-source") {
    const fed = edges.value.filter((e) => e.source === n.id).map((e) => nodeName(byId(e.target)));
    return fed.length ? `→ ${[...new Set(fed)].join(", ")}` : "not connected";
  }
  if (n.type === "data-target") {
    const from = edges.value.filter((e) => e.target === n.id)
      .map((e) => [nodeName(byId(e.source)), portOfHandle(e.sourceHandle)].filter(Boolean).join(" · "));
    return from.length ? `← ${from.join(", ")}` : "not connected";
  }
  return n.data?.tag || latestVersion(n.data?.application)?.version || "";
};
const stepKind = (n) => (n.type === "data-source" ? "source" : n.type === "data-target" ? "target" : "app");

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
          :started="started"
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
        <!-- The example PDF (a run's summary) of the version shown -->
        <WorkflowExampleLink
          v-if="selectedWorkflow?.uuid"
          :uuid="selectedWorkflow.uuid"
          :version="viewingVersion"
          :workflow-name="selectedWorkflow.name || ''"
          variant="icon"
        />
        <bf-button v-if="!viewingVersion && selectedWorkflow?.isActive !== false" class="secondary" @click="runThis">
          ▶ Run
        </bf-button>
        <el-tooltip
          v-if="canEditWorkflow"
          :disabled="!viewingVersion"
          content="Edit works on the latest version; duplicate this one to change it."
          placement="bottom"
        >
          <span>
            <bf-button :disabled="!!viewingVersion" @click="startEdit">Edit</bf-button>
          </span>
        </el-tooltip>
        <bf-button v-else :processing="duplicating" @click="duplicate">Duplicate to edit</bf-button>
        <bf-button v-if="canEditWorkflow && viewingVersion" class="secondary" :processing="duplicating" @click="duplicate">
          Duplicate this version
        </bf-button>
      </div>
    </div>

    <div class="builder-content">
      <!-- Left: what can be added (create and edit) -->
      <button
        v-if="!isReadOnly && !panels.palette && !landing"
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
        v-if="!isReadOnly && panels.palette && !landing"
        :applications="availableApplications"
        :app-name="appDisplayName"
        :step-ports="selectedNode?.type === 'default' ? selectedNode.data?.manifestPorts || null : null"
        :step-label="nodeName(selectedNode)"
        :loading="isLoading"
        @add="(type, app, variant) => addStep(type, app, undefined, variant)"
        @dragstart="(app, event, type, variant) => onDragStart(app, event, type, variant)"
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
              :edges-updatable="!isReadOnly"
            >
              <!-- Links: a × to remove one, on hover or when selected -->
              <template #edge-default="edgeProps">
                <LinkEdge v-bind="edgeProps" />
              </template>
              <Background pattern-color="#aaa" :gap="16" />
              <Controls position="bottom-right" />
              <!-- Only for big workflows: steps in their kinds' colours, the
                   view as an outlined window -->
              <MiniMap
                v-if="nodes.length >= MINIMAP_FROM"
                position="bottom-left"
                pannable
                zoomable
                :width="160"
                :height="110"
                :node-color="minimapColor"
                :node-border-radius="2"
                mask-color="rgba(241, 245, 249, 0.6)"
                mask-stroke-color="#475569"
                :mask-stroke-width="2"
              />

              <div v-if="!landing" class="canvas-toolbar">
                <GraphDensityToggle
                  v-if="nodes.length > 0"
                  :detailed="detailed"
                  @update:detailed="changeDensity"
                />
                <button
                  v-if="nodes.length > 0"
                  class="auto-layout-btn"
                  title="Arrange the steps, inputs and outputs automatically"
                  @click="autoLayout"
                >
                  Tidy up
                </button>
                <!-- A saved workflow's owner, having moved things: keep them there -->
                <template v-if="layoutChanged">
                  <button class="auto-layout-btn is-primary" :disabled="savingLayout" title="Keep the steps where they are now (no new version)" @click="saveLayout">
                    {{ savingLayout ? "Saving…" : "Save layout" }}
                  </button>
                  <button class="auto-layout-btn" title="Put them back where they were saved" @click="undoMoves">Undo moves</button>
                </template>
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

              <!-- Landing: how to start, before anything is built -->
              <div v-if="landing && mode === 'create'" class="builder-landing">
                <h3 class="builder-landing__title">Build a workflow</h3>
                <div class="builder-landing__options">
                  <button v-if="landingDraft" type="button" class="builder-landing__option is-primary" @click="resumeDraft">
                    <span class="builder-landing__name">Resume your draft{{ landingDraft.name ? `: ${landingDraft.name}` : "" }}</span>
                    <span class="builder-landing__desc">{{ Math.max(0, (landingDraft.nodes?.length || 1) - 1) }} step{{ (landingDraft.nodes?.length || 1) - 1 === 1 ? "" : "s" }}, kept in this browser {{ draftAge(landingDraft) }}</span>
                  </button>
                  <button type="button" class="builder-landing__option" :class="{ 'is-primary': !landingDraft }" @click="startFromScratch">
                    <span class="builder-landing__name">Start from scratch</span>
                    <span class="builder-landing__desc">An input, then the apps you add{{ landingDraft ? "; the draft is discarded" : "" }}</span>
                  </button>
                  <router-link :to="workflowsRoute" class="builder-landing__option">
                    <span class="builder-landing__name">Start from a workflow in the Library</span>
                    <span class="builder-landing__desc">Open one, then duplicate it to make it yours</span>
                  </router-link>
                </div>
                <template v-if="myWorkflows.length">
                  <h4 class="builder-landing__sub">Or edit one of yours</h4>
                  <ul class="builder-landing__list">
                    <li v-for="w in myWorkflows" :key="w.uuid">
                      <router-link :to="workflowPage(w.uuid)" class="builder-landing__item">{{ w.name }}</router-link>
                    </li>
                  </ul>
                </template>
              </div>

              <!-- The first step: a hint while only the input is there. -->
              <div v-if="!isReadOnly && !landing && nodes.length === 1 && nodes[0].type === 'data-source'" class="first-step-hint">
                Add the first step with the <strong>+</strong> under Input data, or click an app in the list.
                Or start from a workflow in the
                <router-link :to="workflowsRoute" class="first-step-link">Library</router-link>
                and duplicate it.
              </div>

              <template #node-default="{ data, id }">
                <!-- Two or more inputs: one connection point each, on the top
                     edge over its column, and the step's main point (all
                     inputs, each source whole at the root) last. -->
                <Handle
                  v-for="(p, i) in routedInputs(data.manifestPorts)"
                  :key="`in:${p.name}`"
                  :id="inputHandleId(p.name)"
                  type="target"
                  :position="Position.Top"
                  :title="`${p.name}: link an output or a step to this input`"
                  :style="{ left: portHandleLeft(i, routedInputs(data.manifestPorts).length + 1) }"
                />
                <Handle
                  id="target"
                  type="target"
                  :position="Position.Top"
                  :title="routedInputs(data.manifestPorts).length ? 'All inputs: each step linked here is given whole, at the root of the input folder' : undefined"
                  :style="routedInputs(data.manifestPorts).length ? { left: portHandleLeft(routedInputs(data.manifestPorts).length, routedInputs(data.manifestPorts).length + 1) } : undefined"
                />
                <CompactFlowNode
                  v-if="!detailed"
                  kind="processor"
                  :label="nodeName({ id, type: 'default', data })"
                  :runtime="data.interactive ? 'interactive' : data.computeType"
                  :class="connectClass(id)"
                >
                    <LlmMark v-if="usesLLM(data)" compact />
                    <span v-if="stepWarning(id)" class="step-warn" :title="stepWarning(id)" />
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
                  class="custom-node processor-node"
                  :class="connectClass(id)"
                  :style="{
                    // Room for each port's column (about 90px), up to the card's max.
                    ...((routedOutputs(data.manifestPorts).length || routedInputs(data.manifestPorts).length) && {
                      minWidth: `${Math.min(350, 90 * (Math.max(routedOutputs(data.manifestPorts).length, routedInputs(data.manifestPorts).length) + 1) + 30)}px`,
                    }),
                  }"
                >
                  <div
                    v-if="data.manifestPorts?.inputs?.length"
                    class="node-ports node-ports--in"
                    :class="{ 'node-ports--routed': routedInputs(data.manifestPorts).length }"
                    :style="routedInputs(data.manifestPorts).length ? { gridTemplateColumns: `repeat(${routedInputs(data.manifestPorts).length + 1}, minmax(0, 1fr))` } : undefined"
                  >
                    <span
                      v-for="p in data.manifestPorts.inputs"
                      :key="p.name"
                      class="node-port"
                      :class="{ 'node-port--routed': routedInputs(data.manifestPorts).length }"
                      :title="[p.name, portTypes(p), p.description].filter(Boolean).join(' · ')"
                    >
                      {{ p.name }}<template v-if="portTypes(p) && !routedInputs(data.manifestPorts).length"> · {{ portTypes(p) }}</template>
                    </span>
                    <span
                      v-if="routedInputs(data.manifestPorts).length"
                      class="node-port node-port--all"
                      title="All inputs: each step linked here is given whole, at the root of the input folder"
                    >all inputs</span>
                  </div>
                  <!-- What the step is, on one line; actions on hover or selection -->
                  <div class="node-header">
                    <span v-if="data.interactive" class="node-type-badge processor-badge">Interactive</span>
                    <span class="node-title" :title="nodeName({ id, type: 'default', data })">{{ nodeName({ id, type: 'default', data }) }}</span>
                    <RuntimeMark :runtime="data.computeType" />
                    <LlmMark v-if="usesLLM(data)" />
                    <span v-if="stepWarning(id)" class="step-warn" :title="stepWarning(id)" />
                    <button
                      v-if="!isReadOnly"
                      class="remove-btn node-action"
                      title="Remove"
                      @click.stop="removeNode(id)"
                    >
                      &times;
                    </button>
                  </div>
                  <!-- Version and resources, one muted line; a badge only when outdated -->
                  <div class="node-meta">
                    <span>{{ stepMeta(data) }}</span>
                    <span
                      v-if="data.tag && latestVersion(data.application) && data.tag !== latestVersion(data.application).version"
                      class="version-outdated-badge"
                      :title="`This step uses ${data.tag}; ${latestVersion(data.application).version} is the latest`"
                    >update: {{ latestVersion(data.application).version }}</span>
                  </div>
                  <!-- An app with variants: the values they set differently
                       ("Detector: oncet"), so the model is always in sight -->
                  <div v-if="stepModelLine(data)" class="node-meta node-model" :title="stepModelLine(data)">{{ stepModelLine(data) }}</div>
                  <div
                    v-if="data.manifestPorts?.outputs?.length"
                    class="node-ports node-ports--out"
                    :class="{ 'node-ports--routed': routedOutputs(data.manifestPorts).length }"
                    :style="routedOutputs(data.manifestPorts).length ? { gridTemplateColumns: `repeat(${routedOutputs(data.manifestPorts).length + 1}, minmax(0, 1fr))` } : undefined"
                  >
                    <span
                      v-for="p in data.manifestPorts.outputs"
                      :key="p.name"
                      class="node-port"
                      :class="{ 'node-port--routed': routedOutputs(data.manifestPorts).length }"
                      :title="[p.name, portTypes(p), p.description].filter(Boolean).join(' · ') + (routedOutputs(data.manifestPorts).length ? ' — connect to a data target to send it there' : '')"
                    >
                      <!-- Routed: the name only, cut to its column; the rest on hover -->
                      {{ p.name }}<template v-if="portTypes(p) && !routedOutputs(data.manifestPorts).length"> · {{ portTypes(p) }}</template>
                    </span>
                    <!-- The step's main point, last: all outputs, to another app -->
                    <span
                      v-if="routedOutputs(data.manifestPorts).length"
                      class="node-port node-port--all"
                      title="All outputs together: connect to another app"
                    >all outputs</span>
                  </div>
                  <div v-else-if="!data.hasManifest" class="node-ports node-ports--none">No manifest</div>
                </div>
                <!-- Two or more outputs: one connection point each, on the
                     bottom edge under its column (the chips sit in equal
                     columns inside the 15px padding), half under the card
                     like the other connectors. -->
                <Handle
                  v-for="(p, i) in routedOutputs(data.manifestPorts)"
                  :key="p.name"
                  :id="portHandleId(p.name)"
                  type="source"
                  :position="Position.Bottom"
                  :title="`${p.name}: connect to a data target to send this output there`"
                  :style="{ left: portHandleLeft(i, routedOutputs(data.manifestPorts).length + 1) }"
                />
                <!-- With output ports, the main point (all outputs, to another
                     app) is the last column, under its "all outputs" chip. -->
                <Handle
                  id="source"
                  type="source"
                  :position="Position.Bottom"
                  :title="routedOutputs(data.manifestPorts).length ? 'All outputs together: connect to another app' : undefined"
                  :style="routedOutputs(data.manifestPorts).length ? { left: portHandleLeft(routedOutputs(data.manifestPorts).length, routedOutputs(data.manifestPorts).length + 1) } : undefined"
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
              <!-- Input: a circle where data enters the workflow -->
              <template #node-data-source="{ data, id }">
                <IoPill
                  kind="input"
                  class="data-source-node"
                  :class="connectClass(id)"
                  :name="nodeName({ id, type: 'data-source', data })"
                  :title="sourceFeeds(id) || undefined"
                >
                  <button v-if="!isReadOnly" class="remove-btn io-node__remove" title="Remove" @click.stop="removeNode(id)">&times;</button>
                </IoPill>
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

              <!-- Output: a circle where results leave the workflow -->
              <template #node-data-target="{ data, id }">
                <Handle id="target" type="target" :position="Position.Top" />
                <IoPill
                  kind="output"
                  class="data-target-node"
                  :class="connectClass(id)"
                  :name="data.name || data.targetType ? nodeName({ id, type: 'data-target', data }) : 'Output: choose a destination'"
                  :sub="interfaceOn && data.targetType ? `by default ${getTargetTypeLabel(data.targetType)}` : ''"
                >
                  <button v-if="!isReadOnly" class="remove-btn io-node__remove" title="Remove" @click.stop="removeNode(id)">&times;</button>
                </IoPill>
              </template>
            </VueFlow>
          </div>
        </div>
      </div>

      <!-- Sidebar (Right) -->
      <button
        v-if="!panels.inspector && !landing"
        type="button"
        class="panel-rail panel-rail--right"
        title="Show details"
        aria-label="Show details"
        @click="togglePanel('inspector')"
      >
        <el-icon><ArrowLeft /></el-icon>
        <span class="panel-rail-label">Details</span>
      </button>
      <!-- The start screen shows on its own: no panels, no toolbar -->
      <div v-else-if="!landing" ref="sidebarRef" class="applications-sidebar">
        <div class="insp-top">
          <span>Details</span>
          <button type="button" class="insp-fold" title="Fold the details" aria-label="Fold the details" @click="togglePanel('inspector')">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>
        <!-- The selected step, or the workflow: the panel's content, never
             folded. The breadcrumb goes back to the workflow. -->
        <div class="panel-main">
          <!-- A step: the way back to the workflow, by name -->
          <nav v-if="selectedNode" class="panel-crumbs" aria-label="Details">
            <button type="button" class="crumb-link" @click="deselectStep">{{ workflowName.trim() || "Untitled workflow" }}</button>
            <span class="crumb-sep">›</span>
            <span class="crumb-current" :title="nodeName(selectedNode)">{{ nodeName(selectedNode) || "Step" }}</span>
          </nav>
          <!-- The workflow: its name as the panel's title, edited in place
               (the same name as the bar's) -->
          <template v-else>
            <input
              v-if="!isReadOnly"
              ref="panelTitleRef"
              v-model="workflowName"
              class="panel-title panel-title-input"
              placeholder="Untitled workflow"
              aria-label="Workflow name"
            />
            <h3 v-else class="panel-title">{{ workflowName.trim() || "Untitled workflow" }}</h3>
          </template>
            <!-- Selected Node Info -->
            <template v-if="selectedNode">
              <h4 v-if="selectedNode.type !== 'default'" class="sidebar-section-title">{{ selectedNode.data?.label || "Step" }}</h4>
              <div v-if="selectedNode.type !== 'default'" class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{
                    nodeName(selectedNode) || "Unnamed"
                  }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Kind</span>
                  <span class="info-value">{{
                    { "data-source": "Input data", "data-target": "Output", default: "App" }[selectedNode.type] || selectedNode.type
                  }}</span>
                </div>
                <!-- An input's and output's own name and settings, saved with
                     the workflow's interface -->
                <template v-if="interfaceOn && !isReadOnly && (selectedNode.type === 'data-source' || selectedNode.type === 'data-target')">
                  <div class="info-row">
                    <label class="info-label" for="io-name">Called</label>
                    <el-input id="io-name" v-model="selectedNode.data.name" size="small" class="info-inline-select" :placeholder="baseName({ ...selectedNode, data: { ...selectedNode.data, name: '' } })" />
                  </div>
                  <div v-if="selectedNode.type === 'data-source'" class="info-row">
                    <span class="info-label">Optional</span>
                    <el-checkbox v-model="selectedNode.data.optional">A run may leave it out</el-checkbox>
                  </div>
                </template>
                <div v-if="selectedNode.type === 'data-source' && sourceFeeds(selectedNode.id)" class="info-row">
                  <span class="info-label">Feeds</span>
                  <span class="info-value">{{ sourceFeeds(selectedNode.id) }}</span>
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
                    <span class="info-label">{{ interfaceOn ? "Default destination" : "Target Type" }}</span>
                    <span class="info-value" v-if="isReadOnly">{{
                      getTargetTypeLabel(selectedNode.data.targetType)
                    }}</span>
                    <el-select
                      v-else
                      v-model="selectedNode.data.targetType"
                      size="small"
                      :placeholder="interfaceOn ? 'None: each run chooses' : 'Select target type'"
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
                  <!-- Where else a run may send it, chosen per run -->
                  <template v-if="interfaceOn">
                    <p class="io-default-note">Each run can send it somewhere else; this is where it goes unless the run chooses.</p>
                    <div class="info-row">
                      <label class="info-label" for="io-accepts">Can go to</label>
                      <span class="info-value" v-if="isReadOnly">{{ (selectedNode.data.accepts || []).map((t) => getTargetTypeLabel(t)).join(", ") || "Anywhere" }}</span>
                      <el-select
                        v-else
                        id="io-accepts"
                        v-model="selectedNode.data.accepts"
                        multiple
                        size="small"
                        placeholder="Anywhere"
                        class="info-inline-select"
                      >
                        <el-option v-for="tt in targetTypes" :key="tt.targetType" :label="targetTypeName(tt.targetType, targetTypes)" :value="tt.targetType" />
                      </el-select>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Required</span>
                      <span class="info-value" v-if="isReadOnly">{{ selectedNode.data.required ? "Yes" : "No" }}</span>
                      <el-checkbox v-else v-model="selectedNode.data.required">Every run must send it somewhere</el-checkbox>
                    </div>
                  </template>
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

              <!-- An app step: what it is, then its inputs and outputs -->
              <template v-if="selectedNode.type === 'default'">
                <div class="step-head">
                  <h3 class="step-name" :title="selectedNode.data?.label">{{ selectedNode.data?.label || "Step" }}</h3>
                </div>
                <!-- What you set for this step, or what the app is -->
                <el-radio-group v-model="stepTab" size="small" class="step-tabs" aria-label="Step details">
                  <el-radio-button value="settings">Settings</el-radio-button>
                  <el-radio-button value="about">About</el-radio-button>
                </el-radio-group>

                <template v-if="stepTab === 'settings'">
                <h4 class="sidebar-section-title">Version</h4>
                <div class="step-version-row">
                  <el-select
                    v-if="canEditConfig && selectedNode.data.application?.versions?.length"
                    :model-value="selectedNode.data.tag"
                    size="small"
                    class="step-version"
                    aria-label="Version"
                    @update:model-value="requestVersion"
                  >
                    <el-option
                      v-for="v in sortedVersions(selectedNode.data.application)"
                      :key="v.version"
                      :label="versionOptionLabel(selectedNode.data.application, v)"
                      :value="v.version"
                    />
                  </el-select>
                  <span v-else class="step-version-text">{{ selectedNode.data.tag || "—" }}</span>
                </div>
                <div v-if="newerVersion" class="update-note">
                  <div class="update-head">
                    <span>Update available: <strong>{{ newerVersion }}</strong></span>
                    <button v-if="canEditConfig" type="button" class="text-link-btn" @click="requestVersion(newerVersion)">Update</button>
                  </div>
                  <ul v-if="updateLines.length" class="update-lines">
                    <li v-for="l in updateLines" :key="l">{{ l }}</li>
                  </ul>
                  <p v-else class="update-lines-none">No changes declared in app.yml.</p>
                </div>
                <!-- The app's variants (a CPU and a GPU build): which one
                     the step runs, and the parameters they set differently -->
                <template v-if="stepVariants.length">
                  <h4 class="sidebar-section-title">Variant</h4>
                  <el-radio-group
                    v-if="canEditConfig"
                    :model-value="stepVariantId"
                    size="small"
                    class="step-variants"
                    aria-label="Variant"
                    @update:model-value="requestVariant"
                  >
                    <el-radio-button
                      v-for="v in stepVariants"
                      :key="v.id"
                      :value="v.id"
                      :disabled="!!variantUnavailable(v, { gpus: gpusHere }) && v.id !== stepVariantId"
                      :title="variantOptionTitle(v)"
                    >
                      <span class="step-variant-label"><RuntimeMark v-if="v.gpu" runtime="gpu" compact />{{ v.name }}</span>
                    </el-radio-button>
                  </el-radio-group>
                  <span v-else class="step-version-text">{{ stepVariantInfo?.name }}</span>
                  <p v-if="stepVariantInfo?.description" class="step-variant-desc">{{ stepVariantInfo.description }}</p>
                  <p v-if="!gpusHere && stepVariants.some((v) => v.gpu)" class="step-variant-desc">
                    No compute node here has GPUs, so the GPU variants can't be picked.
                  </p>
                  <p v-for="n in variantNotes" :key="n" class="step-variant-note">{{ n }}</p>
                  <div v-if="variantParams.length" class="info-card step-variant-params">
                    <template v-for="param in variantParams" :key="param.name">
                      <ParamField
                        :param="param"
                        :editable="canEditConfig"
                        :model-value="selectedNode.data.defaultParams?.[param.name]"
                        @update:model-value="(v) => setDefaultParam(param.name, v)"
                      />
                      <p class="step-variant-param-note">{{ variantParamNoteOf(param.name) }}</p>
                    </template>
                  </div>
                </template>
                </template>

                <!-- About: read only, from the app.yml and the canvas -->
                <template v-if="stepTab === 'about'">
                <p v-if="stepAbout?.description" class="step-desc">{{ stepAbout.description }}</p>
                <div v-if="stepAbout?.tags?.length" class="step-tags">
                  <span v-for="tag in stepAbout.tags" :key="tag" class="step-tag" :style="tagStyle(tag)">{{ tag }}</span>
                </div>
                <p v-if="stepAbout?.maintainers?.length || stepAbout?.license" class="step-by">
                  <template v-if="stepAbout.maintainers.length">Maintained by {{ stepAbout.maintainers.map((m) => m.name).filter(Boolean).join(", ") }}</template>
                  <template v-if="stepAbout.maintainers.length && stepAbout.license"> · </template>
                  <template v-if="stepAbout.license">{{ stepAbout.license }}</template>
                </p>
                <p v-if="!stepManifest && !selectedNode.data.hasManifest && manifestsKnown" class="about-none">
                  This app has no app.yml, so its inputs, outputs and parameters aren't described.
                  <router-link
                    v-if="selectedNode.data.application?.ownerId === profile?.id"
                    :to="{ name: route.params.orgId ? 'application-manifest-builder' : 'my-application-manifest-builder' }"
                  >Create one with the manifest builder</router-link>
                </p>
                <div class="about-links">
                  <router-link
                    v-if="selectedNode.data.application?.uuid"
                    :to="{
                      name: route.params.orgId ? 'application-detail' : 'my-application-detail',
                      params: { ...(route.params.orgId && { orgId: route.params.orgId }), uuid: selectedNode.data.application.uuid },
                    }"
                    class="text-link-btn"
                  >App page ›</router-link>
                  <button v-if="selectedNode.data.application?.uuid" type="button" class="text-link-btn" @click="viewAppYml(selectedNode)">app.yml ›</button>
                  <a
                    v-if="selectedNode.data.application?.sourceUrl"
                    :href="selectedNode.data.application.sourceUrl"
                    target="_blank"
                    rel="noopener"
                    class="text-link-btn"
                  >GitHub ›</a>
                </div>

                <!-- Inputs: where they come from -->
                <template v-if="stepPorts.inputs.length">
                  <h4 class="sidebar-section-title">Inputs</h4>
                  <div class="port-list">
                    <div v-for="p in stepPorts.inputs" :key="'i' + p.name" class="port-item">
                      <div class="port-line">
                        <span class="port-name">{{ p.name }}</span>
                        <span v-if="ioTypes(p)" class="port-types">{{ ioTypes(p) }}</span>
                        <span class="port-link">{{ stepSources.length ? `from ${stepSources.join(", ")}` : "not connected" }}</span>
                      </div>
                      <p v-if="p.description" class="port-desc">{{ p.description }}</p>
                    </div>
                  </div>
                </template>

                <!-- Outputs: where each goes -->
                <template v-if="stepPorts.outputs.length">
                  <h4 class="sidebar-section-title">
                    Outputs
                    <span v-if="stepPorts.routed" class="section-note">each in OUTPUT_DIR/&lt;name&gt;/</span>
                  </h4>
                  <div class="port-list">
                    <div v-for="p in stepPorts.outputs" :key="'o' + p.name" class="port-item">
                      <div class="port-line">
                        <span class="port-name">{{ p.name }}</span>
                        <span v-if="ioTypes(p)" class="port-types">{{ ioTypes(p) }}</span>
                        <span v-if="stepPorts.routed" class="port-link">{{ p.to.length ? `→ ${p.to.join(", ")}` : "not connected" }}</span>
                      </div>
                      <p v-if="p.description" class="port-desc">{{ p.description }}</p>
                    </div>
                    <div v-if="stepPorts.routed" class="port-item">
                      <div class="port-line">
                        <span class="port-name port-name--all">all outputs</span>
                        <span class="port-link">{{ stepPorts.allTo.length ? `→ ${stepPorts.allTo.join(", ")}` : "not connected" }}</span>
                      </div>
                    </div>
                    <div v-else-if="stepPorts.allTo.length" class="port-item">
                      <span class="port-link">→ {{ stepPorts.allTo.join(", ") }}</span>
                    </div>
                  </div>
                </template>
                </template>
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

              <!-- Processor settings (editable in create mode): folded, as
                   the app's own resources usually do. -->
              <template v-if="selectedNode.type === 'default' && !isReadOnly && stepTab === 'settings'">
                <button type="button" class="advanced-toggle" :aria-expanded="showAdvanced" @click="showAdvanced = !showAdvanced">
                  <span class="advanced-caret" :class="{ open: showAdvanced }">▸</span>
                  Compute and resources<span class="advanced-summary">{{ resourcesSummary(selectedNode.data) }}</span>
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
                  stepTab === 'settings' &&
                  otherParams.length > 0
                "
              >
                <h4 class="sidebar-section-title">Parameters</h4>
                <div class="info-card">
                  <ParamField
                    v-for="param in otherParams"
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
            <template v-if="!selectedNode && mode !== 'browse' && !started">
              <h4 class="sidebar-section-title">Getting started</h4>
              <p class="checklist-intro">
                {{ landing ? "Choose how to start." : "Add the first step with the + under Input data, or click an app in the list. What's left to do shows here as you build." }}
              </p>
            </template>
            <template v-if="!selectedNode && mode !== 'browse' && started">
              <h4 class="sidebar-section-title">Checklist</h4>
              <!-- Where it stands, then what to do: each item goes to its step or link -->
              <p
                class="checklist-status"
                :class="readiness.blocking.length ? 'is-block' : readiness.warnings.length ? 'is-warn' : 'is-ready'"
              >{{ readinessLabel(readiness) }}</p>
              <ul v-if="readiness.items.length" class="checklist">
                <li v-for="item in readiness.items" :key="item.id">
                  <button type="button" class="checklist-item" :class="`is-${item.level}`" @click="onReadinessSelect(item)">
                    <span class="checklist-dot" />
                    <span class="checklist-text">
                      {{ item.text }}
                      <span v-if="item.detail" class="checklist-detail">{{ item.detail }}</span>
                    </span>
                  </button>
                </li>
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
                  <!-- The example PDF (a run's summary); editors can remove it here -->
                  <WorkflowExampleLink
                    v-if="selectedWorkflow?.uuid"
                    :uuid="selectedWorkflow.uuid"
                    :version="viewingVersion"
                    :can-edit="canEditExample"
                    :workflow-name="selectedWorkflow.name || ''"
                    variant="row"
                  />
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
                <div v-if="canEditWorkflow" class="info-actions">
                  <button class="text-link-btn" @click="startEditDetails">
                    Edit name & description
                  </button>
                </div>
              </template>
            </template>

            <!-- Nothing selected: every step, to open one -->
            <template v-if="!selectedNode && nodes.length">
              <h4 class="sidebar-section-title">Steps</h4>
              <ul class="step-list">
                <li v-for="n in stepListNodes" :key="n.id">
                  <button type="button" class="step-list-item" @click="onReadinessSelect({ nodeId: n.id })">
                    <!-- Its kind's colour, as on the canvas; a warning only when it needs attention -->
                    <span class="step-list-kind" :class="`is-${stepKind(n)}`" />
                    <span class="step-list-name">{{ nodeName(n) || "Step" }}</span>
                    <span v-if="stepWarning(n.id)" class="step-list-warn" :title="stepWarning(n.id)">!</span>
                    <span class="step-list-meta" :title="stepListMeta(n)">{{ stepListMeta(n) }}</span>
                  </button>
                </li>
              </ul>
            </template>

            <!-- Building, nothing selected: how, last (read once) -->
            <template v-if="!selectedNode && mode !== 'browse'">
              <h4 class="sidebar-section-title">Tips</h4>
              <ul class="tips">
                <li>Click a step to see and change its settings.</li>
                <li><strong>+</strong> under a step adds the next one; drag between steps to connect them.</li>
                <li><kbd>Delete</kbd> removes the selection; <kbd>⌘Z</kbd> / <kbd>⇧⌘Z</kbd> undo and redo; arrows move between steps.</li>
              </ul>
            </template>

            <div v-if="!selectedWorkflow && !selectedNode && !nodes.length" class="info-empty">
              Select a workflow or add a step to see details
            </div>
        </div>

        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">

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
            v-if="mode === 'browse' && selectedWorkflow && !selectedNode && (canEditWorkflow || canPublish || canUnpublish)"
            title="Danger Zone"
            name="danger-zone"
            class="danger-collapse-item"
          >
            <div class="danger-zone">
              <div v-if="canEditWorkflow" class="danger-row">
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
    <RunWizardDialog ref="runDialog" />
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

.step-variants {
  display: flex;
  flex-wrap: wrap;
  margin-top: 2px;
}
.step-variant-label {
  display: inline-flex;
  align-items: center;
}
.step-variant-desc,
.step-variant-note,
.step-variant-param-note {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.step-variant-note {
  color: theme.$gray_6;
}
.step-variant-params {
  margin-top: 8px;
}
.step-variant-param-note {
  margin: -2px 0 8px;
  color: theme.$gray_4;
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
/* The checklist's verdict, first: what's left, or ready. */
.checklist-status {
  margin: 0 0 8px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  &.is-block {
    background: #fdecec;
    color: #b42318;
  }
  &.is-warn {
    background: theme.$orange_tint;
    color: #9a5b0c;
  }
  &.is-ready {
    background: #eaf9ef;
    color: #0f7a3f;
  }
}
.checklist-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.checklist-detail {
  font-size: 12px;
  color: theme.$gray_4;
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
  margin-bottom: 4px;
  /* Over the step's input connector (top centre); with two or more inputs,
     each over its own connector (node-ports--routed). */
  justify-content: center;
}
.node-ports--out {
  margin-top: 5px;
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
/* A step's version and resources: one muted line. */
.node-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
  font-size: 11px;
  color: theme.$gray_4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
// The variant-set parameters' values: one more muted line, cut to the card.
.node-model {
  display: block;
  color: theme.$gray_5;
}
/* Edit and remove: on hover or when the step is selected. */
:deep(.vue-flow__node:not(.selected):not(:hover)) .node-action {
  opacity: 0;
}
.port-prefix-note {
  margin: -4px 0 10px;
  font-size: 12px;
  color: theme.$gray_5;
}
/* Two or more outputs (or inputs): chips in equal columns, so each one's
   connection point can sit under (or over) the middle of its column. */
.node-ports--routed {
  display: grid;
  justify-items: center;
  /* Many outputs: the card grows to its max width, then names are cut. */
  min-width: 0;
  .node-port {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.node-port--all {
  background: none;
  border: 1px dashed theme.$gray_3;
  color: theme.$gray_4;
}

/* The + under a step: what comes next. Shown on hover and selection. */
.io-default-note {
  margin: 4px 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;
}
.io-node__remove {
  position: absolute;
  /* Clear of the pill's rounded end */
  top: -13px;
  right: -10px;
}
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
.builder-landing {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  background: rgba(247, 247, 247, 0.96);
}
.builder-landing__title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: theme.$gray_6;
}
.builder-landing__options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(420px, 100%);
}
.builder-landing__option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
  }
  &.is-primary {
    border-color: theme.$purple_1;
    box-shadow: inset 3px 0 0 theme.$purple_1;
  }
}
.builder-landing__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.builder-landing__desc {
  font-size: 12px;
  color: theme.$gray_4;
}
.builder-landing__sub {
  margin: 8px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_4;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.builder-landing__list {
  margin: 0;
  padding: 0;
  list-style: none;
  width: min(420px, 100%);
}
.builder-landing__item {
  display: block;
  padding: 6px 2px;
  font-size: 13px;
  color: theme.$purple_2;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
.checklist-intro {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;
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

/* An app step's panel: name and version, what it is, then its ports. */
/* The panel's fixed top: breadcrumb, then the step or the workflow. */
.panel-main {
  padding: 0 0 8px;
}
/* The workflow's name, as the panel's title; edited in place. */
.panel-title {
  display: block;
  width: 100%;
  margin: 4px 0 12px;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 18px;
  font-weight: 600;
  color: theme.$gray_6;
  box-sizing: border-box;
}
.panel-title-input {
  margin-left: -5px;
  &::placeholder {
    color: theme.$gray_4;
    font-weight: 500;
  }
  &:hover {
    border-color: theme.$gray_2;
  }
  &:focus {
    outline: none;
    border-color: theme.$purple_1;
    background: theme.$white;
  }
}
.panel-crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 4px 0 10px;
  font-size: 12px;
  color: theme.$gray_4;
}
.crumb-link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: theme.$purple_3;
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
}
.crumb-current {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: theme.$gray_5;
}
/* The steps: no box or rules, the kinds' bars separate them; a row shows
   it's clickable on hover. */
.step-list {
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}
.step-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 3px;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  &:hover {
    background: theme.$gray_1;
  }
}
/* A step's kind, in the canvas's colours. */
.step-list-kind {
  flex-shrink: 0;
  width: 4px;
  height: 16px;
  border-radius: 2px;
  &.is-source {
    background: #6366f1;
  }
  &.is-app {
    background: theme.$orange_2;
  }
  &.is-target {
    background: #64748b;
  }
}
.step-list-warn {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: theme.$orange_1;
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  color: theme.$white;
}
/* The name keeps its width (its number tells steps apart); the detail
   beside it gives way, whole on hover. */
.step-list-name {
  flex-shrink: 0;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: theme.$gray_6;
}
.step-list-meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  font-size: 12px;
  color: theme.$gray_4;
}
.step-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 6px;
}
.step-name {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: theme.$gray_6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.step-version {
  width: 100%;
}
.step-version-row {
  margin-bottom: 8px;
}
.step-tabs {
  margin: 4px 0 10px;
}
.step-version-text {
  font-size: 12px;
  color: theme.$gray_4;
}
.step-desc {
  margin: 4px 0 8px;
  font-size: 13px;
  line-height: 1.45;
  color: theme.$gray_6;
}
.step-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.step-tag {
  padding: 0 6px;
  border: 1px solid;
  border-radius: 3px;
  font-size: 11px;
}
.step-by {
  margin: 0 0 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
.section-note {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: theme.$gray_4;
}
.port-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.port-item {
  padding: 6px 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
}
.port-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
}
.port-name {
  font-weight: 600;
  color: theme.$gray_6;
  &--all {
    font-weight: 400;
    font-style: italic;
    color: theme.$gray_5;
  }
}
.port-types {
  color: theme.$gray_4;
}
.port-link {
  margin-left: auto;
  color: theme.$gray_5;
  white-space: nowrap;
}
.port-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;
}
.advanced-summary {
  margin-left: 6px;
  font-weight: 400;
  color: theme.$gray_4;
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

  /* Save layout: the one thing to do after moving */
  &.is-primary {
    border-color: theme.$purple_2;
    background: theme.$purple_2;
    color: theme.$white;

    &:hover {
      background: theme.$purple_1;
      color: theme.$white;
    }
    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
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
  padding: 8px 10px;
  /* One size (NODE_WIDTH), so auto-arrange centres it; a long name is cut
     short, in full on hover. */
  box-sizing: border-box;
  width: 280px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  position: relative;
  z-index: 1;

  // What a step is, as a strip on the left over the border (as on the
  // compact cards); the border says its state (selected, a warning; on a
  // run, running or failed). The kinds set --type-strip.
  &::before {
    content: "";
    position: absolute;
    top: -1px;
    bottom: -1px;
    left: -1px;
    width: 5px;
    border-radius: 4px 0 0 4px;
    background: var(--type-strip, transparent);
  }

  &:hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
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
    margin-bottom: 4px;
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
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid theme.$gray_2;
    display: flex;
    align-items: center;
    gap: 8px;
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

  /* An app step: white, with the processor orange as its strip. Input
     data and targets keep a light tint of their colour, so data in and out
     reads apart from the work between. */
  &.processor-node {
    --type-strip: #{theme.$orange_2};
  }

  &.data-source-node:not(.io-node) {
    --type-strip: #6366f1;
    background: #eef2ff;

    .node-header {
      align-items: center;
      margin-bottom: 0;
    }
  }

  &.data-target-node:not(.io-node) {
    --type-strip: #64748b;
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
/* A step whose app calls language models (runtime.llm): a small sparkle. */
</style>
