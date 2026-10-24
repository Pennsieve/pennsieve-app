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
</script>

<template>
  <div class="gallery">
    <div class="gallery-toolbar">
      <div class="gallery-views" role="tablist">
        <button
          v-for="v in VIEWS"
          :key="v.key"
          role="tab"
          class="gallery-view"
          :class="{ active: view === v.key }"
          :aria-selected="view === v.key"
          @click="view = v.key"
        >
          {{ v.label }}
        </button>
      </div>
      <bf-button v-if="view === 'workflows'" @click="newWorkflow">+ New Workflow</bf-button>
      <div v-else class="gallery-links">
        Publishing an app?
        <router-link :to="{ name: scoped('application-manifest-builder') }">Manifest builder</router-link>
        ·
        <router-link :to="{ name: scoped('application-manifest-guide') }">Guide</router-link>
      </div>
    </div>
    <WorkflowsGrid v-if="view === 'workflows'" embedded />
    <ApplicationsGrid v-else embedded />
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

/* The view switch on the left, the view's action on the right, lined up with
   the Analysis tabs (32px); as on the Notebooks and Workflows tabs. */
.gallery-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 32px;
  background: theme.$white;
}
.gallery-views {
  display: inline-flex;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.gallery-view {
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
.gallery-links {
  font-size: 13px;
  color: theme.$gray_4;

  a {
    color: theme.$link-color;
    text-decoration: none;

    &:hover {
      color: theme.$link-color-hover;
    }
  }
}
</style>
