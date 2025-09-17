<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  panelVisible: {
    type: Boolean,
    default: false,
  },
  showDetailsPanel: {
    type: Boolean,
    default: false,
  },
  selectedNode: {
    type: Object,
    default: () => ({}),
  },
  applicationTypes: {
    type: Array,
    default: () => [],
  },
  savedWorkflows: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "toggle-panel-visibility",
  "load-workflow",
  "close-details",
]);

const workflowsListVisible = ref(false);
const workflowsListSelected = ref(true);
const processorInfoSelected = ref(false);
const mouseHoverInfo = ref(false);
const mouseHoverList = ref(false);

const searchQuery = ref("");

const filteredApplications = computed(() => {
  if (!searchQuery.value) return props.applicationTypes;

  return props.applicationTypes.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

const filteredWorkflows = computed(() => {
  if (!searchQuery.value) return props.savedWorkflows;

  return props.savedWorkflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

// Toggle functions matching reference design
function mouseLeave(event) {
  const evtId = event.currentTarget.id;
  if (!props.panelVisible) {
    mouseHoverInfo.value = false;
    mouseHoverList.value = false;
    return;
  }

  switch (evtId) {
    case "workflowsList":
      mouseHoverList.value = false;
      break;
    case "processorInfo":
      mouseHoverInfo.value = false;
      break;
  }
}

function mouseOver(event) {
  const evtId = event.currentTarget.id;

  if (!props.panelVisible) {
    mouseHoverInfo.value = false;
    mouseHoverList.value = false;
    return;
  }

  switch (evtId) {
    case "workflowsList":
      if (workflowsListSelected.value) {
        mouseHoverList.value = true;
      }
      break;
    case "processorInfo":
      if (processorInfoSelected.value) {
        mouseHoverInfo.value = true;
      }
      break;
  }
}

function toggleModelsList(event) {
  const evtId = event.currentTarget.id;

  switch (evtId) {
    case "workflowsList":
      if (workflowsListSelected.value) {
        workflowsListVisible.value = false;
        workflowsListSelected.value = false;
        emit("toggle-panel-visibility");
      } else if (processorInfoSelected.value) {
        workflowsListSelected.value = true;
        processorInfoSelected.value = false;
        mouseHoverList.value = true;
      } else {
        workflowsListSelected.value = true;
        mouseHoverList.value = true;
        emit("toggle-panel-visibility");
      }
      break;
    case "processorInfo":
      if (processorInfoSelected.value) {
        workflowsListVisible.value = false;
        processorInfoSelected.value = false;
        emit("toggle-panel-visibility");
      } else if (workflowsListSelected.value) {
        processorInfoSelected.value = true;
        workflowsListSelected.value = false;
        mouseHoverInfo.value = true;
      } else {
        processorInfoSelected.value = true;
        mouseHoverInfo.value = true;
        emit("toggle-panel-visibility");
      }
      break;
  }
}

// Drag handlers for applications
const onDragStart = (event, application) => {
  event.dataTransfer.setData("application/json", application.id);
  event.dataTransfer.effectAllowed = "copy";
};

const loadWorkflow = (workflow) => {
  emit("load-workflow", workflow);
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getApplicationIcon = (type) => {
  const iconMap = {
    preprocessor: "⚙️",
    processor: "🔄",
    postprocessor: "✅",
  };
  return iconMap[type] || "📦";
};

const isActive = (workflow) => {
  return !workflow.completedAt;
};
</script>

<template>
  <div class="workflows-list-wrap" :class="{ visible: panelVisible }">
    <button
      id="processorInfo"
      :class="{
        selected: processorInfoSelected,
        'btn-toggle': true,
        second: true,
      }"
      @click="toggleModelsList"
      @mouseenter="mouseOver"
      @mouseleave="mouseLeave"
    >
      <!-- Info Icon placeholder - replace with your IconInfo component -->
      <svg
        v-if="!mouseHoverInfo"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
        />
      </svg>
      <!-- Arrow Icon placeholder - replace with your IconArrowRight component -->
      <svg
        v-else
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
      </svg>
    </button>
    <button
      id="workflowsList"
      :class="{
        selected: workflowsListSelected,
        'btn-toggle': true,
        first: true,
      }"
      @click="toggleModelsList"
      @mouseenter="mouseOver"
      @mouseleave="mouseLeave"
    >
      <!-- Document Icon placeholder - replace with your IconDocument component -->
      <svg
        v-if="!mouseHoverList"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path
          d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
        />
      </svg>
      <!-- Arrow Icon placeholder - replace with your IconArrowRight component -->
      <svg
        v-else
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
      </svg>
    </button>
    <div ref="workflowsList" class="workflows-list-scroll">
      <!-- Workflows List -->
      <div v-show="workflowsListSelected" class="workflows-list scrolling-list">
        <h2 class="heading">Workflows</h2>
        <template v-if="savedWorkflows.length > 0">
          <div class="workflows-list-loading-wrap">
            <div class="workflows-list-wrap-scroll">
              <div class="workflows-list-wrap">
                <div
                  v-for="(workflow, index) in filteredWorkflows"
                  :key="index"
                  class="workflow-list-item"
                  :class="{ active: isActive(workflow) }"
                  @click="loadWorkflow(workflow)"
                >
                  <div class="workflow-main-info">
                    <div class="workflow-header">
                      <h4 class="workflow-name">{{ workflow.name }}</h4>
                      <div class="workflow-actions" @click.stop>
                        <button
                          class="action-btn"
                          @click="$emit('duplicate-workflow', workflow)"
                          title="Duplicate workflow"
                        >
                          📋
                        </button>
                        <button
                          class="action-btn danger"
                          @click="$emit('delete-workflow', workflow)"
                          title="Delete workflow"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div class="workflow-meta">
                      <div class="workflow-stats">
                        <span class="stat-item">
                          <span class="stat-icon">📦</span>
                          {{ workflow.nodes?.length || 0 }} nodes
                        </span>
                        <span class="stat-item">
                          <span class="stat-icon">🔗</span>
                          {{ workflow.edges?.length || 0 }} connections
                        </span>
                      </div>

                      <div class="workflow-dates">
                        <div class="date-info">
                          <span class="date-label">Modified:</span>
                          <span class="date-value">{{
                            formatDate(workflow.updatedAt)
                          }}</span>
                        </div>
                        <div class="date-info">
                          <span class="date-label">Created:</span>
                          <span class="date-value">{{
                            formatDate(workflow.createdAt)
                          }}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="workflow.description"
                      class="workflow-description"
                    >
                      {{ workflow.description }}
                    </div>

                    <div class="workflow-preview">
                      <div class="preview-header">
                        <span class="preview-label">Applications:</span>
                      </div>
                      <div class="applications-preview">
                        <span
                          v-for="(appType, appIndex) in workflow.nodes
                            ?.map((n) => n.data?.type)
                            .filter(Boolean)"
                          :key="appIndex"
                          class="app-type-badge"
                          :class="appType.toLowerCase()"
                        >
                          {{ getApplicationIcon(appType) }} {{ appType }}
                        </span>
                        <span v-if="!workflow.nodes?.length" class="no-apps">
                          No applications
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-if="!savedWorkflows.length">
          <div class="no-workflows">There are no Workflows at this time.</div>
        </template>
      </div>

      <!-- Processor/Node Details -->
      <div v-show="processorInfoSelected" class="model-details">
        <div v-if="selectedNode.id" class="processor-details">
          <bf-button @click="handleLogsClick">View Logs</bf-button>
          <div class="processor-item">
            <span class="label">Name: </span>
            <span class="value">{{ selectedNode.data?.label }}</span>
          </div>
          <div class="processor-item">
            <span class="label">ID: </span>
            <span class="value">{{ selectedNode.id }}</span>
          </div>
          <div class="processor-item">
            <span class="label">Description: </span>
            <span class="value">{{
              selectedNode.data?.application?.description ||
              "No description available"
            }}</span>
          </div>
          <div class="processor-item">
            <span class="label">Type: </span>
            <span class="value">{{
              selectedNode.data?.type || "Unknown"
            }}</span>
          </div>
          <div class="processor-item">
            <span class="label">Position: </span>
            <span class="value"
              >x: {{ Math.round(selectedNode.position?.x || 0) }}, y:
              {{ Math.round(selectedNode.position?.y || 0) }}</span
            >
          </div>
        </div>
        <div v-else>
          <div class="img-container">
            <img
              src="/src/assets/images/illustrations/illo-empty-file-types.svg"
              class="empty-image"
              alt="No processor selected"
            />
          </div>
          <div class="img-container">
            <p class="message">No processor selected</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.workflows-list-wrap {
  border-top: 1px solid theme.$gray_2;
  border-left: 1px solid theme.$gray_2;
  border-bottom: 1px solid theme.$gray_2;
  border-radius: 4px 0 0 4px;
  height: calc(100% - 94px);
  position: absolute;
  right: 0;
  top: 0;
  transform: translate3d(100%, 72px, 0);
  transition: transform 0.3s ease-out;
  width: 500px;
  will-change: transform;
  z-index: 3;

  &.visible {
    transform: translate3d(0, 72px, 0);
  }
}

.workflows-list-scroll {
  height: 100%;
  overflow: hidden;
  background: theme.$gray_1;
  border-radius: 4px 0px 0 4px;
}

.btn-toggle {
  align-items: center;
  border: 1px solid theme.$gray_2;
  border-radius: 4px 0 0 4px;
  display: flex;
  height: 48px;
  left: -35px;
  justify-content: center;
  position: absolute;
  top: 8px;
  width: 35px;
  color: theme.$purple_1;
  fill: theme.$purple_1;
  background: theme.$gray_1;

  &.first {
    top: 33px;
  }

  &.second {
    top: 85px;
  }

  &.selected {
    background: linear-gradient(to left, theme.$gray_1, theme.$white);

    &:after {
      background: theme.$gray_1;
      content: "";
      height: 100%;
      pointer-events: none;
      position: absolute;
      top: 0;
      right: -5px;
      width: 5px;
    }
  }
}

/* Workflows List Styles */
.workflows-list.scrolling-list {
  box-sizing: border-box;
  height: 100%;
  display: flex;
  flex-direction: column;

  .workflows-list-wrap-scroll {
    box-sizing: border-box;
    flex: 1;
    overflow-y: auto;
    padding: 0 0 16px 8px;
  }

  .workflows-list-loading-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

.workflows-list-wrap {
  background: theme.$gray_1;
  padding: 16px;
}

.heading {
  margin: 15px;
  color: theme.$purple_3;
}

.no-workflows {
  padding: 16px;
  color: theme.$gray_3;
  text-align: center;
}

/* Workflow List Item Styles */
.workflow-list-item {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$app-primary-color;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  &.active {
    border-color: theme.$app-primary-color;
    background: rgba(99, 102, 241, 0.02);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }
}

.workflow-main-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.workflow-name {
  margin: 0;
  font-size: 16px;
  color: theme.$gray_6;
  font-weight: 600;
  flex: 1;
  margin-right: 12px;
}

.workflow-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;

  .workflow-list-item:hover & {
    opacity: 1;
  }
}

.action-btn {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s ease;

  &:hover {
    background: theme.$gray_2;
  }

  &.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }
}

.workflow-meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.workflow-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: theme.$gray_4;

  .stat-icon {
    font-size: 10px;
  }
}

.workflow-dates {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: right;
}

.date-info {
  font-size: 11px;

  .date-label {
    color: theme.$gray_4;
    margin-right: 4px;
  }

  .date-value {
    color: theme.$gray_5;
    font-weight: 500;
  }
}

.workflow-description {
  font-size: 13px;
  color: theme.$gray_4;
  line-height: 1.4;
  background: theme.$gray_1;
  padding: 8px;
  border-radius: 4px;
  font-style: italic;
}

.workflow-preview {
  border-top: 1px solid theme.$gray_2;
  padding-top: 8px;
}

.preview-header {
  margin-bottom: 8px;
}

.preview-label {
  font-size: 11px;
  color: theme.$gray_4;
  text-transform: uppercase;
  font-weight: 600;
}

.applications-preview {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.app-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  text-transform: capitalize;

  &.preprocessor {
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
  }

  &.processor {
    background: rgba(59, 130, 246, 0.1);
    color: #2563eb;
  }

  &.postprocessor {
    background: rgba(139, 92, 246, 0.1);
    color: #7c3aed;
  }
}

.no-apps {
  font-size: 11px;
  color: theme.$gray_3;
  font-style: italic;
}

/* Model Details Styles */
.model-details {
  margin: 30px;
}

.processor-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.label {
  font-weight: bold;
  color: theme.$purple_3;
}

.value {
  color: theme.$black;
  font-weight: normal;
}

.processor-item {
  font-weight: bold;
  color: theme.$purple_3;
}

.img-container {
  text-align: center;
  padding: 20px;
}

.empty-image {
  max-width: 150px;
  opacity: 0.5;
}

.message {
  color: theme.$gray_4;
  font-style: italic;
}
</style>
