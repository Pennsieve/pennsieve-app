<script setup>
/*
  Choosing a workflow to run, from Live's "+ Run Workflow": the workflows
  to pick from, with the picked one's summary beside them
  (RunWorkflowSummary). Where it runs (compute node, dataset), its files and
  settings are all chosen on the run's configure page, which every Run goes
  to: open(workflowId) and rerun(run) go there at once, without the dialog.
*/
import { computed, ref } from "vue";
import { useStore } from "vuex";
import { useRoute, useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import RunWorkflowSummary from "../Workflows/RunWorkflowSummary.vue";
import { useWorkflowSearch } from "@/composables/useWorkflowSearch";
import { isNotebookWorkflow } from "./notebookHelpers";
import { needsDataset } from "./runSetup";
import { viewsServiceUrl } from "@/utils/viewsService";

const store = useStore();
const route = useRoute();
const router = useRouter();

const visible = ref(false);
const workflowId = ref("");

// In My Workspace (no organization) a run has no dataset.
const isMyWorkspace = computed(() => !route.params.orgId);
const storeWorkflows = computed(() => store.state.analysisModule.workflows || []);
const applications = computed(() => store.getters["analysisModule/applications"] || []);
const targetTypes = computed(() => store.getters["analysisModule/targetTypes"] || []);

// Inputs can take public datasets' files where views-service is deployed.
const datasetNeeded = (wf) => needsDataset(wf, { publicInputs: !!viewsServiceUrl() });
const selectable = (wf) => wf.isActive && !(isMyWorkspace.value && datasetNeeded(wf));

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
} = useWorkflowSearch(() =>
  isMyWorkspace.value
    ? [{}, { visibility: "public" }]
    : [{ organization_id: store.state.activeOrganization?.organization?.id || "" }]
);
// Notebooks start on the Notebooks tab, so the run dialog leaves them out.
const listedWorkflows = computed(() => workflowOptions.value.filter((w) => !isNotebookWorkflow(w)));
const selectedWorkflow = computed(
  () =>
    workflowOptions.value.find((w) => w.uuid === workflowId.value) ||
    storeWorkflows.value.find((w) => w.uuid === workflowId.value) ||
    null
);

// The summary column names apps and outputs from these; loaded if not yet.
const loadLabels = () => {
  if (!applications.value.length) store.dispatch("analysisModule/fetchApplications").catch(() => {});
  if (!targetTypes.value.length) store.dispatch("analysisModule/fetchTargetTypes").catch(() => {});
};

// The run's configure page, for a workflow (and a rerun's choices).
const configure = (setup) => {
  store.commit("analysisModule/SET_PENDING_RUN_CONFIG", {
    workflowId: setup.workflowId,
    computeNodeId: setup.computeNodeId || "",
    datasetId: setup.datasetId || "",
    rerunSource: setup.rerunSource || null,
  });
  visible.value = false;
  router.push({ name: isMyWorkspace.value ? "my-run-configure" : "run-configure" });
};

const open = (id) => {
  if (id) {
    configure({ workflowId: String(id) });
    return;
  }
  workflowId.value = "";
  resetWorkflowSearch();
  loadLabels();
  visible.value = true;
};

const rerun = async (run) => {
  let source = run;
  try {
    await store.dispatch("analysisModule/setSelectedWorkflowActivity", run);
    source = store.getters["analysisModule/selectedWorkflowActivity"] || run;
  } catch {
    // the run as listed
  }
  configure({ workflowId: run.workflowUuid, computeNodeId: run.computeNodeUuid, datasetId: run.datasetId, rerunSource: source });
};

defineExpose({ open, rerun });
</script>

<template>
  <el-dialog v-model="visible" title="Run a workflow" width="960px" :close-on-click-modal="false" append-to-body class="run-wizard-dialog">
    <div class="rw">
      <RunWorkflowSummary :workflow="selectedWorkflow" :applications="applications" :target-types="targetTypes" />

      <div class="rw__main">
        <p class="rw__desc">Choose a workflow. Where it runs, its files and settings come next, on its configure page.</p>
        <el-input v-model="workflowSearch" placeholder="Search workflows..." clearable class="rw__search" @input="onWorkflowSearch" @clear="onWorkflowSearch" />
        <div class="rw__cards">
          <div v-if="workflowsLoading" class="rw__cards-empty">Searching...</div>
          <div
            v-for="wf in listedWorkflows"
            :key="wf.uuid"
            class="rw__card"
            :class="{ disabled: !selectable(wf), picked: wf.uuid === workflowId }"
            @click="selectable(wf) && (workflowId = wf.uuid)"
            @dblclick="selectable(wf) && configure({ workflowId: wf.uuid })"
          >
            <div class="rw__card-name">{{ wf.name }}</div>
            <div v-if="wf.summary || wf.description" class="rw__card-desc">{{ wf.summary || wf.description }}</div>
            <div class="rw__card-meta">
              <span v-if="!wf.isActive" class="rw__badge">Archived</span>
              <span
                v-else-if="isMyWorkspace && datasetNeeded(wf)"
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
      </div>
    </div>

    <template #footer>
      <div class="rw__footer">
        <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
        <bf-button :disabled="!workflowId" @click="configure({ workflowId })">Configure run</bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.rw {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: min(520px, calc(100vh - 260px));
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
.rw__desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$gray_4;
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
  &.picked {
    border-color: theme.$purple_1;
    background: theme.$purple_tint;
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
.rw__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
</style>

<style lang="scss">
/* The two columns reach the dialog's edges (the body's padding goes); the
   dialog is appended to body, so this isn't scoped. */
.run-wizard-dialog .el-dialog__body {
  padding: 0;
}
</style>
