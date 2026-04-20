<script setup>
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { propOr } from "ramda";

import BfButton from "../../shared/bf-button/BfButton.vue";
import EventBus from "../../../utils/event-bus";
import MetricsDashboard from "../Metrics/MetricsDashboard.vue";


const props = defineProps({
  uuid: {
    type: String,
    required: true,
  },
});

/*
  Local State
*/
const accordionActiveNames = ref(["information", "versions", "permissions"]);
const detail = ref(null);
const detailLoading = ref(false);
const detailError = ref("");
const readmeHtml = ref("");
const permissions = ref([]);
const permissionsLoading = ref(false);
const permissionsError = ref("");

/*
  Store computed
*/
const store = useStore();
const router = useRouter();

const activeOrganization = computed(() => store.state.activeOrganization);
const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);

const hasAdminRights = computed(() => {
  if (activeOrganization.value) {
    const isAdmin = propOr(false, "isAdmin", activeOrganization.value);
    const isOwner = propOr(false, "isOwner", activeOrganization.value);
    return isAdmin || isOwner;
  }
  return false;
});

/*
  Derived helpers
*/
const parseGitHubRepo = (sourceUrl) => {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/\s.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
};

const parseGitHubDisplay = (sourceUrl) => {
  const info = parseGitHubRepo(sourceUrl);
  return info ? `${info.owner}/${info.repo}` : null;
};

const repoName = computed(
  () => parseGitHubDisplay(detail.value?.sourceUrl) || "Unknown repo"
);

const githubRepoUrl = computed(() => {
  const info = parseGitHubRepo(detail.value?.sourceUrl);
  return info ? `https://github.com/${info.owner}/${info.repo}` : null;
});

const sortedVersions = computed(() => {
  const versions = detail.value?.versions || [];
  return [...versions].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime() || 0;
    const bTime = new Date(b.createdAt).getTime() || 0;
    return bTime - aTime;
  });
});

/*
  User name resolution
*/
const getUserName = (userId) => {
  if (!userId) return "Unknown";
  if (profile.value && (profile.value.id === userId || profile.value.intId === userId)) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || "You";
  }
  const member = orgMembers.value.find((m) => m.id === userId || m.intId === userId);
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || "Unknown User";
  }
  return String(userId).includes(":") ? String(userId).split(":").pop() : String(userId);
};

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
};

/*
  Status helpers
*/
const statusBadgeClass = (status) => {
  if (!status) return "badge-gray";
  const s = status.toLowerCase();
  if (["deployed", "active", "running"].includes(s)) return "badge-green";
  if (["registering", "deploying", "re-deploying", "pending"].includes(s))
    return "badge-blue";
  if (s.startsWith("error") || s === "stopped") return "badge-red";
  return "badge-gray";
};

const statusLabel = (status) => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

/*
  README rendering from assets
*/
const getReadmeContent = (assets) => {
  if (!assets) return "";
  const key = Object.keys(assets).find((k) => /^readme(\.md)?$/i.test(k));
  return key ? assets[key] : "";
};

const renderReadme = (markdown) => {
  if (!markdown) {
    readmeHtml.value = "";
    return;
  }
  const html = marked.parse(markdown);
  readmeHtml.value = DOMPurify.sanitize(html);
};

/*
  Permission display helpers
*/
const permissionLabel = (perm) => {
  if (perm.userId) return getUserName(perm.userId);
  if (perm.teamId) return `Team: ${perm.teamName || perm.teamId}`;
  if (perm.organizationId)
    return `Org: ${perm.organizationName || perm.organizationId}`;
  if (perm.granteeId)
    return perm.granteeType
      ? `${perm.granteeType}: ${perm.granteeId}`
      : perm.granteeId;
  return "Unknown";
};

const permissionRole = (perm) =>
  perm.role || perm.permission || perm.accessLevel || "—";

/*
  Fetch application detail + permissions in parallel
*/
const loadDetail = async (uuid) => {
  detail.value = null;
  permissions.value = [];
  readmeHtml.value = "";
  detailError.value = "";
  permissionsError.value = "";
  if (!uuid) return;
  detailLoading.value = true;
  permissionsLoading.value = true;
  try {
    const [detailResult, permsResult] = await Promise.allSettled([
      store.dispatch("analysisModule/fetchApplication", uuid),
      store.dispatch("analysisModule/fetchApplicationPermissions", uuid),
    ]);

    if (detailResult.status === "fulfilled") {
      detail.value = detailResult.value;
      renderReadme(getReadmeContent(detailResult.value?.assets));
    } else {
      console.error(detailResult.reason);
      detailError.value = "Failed to load application";
    }

    if (permsResult.status === "fulfilled") {
      const data = permsResult.value;
      permissions.value = Array.isArray(data)
        ? data
        : Array.isArray(data?.permissions)
          ? data.permissions
          : [];
    } else {
      console.error(permsResult.reason);
      permissionsError.value = "Failed to load permissions";
    }
  } finally {
    detailLoading.value = false;
    permissionsLoading.value = false;
  }
};

watch(
  () => props.uuid,
  (uuid) => loadDetail(uuid),
  { immediate: true }
);

/*
  Admin actions
*/
const deleteApplicationHandler = async () => {
  if (!detail.value) return;
  try {
    await store.dispatch("analysisModule/deleteApplication", detail.value);
    EventBus.$emit("toast", {
      detail: {
        type: "success",
        msg: "Your request was successful. It may take some time to complete.",
      },
    });
    router.push({ name: "applications" });
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
</script>

<template>
  <div class="applications-page">
    <!-- Header -->
    <div class="builder-header">
      <span class="header-title">
        <router-link :to="{ name: 'applications' }" class="header-back-link">Applications</router-link>
        <template v-if="detail">
          <span class="header-breadcrumb-sep">/</span>
          <span class="header-detail-name">{{ repoName }}</span>
        </template>
      </span>
    </div>

    <!-- Loading -->
    <div v-if="detailLoading" class="app-loading">
      Loading...
    </div>

    <!-- Error / Not Found -->
    <div v-else-if="detailError || !detail" class="app-not-found">
      <p>{{ detailError || "Application not found." }}</p>
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
            v-if="detail.sourceUrl"
            filter-column="sourceUrl"
            :filter-value="detail.sourceUrl"
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
          <div v-if="!readmeHtml" class="readme-empty">
            No README available
          </div>
          <div v-else class="readme-content" v-html="readmeHtml" />
        </div>
      </div>

      <!-- Right: Sidebar -->
      <div class="applications-sidebar">
        <el-collapse v-model="accordionActiveNames" class="sidebar-accordion">
          <el-collapse-item title="Information" name="information">
            <div class="info-card">
              <div class="info-row">
                <span class="info-label">Repository</span>
                <span class="info-value">{{ repoName }}</span>
              </div>
              <div v-if="detail.sourceType" class="info-row">
                <span class="info-label">Source</span>
                <span class="info-value">{{ detail.sourceType }}</span>
              </div>
              <div v-if="detail.visibility" class="info-row">
                <span class="info-label">Visibility</span>
                <span class="info-value">{{ detail.visibility }}</span>
              </div>
              <div v-if="detail.createdAt" class="info-row">
                <span class="info-label">Created</span>
                <span class="info-value">{{ formatDate(detail.createdAt) }}</span>
              </div>
              <div v-if="detail.ownerId" class="info-row">
                <span class="info-label">Owner</span>
                <span class="info-value">{{ getUserName(detail.ownerId) }}</span>
              </div>
              <div v-if="detail.sourceUrl" class="info-row">
                <span class="info-label">URL</span>
                <a
                  :href="detail.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="info-value info-url"
                >
                  {{ detail.sourceUrl }}
                </a>
              </div>
            </div>

            <template v-if="hasAdminRights">
              <div class="info-actions">
                <button
                  class="text-link-btn archive-btn"
                  @click="deleteApplicationHandler"
                >
                  Delete application
                </button>
              </div>
            </template>
          </el-collapse-item>

          <el-collapse-item
            :title="`Permissions (${permissions.length})`"
            name="permissions"
          >
            <div v-if="permissionsLoading" class="empty-versions">
              Loading...
            </div>
            <div v-else-if="permissionsError" class="empty-versions">
              {{ permissionsError }}
            </div>
            <div v-else-if="permissions.length === 0" class="empty-versions">
              No permissions
            </div>
            <div v-else class="info-card">
              <div
                v-for="(perm, i) in permissions"
                :key="perm.uuid || perm.userId || perm.teamId || i"
                class="info-row"
              >
                <span class="info-label">{{ permissionLabel(perm) }}</span>
                <span class="info-value perm-role">
                  {{ permissionRole(perm) }}
                </span>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item
            :title="`Versions (${sortedVersions.length})`"
            name="versions"
          >
            <div v-if="sortedVersions.length === 0" class="empty-versions">
              No versions yet
            </div>
            <div
              v-for="version in sortedVersions"
              :key="version.uuid"
              class="version-card"
            >
              <div class="version-header">
                <span class="version-tag">{{ version.version }}</span>
                <span
                  class="status-badge"
                  :class="statusBadgeClass(version.status)"
                >
                  {{ statusLabel(version.status) }}
                </span>
              </div>
              <div class="version-meta">
                <span>Released {{ formatDate(version.createdAt) }}</span>
              </div>
              <div
                v-if="(version.deployments || []).length > 0"
                class="deployments-list"
              >
                <div class="deployments-label">Deployments</div>
                <div
                  v-for="deployment in version.deployments"
                  :key="deployment.deploymentId"
                  class="deployment-row"
                >
                  <span
                    class="status-badge status-badge-sm"
                    :class="statusBadgeClass(deployment.lastStatus)"
                  >
                    {{ statusLabel(deployment.lastStatus) }}
                  </span>
                  <span class="deployment-time">
                    {{ formatDateTime(deployment.initiatedAt) }}
                  </span>
                </div>
              </div>
            </div>
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
  padding: 8px 24px;
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

.readme-empty {
  padding: 32px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
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
  text-transform: capitalize;
}

.info-url {
  font-family: monospace;
  font-size: 11px;
  text-transform: none;
  color: theme.$purple_3;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
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

  &.status-badge-sm {
    font-size: 9px;
    padding: 1px 6px;
  }

  &.badge-gray { background: theme.$gray_2; color: theme.$gray_5; }
  &.badge-blue { background: #dbeafe; color: #1d4ed8; }
  &.badge-green { background: rgba(23, 187, 98, 0.12); color: #17BB62; }
  &.badge-red { background: #fee2e2; color: #b91c1c; }
}

/* Versions */
.empty-versions {
  padding: 12px;
  color: theme.$gray_4;
  font-size: 12px;
  text-align: center;
}

.version-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.version-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.version-tag {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
  color: theme.$black;
}

.version-meta {
  font-size: 11px;
  color: theme.$gray_4;
  margin-bottom: 8px;
}

.deployments-list {
  border-top: 1px solid theme.$gray_2;
  padding-top: 8px;
  margin-top: 4px;
}

.deployments-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_4;
  margin-bottom: 6px;
}

.deployment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 11px;
}

.deployment-time {
  color: theme.$gray_5;
}

.perm-role {
  text-transform: capitalize;
}
</style>
