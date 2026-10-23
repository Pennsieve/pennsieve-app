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
import { computed, reactive, ref, watch } from "vue";
import { useStore } from "vuex";
import BfButton from "../../shared/bf-button/BfButton.vue";
import AnalysisFilesTable from "../../FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "../../datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue";
import EnvironmentLayerSelector from "./EnvironmentLayerSelector.vue";
import IconCompass from "@/components/icons/IconCompass.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import EventBus from "@/utils/event-bus";
import { notebookKernel, kernelLabel, interactiveCapable } from "./notebookHelpers";
import { STANDARD_CPU_OPTIONS, getStandardMemoryOptions } from "./runHelpers";
import * as siteConfig from "@/site-config/site.json";
import { viewsServiceUrl, viewForDataset, viewDataSource } from "@/utils/viewsService";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The published notebook workflows (one per kernel). Provided by the parent,
  // which already fetched them to gate the "New Notebook" button.
  notebookWorkflows: { type: Array, default: () => [] },
  // Launched from My Workspace, on the user's own compute node. There the
  // input is a public (Discover) dataset version, where the site has
  // views-service, or none. Its files aren't picked here: the notebook starts
  // with the dataset's file list, and the user downloads files from the
  // notebook's Inputs panel.
  personal: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "created"]);

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
const form = ref({ workflowId: "", computeNodeId: "", datasetId: "", environmentLayer: "" });
const runName = ref("");
const computeNodeSearch = ref("");
const datasetOptions = ref([]);
const datasetSearchLoading = ref(false);
const datasetSearchQuery = ref("");
let datasetSearchTimer = null;
const executing = ref(false);

const stepTitles = [
  "Select Kernel",
  "Select Compute Node",
  "Compute Resources",
  "Environment",
  "Select Dataset",
  "Select Input Files",
  "Output Destination",
  "Review & Start",
];

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
const isHiddenTargetParam = (name) => /bucket/i.test(name || "");
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
    props.notebookWorkflows.find((w) => w.uuid === form.value.workflowId) || null
);
const selectedComputeNode = computed(
  () => computeNodes.value.find((cn) => cn.uuid === form.value.computeNodeId) || null
);
const selectedDataset = computed(
  () => datasetOptions.value.find((d) => d.content?.id === form.value.datasetId) || null
);

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
      return !!form.value.computeNodeId;
    case 2:
      return true; // resources always have a valid default (1 vCPU)
    case 3:
      return true; // environment layer is optional
    case 4:
      return props.personal || !!form.value.datasetId;
    case 5:
      return props.personal || dataSourcesComplete.value;
    case 6:
      return dataTargetsComplete.value;
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

// The first two contributors, then "et al.": enough to tell datasets apart.
const authorsLine = (contributors = []) => {
  const names = (contributors || [])
    .map((c) => [c.firstName, c.lastName].filter(Boolean).join(" "))
    .filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")}, et al.`;
};

const toPublicDataset = (d) => ({
  id: d.id,
  name: d.name,
  version: d.version,
  doi: d.doi,
  fileCount: d.fileCount || 0,
  size: d.size || 0,
  description: d.description || "",
  banner: d.banner || "",
  organizationName: d.organizationName || "",
  authors: authorsLine(d.contributors),
  embargo: !!d.embargo,
});

async function searchPublicDatasets(query = "") {
  publicLoading.value = true;
  try {
    const base = siteConfig.discoverUrl;
    const url = query
      ? `${base}/search/datasets?limit=25&offset=0&query=${encodeURIComponent(query)}`
      : `${base}/datasets?limit=25&offset=0&datasetType=research&embargo=false`;
    const response = await useSendXhr(url, { method: "GET" });
    // Views take only openly published versions.
    publicResults.value = (response?.datasets || [])
      .map(toPublicDataset)
      .filter((d) => !d.embargo);
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
    configDefinition.value = def;
    console.log(
      "[Notebook] definition dag nodes:",
      (def?.dag || def?.processors || []).map((d) => ({ id: d.id, type: d.type }))
    );
    Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
    Object.keys(dataTargetConfigs).forEach((k) => delete dataTargetConfigs[k]);
    for (const node of dataTargetNodes.value) {
      const tt = targetTypes.value.find((t) => t.targetType === node.targetType);
      const paramDefs = tt?.params || [];
      dataTargetConfigs[node.id] = {
        params: paramDefs.map((pd) => ({
          name: pd.name,
          type: pd.type || "string",
          description: pd.description || "",
          required: pd.defaultValue == null,
          value:
            pd.defaultValue != null
              ? String(pd.defaultValue)
              : isOutputFolderParam(pd.name)
              ? "/"
              : "",
        })),
      };
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
  form.value = { workflowId: "", computeNodeId: "", datasetId: "", environmentLayer: "" };
  nameTouched.value = false;
  computeNodeSearch.value = "";
  datasetSearchQuery.value = "";
  publicQuery.value = "";
  clearPublicDataset();
  resourceCpu.value = DEFAULT_CPU;
  resourceMemory.value = AUTO_MEMORY;
  step.value = 0;
  configDefinition.value = null;
  Object.keys(dataSourceFiles).forEach((k) => delete dataSourceFiles[k]);
  Object.keys(dataTargetConfigs).forEach((k) => delete dataTargetConfigs[k]);
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  // Preselect the only kernel if there's just one — but keep the step visible.
  if (props.notebookWorkflows.length === 1) {
    form.value.workflowId = props.notebookWorkflows[0].uuid;
  }
  // Seed the suggested name ({kernel}-{user}-{date}) now that the kernel (if any)
  // is selected; the watcher keeps it current until the user edits it.
  runName.value = defaultRunName.value;
}

// Reset + load datasets each time the dialog opens.
watch(visible, (open) => {
  if (open) {
    reset();
    if (!props.personal) fetchDatasetOptions();
    else if (publicInputs) searchPublicDatasets();
  }
});

const next = async () => {
  if (step.value === 4) await loadDefinition(); // leaving Dataset → load inputs
  if (step.value < stepTitles.length - 1) step.value++;
};
const back = () => {
  if (step.value > 0) step.value--;
};

async function execute() {
  if (executing.value) return;
  executing.value = true;
  try {
    const dag = configDefinition.value?.dag || [];

    const dataSources = {};
    for (const [nodeId, files] of Object.entries(dataSourceFiles)) {
      const ids = files.map((f) => f.content?.id).filter(Boolean);
      if (ids.length) dataSources[nodeId] = { packageIds: ids };
    }

    const dataTargets = {};
    for (const node of dataTargetNodes.value) {
      const obj = {};
      (dataTargetConfigs[node.id]?.params || []).forEach((p) => {
        if (p.value?.trim()) obj[p.name] = p.value;
      });
      if (Object.keys(obj).length) dataTargets[node.id] = { params: obj };
    }

    // This is the notebook launcher, so the processor node(s) ARE the
    // interactive kernel — force interactive=true with the selected kernel's
    // sessionType (the published definition may not surface the flag here).
    const sessionType = notebookKernel(selectedWorkflow.value) || "jupyter";
    const processorConfigs = [];
    for (const node of dag) {
      if (node.type === "data-source" || node.type === "data-target") continue;
      processorConfigs.push({
        nodeId: node.id,
        interactive: true,
        sessionType,
        cpu: resourceCpu.value,
        memory: resolvedMemory.value,
      });
    }

    // Outside a workspace, the public dataset is the first data source's view.
    // It's a source's only input: the session downloads its files into it.
    const personalSources = {};
    if (props.personal && publicDataset.value && dataSourceNodes.value.length) {
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
      ...(!props.personal && { datasetId: form.value.datasetId }),
      dataSources: props.personal ? personalSources : dataSources,
      ...(name && { name }),
      ...(Object.keys(dataTargets).length > 0 && { dataTargets }),
      // Mount the selected environment layer (python-env / r-env). `layers` is a
      // run-request root field (workflow-service createRunRequestBody.Layers).
      ...(form.value.environmentLayer && { layers: [form.value.environmentLayer] }),
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
    :width="step === 5 && !personal ? '840px' : '560px'"
    :close-on-click-modal="false"
  >
    <div class="wizard-body">
      <div class="wizard-progress">
        <span
          v-for="(title, i) in stepTitles"
          :key="i"
          class="wizard-dot"
          :class="{ active: step === i, done: step > i }"
        />
      </div>

      <!-- Step 0: Kernel -->
      <div v-if="step === 0" class="wizard-step">
        <p class="wizard-step-desc">Choose the kernel for this notebook.</p>
        <div class="kernel-grid">
          <button
            v-for="wf in notebookWorkflows"
            :key="wf.uuid"
            class="kernel-card"
            :class="{ selected: form.workflowId === wf.uuid }"
            @click="form.workflowId = wf.uuid"
          >
            <span class="kernel-name">{{ kernelLabel(notebookKernel(wf)) }}</span>
            <span class="kernel-sub">{{ wf.name }}</span>
          </button>
        </div>
      </div>

      <!-- Step 1: Compute node -->
      <div v-if="step === 1" class="wizard-step">
        <p class="wizard-step-desc">
          Select a compute node with notebook sessions enabled.
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
              @click="form.computeNodeId = cn.uuid"
            >
              <div class="wizard-card-name">{{ cn.name }}</div>
              <div v-if="cn.description" class="wizard-card-desc">
                {{ cn.description }}
              </div>
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

      <!-- Step 3: Environment -->
      <div v-if="step === 3" class="wizard-step">
        <p class="wizard-step-desc">
          Optionally mount a prebuilt environment layer so its packages are
          importable in the notebook. Only layers matching this kernel
          ({{ notebookKernel(selectedWorkflow) === "r" ? "r-env" : "python-env" }})
          are shown.
        </p>
        <EnvironmentLayerSelector
          v-model="form.environmentLayer"
          :compute-node-id="form.computeNodeId"
          :session-type="notebookKernel(selectedWorkflow) || 'jupyter'"
        />
      </div>

      <!-- Step 4: Dataset -->
      <div v-if="step === 4 && personal && publicInputs" class="wizard-step">
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
      <div v-else-if="step === 4 && personal" class="wizard-step wizard-step--disabled">
        <p class="wizard-step-desc">
          Selecting a dataset isn't available outside a workspace yet. Public
          datasets, and datasets from your workspaces, will be selectable here.
          For now the notebook starts without input data.
        </p>
        <el-input placeholder="Search datasets..." disabled class="wizard-search" />
      </div>
      <div v-else-if="step === 4" class="wizard-step">
        <p class="wizard-step-desc">Select the dataset to work with.</p>
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
              <div class="wizard-card-name">{{ ds.content?.name }}</div>
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

      <!-- Step 5: Input files -->
      <div v-if="step === 5 && personal && publicDataset" class="wizard-step">
        <div v-if="definitionLoading" class="wizard-cards-loading">
          Loading notebook inputs...
        </div>
        <p v-else-if="dataSourceNodes.length === 0" class="wizard-step-desc">
          This notebook takes no input data, so it starts without
          {{ publicDataset.name }}.
        </p>
        <p v-else class="wizard-step-desc">
          The notebook starts with the file list of
          <strong>{{ publicDataset.name }}</strong> (version {{ publicVersion }})
          in its <code>input/</code> folder. Choose which folders or files to
          download from the notebook's <strong>Inputs</strong> panel.
        </p>
      </div>
      <div v-else-if="step === 5 && personal" class="wizard-step wizard-step--disabled">
        <p class="wizard-step-desc">
          No input files: without a dataset, the notebook's <code>input/</code>
          folder starts empty.
        </p>
      </div>
      <div v-else-if="step === 5" class="wizard-step">
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
              {{ node.name || node.id }}
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

      <!-- Step 6: Output destination -->
      <div v-if="step === 6" class="wizard-step">
        <p class="wizard-step-desc">
          Configure where the notebook's results are saved.
        </p>
        <div
          v-if="dataTargetNodes.length === 0 || !hasVisibleTargetParams"
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
                <label class="target-param-label">
                  {{ p.name }}
                  <span v-if="p.required" class="target-param-req">*</span>
                </label>
                <el-input
                  v-model="dataTargetConfigs[node.id].params[i].value"
                  :placeholder="p.description || p.name"
                  size="small"
                />
                <div v-if="p.description" class="target-param-desc">
                  {{ p.description }}
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>

      <!-- Step 7: Review -->
      <div v-if="step === 7" class="wizard-step">
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
          <div class="wizard-summary-row">
            <span class="wizard-summary-label">Resources</span>
            <span class="wizard-summary-value">
              {{ cpuLabel(resourceCpu) }} ·
              {{ isAutoMemory ? `${memoryLabel(autoMemoryForCpu(resourceCpu))} (auto)` : memoryLabel(resourceMemory) }}
            </span>
          </div>
          <div class="wizard-summary-row">
            <span class="wizard-summary-label">Environment</span>
            <span class="wizard-summary-value">{{ form.environmentLayer || "None" }}</span>
          </div>
          <div v-if="personal" class="wizard-summary-row">
            <span class="wizard-summary-label">Public dataset</span>
            <span class="wizard-summary-value">{{
              publicDataset && dataSourceNodes.length
                ? `${publicDataset.name} (version ${publicVersion})`
                : "None"
            }}</span>
          </div>
          <div v-if="!personal" class="wizard-summary-row">
            <span class="wizard-summary-label">Dataset</span>
            <span class="wizard-summary-value">{{ selectedDataset?.content?.name }}</span>
          </div>
          <div v-if="!personal" class="wizard-summary-row">
            <span class="wizard-summary-label">Input files</span>
            <span class="wizard-summary-value">
              {{ dataSourceNodes.reduce((n, d) => n + fileCountForNode(d.id), 0) }}
              selected
            </span>
          </div>
        </div>
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

.wizard-body {
  min-height: 300px;
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
