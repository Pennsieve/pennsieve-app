<script setup>
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter } from "vue-router";

import IconAnalysis from "../../icons/IconAnalysis.vue";


/*
  Local State
*/
const visibilityFilter = ref("all");

const pageSize = 10;
const currentPage = ref(1);

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

  if (visibilityFilter.value !== "all") {
    list = list.filter(
      (app) => (app.visibility || "").toLowerCase() === visibilityFilter.value
    );
  }

  return [...list].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
});

const paginatedApplications = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredApplications.value.slice(start, start + pageSize);
});

watch(filteredApplications, () => {
  currentPage.value = 1;
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
  <div class="applications-container">
    <!-- Info Section -->
    <div class="info-section">
      <div class="info-card">
        <h3>Applications</h3>
        <p>
          Browse the applications available in this workspace. Each
          application is sourced from a GitHub repository published to the
          Pennsieve App Store and can be wired into compute workflows.
        </p>
        <p class="info-note">
          <strong>Want to create a new application?</strong>
          Open
          <router-link :to="{ name: 'my-code' }" class="info-link">
            My Workspace &rsaquo; My Code
          </router-link>
          and enable
          <strong>Publishing &rsaquo; App Store</strong>
          in the publishing settings for the repository you'd like to
          publish.
        </p>
      </div>
    </div>

    <!-- Applications Section -->
    <div class="applications-section">
      <div class="applications-section-header">
        <h3>Applications</h3>
      </div>

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

      <div v-if="filteredApplications.length > 0" class="applications-grid">
        <div
          v-for="app in paginatedApplications"
          :key="app.uuid"
          class="app-card"
          @click="goToDetail(app)"
        >
          <div class="app-header">
            <div class="app-info">
              <h3>
                <button
                  type="button"
                  class="app-name-link"
                  @click.stop="goToDetail(app)"
                >
                  {{ repoName(app) }}
                </button>
              </h3>
              <div class="app-subtitle">Application</div>
              <div v-if="readmePreviews[app.uuid]" class="app-description">
                {{ readmePreviews[app.uuid] }}
              </div>
              <div class="app-tags">
                <span
                  class="status-badge"
                  :class="statusBadgeClass(latestVersion(app)?.status)"
                >
                  {{ statusLabel(latestVersion(app)?.status) }}
                </span>
                <span
                  class="tag visibility"
                  :class="(app.visibility || 'unknown').toLowerCase()"
                >
                  {{ app.visibility || 'Unknown' }}
                </span>
                <span class="tag created">
                  {{ new Date(app.createdAt).toLocaleDateString() }}
                </span>
              </div>
            </div>
          </div>

          <div class="app-card-actions">
            <div class="app-metrics">
              <span class="metric-item">
                <span class="metric-value">
                  {{ (app.versions || []).length }}
                </span>
                <span class="metric-label">versions</span>
              </span>
              <span class="metric-divider" />
              <span class="metric-item">
                <span class="metric-value">{{ totalDeployments(app) }}</span>
                <span class="metric-label">deployments</span>
              </span>
              <span class="metric-divider" />
              <span class="metric-item">
                <span class="metric-value">
                  {{ latestVersion(app)?.version || '--' }}
                </span>
                <span class="metric-label">latest</span>
              </span>
            </div>

            <button
              type="button"
              class="card-action-link"
              @click.stop="goToDetail(app)"
            >
              <span>View details</span>
              <span class="arrow">&rarr;</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredApplications.length === 0" class="empty-state">
        <IconAnalysis :width="48" :height="48" color="#9ca3af" />
        <span v-if="applications.length === 0">No applications yet</span>
        <span v-else>No applications match your filters</span>
      </div>

      <el-pagination
        v-if="filteredApplications.length > 0"
        class="applications-pagination"
        :page-size="pageSize"
        :pager-count="5"
        :current-page="currentPage"
        layout="prev, pager, next"
        :total="filteredApplications.length"
        @current-change="currentPage = $event"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.applications-container {
  max-width: 1000px;
  margin: 0;
  padding: 16px 24px;
}

.info-section {
  margin-bottom: 32px;
}

.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 24px;

  h3 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0 0 12px 0;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .info-note {
    background: rgba(theme.$purple_1, 0.08);
    border-left: 3px solid theme.$purple_1;
    padding: 12px 16px;
    margin: 12px 0 0 0;
    border-radius: 4px;
    color: theme.$gray_6;

    strong {
      color: theme.$gray_6;
    }
  }

  .info-link {
    color: theme.$purple_3;
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
}

.applications-section {
  margin-bottom: 48px;
}

.applications-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0;
  }
}

.status-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
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

.applications-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-card {
  background: white;
  border: 1px solid theme.$gray_2;
  padding: 20px;
  transition: border-color 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: theme.$gray_3;
  }
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.app-info {
  flex: 1;
  min-width: 0;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }
}

.app-name-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: theme.$gray_6;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: theme.$purple_2;
    text-decoration: underline;
  }
}

.app-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 6px;
  font-weight: 400;
}

.app-description {
  font-size: 13px;
  color: theme.$gray_5;
  margin: 4px 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.app-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.visibility {
      &.private {
        background: rgba(#EF4444, 0.1);
        color: #DC2626;
      }
      &.public {
        background: rgba(#10B981, 0.1);
        color: #059669;
      }
      &.unknown {
        background: theme.$gray_2;
        color: theme.$gray_5;
      }
    }

    &.created {
      background: theme.$gray_1;
      color: theme.$gray_5;
    }
  }
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

.app-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid theme.$gray_2;
  flex-wrap: wrap;
}

.app-metrics {
  display: flex;
  align-items: center;
  gap: 12px;
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

.card-action-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$purple_3;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  .arrow {
    transition: transform 0.15s ease;
  }

  &:hover .arrow {
    transform: translateX(2px);
  }
}

.applications-pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  --el-pagination-hover-color: #{theme.$purple_3};
}

.empty-state {
  text-align: center;
  padding: 32px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  color: theme.$gray_5;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
</style>
