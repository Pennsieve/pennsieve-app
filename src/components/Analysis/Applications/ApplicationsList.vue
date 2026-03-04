<script setup>
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { pathOr, propOr } from "ramda";

import BfButton from "../../shared/bf-button/BfButton.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import CreateApplicationDialog from "./CreateApplicationDialog.vue";
import EventBus from "../../../utils/event-bus";

import {
  isEnabledForAllDevOrgs,
  isEnabledForSpecificOrgs,
  isEnabledForTestOrgs,
} from "../../../utils/feature-flags.js";

/*
  Local State
*/
const selectedApplication = ref(null);
const accordionActiveNames = ref(["applications"]);
const searchQuery = ref("");
const sortField = ref("name");
const readmeHtml = ref("");
const readmeLoading = ref(false);
const readmeError = ref("");
const addApplicationDialogVisible = ref(false);
const editableParams = ref([]);
const unsavedChangesDialogVisible = ref(false);
const pendingApplication = ref(null);

/*
  Store computed
*/
const store = useStore();
const applications = computed(
  () => store.state.analysisModule.applications || []
);
const activeOrganization = computed(() => store.state.activeOrganization);
const config = computed(() => store.state.config);

const isFeatureFlagEnabled = computed(() => {
  const orgId = pathOr("", ["organization", "id"], activeOrganization.value);
  return (
    isEnabledForTestOrgs(orgId) ||
    isEnabledForSpecificOrgs(orgId) ||
    isEnabledForAllDevOrgs(config.value.apiUrl)
  );
});

const hasAdminRights = computed(() => {
  if (activeOrganization.value) {
    const isAdmin = propOr(false, "isAdmin", activeOrganization.value);
    const isOwner = propOr(false, "isOwner", activeOrganization.value);
    return isAdmin || isOwner;
  }
  return false;
});

/*
  Filtered & sorted applications
*/
const filteredApplications = computed(() => {
  let list = applications.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (app) =>
        (app.name || "").toLowerCase().includes(q) ||
        (app.description || "").toLowerCase().includes(q)
    );
  }

  const field = sortField.value;
  return [...list].sort((a, b) => {
    const aVal = (a[field] || "").toLowerCase();
    const bVal = (b[field] || "").toLowerCase();
    return aVal.localeCompare(bVal);
  });
});

/*
  GitHub README
*/
const parseGitHubRepo = (sourceUrl) => {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/\s.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
};

const githubRepoUrl = computed(() => {
  if (!selectedApplication.value?.source?.url) return null;
  const info = parseGitHubRepo(selectedApplication.value.source.url);
  if (!info) return null;
  return `https://github.com/${info.owner}/${info.repo}`;
});

const fetchReadme = async (app) => {
  readmeHtml.value = "";
  readmeError.value = "";

  const info = parseGitHubRepo(app?.source?.url);
  if (!info) {
    readmeError.value = "No GitHub repository URL available";
    return;
  }

  readmeLoading.value = true;
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/readme`,
      { headers: { Accept: "application/vnd.github.v3.json" } }
    );

    if (!resp.ok) {
      if (resp.status === 404) {
        readmeError.value = "No README found in this repository";
      } else if (resp.status === 403) {
        readmeError.value = "Unable to access README (rate limit or private repository)";
      } else {
        readmeError.value = `Failed to fetch README (${resp.status})`;
      }
      return;
    }

    const data = await resp.json();
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(data.content.replace(/\n/g, "")), (c) =>
        c.charCodeAt(0)
      )
    );
    const html = await marked(decoded);
    readmeHtml.value = DOMPurify.sanitize(html);
  } catch (err) {
    readmeError.value = "Failed to load README";
  } finally {
    readmeLoading.value = false;
  }
};

/*
  Selection
*/
const doSelectApplication = (app) => {
  selectedApplication.value = app;
  initEditableParams(app);
  if (!accordionActiveNames.value.includes("information")) {
    accordionActiveNames.value = ["information", ...accordionActiveNames.value];
  }
  fetchReadme(app);
};

const selectApplication = (app) => {
  if (hasUnsavedChanges.value) {
    pendingApplication.value = app;
    unsavedChangesDialogVisible.value = true;
    return;
  }
  doSelectApplication(app);
};

/*
  Status helpers
*/
const statusDotClass = (status) => {
  if (!status) return "dot-gray";
  if (["deployed", "active"].includes(status)) return "dot-green";
  if (["registering", "deploying", "re-deploying", "pending"].includes(status))
    return "dot-blue";
  if (status.startsWith("error")) return "dot-red";
  return "dot-gray";
};

const statusLabel = (status) => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

/*
  Dialog handlers
*/
const openCreateApplicationDialog = () => {
  addApplicationDialogVisible.value = true;
};

const onCloseAddDialog = () => {
  addApplicationDialogVisible.value = false;
};

const onAddApplicationConfirm = (application) => {
  store.dispatch("analysisModule/createApplication", application);
};

/*
  Inline parameter editing
*/
const formatParamsForUI = (app) => {
  if (app?.params) {
    return Object.entries(app.params).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  }
  return [];
};

const formatParamsForPayload = (params) => {
  if (params.length === 0) return null;
  return Object.fromEntries(params.map((p) => [p.key, p.value]));
};

const hasUnsavedChanges = computed(() => {
  if (!selectedApplication.value) return false;
  const original = formatParamsForUI(selectedApplication.value);
  const current = editableParams.value;
  if (original.length !== current.length) return true;
  return current.some(
    (p, i) => p.key !== original[i]?.key || p.value !== original[i]?.value
  );
});

const initEditableParams = (app) => {
  editableParams.value = formatParamsForUI(app);
};

const addParam = () => {
  editableParams.value.push({ key: "", value: "" });
};

const removeParam = (index) => {
  editableParams.value.splice(index, 1);
};

const saveParams = async () => {
  const payload = {
    ...selectedApplication.value,
    params: formatParamsForPayload(editableParams.value),
  };
  try {
    await store.dispatch("analysisModule/editApplication", payload);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Your request has been successfully submitted.",
      },
    });
    initEditableParams(selectedApplication.value);
  } catch (error) {
    console.error(error);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "There was a problem submitting your request.",
      },
    });
  }
};

const cancelParamEdits = () => {
  initEditableParams(selectedApplication.value);
};

const discardAndSwitch = () => {
  unsavedChangesDialogVisible.value = false;
  const app = pendingApplication.value;
  pendingApplication.value = null;
  doSelectApplication(app);
};

const deployApplication = async (app) => {
  try {
    const formattedUpdateDataset = {
      uuid: app.uuid,
      account: {
        uuid: app.account.uuid,
        accountId: app.account.accountId,
        accountType: app.account.accountType,
      },
      destination: {
        type: app.destination.type,
        url: app.destination.url,
      },
      source: {
        type: app.source.type,
        url: app.source.url,
      },
    };
    await store.dispatch("analysisModule/updateApplication", formattedUpdateDataset);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Your request has been successfully submitted.",
      },
    });
  } catch (error) {
    console.error(error);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "There was a problem submitting your request.",
      },
    });
  }
};

const deleteApplicationHandler = async (app) => {
  try {
    await store.dispatch("analysisModule/deleteApplication", app);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Your request was successful. It may take some time to complete.",
      },
    });
  } catch (error) {
    console.error(error);
    EventBus.$emit("toast", {
      detail: {
        type: "error",
        msg: "Something went wrong, please try again later.",
      },
    });
  }
};

/*
  Watch: clear selection if selected app is removed
*/
watch(applications, (newApps) => {
  if (
    selectedApplication.value &&
    !newApps.find((a) => a.uuid === selectedApplication.value.uuid)
  ) {
    selectedApplication.value = null;
    editableParams.value = [];
    readmeHtml.value = "";
    readmeError.value = "";
  }
});

/*
  Route navigation guard — warn on unsaved param changes
*/
const router = useRouter();
const removeGuard = router.beforeEach((to, from, next) => {
  if (hasUnsavedChanges.value) {
    const leave = window.confirm(
      "You have unsaved parameter changes. Discard and leave?"
    );
    if (!leave) return next(false);
  }
  next();
});
onBeforeUnmount(() => removeGuard());
</script>

<template>
  <div class="applications-page">
    <!-- Header -->
    <div class="builder-header">
      <span class="header-title">Applications</span>
      <div class="header-actions">
        <template v-if="hasUnsavedChanges">
          <bf-button class="secondary" @click="cancelParamEdits">Cancel</bf-button>
          <bf-button @click="saveParams">Update</bf-button>
        </template>
        <template v-else>
          <bf-button
            :disabled="!isFeatureFlagEnabled || !hasAdminRights"
            @click="openCreateApplicationDialog"
          >
            + New Application
          </bf-button>
        </template>
      </div>
    </div>

    <div class="builder-content">
      <!-- Left: Main Panel -->
      <div class="main-panel">
        <!-- Metrics Placeholder -->
        <div class="metrics-section">
          <div class="metrics-placeholder">
            <IconAnalysis :width="32" :height="32" color="#9ca3af" />
            <span>Application metrics will appear here</span>
          </div>
        </div>

        <!-- README Section -->
        <div class="readme-section">
          <template v-if="!selectedApplication">
            <div class="readme-empty">
              Select an application to view its README
            </div>
          </template>
          <template v-else>
            <div class="readme-header">
              <span class="readme-title">README</span>
              <a
                v-if="githubRepoUrl"
                :href="githubRepoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="readme-github-link"
              >
                View on GitHub
              </a>
            </div>
            <div v-if="readmeLoading" class="readme-loading">
              Loading README...
            </div>
            <div v-else-if="readmeError" class="readme-error">
              {{ readmeError }}
            </div>
            <div
              v-else-if="readmeHtml"
              class="readme-content"
              v-html="readmeHtml"
            />
          </template>
        </div>
      </div>

      <!-- Right: Sidebar -->
      <div class="applications-sidebar">
        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <!-- Information Section -->
          <el-collapse-item title="Information" name="information">
            <template v-if="selectedApplication">
              <div class="info-card">
                <div class="info-row">
                  <span class="info-label">Name</span>
                  <span class="info-value">{{ selectedApplication.name }}</span>
                </div>
                <div v-if="selectedApplication.description" class="info-row">
                  <span class="info-label">Description</span>
                  <span class="info-value">{{ selectedApplication.description }}</span>
                </div>
<!--                <div class="info-row">-->
<!--                  <span class="info-label">Type</span>-->
<!--                  <span class="info-value">-->
<!--                    <span class="app-type-badge">{{ selectedApplication.applicationType || 'N/A' }}</span>-->
<!--                  </span>-->
<!--                </div>-->
                <div class="info-row">
                  <span class="info-label">Status</span>
                  <span class="info-value">
                    <span
                      class="status-dot"
                      :class="statusDotClass(selectedApplication.status)"
                    />
                    {{ statusLabel(selectedApplication.status) }}
                  </span>
                </div>
              </div>

              <!-- Resources -->
              <template v-if="selectedApplication.resources">
                <h4 class="sidebar-section-title">Default Resources</h4>
                <div class="info-card">
                  <div class="info-row">
                    <span class="info-label">CPU</span>
                    <span class="info-value">{{ selectedApplication.resources.cpu || 'N/A' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Memory</span>
                    <span class="info-value">{{ selectedApplication.resources.memory || 'N/A' }}</span>
                  </div>
                </div>
              </template>

              <!-- Source -->
              <template v-if="selectedApplication.source">
                <h4 class="sidebar-section-title">Source</h4>
                <div class="info-card">
                  <div v-if="selectedApplication.source.url" class="info-row">
                    <span class="info-label">Repository</span>
                    <span class="info-value info-url">{{ selectedApplication.source.url }}</span>
                  </div>
                  <div v-if="selectedApplication.source.branch" class="info-row">
                    <span class="info-label">Branch</span>
                    <span class="info-value">{{ selectedApplication.source.branch }}</span>
                  </div>
                  <div v-if="selectedApplication.source.path" class="info-row">
                    <span class="info-label">Path</span>
                    <span class="info-value info-url">{{ selectedApplication.source.path }}</span>
                  </div>
                </div>
              </template>

              <!-- Parameters -->
              <template v-if="hasAdminRights">
                <h4 class="sidebar-section-title">Parameters</h4>
                <div class="config-field">
                  <div
                    v-for="(param, index) in editableParams"
                    :key="index"
                    class="param-row"
                  >
                    <el-input
                      v-model="param.key"
                      size="small"
                      placeholder="Key"
                      class="param-key"
                    />
                    <el-input
                      v-model="param.value"
                      size="small"
                      placeholder="Value"
                      class="param-value"
                    />
                    <button class="param-remove-btn" @click="removeParam(index)">&times;</button>
                  </div>
                  <button class="text-link-btn" @click="addParam">+ Add parameter</button>
                </div>
              </template>
              <template v-else-if="selectedApplication.params && Object.keys(selectedApplication.params).length > 0">
                <h4 class="sidebar-section-title">Parameters</h4>
                <div class="info-card">
                  <div
                    v-for="(value, key) in selectedApplication.params"
                    :key="key"
                    class="info-row"
                  >
                    <span class="info-label">{{ key }}</span>
                    <span class="info-value">{{ value }}</span>
                  </div>
                </div>
              </template>

              <!-- Admin Actions -->
              <template v-if="hasAdminRights">
                <div class="info-actions">
                  <button
                    class="text-link-btn"
                    @click="deployApplication(selectedApplication)"
                  >
                    Deploy / Update
                  </button>
                  <button
                    class="text-link-btn archive-btn"
                    @click="deleteApplicationHandler(selectedApplication)"
                  >
                    Delete application
                  </button>
                </div>
              </template>
            </template>

            <div v-else class="info-empty">
              Select an application to see details
            </div>
          </el-collapse-item>

          <!-- Applications Section -->
          <el-collapse-item title="Applications" name="applications">
            <el-input
              v-model="searchQuery"
              placeholder="Search applications..."
              size="small"
              clearable
              style="margin-bottom: 10px"
            />

            <div class="filter-bar">
              <button
                class="filter-btn"
                :class="{ active: sortField === 'name' }"
                @click="sortField = 'name'"
              >
                Name
              </button>
              <button
                class="filter-btn"
                :class="{ active: sortField === 'applicationType' }"
                @click="sortField = 'applicationType'"
              >
                Type
              </button>
              <button
                class="filter-btn"
                :class="{ active: sortField === 'status' }"
                @click="sortField = 'status'"
              >
                Status
              </button>
            </div>

            <div v-if="applications.length === 0" class="workflow-list-empty">
              No applications yet
            </div>
            <div
              v-else-if="filteredApplications.length === 0"
              class="workflow-list-empty"
            >
              No applications match your search
            </div>
            <div v-else class="workflow-list">
              <div
                v-for="app in filteredApplications"
                :key="app.uuid"
                class="workflow-list-item"
                :class="{ selected: selectedApplication?.uuid === app.uuid }"
                @click="selectApplication(app)"
              >
                <IconAnalysis
                  :width="16"
                  :height="16"
                  class="wf-item-icon"
                />
                <div class="wf-item-info">
                  <div class="wf-item-name">{{ app.name }}</div>
                  <div v-if="app.description" class="wf-item-description">
                    {{ app.description }}
                  </div>
                  <div class="wf-item-meta">
                    <span
                      class="status-dot"
                      :class="statusDotClass(app.status)"
                    />
                    {{ statusLabel(app.status) }}
                    <span v-if="app.applicationType" style="margin-left: 8px">
                      <span class="app-type-badge">{{ app.applicationType }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <!-- Dialogs -->
    <create-application-dialog
      :dialog-visible="addApplicationDialogVisible"
      applicationType="Application"
      @add-application="onAddApplicationConfirm"
      @close="onCloseAddDialog"
    />

    <!-- Unsaved changes guard -->
    <el-dialog
      v-model="unsavedChangesDialogVisible"
      width="400"
      @close="unsavedChangesDialogVisible = false"
    >
      <template #header>
        <span style="font-weight: 600">Unsaved Changes</span>
      </template>
      <span>You have unsaved parameter changes. Discard and continue?</span>
      <template #footer>
        <bf-button class="secondary" @click="unsavedChangesDialogVisible = false">
          Go Back
        </bf-button>
        <bf-button @click="discardAndSwitch">
          Discard
        </bf-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.applications-page {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.builder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background-color: theme.$white;
  border-bottom: 1px solid theme.$gray_3;
  min-height: 48px;

  .header-title {
    font-weight: 600;
    font-size: 15px;
    color: theme.$black;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
}

.builder-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.main-panel {
  flex: 1;
  background-color: theme.$gray_1;
  overflow-y: auto;
  padding: 16px;
}

.applications-sidebar {
  width: 350px;
  background-color: theme.$white;
  border-left: 1px solid theme.$gray_3;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Metrics placeholder */
.metrics-section {
  margin-bottom: 16px;
}

.metrics-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  border: 2px dashed theme.$gray_3;
  border-radius: 4px;
  color: theme.$gray_4;
  font-size: 14px;
}

/* README section */
.readme-section {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  min-height: 200px;
}

.readme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid theme.$gray_3;
}

.readme-title {
  font-weight: 600;
  font-size: 14px;
  color: theme.$black;
}

.readme-github-link {
  font-size: 13px;
  color: theme.$purple_3;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.readme-empty,
.readme-loading,
.readme-error {
  padding: 32px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
}

.readme-error {
  color: theme.$status_red;
}

.readme-content {
  padding: 16px 24px;
  font-size: 14px;
  line-height: 1.6;
  color: theme.$black;

  :deep(h1) {
    font-size: 24px;
    font-weight: 600;
    margin: 24px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid theme.$gray_3;
  }

  :deep(h2) {
    font-size: 20px;
    font-weight: 600;
    margin: 20px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid theme.$gray_2;
  }

  :deep(h3) {
    font-size: 16px;
    font-weight: 600;
    margin: 16px 0 8px;
  }

  :deep(p) {
    margin: 0 0 12px;
  }

  :deep(code) {
    background: theme.$gray_1;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 13px;
    font-family: monospace;
  }

  :deep(pre) {
    background: theme.$gray_1;
    border: 1px solid theme.$gray_3;
    border-radius: 4px;
    padding: 12px 16px;
    overflow-x: auto;
    margin: 0 0 12px;

    code {
      background: none;
      padding: 0;
    }
  }

  :deep(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 12px;

    th,
    td {
      border: 1px solid theme.$gray_3;
      padding: 6px 12px;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: theme.$gray_1;
      font-weight: 600;
    }
  }

  :deep(blockquote) {
    border-left: 4px solid theme.$gray_3;
    margin: 0 0 12px;
    padding: 4px 16px;
    color: theme.$gray_5;
  }

  :deep(a) {
    color: theme.$purple_3;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(img) {
    max-width: 100%;
    height: auto;
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 12px;
    padding-left: 24px;
  }

  :deep(li) {
    margin-bottom: 4px;
  }

  :deep(hr) {
    border: none;
    border-top: 1px solid theme.$gray_3;
    margin: 16px 0;
  }
}

/* Sidebar accordion */
.sidebar-accordion {
  border-top: none;
}

.sidebar-section-title {
  margin: 10px 0 6px 0;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_4;
}

/* Filter buttons */
.filter-btn {
  padding: 5px 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &.active {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;
  }
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

/* Workflow list (reused class names) */
.workflow-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.workflow-list-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_3;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.selected {
    border-color: theme.$purple_1;
    background-color: theme.$purple_tint;
    box-shadow: 0 2px 8px rgba(80, 57, 247, 0.15);
  }

  .wf-item-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .wf-item-info {
    flex: 1;
    min-width: 0;
  }

  .wf-item-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: theme.$black;
  }

  .wf-item-description {
    font-size: 12px;
    color: theme.$gray_4;
    margin-bottom: 4px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .wf-item-meta {
    font-size: 11px;
    color: theme.$gray_5;
    font-weight: 500;
  }
}

.workflow-list-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

/* Info panel */
.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 12px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0;

  &:not(:last-child) {
    border-bottom: 1px solid theme.$gray_2;
  }
}

.info-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  flex-shrink: 0;
  min-width: 80px;
}

.info-value {
  font-size: 12px;
  color: theme.$black;
  text-align: right;
  word-break: break-word;
}

.info-url {
  font-family: monospace;
  font-size: 11px;
}

.info-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: theme.$gray_4;
}

.text-link-btn {
  background: none;
  border: none;
  color: theme.$purple_3;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 0;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }

  &.archive-btn {
    color: theme.$status_red;
  }
}

/* Status dot */
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;

  &.dot-green {
    background-color: theme.$status_green;
  }

  &.dot-blue {
    background-color: #3b82f6;
  }

  &.dot-red {
    background-color: theme.$status_red;
  }

  &.dot-gray {
    background-color: theme.$gray_4;
  }
}

/* App type badge */
.app-type-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 2px 6px;
  border-radius: 3px;
  background: theme.$gray_2;
  color: theme.$gray_5;
}

/* Inline parameter editing */
.config-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 4px;

  .param-key { flex: 1; }
  .param-value { flex: 1; }

  .param-remove-btn {
    background: theme.$status_red;
    color: white;
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }
}
</style>
