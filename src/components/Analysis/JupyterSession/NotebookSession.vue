<script setup>
// Dedicated interactive-notebook page for a workflow run. It lives inside the
// platform chrome (BfNavigation left menu stays intact) but is its OWN page —
// not a child of Analysis — so it does not inherit the Analysis tab bar
// (Runs/Workflows/...). A simple BfRafter breadcrumb provides "back to the run".
// The live kernel lifecycle lives in JupyterSession.vue + useJupyterSession.
import { computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import BfPage from "../../layout/BfPage/BfPage.vue";
import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../shared/OrgBreadcrumb/OrgBreadcrumb.vue";
import JupyterSession from "./JupyterSession.vue";

const props = defineProps({
  // Passed by the router (props: { page: true }); falls back to the route, then
  // to the active organization in the store.
  orgId: { type: String, default: "" },
  runId: { type: String, default: "" },
});

const route = useRoute();
const store = useStore();
const resolvedOrgId = computed(
  () =>
    props.orgId ||
    route.params.orgId ||
    store.state.activeOrganization?.organization?.id ||
    ""
);
const resolvedRunId = computed(() => props.runId || route.params.runId || "");

// The notebook wants the horizontal room, so collapse the primary nav while it's
// open — but remember the user's prior state and restore it on leave so we don't
// permanently change their preference.
let prevNavCondensed = false;
onMounted(() => {
  prevNavCondensed = store.state.primaryNavCondensed;
  store.dispatch("condensePrimaryNav", true);
});
onBeforeUnmount(() => {
  store.dispatch("condensePrimaryNav", prevNavCondensed);
});

// Analysis › Runs › this run › Notebook (the run crumb links back to the run).
// Every route is fully-qualified with orgId — vue-router does not inherit params
// for named-route links, so omitting it throws "Missing required param orgId".
const workspaceRoute = computed(() => ({
  name: "datasets-list",
  params: { orgId: resolvedOrgId.value },
}));
const crumbs = computed(() => [
  { name: "Runs", route: { name: "runs", params: { orgId: resolvedOrgId.value } } },
  {
    name: "Run Details",
    route: {
      name: "run-detail",
      params: { orgId: resolvedOrgId.value, runId: resolvedRunId.value },
    },
  },
  { name: "Notebook" },
]);
</script>

<template>
  <bf-page>
    <bf-rafter slot="heading" class="primary" :org-id="resolvedOrgId">
      <template #breadcrumb>
        <org-breadcrumb
          v-if="resolvedOrgId"
          page-name="Analysis"
          :crumbs="crumbs"
          :page-route="{ name: 'runs', params: { orgId: resolvedOrgId } }"
          :workspace-route="workspaceRoute"
        />
      </template>
    </bf-rafter>

    <div class="notebook-stage">
      <JupyterSession v-if="resolvedRunId" :run-id="resolvedRunId" />
      <p v-else class="notebook-stage__error">No run specified.</p>
    </div>
  </bf-page>
</template>

<style scoped>
.notebook-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.notebook-stage__error {
  padding: 20px;
  color: #c14d49;
}
</style>
