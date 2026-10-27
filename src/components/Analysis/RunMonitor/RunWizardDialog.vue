<script setup>
/*
  The run dialog: which workflow, on which compute node, with which dataset,
  then on to the run's configure page (files and settings). Opened where the
  user is: Live's "+ Run Workflow" and a run's "Run again", a Library card's
  Run, a workflow's page. The left column (RunWorkflowSummary) says what's
  being run, and what's been chosen, on every step.

  open(workflowId?) starts at the workflow, or at the compute node for a
  given one; rerun(run) starts at the review, with the run's choices.
*/
import { computed, ref } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import RunWorkflowSummary from "../Workflows/RunWorkflowSummary.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";
import { useWorkflowSearch } from "@/composables/useWorkflowSearch";
import toQueryParams from "@/utils/toQueryParams";
import { isNotebookWorkflow } from "./notebookHelpers";

const store = useStore();
const route = useRoute();
const router = useRouter();

const visible = ref(false);
const step = ref(0);
const form = ref({ workflowId: "", computeNodeId: "", datasetId: "" });
const rerunSource = ref(null);
const computeNodeSearch = ref("");
const datasetOptions = ref([]);
const datasetSearchLoading = ref(false);
const datasetSearchQuery = ref("");
let datasetSearchTimer = null;

// In My Workspace (no organization) a run has no dataset: that step is skipped.
const isMyWorkspace = computed(() => !route.params.orgId);
const config = computed(() => store.state.config);
const computeNodes = computed(() => store.getters["analysisModule/computeNodes"] || []);
const storeWorkflows = computed(() => store.state.analysisModule.workflows || []);
const applications = computed(() => store.getters["analysisModule/applications"] || []);
const targetTypes = computed(() => store.getters["analysisModule/targetTypes"] || []);

const STEPS = [
  { title: "Workflow", desc: "Choose a workflow to run." },
  { title: "Compute node", desc: "Choose the compute node to run it on." },
  { title: "Dataset", desc: "Choose the dataset the run works in." },
  { title: "Review", desc: "Check the choices, then configure the run's files and settings." },
];
const skips = (i) => isMyWorkspace.value && i === 2;
const visibleSteps = computed(() => STEPS.map((s, i) => ({ ...s, i })).filter(({ i }) => !skips(i)));

// Outside a workspace a run has no dataset, so a workflow can't run there yet
// if it reads from one (data-source nodes) or writes to one (data targets
// other than the ones listed here, which need no dataset).
const TARGETS_WITHOUT_DATASET = new Set(["persistent-layer"]);
const needsDataset = (wf) =>
  (wf?.dag || []).some(
    (d) => d.type === "data-source" || (d.type === "data-target" && !TARGETS_WITHOUT_DATASET.has(d.targetType))
  );
const selectable = (wf) => wf.isActive && !(isMyWorkspace.value && needsDataset(wf));

// The dialog's own list, searched and paged on the server (#825), so a
// workflow past the first page can be found: the workspace's workflows, or in
// My Workspace the user's own and the public ones.
const {
  workflowOptions,
  nextCursor: workflowsCursor,
  isLoading: workflowsLoading,
  isLoadingMore: workflowsLoadingMore,
  searchQuery: workflowSearch,
  onSearchInput: onWorkflowSearch,
  loadMore: loadMoreWorkflows,
  reset: resetWorkflowSearch,
  fetchWorkflow,
} = useWorkflowSearch(() =>
  isMyWorkspace.value
    ? [{}, { visibility: "public" }]
    : [{ organization_id: store.state.activeOrganization?.organization?.id || "" }]
);
// Notebooks start on the Notebooks tab, so the run dialog leaves them out.
const listedWorkflows = computed(() => workflowOptions.value.filter((w) => !isNotebookWorkflow(w)));

// A preselected workflow (a Run, a rerun) that isn't among the pages loaded,
// fetched on its own.
const pickedWorkflow = ref(null);
const pickWorkflow = async (workflowId) => {
  form.value.workflowId = workflowId;
  const known = [...workflowOptions.value, ...storeWorkflows.value].some((w) => w.uuid === workflowId);
  pickedWorkflow.value = known ? null : await fetchWorkflow(workflowId);
};

const selectedWorkflow = computed(() => {
  const id = form.value.workflowId;
  if (!id) return null;
  return (
    workflowOptions.value.find((w) => w.uuid === id) ||
    storeWorkflows.value.find((w) => w.uuid === id) ||
    (pickedWorkflow.value?.uuid === id ? pickedWorkflow.value : null)
  );
});
const selectedComputeNode = computed(() => computeNodes.value.find((cn) => cn.uuid === form.value.computeNodeId) || null);
const selectedDataset = computed(() => datasetOptions.value.find((d) => d.content?.id === form.value.datasetId) || null);

const filteredComputeNodes = computed(() => {
  const q = computeNodeSearch.value.toLowerCase().trim();
  if (!q) return computeNodes.value;
  return computeNodes.value.filter((cn) => cn.name?.toLowerCase().includes(q) || cn.description?.toLowerCase().includes(q));
});

const canNext = computed(() => {
  if (step.value === 0) return !!form.value.workflowId;
  if (step.value === 1) return !!form.value.computeNodeId;
  if (step.value === 2) return !!form.value.datasetId;
  return true;
});
const title = computed(() => (selectedWorkflow.value ? `Run "${selectedWorkflow.value.name}"` : "Run a workflow"));

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
    const response = await useSendXhr(`${config.value.apiUrl}/datasets/paginated?${params}`);
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

// The summary column names apps and outputs from these; loaded if not yet.
const loadLabels = () => {
  if (!applications.value.length) store.dispatch("analysisModule/fetchApplications").catch(() => {});
  if (!targetTypes.value.length) store.dispatch("analysisModule/fetchTargetTypes").catch(() => {});
};

const reset = () => {
  form.value = { workflowId: "", computeNodeId: "", datasetId: "" };
  pickedWorkflow.value = null;
  computeNodeSearch.value = "";
  datasetSearchQuery.value = "";
  rerunSource.value = null;
  resetWorkflowSearch();
  loadLabels();
  if (!isMyWorkspace.value) fetchDatasetOptions();
};

const open = (workflowId) => {
  reset();
  step.value = 0;
  if (workflowId) {
    pickWorkflow(String(workflowId));
    step.value = 1;
  }
  visible.value = true;
};

const rerun = async (run) => {
  reset();
  try {
    await store.dispatch("analysisModule/setSelectedWorkflowActivity", run);
    rerunSource.value = store.getters["analysisModule/selectedWorkflowActivity"] || run;
  } catch {
    rerunSource.value = run;
  }
  form.value = { workflowId: run.workflowUuid || "", computeNodeId: run.computeNodeUuid || "", datasetId: run.datasetId || "" };
  if (run.workflowUuid) pickWorkflow(run.workflowUuid);
  step.value = 3;
  visible.value = true;
};

defineExpose({ open, rerun });

const next = () => {
  if (step.value < 3) step.value++;
  if (skips(step.value)) step.value++;
};
const back = () => {
  if (step.value > 0) step.value--;
  if (skips(step.value)) step.value--;
};

const configure = () => {
  store.commit("analysisModule/SET_PENDING_RUN_CONFIG", {
    workflowId: form.value.workflowId,
    computeNodeId: form.value.computeNodeId,
    datasetId: form.value.datasetId,
    rerunSource: rerunSource.value,
  });
  visible.value = false;
  router.push({ name: isMyWorkspace.value ? "my-run-configure" : "run-configure" });
};
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="960px" :close-on-click-modal="false" append-to-body class="run-wizard-dialog">
    <div class="rw">
      <RunWorkflowSummary
        :workflow="selectedWorkflow"
        :applications="applications"
        :target-types="targetTypes"
        :compute-node="step > 1 ? selectedComputeNode?.name || '' : ''"
        :dataset="step > 2 && !isMyWorkspace ? selectedDataset?.content?.name || '' : ''"
      />

      <div class="rw__main">
        <!-- Where in the run's setup: the steps by name. -->
        <ol class="rw__steps">
          <li
            v-for="(s, n) in visibleSteps"
            :key="s.i"
            :class="{ active: step === s.i, done: step > s.i }"
          >
            <span class="rw__step-n">{{ step > s.i ? "✓" : n + 1 }}</span>{{ s.title }}
          </li>
        </ol>
        <p class="rw__desc">{{ STEPS[step].desc }}</p>

        <!-- Workflow -->
        <div v-if="step === 0" class="rw__step">
          <div v-if="selectedWorkflow" class="rw__selection">
            <span class="rw__selection-name">{{ selectedWorkflow.name }}</span>
            <button class="rw__clear" title="Choose another" @click="form.workflowId = ''">&times;</button>
          </div>
          <template v-else>
            <el-input v-model="workflowSearch" placeholder="Search workflows..." clearable class="rw__search" @input="onWorkflowSearch" @clear="onWorkflowSearch" />
            <div class="rw__cards">
              <div v-if="workflowsLoading" class="rw__cards-empty">Searching...</div>
              <div
                v-for="wf in listedWorkflows"
                :key="wf.uuid"
                class="rw__card"
                :class="{ disabled: !selectable(wf) }"
                @click="selectable(wf) && (form.workflowId = wf.uuid)"
              >
                <div class="rw__card-name">{{ wf.name }}</div>
                <div v-if="wf.summary || wf.description" class="rw__card-desc">{{ wf.summary || wf.description }}</div>
                <div class="rw__card-meta">
                  <span v-if="!wf.isActive" class="rw__badge">Archived</span>
                  <span
                    v-else-if="isMyWorkspace && needsDataset(wf)"
                    class="rw__badge"
                    title="This workflow reads from or writes to a dataset, which isn't available outside a workspace yet"
                  >Needs a dataset</span>
                </div>
              </div>
              <div v-if="!workflowsLoading && listedWorkflows.length === 0" class="rw__cards-empty">No workflows found</div>
              <button v-if="workflowsCursor" type="button" class="rw__more" :disabled="workflowsLoadingMore" @click="loadMoreWorkflows">
                {{ workflowsLoadingMore ? "Loading..." : "Load more workflows" }}
              </button>
            </div>
          </template>
        </div>

        <!-- Compute node -->
        <div v-if="step === 1" class="rw__step">
          <div v-if="selectedComputeNode" class="rw__selection">
            <span class="rw__selection-name">{{ selectedComputeNode.name }}</span>
            <button class="rw__clear" title="Choose another" @click="form.computeNodeId = ''">&times;</button>
          </div>
          <template v-else>
            <el-input v-model="computeNodeSearch" placeholder="Filter compute nodes..." clearable class="rw__search" />
            <div class="rw__cards">
              <div v-for="cn in filteredComputeNodes" :key="cn.uuid" class="rw__card" @click="form.computeNodeId = cn.uuid">
                <div class="rw__card-name">{{ cn.name }}</div>
                <div v-if="cn.description" class="rw__card-desc">{{ cn.description }}</div>
              </div>
              <div v-if="filteredComputeNodes.length === 0" class="rw__cards-empty">No compute nodes found</div>
            </div>
          </template>
        </div>

        <!-- Dataset -->
        <div v-if="step === 2" class="rw__step">
          <div v-if="selectedDataset" class="rw__selection">
            <span class="rw__selection-name">{{ selectedDataset.content?.name }}</span>
            <button class="rw__clear" title="Choose another" @click="form.datasetId = ''">&times;</button>
          </div>
          <template v-else>
            <el-input v-model="datasetSearchQuery" placeholder="Search datasets..." clearable class="rw__search" @input="onDatasetSearch" />
            <div class="rw__cards">
              <div v-if="datasetSearchLoading" class="rw__cards-empty">Searching...</div>
              <div v-for="ds in datasetOptions" :key="ds.content?.id" class="rw__card" @click="form.datasetId = ds.content?.id">
                <div class="rw__card-name">{{ ds.content?.name }}</div>
                <div v-if="ds.content?.description" class="rw__card-desc">{{ ds.content.description }}</div>
              </div>
              <div v-if="!datasetSearchLoading && datasetOptions.length === 0" class="rw__cards-empty">No datasets found</div>
            </div>
          </template>
        </div>

        <!-- Review -->
        <div v-if="step === 3" class="rw__step">
          <dl class="rw__review">
            <dt>Workflow</dt>
            <dd>{{ selectedWorkflow?.name || form.workflowId }}</dd>
            <dt>Compute node</dt>
            <dd>{{ selectedComputeNode?.name || form.computeNodeId }}</dd>
            <template v-if="!isMyWorkspace">
              <dt>Dataset</dt>
              <dd>{{ selectedDataset?.content?.name || form.datasetId }}</dd>
            </template>
          </dl>
          <div class="rw__hint">
            <template v-if="rerunSource">
              Settings and execution targets are copied from the previous run. Next, choose the files for each <strong>input</strong>.
            </template>
            <template v-else-if="isMyWorkspace">
              Next, click a <strong>step</strong> on the canvas to adjust its settings, then start the run.
            </template>
            <template v-else>
              Next, click each <strong>input</strong> on the canvas to choose its files, and a <strong>step</strong> to adjust its settings, then start the run.
            </template>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="rw__footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <div class="rw__footer-right">
          <bf-button v-if="step > 0" class="secondary" @click="back">Back</bf-button>
          <bf-button v-if="step < 3" :disabled="!canNext" @click="next">Next</bf-button>
          <bf-button v-else @click="configure">Configure</bf-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.rw {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: min(560px, 70vh);
  margin: -10px -20px 0;
  border-top: 1px solid theme.$gray_2;
  border-bottom: 1px solid theme.$gray_2;
}
.rw__main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 20px;
  overflow: hidden;
}
.rw__steps {
  display: flex;
  gap: 16px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: theme.$gray_4;

  li {
    display: flex;
    align-items: center;
    gap: 6px;

    &.active {
      color: theme.$purple_3;
      font-weight: 600;
    }
    &.done {
      color: theme.$gray_5;
    }
  }
}
.rw__step-n {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid currentColor;
  font-size: 11px;

  .done & {
    border-color: theme.$green_1;
    color: theme.$green_1;
  }
  .active & {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: theme.$white;
  }
}
.rw__desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$gray_4;
}
.rw__step {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.rw__search {
  margin-bottom: 12px;
}
.rw__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  min-height: 0;
}
.rw__card {
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover:not(.disabled) {
    border-color: theme.$gray_3;
    background: theme.$gray_0;
  }
  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
.rw__card-name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
}
.rw__card-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rw__card-meta:empty {
  display: none;
}
.rw__badge {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_2;
  font-size: 10px;
  color: theme.$gray_5;
}
.rw__cards-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}
.rw__more {
  align-self: center;
  padding: 6px 14px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
.rw__selection {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid theme.$purple_1;
  border-radius: 4px;
  background: theme.$purple_tint;
}
.rw__selection-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rw__clear {
  border: none;
  background: none;
  font-size: 16px;
  line-height: 1;
  color: theme.$gray_4;
  cursor: pointer;

  &:hover {
    color: theme.$black;
  }
}
.rw__review {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 8px 16px;
  margin: 0 0 16px;
  font-size: 13px;

  dt {
    color: theme.$gray_4;
  }
  dd {
    margin: 0;
    font-weight: 600;
    color: theme.$black;
    overflow-wrap: anywhere;
  }
}
.rw__hint {
  padding: 12px 14px;
  border-radius: 4px;
  background: theme.$yellow_tint;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;
}
.rw__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.rw__footer-right {
  display: flex;
  gap: 8px;
}
</style>
