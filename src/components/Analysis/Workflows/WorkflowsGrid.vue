<script>
import { createExampleCache } from "./runExamples";
import { exampleUnavailable } from "@/store/analysisModule";

// The cards' examples, shared by the library's visits in this page load
// (module scope), so where the feature isn't served it's found out once.
const exampleCache = createExampleCache(exampleUnavailable);
</script>

<script setup>
import { computed, ref, watch, onMounted } from "vue";
import { ArrowLeft, ArrowRight, Close } from "@element-plus/icons-vue";
import { interfaceDag } from "../RunMonitor/workflowInterface";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";

import BfButton from "../../shared/bf-button/BfButton.vue";
import IconAnalysis from "../../icons/IconAnalysis.vue";
import IconPennsieveMark from "../../icons/IconPennsieveMark.vue";
import IconPDF from "../../icons/IconPDF.vue";
import WorkflowThumbnail from "../WorkflowGraph/WorkflowThumbnail.vue";
import RunWizardDialog from "../RunMonitor/RunWizardDialog.vue";
import { ioSummary, usageLine, cardText } from "./workflowSummary";
import { domainColors, domainOfTag } from "../Applications/appDomains";
import { activeFilters, applyFilters, domainOptions, FACET_DEFAULTS, fieldOptions, inheritedTags, libraryWorkflows, outputOptions, sortWorkflows, SORTS } from "./galleryFilter";
import { isNotebookWorkflow } from "../RunMonitor/notebookHelpers";
import { exampleLabel, exampleVersion, PDF_URL_FRESH_MS } from "./runExamples";
import SampleOutputViewer from "./SampleOutputViewer.vue";
import LibraryFilters from "./LibraryFilters.vue";

defineProps({
  // Inside the Workflows tab's Library, whose bar has the New Workflow button.
  embedded: { type: Boolean, default: false },
});
// List notebook workflows too: "Include notebooks", in the filter panel when
// embedded (the Workflows tab keeps it in the URL, for Live too).
const includeNotebooks = defineModel("includeNotebooks", { type: Boolean, default: false });

const store = useStore();
const router = useRouter();
const route = useRoute();

// Shown in a workspace (/:orgId/analysis/workflows) and in My Workspace
// (/my-workspace/analysis/workflows), where "mine" is the user's own workflows
// made outside any workspace.
const isMyWorkspace = computed(() => !route.params.orgId);

const searchQuery = ref("");
const statusFilter = ref("active");
const scopeFilter = ref("workspace"); // "workspace" | "public" | "pennsieve" (public, official only)
const inputFilter = ref("any"); // "any" | "dataset" | "none"
const outputFilter = ref("any"); // "any" | a target type
const domainFilter = ref("any"); // "any" | a domain's key
const fieldFilter = ref("any"); // "any" | a research field's key

// The sort is the viewer's, kept in this browser.
const SORT_KEY = "pennsieve.gallery.workflowSort";
const storedSort = () => {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return SORTS.some((o) => o.value === v) ? v : "recommended";
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
const pageSize = ref(10);
const currentPage = ref(1);
const isLoadingAll = ref(false);

const workflows = computed(
  () => store.state.analysisModule.workflows || []
);
// What the cards name: target types (outputs) and applications (steps).
const targetTypes = computed(() => store.getters["analysisModule/targetTypes"] || []);
const applications = computed(() => store.getters["analysisModule/applications"] || []);
const nextCursor = computed(
  () => store.state.analysisModule.workflowsNextCursor || ""
);

const scopeOptions = computed(() => [
  { label: isMyWorkspace.value ? "My workflows" : "This workspace", value: "workspace" },
  { label: "Public", value: "public" },
  { label: "Pennsieve", value: "pennsieve" },
]);

// Pennsieve's are the public ones it has reviewed (official).
const isPublicScope = computed(() => scopeFilter.value !== "workspace");

const outputChoices = computed(() => outputOptions(workflows.value, targetTypes.value));
// What the workflows are for (their tags' domains, and their apps'), with
// their domains' colours, and the research fields their apps serve, as on the
// Apps tab: the panel's Domain and Field.
const domainChips = computed(() => domainOptions(libraryWorkflows(workflows.value), applications.value));
const fieldChips = computed(() => fieldOptions(libraryWorkflows(workflows.value), applications.value));

// The facets set, as removable chips over the cards; Clear all resets them.
const facetRefs = { domain: domainFilter, field: fieldFilter, input: inputFilter, output: outputFilter, status: statusFilter };
const activeChips = computed(() =>
  activeFilters(
    { domain: domainFilter.value, field: fieldFilter.value, input: inputFilter.value, output: outputFilter.value, status: statusFilter.value },
    { domains: domainChips.value, fields: fieldChips.value, outputs: outputChoices.value }
  )
);
const clearFacet = (key) => (facetRefs[key].value = FACET_DEFAULTS[key]);
const clearFacets = () => Object.keys(facetRefs).forEach(clearFacet);

// The filter panel folds to a rail, as the builder's do; the choice is kept
// in this browser. On a phone it's a drawer, opened by Filters.
const PANEL_KEY = "pennsieve.library.filtersPanel";
const storedPanel = () => {
  try {
    return localStorage.getItem(PANEL_KEY) !== "folded";
  } catch {
    return true;
  }
};
const panelOpen = ref(storedPanel());
const togglePanel = () => {
  panelOpen.value = !panelOpen.value;
  try {
    localStorage.setItem(PANEL_KEY, panelOpen.value ? "open" : "folded");
  } catch {
    // not kept
  }
};
const drawerOpen = ref(false);
// A card's tag in its domain's colours (an inherited one outlined, not
// filled); neutral without a domain.
const tagStyle = (tag, inherited = false) => {
  const d = domainOfTag(tag);
  if (!d) return {};
  const c = domainColors(d);
  return inherited ? { borderColor: c.line, color: c.ink } : { background: c.bg, borderColor: c.line, color: c.ink };
};
const filtersSet = computed(
  () =>
    !!searchQuery.value.trim() ||
    inputFilter.value !== "any" ||
    outputFilter.value !== "any" ||
    domainFilter.value !== "any" ||
    fieldFilter.value !== "any"
);
function clearFilters() {
  searchQuery.value = "";
  inputFilter.value = "any";
  outputFilter.value = "any";
  domainFilter.value = "any";
  fieldFilter.value = "any";
}

const filteredWorkflows = computed(() =>
  sortWorkflows(
    applyFilters(libraryWorkflows(workflows.value, includeNotebooks.value), {
      query: searchQuery.value,
      input: inputFilter.value,
      output: outputFilter.value,
      domain: domainFilter.value,
      field: fieldFilter.value,
      officialOnly: scopeFilter.value === "pennsieve",
      applications: applications.value,
      targetTypes: targetTypes.value,
    }),
    sortBy.value,
    { applications: applications.value }
  )
);

const paginatedWorkflows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredWorkflows.value.slice(start, start + pageSize.value);
});

const onPageChange = (newPage) => {
  currentPage.value = newPage;
};

watch(filteredWorkflows, () => {
  currentPage.value = 1;
});




const formatRelativeTime = (dateString) => {
  if (!dateString) return null;
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
};

const lastRunInfo = (wf) => {
  const m = wf?.metrics;
  const ts =
    wf?.lastRunAt ||
    m?.lastRunAt ||
    m?.lastRunCompletedAt ||
    m?.lastCompletedAt ||
    null;
  const status =
    wf?.lastRunStatus || m?.lastRunStatus || m?.lastStatus || null;
  const totalRuns = m?.totalRuns ?? 0;
  if (totalRuns === 0) {
    return { label: "Never run", statusKey: "gray" };
  }
  const rel = formatRelativeTime(ts);
  return {
    label: rel ? `Last run · ${rel}` : `${totalRuns} runs`,
    statusKey: lastRunStatusKey(status, m?.successRate),
  };
};

const lastRunStatusKey = (status, successRate) => {
  if (status) {
    const s = String(status).toLowerCase();
    if (["succeeded", "success", "completed"].includes(s)) return "enabled";
    if (["failed", "error", "errored"].includes(s)) return "failed";
    if (["running", "pending", "queued"].includes(s)) return "pending";
  }
  if (typeof successRate === "number") {
    if (successRate >= 75) return "enabled";
    if (successRate < 25) return "failed";
    return "pending";
  }
  return "gray";
};

const goToCreate = () => {
  // The Workflows tab's Builder view.
  router.push({ name: isMyWorkspace.value ? "my-workflows" : "workflows", query: { view: "builder" } });
};
defineExpose({ goToCreate });

const goToDetail = (wf) => {
  router.push({
    name: isMyWorkspace.value ? "my-workflow-detail" : "workflow-detail",
    params: { uuid: wf.uuid },
  });
};

const getStatusParam = () => {
  return statusFilter.value !== "all" ? statusFilter.value : undefined;
};

const ALL_FETCH_BATCH = 100;
const ALL_FETCH_CAP = 50; // hard stop at 5,000 workflows

const fetchAllWorkflows = async () => {
  if (isLoadingAll.value) return;
  isLoadingAll.value = true;
  const visibility = isPublicScope.value ? "public" : undefined;
  try {
    // First batch replaces, subsequent batches append.
    await store.dispatch("analysisModule/fetchWorkflows", {
      cursor: undefined,
      limit: ALL_FETCH_BATCH,
      status: getStatusParam(),
      visibility,
      append: false,
    });
    let safety = ALL_FETCH_CAP;
    while (nextCursor.value && safety-- > 0) {
      await store.dispatch("analysisModule/fetchWorkflows", {
        cursor: nextCursor.value,
        limit: ALL_FETCH_BATCH,
        status: getStatusParam(),
        visibility,
        append: true,
      });
    }
  } finally {
    isLoadingAll.value = false;
  }
};


// Run from a card: the run dialog, here, on this workflow. A notebook
// workflow (listed only with Include notebooks) starts on the Notebooks tab.
const runDialog = ref(null);
const runWorkflow = (wf) =>
  isNotebookWorkflow(wf)
    ? router.push({ name: "notebooks", params: route.params })
    : runDialog.value?.open(wf.uuid);

// The cards' example PDFs (a run's summary per workflow), for the cards on
// the page; none where the feature isn't served.
const examples = ref({}); // uuid -> example
watch(
  paginatedWorkflows,
  (list) => {
    for (const wf of list || []) {
      if (!wf?.uuid || wf.uuid in examples.value) continue;
      examples.value = { ...examples.value, [wf.uuid]: null };
      exampleCache
        .get(wf.uuid, (uuid) => store.dispatch("analysisModule/fetchWorkflowExample", { uuid, strict: true }))
        .then((example) => {
          if (example) examples.value = { ...examples.value, [wf.uuid]: { ...example, fetchedAt: Date.now() } };
        });
    }
  },
  { immediate: true }
);
const cardExampleLabel = (example) => (example?.fromVersion ? `Sample output (v${example.fromVersion})` : "Sample output");
const viewer = ref({ open: false, source: null, name: "", version: null, subtitle: "" });
const exampleSubtitle = (example) => {
  if (!example) return "";
  const parts = [];
  const v = exampleVersion(example);
  if (v) parts.push(`Version ${v}`);
  if (example.runName || example.runId) parts.push(`run ${example.runName || example.runId}`);
  if (example.pages) parts.push(`${example.pages} page${example.pages === 1 ? "" : "s"}`);
  return parts.join(" · ");
};
const openExample = (wf) => {
  const cached = examples.value[wf.uuid];
  const fresh = cached?.pdfUrl && Date.now() - cached.fetchedAt < PDF_URL_FRESH_MS ? cached.pdfUrl : null;
  const refetch = async () => {
    exampleCache.forget(wf.uuid);
    const example = await exampleCache.get(wf.uuid, (uuid) =>
      store.dispatch("analysisModule/fetchWorkflowExample", { uuid, strict: true })
    );
    examples.value = { ...examples.value, [wf.uuid]: example ? { ...example, fetchedAt: Date.now() } : null };
    return example?.pdfUrl || null;
  };
  let first = true;
  viewer.value = {
    open: true,
    // The card's link the first time where it's fresh; a new one after that.
    source: async () => {
      if (first && fresh) {
        first = false;
        return fresh;
      }
      first = false;
      return refetch();
    },
    name: wf.name || "",
    version: exampleVersion(cached),
    subtitle: exampleSubtitle(cached),
  };
};

// Re-fetch all when the status or scope filter changes
watch([statusFilter, isPublicScope], () => {
  currentPage.value = 1;
  fetchAllWorkflows();
});

onMounted(async () => {
  store.dispatch("analysisModule/fetchTargetTypes").catch(() => {});
  store.dispatch("analysisModule/fetchApplications").catch(() => {});
  await fetchAllWorkflows();
});
</script>

<template>
  <div class="workflows-container">
    <!-- Info Section (the Workflows tab has its own toolbar) -->
    <div v-if="!embedded" class="info-section">
      <div class="info-card">
        <h3>Compute Workflows</h3>
        <p>
          Workflows chain processors together into a pipeline that runs on
          Pennsieve compute nodes. Each workflow can be executed on demand or
          scheduled, with runtime metrics surfaced per run.
        </p>
        <div class="info-card-actions">
          <bf-button @click="goToCreate">+ New Workflow</bf-button>
        </div>
      </div>
    </div>

    <!-- Workflows Section: the filters on the left (a rail when folded, a
         drawer on a phone), the search, chips and cards on the right -->
    <div class="workflows-section library-layout">
      <button
        v-if="!panelOpen"
        type="button"
        class="panel-rail library-rail"
        title="Show the filters"
        aria-label="Show the filters"
        @click="togglePanel"
      >
        <el-icon><ArrowRight /></el-icon>
        <span class="panel-rail-label">Filters</span>
        <span v-if="activeChips.length" class="rail-count">{{ activeChips.length }}</span>
      </button>
      <aside v-else class="library-panel" aria-label="Filters">
        <LibraryFilters
          v-model:scope="scopeFilter"
          v-model:domain="domainFilter"
          v-model:field="fieldFilter"
          v-model:input="inputFilter"
          v-model:output="outputFilter"
          v-model:status="statusFilter"
          v-model:include-notebooks="includeNotebooks"
          :notebooks-option="embedded"
          :scope-options="scopeOptions"
          :domains="domainChips"
          :fields="fieldChips"
          :outputs="outputChoices"
          :any-set="activeChips.length > 0"
          @clear-all="clearFacets"
        >
          <template #action>
            <button type="button" class="panel-fold" title="Fold the filters" aria-label="Fold the filters" @click="togglePanel">
              <el-icon><ArrowLeft /></el-icon>
            </button>
          </template>
        </LibraryFilters>
      </aside>

      <el-drawer v-model="drawerOpen" direction="ltr" size="280px" :with-header="false" class="library-drawer">
        <LibraryFilters
          v-model:scope="scopeFilter"
          v-model:domain="domainFilter"
          v-model:field="fieldFilter"
          v-model:input="inputFilter"
          v-model:output="outputFilter"
          v-model:status="statusFilter"
          v-model:include-notebooks="includeNotebooks"
          :notebooks-option="embedded"
          :scope-options="scopeOptions"
          :domains="domainChips"
          :fields="fieldChips"
          :outputs="outputChoices"
          :any-set="activeChips.length > 0"
          @clear-all="clearFacets"
        >
          <template #action>
            <button type="button" class="panel-fold" title="Close the filters" aria-label="Close the filters" @click="drawerOpen = false">
              <el-icon><Close /></el-icon>
            </button>
          </template>
        </LibraryFilters>
      </el-drawer>

      <div class="library-main">
        <!-- The search fills the row up to Sort; on a phone, Filters first -->
        <div class="list-toolbar">
          <button type="button" class="filters-button" @click="drawerOpen = true">
            Filters<span v-if="activeChips.length" class="filters-count">{{ activeChips.length }}</span>
          </button>
          <el-input
            v-model="searchQuery"
            placeholder="Search by name, tag, app, input or output…"
            clearable
            class="workflows-search-input toolbar-search"
          />
          <label class="sort-control toolbar-sort">
            Sort
            <el-select v-model="sortBy" size="small" class="sort-select">
              <el-option v-for="o in SORTS" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </label>
        </div>

        <div v-if="activeChips.length" class="active-filters" role="group" aria-label="Active filters">
          <span v-for="chip in activeChips" :key="chip.key" class="active-chip">
            {{ chip.label }}
            <button type="button" class="active-chip-remove" :aria-label="`Remove filter ${chip.label}`" @click="clearFacet(chip.key)">
              <el-icon><Close /></el-icon>
            </button>
          </span>
          <button type="button" class="clear-filters" @click="clearFacets">Clear all</button>
        </div>

        <p v-if="scopeFilter === 'pennsieve'" class="scope-hint">
          Workflows Pennsieve has reviewed and validated. They can be run from any workspace.
        </p>
        <p v-else-if="isPublicScope" class="scope-hint">
          Public workflows published across all workspaces. They can be run from
          any workspace; only the creator can edit or unpublish them.
        </p>

        <div v-if="filteredWorkflows.length > 0" class="workflows-grid">
          <!-- A card: the graph on the left; what it is, does and runs on the
               right; Open and Run. -->
          <div
            v-for="wf in paginatedWorkflows"
            :key="wf.uuid"
            class="wf-card"
            :class="{ 'is-inactive': !wf.isActive }"
            role="link"
            tabindex="0"
            @click="goToDetail(wf)"
            @keydown.enter="goToDetail(wf)"
          >
            <div class="wf-thumb">
              <WorkflowThumbnail :dag="interfaceDag(wf)" :aspect="1" />
            </div>
            <div class="wf-body">
              <div class="wf-title">
                <span class="wf-name">{{ wf.name }}</span>
                <el-tooltip
                  v-if="wf.official"
                  content="Reviewed and validated by Pennsieve."
                  placement="top"
                >
                  <span class="official-mark" @click.stop>
                    <IconPennsieveMark :width="14" :height="14" color="currentColor" />
                  </span>
                </el-tooltip>
                <span v-if="!wf.isActive" class="wf-badge">Inactive</span>
                <span v-else-if="wf.visibility === 'public' && !wf.official" class="wf-badge">Public</span>
              </div>
              <p class="wf-description">{{ cardText(wf) || "No description." }}</p>
              <div class="wf-io">{{ ioSummary(wf, targetTypes) }}</div>
              <!-- Its tags, a few, in their domains' colours; the steps are
                   found by search and seen on the card's graph. Without tags
                   of its own, what its apps are for, dashed: why a chip
                   filter finds it, and that it can be given its own. -->
              <div v-if="wf.tags?.length" class="wf-tags">
                <span v-for="t in wf.tags.slice(0, 4)" :key="t" class="wf-tag" :style="tagStyle(t)">{{ t }}</span>
                <span v-if="wf.tags.length > 4" class="wf-tag">+{{ wf.tags.length - 4 }}</span>
              </div>
              <div v-else-if="inheritedTags(wf, applications).length" class="wf-tags">
                <span
                  v-for="t in inheritedTags(wf, applications).slice(0, 4)"
                  :key="t"
                  class="wf-tag wf-tag--inherited"
                  :style="tagStyle(t, true)"
                  title="From its apps. Edit the workflow to give it tags of its own."
                >{{ t }}</span>
              </div>
              <div class="wf-foot">
                <span class="wf-usage">
                  <span class="last-run-dot" :class="lastRunInfo(wf).statusKey" />
                  <span class="wf-usage-text">{{ usageLine(wf, formatRelativeTime) }}</span>
                </span>
                <span class="wf-actions" @click.stop>
                  <button type="button" class="wf-action" @click="goToDetail(wf)">Open</button>
                  <el-tooltip
                    v-if="examples[wf.uuid]"
                    :content="`${cardExampleLabel(examples[wf.uuid])}: a PDF summary of a run`"
                    placement="top"
                  >
                    <button
                      type="button"
                      class="wf-action wf-action--icon"
                      :aria-label="`${exampleLabel(examples[wf.uuid])}: a PDF summary of a run (opens in a new tab)`"
                      @click="openExample(wf)"
                    >
                      <IconPDF :width="16" :height="16" color="currentColor" />
                    </button>
                  </el-tooltip>
                  <button v-if="wf.isActive" type="button" class="wf-action wf-action--run" @click="runWorkflow(wf)">
                    ▶ Run
                  </button>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <IconAnalysis :width="48" :height="48" color="#9ca3af" />
          <span v-if="isLoadingAll">Loading workflows...</span>
          <template v-else-if="workflows.length === 0">
            <span>No workflows yet</span>
            <button type="button" class="clear-filters" @click="router.replace({ query: { ...route.query, view: 'builder' } })">Build one in the Builder</button>
          </template>
          <span v-else-if="searchQuery">
            No workflows match
            <strong>"{{ searchQuery }}"</strong>
          </span>
          <span v-else>No workflows match your filters</span>
          <button v-if="filtersSet" type="button" class="clear-filters" @click="clearFilters">Clear search and filters</button>
        </div>

        <el-pagination
          v-if="filteredWorkflows.length > 0"
          class="workflows-pagination"
          :page-size="pageSize"
          :pager-count="5"
          :current-page="currentPage"
          layout="prev, pager, next"
          :total="filteredWorkflows.length"
          @current-change="onPageChange"
        />
      </div>
    </div>
    <RunWizardDialog ref="runDialog" />
    <SampleOutputViewer
      v-model="viewer.open"
      :source="viewer.source"
      :workflow-name="viewer.name"
      :version="viewer.version"
      :subtitle="viewer.subtitle"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../WorkflowBuilder/sidePanel";
@use "../../../styles/element/input";

/* Lined up with the toolbar above and the Analysis tabs (32px). */
.workflows-container {
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
  }

  .info-card-actions {
    margin-top: 16px;
  }
}

.workflows-section {
  margin-bottom: 48px;
}

.workflows-section-header {
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

/* Filters on the left, as the builder's side panels: 232px open, a 30px
   rail folded (_sidePanel.scss); the list takes the rest. */
.library-layout {
  display: flex;
  align-items: stretch;
  gap: 24px;
  min-width: 0;
}
.library-panel {
  flex: 0 0 232px;
  width: 232px;
  min-width: 0;
  box-sizing: border-box;
  align-self: flex-start;
  padding: 0 16px 12px 0;
  border-right: 1px solid theme.$gray_2;
}
/* The rail starts level with the search, its arrow on the search's middle
   (the panel's header row is as tall as the search). */
.library-rail {
  align-self: stretch;
  margin: 0;
  padding-top: 13px;
}
.rail-count,
.filters-count {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: theme.$purple_3;
  color: theme.$white;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}
/* Shrinks with the panel open (min-width: 0); the cards size to it, not
   to the viewport (container). */
.library-main {
  flex: 1 1 0;
  min-width: 0;
  container-type: inline-size;
}

/* The search, up to Sort. */
.list-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.toolbar-search {
  flex: 1;
  min-width: 0;
}
/* Filters opens the drawer, on a phone only. */
.filters-button {
  display: none;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
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
  width: 160px;
}
/* A phone: the panel is a drawer; the list fills the width. */
@media (max-width: 767px) {
  .workflows-container {
    padding: 16px;
  }
  .library-layout {
    display: block;
  }
  .library-panel,
  .library-rail {
    display: none;
  }
  .filters-button {
    display: inline-flex;
  }
  .list-toolbar {
    gap: 8px;
  }
  /* The select alone says what it sorts by. */
  .toolbar-sort {
    font-size: 0;
  }
  .sort-select {
    width: 130px;
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

/* The facets set, each removable; nothing when none is. */
.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: -4px 0 16px;
}
.active-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 4px 2px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 12px;
  color: theme.$gray_6;
}
.active-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: none;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    background: theme.$gray_2;
    color: theme.$purple_3;
  }
}

.scope-hint {
  margin: -8px 0 16px;
  font-size: 12px;
  color: theme.$gray_5;
  line-height: 1.4;
}

$card-height: 172px;

/* Wide cards, two to a row where they fit, of one height with a square
   graph, as the apps' (ApplicationsGrid): the rows line up. */
.workflows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(520px, 100%), 1fr));
  gap: 16px;
}

.wf-card {
  display: flex;
  /* At least this tall; a narrow card's footer may wrap to a second line
     (cards in a row stay one height). */
  min-height: $card-height;
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
  &:hover .wf-actions,
  &:focus-within .wf-actions {
    opacity: 1;
  }
  &.is-inactive {
    opacity: 0.7;
  }
}
/* The graph, on the builder's dotted canvas. */
.wf-thumb {
  flex: 0 0 $card-height;
  box-sizing: border-box;
  padding: 8px;
  border-right: 1px solid theme.$gray_2;
  background-color: theme.$gray_1;
  background-image: radial-gradient(theme.$gray_3 1px, transparent 1px);
  background-size: 12px 12px;
}
.wf-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 14px 16px 12px;
}
.wf-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.wf-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
/* What the card is (public, archived…), in its top-right corner: the
   badges line up down the grid. */
.wf-badge {
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
.wf-description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.wf-io {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_6;
}
/* One line: the first apps, then +n. */
/* The workflow's tags, a few, in their domains' colours (grey without one);
   the rest are found by search. */
.wf-tags {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.wf-tag {
  flex-shrink: 0;
  /* A pixel more below than above: the font's ascent outweighs its descent,
     so lowercase text sits low in an evenly padded box. */
  padding: 1px 8px 3px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 11px;
  line-height: 1.4;
  color: theme.$gray_5;
}
/* Inherited from the apps: outlined, not filled, in the same colours. */
.wf-tag--inherited {
  border-style: dashed;
  border-color: theme.$gray_3;
  background: transparent;
}
.wf-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  row-gap: 6px;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
}
/* The usage, then the buttons; narrow, the buttons go to a line of their
   own (right) and the usage wraps rather than being cut. */
.wf-usage {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.wf-usage-text {
  overflow-wrap: anywhere;
}
.wf-actions {
  display: flex;
  flex-shrink: 0;
  margin-left: auto;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.wf-action {
  white-space: nowrap;
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.wf-action--icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 6px;
}
.wf-action--run {
  border-color: theme.$purple_3;
  background: theme.$purple_3;
  color: theme.$white;

  &:hover {
    background: theme.$purple_2;
    color: theme.$white;
  }
}
/* A phone: a smaller graph, so the text keeps room. */
@media (max-width: 479px) {
  .wf-thumb {
    flex-basis: 112px;
  }
}
@media (hover: none) {
  .wf-actions {
    opacity: 1;
  }
}

.wf-description {
  /* Two whole lines: the card has a fixed height, and shrinking the
     description to fit cut its second line in half. */
  flex-shrink: 0;
  font-size: 13px;
  color: theme.$gray_5;
  margin: 2px 0 4px 0;
  line-height: 1.4;
  word-break: break-word;
}

/* A card's last run, as a dot by its usage line. */
.last-run-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: theme.$gray_4;

  &.enabled { background: theme.$status_green; }
  &.pending { background: #f59e0b; }
  &.failed { background: theme.$status_red; }
}
/* Pennsieve's mark sits where the other badges do, in the top-right corner. */
.official-mark {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;
  color: theme.$purple_3;
}
.official-mark + .wf-badge {
  margin-left: 0;
}

.workflows-pagination {
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
