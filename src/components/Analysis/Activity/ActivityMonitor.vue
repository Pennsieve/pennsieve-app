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
Local State
*/
const isLoading = ref(false);
const nodes = ref([]);
const edges = ref([]);
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
          msg: "Your cancelation request was successful. It may take some time to complete.",
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

const getLabel = (workflow, type, index) => {
  if (workflow?.name) {
    return `${workflow.name}`;
  }

  // Generate default labels based on position
  if (index === 0) return "Preprocessor";
  if (workflow && index === workflow.length - 1) return "Postprocessor";
  return `Processor ${index}`;
};

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

const generateNodesAndEdges = (workflowActivity) => {
  if (
    !workflowActivity?.workflow ||
    !Array.isArray(workflowActivity.workflow)
  ) {
    return { nodes: [], edges: [] };
  }

  const processors = workflowActivity.workflow;
  const nodeSpacing = 150; // Vertical spacing between nodes
  const startY = 100; // Starting Y position
  const baseX = 150; // Base X position with slight variation

  // Generate nodes
  const newNodes = processors.map((processor, index) => ({
    id: `${index + 1}`,
    type: index === processors.length - 1 ? "output" : "default",
    data: {
      label: getLabel(processor, "Processor", index),
      status: processor.status,
    },
    position: {
      x: baseX + index * 20, // Slight horizontal offset for visual appeal
      y: startY + index * nodeSpacing,
    },
    class: getClass(workflowActivity, index),
    selected: selectedProcessor.value.uuid === processor.uuid,
  }));

  // Generate edges (connections between consecutive nodes)
  const newEdges = processors.slice(0, -1).map((_, index) => ({
    id: `e${index + 1}-${index + 2}`,
    source: `${index + 1}`,
    target: `${index + 2}`,
    animated: false,
  }));

  return { nodes: newNodes, edges: newEdges };
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
    await getApplicationsStatus(workflowInstances.value[0]);
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
  const { nodes: newNodes, edges: newEdges } = generateNodesAndEdges(newVal);
  nodes.value = newNodes;
  edges.value = newEdges;
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
