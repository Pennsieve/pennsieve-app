<script setup>
// Self-contained "New Notebook" launcher. A guided flow:
//   Kernel → Compute Node → Hardware → Resources (CPU) → Dataset → Input
//   Files → Output → Review & Start.
// Outside a workspace the dataset is a public one (see the `personal` prop).
// It references a published notebook workflow (the recipe lives there), reuses
// the standard file picker, and assembles the createRun payload directly —
// no detour through the generic run-configure screen.
//
// Diverged enough from the standard run config that it lives on its own; opened
// via v-model and emits `created` with the new run.
import { isPathPrefixParam, targetParamLabel, defaultsToRunName, targetWritesToDataset, canWriteDataset, searchDatasets } from "./dataTargets";
import { hasInterface, withInterfaceNodes, destinationChoices, NO_DESTINATION } from "./workflowInterface";
import { acceptsInput, dataRegions, nodeDataReason, nodeDataNote, dataSize, suggestedDisk, isImagingData } from "./dataHints";
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useStore } from "vuex";
import BfButton from "../../shared/bf-button/BfButton.vue";
import AnalysisFilesTable from "../../FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "../../datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import EventBus from "@/utils/event-bus";
import {
  notebookKernel,
  kernelLabel,
  interactiveCapable,
  offlineNote,
  launchableKernels,
  kernelOutput,
  nonSavingAlternative,
  kernelCards,
  cardOf,
  cardSelection,
  notebookGpu,
  gpuReasonNote,
  runVariants,
  defaultRunVariant,
  variantLabel,
  variantSetsResources,
  variantResources,
  variantNodeUnfit,
  hardwareOptions,
  pickedOption,
  optionsForNode,
  nodeHardwareUnfit,
  hardwareForNode,
  hardwareLabel as hardwareOptionLabel,
  gpuSessionHelp,
  gpuReviewResources,
  GPU_INSTANCE_DISK_GIB,
  DEFAULT_NOTEBOOK_DISK_GIB,
  NOTEBOOK_DISK_OPTIONS,
  notebookDiskLabel,
  notebookDiskHint,
  notebookProcessorConfigs,
  nodeStatusReason,
} from "./notebookHelpers";
import { nodeGpu, gpuOffer, gpuName, gpuTaskResources } from "../ComputeNodes/computeNodeHelpers";
import NodeTierBadge from "../ComputeNodes/NodeTierBadge.vue";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import { fetchVariantGate, provisionerGateReason } from "./variantGate";
import { fetchNodesSessions, capacityLabel, capacityReason } from "./notebookCapacity";
import RuntimeMark from "../WorkflowGraph/RuntimeMark.vue";
import { STANDARD_CPU_OPTIONS, getStandardMemoryOptions, getTargetTypeLabel } from "./runHelpers";
import { sourceLabel } from "../WorkflowGraph/sourceInputs";
import * as siteConfig from "@/site-config/site.json";
import { viewsServiceUrl, viewForDataset, viewDataSource, createOpenDataView, createOpenDataViewOf, createDandiView } from "@/utils/viewsService";
import { OPENNEURO_REGISTRY } from "@/utils/openNeuro";
import { dandiViewTitle } from "@/utils/dandi";
import PlatformList from "../PlatformList.vue";
import PlatformPane from "../PlatformPane.vue";
import { newSelection, clearSelection } from "../platformSelection";
import { bossdbViewName, BOSSDB_REGISTRY } from "@/utils/bossdb";
import { OPEN_DATA_PORTALS } from "@/utils/openDataPortals";
import { DATA_PLATFORMS } from "../dataPlatforms";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The published notebook workflows (one per kernel). Provided by the parent,
  // which already fetched them to gate the "New Notebook" button.
  notebookWorkflows: { type: Array, default: () => [] },
  // The kernel to open on (a link's ?start=<workflow>); else the only
  // one, if there's just one.
  initialWorkflowId: { type: String, default: "" },
  // Launched from My Workspace, on the user's own compute node. There the
  // input is a public (Discover) dataset version, where the site has
  // views-service, or none. Its files aren't picked here: the notebook starts
  // with the dataset's file list, and the user downloads files from the
  // notebook's Inputs panel.
  personal: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "created"]);

// The kernels that can start here: in My Workspace, not those whose results
// go to a dataset (there's none to write to).
// The data comes first: only kernels that can take it are offered.
const kernelChoices = computed(() =>
  launchableKernels(props.notebookWorkflows, { personal: props.personal }).filter((wf) =>
    acceptsInput(wf, inputChoice.value, { personal: props.personal })
  )
);
// One card per kernel: its CPU and GPU workflows (app variants) together,
// with a Hardware toggle when it has both.
const cards = computed(() => kernelCards(kernelChoices.value));

const store = useStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

/* ----------------------------------------------------------------- store ---- */
const computeNodes = computed(
  () => store.getters["analysisModule/computeNodes"] || []
);
const targetTypes = computed(
  () => store.getters["analysisModule/targetTypes"] || []
);
const config = computed(() => store.state.config);

/* ----------------------------------------------------------- wizard state --- */
const step = ref(0);
// variant: the session step's app variant the run picks, for a kernel that
// offers its variants per run (notebook.variants); "" otherwise.
const form = ref({ workflowId: "", variant: "", computeNodeId: "", datasetId: "" });
const runName = ref("");
const computeNodeSearch = ref("");
const datasetOptions = ref([]);
const datasetSearchLoading = ref(false);
const datasetSearchQuery = ref("");
let datasetSearchTimer = null;
const executing = ref(false);

// The steps, in order (indices into stepTitles).
// The data first: it decides which kernels can take it, and guides the
// compute node, hardware and disk (dataHints).
// The last names the session and starts it, with what's chosen.
// Hardware and its resources are one step: the CPU, memory and disk follow
// from the hardware chosen (a GPU's are its instance's).
const S = { INPUT: 0, KERNEL: 1, FILES: 2, NODE: 3, HARDWARE: 4, OUTPUT: 5, REVIEW: 6 };
const stepTitles = computed(() => [
  "Choose Data",
  "Select Kernel",
  "Select Input Files",
  "Select Compute Node",
  "Hardware & Resources",
  iface.value ? "Results" : "Output Destination",
  "Name & Start",
]);

/* ------------------------------------------------------ compute resources --- */
// Fargate CPU/memory for the notebook task. Lowest tier is 1 vCPU (1024). Memory
// can be set automatically (balanced for the CPU) or pinned to a specific value.
const DEFAULT_CPU = "1024"; // 1 vCPU
// Sentinel for "let the platform pick memory for the chosen CPU". A non-empty
// value is used deliberately: Element Plus won't render the label of an
// empty-string-valued <el-option>, which would leave the Memory select looking
// blank instead of showing the default.
const AUTO_MEMORY = "auto";
const resourceCpu = ref(DEFAULT_CPU);
const resourceMemory = ref(AUTO_MEMORY);
// The session's disk in GiB (a CPU session's; a GPU one uses its instance's).
const resourceDisk = ref(DEFAULT_NOTEBOOK_DISK_GIB);
const diskOptions = NOTEBOOK_DISK_OPTIONS;
const diskHint = notebookDiskHint();
const cpuOptions = STANDARD_CPU_OPTIONS;
const memoryOptions = computed(() => getStandardMemoryOptions(resourceCpu.value));
// Balanced default memory for a CPU when memory is left automatic: 2 GB per vCPU
// (the low end of each CPU's valid range), e.g. 1 vCPU → 2 GB, 4 vCPU → 8 GB.
const autoMemoryForCpu = (cpu) => String(parseInt(cpu, 10) * 2);
const isAutoMemory = computed(() => resourceMemory.value === AUTO_MEMORY);
const resolvedMemory = computed(() =>
  isAutoMemory.value ? autoMemoryForCpu(resourceCpu.value) : resourceMemory.value
);
const memoryLabel = (val) => `${(parseInt(val, 10) / 1024).toFixed(0)} GB`;
const cpuLabel = (cpu) =>
  cpuOptions.find((o) => o.value === cpu)?.label || cpu;
// Changing CPU invalidates a pinned memory value outside the new range — drop
// back to automatic so we never submit an unsupported CPU/memory pair.
watch(resourceCpu, () => {
  if (
    !isAutoMemory.value &&
    !memoryOptions.value.some((o) => o.value === resourceMemory.value)
  ) {
    resourceMemory.value = AUTO_MEMORY;
  }
});

const configDefinition = ref(null);
const definitionLoading = ref(false);
const dataSourceFiles = reactive({}); // nodeId -> [file]
const dataTargetConfigs = reactive({}); // nodeId -> { params: [...] }

const dataSourceNodes = computed(() =>
  (configDefinition.value?.dag || []).filter((d) => d.type === "data-source")
);
const dataTargetNodes = computed(() =>
  (configDefinition.value?.dag || []).filter((d) => d.type === "data-target")
);

// The notebook always writes results to its output/ folder (the platform handles
// the upload), so the upload-bucket target param is not asked of the user — it's
// hidden from the launcher and left to its default.
const isHiddenTargetParam = (name) => /bucket/i.test(name || "") || isPathPrefixParam(name);
// The destination folder/path param defaults to "/" (dataset root) so output
// lands in the root folder unless the user picks somewhere else.
const isOutputFolderParam = (name) =>
  /(path|folder|prefix|dir(ectory)?|subpath|destination)/i.test(name || "");
const hasVisibleTargetParams = computed(() =>
  dataTargetNodes.value.some((d) =>
    (dataTargetConfigs[d.id]?.params || []).some(
      (p) => !isHiddenTargetParam(p.name)
    )
  )
);

/* ------------------------------------------------------------ hardware ---- */
// After the compute node, the Hardware step: the kernel's hardware options
// (its variants picked per run, or its CPU and GPU twin workflows) that the
// chosen node can run. A node without GPUs offers CPU only; a GPU one names
// its GPU and what a session gets on it (the node's GPU tier: GPU tasks get
// the instance's CPU and memory). A GPU session needs a node with GPUs, in
// secure or compliant mode (the basic-mode gateway can't reach GPU
// instances), whose provisioner passes the variant gate.
// Hardware chosen before the node (a link to a GPU twin, a GPU-only kernel)
// narrows the nodes the same way.
const hardwareChoices = computed(() => runVariants(selectedWorkflow.value));
const selectedVariant = computed(() => hardwareChoices.value.find((v) => v.id === form.value.variant) || null);
const isGpu = computed(() =>
  hardwareChoices.value.length ? selectedVariant.value?.gpu === true : notebookGpu(selectedWorkflow.value)
);
// The variant the session runs, for the node rules: the pick, else the
// twin's (GPU, a non-default variant; CPU, the default).
const runVariant = computed(() =>
  selectedVariant.value || (selectedWorkflow.value ? { gpu: isGpu.value, default: !isGpu.value } : null)
);
// Its resources are the variant's (a GPU one, or one that declares them):
// no CPU and memory to choose.
const variantResourcesSet = computed(() => isGpu.value || variantSetsResources(selectedVariant.value));

// The GPU tiers (GET /compute/resources/gpu-tiers), for what a node's GPU is.
const computeResourcesStore = useComputeResourcesStore();
const gpuTiers = ref([]);
const gpuOf = (cn) => nodeGpu(cn, gpuTiers.value);

const selectedCard = computed(() => cardOf(cards.value, form.value.workflowId));
const allHardware = computed(() => hardwareOptions(selectedCard.value));
const currentHardware = computed(() => pickedOption(allHardware.value, form.value.workflowId, form.value.variant));
// Hardware chosen before the node: a link to a GPU twin or variant.
const hardwarePinned = ref(false);
const variantGate = ref(null);
const gateReason = (n) => provisionerGateReason(n, variantGate.value || {});
// The hardware a node must be able to run: the one chosen first, else any
// of the kernel's options, else (no choice) the kernel's own.
const nodeMustRun = computed(() => {
  if (hardwarePinned.value && currentHardware.value) return [currentHardware.value];
  if (allHardware.value.length) return allHardware.value;
  return runVariant.value ? [runVariant.value] : [];
});
// Each listed node's room for notebooks ({ [uuid]: capacity | null }), read
// when the dialog opens; a node that couldn't be read shows none.
const nodeCapacity = ref({});
const nodeCapacityLabel = (cn) => capacityLabel(nodeCapacity.value[cn?.uuid]);
const nodeReasons = (cn) => {
  const status = nodeStatusReason(cn);
  if (status) return [status];
  const reasons = nodeHardwareUnfit(cn, nodeMustRun.value, gateReason);
  const full = capacityReason(nodeCapacity.value[cn?.uuid]);
  const data = nodeDataReason(cn, inputChoice.value);
  return [...reasons, ...(full ? [full] : []), ...(data ? [data] : [])];
};
// Reads the capacity of the nodes given (all listed, by default). Failures
// leave a node without one and never block the dialog.
async function loadCapacity(nodes = interactiveComputeNodes.value) {
  if (!nodes.length) return;
  const read = await fetchNodesSessions(config.value.api2Url, nodes, useGetToken).catch(() => ({}));
  nodeCapacity.value = { ...nodeCapacity.value, ...read };
}
// A GPU session decided before the node (chosen first, or the kernel's only).
const gpuFirst = computed(() => isGpu.value && (hardwarePinned.value || !allHardware.value.length));
// The hardware the chosen node can run.
const nodeHardware = computed(() =>
  selectedComputeNode.value ? optionsForNode(allHardware.value, selectedComputeNode.value, gateReason) : []
);
const selectedGpu = computed(() => gpuOf(selectedComputeNode.value));
// Why the chosen node offers no GPU option, when the kernel has one.
const noGpuHere = computed(() => {
  const node = selectedComputeNode.value;
  const gpuOpt = allHardware.value.find((o) => o.gpu);
  if (!node || !gpuOpt || nodeHardware.value.some((o) => o.gpu)) return "";
  if (!selectedGpu.value) return "This node has no GPUs, so its notebooks run on CPU.";
  return `This node's GPU can't host notebooks: ${variantNodeUnfit(node, gpuOpt, gateReason).join(" · ")}.`;
});
const pickHardware = (o) => {
  form.value.workflowId = o.workflowId;
  form.value.variant = o.variant;
  hardwarePinned.value = false;
};
// The hardware row of the summary: the pick, with the node's GPU on a GPU
// one; "" for a kernel without a choice that runs on CPU.
const hardwareLabel = computed(() => {
  const o = currentHardware.value || (isGpu.value ? { gpu: true, name: "GPU" } : selectedVariant.value);
  return o ? hardwareOptionLabel(o, selectedGpu.value) : "";
});
// The summary's hardware row: on a GPU, its name and the node's GPU ("GPU ·
// NVIDIA L4 · 24 GB"; the resources have their own row).
const reviewHardware = computed(() => {
  if (!isGpu.value) return hardwareLabel.value;
  const name = currentHardware.value ? variantLabel(currentHardware.value) : selectedVariant.value ? variantLabel(selectedVariant.value) : "GPU";
  return [name, gpuName(selectedGpu.value)].filter(Boolean).join(" · ");
});
const GPU_NOTE = "Starting takes a few minutes; the instance is billed while the notebook is open.";
const pickCard = (card) => {
  if (cardOf([card], form.value.workflowId)) return;
  form.value.workflowId = (card.cpu || card.gpu).uuid;
  hardwarePinned.value = false;
};
// Another kernel: its own default pick, unless it offers the one chosen.
watch(
  () => form.value.workflowId,
  () => {
    if (!hardwareChoices.value.some((v) => v.id === form.value.variant)) {
      form.value.variant = defaultRunVariant(selectedWorkflow.value);
    }
  }
);
const cardWorkflow = (card) => (cardOf([card], form.value.workflowId) ? selectedWorkflow.value : card.cpu || card.gpu);
// Whether a card's kernel can run on a GPU (marked on it).
const cardOffersGpu = (card) =>
  card.perRun ? runVariants(card.perRun).some((v) => v.gpu) : !!card.gpu;

/* --------------------------------------------------------- compute nodes ---- */
// A node can host a notebook only if it has interactive sessions enabled — only
// those are offered (no fallback to the full list). Shared predicate so the
// Notebooks page filters nodes consistently everywhere.
const interactiveComputeNodes = computed(() =>
  computeNodes.value.filter(interactiveCapable)
);
// Nodes listed after the dialog opened (the list still loading): read theirs.
watch(
  () => interactiveComputeNodes.value.map((cn) => cn.uuid).join(","),
  () => {
    if (!visible.value) return;
    const unread = interactiveComputeNodes.value.filter((cn) => !(cn.uuid in nodeCapacity.value));
    if (unread.length) loadCapacity(unread);
  }
);
const filteredComputeNodes = computed(() => {
  const q = computeNodeSearch.value.toLowerCase().trim();
  if (!q) return interactiveComputeNodes.value;
  return interactiveComputeNodes.value.filter(
    (cn) =>
      cn.name?.toLowerCase().includes(q) ||
      cn.description?.toLowerCase().includes(q)
  );
});

/* ----------------------------------------------------------- selections ----- */
const selectedWorkflow = computed(
  () =>
    kernelChoices.value.find((w) => w.uuid === form.value.workflowId) || null
);
const selectedComputeNode = computed(
  () => computeNodes.value.find((cn) => cn.uuid === form.value.computeNodeId) || null
);
// A node that can't host what the kernel now runs (another kernel picked):
// chosen again. On a node, the hardware it runs: the pick if it can, else
// its default.
watch(nodeMustRun, () => {
  if (selectedComputeNode.value && nodeReasons(selectedComputeNode.value).length) form.value.computeNodeId = "";
});
watch(
  () => [form.value.computeNodeId, allHardware.value],
  () => {
    const node = selectedComputeNode.value;
    if (!node || !allHardware.value.length) return;
    const keep = hardwareForNode(allHardware.value, node, currentHardware.value, gateReason);
    if (keep && keep !== currentHardware.value) {
      form.value.workflowId = keep.workflowId;
      form.value.variant = keep.variant;
    }
  }
);
const selectedDataset = computed(
  () => datasetOptions.value.find((d) => d.content?.id === form.value.datasetId) || null
);

/* ------------------------------------------- inputs and outputs (interface) - */
// A notebook workflow that declares its input and output (workflow-service:
// one per kernel) has them bound here, for this session: its input to a
// dataset's files, a public dataset or nothing, and its results to a
// download, a dataset or nowhere, as it accepts. In My Workspace there's no
// dataset to read from or write to. A notebook workflow with source and
// target nodes is launched as before.
const iface = computed(() => hasInterface(selectedWorkflow.value));
const ifaceInput = computed(() => selectedWorkflow.value?.inputs?.[0] || null);
const ifaceOutput = computed(() => selectedWorkflow.value?.outputs?.[0] || null);
const INPUT_CHOICES = {
  dataset: { label: "Files from a dataset", desc: "Choose a dataset in this workspace, then the files to start with" },
  public: { label: DATA_PLATFORMS.discover.name, desc: DATA_PLATFORMS.discover.desc, platform: "discover" },
  openData: { label: DATA_PLATFORMS.openData.name, desc: DATA_PLATFORMS.openData.desc, platform: "openData" },
  sparc: { label: DATA_PLATFORMS.sparc.name, desc: DATA_PLATFORMS.sparc.desc, platform: "sparc" },
  epilepsyScience: { label: DATA_PLATFORMS.epilepsyScience.name, desc: DATA_PLATFORMS.epilepsyScience.desc, platform: "epilepsyScience" },
  openNeuro: { label: DATA_PLATFORMS.openNeuro.name, desc: DATA_PLATFORMS.openNeuro.desc, platform: "openNeuro" },
  bossdb: { label: DATA_PLATFORMS.bossdb.name, desc: DATA_PLATFORMS.bossdb.desc, platform: "bossdb" },
  dandi: { label: DATA_PLATFORMS.dandi.name, desc: DATA_PLATFORMS.dandi.desc, platform: "dandi" },
  physionet: { label: DATA_PLATFORMS.physionet.name, desc: DATA_PLATFORMS.physionet.desc, platform: "physionet" },
  none: { label: "No input", desc: "Start with an empty input/ folder" },
};
// The data platforms offered (PlatformList's keys), the one chosen, and the
// dialog's choice for one (Discover's is "public").
const platformKeys = computed(() => inputChoices.value.map((c) => INPUT_CHOICES[c].platform).filter(Boolean));
const choicePlatform = computed(() => INPUT_CHOICES[inputChoice.value]?.platform || "");
const choiceOf = (platform) => Object.keys(INPUT_CHOICES).find((c) => INPUT_CHOICES[c].platform === platform) || "";
// Chosen before the kernel: every kind of data the dialog can start with
// here; the kernels are then those that take it.
const inputChoices = computed(() => {
  const c = [];
  if (!props.personal) c.push("dataset");
  if (publicInputs) c.push("public", "openData", "sparc", "epilepsyScience", "openNeuro", "bossdb", "dandi", "physionet");
  c.push("none");
  return c;
});
const inputChoice = ref("");
const outputChoices = computed(() =>
  ifaceOutput.value ? destinationChoices(ifaceOutput.value, { targetTypes: targetTypes.value, myWorkspace: props.personal }) : []
);
const outputChoice = ref("");
const outputLabel = (t) =>
  t === NO_DESTINATION ? "Don't save" : t === "download" ? "Download" : targetWritesToDataset(t) ? "Save to a dataset" : getTargetTypeLabel(t, targetTypes.value);
const outputDesc = (t) =>
  t === NO_DESTINATION
    ? "The session's output/ folder isn't saved when it ends"
    : t === "download"
    ? "An archive of output/ to download when the session ends"
    : targetWritesToDataset(t)
    ? "output/ copied into a dataset folder when the session ends"
    : "";
// The output starts from what the workflow suggests. (The input is chosen
// first, before the kernel: reset.)
watch(
  () => [form.value.workflowId, iface.value],
  () => {
    if (!iface.value) return;
    const outs = outputChoices.value;
    const preferred = ifaceOutput.value?.default?.targetType;
    outputChoice.value = outs.includes(preferred) ? preferred : outs.find((t) => t !== NO_DESTINATION) || outs[0] || "";
  }
);
// The output's settings follow its destination.
watch(outputChoice, (t) => {
  const node = dataTargetNodes.value[0];
  if (!iface.value || !node || !t) return;
  dataTargetConfigs[node.id] = t === NO_DESTINATION ? { params: [] } : targetConfigFor(node, t);
});
// A kernel chosen for other data that can't take this one is unchosen.
watch(inputChoice, () => {
  if (form.value.workflowId && !kernelChoices.value.some((wf) => wf.uuid === form.value.workflowId)) {
    form.value.workflowId = "";
    form.value.variant = "";
  }
});
const showPublicInput = computed(() => inputChoice.value === "public" && publicInputs);
const showDatasetInput = computed(() => inputChoice.value === "dataset");
const outputWritesDataset = computed(() => iface.value && !!outputChoice.value && outputChoice.value !== NO_DESTINATION && targetWritesToDataset(outputChoice.value));

/* ------------------------------------------------ view-only datasets ------- */
// A notebook whose results are saved to a dataset saves them to the chosen
// one, and workflow-service refuses a run whose creator can't write there
// (below Editor). On a dataset they can only view, they either start the same
// kernel's notebook that doesn't save to a dataset, or save the results to
// another dataset they can edit (each target's own datasetId).
const savesToDataset = computed(() => (iface.value ? outputWritesDataset.value : selectedWorkflow.value?.notebook?.savesTo === "dataset"));
const isViewOnly = (ds) => savesToDataset.value && !canWriteDataset(ds?.role);
const viewOnly = computed(() => !props.personal && !!selectedDataset.value && isViewOnly(selectedDataset.value));
// The dataset the results are saved to is chosen for them: on a view-only
// dataset, or (interface) when the input isn't a dataset's files.
const chooseResultsDataset = computed(() =>
  iface.value ? outputWritesDataset.value && (inputChoice.value !== "dataset" || viewOnly.value) : viewOnly.value
);
const alternativeKernel = computed(() => nonSavingAlternative(kernelChoices.value, selectedWorkflow.value));

const resultsDatasetId = ref("");
const resultsQuery = ref("");
const resultsOptions = ref([]);
const resultsLoading = ref(false);
let resultsTimer = null;
const resultsDataset = computed(() => resultsOptions.value.find((d) => d.content?.id === resultsDatasetId.value) || null);
const fetchResultsOptions = async (query = "") => {
  resultsLoading.value = true;
  try {
    const found = await searchDatasets(config.value.apiUrl, query, { getToken: useGetToken, sendXhr: useSendXhr, toQueryParams });
    resultsOptions.value = found.filter((d) => canWriteDataset(d.role));
  } catch (err) {
    console.error("Failed to fetch datasets:", err);
    resultsOptions.value = [];
  } finally {
    resultsLoading.value = false;
  }
};
const onResultsSearch = (query) => {
  clearTimeout(resultsTimer);
  resultsTimer = setTimeout(() => fetchResultsOptions(query), 300);
};
watch(viewOnly, (v) => {
  if (!v) resultsDatasetId.value = "";
  else if (!resultsOptions.value.length) fetchResultsOptions();
});

/* ------------------------------------------------------------- run name ----- */
const profile = computed(() => store.state.profile);
const nameTouched = ref(false);

const slug = (s) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Suggested run name: {kernel}-{user}-{YYYY-MM-DD}, e.g. "jupyter-jdoe-2026-06-08".
const defaultRunName = computed(() => {
  const kernel =
    kernelLabel(notebookKernel(selectedWorkflow.value)) || "notebook";
  const p = profile.value || {};
  const user =
    p.username || [p.firstName, p.lastName].filter(Boolean).join(" ") || "user";
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
  return `${slug(kernel)}-${slug(user)}-${date}`;
});

// A download's archive name follows the run's name until it's edited.
watch(runName, (val) => {
  for (const cfg of Object.values(dataTargetConfigs)) {
    for (const p of cfg.params || []) if (p.followsRunName) p.value = val;
  }
});

// Keep the name set to the default until the user edits it themselves.
watch(defaultRunName, (val) => {
  if (!nameTouched.value) runName.value = val;
});

const dataSourcesComplete = computed(() =>
  dataSourceNodes.value.every((d) => (dataSourceFiles[d.id] || []).length > 0)
);
const dataTargetsComplete = computed(() =>
  dataTargetNodes.value.every((d) =>
    (dataTargetConfigs[d.id]?.params || [])
      .filter((p) => p.required && !isHiddenTargetParam(p.name))
      .every((p) => p.value?.trim())
  )
);

const canNext = computed(() => {
  switch (step.value) {
    case S.KERNEL:
      return !!form.value.workflowId;
    case S.NODE:
      return !!form.value.computeNodeId && !(selectedComputeNode.value && nodeReasons(selectedComputeNode.value).length);
    case S.HARDWARE:
      // Resources always have a valid default (1 vCPU).
      return !allHardware.value.length || nodeHardware.value.includes(currentHardware.value);
    case S.INPUT:
      return inputChoice.value === "dataset"
        ? !!form.value.datasetId
        : inputChoice.value === "public"
        ? !!publicDataset.value
        : inputChoice.value === "openData"
        ? !!openDataDataset.value
        : inputChoice.value === "openNeuro"
        ? !!openNeuroDataset.value
        : inputChoice.value === "bossdb"
        ? bossdbPicks.value.length > 0
        : inputChoice.value === "dandi"
        ? !!dandiDataset.value
        : inputChoice.value === "physionet"
        ? !!physionetDataset.value && !!physionetPrefix.value
        : isPortal.value
        ? !!portalDataset.value
        : inputChoice.value === "none";
    case S.FILES:
      return dataSourcesComplete.value;
    case S.OUTPUT:
      if (iface.value && outputChoice.value === NO_DESTINATION) return true;
      return dataTargetsComplete.value && (!chooseResultsDataset.value || !!resultsDatasetId.value);
    default:
      return true;
  }
});

/* ------------------------------------------------------ dataset search ------ */
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

/* ------------------------------------------------ public dataset search ---- */
// Outside a workspace the input is a published dataset version, taken in as a
// view (utils/viewsService). Discover is read anonymously, as on the public
// dataset pages.
const publicInputs = !!viewsServiceUrl();
// What's chosen on each data platform (PlatformPane binds its pickers to
// it); the names below read and write their parts.
const sel = newSelection();
const part = (platform, field) => computed({ get: () => sel[platform][field], set: (v) => (sel[platform][field] = v) });
const publicDataset = part("discover", "dataset"); // a published dataset, chosen with DiscoverPicker
const publicVersion = part("discover", "version");

/* --------------------------------------------------- AWS Open Data input --- */
// A dataset of the Registry of Open Data on AWS and a folder of it, chosen
// with OpenDataPicker: the notebook starts with a view of its files there,
// listed from its public bucket when the run starts, and the user downloads
// what they need from the Inputs panel.
const openDataDataset = part("openData", "dataset"); // a listOpenData entry
const openDataPrefix = part("openData", "prefix");

// An OpenNeuro dataset, chosen with OpenNeuroPicker: a view of its folder
// in the Open Data catalog's openneuro entry.
const openNeuroDataset = part("openNeuro", "dataset"); // a searchOpenNeuro result
const openNeuroPrefix = part("openNeuro", "prefix");
const openNeuroLabel = computed(() => {
  const d = openNeuroDataset.value;
  if (!d) return "";
  return `${d.name} (${openNeuroPrefix.value || d.id})`;
});

// BossDB collections, experiments or volumes, chosen with BossdbPicker: a
// view of their folders of the bossdb entry, whose volumes views-service
// takes whole (precomputed, read in place).
const bossdbPicks = part("bossdb", "picks"); // [{ prefix, label, ... }]

// A dandiset version, chosen with DandiPicker: a view of its files (each
// read from its blob in the archive's bucket), all or a folder's.
const dandiDataset = part("dandi", "dataset"); // a searchDandi result, at the version chosen
const dandiPrefix = part("dandi", "prefix");
const dandiLabel = computed(() => {
  const d = dandiDataset.value;
  if (!d) return "";
  return `${d.name} (DANDI:${d.id}${dandiPrefix.value ? `/${dandiPrefix.value}` : ""}, ${d.version})`;
});

// A PhysioNet project's version, chosen with PhysionetPicker: a view of a
// folder of it, the project being its own Open Data entry.
const physionetDataset = part("physionet", "dataset"); // a listOpenData entry
const physionetPrefix = part("physionet", "prefix"); // its version's folder or one below
const physionetLabel = computed(() => {
  const d = physionetDataset.value;
  if (!d) return "";
  return `${d.title} (${d.name}/${physionetPrefix.value.replace(/\/$/, "")})`;
});

// A SPARC or Epilepsy.Science dataset, chosen with PortalPicker: a view of
// its folder in the portal's Open Data entry. Choosing the other portal
// starts over.
// The portal chosen's (each keeps its own).
const isPortal = computed(() => inputChoice.value in OPEN_DATA_PORTALS);
const portalPart = (field, none) =>
  computed({ get: () => (isPortal.value ? sel[inputChoice.value][field] : none), set: (v) => isPortal.value && (sel[inputChoice.value][field] = v) });
const portalDataset = portalPart("dataset", null); // a toPortalDataset
const portalPrefix = portalPart("prefix", "");
const portalLabel = computed(() => {
  const d = portalDataset.value;
  if (!d) return "";
  const p = portalPrefix.value.replace(/\/$/, "");
  return p && p !== String(d.id) ? `${d.name} (${p})` : d.name;
});

const openDataLabel = computed(() => {
  const d = openDataDataset.value;
  if (!d) return "";
  const p = openDataPrefix.value.trim();
  return p ? `${d.title} (${p})` : d.title;
});

// Hints from the data chosen: where it lives (a node elsewhere costs
// transfer), its size (the disk suggested), and whether it's imaging (a
// GPU may help).
const dataContext = computed(() => ({
  publicDataset: publicDataset.value,
  openNeuroDataset: openNeuroDataset.value,
  dandiDataset: dandiDataset.value,
  openDataDataset: openDataDataset.value,
  portalDataset: portalDataset.value,
  selectedDataset: selectedDataset.value?.content,
}));
const nodeNote = (cn) => nodeDataNote(cn, dataRegions(inputChoice.value, dataContext.value));
const dataBytes = computed(() => dataSize(inputChoice.value, dataContext.value));
const diskSuggestion = computed(() => suggestedDisk(dataBytes.value, diskOptions));
const imagingData = computed(() => isImagingData(inputChoice.value, dataContext.value));
// The disk follows the suggestion until the user picks one.
const diskTouched = ref(false);
watch(diskSuggestion, (gib) => {
  if (gib && !diskTouched.value) resourceDisk.value = gib;
});

const formatSize = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};

/* ------------------------------------------------- definition + targets ----- */
async function loadDefinition() {
  if (
    configDefinition.value &&
    configDefinition.value.uuid === form.value.workflowId
  ) {
    return;
  }
  definitionLoading.value = true;
  try {
    const def = await store.dispatch(
      "analysisModule/fetchWorkflowDefinition",
      form.value.workflowId
    );
    // A workflow's input and output as the source and target nodes a run of
    // it has (workflowInterface.js).
    configDefinition.value = withInterfaceNodes(def);
    console.log(
      "[Notebook] definition dag nodes:",
      (def?.dag || def?.processors || []).map((d) => ({ id: d.id, type: d.type }))
    );
    Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
    Object.keys(dataTargetConfigs).forEach((k) => delete dataTargetConfigs[k]);
    for (const node of dataTargetNodes.value) {
      const t = iface.value && outputChoice.value ? outputChoice.value : node.targetType;
      dataTargetConfigs[node.id] = t === NO_DESTINATION ? { params: [] } : targetConfigFor(node, t);
    }
    if (dataSourceNodes.value.length > 0) {
      selectSourceNode(dataSourceNodes.value[0].id);
    }
  } catch (err) {
    console.error("Failed to load notebook workflow definition:", err);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: "Failed to load the notebook workflow." },
    });
  } finally {
    definitionLoading.value = false;
  }
}

// A target's settings in the launcher, for its target type: the registry's
// params, a download's archive named after the run, output folders at the
// dataset's root; an interface output's default params where it's that type.
function targetConfigFor(node, targetType) {
  const tt = targetTypes.value.find((t) => t.targetType === targetType);
  const paramDefs = tt?.params || [];
  const defaults = targetType === node.targetType ? node.defaultParams || {} : {};
  return {
        params: paramDefs.map((pd) => {
          const followsRunName = pd.defaultValue == null && defaultsToRunName(targetType, pd.name);
          return {
            name: pd.name,
            type: pd.type || "string",
            description: pd.description || "",
            required: pd.defaultValue == null && !isPathPrefixParam(pd.name),
            // Kept equal to the run's name until the user edits it.
            followsRunName,
            value:
              defaults[pd.name] != null && defaults[pd.name] !== ""
                ? String(defaults[pd.name])
                : pd.defaultValue != null
                ? String(pd.defaultValue)
                : followsRunName
                ? runName.value
                : isPathPrefixParam(pd.name)
                ? ""
                : isOutputFolderParam(pd.name)
                ? "/"
                : "",
          };
        }),
  };
}

/* ----------------------------------------------------------- file picker ---- */
const currentSourceNodeId = ref(null);
const filePickerFiles = ref([]);
const filePickerAncestorList = ref([]);
const filePickerCurrentFile = ref({ content: { name: "" } });
const clearSelectedValues = ref(false);

function fileCountForNode(nodeId) {
  return (dataSourceFiles[nodeId] || []).length;
}

async function selectSourceNode(nodeId) {
  currentSourceNodeId.value = nodeId;
  filePickerAncestorList.value = [];
  filePickerCurrentFile.value = { content: { name: "" } };
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  const existing = dataSourceFiles[nodeId] || [];
  if (existing.length > 0) {
    const byParent = {};
    for (const f of existing) {
      const pid = f.content?.parentId || "root";
      (byParent[pid] ||= []).push(f);
    }
    for (const [parentId, files] of Object.entries(byParent)) {
      store.commit("analysisModule/SET_SELECTED_FILES", { selectedFiles: files, parentId });
    }
  }
  await fetchDatasetFiles();
}

async function fetchDatasetFiles() {
  try {
    const token = await useGetToken();
    const datasetId = form.value.datasetId;
    const url = `${config.value.apiUrl}/datasets/${datasetId}?api_key=${token}&includeAncestors=true&limit=500&offset=0`;
    const response = await useSendXhr(url);
    filePickerFiles.value = [...(response.children || [])];
  } catch (err) {
    console.error("Failed to fetch files:", err);
    filePickerFiles.value = [];
  }
}

async function onClickFileLabel(file) {
  if (file.content.packageType !== "Collection") return;
  try {
    const token = await useGetToken();
    const url = `${config.value.apiUrl}/packages/${file.content.id}?api_key=${token}&includeAncestors=true&limit=500&offset=0`;
    const response = await useSendXhr(url);
    filePickerFiles.value = [...(response.children || [])];
    if (
      filePickerCurrentFile.value.content?.id &&
      !filePickerAncestorList.value.some(
        (a) => a.content.id === filePickerCurrentFile.value.content?.id
      )
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
}

async function handleNavigateBreadcrumb(id) {
  try {
    const token = await useGetToken();
    let url;
    if (!id || id === "root") {
      url = `${config.value.apiUrl}/datasets/${form.value.datasetId}?api_key=${token}&includeAncestors=true&limit=500&offset=0`;
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
}

function onFileSelect(selectedFiles, parentId) {
  const nodeId = currentSourceNodeId.value;
  if (!nodeId) return;
  store.commit("analysisModule/SET_SELECTED_FILES", {
    selectedFiles,
    parentId: parentId || "root",
  });
  const allFiles = [];
  const storeFiles = store.state.analysisModule.selectedFilesForAnalysis;
  for (const pid in storeFiles) allFiles.push(...storeFiles[pid]);
  dataSourceFiles[nodeId] = allFiles;
}

/* ----------------------------------------------------------- wizard nav ----- */
function reset() {
  form.value = { workflowId: "", variant: "", computeNodeId: "", datasetId: "" };
  nameTouched.value = false;
  computeNodeSearch.value = "";
  datasetSearchQuery.value = "";
  clearSelection(sel);
  // The data comes first: a workspace's own dataset, else a public one.
  inputChoice.value = props.personal ? (publicInputs ? "public" : "none") : "dataset";
  diskTouched.value = false;
  resourceCpu.value = DEFAULT_CPU;
  resourceMemory.value = AUTO_MEMORY;
  step.value = 0;
  configDefinition.value = null;
  resultsDatasetId.value = "";
  resultsQuery.value = "";
  outputChoice.value = "";
  Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
  Object.keys(dataTargetConfigs).forEach((k) => delete dataTargetConfigs[k]);
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  // Preselect the kernel asked for, or the only one if there's just one — but
  // keep the step visible.
  // A link to a GPU twin a per-run kernel stands for opens that kernel on
  // the twin's variant.
  const linked = props.initialWorkflowId && cardSelection(cards.value, props.initialWorkflowId, kernelChoices.value);
  hardwarePinned.value = false;
  if (linked) {
    form.value.workflowId = linked.workflowId;
    form.value.variant = linked.variant;
    // A link to the GPU one: the nodes offered are those that can run it.
    hardwarePinned.value = !!pickedOption(hardwareOptions(cardOf(cards.value, linked.workflowId)), linked.workflowId, linked.variant)?.gpu;
  } else if (cards.value.length === 1) {
    // One kernel card (its CPU workflow, when it has CPU and GPU ones).
    form.value.workflowId = (cards.value[0].cpu || cards.value[0].gpu).uuid;
  }
  // (Set here too: reopening on the same kernel doesn't change workflowId.)
  if (!form.value.variant) form.value.variant = defaultRunVariant(selectedWorkflow.value);
  // Seed the suggested name ({kernel}-{user}-{date}) now that the kernel (if any)
  // is selected; the watcher keeps it current until the user edits it.
  runName.value = defaultRunName.value;
}

// Reset + load datasets each time the dialog opens.
watch(visible, (open) => {
  if (open) {
    reset();
    if (!variantGate.value) fetchVariantGate(config.value.api2Url, useGetToken).then((g) => (variantGate.value = g));
    nodeCapacity.value = {};
    loadCapacity();
    // Their statuses now: one may have started updating since the page opened.
    store.dispatch("analysisModule/fetchComputeNodes", { force: true }).catch(() => {});
    if (!gpuTiers.value.length) {
      computeResourcesStore
        .fetchGpuTiers(store.getters.activeOrganization?.organization?.id)
        .then((t) => (gpuTiers.value = t || []))
        .catch(() => {});
    }
    if (!props.personal) fetchDatasetOptions();
  }
});

// Outside a workspace there are no input files to pick: the user downloads a
// public dataset's files from the notebook itself.
// A GPU kernel runs with its node's GPU instance's resources, and a variant
// that declares its own with those: no CPU and memory to choose. A kernel
// with neither a hardware choice nor resources to choose has no Hardware
// step.
const skipsStep = (i) =>
  (i === S.FILES && inputChoice.value !== "dataset") ||
  (i === S.HARDWARE && !allHardware.value.length && variantResourcesSet.value);

const next = async () => {
  if (step.value === S.KERNEL) await loadDefinition(); // leaving Kernel → its inputs and outputs
  let n = step.value + 1;
  while (skipsStep(n)) n++;
  if (n < stepTitles.value.length) step.value = n;
};
// The input step's "No input data": no data, and on to the kernel.
async function startWithoutData() {
  inputChoice.value = "none";
  await nextTick();
  await next();
}
const back = () => {
  let n = step.value - 1;
  while (n > 0 && skipsStep(n)) n--;
  if (n >= 0) step.value = n;
};

/* ------------------------------------------------------- info column ------ */
// Input and Results show their own choices on the left (io-split); every
// other step, what it's for and what's chosen so far.
const stepHasChoices = computed(() => step.value === S.INPUT || (iface.value && step.value === S.OUTPUT));
const STEP_ABOUT = [
  "The data the notebook works with.",
  "A notebook is a live Jupyter session on a compute node. Choose its language.",
  "The files copied into the notebook's input/ folder before it starts.",
  "The compute node the session runs on. Only nodes with notebook sessions are offered; each says whether it has a GPU.",
  "CPU, or the node's GPU when it has one. A GPU notebook gets the whole GPU instance; a CPU one the CPU, memory and disk you choose.",
  "Where the notebook's results go when the session ends.",
  "",
];
const stepAbout = computed(() =>
  step.value === S.NODE && gpuFirst.value
    ? "The compute node the session runs on. A GPU notebook needs a secure or compliant node with GPUs."
    : STEP_ABOUT[step.value] || ""
);
const soFar = computed(() => {
  const rows = [];
  if (step.value > S.INPUT) {
    const input =
      inputChoice.value === "public"
        ? publicDataset.value?.name || "A public dataset"
        : inputChoice.value === "openData"
        ? openDataLabel.value || "AWS Open Data"
        : inputChoice.value === "openNeuro"
        ? openNeuroLabel.value || "OpenNeuro"
        : inputChoice.value === "bossdb"
        ? (bossdbPicks.value.length ? bossdbViewName(bossdbPicks.value) : "BossDB")
        : inputChoice.value === "dandi"
        ? dandiLabel.value || "DANDI"
        : inputChoice.value === "physionet"
        ? physionetLabel.value || "PhysioNet"
        : isPortal.value
        ? portalLabel.value || DATA_PLATFORMS[inputChoice.value].name
        : inputChoice.value === "dataset"
        ? selectedDataset.value?.content?.name || "A dataset"
        : "No input";
    rows.push({ label: "Data", value: input });
  }
  if (step.value > S.KERNEL && selectedWorkflow.value) rows.push({ label: "Kernel", value: kernelLabel(notebookKernel(selectedWorkflow.value)) });
  if (step.value > S.FILES && inputChoice.value === "dataset") {
    rows.push({ label: "Files", value: String(dataSourceNodes.value.reduce((n, d) => n + fileCountForNode(d.id), 0)) });
  }
  if (step.value > S.NODE && selectedComputeNode.value) rows.push({ label: "Compute node", value: selectedComputeNode.value.name });
  if ((step.value > S.HARDWARE || gpuFirst.value) && step.value > S.KERNEL && reviewHardware.value) rows.push({ label: "Hardware", value: reviewHardware.value });
  if (step.value > S.HARDWARE) {
    // A GPU's are its instance's; a variant may set its own.
    const resources = isGpu.value
      ? gpuReviewResources(selectedGpu.value)
      : variantResourcesSet.value
      ? variantResources(selectedVariant.value) && `${variantResources(selectedVariant.value)} (set by the kernel)`
      : `${cpuLabel(resourceCpu.value)} · ${isAutoMemory.value ? memoryLabel(autoMemoryForCpu(resourceCpu.value)) : memoryLabel(resourceMemory.value)} · ${notebookDiskLabel(resourceDisk.value)}`;
    if (resources) rows.push({ label: "Resources", value: resources });
  }
  if (step.value > S.OUTPUT && iface.value) {
    const to = outputWritesDataset.value
      ? `Saved to ${chooseResultsDataset.value ? resultsDataset.value?.content?.name : selectedDataset.value?.content?.name}`
      : outputLabel(outputChoice.value);
    rows.push({ label: "Results", value: to });
  }
  if (step.value > S.OUTPUT && viewOnly.value && !iface.value) rows.push({ label: "Results saved to", value: resultsDataset.value?.content?.name || "" });
  return rows;
});

// The run's dataset: the input's (its files' dataset), else the one chosen for
// the results; none in My Workspace.
const runDatasetId = computed(() => {
  if (props.personal) return "";
  if (!iface.value) return form.value.datasetId;
  if (inputChoice.value === "dataset") return form.value.datasetId;
  return outputWritesDataset.value ? resultsDatasetId.value : "";
});

async function execute() {
  if (executing.value) return;
  executing.value = true;
  try {
    const dag = configDefinition.value?.dag || [];

    const dataSources = {};
    if (inputChoice.value === "dataset") {
      for (const [nodeId, files] of Object.entries(dataSourceFiles)) {
        const ids = files.map((f) => f.content?.id).filter(Boolean);
        if (ids.length) dataSources[nodeId] = { packageIds: ids };
      }
    }

    const dataTargets = {};
    for (const node of dataTargetNodes.value) {
      // An interface output names its destination for this session.
      if (iface.value && outputChoice.value === NO_DESTINATION) {
        dataTargets[node.id] = { targetType: NO_DESTINATION };
        continue;
      }
      const obj = {};
      (dataTargetConfigs[node.id]?.params || []).forEach((p) => {
        if (p.value?.trim()) obj[p.name] = p.value;
      });
      const entry = {};
      const targetType = iface.value ? outputChoice.value : node.targetType;
      if (iface.value) entry.targetType = targetType;
      if (Object.keys(obj).length) entry.params = obj;
      // The results go to the dataset chosen for them, where there is one.
      if (chooseResultsDataset.value && targetWritesToDataset(targetType)) entry.datasetId = resultsDatasetId.value;
      if (Object.keys(entry).length) dataTargets[node.id] = entry;
    }

    // The session step is live because its app.yml says so; the run only sets
    // its resources.
    // A GPU kernel, or a variant that declares its resources: the
    // variant's (no CPU and memory chosen). A kernel that offers its
    // variants per run gets the pick on its session step.
    // A CPU session's disk goes on its session step.
    const processorConfigs = notebookProcessorConfigs(dag, {
      variantId: selectedVariant.value?.id || "",
      resources: variantResourcesSet.value
        ? null
        : { cpu: resourceCpu.value, memory: resolvedMemory.value, diskGiB: resourceDisk.value },
    });

    // Outside a workspace, the public dataset is the first data source's view.
    // It's a source's only input: the session downloads its files into it.
    const personalSources = {};
    const usesPublic = inputChoice.value === "public";
    if (usesPublic && publicDataset.value && dataSourceNodes.value.length) {
      const view = await viewForDataset({
        datasetId: publicDataset.value.id,
        version: publicVersion.value,
        name: publicDataset.value.name,
      });
      personalSources[dataSourceNodes.value[0].id] = viewDataSource(view);
    }
    // An AWS Open Data dataset: a view made for this run, listed now.
    const usesOpenData = inputChoice.value === "openData";
    if (usesOpenData && openDataDataset.value && dataSourceNodes.value.length) {
      const view = await createOpenDataView({
        dataset: openDataDataset.value.name,
        title: openDataDataset.value.title,
        prefix: openDataPrefix.value,
      });
      personalSources[dataSourceNodes.value[0].id] = viewDataSource(view);
    }
    // An OpenNeuro dataset: a view of its folder in the openneuro entry.
    const usesOpenNeuro = inputChoice.value === "openNeuro";
    if (usesOpenNeuro && openNeuroDataset.value && dataSourceNodes.value.length) {
      const view = await createOpenDataView({
        dataset: OPENNEURO_REGISTRY,
        title: openNeuroDataset.value.name,
        prefix: openNeuroPrefix.value,
      });
      personalSources[dataSourceNodes.value[0].id] = viewDataSource(view);
    }
    // BossDB: a view of the folders chosen, their volumes precomputed stacks.
    const usesBossdb = inputChoice.value === "bossdb";
    if (usesBossdb && bossdbPicks.value.length && dataSourceNodes.value.length) {
      const view = await createOpenDataViewOf({
        dataset: BOSSDB_REGISTRY,
        name: bossdbViewName(bossdbPicks.value),
        prefixes: bossdbPicks.value.map((p) => p.prefix),
      });
      personalSources[dataSourceNodes.value[0].id] = viewDataSource(view);
    }
    // A dandiset version: a view of its files, each read from its blob.
    const usesDandi = inputChoice.value === "dandi";
    if (usesDandi && dandiDataset.value && dataSourceNodes.value.length) {
      const view = await createDandiView({
        dandiset: dandiDataset.value.id,
        version: dandiDataset.value.version,
        title: dandiViewTitle(dandiDataset.value),
        prefix: dandiPrefix.value,
      });
      personalSources[dataSourceNodes.value[0].id] = viewDataSource(view);
    }
    // A PhysioNet project: a view of a version's folder of its entry.
    const usesPhysionet = inputChoice.value === "physionet";
    if (usesPhysionet && physionetDataset.value && dataSourceNodes.value.length) {
      const view = await createOpenDataView({
        dataset: physionetDataset.value.name,
        title: physionetDataset.value.title,
        prefix: physionetPrefix.value,
      });
      personalSources[dataSourceNodes.value[0].id] = viewDataSource(view);
    }
    // A SPARC or Epilepsy.Science dataset: a view of its folder in the
    // portal's Open Data entry.
    const usesPortal = isPortal.value;
    if (usesPortal && portalDataset.value && dataSourceNodes.value.length) {
      const view = await createOpenDataView({
        dataset: OPEN_DATA_PORTALS[inputChoice.value].registry,
        title: portalDataset.value.name,
        prefix: portalPrefix.value,
      });
      personalSources[dataSourceNodes.value[0].id] = viewDataSource(view);
    }

    const name = runName.value.trim();
    const payload = {
      workflowInstanceConfiguration: {
        workflowId: form.value.workflowId,
        computeNodeId: form.value.computeNodeId,
        ...(processorConfigs.length > 0 && { processorConfigs }),
      },
      ...(runDatasetId.value && { datasetId: runDatasetId.value }),
      dataSources: usesPublic || usesOpenData || usesOpenNeuro || usesBossdb || usesDandi || usesPortal ? personalSources : dataSources,
      ...(name && { name }),
      ...(Object.keys(dataTargets).length > 0 && { dataTargets }),
    };

    console.log("[Notebook] createRun payload:", JSON.stringify(payload, null, 2));
    const newRun = await store.dispatch("analysisModule/createRun", payload);
    console.log("[Notebook] createRun response:", JSON.stringify(newRun, null, 2));
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Starting your notebook…",
      },
    });
    store.commit("analysisModule/CLEAR_SELECTED_FILES");
    visible.value = false;
    emit("created", newRun);
  } catch (err) {
    console.error("Failed to start notebook:", err);
    // The node may have filled up since it was read (a 409): read it again.
    if (selectedComputeNode.value) loadCapacity([selectedComputeNode.value]);
    EventBus.$emit("toast", {
      detail: { type: "error", msg: err?.message || "Failed to start notebook." },
    });
  } finally {
    executing.value = false;
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="stepTitles[step]"
    width="min(960px, 96vw)"
    top="5vh"
    class="nb-dialog"
    :close-on-click-modal="false"
  >
    <div class="wizard-body">
      <div class="wizard-progress">
        <span
          v-for="(title, i) in stepTitles"
          v-show="!skipsStep(i)"
          :key="i"
          class="wizard-dot"
          :class="{ active: step === i, done: step > i }"
        />
      </div>

      <!-- Two columns on every step: what it's for and what's chosen so far on
           the left (on Input and Results, the step's own choices are), the
           step on the right. On a narrow screen, the step alone. -->
      <div class="nb-layout" :class="{ 'has-info': !stepHasChoices && step !== S.REVIEW, 'is-split': step === S.INPUT }">
      <aside v-if="!stepHasChoices && step !== S.REVIEW" class="nb-info">
        <p class="nb-info__about">{{ stepAbout }}</p>
        <template v-if="soFar.length">
          <h4 class="nb-info__title">This session</h4>
          <dl class="nb-info__list">
            <template v-for="row in soFar" :key="row.label">
              <dt>{{ row.label }}</dt>
              <dd>{{ row.value }}</dd>
            </template>
          </dl>
        </template>
      </aside>
      <div class="nb-content">

      <!-- Kernel -->
      <div v-if="step === S.KERNEL" class="wizard-step">
        <p class="wizard-step-desc">Choose the kernel for this notebook.</p>
        <p v-if="!kernelChoices.length" class="wizard-step-desc">
          No notebook kernel can start with this data here. Go back to choose other data, or none.
        </p>
        <div class="kernel-grid">
          <div
            v-for="card in cards"
            :key="card.key"
            class="kernel-card"
            :class="{ selected: !!cardOf([card], form.workflowId) }"
            role="button"
            tabindex="0"
            @click="pickCard(card)"
            @keydown.enter.prevent="pickCard(card)"
            @keydown.space.prevent="pickCard(card)"
          >
            <span class="kernel-name">
              {{ kernelLabel(notebookKernel(cardWorkflow(card))) }}
              <RuntimeMark v-if="cardOffersGpu(card)" runtime="gpu" />
            </span>
            <!-- Where results go tells kernels apart only when it's fixed: a
                 notebook with an input and output chooses it later -->
            <span class="kernel-sub">{{ hasInterface(cardWorkflow(card)) ? cardWorkflow(card).summary || "You choose its input and results next" : kernelOutput(cardWorkflow(card)) || cardWorkflow(card).name }}</span>
          </div>
        </div>
        <p v-if="allHardware.some((o) => o.gpu)" class="resource-hint">
          You choose CPU or GPU after the compute node: GPU where the node has one.
        </p>
        <p v-else-if="selectedWorkflow && isGpu" class="resource-hint">
          This kernel runs on a GPU: the next step offers the nodes that can host it.
        </p>
      </div>

      <!-- Compute node -->
      <div v-if="step === S.NODE" class="wizard-step">
        <p class="wizard-step-desc">
          Select a compute node with notebook sessions enabled<template v-if="gpuFirst">, GPUs, and secure or compliant mode</template>.
        </p>
        <div v-if="selectedComputeNode" class="wizard-selection">
          <div class="wizard-selection-header">
            <span class="wizard-selection-name">{{ selectedComputeNode.name }}</span>
            <button class="wizard-selection-clear" @click="form.computeNodeId = ''">
              &times;
            </button>
          </div>
          <div v-if="selectedComputeNode.description" class="wizard-selection-desc">
            {{ selectedComputeNode.description }}
          </div>
          <div class="wizard-card-offer">{{ gpuOffer(selectedGpu) }}</div>
          <div v-if="nodeCapacityLabel(selectedComputeNode)" class="wizard-card-capacity">{{ nodeCapacityLabel(selectedComputeNode) }}</div>
          <p v-if="offlineNote(selectedComputeNode)" class="resource-hint">{{ offlineNote(selectedComputeNode) }}</p>
          <p v-if="nodeNote(selectedComputeNode)" class="data-hint">{{ nodeNote(selectedComputeNode) }}</p>
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
              v-for="cn in filteredComputeNodes"
              :key="cn.uuid"
              class="wizard-card"
              :class="{ 'is-unfit': nodeReasons(cn).length }"
              :aria-disabled="nodeReasons(cn).length > 0"
              @click="nodeReasons(cn).length || (form.computeNodeId = cn.uuid)"
            >
              <div class="wizard-card-head">
                <span class="wizard-card-name">{{ cn.name }}</span>
                <NodeTierBadge :node="cn" />
              </div>
              <div v-if="cn.description" class="wizard-card-desc">
                {{ cn.description }}
              </div>
              <!-- What it offers: its GPU (the node's tier), or CPU only -->
              <div class="wizard-card-offer">{{ gpuOffer(gpuOf(cn)) }}<template v-if="offlineNote(cn)"> · No internet access</template></div>
              <!-- Its notebooks in use, everyone's and the caller's -->
              <div v-if="nodeCapacityLabel(cn)" class="wizard-card-capacity">{{ nodeCapacityLabel(cn) }}</div>
              <!-- The data chosen: in another region, it costs transfer -->
              <div v-if="nodeNote(cn)" class="data-hint data-hint--card">{{ nodeNote(cn) }}</div>
              <!-- Hardware chosen first (a GPU kernel): why this node can't host it -->
              <div v-if="nodeReasons(cn).length" class="wizard-card-why" :title="gpuReasonNote(nodeReasons(cn)) || undefined">
                {{ nodeReasons(cn).join(" · ") }}
                <span v-if="gpuReasonNote(nodeReasons(cn))" class="wizard-card-note">{{ gpuReasonNote(nodeReasons(cn)) }}</span>
              </div>
            </div>
            <div v-if="filteredComputeNodes.length === 0" class="wizard-cards-loading">
              No compute nodes available.
            </div>
          </div>
        </template>
      </div>

      <!-- Hardware: what the chosen node can run, as cards to compare -->
      <div v-if="step === S.HARDWARE" class="wizard-step">
        <p v-if="nodeHardware.length" class="wizard-step-desc">Where should this notebook run?</p>
        <p v-if="imagingData" class="data-hint">
          This is imaging data: a GPU can speed up deep learning, registration and segmentation.
        </p>
        <div v-if="nodeHardware.length" class="hardware-grid" role="radiogroup" aria-label="Hardware">
          <button
            v-for="o in nodeHardware"
            :key="o.workflowId + '|' + o.variant"
            type="button"
            role="radio"
            class="hardware-card"
            :class="{ selected: o === currentHardware }"
            :aria-checked="o === currentHardware"
            @click="pickHardware(o)"
          >
            <span class="hardware-card__name"><RuntimeMark v-if="o.gpu" runtime="gpu" compact />{{ o.gpu ? "GPU" : o.name || "CPU" }}</span>
            <template v-if="o.gpu && selectedGpu">
              <span class="hardware-card__main">{{ gpuName(selectedGpu) }} GPU memory</span>
              <span class="hardware-card__line">{{ gpuTaskResources(selectedGpu, " · ") }}, the whole instance<template v-if="selectedGpu.instanceType"> ({{ selectedGpu.instanceType }})</template></span>
              <span class="hardware-card__meta">Starts in 2–3 minutes<template v-if="selectedGpu.pricePerHour"> · about ${{ selectedGpu.pricePerHour.toFixed(2) }}/h while open</template></span>
            </template>
            <template v-else-if="!o.gpu && !(o.cpu || o.memory)">
              <span class="hardware-card__main">Fargate task</span>
              <span class="hardware-card__line">You choose CPU, memory and disk below</span>
              <span class="hardware-card__meta">Starts in about a minute</span>
            </template>
            <span v-else-if="o.description" class="hardware-card__line">{{ o.description }}</span>
          </button>
        </div>
        <p v-if="noGpuHere" class="resource-hint">{{ noGpuHere }}</p>

        <!-- Its resources: chosen for a CPU session, else set. A GPU's disk
             is its instance's, not chosen yet. -->
        <p v-if="isGpu" class="resource-hint">
          Disk: {{ GPU_INSTANCE_DISK_GIB }} GB, the GPU instance's own, shared with the notebook's
          environment. Download the folders you need rather than a whole large dataset.
        </p>
        <p v-if="variantResourcesSet && !isGpu && variantResources(selectedVariant)" class="resource-hint">
          Resources: {{ variantResources(selectedVariant) }}, set by the kernel.
        </p>
        <template v-else-if="!variantResourcesSet">
        <div class="resource-grid" :class="{ 'resource-grid--below': nodeHardware.length }">
          <div class="resource-field">
            <label class="resource-label">CPU</label>
            <el-select v-model="resourceCpu" size="default" style="width: 100%">
              <el-option
                v-for="opt in cpuOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="resource-field">
            <label class="resource-label">Memory</label>
            <el-select v-model="resourceMemory" size="default" style="width: 100%">
              <el-option
                :label="`Automatic (${memoryLabel(autoMemoryForCpu(resourceCpu))})`"
                :value="AUTO_MEMORY"
              />
              <el-option
                v-for="opt in memoryOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="resource-field">
            <label class="resource-label">Disk</label>
            <el-select v-model="resourceDisk" size="default" style="width: 100%" @change="diskTouched = true">
              <el-option
                v-for="opt in diskOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </div>
        <p class="resource-hint">
          Memory is set automatically based on the CPU unless you pick a specific
          value. Higher tiers cost more — start small and scale up if needed.
        </p>
        <p v-if="diskSuggestion" class="data-hint">
          The data is {{ formatSize(dataBytes) }} in all: {{ diskSuggestion }} GB fits it with room for the
          environment<template v-if="dataBytes > 180 * 2 ** 30">, but not all of it: download the folders you need</template>.
        </p>
        <p class="resource-hint">{{ diskHint }}</p>
        </template>
      </div>

      <!-- Input (a notebook with an input: what it starts with) -->
      <div v-if="step === S.INPUT" class="io-split">
      <div class="io-side">
      <template v-if="inputChoices.includes('dataset')">
        <div class="io-choices-label">Your workspace</div>
        <div class="io-choices">
          <button
            type="button"
            class="io-choice"
            :class="{ 'is-picked': inputChoice === 'dataset' }"
            @click="inputChoice = 'dataset'"
          >
            <span class="io-choice__name">{{ INPUT_CHOICES.dataset.label }}</span>
            <span class="io-choice__desc">{{ INPUT_CHOICES.dataset.desc }}</span>
          </button>
        </div>
      </template>
      <!-- The data platforms, in their groups (PlatformList). -->
      <template v-if="platformKeys.length">
        <PlatformList
          class="io-platforms"
          :offered="platformKeys"
          :model-value="choicePlatform"
          @update:model-value="inputChoice = choiceOf($event)"
        />
        <p class="io-platform__note">You pick which files to download from the notebook.</p>
      </template>
      </div>
      <div class="io-main">
      <div v-if="step === S.INPUT && inputChoice === 'none'" class="wizard-step">
        <p class="wizard-step-desc">The notebook starts with an empty <code>input/</code> folder.</p>
      </div>
      <!-- A data platform's picker (PlatformPane), bound to the selection. -->
      <div v-else-if="step === S.INPUT && choicePlatform" class="wizard-step">
        <PlatformPane :platform="choicePlatform" :selection="sel" />
      </div>
      <div v-else-if="step === S.INPUT && showDatasetInput" class="wizard-step">
        <h4 class="io-section-title">Choose a dataset</h4>
        <div v-if="selectedDataset" class="wizard-selection">
          <div class="wizard-selection-header">
            <span class="wizard-selection-name">{{ selectedDataset.content?.name }}</span>
            <button class="wizard-selection-clear" @click="form.datasetId = ''">
              &times;
            </button>
          </div>
          <div v-if="selectedDataset.content?.description" class="wizard-selection-desc">
            {{ selectedDataset.content.description }}
          </div>
        </div>
        <div v-if="viewOnly" class="view-only-note">
          <p>
            You can view this dataset but not save to it, and this notebook saves
            its results to a dataset.
          </p>
          <p v-if="alternativeKernel">
            <button type="button" class="view-only-switch" @click="form.workflowId = alternativeKernel.uuid">
              Start the {{ kernelLabel(notebookKernel(alternativeKernel)) }} notebook with
              {{ kernelOutput(alternativeKernel).toLowerCase() || "no saved results" }}
            </button>
            instead, or
          </p>
          <p>{{ alternativeKernel ? "c" : "C" }}hoose a dataset you can edit for the results in the next steps.</p>
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
            <div v-if="datasetSearchLoading" class="wizard-cards-loading">
              Searching...
            </div>
            <div
              v-for="ds in datasetOptions"
              :key="ds.content?.id"
              class="wizard-card"
              @click="form.datasetId = ds.content?.id"
            >
              <div class="wizard-card-name">
                {{ ds.content?.name }}
                <span v-if="isViewOnly(ds)" class="wizard-card-tag">View only</span>
              </div>
              <div v-if="ds.content?.description" class="wizard-card-desc">
                {{ ds.content.description }}
              </div>
            </div>
            <div
              v-if="!datasetSearchLoading && datasetOptions.length === 0"
              class="wizard-cards-loading"
            >
              No datasets found
            </div>
          </div>
        </template>
      </div>

      </div>
      </div>

      <!-- Input files -->
      <div v-if="step === S.FILES && (!personal || iface)" class="wizard-step">
        <div v-if="definitionLoading" class="wizard-cards-loading">
          Loading notebook inputs...
        </div>
        <template v-else>
          <p class="wizard-step-desc">
            Select the input files to stage into the notebook's
            <code>input/</code> folder.
          </p>
          <div v-if="dataSourceNodes.length > 1" class="source-tabs">
            <button
              v-for="node in dataSourceNodes"
              :key="node.id"
              class="source-tab"
              :class="{ active: node.id === currentSourceNodeId }"
              @click="selectSourceNode(node.id)"
            >
              {{ sourceLabel(node.id, configDefinition?.dag || [], node.name || "Input data") }}
              <span class="source-tab-count">{{ fileCountForNode(node.id) }}</span>
            </button>
          </div>
          <div v-if="dataSourceNodes.length === 0" class="wizard-cards-loading">
            This notebook has no input — continue to start a blank session.
          </div>
          <template v-else>
            <div class="file-picker-header">
              <strong>{{ fileCountForNode(currentSourceNodeId) }}</strong>
              file{{ fileCountForNode(currentSourceNodeId) !== 1 ? "s" : "" }}
              selected
            </div>
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
          </template>
        </template>
      </div>

      <!-- Output destination -->
      <div v-if="step === S.OUTPUT" class="wizard-step">
        <p class="wizard-step-desc">
          {{ iface ? "Where the notebook's results (its output/ folder) go when the session ends." : "Configure where the notebook's results are saved." }}
        </p>

        <div :class="{ 'io-split': iface }">
        <div v-if="iface" class="io-side">
        <div class="io-choices-label">Results go to</div>
        <div class="io-choices">
          <button
            v-for="t in outputChoices"
            :key="t"
            type="button"
            class="io-choice"
            :class="{ 'is-picked': outputChoice === t }"
            @click="outputChoice = t"
          >
            <span class="io-choice__name">{{ outputLabel(t) }}</span>
            <span class="io-choice__desc">{{ outputDesc(t) }}</span>
          </button>
        </div>
        </div>
        <div class="io-main">
        <p v-if="iface && outputChoice === NO_DESTINATION" class="wizard-step-desc">
          The session's <code>output/</code> folder isn't saved anywhere when it ends.
        </p>
        <template v-if="!iface || outputChoice !== NO_DESTINATION">
        <h4 v-if="iface" class="io-section-title">{{ outputWritesDataset ? "Dataset and folder" : "Download" }}</h4>
        <div v-if="chooseResultsDataset" class="target-block">
          <div class="target-block-title">Save results to</div>
          <div class="target-param-desc">
            {{ viewOnly ? `You can only view ${selectedDataset?.content?.name}: choose a dataset you can edit.` : "Choose the dataset to save the results to." }}
          </div>
          <div v-if="resultsDataset" class="wizard-selection">
            <div class="wizard-selection-header">
              <span class="wizard-selection-name">{{ resultsDataset.content?.name }}</span>
              <button class="wizard-selection-clear" @click="resultsDatasetId = ''">&times;</button>
            </div>
          </div>
          <template v-else>
            <el-input
              v-model="resultsQuery"
              placeholder="Search datasets you can edit..."
              clearable
              class="wizard-search"
              @input="onResultsSearch"
            />
            <div class="wizard-cards">
              <div v-if="resultsLoading" class="wizard-cards-loading">Searching...</div>
              <div
                v-for="ds in resultsOptions"
                :key="ds.content?.id"
                class="wizard-card"
                @click="resultsDatasetId = ds.content?.id"
              >
                <div class="wizard-card-name">{{ ds.content?.name }}</div>
              </div>
              <div v-if="!resultsLoading && !resultsOptions.length" class="wizard-cards-loading">
                No datasets you can edit found
              </div>
            </div>
          </template>
        </div>
        <div
          v-if="!chooseResultsDataset && (dataTargetNodes.length === 0 || !hasVisibleTargetParams)"
          class="wizard-cards-loading"
        >
          This notebook saves results to its output folder automatically — no
          destination to configure.
        </div>
        <template v-else>
          <div v-for="node in dataTargetNodes" :key="node.id" class="target-block">
            <div class="target-block-title">{{ node.name || "Output" }}</div>
            <template
              v-for="(p, i) in dataTargetConfigs[node.id]?.params || []"
              :key="p.name"
            >
              <div v-if="!isHiddenTargetParam(p.name)" class="target-param">
                <!-- Notify: one checkbox. "auto" emails unless you're on the
                     archive's page, which is what "email me" should mean. -->
                <el-checkbox
                  v-if="(iface ? outputChoice : node.targetType) === 'download' && p.name === 'notify'"
                  :model-value="p.value !== 'none'"
                  @update:model-value="(on) => (dataTargetConfigs[node.id].params[i].value = on ? 'auto' : 'none')"
                >
                  Email me when it's ready
                </el-checkbox>
                <template v-else>
                  <label class="target-param-label">
                    {{ targetParamLabel(p.name) }}
                    <span v-if="p.required" class="target-param-req">*</span>
                  </label>
                  <el-input
                    v-model="dataTargetConfigs[node.id].params[i].value"
                    :placeholder="p.description || p.name"
                    size="small"
                    @input="p.followsRunName = false"
                  />
                  <div v-if="p.description && targetParamLabel(p.name) === p.name" class="target-param-desc">
                    {{ p.description }}
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>
        </template>
        </div>
        </div>
      </div>

      <!-- Name & Start: one column, what's chosen under the name. -->
      <div v-if="step === S.REVIEW" class="wizard-step nb-review">
        <label class="nb-review__name">
          <span class="nb-review__label">Name</span>
          <el-input v-model="runName" placeholder="e.g. jupyter-jdoe-2026-06-08" maxlength="64" @input="nameTouched = true" />
        </label>
        <dl class="nb-info__list nb-review__list">
          <template v-for="row in soFar" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
        <p v-if="isGpu" class="resource-hint">{{ selectedGpu?.model ? `Runs on the node's ${selectedGpu.model}. ` : "" }}{{ GPU_NOTE }}</p>
        <p v-if="showPublicInput && publicDataset && !dataSourceNodes.length" class="public-warning">
          This notebook has no input to attach {{ publicDataset.name }} to, so
          it would start without it.
        </p>
      </div>
      </div>
      </div>
    </div>

    <template #footer>
      <div class="run-dialog-footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <div class="wizard-footer-right">
          <bf-button v-if="step > 0" class="secondary" @click="back">Back</bf-button>
          <!-- No input data: chosen and on, in one click. -->
          <bf-button v-if="step === S.INPUT && inputChoices.includes('none')" class="secondary" @click="startWithoutData">
            No input data
          </bf-button>
          <bf-button
            v-if="step < stepTitles.length - 1"
            :disabled="!canNext"
            @click="next"
          >
            Next
          </bf-button>
          <bf-button v-else :disabled="!canNext" :processing="executing" @click="execute">
            Start Notebook
          </bf-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

/* A choice of what a notebook starts with, or where its results go */
.io-choices-label {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
/* Two columns: the choices on the left, what the chosen one needs on the
   right, apart by a rule */
/* The dialog is at most 90vh (nb-dialog, below): a step scrolls between its
   progress and its buttons, and Choose Data's columns fill that space and
   scroll each on its own, ending together above the buttons. */
.wizard-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.nb-layout {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}
.nb-layout.is-split {
  display: flex;
  flex-direction: column;
  overflow: hidden;

  > .nb-content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }
}
.io-split {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: 340px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 20px;
  min-height: 320px;
}
.io-side,
.io-main {
  min-height: 0;
  padding-bottom: 2px; /* the last card's border */
}
.io-side {
  padding-right: 20px;
  overflow-y: auto;
  border-right: 1px solid theme.$gray_2;
}
/* The step's dataset list takes the rest of the column, down to the
   buttons (the pickers' own lists are a fixed height elsewhere). */
.io-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow-y: auto;

  > .wizard-step {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }
  /* The workspace's dataset list fills the column; a platform's picker
     does so itself (PlatformPane). */
  > .wizard-step > .wizard-cards {
    flex: 1 1 auto;
    min-height: 160px;
    max-height: none;
  }

  > .wizard-step {
    padding-top: 0;
  }
}
.io-choices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* A hint from the data chosen (dataHints) */
.data-hint {
  margin: 6px 0;
  padding: 6px 10px;
  border-left: 2px solid theme.$teal_2;
  background: theme.$teal_tint;
  font-size: 12px;
  color: theme.$gray_5;
}
.data-hint--card {
  margin: 6px 0 0;
}
/* The platforms (PlatformList) below the workspace's choice. */
.io-choices + .io-platforms {
  margin-top: 16px;
}
.io-choices-label--group {
  margin-top: 16px;
}
.io-choice.io-platform {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}
.io-platform__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.io-platform__count {
  margin-top: 2px;
  font-size: 12px;
  color: theme.$gray_4;
}
.io-platform__note {
  margin: 8px 0 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.io-platform-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.io-section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.io-choice {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
  /* Chosen: its whole outline in purple and a faint tint (an accent on
     one side would curl round the corners). */
  &.is-picked {
    border-color: theme.$purple_3;
    background: theme.$gray_1;
  }
}
.io-choice__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.io-choice__desc {
  font-size: 11px;
  line-height: 1.35;
  color: theme.$gray_4;
}

.wizard-body {
  min-height: 300px;
}

.nb-layout.has-info {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 20px;
  min-height: 320px;
}
.nb-info {
  padding-right: 20px;
  border-right: 1px solid theme.$gray_2;
  font-size: 13px;
  color: theme.$gray_5;
}
.nb-info__about {
  margin: 0 0 16px;
  line-height: 1.5;
}
.nb-info__title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.nb-info__list {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 10px;
  margin: 0;

  dt {
    color: theme.$gray_4;
  }
  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: theme.$gray_6;
  }
}
.nb-content {
  min-width: 0;
}
/* A narrow screen: the step alone */
@media (max-width: 900px) {
  .nb-layout.has-info,
  .io-split {
    display: block;
  }
  .nb-info {
    display: none;
  }
  .nb-layout.is-split {
    overflow-y: auto;
  }
  .io-side,
  .io-main {
    overflow-y: visible;
  }
  .io-side {
    margin-bottom: 16px;
    padding-right: 0;
    border-right: none;
  }
}
.wizard-progress {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 20px;
}
.wizard-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: theme.$gray_2;
}
.wizard-dot.active {
  background: theme.$purple_1;
}
.wizard-dot.done {
  background: theme.$green_1;
}
.wizard-step--disabled {
  opacity: 0.6;
}
.wizard-step-desc {
  color: theme.$gray_5;
  font-size: 13px;
  margin: 0 0 14px;
}
.wizard-step-desc code {
  background: theme.$gray_1;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}
.wizard-search {
  margin-bottom: 12px;
}

/* kernel picker */
.kernel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.kernel-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  background: #fff;
  text-align: left;
}
.kernel-card:hover {
  border-color: theme.$purple_1;
  background: theme.$gray_1;
}
.kernel-card.selected {
  border-color: theme.$purple_1;
  background: theme.$purple_tint;
}
.kernel-name {
  font-weight: 700;
  font-size: 16px;
  color: theme.$gray_6;
}
.kernel-sub {
  font-size: 12px;
  color: theme.$gray_4;
}
.kernel-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.hardware-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.hardware-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 16px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.hardware-card:hover {
  border-color: theme.$purple_1;
  background: theme.$gray_1;
}
.hardware-card.selected {
  border-color: theme.$purple_1;
  background: theme.$purple_tint;
}
.hardware-card__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 16px;
  color: theme.$gray_6;
}
.hardware-card__main {
  font-size: 14px;
  color: theme.$gray_6;
}
.hardware-card__line {
  font-size: 13px;
  color: theme.$gray_5;
}
.hardware-card__meta {
  font-size: 12px;
  color: theme.$gray_4;
}
.wizard-card.is-unfit {
  cursor: not-allowed;
  opacity: 0.6;
}
.wizard-card-capacity {
  margin-top: 2px;
  font-size: 12px;
  color: theme.$gray_5;
}
.wizard-card-why {
  margin-top: 4px;
  font-size: 12px;
  color: theme.$gray_5;
}
.wizard-card-note {
  display: block;
  margin-top: 2px;
  color: theme.$gray_4;
}

.wizard-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.wizard-card {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
}
.wizard-card:hover {
  border-color: theme.$purple_1;
  background: theme.$gray_1;
}
.view-only-note {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: theme.$gray_1;
  font-size: 13px;
  color: theme.$gray_6;
  p {
    margin: 0 0 4px;
  }
  p:last-child {
    margin-bottom: 0;
  }
}
.view-only-switch {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: theme.$purple_1;
  text-decoration: underline;
  cursor: pointer;
}
.wizard-card-tag {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 11px;
  font-weight: 400;
  color: theme.$gray_5;
}
/* A node's name, then its tier. */
.wizard-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.wizard-card-name {
  font-weight: 600;
  font-size: 14px;
  color: theme.$gray_6;
}
.wizard-card-desc {
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 4px;
}
.wizard-card-offer {
  font-size: 12px;
  color: theme.$gray_5;
  margin-top: 4px;
}
.wizard-cards-loading {
  color: theme.$gray_4;
  font-size: 13px;
  padding: 12px 0;
}
.wizard-selection {
  border: 1px solid theme.$purple_1;
  border-radius: 6px;
  padding: 12px;
  background: theme.$purple_tint;
}
.wizard-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wizard-selection-name {
  font-weight: 600;
  color: theme.$gray_6;
}
.wizard-selection-clear {
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: theme.$gray_4;
}
.wizard-selection-desc {
  font-size: 12px;
  color: theme.$gray_5;
  margin-top: 4px;
}

/* file picker */
.source-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.source-tab {
  border: 1px solid theme.$gray_2;
  background: #fff;
  border-radius: 14px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  gap: 6px;
  align-items: center;
}
.source-tab.active {
  border-color: theme.$purple_1;
  color: theme.$purple_1;
  background: theme.$purple_tint;
}
.source-tab-count {
  background: theme.$gray_2;
  border-radius: 8px;
  padding: 0 6px;
  font-size: 11px;
}
.file-picker-header {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 8px;
}
.breadcrumb-wrapper {
  margin-bottom: 8px;
}
.files-table-container {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
}

/* compute resources */
.resource-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.resource-field {
  display: flex;
  flex-direction: column;
}
.resource-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  margin-bottom: 6px;
}
.public-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.wizard-card.public-row {
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: theme.$purple_1;
    background: theme.$purple_tint;
  }
}
.public-banner {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}
.public-banner-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.public-info {
  flex: 1;
  min-width: 0;
}
.public-name {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
}
.public-authors {
  font-size: 12px;
  color: theme.$gray_6;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.public-org {
  font-size: 12px;
  color: theme.$gray_5;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.public-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 4px;
}
.public-selection .public-version {
  padding-left: 68px;
}
.public-warning {
  font-size: 12px;
  color: theme.$red_2;
  line-height: 1.5;
  margin: 14px 0 0;
}
.public-version {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;

  .resource-label {
    margin-bottom: 0;
  }
}
.resource-hint {
  font-size: 12px;
  color: theme.$gray_4;
  line-height: 1.5;
  margin: 14px 0 0;
}

/* output targets */
.target-block {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
}
.target-block-title {
  font-weight: 600;
  font-size: 13px;
  color: theme.$gray_6;
  margin-bottom: 10px;
}
.target-param {
  margin-bottom: 10px;
}
.target-param-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  margin-bottom: 4px;
}
.target-param-req {
  color: theme.$red_2;
}
.target-param-desc {
  font-size: 11px;
  color: theme.$gray_4;
  margin-top: 3px;
}

/* review */
.run-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wizard-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.resource-grid--below {
  margin-top: 20px;
}
.nb-review {
  max-width: 560px;
  margin: 0 auto;
  width: 100%;
}
.nb-review__name {
  display: block;
  margin-bottom: 20px;
}
.nb-review__label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
}
.nb-review__list {
  margin: 0 0 12px;
  padding: 14px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  gap: 8px 16px;

  dd {
    white-space: normal;
  }
}
</style>

<style lang="scss">
/* The dialog (teleported, so not scoped): at most 90vh, its body taking
   what the title and buttons leave, for the steps to scroll in. */
.el-dialog.nb-dialog {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  margin-bottom: 0;

  > .el-dialog__body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
  }
}
</style>
