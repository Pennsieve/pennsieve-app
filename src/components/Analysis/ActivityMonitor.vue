<script setup>
import { computed, watch, nextTick, ref, onMounted } from "vue";
import { useStore } from "vuex";

// Vue Flow Imports
import { MarkerType, useVueFlow, VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { useLayout } from "../datasets/records/GraphBrowser/useLayout";
import { useRoute } from "vue-router";
import ActivitySidePanel from "./ActivitySidePanel.vue";

const route = useRoute();
const { layout } = useLayout();

const { onInit, onConnect, addEdges, fitView, findNode, getSelectedNodes } =
  useVueFlow();
// Access the Vuex store
const store = useStore();

// Gobal State from Vuex Store
const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"]
);

const workflowInstance = computed(
  () => store.getters["analysisModule/workflowInstance"]
);

const workflowLogs = computed(
  () => store.getters["analysisModule/workflowLogs"]
);

const selectedWorkflowActivity = computed(
  () => store.getters["analysisModule/selectedWorkflowActivity"]
);

const cancelWorkflowDialogVisible = computed(() => store.state.analysisModule.cancelWorkflowDialogVisible)

const hideCancelWorkflowDialog = () => {
  store.commit('analysisModule/HIDE_CANCEL_WORKFLOW_DIALOG')
}

const acceptDialog = () => {
  store.dispatch('analaysisModule/cancelWorkflow',selectedWorkflowActivity?.uuid)
  hideCancelWorkflowDialog();
}

const rejectDialog = () => {
  hideCancelWorkflowDialog();
}

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

  const isActive = function (workflow) {
    // if the workflow does not contain a completedAt property, it is active
    return !workflow.completedAt;
  };

  const onlyActiveWorkflows = workflowInstances.value.filter((workflow) => {
    return isActive(workflow);
    // show the workflows with the most recent startedAt timestamp at the top of the list
  });

  const sortedActiveWorkflows = onlyActiveWorkflows.sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );

  try {
    await store.dispatch(
      "analysisModule/setSelectedWorkflowActivity",
      sortedActiveWorkflows[0]
    );
  } catch (err) {
    console.error(err);
  } finally {
    isLoading.value = false;
  }

  console.log("***", selectedWorkflowActivity.value);

  nodes.value = [
    {
      id: "1",
      type: "input",
      data: {
        label: getLabel(workflowInstances[0]?.workflow[0], "Preprocessor"),
      },
      position: { x: 130, y: 100 },
      class: "light",
    },
    {
      id: "2",
      data: {
        label: getLabel(workflowInstances[0]?.workflow[1], "Processor"),
      },
      position: { x: 150, y: 250 },
      class: "light",
    },
    {
      id: "3",
      type: "output",
      data: {
        label: getLabel(workflowInstances[0]?.workflow[2], "Postprocessor"),
      },
      position: { x: 170, y: 400 },
      class: "light",
    },
  ];

  console.log("selectedWorkflowActivity.value", selectedWorkflowActivity.value);

  // fetch one workflow instance
  // try {
  //   isLoading.value = true;
  //   await store.dispatch(
  //     "analysisModule/fetchWorkflowInstance",
  //     workflowInstances.value[0].uuid
  //   );
  // } catch (err) {
  //   console.error(err);
  // } finally {
  //   isLoading.value = false;
  //   // console.log(workflowInstance.value);
  // }
  // fetch logs for one workflow instance
  // try {
  //   isLoading.value = true;
  //   await store.dispatch(
  //     "analysisModule/fetchWorkflowLogs",
  //     workflowInstances.value[3]
  //   );
  // } catch (err) {
  //   console.error(err);
  // } finally {
  //   isLoading.value = false;
  //   console.log("workflowFlow Logs", workflowLogs.value);
  // }
});

watch(selectedWorkflowActivity, (newVal, oldVal) => {
  console.log("selectedWorkflowActivity changed:", newVal);

  if (newVal) {
    nodes.value = [
      {
        id: "1",
        type: "input",
        data: {
          label: getLabel(newVal.workflow[0], "Preprocessor"),
        },
        position: { x: 130, y: 100 },
        class: "light",
      },
      {
        id: "2",
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
</script>

<template>
  <div class="activity-monitor">
    <h2 class="vue-flow-title">
      {{ `Workflow UUID: ${selectedWorkflowActivity?.uuid}` }}
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
          <Background pattern-color="#aaa" :gap="16" />

          <!-- <MiniMap :position="minimapLocation" :pannable="true" /> -->

          <Controls position="top-left" />
        </VueFlow>
      </div>

      <ActivitySidePanel :class="{ visible: sidePanelVisible }" :panel-visible="sidePanelVisible"
        @toggle-panel-visibility="onTogglePanelVisibility" />
      <el-dialog v-model="cancelWorkflowDialogVisible" title="Cancel Workflow" width="500" center @close="hideCancelWorkflowDialog">
        <span>
          Would you like to cancel this workflow: {{ selectedWorkflowActivity?.uuid }} ?
        </span>
        <template #footer>
          <div class="dialog-footer">
            <el-button class="dialog-button" @click="rejectDialog">No</el-button>
            <el-button class="dialog-button" @click="acceptDialog">
              Yes
            </el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </div>
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

  .dialog-button {
    border: solid 1px #4d628c;
    border-radius: 5px;
    ;
  }
}
</style>
