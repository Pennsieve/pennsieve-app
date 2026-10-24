<script setup>
// The user's environments, and Pennsieve's official ones, from environments-
// service: named, versioned Python package sets, built once and usable by
// any of the user's notebooks, which switch to one from their sidebar. Each
// card shows the newest ready version and the latest build's status; the
// section polls while a build runs.
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import { ElMessage, ElMessageBox } from "element-plus";
import { MoreFilled, Loading } from "@element-plus/icons-vue";
import LayerTypeIcon from "../ComputeNodes/LayerTypeIcon.vue";
import {
  buildLog,
  deleteEnvironment,
  environmentsServiceUrl,
  getEnvironment,
  listEnvironments,
} from "@/utils/environmentsService";
import { cardStatus, formatBytes, shownVersion, since, sortEnvironments } from "./environmentCards";

// create(), edit({ name, requirements }), retry({ name, requirements, retry }),
// use(): the page opens the dialogs.
const emit = defineEmits(["create", "edit", "retry", "use"]);

const store = useStore();
const available = !!environmentsServiceUrl();
const me = computed(() => store.state.profile?.id);

const environments = ref([]);
const versionsById = ref({}); // id -> versions, newest first, once read
const loading = ref(false);
const loaded = ref(false);
const error = ref("");
const expanded = ref(null);
const packageQuery = ref("");

async function readVersions(id) {
  try {
    const { versions } = await getEnvironment(id);
    versionsById.value = { ...versionsById.value, [id]: versions };
  } catch {
    // The card falls back to the latest version.
  }
}

async function load() {
  if (!available) return;
  loading.value = true;
  try {
    environments.value = await listEnvironments();
    error.value = "";
    // A newer build over a ready version: read the versions, to show that one.
    await Promise.all(
      environments.value
        .filter((e) => e.latest?.status !== "ready" && e.latestVersion > 1)
        .map((e) => readVersions(e.id))
    );
    if (expanded.value) await readVersions(expanded.value);
  } catch (e) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}
load();

const cards = computed(() =>
  sortEnvironments(
    environments.value
      .filter((env) => env.language === "python")
      .map((env) => {
        const versions = versionsById.value[env.id];
        return {
          env,
          status: cardStatus(env, versions),
          shown: shownVersion(env, versions),
          own: !env.official && env.owner === me.value,
        };
      })
  )
);
const ownNames = computed(() => environments.value.filter((e) => !e.official).map((e) => e.name));

/* -------------------------------------------------------------- polling --- */
const POLL_MS = 10000;
let pollTimer = null;
const building = computed(() => cards.value.some((c) => c.status === "building"));

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (!building.value) return;
  pollTimer = setTimeout(async () => {
    if (document.visibilityState === "visible") await load();
    schedulePoll();
  }, POLL_MS);
}
watch(building, schedulePoll, { immediate: true });
onBeforeUnmount(() => {
  clearTimeout(pollTimer);
  clearTimeout(logTimer);
});

// The page calls this after starting a build, so it shows at once.
async function refresh() {
  await load();
  schedulePoll();
}
defineExpose({ refresh, ownNames });

/* -------------------------------------------------------------- details --- */
function toggle(card) {
  const id = card.env.id;
  expanded.value = expanded.value === id ? null : id;
  packageQuery.value = "";
  if (expanded.value && !versionsById.value[id]) readVersions(id);
}

const filteredPackages = (version) => {
  const all = version?.packages || [];
  const q = packageQuery.value.trim().toLowerCase();
  return q ? all.filter((p) => p.toLowerCase().includes(q)) : all;
};

/* ------------------------------------------------------------ build log --- */
const log = ref(null); // { name, version, status, lines, loading }
let logTimer = null;

async function readLog() {
  const l = log.value;
  if (!l) return;
  try {
    const out = await buildLog(l.id, l.version);
    if (log.value !== l) return;
    log.value = { ...l, status: out.status, lines: out.lines || [], loading: false };
  } catch (e) {
    log.value = { ...l, lines: [], error: e?.message || String(e), loading: false };
  }
  clearTimeout(logTimer);
  if (log.value?.status === "building") logTimer = setTimeout(readLog, 5000);
}

function openLog(card, version = card.env.latest) {
  log.value = { id: card.env.id, name: card.env.name, version: version.version, status: version.status, lines: [], loading: true };
  readLog();
}
function closeLog() {
  clearTimeout(logTimer);
  log.value = null;
}

/* -------------------------------------------------------------- actions --- */
async function onCommand(command, card) {
  const env = card.env;
  // Edits start from the requirements the latest build was given.
  const requirements = env.latest?.requirements || (card.shown?.packages || []).join("\n");
  if (command === "use") emit("use");
  if (command === "edit") emit("edit", { name: env.name, requirements });
  if (command === "retry") emit("retry", { name: env.name, requirements, retry: true });
  if (command === "log") openLog(card);
  if (command === "delete") await remove(env);
}

async function remove(env) {
  try {
    await ElMessageBox.confirm(
      `Delete ${env.name} and all its versions? Notebooks using it keep it until they end; new ones can't switch to it.`,
      "Delete environment",
      { confirmButtonText: "Delete", cancelButtonText: "Cancel", type: "warning" }
    );
  } catch {
    return; // cancelled
  }
  try {
    await deleteEnvironment(env.id);
    environments.value = environments.value.filter((e) => e.id !== env.id);
    ElMessage.success(`Deleted ${env.name}.`);
  } catch (e) {
    ElMessage.error(e?.message || "Could not delete the environment.");
  }
}

const STATUS_LABEL = { ready: "Ready", building: "Building", failed: "Failed", unknown: "" };
</script>

<template>
  <div v-if="available" class="dashboard-section">
    <div class="env-header">
      <h3 class="dashboard-section-title">Environments</h3>
    </div>
    <p class="env-desc">
      Python package environments for your notebooks. Build one from a requirements list, then switch to it from a
      notebook's sidebar while it runs.
    </p>

    <div v-if="!loaded" class="env-empty">Loading…</div>
    <div v-else-if="error && !cards.length" class="env-empty env-error">Couldn't load environments: {{ error }}</div>
    <div v-else-if="!cards.length" class="env-empty">
      No environments yet.
      <button class="env-link" type="button" @click="emit('create')">Create one</button>
    </div>
    <div v-else class="env-list">
      <div v-for="card in cards" :key="card.env.id" class="env-card" :class="`is-${card.status}`">
        <div class="env-row" @click="toggle(card)">
          <span class="env-caret" :class="{ open: expanded === card.env.id }">▸</span>
          <LayerTypeIcon layer-type="python-env" :size="22" />
          <div class="env-main">
            <div class="env-name">
              {{ card.env.name }}
              <span v-if="card.env.official" class="env-tag">Pennsieve</span>
            </div>
            <div class="env-meta">
              <template v-if="card.shown?.status === 'ready'">
                Version {{ card.shown.version }} · Python {{ card.shown.runtime?.version }} ·
                {{ (card.shown.packages || []).length }} packages<template v-if="formatBytes(card.shown.archive?.unpackedBytes)">
                  · {{ formatBytes(card.shown.archive.unpackedBytes) }}</template
                >
              </template>
              <template v-else-if="card.status === 'building'">
                Version {{ card.env.latest.version }} · started {{ since(card.env.latest.createdAt) }}
              </template>
              <template v-else-if="card.env.latest">Version {{ card.env.latest.version }}</template>
            </div>
          </div>

          <span v-if="STATUS_LABEL[card.status]" class="env-status" :class="`is-${card.status}`">
            <el-icon v-if="card.status === 'building'" class="env-spin"><Loading /></el-icon>
            {{ STATUS_LABEL[card.status] }}
          </span>

          <span @click.stop>
            <el-dropdown trigger="click" @command="(c) => onCommand(c, card)">
              <button class="env-more" type="button" aria-label="Environment actions">
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="card.shown?.status === 'ready'" command="use">Use in a notebook</el-dropdown-item>
                  <el-dropdown-item v-if="card.own && card.status === 'failed'" command="retry">Edit and retry</el-dropdown-item>
                  <el-dropdown-item v-else-if="card.own" command="edit" :disabled="card.status === 'building'">
                    Edit packages
                  </el-dropdown-item>
                  <el-dropdown-item v-if="card.own" command="log">Build log</el-dropdown-item>
                  <el-dropdown-item v-if="card.own" command="delete" divided>Delete</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </span>
        </div>

        <div v-if="card.status === 'failed'" class="env-failure">
          <span>
            Version {{ card.env.latest.version }} didn't build<template v-if="card.shown?.status === 'ready'">;
              notebooks can still use version {{ card.shown.version }}</template
            >.
          </span>
          <button v-if="card.own" class="env-link" type="button" @click="openLog(card)">View build log</button>
          <button v-if="card.own" class="env-link" type="button" @click="onCommand('retry', card)">Edit and retry</button>
        </div>
        <div v-else-if="card.status === 'building'" class="env-building">
          Installing packages. This usually takes a minute or two.
          <button v-if="card.own" class="env-link" type="button" @click="openLog(card)">View build log</button>
        </div>

        <div v-if="expanded === card.env.id" class="env-details">
          <template v-if="(card.shown?.packages || []).length">
            <el-input
              v-if="card.shown.packages.length > 12"
              v-model="packageQuery"
              size="small"
              placeholder="Search packages…"
              clearable
              class="env-pkg-search"
            />
            <div class="env-packages">
              <code v-for="p in filteredPackages(card.shown)" :key="p" class="pkg">{{ p }}</code>
              <span v-if="!filteredPackages(card.shown).length" class="env-muted">No package matches.</span>
            </div>
          </template>
          <p v-else class="env-muted">No packages recorded yet.</p>
          <template v-if="card.shown?.requirements">
            <div class="env-sub">Requirements it was built from</div>
            <pre class="env-reqs">{{ card.shown.requirements }}</pre>
          </template>
          <template v-if="(versionsById[card.env.id] || []).length > 1">
            <div class="env-sub">Versions</div>
            <ul class="env-versions">
              <li v-for="v in versionsById[card.env.id]" :key="v.version">
                <span class="env-version-n">Version {{ v.version }}</span>
                <span class="env-status" :class="`is-${v.status}`">{{ STATUS_LABEL[v.status] }}</span>
                <span class="env-muted">{{ since(v.readyAt || v.createdAt) }}</span>
                <button v-if="card.own" class="env-link" type="button" @click="openLog(card, v)">Log</button>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </div>

    <el-dialog
      :model-value="!!log"
      :title="log ? `${log.name} version ${log.version}: build log` : ''"
      width="720px"
      append-to-body
      @update:model-value="(v) => v || closeLog()"
    >
      <template v-if="log">
        <p v-if="log.status === 'building'" class="env-muted">Building. The log updates as it runs.</p>
        <p v-if="log.error" class="env-error">{{ log.error }}</p>
        <pre v-else class="env-log">{{ log.loading ? "Loading…" : log.lines.join("\n") || "No log yet." }}</pre>
      </template>
    </el-dialog>
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
.env-error {
  color: theme.$red_2;
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
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: theme.$gray_6;
}
.env-tag {
  padding: 0 5px;
  border-radius: 3px;
  background: theme.$purple_tint;
  color: theme.$purple_2;
  font-size: 10px;
  font-weight: 600;
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
.env-reqs,
.env-log {
  margin: 0;
  padding: 8px 10px;
  max-height: 180px;
  overflow: auto;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  font-size: 12px;
  color: theme.$gray_6;
  white-space: pre-wrap;
  word-break: break-word;
}
.env-log {
  max-height: 420px;
}
.env-versions {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 3px 0;
    font-size: 12px;
  }
}
.env-version-n {
  width: 72px;
  color: theme.$gray_6;
}
.env-muted {
  font-size: 12px;
  color: theme.$gray_4;
  margin: 0;
}
</style>
