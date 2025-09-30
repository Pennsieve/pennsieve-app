<template>
  <bf-stage element-loading-background="transparent">
    <bf-empty-page-state v-if="showEmptyState" class="empty">
      <img
        src="../../../assets/images/illustrations/illo-patient-data.svg"
        height="340"
        width="347"
        alt="Teams illustration"
      />
      <div class="copy">
        <h2>No workflows yet</h2>
        <p>Create your first workflow to get started</p>
      </div>
    </bf-empty-page-state>

    <div v-else class="workflows-container">
      <div class="workflows-list">
        <div
          v-for="workflow in workflows"
          :key="workflow.id || workflow.uuid"
          class="workflow-card"
          @click="openWorkflow(workflow)"
        >
          <div class="card-header">
            <h3 class="workflow-name">{{ workflow.name }}</h3>
          </div>
          <div class="card-body">
            <p class="workflow-subtitle">
              {{ workflow.description || workflow.name }}
            </p>
            <div
              v-if="workflow.processors && workflow.processors.length > 0"
              class="processor-info"
            >
              <span class="info-label">Processors:</span>
              {{ workflow.processors.length }}
            </div>
            <div v-if="workflow.createdAt" class="workflow-date">
              <span class="info-label">Created:</span>
              {{ formatDate(workflow.createdAt) }}
            </div>
            <div v-if="workflow.updatedAt" class="workflow-date">
              <span class="info-label">Updated:</span>
              {{ formatDate(workflow.updatedAt) }}
            </div>
          </div>
          <div class="card-footer">
            <button class="status-button" :class="getStatusClass(workflow)">
              {{ getButtonText(workflow) }}
            </button>
            <span class="status-text">
              {{ getStatusText(workflow) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <template #actions>
      <bf-button @click="openCreateWorkflowDialog"> Create Workflow </bf-button>
    </template>

    <create-workflow-dialog
      v-model:dialog-visible="createWorkflowDialogVisible"
      @close="onCloseCreateWorkflowDialog"
    />
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";

import BfButton from "../../shared/bf-button/BfButton.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import Request from "../../../mixins/request/index.js";
import CreateWorkflowDialog from "./CreateWorkflowDialog.vue";
import { pathOr } from "ramda";

export default {
  name: "WorkflowBuilder",

  components: {
    BfEmptyPageState,
    BfButton,
    CreateWorkflowDialog,
  },

  mixins: [Request],

  data() {
    return {
      createWorkflowDialogVisible: false,
    };
  },

  async mounted() {
    try {
      await this.fetchWorkflows();
    } catch (err) {
      console.error("Error fetching workflows:", err);
    }
  },

  computed: {
    ...mapGetters(["activeOrganization", "userToken", "config", "hasFeature"]),
    ...mapState("analysisModule", ["applications", "workflows"]),

    orgName() {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },

    showEmptyState() {
      return !this.workflows || this.workflows.length === 0;
    },
  },

  beforeRouteEnter(to, from, next) {
    next((vm) => {
      if (vm.hasFeature("sandbox_org_feature")) {
        vm.$router.push({ name: "create-org" });
      }
    });
  },

  methods: {
    ...mapActions("analysisModule", ["fetchApplications", "fetchWorkflows"]),

    openCreateWorkflowDialog() {
      this.createWorkflowDialogVisible = true;
    },

    onCloseCreateWorkflowDialog() {
      this.createWorkflowDialogVisible = false;
      // Refresh workflows list after creating a new one
      this.fetchWorkflows();
    },

    openWorkflow(workflow) {
      this.$router.push({
        name: "workflow-detail",
        params: { id: workflow.id || workflow.uuid },
      });
    },

    formatDate(date) {
      if (!date) return "";
      const d = new Date(date);
      const now = new Date();
      const diff = now - d;
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return "today";
      if (days === 1) return "yesterday";
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

      return d.toLocaleDateString();
    },

    getStatusClass(workflow) {
      if (workflow.isActive === true || workflow.status === "active") {
        return "active";
      }
      if (
        workflow.status === "draft" ||
        !workflow.processors ||
        workflow.processors.length === 0
      ) {
        return "draft";
      }
      return "inactive";
    },

    getButtonText(workflow) {
      if (workflow.isActive === true || workflow.status === "active") {
        return "Update";
      }
      if (
        workflow.status === "draft" ||
        !workflow.processors ||
        workflow.processors.length === 0
      ) {
        return "Draft";
      }
      return "Deploy";
    },

    getStatusText(workflow) {
      if (workflow.isActive === true || workflow.status === "active") {
        return "Application has been deployed";
      }
      if (
        workflow.status === "draft" ||
        !workflow.processors ||
        workflow.processors.length === 0
      ) {
        return "Draft - not deployed";
      }
      return "Ready to deploy";
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/element/dialog";

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.copy {
  margin-top: 24px;

  h2 {
    font-size: 20px;
    font-weight: 600;
    line-height: 24px;
    text-align: center;
    margin-bottom: 8px;
  }

  p {
    color: #71747c;
    font-size: 14px;
    line-height: 20px;
    text-align: center;
  }
}

.workflows-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.workflows-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.workflow-card {
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card-header {
  background: #e5e7eb;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.workflow-name {
  font-size: 18px;
  font-weight: 400;
  color: #1f2937;
  margin: 0;
}

.card-body {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-subtitle {
  font-size: 16px;
  color: #4b5563;
  margin: 0;
  line-height: 1.5;
}

.processor-info,
.workflow-date {
  font-size: 14px;
  color: #6b7280;
}

.info-label {
  font-weight: 500;
  color: #374151;
}

.card-footer {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-top: 1px solid #f3f4f6;
}

.status-button {
  background: #1e40af;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 24px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &.draft {
    background: #6b7280;
  }

  &.inactive {
    background: #059669;
  }
}

.status-text {
  font-size: 16px;
  color: #6b7280;
  flex: 1;
}

// Responsive Design
@media (max-width: 1200px) {
  .workflows-list {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .workflows-list {
    grid-template-columns: 1fr;
  }
}

.workflow-date,
.workflow-steps {
  display: flex;
  align-items: center;
}
</style>
