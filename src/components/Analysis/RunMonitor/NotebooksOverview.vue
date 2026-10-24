<script setup>
// Notebooks tab: a focused view over interactive-notebook runs. Lists ONLY runs
// launched from the defined public notebook workflows ("Jupyter Notebook" =
// Python today), and opens the self-contained NewNotebookDialog launcher.
import {
  computed,
  ref,
  onMounted,
  onBeforeUnmount,
  getCurrentInstance,
} from "vue";
import { runScopeChannel } from "@/realtime/channels";
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import IconControllerPlay from "../../icons/IconControllerPlay.vue";
import IconXCircle from "../../icons/IconXCircle.vue";
import NewNotebookDialog from "./NewNotebookDialog.vue";
import EnvironmentsSection from "./EnvironmentsSection.vue";
import CreateEnvironmentDialog from "./CreateEnvironmentDialog.vue";
import { environmentsServiceUrl } from "@/utils/environmentsService";
import { endInteractiveSession } from "@/composables/useJupyterSession";
import { useGetToken } from "@/composables/useGetToken";
import {
  statusDotClass,
  statusLabel,
  isTerminalStatus,
  formatTime,
  runDisplayName,
  getUserName as getUserNameFn,
} from "./runHelpers";
import { isNotebookWorkflow } from "./notebookHelpers";

const store = useStore();
const router = useRouter();
const route = useRoute();
const realtime = getCurrentInstance()?.appContext.config.globalProperties.$realtime;

// Shown in a workspace (/:orgId/analysis/notebooks) and in My Workspace
// (/my-workspace/analysis/notebooks), where notebooks run on the user's own
// compute nodes and there is no dataset to pick yet.
const isMyWorkspace = computed(() => !route.params.orgId);
const notebookRoute = (runId) =>
  isMyWorkspace.value
    ? { name: "my-run-notebook", params: { runId } }
    : {
        name: "run-notebook",
        params: {
          orgId: route.params.orgId || store.state.activeOrganization?.organization?.id,
          runId,
        },
      };

/* ----------------------------------------------------------------- store ---- */
const workflowInstances = computed(
  () => store.getters["analysisModule/workflowInstances"] || []
);
const config = computed(() => store.state.config);
const profile = computed(() => store.state.profile);
const orgMembers = computed(() => store.state.orgMembers || []);
const getUserName = (userId) =>
  getUserNameFn(userId, profile.value, orgMembers.value);

/* --------------------------------------------------- notebook workflows ----- */
const notebookWorkflows = ref([]);
// Environments come from environments-service, where the site has it.
const hasEnvironments = !!environmentsServiceUrl();
const createEnvVisible = ref(false);
// Where the New environment dialog starts: empty, or an edit or retry of an
// environment (see EnvironmentsSection).
const envInitial = ref(null);
const environmentsRef = ref(null);
function openCreateEnvironment(initial = null) {
  envInitial.value = initial;
  createEnvVisible.value = true;
}
// Names the New environment dialog mustn't reuse.
const takenEnvNames = computed(() => environmentsRef.value?.ownNames || []);
// "Use in a notebook": a new notebook, where the environment is picked from
// the session's sidebar once it runs.
function onEnvUse() {
  view.value = "live";
  dialogVisible.value = true;
}
function onEnvCreated() {
  environmentsRef.value?.refresh?.();
}
const isLoading = ref(false);
const dialogVisible = ref(false);
// The sub-tab, kept in the URL so it can be linked to and survives reloads.
// Environments only where the site has environments-service.
const VIEWS = [
  { key: "live", label: "Live" },
  ...(hasEnvironments ? [{ key: "environments", label: "Environments" }] : []),
];
const view = computed({
  get: () => (hasEnvironments && route.query.view === "environments" ? "environments" : "live"),
  set: (v) => router.replace({ query: { ...route.query, view: v === "live" ? undefined : v } }),
});

const notebookWorkflowIds = computed(
  () => new Set(notebookWorkflows.value.map((w) => w.uuid))
);

async function fetchDefinitions(query) {
  const token = await useGetToken();
  const url = `${config.value.api2Url}/compute/workflows/definitions?${query}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const result = await resp.json();
  return Array.isArray(result) ? result : result.workflows || [];
}

async function fetchNotebookWorkflows() {
  try {
    const orgId = store.state.activeOrganization?.organization?.id;
    const queries = ["visibility=public"];
    if (orgId) queries.push(`organization_id=${encodeURIComponent(orgId)}`);
    const results = await Promise.allSettled(queries.map(fetchDefinitions));
    const byId = new Map();
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const wf of r.value) {
        if (wf?.uuid && !byId.has(wf.uuid)) byId.set(wf.uuid, wf);
      }
    }
    const all = [...byId.values()];
    // Require the Official flag (set by Pennsieve, not user-settable) so a workflow
    // a user merely *names* "Pennsieve - …" can't masquerade as an official kernel
    // or environment builder. Name still selects which official workflow it is.
    const official = all.filter((w) => w?.official);
    notebookWorkflows.value = official.filter(isNotebookWorkflow);
    if (notebookWorkflows.value.length === 0) {
      console.warn(
        "[Notebooks] no notebook workflows matched among",
        all.length,
        "definitions:",
        all.map((w) => w.name)
      );
    }
  } catch (err) {
    console.error("Failed to fetch notebook workflows:", err);
    notebookWorkflows.value = [];
  }
}

/* ------------------------------------------------------ notebook runs ------- */
const notebookRuns = computed(() => {
  const ids = notebookWorkflowIds.value;
  return workflowInstances.value.filter((r) => ids.has(r.workflowUuid));
});
const activeNotebookRuns = computed(() =>
  notebookRuns.value
    .filter(
      (r) =>
        r.status === "NOT_STARTED" ||
        r.status === "STARTED" ||
        r.status === "FINALIZING"
    )
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
);
// Every finished notebook loaded so far, newest first; more load on request
// (the runs list pages through all runs, notebooks among them).
const historyRuns = computed(() =>
  notebookRuns.value
    .filter((r) => isTerminalStatus(r.status))
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.startedAt) -
        new Date(a.completedAt || a.startedAt)
    )
);
const historyQuery = ref("");
const shownHistory = computed(() => {
  const q = historyQuery.value.trim().toLowerCase();
  if (!q) return historyRuns.value;
  return historyRuns.value.filter((r) => (runDisplayName(r) || "").toLowerCase().includes(q));
});
const hasMoreRuns = computed(() => !!store.getters["analysisModule/workflowInstancesCursor"]);
const loadingMore = ref(false);
async function loadMoreRuns() {
  loadingMore.value = true;
  try {
    await store.dispatch("analysisModule/fetchMoreWorkflowInstances");
  } catch (err) {
    console.error("Failed to load more notebooks:", err);
  } finally {
    loadingMore.value = false;
  }
}

// After a notebook is created, open its notebook page straight away — it shows
// the "waiting for the kernel" empty state while the session task launches.
// The createRun POST response shape differs from the runs summary and may not
// carry a usable run id, so we identify the new run by set difference: snapshot
// the run ids before refetching, then pick the one that appears afterward (the
// list always has a real `uuid`). Falls back to a direct id or name match.
const onNotebookCreated = async (newRun) => {
  const before = new Set(
    (store.getters["analysisModule/workflowInstances"] || [])
      .map((r) => r.uuid)
      .filter(Boolean)
  );
  await store.dispatch("analysisModule/fetchWorkflowInstances");
  const instances = store.getters["analysisModule/workflowInstances"] || [];

  const fresh = instances.filter((r) => r.uuid && !before.has(r.uuid));
  const directId = newRun?.uuid || newRun?.id || newRun?.runId;
  const run =
    fresh.find((r) => r.name === newRun?.name) ||
    fresh[0] ||
    (directId && instances.find((r) => r.uuid === directId)) ||
    (newRun?.name &&
      instances
        .filter((r) => r.name === newRun.name)
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0]);

  if (!run?.uuid) {
    console.warn("[Notebooks] could not resolve created run id from", newRun);
    return;
  }

  router.push(notebookRoute(run.uuid));
};

/* ----------------------------------------------------------- navigation ----- */
// My Workspace has no run detail page yet; a run opens its notebook there.
const selectRun = (run) => {
  if (isMyWorkspace.value) {
    router.push(notebookRoute(run.uuid));
    return;
  }
  router.push({ name: "run-detail", params: { runId: run.uuid } });
};
const openNotebook = (run) => {
  router.push(notebookRoute(run.uuid));
};
// End a notebook session, confirmed via the in-app Pennsieve dialog (not the
// browser prompt). `endRun` opens the dialog; `confirmEndRun` does the work.
const endingRunId = ref(null);
const confirmEndRun = ref(null);
const endRunError = ref("");
const endRun = (run) => {
  if (endingRunId.value) return;
  endRunError.value = "";
  confirmEndRun.value = run;
};
const confirmEndSession = async () => {
  const run = confirmEndRun.value;
  if (!run || endingRunId.value) return;
  endingRunId.value = run.uuid;
  endRunError.value = "";
  try {
    await endInteractiveSession(run.uuid);
    confirmEndRun.value = null;
  } catch (e) {
    endRunError.value = e?.message || "Could not end the notebook session.";
  } finally {
    endingRunId.value = null;
  }
};

/* -------------------------------------------------- live updates / lifecycle */
const parseEventData = (data) => {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
};
const onRunStatusUpdate = (raw) => {
  const data = parseEventData(raw);
  store.commit("analysisModule/UPDATE_RUN_STATUS", {
    runId: data.runId,
    status: data.status,
  });
};

let analyticsChannel = null;
onMounted(async () => {
  isLoading.value = true;
  try {
    await Promise.all([
      store.dispatch("analysisModule/fetchWorkflowInstances"),
      // Forced in My Workspace: the cached list may be a workspace's nodes
      store.dispatch("analysisModule/fetchComputeNodes", { force: isMyWorkspace.value }),
      store.dispatch("analysisModule/fetchTargetTypes"),
      fetchNotebookWorkflows(),
    ]);
  } finally {
    isLoading.value = false;
  }
  // Live updates for every run in the workspace (or the user's own runs)
  if (realtime) {
    analyticsChannel = realtime.subscribe(
      // The route's workspace, not activeOrganization: that stays set in My
      // Workspace, where a personal run's events go to the user's channel.
      runScopeChannel(route.params.orgId, store.state.profile?.id)
    );
    analyticsChannel.bind("workflow-run-status", onRunStatusUpdate);
  }
});
onBeforeUnmount(() => {
  if (analyticsChannel) {
    analyticsChannel.unbind("workflow-run-status", onRunStatusUpdate);
    analyticsChannel.unsubscribe();
    analyticsChannel = null;
  }
});
</script>

<template>
  <div class="notebooks-container">
      <!-- Live: the notebooks running and the ones before; Environments: what
           they run with. The view is in the URL (?view=environments). -->
      <div class="nb-toolbar">
        <div class="nb-views" role="tablist">
          <button
            v-for="v in VIEWS"
            :key="v.key"
            role="tab"
            class="nb-view"
            :class="{ active: view === v.key }"
            :aria-selected="view === v.key"
            @click="view = v.key"
          >
            {{ v.label }}
          </button>
        </div>
        <bf-button v-if="view === 'live'" :disabled="notebookWorkflows.length === 0" @click="dialogVisible = true">
          + New Notebook
        </bf-button>
        <bf-button v-else @click="openCreateEnvironment()">+ New Environment</bf-button>
      </div>

      <template v-if="view === 'live'">
      <div v-if="!isLoading && notebookWorkflows.length === 0" class="empty-canvas">
        <h3>No notebook kernels available</h3>
        <p>
          A published notebook workflow (e.g. "Jupyter Notebook") must exist
          before you can start a notebook here.
        </p>
      </div>

      <template v-else>
        <div v-if="activeNotebookRuns.length > 0" class="dashboard-section">
          <h3 class="dashboard-section-title">
            <span class="active-pulse" />
            {{ activeNotebookRuns.length }} Active
            Notebook{{ activeNotebookRuns.length !== 1 ? "s" : "" }}
          </h3>
          <div class="active-runs-grid">
            <div
              v-for="run in activeNotebookRuns"
              :key="run.uuid"
              class="active-run-card"
              @click="selectRun(run)"
            >
              <div
                v-if="run.status === 'STARTED'"
                class="active-run-actions"
                @click.stop
              >
                <button
                  class="active-run-action active-run-action--end"
                  title="End notebook session — resumes the workflow"
                  :disabled="endingRunId === run.uuid"
                  @click="endRun(run)"
                >
                  <IconXCircle :width="15" :height="15" color="#c14d49" />
                </button>
                <button
                  class="active-run-action active-run-action--play"
                  title="Open notebook"
                  @click="openNotebook(run)"
                >
                  <IconControllerPlay :width="16" :height="10" color="#011f5b" />
                </button>
              </div>
              <div class="active-run-name">
                {{ runDisplayName(run) || "Unnamed notebook" }}
              </div>
              <div class="active-run-subtitle">
                {{ getUserName(run.createdBy) }}
              </div>
              <div class="active-run-meta">
                <span class="run-status-dot" :class="statusDotClass(run.status)" />
                <span>{{ statusLabel(run.status) }}</span>
                <span class="active-run-time">{{ formatTime(run.startedAt) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-section">
          <div class="history-head">
            <h3 class="dashboard-section-title">
              {{ activeNotebookRuns.length ? "Earlier notebooks" : "Notebooks" }}
            </h3>
            <el-input
              v-if="historyRuns.length > 5"
              v-model="historyQuery"
              size="small"
              clearable
              placeholder="Search notebooks…"
              class="history-search"
            />
          </div>
          <p v-if="isLoading && !historyRuns.length" class="history-empty">Loading…</p>
          <p v-else-if="!historyRuns.length && !activeNotebookRuns.length" class="history-empty">
            No notebooks yet. Start one to work with your data interactively; it uses the packages of an environment
            you switch to from its sidebar.
          </p>
          <p v-else-if="!historyRuns.length" class="history-empty">No earlier notebooks.</p>
          <p v-else-if="!shownHistory.length" class="history-empty">No notebook matches.</p>
          <div v-else class="recent-runs-list">
            <div
              v-for="run in shownHistory"
              :key="run.uuid"
              class="recent-run-row"
              @click="selectRun(run)"
            >
              <span class="run-status-dot" :class="statusDotClass(run.status)" />
              <span class="recent-run-name">{{
                runDisplayName(run) || "Unnamed"
              }}</span>
              <span class="recent-run-status">{{ statusLabel(run.status) }}</span>
              <span class="recent-run-time">{{
                formatTime(run.completedAt || run.startedAt)
              }}</span>
            </div>
          </div>
          <button v-if="hasMoreRuns" class="history-more" :disabled="loadingMore" @click="loadMoreRuns">
            {{ loadingMore ? "Loading…" : "Load earlier notebooks" }}
          </button>
        </div>
      </template>
      </template>

      <template v-else>
        <p class="nb-view-desc">
          Python package environments for your notebooks. Build one from a requirements list, then switch to it from a
          notebook's sidebar while it runs.
        </p>
        <environments-section
          ref="environmentsRef"
          :show-title="false"
          @create="openCreateEnvironment()"
          @edit="openCreateEnvironment"
          @retry="openCreateEnvironment"
          @use="onEnvUse"
        />
      </template>

    <new-notebook-dialog
      v-model="dialogVisible"
      :notebook-workflows="notebookWorkflows"
      :personal="isMyWorkspace"
      @created="onNotebookCreated"
    />

    <create-environment-dialog
      v-model="createEnvVisible"
      :initial="envInitial"
      :taken-names="takenEnvNames"
      @created="onEnvCreated"
    />

    <!-- End-session confirmation (Pennsieve dialog, not the browser prompt) -->
    <el-dialog
      :model-value="!!confirmEndRun"
      @update:model-value="(v) => { if (!v && !endingRunId) confirmEndRun = null; }"
      title="End notebook session?"
      width="460px"
      :close-on-click-modal="!endingRunId"
      :show-close="!endingRunId"
      align-center
    >
      <p style="margin: 0; color: #4d4d4d; line-height: 1.5;">
        Ending the session shuts down the notebook kernel and resumes the
        workflow at the next step. Any unsaved notebook changes will be lost —
        open the notebook first if you need to save your work.
      </p>
      <p v-if="endRunError" style="margin: 12px 0 0; color: #c14d49; font-size: 13px;">
        {{ endRunError }}
      </p>
      <template #footer>
        <div class="end-dialog-footer">
          <bf-button class="secondary" :disabled="!!endingRunId" @click="confirmEndRun = null">
            Cancel
          </bf-button>
          <bf-button class="red" :disabled="!!endingRunId" @click="confirmEndSession">
            {{ endingRunId ? 'Ending…' : 'End Session' }}
          </bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

/* Lined up with the Analysis tabs above (32px). */
.notebooks-container {
  max-width: 1000px;
  margin: 0;
  padding: 20px 32px;
}
/* End-session dialog footer: right-aligned buttons with an even 8px gap (the
   mr-8 utility doesn't reliably land on the bf-button root). */
.end-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* The view switch on the left, the view's action on the right. A small
   two-way toggle, so it doesn't read as a second row of page tabs. */
.nb-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.nb-views {
  display: inline-flex;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.nb-view {
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
.nb-view-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$gray_4;
}
.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.history-search {
  width: 240px;
}
.history-empty {
  margin: 4px 0 0;
  font-size: 13px;
  color: theme.$gray_4;
}
.history-more {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: theme.$link-color;
  cursor: pointer;

  &:disabled {
    color: theme.$gray_4;
    cursor: default;
  }
}
.dashboard-section {
  margin-bottom: 24px;
}
.dashboard-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  margin: 0 0 12px;
}
.active-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #06b6d4;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 6px rgba(6, 182, 212, 0);
  }
}
.active-runs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.active-run-card {
  position: relative;
  background: theme.$white;
  border: 1px solid #67e8f9;
  border-radius: 4px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.active-run-card:hover {
  border-color: #06b6d4;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.15);
}
.active-run-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 6px;
}
.active-run-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  border: 1px solid #b3bcce;
  border-radius: 6px;
  background: #fff;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.active-run-action:hover {
  background: #e6e9ef;
  border-color: #011f5b;
}
.active-run-action--end:hover {
  background: #feeeec;
  border-color: #c14d49;
}
.active-run-action:disabled {
  opacity: 0.5;
  cursor: default;
}
/* The play glyph only fills the left half of its 0 0 20 12 viewBox, so nudge it
   right to optically center within the button. */
.active-run-action--play svg {
  transform: translateX(4px);
}
.active-run-name {
  font-weight: 600;
  font-size: 14px;
  color: theme.$gray_6;
  padding-right: 60px;
  word-break: break-word;
}
.active-run-subtitle {
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 2px;
}
.active-run-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: theme.$gray_5;
}
.active-run-time {
  margin-left: auto;
}
.run-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: theme.$gray_3;
}
.recent-runs-list {
  display: flex;
  flex-direction: column;
  background: theme.$white;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  overflow: hidden;
}
.recent-run-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid theme.$gray_1;
  cursor: pointer;
  font-size: 13px;
}
.recent-run-row:last-child {
  border-bottom: none;
}
.recent-run-row:hover {
  background: theme.$gray_1;
}
.recent-run-name {
  font-weight: 500;
  color: theme.$gray_6;
}
.recent-run-status {
  color: theme.$gray_5;
}
.recent-run-time {
  margin-left: auto;
  color: theme.$gray_4;
}
.empty-canvas {
  text-align: center;
  padding: 64px 16px;
  color: theme.$gray_4;
}
.empty-canvas h3 {
  margin: 0 0 8px;
  color: theme.$gray_5;
}
</style>
