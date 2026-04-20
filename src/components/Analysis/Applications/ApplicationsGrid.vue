<script setup>
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

import StageActions from "../../shared/StageActions/StageActions.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";


/*
  Local State
*/
const searchQuery = ref("");
const visibilityFilter = ref("all");

const visibilityOptions = [
  { label: "All", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

/*
  Store computed
*/
const store = useStore();
const router = useRouter();

const applications = computed(
  () => store.state.analysisModule.applications || []
);

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

const repoName = (app) => parseGitHubDisplay(app.sourceUrl) || "Unknown repo";

const latestVersion = (app) => {
  const versions = app.versions || [];
  if (versions.length === 0) return null;
  return [...versions].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime() || 0;
    const bTime = new Date(b.createdAt).getTime() || 0;
    return bTime - aTime;
  })[0];
};

const totalDeployments = (app) =>
  (app.versions || []).reduce(
    (sum, v) => sum + (v.deployments || []).length,
    0
  );

/*
  README previews (fetched lazily per app from GitHub)
*/
const readmePreviews = ref({});

const stripMarkdown = (md) =>
  md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const fetchReadmeFor = async (app) => {
  if (!app?.uuid || readmePreviews.value[app.uuid] !== undefined) return;
  const info = parseGitHubRepo(app.sourceUrl);
  if (!info) {
    readmePreviews.value[app.uuid] = "";
    return;
  }
  readmePreviews.value[app.uuid] = "";
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${info.owner}/${info.repo}/readme`,
      { headers: { Accept: "application/vnd.github.v3.json" } }
    );
    if (!resp.ok) return;
    const data = await resp.json();
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(data.content.replace(/\n/g, "")), (c) =>
        c.charCodeAt(0)
      )
    );
    readmePreviews.value[app.uuid] = stripMarkdown(decoded);
  } catch {
    // leave preview empty
  }
};

watch(
  applications,
  (apps) => {
    (apps || []).forEach((app) => fetchReadmeFor(app));
  },
  { immediate: true }
);

/*
  Filtered & sorted applications (newest first, matching workflows)
*/
const filteredApplications = computed(() => {
  let list = applications.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter((app) =>
      (app.sourceUrl || "").toLowerCase().includes(q)
    );
  }

  if (visibilityFilter.value !== "all") {
    list = list.filter(
      (app) => (app.visibility || "").toLowerCase() === visibilityFilter.value
    );
  }

  return [...list].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
});

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
  Navigation
*/
const goToDetail = (app) => {
  router.push({ name: "application-detail", params: { uuid: app.uuid } });
};
</script>

<template>
  <div class="applications-grid-page">
    <!-- Header -->
    <div class="builder-header">
      <stage-actions>
        <template #left>
          <el-input
            v-model="searchQuery"
            placeholder="Search applications..."
            size="small"
            clearable
            class="search-input"
          />
          <div class="status-buttons">
            <button
              v-for="option in visibilityOptions"
              :key="option.value"
              class="filter-btn"
              :class="{ active: visibilityFilter === option.value }"
              @click="visibilityFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </template>
      </stage-actions>
    </div>

    <!-- Card Grid -->
    <div v-if="filteredApplications.length > 0" class="card-grid">
      <div
        v-for="app in filteredApplications"
        :key="app.uuid"
        class="app-card"
        @click="goToDetail(app)"
      >
        <div class="card-body">
          <div class="card-name">{{ repoName(app) }}</div>
          <div class="card-description">
            {{ readmePreviews[app.uuid] || '' }}
          </div>
          <div class="card-spacer" />
          <div class="card-meta">
            <span
              class="status-badge"
              :class="statusBadgeClass(latestVersion(app)?.status)"
            >
              {{ statusLabel(latestVersion(app)?.status) }}
            </span>
            <span class="meta-text">{{ app.visibility || 'unknown' }}</span>
            <span class="meta-text">
              {{ new Date(app.createdAt).toLocaleDateString() }}
            </span>
          </div>
        </div>
        <div v-if="(app.versions || []).length > 0" class="card-footer">
          <span class="metric-item">
            <span class="metric-value">{{ (app.versions || []).length }}</span>
            <span class="metric-label">versions</span>
          </span>
          <span class="metric-divider" />
          <span class="metric-item">
            <span class="metric-value">{{ totalDeployments(app) }}</span>
            <span class="metric-label">deployments</span>
          </span>
          <span class="metric-divider" />
          <span class="metric-item">
            <span class="metric-value">{{ latestVersion(app)?.version || '--' }}</span>
            <span class="metric-label">latest</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <IconAnalysis :width="48" :height="48" color="#9ca3af" />
      <span v-if="applications.length === 0">No applications yet</span>
      <span v-else>No applications match your filters</span>
    </div>

  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../../../styles/element/input";

.applications-grid-page {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 24px;
}

.builder-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 24px;
  background-color: theme.$white;
}

.search-input {
  max-width: 300px;
}

.status-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
}

.filter-btn {
  padding: 4px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.4;

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

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-auto-rows: max-content;
  gap: 24px;
  padding: 24px 0;
  flex: 1;
  overflow-y: auto;
}

.app-card {
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &:hover {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(80, 57, 247, 0.15);
  }
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  flex: 1;
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
  min-height: calc(1.4em * 2);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-spacer {
  flex: 1;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
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

.meta-text {
  color: theme.$gray_4;
  text-transform: capitalize;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-top: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  border-radius: 0 0 3px 3px;
}

.metric-item {
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.metric-value {
  font-size: 14px;
  font-weight: 700;
  color: theme.$black;
}

.metric-label {
  font-size: 10px;
  color: theme.$gray_4;
}

.metric-divider {
  width: 1px;
  height: 14px;
  background: theme.$gray_3;
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
