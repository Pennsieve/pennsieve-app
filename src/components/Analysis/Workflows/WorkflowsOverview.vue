<script setup>
// Two sections of Analysis: Runs (section="runs": the workflow runs going on
// and before, without standalone notebook sessions; "Include notebooks"
// brings them back, e.g. to compare costs) and Workflows (the Library, the
// workflows to run: your own and public ones; notebooks start on the
// Notebooks section, so they aren't listed; and the Builder, the canvas for
// a new workflow, at ?view=builder). An older link to Workflows' Live
// (?view=live) goes to Runs.
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import RunsOverview from "../RunMonitor/RunsOverview.vue";
import WorkflowBuilder from "../WorkflowBuilder/WorkflowBuilder.vue";
import WorkflowsGrid from "./WorkflowsGrid.vue";
import AnalysisViewBar from "../AnalysisViewBar.vue";
import RunWizardDialog from "../RunMonitor/RunWizardDialog.vue";

const props = defineProps({
  section: { type: String, default: "workflows" }, // "workflows" | "runs"
});

const route = useRoute();
const router = useRouter();

// My Analysis's routes are the workspace's prefixed "my-".
const routeName = (name) => ((route.name || "").startsWith("my-") ? `my-${name}` : name);

if (props.section === "workflows" && route.query.view === "live") {
  const { view: _view, ...rest } = route.query;
  router.replace({ name: routeName("runs"), query: rest });
}

const view = computed({
  get: () => (props.section === "runs" ? "live" : route.query.view === "builder" ? "builder" : "library"),
  set: (v) => {
    if (v === "live") {
      router.push({ name: routeName("runs") });
      return;
    }
    const { view: _view, ...rest } = route.query;
    router.replace({ query: v === "builder" ? { ...rest, view: "builder" } : rest });
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
    <!-- No views of its own (Runs and Workflows are sections). The Builder
         has no content row (its canvas): its Save stays on the title row. -->
    <AnalysisViewBar v-model="view" :actions-at="view === 'builder' ? 'title' : ''">
      <!-- Each view's primary action: running a workflow, making one (the
           Builder, on its start screen), saving it. -->
      <bf-button v-if="view === 'live'" @click="runsRef?.openWizardDialog()">+ Run Workflow</bf-button>
      <bf-button v-else-if="view === 'library'" @click="view = 'builder'">+ New Workflow</bf-button>
      <span v-else-if="view === 'builder'" id="wf-builder-save" class="wf-builder-save" />
    </AnalysisViewBar>
    <!-- The builder's bar (name, readiness, Save): its own row over the
         canvas. -->
    <div v-if="view === 'builder'" id="wf-toolbar-builder" class="wf-builder-bar" />
    <div class="wf-body">
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
        @open-library="router.push({ name: routeName('workflows') })"
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
  height: calc(100vh - var(--analysis-stage-top, 112px));
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
/* Empty on the Builder's start screen: no band until it has a workflow's
   name and Save. */
.wf-builder-bar:empty {
  display: none;
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
