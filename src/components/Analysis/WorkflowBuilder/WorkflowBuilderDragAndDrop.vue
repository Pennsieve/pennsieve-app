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
import { MiniMap } from "@vue-flow/minimap";
import WorkflowSidePanel from "./WorkflowSidePanel.vue";
import EventBus from "../../../utils/event-bus";

const {
  onNodeClick,
  onConnect,
  addNodes,
  addEdges,
  removeNodes,
  removeEdges,
  findNode,
  onNodeDragStop,
  onNodesChange,
  onEdgesChange,
} = useVueFlow();

/*
Initial Values
*/
const initialNodes = [];
const initialEdges = [];

/*
Local State
*/
const isLoading = ref(false);
const nodes = ref(initialNodes);
const edges = ref(initialEdges);
const sidePanelVisible = ref(false);
const isDetailsPanelOpen = ref(false);
const selectedNode = ref({});
const workflowName = ref("New Workflow");
const isDirty = ref(false);
const draggedApplication = ref(null);

// Available application types
const applicationTypes = ref([
  {
    id: "pre-processor",
    name: "Pre-processor",
    type: "preprocessor",
    color: "#10B981", // green
    description: "Data preprocessing and validation",
  },
  {
    id: "echo-app",
    name: "Echo App",
    type: "processor",
    color: "#3B82F6", // blue
    description: "Main processing application",
  },
  {
    id: "data-validator",
    name: "Data Validator",
    type: "processor",
    color: "#3B82F6", // blue
    description: "Data validation and quality checks",
  },
  {
    id: "api-gateway",
    name: "API Gateway",
    type: "processor",
    color: "#3B82F6", // blue
    description: "API routing and management",
  },
  {
    id: "post-agent",
    name: "Post Agent",
    type: "postprocessor",
    color: "#8B5CF6", // purple
    description: "Post-processing and cleanup",
  },
]);

/*
Global State
*/
const store = useStore();
const savedWorkflows = computed(
  () => store.getters["workflowBuilder/savedWorkflows"] || []
);

/*
Helpers
*/
const generateNodeId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getNodeClass = (nodeType) => {
  const typeMap = {
    preprocessor: "green-node",
    processor: "blue-node",
    postprocessor: "purple-node",
  };
  return typeMap[nodeType] || "gray-node";
};

const createNodeFromApplication = (application, position) => {
  return {
    id: generateNodeId(),
    type: "default",
    data: {
      label: application.name,
      application: application,
      type: application.type,
    },
    position: position,
    class: getNodeClass(application.type),
  };
};

/*
Drag and Drop Handlers
*/
const onDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

const onDrop = (event) => {
  event.preventDefault();

  const applicationId = event.dataTransfer.getData("application/json");
  if (!applicationId) return;

  const application = applicationTypes.value.find(
    (app) => app.id === applicationId
  );
  if (!application) return;

  // Calculate drop position relative to the flow
  const flowBounds = event.currentTarget.getBoundingClientRect();
  const position = {
    x: event.clientX - flowBounds.left - 100,
    y: event.clientY - flowBounds.top - 25,
  };

  const newNode = createNodeFromApplication(application, position);
  addNodes([newNode]);
  markAsDirty();
};

/*
Node Management
*/
const deleteSelectedNodes = () => {
  const selectedNodes = nodes.value.filter((node) => node.selected);
  if (selectedNodes.length > 0) {
    const nodeIds = selectedNodes.map((node) => node.id);
    removeNodes(nodeIds);

    // Remove connected edges
    const connectedEdges = edges.value.filter(
      (edge) => nodeIds.includes(edge.source) || nodeIds.includes(edge.target)
    );
    if (connectedEdges.length > 0) {
      removeEdges(connectedEdges.map((edge) => edge.id));
    }

    markAsDirty();
  }
};

/*
Connection Handlers
*/
const onConnectHandler = (params) => {
  // Validate connection (e.g., no cycles, proper flow direction)
  if (isValidConnection(params)) {
    addEdges([
      {
        id: `edge_${params.source}_${params.target}`,
        source: params.source,
        target: params.target,
        animated: false,
        type: "default",
      },
    ]);
    markAsDirty();
  }
};

const isValidConnection = (params) => {
  // Prevent self-connections
  if (params.source === params.target) return false;

  // Check if connection already exists
  const existingConnection = edges.value.find(
    (edge) => edge.source === params.source && edge.target === params.target
  );

  return !existingConnection;
};

/*
Workflow Management
*/
const markAsDirty = () => {
  isDirty.value = true;
};

const saveWorkflow = async () => {
  try {
    const workflowData = {
      id: Date.now().toString(),
      name: workflowName.value,
      nodes: nodes.value,
      edges: edges.value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await store.dispatch("workflowBuilder/saveWorkflow", workflowData);

    isDirty.value = false;
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Workflow saved successfully!",
      },
    });
  } catch (error) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Failed to save workflow. Please try again.",
      },
    });
  }
};

const loadWorkflow = (workflow) => {
  workflowName.value = workflow.name;
  nodes.value = workflow.nodes || [];
  edges.value = workflow.edges || [];
  isDirty.value = false;
};

const newWorkflow = () => {
  if (isDirty.value) {
    // Show confirmation dialog
    if (
      confirm(
        "You have unsaved changes. Are you sure you want to create a new workflow?"
      )
    ) {
      clearWorkflow();
    }
  } else {
    clearWorkflow();
  }
};

const clearWorkflow = () => {
  workflowName.value = "New Workflow";
  nodes.value = [];
  edges.value = [];
  isDirty.value = false;
  selectedNode.value = {};
};

const validateWorkflow = () => {
  const errors = [];

  // Check if workflow has nodes
  if (nodes.value.length === 0) {
    errors.push("Workflow must contain at least one application");
  }

  // Check for disconnected nodes (optional)
  const connectedNodeIds = new Set();
  edges.value.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const disconnectedNodes = nodes.value.filter(
    (node) => !connectedNodeIds.has(node.id) && nodes.value.length > 1
  );

  if (disconnectedNodes.length > 0) {
    errors.push(`${disconnectedNodes.length} application(s) are not connected`);
  }

  return errors;
};

const runWorkflow = async () => {
  const validationErrors = validateWorkflow();
  if (validationErrors.length > 0) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: `Cannot run workflow: ${validationErrors.join(", ")}`,
      },
    });
    return;
  }

  try {
    const workflowConfig = {
      name: workflowName.value,
      nodes: nodes.value,
      edges: edges.value,
    };

    await store.dispatch("workflowBuilder/executeWorkflow", workflowConfig);

    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Workflow execution started!",
      },
    });
  } catch (error) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Failed to start workflow execution",
      },
    });
  }
};

/*
Side Panel Logic
*/
function onTogglePanelVisibility() {
  sidePanelVisible.value = !sidePanelVisible.value;
}

function openDetailsPanel(node) {
  isDetailsPanelOpen.value = true;
  selectedNode.value = node;
}

/*
Event Handlers
*/
onNodeClick(({ node }) => {
  selectedNode.value = node;
  openDetailsPanel(node);
});

onConnect(onConnectHandler);

onNodesChange((changes) => {
  // Handle node changes (position, selection, etc.)
  markAsDirty();
});

onEdgesChange((changes) => {
  // Handle edge changes
  markAsDirty();
});

// Keyboard shortcuts
const onKeyDown = (event) => {
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelectedNodes();
  } else if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case "s":
        event.preventDefault();
        saveWorkflow();
        break;
      case "n":
        event.preventDefault();
        newWorkflow();
        break;
    }
  }
};

onMounted(() => {
  document.addEventListener("keydown", onKeyDown);

  // Load saved workflows
  store.dispatch("workflowBuilder/fetchSavedWorkflows");
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  // Clean up if needed
});
</script>

<template>
  <div class="workflow-builder">
    <div class="workflow-builder-header">
      <div class="workflow-title-section">
        <input
          v-model="workflowName"
          class="workflow-title-input"
          placeholder="Enter workflow name..."
          @input="markAsDirty"
        />
        <span v-if="isDirty" class="unsaved-indicator">•</span>
      </div>

      <div class="workflow-actions">
        <bf-button class="secondary" @click="saveWorkflow" :disabled="!isDirty">
          {{ isDirty ? "Save*" : "Saved" }}
        </bf-button>
        <bf-button @click="runWorkflow" :disabled="nodes.length === 0">
          Run Workflow
        </bf-button>
      </div>
    </div>

    <div class="workflow-builder-content">
      <div class="workflow-canvas-container">
        <div class="vue-flow-wrapper" @dragover="onDragOver" @drop="onDrop">
          <VueFlow
            :nodes="nodes"
            :edges="edges"
            :default-viewport="{ zoom: 1 }"
            :min-zoom="0.2"
            :max-zoom="4"
            :snap-to-grid="true"
            :snap-grid="[20, 20]"
            fit-view-on-init
          >
            <Background pattern-color="#aaa" :gap="20" />
            <Controls position="top-left" />
            <MiniMap position="bottom-right" />
          </VueFlow>

          <div v-if="nodes.length === 0" class="empty-canvas-message">
            <div class="empty-message">
              <h3>Start Building Your Workflow</h3>
              <p>
                Drag applications from the panel on the right to begin building
                your workflow.
              </p>
              <p>Connect applications by dragging from one node to another.</p>
            </div>
          </div>
        </div>
      </div>

      <WorkflowSidePanel
        :class="{ visible: sidePanelVisible }"
        :panel-visible="sidePanelVisible"
        :show-details-panel="isDetailsPanelOpen"
        :selected-node="selectedNode"
        :application-types="applicationTypes"
        :saved-workflows="savedWorkflows"
        @toggle-panel-visibility="onTogglePanelVisibility"
        @load-workflow="loadWorkflow"
        @close-details="isDetailsPanelOpen = false"
      />
    </div>
  </div>
</template>

<style lang="scss">
/* Import Vue Flow styles */
@import "@vue-flow/core/dist/style.css";
@import "@vue-flow/minimap/dist/style.css";
</style>

<style lang="scss" scoped>
@use "../../../styles/theme";

.workflow-builder {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: theme.$gray_1;
}

.workflow-builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid theme.$gray_3;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.workflow-title-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workflow-title-input {
  font-size: 18px;
  font-weight: 600;
  border: none;
  background: transparent;
  outline: none;
  min-width: 200px;
  padding: 4px 8px;
  border-radius: 4px;

  &:hover,
  &:focus {
    background: theme.$gray_1;
  }
}

.unsaved-indicator {
  font-size: 24px;
  line-height: 1;
}

.workflow-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.workflow-builder-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.workflow-canvas-container {
  flex: 1;
  position: relative;
  background: theme.$gray_1;
}

.vue-flow-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.empty-canvas-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10;
  background: white;
  padding: 32px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}

.empty-message {
  h3 {
    margin: 0 0 16px 0;
    color: theme.$purple_3;
  }

  p {
    margin: 8px 0;
    color: theme.$gray_4;
    line-height: 1.5;
  }
}

/* Node Styles */
:deep(.vue-flow__node) {
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid transparent;
  background: white;
  min-width: 120px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  &.selected {
    border-color: theme.$app-primary-color;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
}

:deep(.vue-flow__node.green-node) {
  border-left: 4px solid #10b981;

  &.selected {
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
  }
}

:deep(.vue-flow__node.blue-node) {
  border-left: 4px solid #3b82f6;

  &.selected {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
}

:deep(.vue-flow__node.purple-node) {
  border-left: 4px solid #8b5cf6;

  &.selected {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
}

:deep(.vue-flow__node.gray-node) {
  border-left: 4px solid #6b7280;

  &.selected {
    border-color: #6b7280;
    box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
  }
}

/* Edge Styles */
:deep(.vue-flow__edge) {
  .vue-flow__edge-path {
    stroke: theme.$gray_4;
    stroke-width: 2;
  }

  &:hover .vue-flow__edge-path {
    stroke: theme.$app-primary-color;
  }

  .vue-flow__edge-arrow {
    fill: theme.$gray_4;
  }

  &:hover .vue-flow__edge-arrow {
    fill: theme.$app-primary-color;
  }
}

/* Controls */
:deep(.vue-flow__controls) {
  button {
    background: white;
    border: 1px solid theme.$gray_3;
    border-radius: 4px;

    &:hover {
      background: theme.$gray_1;
    }
  }
}

/* MiniMap */
:deep(.vue-flow__minimap) {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
}
</style>
