<script setup>
// The Workflows tab: Live, the workflow runs going on and before (without
// standalone notebook sessions; "Include notebooks" brings them back, e.g. to
// compare costs); Library, the workflows to run (your own and public ones;
// notebooks start on the Notebooks tab, so they aren't listed); and Builder,
// the canvas for a new workflow. The view is in the URL (?view=library,
// ?view=builder), else the view last used in this browser, else, on a first
// visit, Live when the workspace has runs and the Library when it has none.
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import { useGetToken } from "@/composables/useGetToken";
import BfButton from "../../shared/bf-button/BfButton.vue";
import RunsOverview from "../RunMonitor/RunsOverview.vue";
import WorkflowBuilder from "../WorkflowBuilder/WorkflowBuilder.vue";
import WorkflowsGrid from "./WorkflowsGrid.vue";
import { workflowsView, WORKFLOW_VIEWS } from "./galleryFilter";
import AnalysisViewBar from "../AnalysisViewBar.vue";
import RunWizardDialog from "../RunMonitor/RunWizardDialog.vue";

const route = useRoute();
const router = useRouter();
const store = useStore();

const VIEWS = WORKFLOW_VIEWS;
// The view last used here, for a visit without ?view (kept in this browser).
const VIEW_KEY = "pennsieve.workflows.view";
const lastView = () => {
  try {
    return localStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
};
// A first visit (no ?view, no view last used) waits for whether the
// workspace has runs, to open on Live or the Library (null until known).
const firstVisit = !route.query.view && !lastView();
const hasRuns = ref(firstVisit ? null : false);
onMounted(async () => {
  if (!firstVisit) return;
  try {
    const orgId = store.state.activeOrganization?.organization?.id;
    const params = new URLSearchParams({ limit: "1" });
    if (orgId) params.set("organization_id", orgId);
    const resp = await fetch(`${store.state.config.api2Url}/compute/workflows/runs?${params}`, {
      headers: { Authorization: `Bearer ${await useGetToken()}` },
    });
    const body = resp.ok ? await resp.json() : null;
    hasRuns.value = ((body?.runs || body || []).length || 0) > 0;
  } catch {
    hasRuns.value = false;
  }
});
const view = computed({
  // A view the URL names needs no wait for whether there are runs.
  get: () =>
    hasRuns.value === null && !VIEWS.some((v) => v.key === route.query.view)
      ? null
      : workflowsView(route.query.view, lastView(), hasRuns.value ?? false),
  set: (v) => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // not remembered; the URL still says it
    }
    router.replace({ query: { ...route.query, view: v } });
  },
});

const includeNotebooks = computed({
  get: () => route.query.notebooks === "1",
  set: (on) => router.replace({ query: { ...route.query, notebooks: on ? "1" : undefined } }),
});

const runsRef = ref(null);

// A link with ?run=<workflow> opens the run dialog on it, over whichever
// view is showing; the query goes, so a reload doesn't open it again.
const runDialog = ref(null);
async function openRunFromQuery() {
  const id = route.query.run;
  if (!id) return;
  const { run, ...rest } = route.query;
  await router.replace({ query: rest });
  runDialog.value?.open(String(id));
}
onMounted(openRunFromQuery);
watch(() => route.query.run, openRunFromQuery);
</script>

<template>
  <div class="wf-page">
    <AnalysisViewBar v-model="view" :views="VIEWS">
      <!-- Each view's primary action, in one place: running a workflow,
           making one (the Builder, on its start screen), saving it. -->
      <bf-button v-if="view === 'live'" @click="runsRef?.openWizardDialog()">+ Run Workflow</bf-button>
      <bf-button v-else-if="view === 'library'" @click="view = 'builder'">+ New Workflow</bf-button>
      <span v-else-if="view === 'builder'" id="wf-builder-save" class="wf-builder-save" />
    </AnalysisViewBar>
    <!-- The builder's bar (name, readiness, Save): its own row over the
         canvas; the views are on the tab row. -->
    <div v-if="view === 'builder'" id="wf-toolbar-builder" class="wf-builder-bar" />
    <!-- Nothing until a first visit knows whether to open on Live -->
    <div v-if="view" class="wf-body">
      <div v-if="view === 'library'" class="wf-library">
        <!-- Include notebooks is in its filter panel -->
        <WorkflowsGrid v-model:include-notebooks="includeNotebooks" embedded />
      </div>
      <RunsOverview
        v-else-if="view === 'live'"
        ref="runsRef"
        embedded
        :exclude-notebooks="!includeNotebooks"
        notebooks-toggle
        @update:exclude-notebooks="(v) => (includeNotebooks = !v)"
        @open-library="view = 'library'"
      />
      <div v-else class="wf-builder">
        <WorkflowBuilder toolbar-target="#wf-toolbar-builder" save-target="#wf-builder-save" />
      </div>
    </div>
    <RunWizardDialog ref="runDialog" />
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.wf-page {
  height: calc(100vh - 112px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* The builder's bar, over the canvas. */
.wf-builder-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  box-sizing: border-box;
  height: 56px;
  padding: 0 32px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$white;
}
.wf-builder-save {
  display: inline-flex;
}
.wf-body {
  flex: 1;
  min-height: 0;
}
.wf-library {
  height: 100%;
  overflow-y: auto;
}
.wf-builder {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
