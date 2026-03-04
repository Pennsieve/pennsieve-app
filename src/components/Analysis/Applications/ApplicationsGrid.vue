<script setup>
import { computed, ref } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";
import { pathOr, propOr } from "ramda";

import BfButton from "../../shared/bf-button/BfButton.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import IconLink from "../../icons/IconLink.vue";
import CreateApplicationDialog from "./CreateApplicationDialog.vue";

import {
  isEnabledForAllDevOrgs,
  isEnabledForSpecificOrgs,
  isEnabledForTestOrgs,
} from "../../../utils/feature-flags.js";

/*
  Local State
*/
const searchQuery = ref("");
const sortField = ref("name");
const selectedTags = ref([]);
const addApplicationDialogVisible = ref(false);

/*
  Store computed
*/
const store = useStore();
const router = useRouter();

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
  Tags
*/
const availableTags = computed(() => {
  return [...new Set(applications.value.flatMap((a) => a.tags || []))];
});

const toggleTag = (tag) => {
  const idx = selectedTags.value.indexOf(tag);
  if (idx >= 0) {
    selectedTags.value.splice(idx, 1);
  } else {
    selectedTags.value.push(tag);
  }
};

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

  if (selectedTags.value.length > 0) {
    list = list.filter((app) => {
      const appTags = app.tags || [];
      return selectedTags.value.every((t) => appTags.includes(t));
    });
  }

  const field = sortField.value;
  return [...list].sort((a, b) => {
    const aVal = (a[field] || "").toLowerCase();
    const bVal = (b[field] || "").toLowerCase();
    return aVal.localeCompare(bVal);
  });
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
  GitHub display
*/
const parseGitHubDisplay = (sourceUrl) => {
  if (!sourceUrl) return null;
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/\s.]+)/);
  if (!match) return null;
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  return `${owner}/${repo}`;
};

/*
  Navigation
*/
const goToDetail = (app) => {
  router.push({ name: "application-detail", params: { uuid: app.uuid } });
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
</script>

<template>
  <div class="applications-grid-page">
    <!-- Header -->
    <div class="builder-header">
      <span class="header-title">Applications</span>
      <div class="header-actions">
        <bf-button
          :disabled="!isFeatureFlagEnabled || !hasAdminRights"
          @click="openCreateApplicationDialog"
        >
          + New Application
        </bf-button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar-container">
      <el-input
        v-model="searchQuery"
        placeholder="Search applications..."
        size="small"
        clearable
        class="search-input"
      />

      <div class="sort-buttons">
        <button
          class="filter-btn"
          :class="{ active: sortField === 'name' }"
          @click="sortField = 'name'"
        >
          Name
        </button>
        <button
          class="filter-btn"
          :class="{ active: sortField === 'status' }"
          @click="sortField = 'status'"
        >
          Status
        </button>
      </div>

      <div v-if="availableTags.length > 0" class="tag-chips">
        <button
          v-for="tag in availableTags"
          :key="tag"
          class="tag-chip"
          :class="{ selected: selectedTags.includes(tag) }"
          @click="toggleTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <!-- Card Grid -->
    <div v-if="filteredApplications.length > 0" class="card-grid">
      <div
        v-for="app in filteredApplications"
        :key="app.uuid"
        class="app-card"
        @click="goToDetail(app)"
      >
        <div class="card-name">{{ app.name }}</div>
        <div v-if="app.description" class="card-description">
          {{ app.description }}
        </div>
        <div class="card-status">
          <span
            class="status-badge"
            :class="statusBadgeClass(app.status)"
          >
            {{ statusLabel(app.status) }}
          </span>
        </div>
        <div v-if="(app.tags || []).length > 0" class="card-tags">
          <span v-for="tag in app.tags" :key="tag" class="tag-pill">
            {{ tag }}
          </span>
        </div>
        <a
          v-if="parseGitHubDisplay(app.source?.url)"
          :href="app.source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="card-github-link"
          @click.stop
        >
          <IconLink :width="12" :height="12" />
          {{ parseGitHubDisplay(app.source.url) }}
        </a>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <IconAnalysis :width="48" :height="48" color="#9ca3af" />
      <span v-if="applications.length === 0">No applications yet</span>
      <span v-else>No applications match your filters</span>
    </div>

    <!-- Create Dialog -->
    <create-application-dialog
      :dialog-visible="addApplicationDialogVisible"
      applicationType="Application"
      @add-application="onAddApplicationConfirm"
      @close="onCloseAddDialog"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.applications-grid-page {
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

.filter-bar-container {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: theme.$white;
  border-bottom: 1px solid theme.$gray_3;
  gap: 12px;
}

.search-input {
  max-width: 300px;
}

.sort-buttons {
  display: flex;
  gap: 8px;
}

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

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  padding: 4px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 12px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
  }

  &.selected {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

.app-card {
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:hover {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(80, 57, 247, 0.15);
  }
}

.card-name {
  font-size: 16px;
  font-weight: 600;
  color: theme.$black;
}

.card-description {
  font-size: 13px;
  color: theme.$gray_4;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-status {
  font-size: 12px;
}

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

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-pill {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: theme.$gray_2;
  color: theme.$gray_5;
}

.card-github-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: theme.$purple_3;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: theme.$gray_4;
  font-size: 14px;
}
</style>
