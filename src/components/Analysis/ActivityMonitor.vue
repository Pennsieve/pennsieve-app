<script setup>
import { computed, watch, nextTick, ref, onMounted } from "vue";
import { useStore } from "vuex";

// Vue Flow Imports
import { useVueFlow, VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import ActivitySidePanel from "./ActivitySidePanel.vue";
import ActivityLogs from "./ActivityLogs.vue";
import CustomNode from "./CustomNode.vue";

const {
  onInit,
  onConnect,
  addEdges,
  fitView,
  findNode,
  getSelectedNodes,
  onNodeClick,
} = useVueFlow();
// Access the Vuex store
const store = useStore();

// Gobal State from Vuex Store
const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"]
);

const selectedWorkflowActivity = computed(
  () => store.getters["analysisModule/selectedWorkflowActivity"]
);

const cancelWorkflowDialogVisible = computed(
  () => store.state.analysisModule.cancelWorkflowDialogVisible
);

const hideCancelWorkflowDialog = () => {
  store.commit("analysisModule/HIDE_CANCEL_WORKFLOW_DIALOG");
};

const cancelWorkflow = () => {
  store.dispatch(
    "analaysisModule/cancelWorkflow",
    selectedWorkflowActivity?.uuid
  );
  hideCancelWorkflowDialog();
};

// Local State
const isLoading = ref(false);

const initialNodes = [
  {
    id: "1",
    type: "input",
    data: {},
    position: { x: 130, y: 100 },
    class: "light",
  },
  {
    id: "2",
    data: {},
    position: { x: 150, y: 250 },
    class: "light",
  },
  {
    id: "3",
    type: "output",
    data: {},
    position: { x: 170, y: 400 },
    class: "light",
  },
];

const initialEdges = [
  {
    id: "e1-1",
    source: "1",
    target: "2",
    animated: true,
  },
  {
    id: "e1-2",
    source: "2",
    target: "3",
    animated: true,
  },
];

const nodes = ref(initialNodes);

const edges = ref(initialEdges);

const getLabel = (workflow, type) =>
  workflow?.name ? workflow.name : `No ${type} Selected`;

/*
Fetch Initial Data
*/

onMounted(async () => {
  // fetch all workflow instances
  try {
    isLoading.value = true;
    await store.dispatch("analysisModule/fetchWorkflowInstances");
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }

  const sortedWorkflows = workflowInstances.value.sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );

  try {
    await store.dispatch(
      "analysisModule/setSelectedWorkflowActivity",
      sortedWorkflows[0]
    );
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }

  nodes.value = [
    {
      id: "1",
      type: "input",
      data: {
        label: getLabel(workflowInstances[0]?.workflow[0], "Preprocessor"),
        type: "input",
      },
      position: { x: 130, y: 100 },
      class: "light",
    },
    {
      id: "2",
      type: "",
      data: {
        label: getLabel(sortedWorkflows[0]?.workflow[1], "Processor"),
      },
      position: { x: 150, y: 250 },
      class: "light",
    },
    {
      id: "3",
      type: "output",
      data: {
        label: getLabel(workflowInstances[0]?.workflow[2], "Postprocessor"),
        type: "output",
      },
      position: { x: 170, y: 400 },
      class: "light",
    },
  ];
});

watch(selectedWorkflowActivity, (newVal, oldVal) => {
  if (newVal) {
    nodes.value = [
      {
        id: "1",
        type: "input",
        data: {
          label: getLabel(newVal.workflow[0], "Preprocessor"),
          type: "input",
        },
        position: { x: 130, y: 100 },
        class: "light",
      },
      {
        id: "2",
        type: "",
        data: {
          label: getLabel(newVal.workflow[1], "Processor"),
        },
        position: { x: 150, y: 250 },
        class: "light",
      },
      {
        id: "3",
        type: "output",
        data: {
          label: getLabel(newVal.workflow[2], "Postprocessor"),
          type: "output",
        },
        position: { x: 170, y: 400 },
        class: "light",
      },
    ];
  }
});

/*
VueFlow Config and Create Relationships
 */
const minimapLocation = computed(() => {
  if (sidePanelVisible.value) {
    return "bottom-left";
  }

  return "bottom-right";
});
/*
Side Panel Logic
 */
const sidePanelVisible = ref(true);
function onTogglePanelVisibility() {
  sidePanelVisible.value = !sidePanelVisible.value;
}

const isDetailsPanelOpen = ref(false);
const selectedProcessor = ref({});
function openDetailsPanel(selectedApplication) {
  isDetailsPanelOpen.value = true;
  selectedProcessor.value = selectedApplication;
}

/*
Event Handler for Node Click
 */
const selectedNode = ref({});
const activityLogsVisible = ref(false);

onNodeClick(({ node }) => {
  const selectedApplication = selectedWorkflowActivity.value.workflow.find(
    (x) => x.name === node.data.label
  );
  if (selectedApplication) {
    selectedNode.value = selectedApplication;
    console.log("runs");
    openDetailsPanel(selectedApplication);
  }
});
</script>

<template>
  <div class="activity-monitor">
    <h2 class="vue-flow-title">
      {{ `Workflow Run: ${selectedWorkflowActivity?.name}` }}
    </h2>
    <div class="graph-browser">
      <div class="vue-flow-wrapper">
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          class="basic-flow"
          :default-viewport="{ zoom: 1 }"
          :min-zoom="0.2"
          :max-zoom="4"
        >
          <template #node-custom="customNodeProps">
            <CustomNode
              :node-props="customNodeProps"
              @node-click="onNodeClick"
            />
          </template>
          <Background pattern-color="#aaa" :gap="16" />

          <!-- <MiniMap :position="minimapLocation" :pannable="true" /> -->

          <Controls position="top-left" />
        </VueFlow>
      </div>

      <ActivitySidePanel
        :class="{ visible: sidePanelVisible }"
        :panel-visible="sidePanelVisible"
        :show-details-panel="isDetailsPanelOpen"
        :selected-processor="selectedProcessor"
        @toggle-panel-visibility="onTogglePanelVisibility"
      />
      <el-dialog
        v-model="cancelWorkflowDialogVisible"
        title="Cancel Workflow"
        width="500"
        center
        @close="hideCancelWorkflowDialog"
      >
        <span>
          Would you like to cancel this workflow:
          {{ selectedWorkflowActivity?.uuid }} ?
        </span>
        <template #footer>
          <div class="dialog-footer">
            <bf-button class="secondary" @click="hideCancelWorkflowDialog"
              >No</bf-button
            >
            <bf-button @click="cancelWorkflow">Yes</bf-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </div>
  <ActivityLogs
    :dialog-visible="activityLogsVisible"
    :selected-node="selectedNode"
    :selected-application="selectedWorkflowActivity"
    @close-dialog="activityLogsVisible = false"
  ></ActivityLogs>
</template>

<style lang="sass">


/* these are necessary styles for vue flow */
@import '@vue-flow/core/dist/style.css'

/* this contains the default theme, these are optional styles */
@import '../..//assets/_vueflow_core.scss'
@import '../../assets/_vueflow.css'

@import '@vue-flow/minimap/dist/style.css'
</style>

<style lang="scss" scoped>
@import "../../assets/_variables.scss";

.modified-stage {
  margin: 0;
}

.graph-browser {
  height: calc(100vh - 114px);
  overflow: hidden;
  position: relative;
}

.vue-flow-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.action-button {
  position: absolute;
  right: 16px;
  top: 16px;

  &.second {
    right: 170px;
  }
}

.btn-toggle-model-details {
  align-items: center;
  background: $gray_1;
  border-left: 1px solid $gray_2;
  border-right: 1px solid $gray_2;
  border-top: 1px solid $gray_2;
  border-bottom: 1px solid $gray_2;
  border-radius: 4px 0 0 4px;
  display: flex;
  height: 48px;
  left: -35px;
  justify-content: center;
  position: absolute;
  top: 88px;
  width: 35px;
}

.btn-toggle-models-list {
  align-items: center;
  background: $gray_1;
  border: 1px solid $gray_2;
  border-radius: 4px 0 0 4px;
  display: flex;
  height: 48px;
  left: -35px;
  justify-content: center;
  position: absolute;
  top: 33px;
  width: 35px;

  &.selected {
    &:after {
      background: $gray_1;
      content: "";
      height: 100%;
      pointer-events: none;
      position: absolute;
      top: 0;
      right: -5px;
      width: 5px;
    }
  }
  .vue-flow-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }
}
</style>
<style lang="scss">
.vue-flow-title {
  margin: 20px !important;
}

.activity-monitor {
  .el-dialog__title {
    color: #ffffff;
    font-weight: 500;
  }

  span {
    color: #4d628c;
  }
}
</style>
