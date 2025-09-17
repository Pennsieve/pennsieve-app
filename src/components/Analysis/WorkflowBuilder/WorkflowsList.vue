<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  panelVisible: {
    type: Boolean,
    default: true,
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

const activeTab = ref("applications");
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

// Drag handlers for applications
const onDragStart = (event, application) => {
  event.dataTransfer.setData("application/json", application.id);
  event.dataTransfer.effectAllowed = "copy";
};

const togglePanelVisibility = () => {
  emit("toggle-panel-visibility");
};

const loadWorkflow = (workflow) => {
  emit("load-workflow", workflow);
};

const closeDetailsPanel = () => {
  emit("close-details");
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
</script>

<template>
  <div class="workflow-side-panel" :class="{ visible: panelVisible }">
    <!-- Panel Toggle Button -->
    <button
      class="panel-toggle"
      @click="togglePanelVisibility"
      :title="panelVisible ? 'Hide Panel' : 'Show Panel'"
    >
      {{ panelVisible ? "›" : "‹" }}
    </button>

    <div class="panel-content" v-show="panelVisible">
      <!-- Details Panel (shown when node is selected) -->
      <div v-if="showDetailsPanel && selectedNode.id" class="details-panel">
        <div class="details-header">
          <h3>Node Details</h3>
          <button class="close-details" @click="closeDetailsPanel">×</button>
        </div>

        <div class="details-content">
          <div class="detail-group">
            <label>Name:</label>
            <span>{{ selectedNode.data?.label }}</span>
          </div>

          <div class="detail-group">
            <label>Type:</label>
            <span class="type-badge" :class="selectedNode.data?.type">
              {{ getApplicationIcon(selectedNode.data?.type) }}
              {{ selectedNode.data?.type || "Unknown" }}
            </span>
          </div>

          <div class="detail-group">
            <label>Description:</label>
            <span>{{
              selectedNode.data?.application?.description ||
              "No description available"
            }}</span>
          </div>

          <div class="detail-group">
            <label>Position:</label>
            <span
              >x: {{ Math.round(selectedNode.position?.x) }}, y:
              {{ Math.round(selectedNode.position?.y) }}</span
            >
          </div>

          <div class="detail-actions">
            <bf-button class="secondary small">Configure</bf-button>
            <bf-button class="danger small">Remove</bf-button>
          </div>
        </div>
      </div>

      <!-- Main Panel Content -->
      <div v-else class="main-panel">
        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            class="tab-button"
            :class="{ active: activeTab === 'applications' }"
            @click="activeTab = 'applications'"
          >
            Applications
          </button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'workflows' }"
            @click="activeTab = 'workflows'"
          >
            Saved Workflows
          </button>
        </div>

        <!-- Search Bar -->
        <div class="search-section">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            :placeholder="
              activeTab === 'applications'
                ? 'Search applications...'
                : 'Search workflows...'
            "
          />
        </div>

        <!-- Applications Tab -->
        <div v-if="activeTab === 'applications'" class="applications-section">
          <div class="section-header">
            <h3>Available Applications</h3>
            <p>Drag applications to the canvas to build your workflow</p>
          </div>

          <div class="applications-list">
            <div
              v-for="app in filteredApplications"
              :key="app.id"
              class="application-item"
              :class="app.type"
              draggable="true"
              @dragstart="onDragStart($event, app)"
            >
              <div class="app-header">
                <div class="app-icon">{{ getApplicationIcon(app.type) }}</div>
                <div class="app-info">
                  <h4>{{ app.name }}</h4>
                  <span class="app-type">{{ app.type }}</span>
                </div>
                <div class="drag-indicator">⋮⋮</div>
              </div>
              <p class="app-description">{{ app.description }}</p>
            </div>
          </div>

          <div v-if="filteredApplications.length === 0" class="no-results">
            <p>No applications found matching "{{ searchQuery }}"</p>
          </div>
        </div>

        <!-- Workflows Tab -->
        <div v-if="activeTab === 'workflows'" class="workflows-section">
          <div class="section-header">
            <h3>Saved Workflows</h3>
            <p>Load a previously saved workflow</p>
          </div>

          <div class="workflows-list">
            <div
              v-for="workflow in filteredWorkflows"
              :key="workflow.id"
              class="workflow-item"
              @click="loadWorkflow(workflow)"
            >
              <div class="workflow-header">
                <h4>{{ workflow.name }}</h4>
                <span class="workflow-date">{{
                  formatDate(workflow.updatedAt)
                }}</span>
              </div>
              <div class="workflow-meta">
                <span class="workflow-stat"
                  >{{ workflow.nodes?.length || 0 }} nodes</span
                >
                <span class="workflow-stat"
                  >{{ workflow.edges?.length || 0 }} connections</span
                >
              </div>
            </div>
          </div>

          <div
            v-if="filteredWorkflows.length === 0 && searchQuery"
            class="no-results"
          >
            <p>No workflows found matching "{{ searchQuery }}"</p>
          </div>

          <div v-if="savedWorkflows.length === 0" class="no-workflows">
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <h4>No Saved Workflows</h4>
              <p>Build and save your first workflow to see it here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.workflow-side-panel {
  position: fixed;
  right: 0;
  top: 72px; // Adjust based on header height
  bottom: 0;
  width: 350px;
  background: white;
  border-left: 1px solid theme.$gray_3;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 100;

  &.visible {
    transform: translateX(0);
  }
}

.panel-toggle {
  position: absolute;
  left: -40px;
  top: 20px;
  width: 32px;
  height: 32px;
  background: white;
  border: 1px solid theme.$gray_3;
  border-right: none;
  border-radius: 4px 0 0 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: theme.$gray_4;

  &:hover {
    background: theme.$gray_1;
    color: theme.$app-primary-color;
  }
}

.panel-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.details-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid theme.$gray_3;

  h3 {
    margin: 0;
    color: theme.$purple_3;
  }
}

.close-details {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: theme.$gray_4;

  &:hover {
    color: theme.$red;
  }
}

.details-content {
  flex: 1;
  padding: 16px;
}

.detail-group {
  margin-bottom: 16px;

  label {
    display: block;
    font-weight: 600;
    margin-bottom: 4px;
    color: theme.$gray_5;
    font-size: 12px;
    text-transform: uppercase;
  }

  span {
    color: theme.$gray_6;
  }
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;

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

.detail-actions {
  margin-top: 24px;
  display: flex;
  gap: 8px;

  .bf-button {
    flex: 1;
  }
}

.main-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tab-navigation {
  display: flex;
  border-bottom: 1px solid theme.$gray_3;
}

.tab-button {
  flex: 1;
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-weight: 500;
  color: theme.$gray_4;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;

  &:hover {
    background: theme.$gray_1;
    color: theme.$gray_6;
  }

  &.active {
    color: theme.$app-primary-color;
    border-bottom-color: theme.$app-primary-color;
    background: theme.$gray_1;
  }
}

.search-section {
  padding: 16px;
  border-bottom: 1px solid theme.$gray_3;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: theme.$app-primary-color;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
  }
}

.section-header {
  padding: 16px 16px 12px 16px;

  h3 {
    margin: 0 0 4px 0;
    color: theme.$purple_3;
    font-size: 16px;
  }

  p {
    margin: 0;
    color: theme.$gray_4;
    font-size: 12px;
  }
}

.applications-section,
.workflows-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.applications-list,
.workflows-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px 16px;
}

.application-item {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: grab;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$app-primary-color;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  &:active {
    cursor: grabbing;
  }

  &.preprocessor {
    border-left: 4px solid #10b981;
  }

  &.processor {
    border-left: 4px solid #3b82f6;
  }

  &.postprocessor {
    border-left: 4px solid #8b5cf6;
  }
}

.app-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.app-icon {
  font-size: 16px;
}

.app-info {
  flex: 1;

  h4 {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_6;
  }
}

.app-type {
  font-size: 11px;
  color: theme.$gray_4;
  text-transform: capitalize;
}

.drag-indicator {
  color: theme.$gray_3;
  font-size: 12px;
  transform: rotate(90deg);
}

.app-description {
  margin: 0;
  font-size: 12px;
  color: theme.$gray_4;
  line-height: 1.4;
}

.workflow-item {
  background: white;
  border: 1px solid theme.$gray_3;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$app-primary-color;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;

  h4 {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_6;
  }
}

.workflow-date {
  font-size: 11px;
  color: theme.$gray_4;
}

.workflow-meta {
  display: flex;
  gap: 12px;
}

.workflow-stat {
  font-size: 11px;
  color: theme.$gray_4;
  background: theme.$gray_1;
  padding: 2px 6px;
  border-radius: 10px;
}

.no-results {
  padding: 32px 16px;
  text-align: center;
  color: theme.$gray_4;

  p {
    margin: 0;
    font-style: italic;
  }
}

.no-workflows {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.empty-state {
  text-align: center;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  h4 {
    margin: 0 0 8px 0;
    color: theme.$gray_5;
  }

  p {
    margin: 0;
    color: theme.$gray_4;
    font-size: 14px;
    line-height: 1.4;
  }
}

/* Scrollbar styling */
.applications-list::-webkit-scrollbar,
.workflows-list::-webkit-scrollbar {
  width: 6px;
}

.applications-list::-webkit-scrollbar-track,
.workflows-list::-webkit-scrollbar-track {
  background: theme.$gray_1;
}

.applications-list::-webkit-scrollbar-thumb,
.workflows-list::-webkit-scrollbar-thumb {
  background: theme.$gray_3;
  border-radius: 3px;

  &:hover {
    background: theme.$gray_4;
  }
}
</style>
