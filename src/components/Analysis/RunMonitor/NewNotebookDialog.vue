<script setup>
// Self-contained "New Notebook" launcher. A guided flow:
//   Kernel → Compute Node → Dataset → Input Files → Output → Review & Start.
// Outside a workspace the dataset is a public one (see the `personal` prop).
// It references a published notebook workflow (the recipe lives there), reuses
// the standard file picker, and assembles the createRun payload directly —
// no detour through the generic run-configure screen.
//
// Diverged enough from the standard run config that it lives on its own; opened
// via v-model and emits `created` with the new run.
import { isPathPrefixParam, targetParamLabel, defaultsToRunName, targetWritesToDataset, canWriteDataset, searchDatasets } from "./dataTargets";
import { hasInterface, withInterfaceNodes, destinationChoices, NO_DESTINATION } from "./workflowInterface";
import { computed, reactive, ref, watch } from "vue";
import { useStore } from "vuex";
import BfButton from "../../shared/bf-button/BfButton.vue";
import AnalysisFilesTable from "../../FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "../../datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue";
import IconCompass from "@/components/icons/IconCompass.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import EventBus from "@/utils/event-bus";
import {
  notebookKernel,
  kernelLabel,
  interactiveCapable,
  launchableKernels,
  kernelOutput,
  nonSavingAlternative,
  kernelCards,
  cardOf,
  notebookGpu,
  gpuSessionUnfit,
} from "./notebookHelpers";
import { fetchVariantGate, provisionerGateReason } from "./variantGate";
import RuntimeMark from "../WorkflowGraph/RuntimeMark.vue";
import { STANDARD_CPU_OPTIONS, getStandardMemoryOptions, getTargetTypeLabel } from "./runHelpers";
import { sourceLabel } from "../WorkflowGraph/sourceInputs";
import * as siteConfig from "@/site-config/site.json";
import { viewsServiceUrl, viewForDataset, viewDataSource } from "@/utils/viewsService";
import { searchPublicDatasets as findPublicDatasets } from "@/utils/publicDatasets";

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
const kernelChoices = computed(() => launchableKernels(props.notebookWorkflows, { personal: props.personal }));
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
const form = ref({ workflowId: "", computeNodeId: "", datasetId: "" });
const runName = ref("");
const computeNodeSearch = ref("");
const datasetOptions = ref([]);
const datasetSearchLoading = ref(false);
const datasetSearchQuery = ref("");
let datasetSearchTimer = null;
const executing = ref(false);

const stepTitles = computed(() => [
  "Select Kernel",
  "Select Compute Node",
  "Compute Resources",
  iface.value ? "Input" : "Select Dataset",
  "Select Input Files",
  iface.value ? "Results" : "Output Destination",
  "Review & Start",
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
// A GPU kernel (the session app's gpu variant) needs a node with GPUs, in
// secure mode, whose provisioner passes the variant gate; other nodes stay
// listed, greyed out with why. Starting one takes a few minutes, and the
// instance is billed while the notebook is open.
const isGpu = computed(() => notebookGpu(selectedWorkflow.value));
const GPU_LABEL = "GPU (NVIDIA T4)";
const GPU_NOTE = "Starting takes a few minutes; the instance is billed while the notebook is open.";
const variantGate = ref(null);
const nodeReasons = (cn) =>
  isGpu.value ? gpuSessionUnfit(cn, (n) => provisionerGateReason(n, variantGate.value || {})) : [];
// The kernel card's toggle: the same kernel's other workflow.
const setHardware = (card, gpu) => {
  const wf = gpu ? card.gpu : card.cpu;
  if (wf) form.value.workflowId = wf.uuid;
};
const pickCard = (card) => {
  if (cardOf([card], form.value.workflowId)) return;
  form.value.workflowId = (card.cpu || card.gpu).uuid;
};
const cardWorkflow = (card) => (cardOf([card], form.value.workflowId) ? selectedWorkflow.value : card.cpu || card.gpu);

/* --------------------------------------------------------- compute nodes ---- */
// A node can host a notebook only if it has interactive sessions enabled — only
// those are offered (no fallback to the full list). Shared predicate so the
// Notebooks page filters nodes consistently everywhere.
const interactiveComputeNodes = computed(() =>
  computeNodes.value.filter(interactiveCapable)
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
// A node chosen for a CPU kernel that can't host the GPU one: chosen again.
watch(isGpu, () => {
  if (selectedComputeNode.value && nodeReasons(selectedComputeNode.value).length) form.value.computeNodeId = "";
});
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
  public: { label: "A public dataset", desc: "A published dataset; you pick its files from the notebook" },
  none: { label: "No input", desc: "Start with an empty input/ folder" },
};
const inputChoices = computed(() => {
  const c = [];
  if (!props.personal && ifaceInput.value) c.push("dataset");
  if (publicInputs && ifaceInput.value) c.push("public");
  if (!ifaceInput.value || ifaceInput.value.optional) c.push("none");
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
// Choices start from what the workflow suggests: a dataset's files in a
// workspace (else a public dataset), and the output's default.
watch(
  () => [form.value.workflowId, iface.value],
  () => {
    if (!iface.value) return;
    const inputs = inputChoices.value;
    inputChoice.value = inputs.includes(props.personal ? "public" : "dataset") ? (props.personal ? "public" : "dataset") : inputs[0] || "";
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
// A public dataset as a workspace notebook's input: its search starts once
// it's chosen.
watch(inputChoice, (c) => {
  if (c === "public" && publicInputs && !publicResults.value.length && !publicLoading.value) searchPublicDatasets();
});
const showPublicInput = computed(() => (iface.value ? inputChoice.value === "public" && publicInputs : props.personal && publicInputs));
const showDatasetInput = computed(() => (iface.value ? inputChoice.value === "dataset" : !props.personal));
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
    case 0:
      return !!form.value.workflowId;
    case 1:
      return !!form.value.computeNodeId && !(selectedComputeNode.value && nodeReasons(selectedComputeNode.value).length);
    case 2:
      return true; // resources always have a valid default (1 vCPU)
    case 3:
      if (iface.value) {
        return inputChoice.value === "dataset"
          ? !!form.value.datasetId
          : inputChoice.value === "public"
          ? !!publicDataset.value
          : inputChoice.value === "none";
      }
      return props.personal || !!form.value.datasetId;
    case 4:
      return (props.personal && !iface.value) || dataSourcesComplete.value;
    case 5:
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
const publicQuery = ref("");
const publicResults = ref([]);
const publicLoading = ref(false);
const publicDataset = ref(null); // { id, name, version, doi, fileCount, size }
const publicVersions = ref([]);
const publicVersion = ref(null);
let publicSearchTimer = null;

async function searchPublicDatasets(query = "") {
  publicLoading.value = true;
  try {
    publicResults.value = await findPublicDatasets(query);
  } catch (err) {
    console.error("Failed to search public datasets:", err);
    publicResults.value = [];
  } finally {
    publicLoading.value = false;
  }
}

const onPublicSearch = () => {
  clearTimeout(publicSearchTimer);
  publicSearchTimer = setTimeout(() => searchPublicDatasets(publicQuery.value), 300);
};

async function selectPublicDataset(d) {
  publicDataset.value = d;
  publicVersion.value = d.version;
  publicVersions.value = [d.version];
  try {
    const url = `${siteConfig.discoverUrl}/datasets/${d.id}/versions`;
    const response = await useSendXhr(url, { method: "GET" });
    const versions = (Array.isArray(response) ? response : [])
      .map((v) => v.version)
      .filter((v) => Number.isInteger(v))
      .sort((a, b) => b - a);
    if (versions.length) publicVersions.value = versions;
  } catch (err) {
    console.error("Failed to load the dataset's versions:", err);
  }
}

function clearPublicDataset() {
  publicDataset.value = null;
  publicVersion.value = null;
  publicVersions.value = [];
}

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
  form.value = { workflowId: "", computeNodeId: "", datasetId: "" };
  nameTouched.value = false;
  computeNodeSearch.value = "";
  datasetSearchQuery.value = "";
  publicQuery.value = "";
  clearPublicDataset();
  resourceCpu.value = DEFAULT_CPU;
  resourceMemory.value = AUTO_MEMORY;
  step.value = 0;
  configDefinition.value = null;
  resultsDatasetId.value = "";
  resultsQuery.value = "";
  inputChoice.value = "";
  outputChoice.value = "";
  Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
  Object.keys(dataTargetConfigs).forEach((k) => delete dataTargetConfigs[k]);
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  // Preselect the kernel asked for, or the only one if there's just one — but
  // keep the step visible.
  if (props.initialWorkflowId && kernelChoices.value.some((w) => w.uuid === props.initialWorkflowId)) {
    form.value.workflowId = props.initialWorkflowId;
  } else if (cards.value.length === 1) {
    // One kernel card (its CPU workflow, when it has CPU and GPU ones).
    form.value.workflowId = (cards.value[0].cpu || cards.value[0].gpu).uuid;
  }
  // Seed the suggested name ({kernel}-{user}-{date}) now that the kernel (if any)
  // is selected; the watcher keeps it current until the user edits it.
  runName.value = defaultRunName.value;
}

// Reset + load datasets each time the dialog opens.
watch(visible, (open) => {
  if (open) {
    reset();
    if (!variantGate.value) fetchVariantGate(config.value.api2Url, useGetToken).then((g) => (variantGate.value = g));
    if (!props.personal) fetchDatasetOptions();
    else if (publicInputs) searchPublicDatasets();
  }
});

// Outside a workspace there are no input files to pick: the user downloads a
// public dataset's files from the notebook itself.
const INPUT_FILES_STEP = 4;
// A GPU kernel runs with the resources its variant declares, on a GPU
// instance: no CPU and memory to choose.
const RESOURCES_STEP = 2;
const skipsStep = (i) =>
  (i === INPUT_FILES_STEP && (iface.value ? inputChoice.value !== "dataset" : props.personal)) ||
  (i === RESOURCES_STEP && isGpu.value);

const next = async () => {
  if (step.value === 3) await loadDefinition(); // leaving Dataset → load inputs
  let n = step.value + 1;
  while (skipsStep(n)) n++;
  if (n < stepTitles.value.length) step.value = n;
};
const back = () => {
  let n = step.value - 1;
  while (n > 0 && skipsStep(n)) n--;
  if (n >= 0) step.value = n;
};

/* ------------------------------------------------------- info column ------ */
// Input and Results show their own choices on the left (io-split); every
// other step, what it's for and what's chosen so far.
const stepHasChoices = computed(() => iface.value && (step.value === 3 || step.value === 5));
const STEP_ABOUT = [
  "A notebook is a live Jupyter session on a compute node. Choose its language.",
  "The compute node the session runs on. Only nodes with notebook sessions are offered.",
  "The CPU and memory the session gets. Memory follows the CPU unless you set it.",
  "The dataset the notebook works with.",
  "The files copied into the notebook's input/ folder before it starts.",
  "Where the notebook's results go when the session ends.",
  "Check the session, name it, and start it.",
];
const stepAbout = computed(() =>
  step.value === 1 && isGpu.value
    ? "The compute node the session runs on. A GPU notebook needs a node with GPUs, in secure mode."
    : STEP_ABOUT[step.value] || ""
);
const soFar = computed(() => {
  const rows = [];
  if (step.value > 0 && selectedWorkflow.value) rows.push({ label: "Kernel", value: kernelLabel(notebookKernel(selectedWorkflow.value)) });
  if (step.value > 0 && isGpu.value) rows.push({ label: "Hardware", value: GPU_LABEL });
  if (step.value > 1 && selectedComputeNode.value) rows.push({ label: "Compute node", value: selectedComputeNode.value.name });
  if (step.value > 2 && !isGpu.value) {
    rows.push({ label: "Resources", value: `${cpuLabel(resourceCpu.value)} · ${isAutoMemory.value ? memoryLabel(autoMemoryForCpu(resourceCpu.value)) : memoryLabel(resourceMemory.value)}` });
  }
  if (step.value > 3) {
    const input = iface.value
      ? inputChoice.value === "public"
        ? publicDataset.value?.name || "A public dataset"
        : inputChoice.value === "dataset"
        ? selectedDataset.value?.content?.name || "A dataset"
        : "No input"
      : props.personal
      ? publicDataset.value?.name || "None"
      : selectedDataset.value?.content?.name;
    if (input) rows.push({ label: "Input", value: input });
  }
  if (step.value > 4 && iface.value && inputChoice.value === "dataset") {
    rows.push({ label: "Files", value: String(dataSourceNodes.value.reduce((n, d) => n + fileCountForNode(d.id), 0)) });
  }
  if (step.value > 5 && iface.value) rows.push({ label: "Results", value: outputLabel(outputChoice.value) });
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
    if (!iface.value || inputChoice.value === "dataset") {
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
    // A GPU kernel: its variant's resources (no CPU and memory chosen).
    const processorConfigs = [];
    for (const node of dag) {
      if (isGpu.value) break;
      if (node.type === "data-source" || node.type === "data-target") continue;
      processorConfigs.push({
        nodeId: node.id,
        cpu: resourceCpu.value,
        memory: resolvedMemory.value,
      });
    }

    // Outside a workspace, the public dataset is the first data source's view.
    // It's a source's only input: the session downloads its files into it.
    const personalSources = {};
    const usesPublic = iface.value ? inputChoice.value === "public" : props.personal;
    if (usesPublic && publicDataset.value && dataSourceNodes.value.length) {
      const view = await viewForDataset({
        datasetId: publicDataset.value.id,
        version: publicVersion.value,
        name: publicDataset.value.name,
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
      dataSources: usesPublic ? personalSources : dataSources,
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
    width="min(840px, 96vw)"
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
      <div class="nb-layout" :class="{ 'has-info': !stepHasChoices }">
      <aside v-if="!stepHasChoices" class="nb-info">
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

      <!-- Step 0: Kernel -->
      <div v-if="step === 0" class="wizard-step">
        <p class="wizard-step-desc">Choose the kernel for this notebook.</p>
        <p v-if="!kernelChoices.length" class="wizard-step-desc">
          None of the notebook kernels can start outside a workspace yet: their results are saved to a dataset.
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
              <RuntimeMark v-if="notebookGpu(cardWorkflow(card))" runtime="gpu" />
            </span>
            <!-- Where results go tells kernels apart only when it's fixed: a
                 notebook with an input and output chooses it later -->
            <span class="kernel-sub">{{ hasInterface(cardWorkflow(card)) ? cardWorkflow(card).summary || "You choose its input and results next" : kernelOutput(cardWorkflow(card)) || cardWorkflow(card).name }}</span>
            <!-- CPU and GPU builds of the kernel (app variants) -->
            <div v-if="card.cpu && card.gpu" class="kernel-hardware" @click.stop>
              <span class="kernel-hardware__label">Hardware</span>
              <el-radio-group
                :model-value="cardOf([card], form.workflowId) && notebookGpu(selectedWorkflow) ? 'gpu' : 'cpu'"
                size="small"
                aria-label="Hardware"
                @update:model-value="(v) => setHardware(card, v === 'gpu')"
              >
                <el-radio-button value="cpu">CPU</el-radio-button>
                <el-radio-button value="gpu">GPU</el-radio-button>
              </el-radio-group>
            </div>
          </div>
        </div>
        <p v-if="isGpu" class="resource-hint">{{ GPU_LABEL }}. {{ GPU_NOTE }}</p>
      </div>

      <!-- Step 1: Compute node -->
      <div v-if="step === 1" class="wizard-step">
        <p class="wizard-step-desc">
          Select a compute node with notebook sessions enabled<template v-if="isGpu">, GPUs and secure mode</template>.
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
              <div class="wizard-card-name">{{ cn.name }}</div>
              <div v-if="cn.description" class="wizard-card-desc">
                {{ cn.description }}
              </div>
              <!-- A GPU kernel: why this node can't host it -->
              <div v-if="nodeReasons(cn).length" class="wizard-card-why">{{ nodeReasons(cn).join(" · ") }}</div>
            </div>
            <div v-if="filteredComputeNodes.length === 0" class="wizard-cards-loading">
              No compute nodes available.
            </div>
          </div>
        </template>
      </div>

      <!-- Step 2: Compute resources -->
      <div v-if="step === 2" class="wizard-step">
        <p class="wizard-step-desc">
          Choose the CPU and memory for this notebook's compute task.
        </p>
        <div class="resource-grid">
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
        </div>
        <p class="resource-hint">
          Memory is set automatically based on the CPU unless you pick a specific
          value. Higher tiers cost more — start small and scale up if needed.
        </p>
      </div>

      <!-- Step 3: Input (a notebook with an input: what it starts with) -->
      <div v-if="step === 3" :class="{ 'io-split': iface }">
      <div v-if="iface" class="io-side">
      <div class="io-choices-label">Start with</div>
      <div class="io-choices">
        <button
          v-for="c in inputChoices"
          :key="c"
          type="button"
          class="io-choice"
          :class="{ 'is-picked': inputChoice === c }"
          @click="inputChoice = c"
        >
          <span class="io-choice__name">{{ INPUT_CHOICES[c].label }}</span>
          <span class="io-choice__desc">{{ INPUT_CHOICES[c].desc }}</span>
        </button>
      </div>
      </div>
      <div class="io-main">
      <div v-if="step === 3 && iface && inputChoice === 'none'" class="wizard-step">
        <p class="wizard-step-desc">The notebook starts with an empty <code>input/</code> folder.</p>
      </div>
      <!-- Step 3: Dataset -->
      <div v-else-if="step === 3 && showPublicInput" class="wizard-step">
        <h4 v-if="iface" class="io-section-title">Choose a public dataset</h4>
        <p class="wizard-step-desc">
          Optionally choose a public dataset to work with. You pick which of
          its files to download from the notebook. Skip this step to start
          without input data.
        </p>
        <div v-if="publicDataset" class="wizard-selection public-selection">
          <div class="public-row">
            <div class="public-banner">
              <img v-if="publicDataset.banner" :src="publicDataset.banner" alt="" />
              <div v-else class="public-banner-placeholder">
                <IconCompass :width="20" :height="20" color="#b3bcce" />
              </div>
            </div>
            <div class="public-info">
              <div class="wizard-selection-header">
                <span class="wizard-selection-name">{{ publicDataset.name }}</span>
                <button class="wizard-selection-clear" @click="clearPublicDataset">
                  &times;
                </button>
              </div>
              <div v-if="publicDataset.authors" class="public-authors">
                {{ publicDataset.authors }}
              </div>
              <div v-if="publicDataset.organizationName" class="public-org">
                {{ publicDataset.organizationName }}
              </div>
              <div class="public-meta">
                <span>{{ publicDataset.fileCount }} files</span>
                <span>{{ formatSize(publicDataset.size) }}</span>
                <span v-if="publicDataset.doi">DOI {{ publicDataset.doi }}</span>
              </div>
            </div>
          </div>
          <div class="public-version">
            <label class="resource-label">Version</label>
            <el-select v-model="publicVersion" size="small" style="width: 140px">
              <el-option
                v-for="v in publicVersions"
                :key="v"
                :label="`Version ${v}`"
                :value="v"
              />
            </el-select>
          </div>
        </div>
        <template v-else>
          <el-input
            v-model="publicQuery"
            placeholder="Search public datasets..."
            clearable
            class="wizard-search"
            @input="onPublicSearch"
          />
          <div class="wizard-cards">
            <div v-if="publicLoading" class="wizard-cards-loading">Searching...</div>
            <div
              v-for="ds in publicResults"
              :key="ds.id"
              class="wizard-card public-row"
              @click="selectPublicDataset(ds)"
            >
              <div class="public-banner">
                <img v-if="ds.banner" :src="ds.banner" alt="" loading="lazy" />
                <div v-else class="public-banner-placeholder">
                  <IconCompass :width="20" :height="20" color="#b3bcce" />
                </div>
              </div>
              <div class="public-info">
                <div class="wizard-card-name public-name">{{ ds.name }}</div>
                <div v-if="ds.authors" class="public-authors">{{ ds.authors }}</div>
                <div v-if="ds.organizationName" class="public-org">
                  {{ ds.organizationName }}
                </div>
                <div class="public-meta">
                  <span>Version {{ ds.version }}</span>
                  <span>{{ ds.fileCount }} files</span>
                  <span>{{ formatSize(ds.size) }}</span>
                </div>
              </div>
            </div>
            <div
              v-if="!publicLoading && publicResults.length === 0"
              class="wizard-cards-loading"
            >
              No public datasets found
            </div>
          </div>
        </template>
      </div>
      <div v-else-if="step === 3 && personal && !iface" class="wizard-step wizard-step--disabled">
        <p class="wizard-step-desc">
          Selecting a dataset isn't available outside a workspace yet. Public
          datasets, and datasets from your workspaces, will be selectable here.
          For now the notebook starts without input data.
        </p>
        <el-input placeholder="Search datasets..." disabled class="wizard-search" />
      </div>
      <div v-else-if="step === 3 && showDatasetInput" class="wizard-step">
        <h4 v-if="iface" class="io-section-title">Choose a dataset</h4>
        <p v-else class="wizard-step-desc">Select the dataset to work with.</p>
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

      <!-- Step 4: Input files -->
      <div v-if="step === 4 && (!personal || iface)" class="wizard-step">
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

      <!-- Step 5: Output destination -->
      <div v-if="step === 5" class="wizard-step">
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

      <!-- Step 6: Review -->
      <div v-if="step === 6" class="wizard-step">
        <p class="wizard-step-desc">Review and start the notebook session.</p>
        <div class="wizard-summary">
          <div class="wizard-summary-row">
            <span class="wizard-summary-label">Kernel</span>
            <span class="wizard-summary-value">{{
              kernelLabel(notebookKernel(selectedWorkflow))
            }}</span>
          </div>
          <div class="wizard-summary-row">
            <span class="wizard-summary-label">Compute Node</span>
            <span class="wizard-summary-value">{{ selectedComputeNode?.name }}</span>
          </div>
          <div v-if="isGpu" class="wizard-summary-row">
            <span class="wizard-summary-label">Hardware</span>
            <span class="wizard-summary-value"><RuntimeMark runtime="gpu" compact />{{ GPU_LABEL }}</span>
          </div>
          <div v-else class="wizard-summary-row">
            <span class="wizard-summary-label">Resources</span>
            <span class="wizard-summary-value">
              {{ cpuLabel(resourceCpu) }} ·
              {{ isAutoMemory ? `${memoryLabel(autoMemoryForCpu(resourceCpu))} (auto)` : memoryLabel(resourceMemory) }}
            </span>
          </div>
          <div v-if="iface" class="wizard-summary-row">
            <span class="wizard-summary-label">Input</span>
            <span class="wizard-summary-value">{{
              inputChoice === "public"
                ? `${publicDataset?.name} (version ${publicVersion})`
                : inputChoice === "dataset"
                ? `${dataSourceNodes.reduce((n, d) => n + fileCountForNode(d.id), 0)} files from ${selectedDataset?.content?.name}`
                : "None"
            }}</span>
          </div>
          <div v-if="iface" class="wizard-summary-row">
            <span class="wizard-summary-label">Results</span>
            <span class="wizard-summary-value">{{
              outputWritesDataset
                ? `Saved to ${chooseResultsDataset ? resultsDataset?.content?.name : selectedDataset?.content?.name}`
                : outputLabel(outputChoice)
            }}</span>
          </div>
          <div v-if="personal && !iface" class="wizard-summary-row">
            <span class="wizard-summary-label">Public dataset</span>
            <span class="wizard-summary-value">{{
              publicDataset ? `${publicDataset.name} (version ${publicVersion})` : "None"
            }}</span>
          </div>
          <div v-if="!personal && !iface" class="wizard-summary-row">
            <span class="wizard-summary-label">Dataset</span>
            <span class="wizard-summary-value">{{ selectedDataset?.content?.name }}</span>
          </div>
          <div v-if="viewOnly && !iface" class="wizard-summary-row">
            <span class="wizard-summary-label">Results saved to</span>
            <span class="wizard-summary-value">{{ resultsDataset?.content?.name }}</span>
          </div>
          <div v-if="!personal && !iface" class="wizard-summary-row">
            <span class="wizard-summary-label">Input files</span>
            <span class="wizard-summary-value">
              {{ dataSourceNodes.reduce((n, d) => n + fileCountForNode(d.id), 0) }}
              selected
            </span>
          </div>
        </div>
        <p v-if="isGpu" class="resource-hint">{{ GPU_LABEL }}. {{ GPU_NOTE }}</p>
        <p v-if="showPublicInput && publicDataset && !dataSourceNodes.length" class="public-warning">
          This notebook has no input to attach {{ publicDataset.name }} to, so
          it would start without it.
        </p>
        <p v-else-if="showPublicInput && publicDataset" class="resource-hint">
          The notebook starts with the dataset's file list in
          <code>input/</code>. Choose which files to download from its
          <strong>Inputs</strong> panel.
        </p>
        <label class="name-label">Name</label>
        <el-input
          v-model="runName"
          placeholder="e.g. jupyter-jdoe-2026-06-08"
          size="small"
          maxlength="64"
          @input="nameTouched = true"
        />
      </div>
      </div>
      </div>
    </div>

    <template #footer>
      <div class="run-dialog-footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <div class="wizard-footer-right">
          <bf-button v-if="step > 0" class="secondary" @click="back">Back</bf-button>
          <bf-button
            v-if="step < stepTitles.length - 1"
            :disabled="!canNext"
            @click="next"
          >
            Next
          </bf-button>
          <bf-button v-else :processing="executing" @click="execute">
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
.io-split {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 20px;
  min-height: 320px;
}
.io-side {
  padding-right: 20px;
  border-right: 1px solid theme.$gray_2;
}
.io-main {
  min-width: 0;

  > .wizard-step {
    padding-top: 0;
  }
}
.io-choices {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  padding: 8px 10px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
  }
  &.is-picked {
    border-color: theme.$purple_1;
    background: #f5f3ff;
    box-shadow: inset 3px 0 0 theme.$purple_1;
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
.kernel-hardware {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  cursor: default;
}
.kernel-hardware__label {
  font-size: 12px;
  color: theme.$gray_5;
}
.wizard-card.is-unfit {
  cursor: not-allowed;
  opacity: 0.6;
}
.wizard-card-why {
  margin-top: 4px;
  font-size: 12px;
  color: theme.$gray_5;
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
  grid-template-columns: 1fr 1fr;
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
.wizard-summary {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.wizard-summary-row {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid theme.$gray_1;
  padding-bottom: 8px;
}
.wizard-summary-label {
  color: theme.$gray_4;
  font-size: 13px;
}
.wizard-summary-value {
  color: theme.$gray_6;
  font-weight: 500;
  font-size: 13px;
}
.name-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  margin-bottom: 4px;
}
.run-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wizard-footer-right {
  display: flex;
  gap: 8px;
}
</style>
