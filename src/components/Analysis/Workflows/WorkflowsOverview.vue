<script setup>
// The Workflows tab: Live, the workflow runs going on and before (the former
// Runs page, without standalone notebook sessions, which are on the
// Notebooks tab; "Include notebooks" brings them back, e.g. to compare
// costs), and Builder, the canvas for a new workflow. The list of workflows
// is in the Gallery. Both choices are in the URL (?view=builder,
// ?notebooks=1), as on the Notebooks tab.
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import RunsOverview from "../RunMonitor/RunsOverview.vue";
import WorkflowBuilder from "../WorkflowBuilder/WorkflowBuilder.vue";

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
</script>

<template>
  <div class="wf-page">
    <div class="wf-toolbar">
      <div class="wf-views" role="tablist">
        <button
          v-for="v in VIEWS"
          :key="v.key"
          role="tab"
          class="wf-view"
          :class="{ active: view === v.key }"
          :aria-selected="view === v.key"
          @click="view = v.key"
        >
          {{ v.label }}
        </button>
      </div>
      <div class="wf-actions">
        <el-checkbox v-if="view === 'live'" v-model="includeNotebooks" size="small">Include notebooks</el-checkbox>
        <bf-button v-if="view === 'live'" @click="runsRef?.openWizardDialog()">Run Workflow</bf-button>

      </div>
    </div>
    <div class="wf-body">
      <RunsOverview v-if="view === 'live'" ref="runsRef" embedded :exclude-notebooks="!includeNotebooks" />
      <div v-else class="wf-builder">
        <WorkflowBuilder />
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
/* The view switch on the left, the view's action on the right, lined up
   with the Analysis tabs (32px); as on the Notebooks tab. */
.wf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 32px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$white;
}
.wf-views {
  display: inline-flex;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.wf-view {
  padding: 5px 14px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
  &.active {
    background: theme.$white;
    color: theme.$purple_3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
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
