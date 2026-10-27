<script setup>
// The Workflows tab: Live, the workflow runs going on and before (without
// standalone notebook sessions; "Include notebooks" brings them back, e.g. to
// compare costs); Library, the workflows to run (your own and public ones;
// notebooks start on the Notebooks tab, so they aren't listed); and Builder,
// the canvas for a new workflow. The view is in the URL (?view=library,
// ?view=builder), else the view last used in this browser, else, on a first
// visit, Live when the workspace has runs and the Library when it has none.
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import { useGetToken } from "@/composables/useGetToken";
import BfButton from "../../shared/bf-button/BfButton.vue";
import RunsOverview from "../RunMonitor/RunsOverview.vue";
import WorkflowBuilder from "../WorkflowBuilder/WorkflowBuilder.vue";
import WorkflowsGrid from "./WorkflowsGrid.vue";
import { workflowsView, WORKFLOW_VIEWS } from "./galleryFilter";
import AnalysisViewBar from "../AnalysisViewBar.vue";

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
  get: () => (hasRuns.value === null ? null : workflowsView(route.query.view, lastView(), hasRuns.value)),
  set: (v) => {
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // not remembered; the URL still says it
    }
    router.replace({ query: { ...route.query, view: v } });
  },
});
const newWorkflow = () => (view.value = "builder");

const includeNotebooks = computed({
  get: () => route.query.notebooks === "1",
  set: (on) => router.replace({ query: { ...route.query, notebooks: on ? "1" : undefined } }),
});

const runsRef = ref(null);

// A Library card's Run (?run=<workflow>) switches to Live with the wizard open
// on it; the query goes, so a reload doesn't open it again.
async function openRunFromQuery() {
  const id = route.query.run;
  if (!id) return;
  if (view.value !== "live") view.value = "live";
  await nextTick();
  runsRef.value?.openWizardDialog(String(id));
  const { run, ...rest } = route.query;
  router.replace({ query: rest });
}
onMounted(openRunFromQuery);
watch(() => route.query.run, openRunFromQuery);
</script>

<template>
  <div class="wf-page">
    <AnalysisViewBar v-model="view" :views="VIEWS" :class="{ 'wf-toolbar--builder': view === 'builder' }">
      <bf-button v-if="view === 'library'" @click="newWorkflow">+ New Workflow</bf-button>
      <div v-else-if="view === 'live'" class="wf-actions">
        <el-checkbox v-model="includeNotebooks" size="small">Include notebooks</el-checkbox>
        <bf-button @click="runsRef?.openWizardDialog()">+ Run Workflow</bf-button>
      </div>
      <!-- The builder's bar (name, readiness, Save) goes here, so the canvas
           starts right below one bar. -->
      <div v-else id="wf-toolbar-builder" class="wf-builder-bar" />
    </AnalysisViewBar>
    <!-- Nothing until a first visit knows whether to open on Live -->
    <div v-if="view" class="wf-body">
      <div v-if="view === 'library'" class="wf-library">
        <WorkflowsGrid embedded />
      </div>
      <RunsOverview
        v-else-if="view === 'live'"
        ref="runsRef"
        embedded
        :exclude-notebooks="!includeNotebooks"
        @open-library="view = 'library'"
      />
      <div v-else class="wf-builder">
        <WorkflowBuilder toolbar-target="#wf-toolbar-builder" />
      </div>
    </div>
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
/* No rule under the bar on Live, as on the Notebooks tab; the builder keeps
   one, where the canvas starts right below it. */
.wf-toolbar--builder {
  border-bottom: 1px solid theme.$gray_2;
}
.wf-builder-bar {
  display: flex;
  flex: 1;
  min-width: 0;
}
.wf-actions {
  display: flex;
  align-items: center;
  gap: 20px;
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
