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
import { useStore } from "vuex";
import { useRouter, useRoute } from "vue-router";
import BfButton from "../../shared/bf-button/BfButton.vue";
import IconControllerPlay from "../../icons/IconControllerPlay.vue";
import IconXCircle from "../../icons/IconXCircle.vue";
import NewNotebookDialog from "./NewNotebookDialog.vue";
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
const pusher = getCurrentInstance()?.appContext.config.globalProperties.$pusher;

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
const isLoading = ref(false);
const dialogVisible = ref(false);

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
    notebookWorkflows.value = all.filter(isNotebookWorkflow);
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
const recentNotebookRuns = computed(() =>
  notebookRuns.value
    .filter((r) => isTerminalStatus(r.status))
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.startedAt) -
        new Date(a.completedAt || a.startedAt)
    )
    .slice(0, 10)
);

// After a notebook is created, re-fetch so it appears in Active Notebooks with
// the normalized run shape (the POST response shape differs from the summary).
const onNotebookCreated = () => {
  store.dispatch("analysisModule/fetchWorkflowInstances");
};

/* ----------------------------------------------------------- navigation ----- */
const selectRun = (run) => {
  router.push({ name: "run-detail", params: { runId: run.uuid } });
};
const openNotebook = (run) => {
  const orgId =
    route.params.orgId || store.state.activeOrganization?.organization?.id;
  router.push({ name: "run-notebook", params: { orgId, runId: run.uuid } });
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

/* ------------------------------------------------------- pusher / lifecycle - */
const parsePusherData = (data) => {
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
  const data = parsePusherData(raw);
  store.commit("analysisModule/UPDATE_RUN_STATUS", {
    runId: data.runId,
    status: data.status,
  });
};

let analyticsChannel = null;
let analyticsChannelName = null;
onMounted(async () => {
  isLoading.value = true;
  try {
    await Promise.all([
      store.dispatch("analysisModule/fetchWorkflowInstances"),
      store.dispatch("analysisModule/fetchComputeNodes"),
      store.dispatch("analysisModule/fetchTargetTypes"),
      fetchNotebookWorkflows(),
    ]);
  } finally {
    isLoading.value = false;
  }
  if (pusher) {
    const rawOrgId = store.state.activeOrganization?.organization?.id;
    const rawUserId = store.state.profile?.id;
    const orgUuid = rawOrgId?.replace(/^N:organization:/, "");
    const userUuid = rawUserId?.replace(/^N:user:/, "");
    analyticsChannelName = orgUuid
      ? `organization-${orgUuid}-analytics`
      : `user-${userUuid}-analytics`;
    analyticsChannel = pusher.subscribe(analyticsChannelName);
    analyticsChannel.bind("workflow-run-status", onRunStatusUpdate);
  }
});
onBeforeUnmount(() => {
  if (analyticsChannel) {
    analyticsChannel.unbind("workflow-run-status", onRunStatusUpdate);
    if (pusher && analyticsChannelName) {
      pusher.unsubscribe(analyticsChannelName);
    }
    analyticsChannel = null;
    analyticsChannelName = null;
  }
});
</script>

<template>
  <div class="notebooks-container">
      <div class="info-section">
        <div class="info-card">
          <h3>Notebooks</h3>
          <p>
            Launch an interactive Jupyter notebook on your data in a few clicks —
            pick a kernel, compute node, and input files, and start exploring.
            For multi-step analyses, add a notebook step to a custom workflow
            under
            <router-link :to="{ name: 'workflows' }" class="info-card-link">
              Workflows</router-link
            >.
          </p>
          <div class="info-card-actions">
            <bf-button
              :disabled="notebookWorkflows.length === 0"
              @click="dialogVisible = true"
            >
              + New Notebook
            </bf-button>
          </div>
        </div>
      </div>

      <div v-if="!isLoading && notebookWorkflows.length === 0" class="empty-canvas">
        <h3>No notebook environments available</h3>
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

        <div v-if="recentNotebookRuns.length > 0" class="dashboard-section">
          <h3 class="dashboard-section-title">Recent Notebooks</h3>
          <div class="recent-runs-list">
            <div
              v-for="run in recentNotebookRuns"
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
        </div>

        <div
          v-if="
            !isLoading &&
            activeNotebookRuns.length === 0 &&
            recentNotebookRuns.length === 0
          "
          class="empty-canvas"
        >
          <h3>No notebooks yet</h3>
          <p>Start a notebook to work with your data interactively.</p>
        </div>
      </template>

    <new-notebook-dialog
      v-model="dialogVisible"
      :notebook-workflows="notebookWorkflows"
      @created="onNotebookCreated"
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
        <bf-button class="secondary mr-8" :disabled="!!endingRunId" @click="confirmEndRun = null">
          Cancel
        </bf-button>
        <bf-button class="red" :disabled="!!endingRunId" @click="confirmEndSession">
          {{ endingRunId ? 'Ending…' : 'End Session' }}
        </bf-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.notebooks-container {
  max-width: 1000px;
  margin: 0;
  padding: 16px 24px;
}
.info-section {
  margin-bottom: 32px;
}
.info-card-actions {
  margin-top: 16px;
}
.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 24px;
}
.info-card h3 {
  font-size: 18px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0 0 12px 0;
}
.info-card p {
  font-size: 14px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0;
}
.info-card-link {
  color: theme.$purple_1;
  font-weight: 600;
  text-decoration: none;
}
.info-card-link:hover {
  text-decoration: underline;
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
