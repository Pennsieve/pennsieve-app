<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";

import IconAnalysis from "../../icons/IconAnalysis.vue";
import AppBanner from "./AppBanner.vue";
import { appDomain, appFields, domainColors, domainCounts, fieldCounts } from "./appDomains";
import { paletteVariants, versionManifest } from "../WorkflowBuilder/appManifestInfo";
import RuntimeMark from "../WorkflowGraph/RuntimeMark.vue";
import { versionsToWatch, withLiveStatus } from "./liveStatus";
import { useAppStatusEvents } from "@/composables/useAppStatusEvents";
import {
  APP_SORTS,
  appTitle,
  computeLabel,
  githubRepo,
  matchesAppSearch,
  appDescription,
  versionLabel,
  runsOn,
  sortApps,
  versionState,
  workflowUses,
} from "./appCards";

defineProps({
  // Inside the Apps tab, whose toolbar links the manifest builder.
  embedded: { type: Boolean, default: false },
  // The Apps tab's bar has the search (v-model:search); then there's no
  // search row here, and Sort moves to the filter row.
  searchInBar: { type: Boolean, default: false },
});


/*
  Local State
*/
const searchQuery = defineModel("search", { type: String, default: "" });
const visibilityFilter = ref("all");
const statusFilter = ref("active");

const pageSize = 10;
const currentPage = ref(1);

const visibilityOptions = [
  { label: "All", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
];

/*
  Store computed
*/
const store = useStore();
const router = useRouter();
const route = useRoute();
// Shown in a workspace and in My Workspace (My Analysis), where there's no
// organization in the route and route names carry a "my-" prefix.
const isMyWorkspace = computed(() => !route.params.orgId);
const scopedRoute = (name, params = {}) => ({ name: isMyWorkspace.value ? `my-${name}` : name, params });

// The apps as listed, with live build statuses over their newest versions
// (liveStatus.js): a variant's build event moves that variant's chip only,
// the version's event its status dot.
const listedApps = computed(() => store.state.analysisModule.applications || []);
const { live } = useAppStatusEvents((l) =>
  listedApps.value.flatMap((app) => versionsToWatch(withLiveStatus(app, l), { latest: true }))
);
const applications = computed(() => listedApps.value.map((app) => withLiveStatus(app, live.value)));
// A variant chip's state, without a badge: building or failed.
const chipState = (v) => {
  const s = String(v.status || "").toLowerCase();
  if (s === "error" || s.startsWith("error")) return "app-variant--failed";
  if (["registering", "building", "deploying", "pending"].includes(s)) return "app-variant--building";
  return "";
};
const chipTitle = (v) =>
  [
    v.name,
    v.description,
    v.gpu && "Runs on a GPU",
    chipState(v) === "app-variant--failed" && `Failed to build${v.failureReason ? `: ${v.failureReason}` : ""}`,
    chipState(v) === "app-variant--building" && "Building",
  ]
    .filter(Boolean)
    .join(" · ");

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

// The app.yml's tags, a few: the rest are found by search.
const appTags = (app) => (versionManifest(app)?.tags || []).slice(0, 4);
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


/*
  A card's text when the app has no description: the short README summary
  app-deploy-service sends with each app (its first paragraph, read at
  release). Nothing is fetched from GitHub per card: that was one request
  per app, rate-limited (60/hour), and failing for private repositories.
*/
const readmeSummary = (app) => app?.summary || "";

const visibilityLabel = (app) => {
  const visibility = app?.visibility;
  if (visibility !== "public" && visibility !== "private") return null;
  return visibility === "private" ? "Private" : "Public";
};

/*
  Filtered & sorted applications (newest first, matching workflows)
*/
// Where an app runs (from its runtime config), and the choices the list has.
const computeFilter = ref("any");
// A domain's key, or null for every app: the colour legend above the cards.
const domainFilter = ref(null);
// A research field's key, or null: combines with the domain (both must hold).
const fieldFilter = ref(null);
const computeChoices = computed(() => [
  ...new Set(applications.value.flatMap((a) => a.runtimeConfig?.computeTypes || [])),
]);

// The sort is the viewer's, kept in this browser.
const SORT_KEY = "pennsieve.gallery.appSort";
const storedSort = () => {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return APP_SORTS.some((o) => o.value === v) ? v : "recommended";
  } catch {
    return "recommended";
  }
};
const sortBy = ref(storedSort());
watch(sortBy, (v) => {
  try {
    localStorage.setItem(SORT_KEY, v);
  } catch {
    // not remembered; it still applies now
  }
});

// "Used in 3 workflows" counts the workflows loaded for the Library.
const workflows = computed(() => store.state.analysisModule.workflows || []);
const usageText = (app) => {
  const n = workflowUses(app, workflows.value);
  return n ? `Used in ${n} workflow${n === 1 ? "" : "s"}` : "Not in a workflow yet";
};
const githubUrl = (app) => {
  const r = githubRepo(app.sourceUrl);
  return r ? `https://github.com/${r.owner}/${r.repo}` : "";
};

const filtersSet = computed(
  () =>
    !!searchQuery.value.trim() || visibilityFilter.value !== "all" || computeFilter.value !== "any" || !!domainFilter.value || !!fieldFilter.value
);
function clearFilters() {
  searchQuery.value = "";
  visibilityFilter.value = "all";
  computeFilter.value = "any";
  domainFilter.value = null;
  fieldFilter.value = null;
}

// The domains among the apps in this status (active, archived…), as chips
// in their colours: what the banners' colours mean, and a filter.
const statusApps = computed(() =>
  statusFilter.value === "all"
    ? applications.value
    : applications.value.filter((app) => (statusFilter.value === "archived") === (app.status === "archived"))
);
const domainChips = computed(() => domainCounts(statusApps.value));
const chipStyle = (domain) => {
  const c = domainColors(domain);
  return { "--chip-bg": c.bg, "--chip-ink": c.ink, "--chip-line": c.line, "--chip-dot": c.accent };
};
const toggleDomain = (key) => (domainFilter.value = domainFilter.value === key ? null : key);
// The research fields among them: plain chips, since a colour means a domain.
const fieldChips = computed(() => fieldCounts(statusApps.value));
const toggleField = (key) => (fieldFilter.value = fieldFilter.value === key ? null : key);

const filteredApplications = computed(() => {
  let list = applications.value;

  // Filter by lifecycle status. "Active" (the default) hides archived apps.
  if (statusFilter.value === "active") {
    list = list.filter((app) => app.status !== "archived");
  } else if (statusFilter.value === "archived") {
    list = list.filter((app) => app.status === "archived");
  }

  list = list.filter((app) => matchesAppSearch(app, searchQuery.value, readmeSummary(app)));
  if (computeFilter.value !== "any") {
    list = list.filter((app) => (app.runtimeConfig?.computeTypes || []).includes(computeFilter.value));
  }

  if (visibilityFilter.value !== "all") {
    list = list.filter(
      (app) => (visibilityLabel(app) || "").toLowerCase() === visibilityFilter.value
    );
  }
  if (domainFilter.value) {
    list = list.filter((app) => appDomain(app)?.key === domainFilter.value);
  }
  if (fieldFilter.value) {
    list = list.filter((app) => appFields(app).some((f) => f.key === fieldFilter.value));
  }

  return sortApps(list, sortBy.value, workflows.value);
});

const paginatedApplications = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredApplications.value.slice(start, start + pageSize);
});

watch(filteredApplications, () => {
  currentPage.value = 1;
});

// Load the list if nothing has yet: My Workspace clears the analysis cache on
// entry, and in a workspace this is a no-op once the list is loaded.
onMounted(() => {
  store
    .dispatch("analysisModule/fetchApplications", { includeArchived: statusFilter.value !== "active" })
    .catch(() => {});
  // The workflows "Used in" counts, when Apps opened before the Library.
  if (!workflows.value.length) {
    store.dispatch("analysisModule/fetchWorkflows", { limit: 100 }).catch(() => {});
  }
});

// Archived applications are excluded from the default list response, so any
// view that includes them must refetch with the includeArchived flag.
watch(statusFilter, (val) => {
  store
    .dispatch("analysisModule/fetchApplications", {
      force: true,
      includeArchived: val !== "active",
    })
    .catch(() => {});
});

/*
  Status helpers
*/

const statusLabel = (status) => {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

/*
  Navigation
*/
const goToDetail = (app) => {
  router.push(scopedRoute("application-detail", { uuid: app.uuid }));
};

const goToManifestBuilder = () => {
  router.push(scopedRoute("application-manifest-builder"));
};
</script>

<template>
  <div class="applications-container">
    <!-- Info Section (the Apps tab has its own toolbar) -->
    <div v-if="!embedded" class="info-section">
      <div class="info-card">
        <h3>Applications</h3>
        <p>
          <template v-if="isMyWorkspace">
            Browse the public applications, your own, and the ones shared
            with you directly. Each
          </template>
          <template v-else>Browse the applications available in this workspace. Each</template>
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
        <p class="info-note">
          <strong>Configure your application's defaults.</strong>
          Generate an <code>app.yml</code> manifest with the
          <router-link
            :to="scopedRoute('application-manifest-builder')"
            class="info-link"
          >
            manifest builder
          </router-link>
          to declare your application's runtime, resources, parameters, and
          inputs/outputs, then add it to your repository. See the
          <router-link
            :to="scopedRoute('application-manifest-guide')"
            class="info-link"
          >
            manifest guide
          </router-link>
          for the full specification.
        </p>
      </div>
    </div>

    <!-- Applications Section -->
    <div class="applications-section">
      <div v-if="!searchInBar" class="applications-section-header">
        <el-input
          v-model="searchQuery"
          placeholder="Search by name, description or repository…"
          clearable
          class="applications-search-input"
        />
        <label class="sort-control">
          Sort
          <el-select v-model="sortBy" size="small" class="sort-select">
            <el-option v-for="o in APP_SORTS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>
      </div>

      <!-- One row: visibility chips | where it runs | status at the end. -->
      <div class="filter-row">
        <div class="scope-buttons">
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
        <el-select v-model="computeFilter" size="small" class="io-select" aria-label="Runs on">
          <el-option label="Runs anywhere" value="any" />
          <el-option v-for="t in computeChoices" :key="t" :label="`Runs on ${computeLabel(t)}`" :value="t" />
        </el-select>
        <label v-if="searchInBar" class="sort-control filter-sort">
          Sort
          <el-select v-model="sortBy" size="small" class="sort-select">
            <el-option v-for="o in APP_SORTS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>
        <el-select v-model="statusFilter" size="small" class="status-select" :class="{ 'after-sort': searchInBar }" aria-label="Status">
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
      </div>

      <div v-if="domainChips.length" class="domain-row" role="group" aria-label="What apps are for">
        <button
          v-for="{ domain, count } in domainChips"
          :key="domain.key"
          type="button"
          class="domain-chip"
          :class="{ active: domainFilter === domain.key }"
          :style="chipStyle(domain)"
          :aria-pressed="domainFilter === domain.key"
          :title="domain.subject ? `About ${domain.label.toLowerCase()}` : `For ${domain.label.toLowerCase()}`"
          @click="toggleDomain(domain.key)"
        >
          <span class="domain-dot" />
          {{ domain.label }}
          <span class="domain-count">{{ count }}</span>
        </button>
      </div>
      <div v-if="fieldChips.length" class="domain-row field-row" role="group" aria-label="Research field">
        <span class="field-label">Field</span>
        <button
          v-for="{ field, count } in fieldChips"
          :key="field.key"
          type="button"
          class="field-chip"
          :class="{ active: fieldFilter === field.key }"
          :aria-pressed="fieldFilter === field.key"
          @click="toggleField(field.key)"
        >
          {{ field.label }}
          <span class="domain-count">{{ count }}</span>
        </button>
      </div>

      <div v-if="filteredApplications.length > 0" class="applications-grid">
        <!-- A card: the app's banner on the left (what goes in and comes
             out, on its domain's colour); what the app is, where it runs
             and how much it's used on the right. -->
        <div
          v-for="app in paginatedApplications"
          :key="app.uuid"
          class="app-card"
          :class="{ 'is-archived': app.status === 'archived' }"
          role="link"
          tabindex="0"
          @click="goToDetail(app)"
          @keydown.enter="goToDetail(app)"
        >
          <div class="app-thumb">
            <AppBanner :app="app" />
          </div>
          <div class="app-body">
            <div class="app-title">
              <span class="app-name">{{ appTitle(app) }}</span>
              <span v-if="latestVersion(app)?.version" class="app-version">{{ versionLabel(latestVersion(app).version) }}</span>
              <span v-if="app.status === 'archived'" class="app-badge">Archived</span>
              <span v-else-if="visibilityLabel(app)" class="app-badge">{{ visibilityLabel(app) }}</span>
            </div>
            <p class="app-description">
              {{ appDescription(app) || readmeSummary(app) || "No description." }}
            </p>
            <!-- Its variants (a CPU and a GPU build), then its tags -->
            <div v-if="appTags(app).length || paletteVariants(app).length" class="app-tags">
              <span
                v-for="v in paletteVariants(app)"
                :key="`v:${v.id}`"
                class="app-tag app-variant"
                :class="chipState(v)"
                :title="chipTitle(v)"
              ><RuntimeMark v-if="v.gpu" runtime="gpu" compact />{{ v.name }}</span>
              <span v-for="t in appTags(app)" :key="t" class="app-tag">{{ t }}</span>
            </div>
            <div class="app-meta">
              <span v-if="runsOn(app)" class="app-runs">{{ runsOn(app) }} · </span>{{ repoName(app) }}
            </div>
            <div class="app-foot">
              <span class="app-usage">
                <span class="app-dot" :class="versionState(app)" :title="statusLabel(latestVersion(app)?.status)" />
                {{ usageText(app) }}
              </span>
              <span class="app-actions" @click.stop>
                <a
                  v-if="githubUrl(app)"
                  :href="githubUrl(app)"
                  target="_blank"
                  rel="noopener"
                  class="app-action"
                >GitHub</a>
                <button type="button" class="app-action app-action--open" @click="goToDetail(app)">Open</button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredApplications.length === 0" class="empty-state">
        <IconAnalysis :width="48" :height="48" color="#9ca3af" />
        <span v-if="applications.length === 0">No applications yet</span>
        <span v-else>No applications match your search and filters</span>
        <button v-if="filtersSet" type="button" class="clear-filters" @click="clearFilters">
          Clear search and filters
        </button>
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
@use "../../../styles/element/input";

/* Lined up with the Apps tab's toolbar and the Analysis tabs (32px). */
.applications-container {
  padding: 20px 32px;
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
  /* The sort lines up with the bottom of the (taller) search box. */
  align-items: flex-end;
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

.applications-section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.applications-search-input {
  /* The row's width up to the sort, so it lines up with the cards below. */
  flex: 1;
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: theme.$gray_5;
}
.sort-select {
  width: 170px;
}

/* One row, all 24px tall, as in the workflow Library. */
/* The domains, in their banners' colours: a legend, and a filter. */
.domain-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: -4px 0 16px;
}
.domain-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--chip-line);
  border-radius: 3px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: var(--chip-ink);
  cursor: pointer;

  &:hover {
    background: var(--chip-bg);
  }
  &.active {
    border-color: var(--chip-ink);
    background: var(--chip-bg);
    font-weight: 600;
  }
}
.domain-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chip-dot);
}
/* The research fields under them: outlined and grey, a filter only. */
.field-row {
  align-items: center;
  margin-top: -8px;
}
.field-label {
  margin-right: 4px;
  font-size: 12px;
  color: theme.$gray_5;
}
.field-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$gray_4;
  }
  &.active {
    border-color: theme.$gray_6;
    font-weight: 600;
  }
}
.domain-count {
  color: theme.$gray_4;
  font-weight: 400;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.scope-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 12px;
  border-right: 1px solid theme.$gray_2;
}
.filter-btn {
  height: 24px;
  padding: 0 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
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
.io-select {
  width: 170px;
}
.status-select {
  width: 110px;
  margin-left: auto;

  &.after-sort {
    margin-left: 0;
  }
}
/* Sort and status together at the row's end (Apps tab). */
.filter-sort {
  margin-left: auto;
}

/* Wide cards, two to a row where they fit, as the workflows'. */
$card-height: 172px;

/* Cards of one height, with a square banner: the rows line up whether or
   not a card has tags or a second line of description. */
.applications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}
.app-card {
  display: flex;
  height: $card-height;
  min-width: 0;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    outline: none;
  }
  &:hover .app-actions,
  &:focus-within .app-actions {
    opacity: 1;
  }
  &.is-archived {
    opacity: 0.7;
  }
}
/* The app's banner, where the workflows show their graph. */
.app-thumb {
  display: flex;
  flex: 0 0 $card-height;
  border-right: 1px solid theme.$gray_2;
}
.app-tags {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.app-tag {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 11px;
  color: theme.$gray_5;
}
.app-variant {
  display: inline-flex;
  align-items: center;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
}
.app-variant--building {
  border-style: dashed;
  color: theme.$gray_4;
}
.app-variant--failed {
  border-color: theme.$red_2;
  color: theme.$red_2;
  text-decoration: line-through;
}
.app-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 14px 16px 12px;
}
.app-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.app-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.app-version {
  flex-shrink: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
/* What the card is (public, archived…), in its top-right corner: the
   badges line up down the grid. */
.app-badge {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  color: theme.$gray_5;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.app-description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
}
/* Where it runs, then its repository, on one line. */
.app-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_4;
}
.app-runs {
  color: theme.$gray_6;
}
.app-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
}
.app-usage {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
/* The latest version's state. */
.app-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: theme.$gray_4;

  &.ok { background: theme.$status_green; }
  &.pending { background: #f59e0b; }
  &.failed { background: theme.$status_red; }
}
.app-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.app-action {
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.app-action--open {
  border-color: theme.$purple_3;
  background: theme.$purple_3;
  color: theme.$white;

  &:hover {
    background: theme.$purple_2;
    color: theme.$white;
  }
}
@media (hover: none) {
  .app-actions {
    opacity: 1;
  }
}
.clear-filters {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
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
