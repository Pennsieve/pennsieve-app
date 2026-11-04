<script>
import { createExampleCache } from "../Workflows/runExamples";
import { exampleUnavailable } from "@/store/analysisModule";

// The apps' own sample outputs, kept a while per app across visits.
const appSampleCache = createExampleCache(exampleUnavailable);
</script>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";

import IconAnalysis from "../../icons/IconAnalysis.vue";
import AppBanner from "./AppBanner.vue";
import { domainCounts, fieldCounts } from "./appDomains";
import {
  APP_FILTER_DEFAULTS,
  APP_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
  appActiveFilters,
  appsInStatus,
  filterApps,
  readmeSummary,
  visibilityLabel,
} from "./appFilters";
import FacetLayout from "../Facets/FacetLayout.vue";
import FacetSection from "../Facets/FacetSection.vue";
import FacetOptions from "../Facets/FacetOptions.vue";
import FacetRadios from "../Facets/FacetRadios.vue";
import CardTags from "../Facets/CardTags.vue";
import { domainFacetOptions, fieldFacetOptions } from "../Facets/facets";
import { paletteVariants, versionManifest } from "../WorkflowBuilder/appManifestInfo";
import RuntimeMark from "../WorkflowGraph/RuntimeMark.vue";
import IconPDF from "../../icons/IconPDF.vue";
import SampleOutputViewer from "../Workflows/SampleOutputViewer.vue";
import { PDF_URL_FRESH_MS } from "../Workflows/runExamples";
import { versionsToWatch, withLiveStatus } from "./liveStatus";
import { useAppStatusEvents } from "@/composables/useAppStatusEvents";
import {
  APP_SORTS,
  appTitle,
  githubRepo,
  appDescription,
  versionLabel,
  runsOn,
  sortApps,
  versionState,
  workflowUses,
} from "./appCards";

defineProps({
  // Inside the Apps tab, whose bar has the actions.
  embedded: { type: Boolean, default: false },
});


/*
  Local State
*/
const searchQuery = defineModel("search", { type: String, default: "" });
const visibilityFilter = ref("all");
const statusFilter = ref("active");

const pageSize = 10;
const currentPage = ref(1);


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
// (readmeSummary, appFilters.js)

/*
  Filtered & sorted applications (newest first, matching workflows)
*/
// Where an app runs (from its runtime config), and the choices the list has.
// A domain's key, or null for every app: the colour legend above the cards.
const domainFilter = ref(null);
// A research field's key, or null: combines with the domain (both must hold).
const fieldFilter = ref(null);

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
    !!searchQuery.value.trim() || visibilityFilter.value !== "all" || !!domainFilter.value || !!fieldFilter.value
);
function clearFilters() {
  searchQuery.value = "";
  visibilityFilter.value = "all";
  domainFilter.value = null;
  fieldFilter.value = null;
}

// The domains among the apps in this status (active, archived…), with
// their colours' dots: what the banners' colours mean, and a filter; then
// the research fields among them. One at a time each; both must hold.
const statusApps = computed(() => appsInStatus(applications.value, statusFilter.value));
const domainChips = computed(() => domainCounts(statusApps.value));
const fieldChips = computed(() => fieldCounts(statusApps.value));
const domainFacets = computed(() => domainFacetOptions(domainChips.value));
const fieldFacets = computed(() => fieldFacetOptions(fieldChips.value));
const toggleDomain = (key) => (domainFilter.value = domainFilter.value === key ? null : key);
const toggleField = (key) => (fieldFilter.value = fieldFilter.value === key ? null : key);

// The filters set, as removable chips over the cards; Clear all resets them
// (the search stays: it's in the toolbar).
const facetRefs = { visibility: visibilityFilter, status: statusFilter, domain: domainFilter, field: fieldFilter };
const activeChips = computed(() =>
  appActiveFilters(
    { visibility: visibilityFilter.value, status: statusFilter.value, domain: domainFilter.value, field: fieldFilter.value },
    { domains: domainChips.value, fields: fieldChips.value }
  )
);
const clearFacet = (key) => (facetRefs[key].value = APP_FILTER_DEFAULTS[key]);
const clearFacets = () => Object.keys(facetRefs).forEach(clearFacet);

const filteredApplications = computed(() =>
  sortApps(
    filterApps(applications.value, {
      status: statusFilter.value,
      query: searchQuery.value,
      visibility: visibilityFilter.value,
      domain: domainFilter.value,
      field: fieldFilter.value,
    }),
    sortBy.value,
    workflows.value
  )
);

const paginatedApplications = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredApplications.value.slice(start, start + pageSize);
});

// The apps' own sample outputs (a PDF of one of their app runs), for the
// cards on the page: a chip on the card opens it.
const appSamples = ref({}); // sourceUrl -> example (null: none)
const fetchAppSample = (sourceUrl) => store.dispatch("analysisModule/fetchAppExample", { sourceUrl, strict: true });
watch(
  paginatedApplications,
  (list) => {
    for (const app of list || []) {
      const url = app?.sourceUrl;
      if (!url || url in appSamples.value) continue;
      appSamples.value = { ...appSamples.value, [url]: null };
      appSampleCache.get(url, fetchAppSample).then((example) => {
        if (example) appSamples.value = { ...appSamples.value, [url]: { ...example, fetchedAt: Date.now() } };
      });
    }
  },
  { immediate: true }
);
const sampleViewer = ref({ open: false, source: null, name: "", subtitle: "" });
const openAppSample = (app) => {
  const url = app.sourceUrl;
  const cached = appSamples.value[url];
  let first = true;
  sampleViewer.value = {
    open: true,
    source: async () => {
      if (first && cached?.pdfUrl && Date.now() - cached.fetchedAt < PDF_URL_FRESH_MS) {
        first = false;
        return cached.pdfUrl;
      }
      first = false;
      appSampleCache.forget(url);
      const again = await appSampleCache.get(url, fetchAppSample);
      appSamples.value = { ...appSamples.value, [url]: again ? { ...again, fetchedAt: Date.now() } : null };
      return again?.pdfUrl || null;
    },
    name: appTitle(app),
    subtitle: [cached?.app?.tag, cached?.runName && `run ${cached.runName}`, cached?.pages && `${cached.pages} pages`]
      .filter(Boolean)
      .join(" · "),
  };
};

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

    <!-- The filters on the left (a rail when folded, a drawer on a phone),
         as the Workflows Library's; the search and Sort in one row; the
         chips and cards -->
    <FacetLayout
      class="applications-section"
      storage-key="pennsieve.apps.filtersPanel"
      :chips="activeChips"
      @remove="clearFacet"
      @clear-all="clearFacets"
    >
      <template #filters>
        <FacetSection title="Visibility" :clearable="visibilityFilter !== APP_FILTER_DEFAULTS.visibility" @clear="clearFacet('visibility')">
          <FacetRadios v-model="visibilityFilter" :options="VISIBILITY_OPTIONS" label="Visibility" />
        </FacetSection>
        <FacetSection v-if="domainFacets.length" title="Domain" :clearable="!!domainFilter" @clear="clearFacet('domain')">
          <FacetOptions :options="domainFacets" :selected="domainFilter" @toggle="toggleDomain" />
        </FacetSection>
        <FacetSection v-if="fieldFacets.length" title="Field" :clearable="!!fieldFilter" @clear="clearFacet('field')">
          <FacetOptions :options="fieldFacets" :selected="fieldFilter" @toggle="toggleField" />
        </FacetSection>
        <FacetSection title="Status" :clearable="statusFilter !== APP_FILTER_DEFAULTS.status" @clear="clearFacet('status')">
          <el-select v-model="statusFilter" size="small" aria-label="Status">
            <el-option v-for="o in APP_STATUS_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </FacetSection>
      </template>

      <template #toolbar>
        <el-input
          v-model="searchQuery"
          placeholder="Search by name, description or repository…"
          clearable
          class="toolbar-search"
        />
        <label class="sort-control toolbar-sort">
          Sort
          <el-select v-model="sortBy" size="small" class="sort-select">
            <el-option v-for="o in APP_SORTS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>
      </template>

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
              <CardTags :tags="appTags(app)" />
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
                <el-tooltip v-if="appSamples[app.sourceUrl]" content="Sample output: a PDF summary of a run of this app" placement="top">
                  <button
                    type="button"
                    class="app-action app-action--icon"
                    aria-label="Sample output: a PDF summary of a run of this app"
                    @click="openAppSample(app)"
                  >
                    <IconPDF :width="16" :height="16" color="currentColor" />
                  </button>
                </el-tooltip>
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
    </FacetLayout>
    <SampleOutputViewer
      v-model="sampleViewer.open"
      :source="sampleViewer.source"
      :workflow-name="sampleViewer.name"
      :subtitle="sampleViewer.subtitle"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../../../styles/element/input";

/* No padding of its own: the filter panel (or its rail) sits against the
   page's edges; FacetLayout pads the list (20px/32px, as the Analysis tabs). */
.applications-container {
  min-height: 100%;
}

.info-section {
  margin: 20px 32px 12px;
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

/* The search fills the toolbar's row up to Sort, then the tab's actions. */
.toolbar-search {
  flex: 1;
  min-width: 0;
}
.sort-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: theme.$gray_5;
}
.sort-select {
  width: 170px;
}
@media (max-width: 767px) {
  .info-section {
    margin: 16px 16px 0;
  }
  /* The select alone says what it sorts by. */
  .toolbar-sort {
    font-size: 0;
  }
  .sort-select {
    width: 130px;
  }
}

/* Cards two or more to a row where 340px each fit (16px apart), sized to
   the list beside the filter panel, as the workflows'. */
$card-height: 172px;

/* Cards of one height, with a square banner: the rows line up whether or
   not a card has tags or a second line of description. */
.applications-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
  gap: 16px;
}
.app-card {
  display: flex;
  /* At least this tall; a narrow card's footer may wrap to a second line
     (cards in a row stay one height). */
  min-height: $card-height;
  min-width: 0;
  container: app-card / inline-size;
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
/* A narrow card (two to a row beside the panel, or a phone): a narrower
   banner, so the text keeps room. */
@container app-card (max-width: 440px) {
  .app-thumb {
    flex-basis: 128px;
  }
}
/* Its variants (boxed), then its tags as the panel lists them (CardTags). */
.app-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}
.app-variant + .card-tags {
  margin-left: 8px;
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  row-gap: 6px;
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
  flex-shrink: 0;
  margin-left: auto;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.app-action--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 6px;
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
