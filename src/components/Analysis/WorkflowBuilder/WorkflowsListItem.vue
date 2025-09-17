<template>
  <div
    class="workflow-list-item"
    :class="{ active: isActive }"
    @click="selectWorkflow"
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
            {{ nodeCount }} nodes
          </span>
          <span class="stat-item">
            <span class="stat-icon">🔗</span>
            {{ connectionCount }} connections
          </span>
        </div>

        <div class="workflow-dates">
          <div class="date-info">
            <span class="date-label">Modified:</span>
            <span class="date-value">{{ formatDate(workflow.updatedAt) }}</span>
          </div>
          <div class="date-info">
            <span class="date-label">Created:</span>
            <span class="date-value">{{ formatDate(workflow.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div v-if="workflow.description" class="workflow-description">
        {{ workflow.description }}
      </div>

      <div class="workflow-preview">
        <div class="preview-header">
          <span class="preview-label">Applications:</span>
        </div>
        <div class="applications-preview">
          <span
            v-for="(appType, index) in applicationTypes"
            :key="index"
            class="app-type-badge"
            :class="appType.toLowerCase()"
          >
            {{ getApplicationIcon(appType) }} {{ appType }}
          </span>
          <span v-if="applicationTypes.length === 0" class="no-apps">
            No applications
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  workflow: {
    type: Object,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "select-workflow",
  "delete-workflow",
  "duplicate-workflow",
]);

const nodeCount = computed(() => {
  return props.workflow.nodes?.length || 0;
});

const connectionCount = computed(() => {
  return props.workflow.edges?.length || 0;
});

const applicationTypes = computed(() => {
  if (!props.workflow.nodes) return [];

  const types = props.workflow.nodes
    .map((node) => node.data?.type)
    .filter((type) => type)
    .filter((type, index, arr) => arr.indexOf(type) === index); // Remove duplicates

  return types;
});

const selectWorkflow = () => {
  emit("select-workflow", props.workflow);
};

const formatDate = (dateString) => {
  if (!dateString) return "Unknown";

  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
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

<style lang="scss" scoped>
@use "../../../styles/theme";

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
</style>
