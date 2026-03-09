<script setup>
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { pathOr, propOr } from "ramda";

import BfButton from "../../shared/bf-button/BfButton.vue";
import EventBus from "../../../utils/event-bus";
import MetricsDashboard from "../Metrics/MetricsDashboard.vue";

import {
  isEnabledForAllDevOrgs,
  isEnabledForSpecificOrgs,
  isEnabledForTestOrgs,
} from "../../../utils/feature-flags.js";

const props = defineProps({
  uuid: {
    type: String,
    required: true,
  },
});

/*
  Local State
*/
const accordionActiveNames = ref(["information"]);
const readmeHtml = ref("");
const readmeLoading = ref(false);
const readmeError = ref("");
const editableParams = ref([]);

/*
  Store computed
*/
const store = useStore();
const router = useRouter();

const applications = computed(
  () => store.state.analysisModule.applications || []
);
const applicationsLoaded = computed(
  () => store.state.analysisModule.applicationsLoaded
);
const activeOrganization = computed(() => store.state.activeOrganization);
const config = computed(() => store.state.config);

const selectedApplication = computed(() =>
  applications.value.find((a) => a.uuid === props.uuid)
);

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
  Status helpers
*/
const statusBadgeClass = (status) => {
  if (!status) return "badge-gray";
  if (["deployed", "active"].includes(status)) return "badge-green";
  if (["registering", "deploying", "re-deploying", "pending"].includes(status))
    return "badge-blue";
  if (status.startsWith("error")) return "badge-red";
  return "badge-gray";
};

const statusLabel = (status) => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

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
  Watch: init when selectedApplication becomes available
*/
watch(selectedApplication, (app) => {
  if (app) {
    initEditableParams(app);
    fetchReadme(app);
  } else {
    editableParams.value = [];
    readmeHtml.value = "";
    readmeError.value = "";
  }
}, { immediate: true });

/*
  Route navigation guard — warn on unsaved param changes
*/
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
      <span class="header-title">
        <router-link :to="{ name: 'applications' }" class="header-back-link">Applications</router-link>
        <template v-if="selectedApplication">
          <span class="header-breadcrumb-sep">/</span>
          <span class="header-detail-name">{{ selectedApplication.name }}</span>
        </template>
      </span>
      <div class="header-actions">
        <template v-if="hasUnsavedChanges">
          <bf-button class="secondary" @click="cancelParamEdits">Cancel</bf-button>
          <bf-button @click="saveParams">Update</bf-button>
        </template>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="!applicationsLoaded" class="app-loading">
      Loading...
    </div>

    <!-- Not Found -->
    <div v-else-if="!selectedApplication" class="app-not-found">
      <p>Application not found.</p>
      <router-link :to="{ name: 'applications' }" class="back-link">
        &larr; Back to Applications
      </router-link>
    </div>

    <!-- Detail Content -->
    <div v-else class="builder-content">
      <!-- Left: Main Panel -->
      <div class="main-panel">
        <!-- Metrics -->
        <div class="metrics-section">
          <MetricsDashboard
            v-if="selectedApplication?.source?.url"
            filter-column="sourceUrl"
            :filter-value="selectedApplication.source.url"
          />
          <div v-else class="metrics-placeholder">
            <span>No source URL available for metrics</span>
          </div>
        </div>

        <!-- README Section -->
        <div class="readme-section">
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
        </div>
      </div>

      <!-- Right: Sidebar -->
      <div class="applications-sidebar">
        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <el-collapse-item title="Information" name="information">
            <div class="info-card">
              <div class="info-row">
                <span class="info-label">Name</span>
                <span class="info-value">{{ selectedApplication.name }}</span>
              </div>
              <div v-if="selectedApplication.description" class="info-row">
                <span class="info-label">Description</span>
                <span class="info-value">{{ selectedApplication.description }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status</span>
                <span class="info-value">
                  <span
                    class="status-badge"
                    :class="statusBadgeClass(selectedApplication.status)"
                  >
                    {{ statusLabel(selectedApplication.status) }}
                  </span>
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
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>
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
    font-weight: 400;
    font-size: 13px;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-back-link {
    color: theme.$purple_3;
    cursor: pointer;
    font-weight: 500;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .header-breadcrumb-sep {
    color: theme.$gray_4;
    font-weight: 400;
  }

  .header-detail-name {
    font-weight: 600;
    font-size: 14px;
    color: theme.$black;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
}

.app-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: theme.$gray_4;
  font-size: 14px;
}

.app-not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: theme.$gray_4;
  font-size: 14px;
  gap: 12px;
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

/* Status badge */
.status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.badge-gray { background: theme.$gray_2; color: theme.$gray_5; }
  &.badge-blue { background: #dbeafe; color: #1d4ed8; }
  &.badge-green { background: rgba(23, 187, 98, 0.12); color: #17BB62; }
  &.badge-red { background: #fee2e2; color: #b91c1c; }
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
