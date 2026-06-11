<script setup>
// Self-contained "New Notebook" launcher. A guided flow:
//   Kernel → Compute Node → Dataset → Input Files → Output → Review & Start.
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
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import EventBus from "@/utils/event-bus";
import { notebookKernel, kernelLabel } from "./notebookHelpers";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The published notebook workflows (one per kernel). Provided by the parent,
  // which already fetched them to gate the "New Notebook" button.
  notebookWorkflows: { type: Array, default: () => [] },
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
const form = ref({ workflowId: "", computeNodeId: "", datasetId: "" });
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
  "Select Dataset",
  "Select Input Files",
  "Output Destination",
  "Review & Start",
];

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
const hasVisibleTargetParams = computed(() =>
  dataTargetNodes.value.some((d) =>
    (dataTargetConfigs[d.id]?.params || []).some(
      (p) => !isHiddenTargetParam(p.name)
    )
  )
);

/* --------------------------------------------------------- compute nodes ---- */
// A node can host a notebook only if it has interactive sessions enabled
// (maxInteractiveSessions > 0). Only those are offered — no fallback to the
// full list, since a non-interactive node can't run a notebook.
const interactiveCapable = (cn) =>
  (cn.maxInteractiveSessions || 0) > 0 ||
  cn.enableInteractive === true ||
  cn.interactive === true;
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
      return !!form.value.datasetId;
    case 3:
      return dataSourcesComplete.value;
    case 4:
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
          value: pd.defaultValue != null ? String(pd.defaultValue) : "",
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
  form.value = { workflowId: "", computeNodeId: "", datasetId: "" };
  nameTouched.value = false;
  computeNodeSearch.value = "";
  datasetSearchQuery.value = "";
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
    fetchDatasetOptions();
  }
});

const next = async () => {
  if (step.value === 2) await loadDefinition();
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
      });
    }

    const name = runName.value.trim();
    const payload = {
      workflowInstanceConfiguration: {
        workflowId: form.value.workflowId,
        computeNodeId: form.value.computeNodeId,
        ...(processorConfigs.length > 0 && { processorConfigs }),
      },
      datasetId: form.value.datasetId,
      dataSources,
      ...(name && { name }),
      ...(Object.keys(dataTargets).length > 0 && { dataTargets }),
    };

    console.log("[Notebook] createRun payload:", JSON.stringify(payload, null, 2));
    const newRun = await store.dispatch("analysisModule/createRun", payload);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Notebook starting — it will appear under Active Notebooks.",
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
    :width="step === 3 ? '840px' : '560px'"
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

      <!-- Step 2: Dataset -->
      <div v-if="step === 2" class="wizard-step">
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

      <!-- Step 3: Input files -->
      <div v-if="step === 3" class="wizard-step">
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

      <!-- Step 4: Output destination -->
      <div v-if="step === 4" class="wizard-step">
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

      <!-- Step 5: Review -->
      <div v-if="step === 5" class="wizard-step">
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
            <span class="wizard-summary-label">Dataset</span>
            <span class="wizard-summary-value">{{ selectedDataset?.content?.name }}</span>
          </div>
          <div class="wizard-summary-row">
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
