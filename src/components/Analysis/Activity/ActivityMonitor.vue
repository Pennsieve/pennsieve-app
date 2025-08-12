<script setup>
import {
  computed,
  watch,
  ref,
  onMounted,
  onBeforeUnmount,
  onUnmounted,
} from "vue";

import { useStore } from "vuex";

// Vue Flow Imports
import { useVueFlow, VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import ActivitySidePanel from "./ActivitySidePanel.vue";
import ActivityLogs from "./ActivityLogs.vue";
import EventBus from "../../../utils/event-bus";

const { onNodeClick } = useVueFlow();

/*
Initial Values
*/
const initialNodes = [
  {
    id: "1",
    data: {},
    position: { x: 130, y: 100 },
  },
  {
    id: "2",
    data: {},
    position: { x: 150, y: 250 },
  },
  {
    id: "3",
    type: "output",
    data: {},
    position: { x: 170, y: 400 },
  },
];
const initialEdges = [
  {
    id: "e1-1",
    source: "1",
    target: "2",
    animated: false,
  },
  {
    id: "e1-2",
    source: "2",
    target: "3",
    animated: false,
  },
];

/*
Local State
*/
const isLoading = ref(false);
const nodes = ref(initialNodes);
const edges = ref(initialEdges);
const sidePanelVisible = ref(true);
const isDetailsPanelOpen = ref(false);
const selectedNode = ref({});
let intervalId = null;

/*
Global State
*/
const store = useStore();
const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"]
);
const selectedWorkflowActivity = computed(
  () => store.getters["analysisModule/selectedWorkflowActivity"]
);
const selectedProcessor = computed(
  () => store.getters["analysisModule/selectedProcessor"]
);
const cancelWorkflowDialogVisible = computed(
  () => store.state.analysisModule.cancelWorkflowDialogVisible
);
const hideCancelWorkflowDialog = () => {
  store.dispatch("analysisModule/hideCancelWorkflowDialog");
};
const cancelWorkflow = () => {
  store
    .dispatch("analysisModule/cancelWorkflow", selectedWorkflowActivity?.uuid)
    .then(() => {
      EventBus.$emit("toast", {
        detail: {
          type: "success",
          msg: "Your cancellation request was successful. It may take some time to complete.",
        },
      });
    })
    .catch((err) => {
      EventBus.$emit("toast", {
        detail: {
          type: "error",
          msg: "Something went wrong, please try again later.",
        },
      });
    });
};
const activityDialogVisible = computed(
  () => store.getters["analysisModule/activityDialogVisible"]
);
const getApplicationsStatus = async (selectedWorkflow) => {
  await store.dispatch(
    "analysisModule/setSelectedWorkflowActivity",
    selectedWorkflow
  );
};

/*
Helpers
*/

const getLabel = (workflow, type) =>
  workflow?.name ? `${workflow.name}` : `No ${type} Selected`;

const getClass = (workflow, processorIdx) => {
  if (!workflow || !workflow.workflow || !workflow.workflow[processorIdx]) {
    return "vue-flow__node-custom gray-node"; // Default fallback
  }

  switch (workflow.workflow[processorIdx].status) {
    case "NOT_STARTED":
      return "gray-node";
    case "STARTED":
      return "blue-node animate";
    case "SUCCEEDED":
      return "green-node";
    case "FAILED":
      return "red-node";
    default:
      return "gray-node";
  }
};

/*
Computed Properties
*/

const isSelectedWorkflowActivitySet = computed(
  () => Object.keys(selectedWorkflowActivity.value).length > 0
);

/*
Fetch Initial Data
*/
const fetchData = async () => {
  try {
    await store.dispatch(
      "analysisModule/setSelectedWorkflowActivity",
      selectedWorkflowActivity.value
    );
  } catch (error) {
    console.error(error);
  }
};

const startFetching = () => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  intervalId = setInterval(fetchData, 5000);
};

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

  // set initial selected workflow activity to show the first instance in the list
  const workflow = Object.keys(selectedWorkflowActivity.value).length
    ? selectedWorkflowActivity.value
    : workflowInstances.value[0];

  if (workflowInstances.value.length && !intervalId) {
    try {
      await getApplicationsStatus(workflow);
    } catch (err) {
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  }

  startFetching();
});

onBeforeUnmount(() => {
  if (intervalId) {
    clearInterval(intervalId);
  }
});

onUnmounted(async () => {
  await store.dispatch("analysisModule/setSelectedWorkflowActivity", null);
});

/*
Watch
*/
watch(selectedWorkflowActivity, (newVal, oldVal) => {
  // Update Nodes and Edges to render processors for selected workflow

  nodes.value = [
    {
      id: "1",
      type: "default",
      data: {
        label: getLabel(newVal.workflow[0], "Preprocessor"),
        status: newVal.workflow[0].status,
      },
      position: { x: 130, y: 100 },
      class: getClass(newVal, 0),
      selected:
        selectedProcessor.value.uuid ===
        selectedWorkflowActivity.value.workflow[0].uuid
          ? true
          : false,
    },
    {
      id: "2",
      type: "default",
      data: {
        label: getLabel(newVal.workflow[1], "Processor"),
        status: newVal.workflow[1].status,
        class: getClass(newVal, 1),
      },
      position: { x: 150, y: 250 },
      class: getClass(newVal, 1),
      selected:
        selectedProcessor.value.uuid ===
        selectedWorkflowActivity.value.workflow[1].uuid
          ? true
          : false,
    },
    {
      id: "3",
      type: "default",
      data: {
        label: getLabel(newVal.workflow[2], "Postprocessor"),
        status: newVal.workflow[2].status,
      },
      position: { x: 170, y: 400 },
      class: getClass(newVal, 2),
      selected:
        selectedProcessor.value.uuid ===
        selectedWorkflowActivity.value.workflow[2].uuid
          ? true
          : false,
    },
  ];
});

/*
Side Panel Logic
 */
function onTogglePanelVisibility() {
  sidePanelVisible.value = !sidePanelVisible.value;
}

function openDetailsPanel(processor) {
  isDetailsPanelOpen.value = true;
  store.dispatch("analysisModule/setSelectedProcessor", processor);
}

const handleCloseDialog = () => {
  store.dispatch("analysisModule/hideActivityLogDialog");
};

/*
Event Handler for Node Click
*/

onNodeClick(({ node }) => {
  const selectedApplication = selectedWorkflowActivity.value.workflow.find(
    (x) => x.name === node.data.label
  );
  if (selectedApplication) {
    selectedNode.value = selectedApplication;
    openDetailsPanel(selectedApplication);
  }
});
</script>

<template>
  <div class="activity-monitor">
    <bf-empty-page-state
      v-if="!isLoading && !isSelectedWorkflowActivitySet"
      class="empty"
    >
      <img
        src="/src/assets/images/illustrations/illo-collaboration.svg"
        height="240"
        width="247"
        alt="Teams illustration"
      />
      <div>
        <h2>There is no Workflow Activity yet</h2>
        <p>
          Once you run an Analysis Workflow, you can view the status of your
          workflow here.
        </p>
      </div>
    </bf-empty-page-state>
    <div
      v-if="!isLoading && isSelectedWorkflowActivitySet"
      class="graph-browser"
    >
      <div class="vue-flow-title">
        {{ `Workflow Run: ${selectedWorkflowActivity?.name}` }}
      </div>
      <div class="vue-flow-wrapper">
        <VueFlow
          :nodes="nodes"
          :edges="edges"
          :default-viewport="{ zoom: 1 }"
          :min-zoom="0.2"
          :max-zoom="4"
        >
          <Background pattern-color="#aaa" :gap="16" />
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
    <ActivityLogs
      :dialog-visible="activityDialogVisible"
      :selected-node="selectedNode"
      :selected-application="selectedWorkflowActivity"
      @close-dialog="handleCloseDialog"
    ></ActivityLogs>
  </div>
</template>

<style lang="scss">
/* this contains the default theme, these are optional styles */
@use "../../../styles/vueflow_core";
@use "../../../styles/vueflow.css";

/* these are necessary styles for vue flow */
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/minimap/dist/style.css";
</style>

<style lang="scss">
@use "../../../styles/theme";

.modified-stage {
  margin: 0;
}

.graph-browser {
  height: calc(100vh - 190px);
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

.vue-flow-title {
  position: absolute;
  top: 7%;
  left: 6%;
  background-color: theme.$gray_1;
  width: fit-content;
  padding: 10px;
  z-index: 1;
  border-radius: 5px;
  margin: 0;
}

.vue-flow__node.gray-node {
  border: 2px solid gray;
}

.vue-flow__node.blue-node {
  border: 2px solid blue;
}

.vue-flow__node.blue-node.animate {
  animation: border-glow 5s infinite ease-in-out;
}

.vue-flow__node.green-node {
  border: 2px solid theme.$status_green;
}

.vue-flow__node.red-node {
  border: 2px solid red;
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes border-glow {
  0% {
    border-color: transparent;
    box-shadow: 0 0 5px rgba(0, 255, 128, 0.2);
  }
  50% {
    border-color: theme.$status_green;
    box-shadow: 0 0 15px rgba(0, 255, 128, 0.6);
  }
  100% {
    border-color: transparent;
    box-shadow: 0 0 5px rgba(0, 255, 128, 0.2);
  }
}

.vue-flow__node.selected {
  background-color: theme.$gray_2;
}

.vue-flow__node {
  &:hover {
    background-color: theme.$gray_2;
  }
}
</style>
