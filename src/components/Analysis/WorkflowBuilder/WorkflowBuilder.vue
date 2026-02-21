<script setup>
import { computed, watch, ref, onMounted } from "vue";

import { useStore } from "vuex";

// Vue Flow Imports
import { useVueFlow, VueFlow, Handle, Position } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import EventBus from "../../../utils/event-bus";
import IconFile from "../../icons/IconFile.vue";
import IconCollection from "../../icons/IconCollection.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import IconInfoSmall from "../../icons/IconInfoSmall.vue";

const {
  onNodeClick,
  onNodesChange,
  onConnect,
  addNodes,
  addEdges,
  removeNodes,
  removeEdges,
  screenToFlowCoordinate,
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
const draggedType = ref(null); // 'application', 'data-source', or 'data-target'

/*
Global State
*/
const store = useStore();
const availableApplications = computed(
  () => store.getters["analysisModule/applications"] || []
);
const targetTypes = computed(
  () => store.getters["analysisModule/targetTypes"] || []
);

/*
Helpers
*/

const generateNodeId = () => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const onDragStart = (item, event, type = "application") => {
  draggedType.value = type;
  draggedApp.value = type === "application" ? item : null;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
};

const onDrop = (event) => {
  event.preventDefault();

  if (!draggedType.value) return;

  // Convert the drop position from screen coordinates to flow coordinates
  // so the node appears exactly where the user dropped it
  const position = screenToFlowCoordinate({
    x: event.clientX,
    y: event.clientY,
  });

  const nodeId = generateNodeId();
  let newNode;

  if (draggedType.value === "data-source") {
    newNode = {
      id: nodeId,
      type: "data-source",
      data: {
        label: "Data Source",
      },
      position,
    };
  } else if (draggedType.value === "data-target") {
    newNode = {
      id: nodeId,
      type: "data-target",
      data: {
        label: "Data Target",
        targetType: targetTypes.value.length === 1 ? targetTypes.value[0].id : null,
      },
      position,
    };
  } else if (draggedApp.value) {
    newNode = {
      id: nodeId,
      type: "default",
      data: {
        label: draggedApp.value.name,
        application: draggedApp.value,
      },
      position,
    };
  }

  if (newNode) {
    nodes.value.push(newNode);
  }

  draggedApp.value = null;
  draggedType.value = null;
};

const onDragOver = (event) => {
  event.preventDefault();
};

// Handle edge connections from user dragging between node handles
onConnect((params) => {
  // Guard against self-loops
  if (params.source === params.target) return;

  // Guard against duplicate edges
  const duplicate = edges.value.some(
    (e) => e.source === params.source && e.target === params.target
  );
  if (duplicate) return;

  edges.value.push({
    id: `e${params.source}-${params.target}`,
    source: params.source,
    target: params.target,
    animated: false,
  });
});

const removeNode = (nodeId) => {
  const nodeIndex = nodes.value.findIndex((n) => n.id === nodeId);
  if (nodeIndex === -1) return;

  // Remove associated edges
  edges.value = edges.value.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  );

  // Remove node
  nodes.value.splice(nodeIndex, 1);
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

  const processors = nodes.value.map((node) => {
    // Build dependsOn from incoming edges (edges whose target is this node)
    const dependsOn = edges.value
      .filter((e) => e.target === node.id)
      .map((e) => e.source);

    if (node.type === "data-source") {
      return {
        id: node.id,
        type: "data-source",
        dependsOn: [],
      };
    }

    if (node.type === "data-target") {
      return {
        id: node.id,
        type: "data-target",
        targetType: node.data.targetType,
        dependsOn: dependsOn,
      };
    }

    // Default: processor
    return {
      id: node.id,
      type: "processor",
      sourceUrl: node.data.application?.source?.url,
      dependsOn: dependsOn,
    };
  });

  const workflowData = {
    name: workflowName.value,
    description: workflowDescription.value,
    processors: processors,
  };

  try {
    await store.dispatch("analysisModule/createWorkflow", workflowData);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Your request to create a Workflow has been initiated.",
        duration: 8000,
      },
    });
    clearWorkflow();
  } catch (error) {
    console.error(error);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "There was a problem submitting your request.",
        duration: 6000,
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

    // Fetch available applications and target types
    await Promise.all([
      store.dispatch("analysisModule/fetchApplications"),
      store.dispatch("analysisModule/fetchTargetTypes"),
    ]);
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
          <h3>Drag items here to build your workflow</h3>
          <p>Drop data sources, applications, and data targets onto the canvas, then connect them by dragging between handles</p>
        </div>

        <div v-else class="workflow-builder-flow">
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :default-viewport="{ zoom: 1 }"
            :min-zoom="0.2"
            :max-zoom="4"
          >
            <Background pattern-color="#aaa" :gap="16" />
            <Controls position="top-left" />

            <template #node-default="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node">
                <div class="node-header">
                  <span class="node-title">{{ data.label }}</span>
                  <button class="remove-btn" @click.stop="removeNode(id)">
                    ×
                  </button>
                </div>
                <div
                  v-if="data.application.description"
                  class="node-description"
                >
                  {{ data.application.description }}
                </div>
                <div v-if="data.application.resources" class="node-resources">
                  CPU: {{ data.application.resources.cpu || "N/A" }} | Memory:
                  {{ data.application.resources.memory || "N/A" }}
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <template #node-input="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node input-node">
                <div class="node-header">
                  <span class="node-title">{{ data.label }}</span>
                  <button class="remove-btn" @click.stop="removeNode(id)">
                    ×
                  </button>
                </div>
                <div class="node-badge">Start</div>
                <div
                  v-if="data.application.description"
                  class="node-description"
                >
                  {{ data.application.description }}
                </div>
                <div v-if="data.application.resources" class="node-resources">
                  CPU: {{ data.application.resources.cpu || "N/A" }} | Memory:
                  {{ data.application.resources.memory || "N/A" }}
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <template #node-output="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node output-node">
                <div class="node-header">
                  <span class="node-title">{{ data.label }}</span>
                  <button class="remove-btn" @click.stop="removeNode(id)">
                    ×
                  </button>
                </div>
                <div class="node-badge">End</div>
                <div
                  v-if="data.application.description"
                  class="node-description"
                >
                  {{ data.application.description }}
                </div>
                <div v-if="data.application.resources" class="node-resources">
                  CPU: {{ data.application.resources.cpu || "N/A" }} | Memory:
                  {{ data.application.resources.memory || "N/A" }}
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <!-- Data Source Node: output only (feeds into processors) -->
            <template #node-data-source="{ data, id }">
              <div class="custom-node data-source-node">
                <div class="node-header">
                  <span class="node-type-badge source-badge">Source</span>
                  <span class="node-title">{{ data.label }}</span>
                  <button class="remove-btn" @click.stop="removeNode(id)">
                    ×
                  </button>
                </div>
              </div>
              <Handle id="source" type="source" :position="Position.Bottom" />
            </template>

            <!-- Data Target Node: input only (receives from processors) -->
            <template #node-data-target="{ data, id }">
              <Handle id="target" type="target" :position="Position.Top" />
              <div class="custom-node data-target-node">
                <div class="node-header">
                  <span class="node-type-badge target-badge">Target</span>
                  <span class="node-title">{{ data.label }}</span>
                  <button class="remove-btn" @click.stop="removeNode(id)">
                    ×
                  </button>
                </div>
                <div class="node-body">
                  <div class="target-type-row">
                    <el-select
                      v-model="data.targetType"
                      placeholder="Select target type"
                      size="small"
                      class="target-type-select"
                    >
                      <el-option
                        v-for="tt in targetTypes"
                        :key="tt.id"
                        :label="tt.id"
                        :value="tt.id"
                      />
                    </el-select>
                    <el-popover
                      trigger="hover"
                      placement="right"
                      :width="220"
                    >
                      <template #reference>
                        <IconInfoSmall
                          class="target-type-info-icon"
                          :width="14"
                          :height="14"
                          color="#9ca3af"
                        />
                      </template>
                      <div class="target-type-info">
                        <div
                          v-for="tt in targetTypes"
                          :key="tt.id"
                          class="target-type-info-item"
                        >
                          <div class="target-type-info-id">{{ tt.id }}</div>
                          <div class="target-type-info-desc">{{ tt.description }}</div>
                        </div>
                      </div>
                    </el-popover>
                  </div>
                </div>
              </div>
            </template>
          </VueFlow>
        </div>
      </div>

      <!-- Sidebar (Right) -->
      <div class="applications-sidebar">
        <!-- Data Section -->
        <h3>Data</h3>
        <div class="data-items-list">
          <div
            class="data-item data-source-item"
            draggable="true"
            @dragstart="onDragStart(null, $event, 'data-source')"
          >
            <IconFile class="data-item-icon" :width="20" :height="20" />
            <div class="data-item-info">
              <div class="data-item-name">Source</div>
              <div class="data-item-description">Select input packages</div>
            </div>
          </div>
          <div
            class="data-item data-target-item"
            draggable="true"
            @dragstart="onDragStart(null, $event, 'data-target')"
          >
            <IconCollection class="data-item-icon" :width="20" :height="20" />
            <div class="data-item-info">
              <div class="data-item-name">Target</div>
              <div class="data-item-description">Select output folder</div>
            </div>
          </div>
        </div>

        <!-- Applications Section -->
        <h3>Applications</h3>
        <div v-if="isLoading" class="loading">Loading applications...</div>
        <div v-else class="applications-list">
          <div
            v-for="app in availableApplications"
            :key="app.uuid"
            class="application-item"
            draggable="true"
            @dragstart="onDragStart(app, $event, 'application')"
          >
            <IconAnalysis class="app-icon" :width="20" :height="20" />
            <div class="app-info">
              <div class="app-name">{{ app.name }}</div>
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
/* these are necessary styles for vue flow */
@import "@vue-flow/core/dist/style.css";

/* Handle styles — must be unscoped so VueFlow can render them */
.workflow-builder-flow {
  .vue-flow__handle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #6b7280;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #d1d5db;
    cursor: crosshair;
    transition: background-color 0.15s, box-shadow 0.15s;
    z-index: 10;

    /* Invisible expanded hit area so it's easy to grab */
    &::after {
      content: "";
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
      border-radius: 50%;
    }

    &:hover {
      background-color: #111;
      box-shadow: 0 0 0 2px #111;
    }

    &.vue-flow__handle-top {
      top: -5px;
    }

    &.vue-flow__handle-bottom {
      bottom: -5px;
    }

    /* Valid connection target highlight */
    &.valid {
      background-color: #16a34a;
      box-shadow: 0 0 0 2px #16a34a;
    }

    /* Active / connecting state */
    &.connecting {
      background-color: #111;
      box-shadow: 0 0 0 2px #111;
    }
  }
}

/* Popover content — rendered outside scoped tree */
.target-type-info {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .target-type-info-item {
    &:not(:last-child) {
      padding-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
    }
  }

  .target-type-info-id {
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 2px;
  }

  .target-type-info-desc {
    font-size: 12px;
    color: #6b7280;
    line-height: 1.4;
  }
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

.data-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.data-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid theme.$gray_3;
  //border-radius: 8px;
  cursor: grab;
  transition: all 0.2s;

  &:active {
    cursor: grabbing;
  }

  .data-item-icon {
    flex-shrink: 0;
  }

  .data-item-info {
    flex: 1;
    min-width: 0;
  }

  .data-item-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .data-item-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-top: 2px;
  }
}

.data-source-item {
  background-color: theme.$teal_tint;
  border-color: theme.$teal_1;

  &:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
  }
}

.data-target-item {
  background-color: theme.$yellow_tint;
  border-color: theme.$yellow_1;

  &:hover {
    border-color: #8b5cf6;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.15);
  }
}

.applications-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.application-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_3;
  cursor: grab;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$black;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &:active {
    cursor: grabbing;
  }

  .app-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .app-info {
    flex: 1;
    min-width: 0;
  }

  .app-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: theme.$black;
  }

  .app-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 4px;
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

.workflow-builder-flow {
  width: 100%;
  height: 100%;

  /* Hide default Vue Flow node styling only within workflow builder */
  :deep(.vue-flow__node) {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
}

.custom-node {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
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

  &.data-source-node {
    border-color:  theme.$teal_1;
    background:  theme.$teal_tint;
  }

  &.data-target-node {
    border-color: #8b5cf6;
    background: #faf5ff;

    .node-body {
      margin-top: 8px;
    }

    .target-type-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .target-type-select {
      flex: 1;
    }

    .target-type-info-icon {
      cursor: help;
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s;

      &:hover {
        opacity: 1;
      }
    }
  }

  .node-type-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;

    &.source-badge {
      background: #3b82f6;
      color: white;
    }

    &.target-badge {
      background: #8b5cf6;
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
