<script>
import { createExampleCache } from "./runExamples";
import { exampleUnavailable } from "@/store/analysisModule";

// The cards' examples, shared by the library's visits in this page load
// (module scope), so where the feature isn't served it's found out once.
const exampleCache = createExampleCache(exampleUnavailable);
</script>

<script setup>
import { computed, ref, watch, onMounted } from "vue";
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
import { activeFilters, applyFilters, domainOptions, FACET_DEFAULTS, INPUT_OPTIONS, VISIBILITY_OPTIONS, fieldOptions, inheritedTags, tagOptions, libraryWorkflows, mergeWorkflows, outputOptions, sortWorkflows, SORTS } from "./galleryFilter";
import { useGetToken } from "@/composables/useGetToken";
import { isNotebookWorkflow } from "../RunMonitor/notebookHelpers";
import { exampleLabel, exampleVersion, PDF_URL_FRESH_MS } from "./runExamples";
import SampleOutputViewer from "./SampleOutputViewer.vue";
import { workflowReportNote } from "./reportNote";
import FacetLayout from "../Facets/FacetLayout.vue";
import ContentIntro from '@/components/shared/ContentIntro/ContentIntro.vue';
import FacetSection from "../Facets/FacetSection.vue";
import FacetOptions from "../Facets/FacetOptions.vue";
import FacetRadios from "../Facets/FacetRadios.vue";
import FacetCheck from "../Facets/FacetCheck.vue";
import CardTags from "../Facets/CardTags.vue";
import { domainFacetOptions, fieldFacetOptions, toggleKey } from "../Facets/facets";

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
// As the Apps tab's: all (this workspace's and the public ones), public or
// private; and only those Pennsieve has reviewed.
const visibilityFilter = ref(FACET_DEFAULTS.visibility); // "all" | "public" | "private"
const officialFilter = ref(FACET_DEFAULTS.official);
const inputFilter = ref("any"); // "any" | "dataset" | "none"
const outputFilter = ref("any"); // "any" | a target type
const domainFilter = ref([]); // domains' keys (any of them); none: all
const fieldFilter = ref([]); // research fields' keys (any of them); none: all
const tagFilter = ref([]); // other tags' keys (any of them); none: all

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

// This workspace's workflows (in My Workspace, your own), as the store has
// them for the other tabs, and the public ones, loaded here: the Library is
// both, each once, so a new workspace's isn't empty.
const ownWorkflows = computed(
  () => store.state.analysisModule.workflows || []
);
const publicWorkflows = ref([]);
const workflows = computed(() => mergeWorkflows(ownWorkflows.value, publicWorkflows.value));
const ownIds = computed(() => new Set(ownWorkflows.value.map((wf) => wf.uuid)));
// What the cards name: target types (outputs) and applications (steps).
const targetTypes = computed(() => store.getters["analysisModule/targetTypes"] || []);
const applications = computed(() => store.getters["analysisModule/applications"] || []);
const nextCursor = computed(
  () => store.state.analysisModule.workflowsNextCursor || ""
);

const outputChoices = computed(() => outputOptions(workflows.value, targetTypes.value));
// What the workflows are for (their tags' domains, and their apps'), with
// their domains' colours, and the research fields their apps serve, as on the
// Apps tab: the panel's Domain and Field.
const domainChips = computed(() => domainOptions(libraryWorkflows(workflows.value), applications.value));
const fieldChips = computed(() => fieldOptions(libraryWorkflows(workflows.value), applications.value));
// Their other tags, each on two or more workflows: the panel's Tags.
const tagFacets = computed(() => tagOptions(libraryWorkflows(workflows.value), applications.value));

// The facets set, as removable chips over the cards; Clear all resets them.
const facetRefs = { visibility: visibilityFilter, official: officialFilter, domain: domainFilter, field: fieldFilter, tag: tagFilter, input: inputFilter, output: outputFilter, status: statusFilter };
const activeChips = computed(() =>
  activeFilters(
    { visibility: visibilityFilter.value, official: officialFilter.value, domain: domainFilter.value, field: fieldFilter.value, tag: tagFilter.value, input: inputFilter.value, output: outputFilter.value, status: statusFilter.value },
    { domains: domainChips.value, fields: fieldChips.value, tags: tagFacets.value, outputs: outputChoices.value }
  )
);
// Clear a facet, or (a chip of a multi-select one) one of its keys.
const clearFacet = (key, value) =>
  (facetRefs[key].value = value === undefined ? FACET_DEFAULTS[key] : facetRefs[key].value.filter((k) => k !== value));
const removeChip = (chip) => clearFacet(chip.key, chip.value);
const clearFacets = () => Object.keys(facetRefs).forEach((key) => clearFacet(key));

// The panel's Domain and Field, one at a time (ticking a chosen one clears
// it); Show archived lists all, unticked Active.
const domainFacets = computed(() => domainFacetOptions(domainChips.value));
const fieldFacets = computed(() => fieldFacetOptions(fieldChips.value));
const toggleDomain = (key) => (domainFilter.value = toggleKey(domainFilter.value, key));
const toggleField = (key) => (fieldFilter.value = toggleKey(fieldFilter.value, key));
const toggleTag = (key) => (tagFilter.value = toggleKey(tagFilter.value, key));
const showArchived = computed({
  get: () => statusFilter.value !== FACET_DEFAULTS.status,
  set: (on) => (statusFilter.value = on ? "all" : FACET_DEFAULTS.status),
});

const filtersSet = computed(
  () =>
    !!searchQuery.value.trim() ||
    visibilityFilter.value !== FACET_DEFAULTS.visibility ||
    officialFilter.value ||
    inputFilter.value !== "any" ||
    outputFilter.value !== "any" ||
    domainFilter.value.length > 0 ||
    fieldFilter.value.length > 0 ||
    tagFilter.value.length > 0
);
function clearFilters() {
  searchQuery.value = "";
  visibilityFilter.value = FACET_DEFAULTS.visibility;
  officialFilter.value = FACET_DEFAULTS.official;
  inputFilter.value = "any";
  outputFilter.value = "any";
  domainFilter.value = [];
  fieldFilter.value = [];
  tagFilter.value = [];
}

const filteredWorkflows = computed(() =>
  sortWorkflows(
    applyFilters(libraryWorkflows(workflows.value, includeNotebooks.value), {
      query: searchQuery.value,
      input: inputFilter.value,
      output: outputFilter.value,
      domain: domainFilter.value,
      field: fieldFilter.value,
      tag: tagFilter.value,
      officialOnly: officialFilter.value,
      visibility: visibilityFilter.value,
      applications: applications.value,
      targetTypes: targetTypes.value,
    }),
    sortBy.value,
    // Recommended puts this workspace's own first.
    { applications: applications.value, ownIds: ownIds.value }
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

// This workspace's workflows, into the store (the other tabs use them).
const fetchOwnWorkflows = async () => {
  // First batch replaces, subsequent batches append.
  await store.dispatch("analysisModule/fetchWorkflows", {
    cursor: undefined,
    limit: ALL_FETCH_BATCH,
    status: getStatusParam(),
    append: false,
  });
  let safety = ALL_FETCH_CAP;
  while (nextCursor.value && safety-- > 0) {
    await store.dispatch("analysisModule/fetchWorkflows", {
      cursor: nextCursor.value,
      limit: ALL_FETCH_BATCH,
      status: getStatusParam(),
      append: true,
    });
  }
};

// The public workflows of every workspace, here only (as the store's
// fetchWorkflows asks for them, a page at a time).
const fetchPublicWorkflows = async () => {
  const token = await useGetToken();
  const list = [];
  let cursor = "";
  let safety = ALL_FETCH_CAP;
  do {
    const params = new URLSearchParams({ visibility: "public", limit: ALL_FETCH_BATCH });
    const status = getStatusParam();
    if (status) params.set("status", status);
    if (cursor) params.set("cursor", cursor);
    const resp = await fetch(`${store.state.config.api2Url}/compute/workflows/definitions?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    list.push(...(Array.isArray(result) ? result : result.workflows || []));
    cursor = Array.isArray(result) ? "" : result.nextCursor || "";
  } while (cursor && safety-- > 0);
  return list;
};

const fetchAllWorkflows = async () => {
  if (isLoadingAll.value) return;
  isLoadingAll.value = true;
  try {
    // Either can fail alone: the Library shows what came.
    const [, pub] = await Promise.allSettled([fetchOwnWorkflows(), fetchPublicWorkflows()]);
    publicWorkflows.value = pub.status === "fulfilled" ? pub.value : [];
    if (pub.status === "rejected") console.error("Failed to load public workflows:", pub.reason);
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
const viewer = ref({ open: false, source: null, name: "", version: null, subtitle: "", note: "" });
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
    note: "",
  };
  // How the report relates to the workflow's current version (an older
  // version's, or other apps'), once known.
  const shown = viewer.value;
  workflowReportNote(store, wf.uuid, cached, wf).then((note) => {
    if (viewer.value === shown) shown.note = note;
  });
};

// Re-fetch all when the status filter changes (visibility filters what's
// loaded)
watch(statusFilter, () => {
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

    <!-- The filters on the left (a rail when folded, a drawer on a phone),
         the search and Sort in one row, the chips and cards -->
    <FacetLayout
      class="workflows-section"
      storage-key="pennsieve.library.filtersPanel"
      default-folded
      :chips="activeChips"
      @remove="removeChip"
      @clear-all="clearFacets"
    >
      <template #filters>
        <FacetSection title="Visibility" :clearable="visibilityFilter !== FACET_DEFAULTS.visibility || officialFilter" @clear="clearFacet('visibility'); clearFacet('official')">
          <FacetRadios v-model="visibilityFilter" :options="VISIBILITY_OPTIONS" label="Visibility" />
          <FacetCheck v-model="officialFilter" label="Pennsieve-reviewed only" />
          <FacetCheck v-if="embedded" v-model="includeNotebooks" label="Include notebooks" />
          <FacetCheck v-model="showArchived" label="Show archived" />
        </FacetSection>
        <FacetSection v-if="domainFacets.length" title="Domain" :clearable="domainFilter.length > 0" @clear="clearFacet('domain')">
          <FacetOptions :options="domainFacets" :selected="domainFilter" @toggle="toggleDomain" />
        </FacetSection>
        <FacetSection v-if="fieldFacets.length" title="Field" :clearable="fieldFilter.length > 0" @clear="clearFacet('field')">
          <FacetOptions :options="fieldFacets" :selected="fieldFilter" @toggle="toggleField" />
        </FacetSection>
        <FacetSection v-if="tagFacets.length" title="Tags" :clearable="tagFilter.length > 0" @clear="clearFacet('tag')">
          <FacetOptions :options="tagFacets" :selected="tagFilter" variant="chips" :limit="8" @toggle="toggleTag" />
        </FacetSection>
        <FacetSection title="Input" :clearable="inputFilter !== FACET_DEFAULTS.input" @clear="clearFacet('input')">
          <el-select v-model="inputFilter" size="small" aria-label="Input">
            <el-option label="Any input" value="any" />
            <el-option v-for="o in INPUT_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </FacetSection>
        <FacetSection title="Output" :clearable="outputFilter !== FACET_DEFAULTS.output" @clear="clearFacet('output')">
          <el-select v-model="outputFilter" size="small" aria-label="Output">
            <el-option label="Any output" value="any" />
            <el-option v-for="o in outputChoices" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </FacetSection>
      </template>

      <!-- In its tab: what's listed, and the tab's actions (AnalysisViewBar) -->
      <template v-if="embedded" #intro>
        <ContentIntro actions-id="analysis-content-actions" text="Workflows chain apps into a pipeline you run on a dataset: Pennsieve's, your own and the community's." />
      </template>

      <template #toolbar>
        <el-input
          v-model="searchQuery"
          placeholder="Search by name, tag, app, input or output…"
          clearable
          class="toolbar-search"
        />
        <label class="sort-control toolbar-sort">
          Sort
          <el-select v-model="sortBy" class="sort-select">
            <el-option v-for="o in SORTS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>
      </template>

      <p v-if="officialFilter" class="scope-hint">
        Workflows Pennsieve has reviewed and validated. They can be run from any workspace.
      </p>
      <p v-else-if="visibilityFilter === 'public'" class="scope-hint">
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
            <!-- Its tags, a few, as the filter panel lists them (a domain
                 with its coloured dot, a field in grey); the steps are found
                 by search and seen on the card's graph. Without tags of its
                 own, what its apps are for, in italics: why a filter finds
                 it, and that it can be given its own. -->
            <CardTags v-if="wf.tags?.length" :tags="wf.tags" />
            <CardTags
              v-else-if="inheritedTags(wf, applications).length"
              :tags="inheritedTags(wf, applications)"
              inherited
              title="From its apps. Edit the workflow to give it tags of its own."
            />
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
    </FacetLayout>
    <RunWizardDialog ref="runDialog" />
    <SampleOutputViewer
      v-model="viewer.open"
      :source="viewer.source"
      :workflow-name="viewer.name"
      :version="viewer.version"
      :subtitle="viewer.subtitle"
      :note="viewer.note"
    />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";
@use "../../../styles/element/input";

/* No padding of its own: the filter panel (or its rail) sits against the
   page's edges; FacetLayout pads the list (20px/32px, as the Analysis tabs). */
.workflows-container {
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
  }

  .info-card-actions {
    margin-top: 16px;
  }
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

/* The search fills the toolbar's row up to Sort. */
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
  width: 160px;
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

.scope-hint {
  margin: -8px 0 16px;
  font-size: 12px;
  color: theme.$gray_5;
  line-height: 1.4;
}

$card-height: 172px;

/* Cards two or more to a row where 340px each fit (16px apart), each as
   tall as its square graph (172px; 140px in a narrow card), as the apps'
   (ApplicationsGrid): the rows line up, and the text fits the card. */
.workflows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
  gap: 16px;
}

.wf-card {
  display: flex;
  min-width: 0;
  container: wf-card / inline-size;
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
  flex: 0 0 auto;
  align-self: flex-start;
  width: $card-height;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  padding: 8px;
  border-right: 1px solid theme.$gray_2;
  background-color: theme.$gray_1;
  background-image: radial-gradient(theme.$gray_3 1px, transparent 1px);
  background-size: 12px 12px;
}
/* The text fits the graph's height: it doesn't size the card (contain),
   and what doesn't fit is cut (overflow), never the card stretched. */
.wf-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 14px 16px 12px;
  contain: size;
  overflow: hidden;
}
/* A narrow card: a smaller square, tighter text, no input/output line. */
@container wf-card (max-width: 440px) {
  .wf-thumb {
    width: 140px;
  }
  .wf-body {
    gap: 4px;
    padding: 10px 12px;
  }
  .wf-io {
    display: none;
  }
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
/* One line at the card's foot: the usage gives way (…) to the buttons,
   which always show. */
.wf-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
}
.wf-usage {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.wf-usage-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  margin: 0;
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
