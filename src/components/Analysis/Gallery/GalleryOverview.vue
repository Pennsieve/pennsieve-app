<script setup>
// The Gallery: what there is to use. Workflows (your own and public ones;
// opening one shows it on the canvas) and Apps (the applications workflow
// steps run). The view is in the URL (?view=apps), as on the Notebooks and
// Workflows tabs.
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import WorkflowsGrid from "../Workflows/WorkflowsGrid.vue";
import ApplicationsGrid from "../Applications/ApplicationsGrid.vue";
import AnalysisViewBar from "../AnalysisViewBar.vue";

const route = useRoute();
const router = useRouter();
const isMyWorkspace = computed(() => !route.params.orgId);
const scoped = (name) => (isMyWorkspace.value ? `my-${name}` : name);

const VIEWS = [
  { key: "workflows", label: "Workflows" },
  { key: "apps", label: "Apps" },
];
const view = computed({
  get: () => (route.query.view === "apps" ? "apps" : "workflows"),
  set: (v) => router.replace({ query: { ...route.query, view: v === "workflows" ? undefined : v } }),
});

const newWorkflow = () => router.push({ name: scoped("workflows"), query: { view: "builder" } });
const newManifest = () => router.push({ name: scoped("application-manifest-builder") });
</script>

<template>
  <div class="gallery">
    <AnalysisViewBar v-model="view" :views="VIEWS">
      <bf-button v-if="view === 'workflows'" @click="newWorkflow">+ New Workflow</bf-button>
      <!-- As + New Workflow: the Apps view's action is writing an app.yml (the
           builder links its guide; an app's own page opens it prefilled). -->
      <bf-button v-else @click="newManifest">+ New app.yml</bf-button>
    </AnalysisViewBar>
    <WorkflowsGrid v-if="view === 'workflows'" embedded />
    <ApplicationsGrid v-else embedded />
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

</style>
