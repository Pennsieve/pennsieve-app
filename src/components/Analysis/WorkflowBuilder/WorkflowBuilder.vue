<script setup>
import { computed, watch, ref, onMounted } from "vue";

import { useStore } from "vuex";

// Vue Flow Imports
import { useVueFlow, VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import EventBus from "../../../utils/event-bus";

const {
  onNodeClick,
  onNodesChange,
  addNodes,
  addEdges,
  removeNodes,
  removeEdges,
} = useVueFlow();

/*
Local State
*/
const isLoading = ref(false);
const nodes = ref([]);
const edges = ref([]);
const workflowName = ref("");
const workflowDescription = ref("");
const draggedApp = ref(null);

/*
Global State
*/
const store = useStore();
const availableApplications = computed(
  () => store.getters["analysisModule/applications"] || []
);

/*
Helpers
*/

const generateNodeId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const calculateNodePosition = () => {
  const baseX = 200;
  const baseY = 100;
  const spacing = 150;

  return {
    x: baseX + nodes.value.length * 20,
    y: baseY + nodes.value.length * spacing,
  };
};

const onDragStart = (application) => {
  draggedApp.value = application;
};

const onDrop = (event) => {
  event.preventDefault();

  if (!draggedApp.value) return;

  // Check if application already exists in workflow
  const appAlreadyExists = nodes.value.some(
    (node) => node.data.application.uuid === draggedApp.value.uuid
  );

  if (appAlreadyExists) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: `"${draggedApp.value.name}" is already in the workflow.`,
      },
    });
    draggedApp.value = null;
    return;
  }

  const nodeId = generateNodeId();
  const position = calculateNodePosition();

  const newNode = {
    id: nodeId,
    type: "default",
    data: {
      label: draggedApp.value.name,
      application: draggedApp.value,
    },
    position,
  };

  nodes.value.push(newNode);

  // Create edge to previous node if exists
  if (nodes.value.length > 1) {
    const prevNode = nodes.value[nodes.value.length - 2];
    const newEdge = {
      id: `e${prevNode.id}-${nodeId}`,
      source: prevNode.id,
      target: nodeId,
      animated: false,
    };
    edges.value.push(newEdge);
  }

  draggedApp.value = null;
};

const onDragOver = (event) => {
  event.preventDefault();
};

const removeNode = (nodeId) => {
  const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return;

  // Remove associated edges
  edges.value = edges.value.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  );

  // Remove node
  nodes.value.splice(nodeIndex, 1);

  // Reconnect remaining nodes
  if (nodes.value.length > 0) {
    edges.value = [];
    for (let i = 0; i < nodes.value.length - 1; i++) {
      edges.value.push({
        id: `e${nodes.value[i].id}-${nodes.value[i + 1].id}`,
        source: nodes.value[i].id,
        target: nodes.value[i + 1].id,
        animated: false,
      });
    }

    // Update node types
    nodes.value.forEach((node, idx) => {
      node.type = "default";
    });
  }
};

const clearWorkflow = () => {
  nodes.value = [];
  edges.value = [];
  workflowName.value = "";
  workflowDescription.value = "";
};

const saveWorkflow = async () => {
  if (!workflowName.value.trim()) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Please provide a workflow name.",
      },
    });
    return;
  }

  if (nodes.value.length === 0) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Please add at least one application to the workflow.",
      },
    });
    return;
  }

  const workflowData = {
    name: workflowName.value,
    description: workflowDescription.value,
    applications: nodes.value.map((node) => node.data.application.uuid),
  };

  try {
    await store.dispatch("analysisModule/createWorkflow", workflowData);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Workflow created successfully!",
      },
    });
    clearWorkflow();
  } catch (error) {
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Failed to create workflow. Please try again.",
      },
    });
  }
};

/*
Fetch Initial Data
*/
onMounted(async () => {
  try {
    isLoading.value = true;

    // Fetch available applications from /applications endpoint
    await store.dispatch("analysisModule/fetchApplications");
    availableApplications.value =
      store.getters["analysisModule/applications"] || [];
  } catch (err) {
    console.error(err);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Failed to load applications.",
      },
    });
  } finally {
    isLoading.value = false;
  }
});

/*
Event Handler for Node Click
*/
onNodeClick(({ node }) => {
  // Optional: Show node details or allow editing
  console.log("Node clicked:", node);
});

/*
Watch for applications changes
*/
watch(
  availableApplications,
  (newVal) => {
    console.log("Applications updated:", newVal);
  },
  { immediate: true }
);
</script>

<template>
  <div class="workflow-builder">
    <div class="builder-header">
      <h2>Workflow Builder</h2>
      <div class="workflow-controls">
        <el-input
          v-model="workflowName"
          placeholder="Enter workflow name"
          style="width: 300px; margin-right: 10px"
        />
        <el-input
          v-model="workflowDescription"
          placeholder="Enter workflow description (optional)"
          style="width: 400px; margin-right: 10px"
        />

        <bf-button class="secondary" @click="clearWorkflow">Clear</bf-button>
        <bf-button @click="saveWorkflow">Save Workflow</bf-button>
      </div>
    </div>

    <div class="builder-content">
      <!-- Workflow Canvas -->
      <div class="workflow-canvas" @drop="onDrop" @dragover="onDragOver">
        <div v-if="nodes.length === 0" class="empty-canvas">
          <h3>Drag applications here to build your workflow</h3>
          <p>Applications will be connected in the order you add them</p>
        </div>

        <VueFlow
          v-else
          :nodes="nodes"
          :edges="edges"
          :default-viewport="{ zoom: 1 }"
          :min-zoom="0.2"
          :max-zoom="4"
        >
          <Background pattern-color="#aaa" :gap="16" />
          <Controls position="top-left" />

          <template #node-default="{ data, id }">
            <div class="custom-node">
              <div class="node-header">
                <span class="node-title">{{ data.label }}</span>
                <button class="remove-btn" @click.stop="removeNode(id)">
                  ×
                </button>
              </div>
              <div v-if="data.application.description" class="node-description">
                {{ data.application.description }}
              </div>
              <div v-if="data.application.resources" class="node-resources">
                CPU: {{ data.application.resources.cpu || "N/A" }} | Memory:
                {{ data.application.resources.memory || "N/A" }}
              </div>
            </div>
          </template>

          <template #node-input="{ data, id }">
            <div class="custom-node input-node">
              <div class="node-header">
                <span class="node-title">{{ data.label }}</span>
                <button class="remove-btn" @click.stop="removeNode(id)">
                  ×
                </button>
              </div>
              <div class="node-badge">Start</div>
              <div v-if="data.application.description" class="node-description">
                {{ data.application.description }}
              </div>
              <div v-if="data.application.resources" class="node-resources">
                CPU: {{ data.application.resources.cpu || "N/A" }} | Memory:
                {{ data.application.resources.memory || "N/A" }}
              </div>
            </div>
          </template>

          <template #node-output="{ data, id }">
            <div class="custom-node output-node">
              <div class="node-header">
                <span class="node-title">{{ data.label }}</span>
                <button class="remove-btn" @click.stop="removeNode(id)">
                  ×
                </button>
              </div>
              <div class="node-badge">End</div>
              <div v-if="data.application.description" class="node-description">
                {{ data.application.description }}
              </div>
              <div v-if="data.application.resources" class="node-resources">
                CPU: {{ data.application.resources.cpu || "N/A" }} | Memory:
                {{ data.application.resources.memory || "N/A" }}
              </div>
            </div>
          </template>
        </VueFlow>
      </div>

      <!-- Applications Sidebar (Right) -->
      <div class="applications-sidebar">
        <h3>Applications</h3>
        <div v-if="isLoading" class="loading">Loading applications...</div>
        <div v-else class="applications-list">
          <div
            v-for="app in availableApplications"
            :key="app.uuid"
            class="application-item"
            draggable="true"
            @dragstart="onDragStart(app)"
          >
            <div class="app-name">{{ app.name }}</div>
            <div class="app-meta"></div>
            <div class="app-description">
              {{ app.description || "No description" }}
            </div>
            <div class="app-resources">
              CPU: {{ app.resources?.cpu || "N/A" }} | Memory:
              {{ app.resources?.memory || "N/A" }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Workflow Summary -->
    <div v-if="nodes.length > 0" class="workflow-summary">
      <h4>Workflow Summary</h4>
      <div class="summary-content">
        <span><strong>Steps:</strong> {{ nodes.length }}</span>
        <span><strong>Name:</strong> {{ workflowName || "Unnamed" }}</span>
        <span v-if="workflowDescription"
          ><strong>Description:</strong> {{ workflowDescription }}</span
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use "../../../styles/vueflow_core";
@use "../../../styles/vueflow.css";
@import "@vue-flow/core/dist/style.css";

// Hide default Vue Flow node styling
.vue-flow__node {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}
</style>

<style lang="scss" scoped>
@use "../../../styles/theme";

.workflow-builder {
  height: calc(100vh - 190px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.builder-header {
  padding: 20px;
  background-color: theme.$gray_1;
  border-bottom: 1px solid theme.$gray_3;

  h2 {
    margin: 0 0 15px 0;
  }

  .workflow-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
}

.builder-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.applications-sidebar {
  width: 350px;
  background-color: theme.$white;
  border-left: 1px solid theme.$gray_3;
  overflow-y: auto;
  padding: 20px;

  h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
  }

  .loading {
    text-align: center;
    padding: 20px;
    color: theme.$gray_4;
  }
}

.applications-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.application-item {
  display: flex;
  flex-direction: column;
  padding: 14px;
  background-color: theme.$gray_1;
  border: 2px solid theme.$gray_3;
  border-radius: 8px;
  cursor: grab;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    cursor: grabbing;
  }

  .app-info {
    flex: 1;
    min-width: 0;
  }

  .app-name {
    font-weight: 600;
    font-size: 15px;
    margin-bottom: 6px;
    color: theme.$black;
  }

  .app-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }

  .app-type {
    font-size: 11px;
    padding: 2px 8px;
    background-color: theme.$gray_3;
    border-radius: 4px;
    font-weight: 600;
    text-transform: lowercase;
  }

  .app-status {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: lowercase;

    &.deployed {
      background-color: #d4edda;
      color: #155724;
    }

    &.error {
      background-color: #f8d7da;
      color: #721c24;
    }

    &.pending {
      background-color: #fff3cd;
      color: #856404;
    }
  }

  .app-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 6px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .app-resources {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
  }
}

.workflow-canvas {
  flex: 1;
  position: relative;
  background-color: theme.$gray_1;
}

.empty-canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: theme.$gray_4;

  h3 {
    margin: 0 0 10px 0;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

.custom-node {
  background: white;
  border: 2px solid theme.$gray_3;
  border-radius: 8px;
  padding: 14px;
  min-width: 250px;
  max-width: 350px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;

  &:hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }

  .node-title {
    font-weight: 600;
    font-size: 15px;
    color: theme.$black;
    flex: 1;
    line-height: 1.3;
  }

  .remove-btn {
    background: theme.$status_red;
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
    transition: background 0.2s;

    &:hover {
      background: darken(theme.$status_red, 10%);
    }
  }

  .node-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 8px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .node-resources {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid theme.$gray_2;
  }

  .node-badge {
    margin-top: 8px;
    margin-bottom: 8px;
    padding: 4px 8px;
    background: theme.$gray_2;
    border-radius: 4px;
    font-size: 11px;
    text-align: center;
    font-weight: 600;
  }

  &.input-node {
    border-color: theme.$status_green;

    .node-badge {
      background: theme.$status_green;
      color: white;
    }
  }

  &.output-node {
    border-color: theme.$status_green;

    .node-badge {
      background: theme.$status_green;
      color: white;
    }
  }
}

.workflow-summary {
  padding: 15px 20px;
  background-color: theme.$white;
  border-top: 1px solid theme.$gray_3;

  h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
  }

  .summary-content {
    display: flex;
    gap: 20px;
    font-size: 13px;
    flex-wrap: wrap;
  }
}
</style>
