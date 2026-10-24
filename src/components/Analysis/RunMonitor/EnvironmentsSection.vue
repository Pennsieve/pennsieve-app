<script setup>
// The user's environments (python-env / r-env layers) across all their
// notebook-capable compute nodes, with each one's build status: an
// environment is filled by a run of the official build workflow, and the run
// says whether it's still building or failed. Polls while anything builds.
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { MoreFilled, Loading } from "@element-plus/icons-vue";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import LayerTypeIcon from "../ComputeNodes/LayerTypeIcon.vue";
import { interactiveCapable } from "./notebookHelpers";
import {
  buildRunFor,
  environmentStatus,
  fetchBuildRuns,
  fetchRunDetail,
  isEnvironment,
  requirementsOf,
} from "./environmentStatus";

const props = defineProps({
  // The official build workflows, by language: { python, r }.
  buildWorkflows: { type: Object, default: () => ({ python: null, r: null }) },
});
// create(), edit(env), retry(env), use(env): the page opens the dialogs.
const emit = defineEmits(["create", "edit", "retry", "use"]);

const store = useStore();
const route = useRoute();
const cr = useComputeResourcesStore();

const computeNodes = computed(() =>
  (store.getters["analysisModule/computeNodes"] || []).filter(interactiveCapable)
);
const nodeFilter = ref("all");
const runs = ref([]);
const runsError = ref("");
const expanded = ref(null);
const packageQuery = ref("");
const requirements = ref({}); // run uuid -> requirements text

const orgId = computed(() => route.params.orgId);
const workflowIds = computed(() =>
  [props.buildWorkflows?.python?.uuid, props.buildWorkflows?.r?.uuid].filter(Boolean)
);

async function loadRuns() {
  if (!workflowIds.value.length) return;
  try {
    runs.value = await fetchBuildRuns(workflowIds.value, orgId.value);
    runsError.value = "";
  } catch (e) {
    runsError.value = e?.message || String(e);
  }
}

function loadLayers(force = false) {
  return Promise.all(
    computeNodes.value.map((n) => cr.fetchNodeLayers(n.uuid, force).catch(() => null))
  );
}

watch(
  () => computeNodes.value.map((n) => n.uuid).join(","),
  () => loadLayers(),
  { immediate: true }
);
watch(workflowIds, loadRuns, { immediate: true });

const STATUS_ORDER = { building: 0, failed: 1, "not-built": 2, ready: 3 };

// Every environment, with its node, build run and status.
const environments = computed(() => {
  const list = [];
  for (const node of computeNodes.value) {
    if (nodeFilter.value !== "all" && nodeFilter.value !== node.uuid) continue;
    const layers = cr.getNodeLayers(node.uuid)?.layers || [];
    for (const layer of layers.filter(isEnvironment)) {
      const run = buildRunFor(layer, node.uuid, runs.value);
      list.push({
        key: `${node.uuid}/${layer.layerName}`,
        nodeId: node.uuid,
        nodeName: node.name,
        layer,
        run,
        status: environmentStatus(layer, run),
      });
    }
  }
  return list.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.layer.layerName.localeCompare(b.layer.layerName)
  );
});

const isLoading = computed(
  () => computeNodes.value.some((n) => cr.isNodeLayersLoading(n.uuid)) && environments.value.length === 0
);

/* -------------------------------------------------------------- polling --- */
// While anything builds, look again: the layer turns READY, or its run fails.
const POLL_MS = 15000;
let pollTimer = null;
const building = computed(() => environments.value.some((e) => e.status === "building"));

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (!building.value) return;
  pollTimer = setTimeout(async () => {
    if (document.visibilityState === "visible") {
      await Promise.all([loadRuns(), loadLayers(true)]);
    }
    schedulePoll();
  }, POLL_MS);
}
watch(building, schedulePoll, { immediate: true });
onBeforeUnmount(() => clearTimeout(pollTimer));

// The page calls this after starting a build, so it shows at once.
async function refresh() {
  await Promise.all([loadRuns(), loadLayers(true)]);
  schedulePoll();
}
defineExpose({ refresh });

/* -------------------------------------------------------------- details --- */
async function toggle(env) {
  expanded.value = expanded.value === env.key ? null : env.key;
  packageQuery.value = "";
  const runId = env.run?.uuid;
  if (expanded.value === env.key && runId && requirements.value[runId] === undefined) {
    try {
      requirements.value = { ...requirements.value, [runId]: requirementsOf(await fetchRunDetail(runId)) };
    } catch {
      requirements.value = { ...requirements.value, [runId]: "" };
    }
  }
}

const packagesOf = (layer) => layer.packages || [];
const filteredPackages = (layer) => {
  const q = packageQuery.value.trim().toLowerCase();
  return q ? packagesOf(layer).filter((p) => p.toLowerCase().includes(q)) : packagesOf(layer);
};

/* -------------------------------------------------------------- actions --- */
const runRoute = (run) =>
  orgId.value
    ? { name: "run-detail", params: { orgId: orgId.value, runId: run.uuid } }
    : { name: "my-run-detail", params: { runId: run.uuid } };

// What an edit or retry starts from: the language, node, name, and the
// requirements the last build was given.
async function startingPoint(env) {
  let reqs = env.run ? requirements.value[env.run.uuid] : "";
  if (env.run && reqs === undefined) {
    try {
      reqs = requirementsOf(await fetchRunDetail(env.run.uuid));
    } catch {
      reqs = "";
    }
  }
  return {
    lang: env.layer.layerType === "r-env" ? "r" : "python",
    nodeId: env.nodeId,
    name: env.layer.layerName,
    requirements: reqs || packagesOf(env.layer).join("\n"),
  };
}

async function onCommand(command, env) {
  if (command === "use") emit("use", { nodeId: env.nodeId, layerName: env.layer.layerName, layerType: env.layer.layerType });
  if (command === "edit") emit("edit", await startingPoint(env));
  if (command === "retry") emit("retry", { ...(await startingPoint(env)), replace: true });
  if (command === "delete") await remove(env);
}

async function remove(env) {
  try {
    await ElMessageBox.confirm(
      `Delete the environment "${env.layer.layerName}" on ${env.nodeName}? Notebooks started from now on can't use it. Its files on the node are cleaned up separately.`,
      "Delete environment",
      { confirmButtonText: "Delete", cancelButtonText: "Cancel", type: "warning" }
    );
  } catch {
    return; // cancelled
  }
  try {
    await cr.deleteNodeLayer(env.nodeId, env.layer.layerName);
    ElMessage.success(`Deleted "${env.layer.layerName}".`);
  } catch (e) {
    ElMessage.error(
      /403|Forbidden/i.test(e?.message || "")
        ? "Only the compute node's owners can delete its environments."
        : e?.message || "Could not delete the environment."
    );
  }
}

/* ----------------------------------------------------------- formatting --- */
const langLabel = (t) => (t === "r-env" ? "R" : "Python");
const pkgCount = (layer) => packagesOf(layer).length || layer.packageCount || 0;
function formatSize(b) {
  if (!b) return "";
  const gb = b / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`;
}
function since(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
const STATUS_LABEL = { ready: "Ready", building: "Building", failed: "Failed", "not-built": "Not built" };
</script>

<template>
  <div class="dashboard-section">
    <div class="env-header">
      <h3 class="dashboard-section-title">Environments</h3>
      <div class="env-header-actions">
        <el-select v-if="computeNodes.length > 1" v-model="nodeFilter" size="small" style="width: 220px">
          <el-option label="All compute nodes" value="all" />
          <el-option v-for="n in computeNodes" :key="n.uuid" :label="n.name" :value="n.uuid" />
        </el-select>
      </div>
    </div>
    <p class="env-desc">
      Reusable Python and R package environments. Pick one when you start a notebook.
    </p>

    <div v-if="isLoading" class="env-empty">Loading…</div>
    <div v-else-if="environments.length === 0" class="env-empty">
      No environments yet.
      <button v-if="workflowIds.length" class="env-link" type="button" @click="emit('create')">
        Create one
      </button>
    </div>
    <div v-else class="env-list">
      <div v-for="env in environments" :key="env.key" class="env-card" :class="`is-${env.status}`">
        <div class="env-row" @click="toggle(env)">
          <span class="env-caret" :class="{ open: expanded === env.key }">▸</span>
          <LayerTypeIcon :layer-type="env.layer.layerType" :size="22" />
          <div class="env-main">
            <div class="env-name">{{ env.layer.layerName }}</div>
            <div class="env-meta">
              {{ langLabel(env.layer.layerType) }}<span v-if="env.layer.pythonVersion"> {{ env.layer.pythonVersion }}</span>
              <template v-if="env.status === 'ready'">
                · {{ pkgCount(env.layer) }} packages<template v-if="formatSize(env.layer.sizeBytes)"> · {{ formatSize(env.layer.sizeBytes) }}</template>
              </template>
              <template v-else-if="env.status === 'building' && env.run">
                · started {{ since(env.run.startedAt) }}
              </template>
              <template v-if="computeNodes.length > 1"> · {{ env.nodeName }}</template>
            </div>
          </div>

          <span class="env-status" :class="`is-${env.status}`">
            <el-icon v-if="env.status === 'building'" class="env-spin"><Loading /></el-icon>
            {{ STATUS_LABEL[env.status] }}
          </span>

          <span @click.stop>
            <el-dropdown trigger="click" @command="(c) => onCommand(c, env)">
              <button class="env-more" type="button" aria-label="Environment actions">
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="env.status === 'ready'" command="use">Use in a notebook</el-dropdown-item>
                  <el-dropdown-item v-if="env.status === 'failed'" command="retry">Edit and retry</el-dropdown-item>
                  <el-dropdown-item v-if="env.status !== 'failed'" command="edit" :disabled="!workflowIds.length">
                    Edit packages
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>Delete</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </span>
        </div>

        <div v-if="env.status === 'failed'" class="env-failure">
          <span>The build failed<template v-if="env.run?.errorMessage">: {{ env.run.errorMessage }}</template>.</span>
          <router-link v-if="env.run" :to="runRoute(env.run)" class="env-link">View build log</router-link>
          <button class="env-link" type="button" @click="onCommand('retry', env)">Edit and retry</button>
        </div>
        <div v-else-if="env.status === 'building' && env.run" class="env-building">
          Installing packages on {{ env.nodeName }}. This usually takes a few minutes.
          <router-link :to="runRoute(env.run)" class="env-link">View build</router-link>
        </div>

        <div v-if="expanded === env.key" class="env-details">
          <template v-if="packagesOf(env.layer).length">
            <el-input
              v-if="packagesOf(env.layer).length > 12"
              v-model="packageQuery"
              size="small"
              placeholder="Search packages…"
              clearable
              class="env-pkg-search"
            />
            <div class="env-packages">
              <code v-for="p in filteredPackages(env.layer)" :key="p" class="pkg">{{ p }}</code>
              <span v-if="!filteredPackages(env.layer).length" class="env-muted">No package matches.</span>
            </div>
          </template>
          <p v-else class="env-muted">No package list recorded for this environment.</p>
          <template v-if="env.run && requirements[env.run.uuid]">
            <div class="env-sub">Requirements it was built from</div>
            <pre class="env-reqs">{{ requirements[env.run.uuid] }}</pre>
          </template>
        </div>
      </div>
    </div>
    <p v-if="runsError" class="env-muted">Build status unavailable: {{ runsError }}</p>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/_theme.scss";

.env-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.env-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.env-desc {
  font-size: 13px;
  color: theme.$gray_4;
  margin: 4px 0 12px;
}
.env-empty {
  font-size: 13px;
  color: theme.$gray_4;
  padding: 12px 0;
}
.env-link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: theme.$link-color;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    color: theme.$link-color-hover;
  }
}
.env-empty .env-link {
  font-size: 13px;
  margin-left: 4px;
}
.env-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.env-card {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  overflow: hidden;
  background: theme.$white;

  &.is-failed {
    border-color: rgba(theme.$red_2, 0.4);
  }
}
.env-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
}
.env-caret {
  color: theme.$gray_4;
  font-size: 10px;
  width: 10px;
  transition: transform 0.12s ease;

  &.open {
    transform: rotate(90deg);
  }
}
.env-main {
  flex: 1;
  min-width: 0;
}
.env-name {
  font-weight: 500;
  color: theme.$gray_6;
}
.env-meta {
  font-size: 12px;
  color: theme.$gray_4;
}
.env-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;

  &.is-ready {
    background: theme.$green_tint;
    color: theme.$green_2;
  }
  &.is-building {
    background: theme.$orange_tint;
    color: theme.$orange_2;
  }
  &.is-failed {
    background: theme.$red_tint;
    color: theme.$red_2;
  }
  &.is-not-built {
    background: theme.$gray_0;
    color: theme.$gray_5;
  }
}
.env-spin {
  animation: env-spin 1s linear infinite;
}
@keyframes env-spin {
  to {
    transform: rotate(360deg);
  }
}
.env-more {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  padding: 4px;
  border-radius: 2px;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    background: theme.$gray_0;
    color: theme.$purple_3;
  }
}
.env-failure,
.env-building {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  padding: 0 12px 10px 42px;
  font-size: 12px;
}
.env-failure {
  color: theme.$red_2;
}
.env-building {
  color: theme.$gray_5;
}
.env-details {
  padding: 0 12px 12px 42px;
}
.env-pkg-search {
  max-width: 260px;
  margin-bottom: 8px;
}
.env-packages {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}
.pkg {
  font-family: "Courier New", monospace;
  font-size: 12px;
  color: theme.$gray_6;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 2px 6px;
}
.env-sub {
  margin: 12px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
}
.env-reqs {
  margin: 0;
  padding: 8px 10px;
  max-height: 180px;
  overflow: auto;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  font-size: 12px;
  color: theme.$gray_6;
}
.env-muted {
  font-size: 12px;
  color: theme.$gray_4;
  margin: 0;
}
</style>
