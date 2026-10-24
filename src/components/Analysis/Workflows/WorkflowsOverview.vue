<script setup>
// The Workflows tab: Live, the workflow runs going on and before (the former
// Runs page, without standalone notebook sessions, which are on the
// Notebooks tab; "Include notebooks" brings them back, e.g. to compare
// costs), and Builder, the canvas for a new workflow. The list of workflows
// is in the Gallery. Both choices are in the URL (?view=builder,
// ?notebooks=1), as on the Notebooks tab.
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import RunsOverview from "../RunMonitor/RunsOverview.vue";
import WorkflowBuilder from "../WorkflowBuilder/WorkflowBuilder.vue";
import AnalysisViewBar from "../AnalysisViewBar.vue";

const route = useRoute();
const router = useRouter();

const VIEWS = [
  { key: "live", label: "Live" },
  { key: "builder", label: "Builder" },
];
const view = computed({
  get: () => (route.query.view === "builder" ? "builder" : "live"),
  set: (v) => router.replace({ query: { ...route.query, view: v === "live" ? undefined : v } }),
});

const includeNotebooks = computed({
  get: () => route.query.notebooks === "1",
  set: (on) => router.replace({ query: { ...route.query, notebooks: on ? "1" : undefined } }),
});

const runsRef = ref(null);

// A Gallery card's Run lands here with ?run=<workflow>: the wizard opens on
// it, and the query goes, so a reload doesn't open it again.
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
      <div v-if="view === 'live'" class="wf-actions">
        <el-checkbox v-model="includeNotebooks" size="small">Include notebooks</el-checkbox>
        <bf-button @click="runsRef?.openWizardDialog()">+ Run Workflow</bf-button>
      </div>
      <!-- The builder's bar (name, readiness, Save) goes here, so the canvas
           starts right below one bar. -->
      <div v-else id="wf-toolbar-builder" class="wf-builder-bar" />
    </AnalysisViewBar>
    <div class="wf-body">
      <RunsOverview v-if="view === 'live'" ref="runsRef" embedded :exclude-notebooks="!includeNotebooks" />
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
.wf-builder {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
