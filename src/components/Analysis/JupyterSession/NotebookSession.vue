<script setup>
// Dedicated interactive-notebook page for a workflow run. It lives inside the
// platform chrome (BfNavigation left menu stays intact) but is its OWN page —
// not a child of Analysis — so it does not inherit the Analysis tab bar
// (Runs/Workflows/...). A simple BfRafter breadcrumb provides "back to the run".
// The live kernel lifecycle lives in JupyterSession.vue + useJupyterSession.
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import BfPage from "../../layout/BfPage/BfPage.vue";
import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import OrgBreadcrumb from "../../shared/OrgBreadcrumb/OrgBreadcrumb.vue";
import JupyterSession from "./JupyterSession.vue";
import { useGetToken } from "@/composables/useGetToken";

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
  resolveRunName();
});

// The notebook is named after its workflow run, so the breadcrumb's final crumb
// (and page title) shows the run name. Prefer an already-loaded run from the
// store (navigating in from the Notebooks/Runs list), otherwise fetch the run
// record directly. Falls back to "Notebook" until/unless a name is available.
const runName = ref("");
async function resolveRunName() {
  const id = resolvedRunId.value;
  if (!id) return;
  const cached = (store.getters["analysisModule/workflowInstances"] || []).find(
    (r) => r.uuid === id
  );
  if (cached?.name) {
    runName.value = cached.name.trim();
    return;
  }
  try {
    const token = await useGetToken();
    const url = `${store.state.config.api2Url}/compute/workflows/runs/${id}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return;
    const run = await resp.json();
    if (typeof run?.name === "string") runName.value = run.name.trim();
  } catch {
    /* best-effort: leave the default "Notebook" title */
  }
}
onBeforeUnmount(() => {
  store.dispatch("condensePrimaryNav", prevNavCondensed);
});

// Workspace › Analysis › Notebooks › Notebook (the Notebooks crumb links back to
// the Notebooks tab). Every route is fully-qualified with orgId — vue-router does
// not inherit params for named-route links, so omitting it throws "Missing
// required param orgId".
const workspaceRoute = computed(() => ({
  name: "datasets-list",
  params: { orgId: resolvedOrgId.value },
}));
const crumbs = computed(() => [
  {
    name: "Notebooks",
    route: { name: "notebooks", params: { orgId: resolvedOrgId.value } },
  },
  { name: runName.value || "Notebook" },
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
