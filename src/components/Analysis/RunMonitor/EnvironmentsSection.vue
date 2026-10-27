<script setup>
// The user's environments, and Pennsieve's official ones, from environments-
// service: named, versioned Python package sets, built once and usable by
// any of the user's notebooks, which switch to one from their sidebar. A grid
// of cards, searchable by name or package; each shows the newest ready
// version and the latest build's status, and opens its details. Polls while
// a build runs.
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import { ElMessage, ElMessageBox } from "element-plus";
import { MoreFilled, Loading } from "@element-plus/icons-vue";
import EnvironmentIcon from "./EnvironmentIcon.vue";
import {
  buildLog,
  deleteEnvironment,
  environmentsServiceUrl,
  getEnvironment,
  listEnvironments,
} from "@/utils/environmentsService";
import { cardStatus, formatBytes, shownVersion, since, sortEnvironments } from "./environmentCards";
import { matchesQuery, packageSummary } from "../JupyterSession/environmentHelpers";

const props = defineProps({
  // Off where the page names the section (the Notebooks page's Environments
  // tab), which also has the New button.
  showTitle: { type: Boolean, default: true },
});
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
const detailId = ref(null); // the card whose details are open
const packageQuery = ref("");
const query = ref("");

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
    if (detailId.value) await readVersions(detailId.value);
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
const shownCards = computed(() =>
  cards.value.filter((c) => matchesQuery({ name: c.env.name, packages: c.shown?.packages || [] }, query.value))
);
const detail = computed(() => cards.value.find((c) => c.env.id === detailId.value) || null);
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
function openDetail(card) {
  detailId.value = card.env.id;
  packageQuery.value = "";
  readVersions(card.env.id);
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

async function removeFromDetail(card) {
  if (await remove(card.env)) detailId.value = null;
}

// Deletes after a confirmation; true once deleted.
async function remove(env) {
  try {
    await ElMessageBox.confirm(
      `Delete ${env.name} and all its versions? Notebooks using it keep it until they end; new ones can't switch to it.`,
      "Delete environment",
      { confirmButtonText: "Delete", cancelButtonText: "Cancel", type: "warning" }
    );
  } catch {
    return false; // cancelled
  }
  try {
    await deleteEnvironment(env.id);
    environments.value = environments.value.filter((e) => e.id !== env.id);
    ElMessage.success(`Deleted ${env.name}.`);
    return true;
  } catch (e) {
    ElMessage.error(e?.message || "Could not delete the environment.");
    return false;
  }
}

const STATUS_LABEL = { ready: "Ready", building: "Building", failed: "Failed", unknown: "" };
</script>

<template>
  <div v-if="available" class="dashboard-section">
    <div class="env-header" :class="{ 'env-header--untitled': !showTitle }">
      <h3 v-if="showTitle" class="dashboard-section-title">Environments</h3>
      <div class="env-header-actions">
        <el-input
          v-if="cards.length > 3"
          v-model="query"
          size="small"
          clearable
          placeholder="Search by name or package…"
          class="env-search"
        />
        <button v-if="showTitle" class="env-link env-new" type="button" @click="emit('create')">+ New</button>
      </div>
    </div>

    <div v-if="!loaded" class="env-empty">Loading…</div>
    <div v-else-if="error && !cards.length" class="env-empty env-error">Couldn't load environments: {{ error }}</div>
    <div v-else-if="!cards.length" class="env-empty">
      No environments yet. Build one from a requirements list, then switch to it from a notebook's sidebar.
      <button class="env-link" type="button" @click="emit('create')">Create one</button>
    </div>
    <div v-else-if="!shownCards.length" class="env-empty">No environment has that name or package.</div>
    <div v-else class="env-grid">
      <div
        v-for="card in shownCards"
        :key="card.env.id"
        class="env-card"
        :class="`is-${card.status}`"
        role="button"
        tabindex="0"
        @click="openDetail(card)"
        @keydown.enter="openDetail(card)"
      >
        <div class="env-card-top">
          <EnvironmentIcon :language="card.env.language" :size="20" />
          <span class="env-name" :title="card.env.name">{{ card.env.name }}</span>
          <span v-if="card.env.official" class="env-tag">Pennsieve</span>
          <span class="env-more-wrap" @click.stop>
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

        <div class="env-meta">
          <template v-if="card.shown?.status === 'ready'">
            v{{ card.shown.version }} · {{ (card.shown.packages || []).length }} packages<template
              v-if="formatBytes(card.shown.archive?.unpackedBytes)"
            >
              · {{ formatBytes(card.shown.archive.unpackedBytes) }}</template
            >
          </template>
          <template v-else-if="card.env.latest">v{{ card.env.latest.version }}</template>
        </div>
        <div class="env-packages-line" :title="(card.shown?.packages || []).join(', ')">
          {{ packageSummary(card.shown?.packages, 4) || "\u00a0" }}
        </div>

        <div class="env-card-foot">
          <span v-if="STATUS_LABEL[card.status]" class="env-status" :class="`is-${card.status}`">
            <el-icon v-if="card.status === 'building'" class="env-spin"><Loading /></el-icon>
            {{ card.status === "failed" && card.shown?.status === "ready" ? `v${card.env.latest.version} failed` : STATUS_LABEL[card.status] }}
          </span>
          <span v-if="card.status === 'building'" class="env-muted">started {{ since(card.env.latest.createdAt) }}</span>
          <button
            v-if="card.own && (card.status === 'failed' || card.status === 'building')"
            class="env-link env-foot-link"
            type="button"
            @click.stop="openLog(card)"
          >
            View log
          </button>
        </div>
      </div>
    </div>

    <!-- An environment's details: packages, requirements, versions. -->
    <el-dialog
      :model-value="!!detail"
      :title="detail ? detail.env.name : ''"
      width="640px"
      append-to-body
      @update:model-value="(v) => v || (detailId = null)"
    >
      <template v-if="detail">
        <p class="env-detail-sub">
          <template v-if="detail.shown?.status === 'ready'">
            Version {{ detail.shown.version }} · Python {{ detail.shown.runtime?.version }} ·
            {{ (detail.shown.packages || []).length }} packages<template v-if="formatBytes(detail.shown.archive?.unpackedBytes)">
              · {{ formatBytes(detail.shown.archive.unpackedBytes) }}</template
            >
          </template>
          <template v-else-if="detail.status === 'building'">Version {{ detail.env.latest.version }} is building.</template>
          <template v-else-if="detail.status === 'failed'">Version {{ detail.env.latest.version }} didn't build.</template>
          <span v-if="detail.env.official"> · Provided by Pennsieve</span>
        </p>

        <template v-if="(detail.shown?.packages || []).length">
          <el-input
            v-if="detail.shown.packages.length > 12"
            v-model="packageQuery"
            size="small"
            placeholder="Search packages…"
            clearable
            class="env-pkg-search"
          />
          <div class="env-packages">
            <code v-for="p in filteredPackages(detail.shown)" :key="p" class="pkg">{{ p }}</code>
            <span v-if="!filteredPackages(detail.shown).length" class="env-muted">No package matches.</span>
          </div>
        </template>

        <template v-if="detail.shown?.requirements">
          <div class="env-sub">Requirements it was built from</div>
          <pre class="env-reqs">{{ detail.shown.requirements }}</pre>
        </template>

        <template v-if="(versionsById[detail.env.id] || []).length">
          <div class="env-sub">Versions</div>
          <ul class="env-versions">
            <li v-for="v in versionsById[detail.env.id]" :key="v.version">
              <span class="env-version-n">Version {{ v.version }}</span>
              <span class="env-status" :class="`is-${v.status}`">{{ STATUS_LABEL[v.status] }}</span>
              <span class="env-muted">{{ since(v.readyAt || v.createdAt) }}</span>
              <button v-if="detail.own" class="env-link" type="button" @click="openLog(detail, v)">Log</button>
            </li>
          </ul>
        </template>
      </template>
      <template #footer>
        <div v-if="detail" class="env-detail-actions">
          <el-button v-if="detail.own" text type="danger" @click="removeFromDetail(detail)">
            Delete
          </el-button>
          <span class="env-spacer" />
          <el-button
            v-if="detail.own && detail.status === 'failed'"
            @click="detailId = null; onCommand('retry', detail)"
          >
            Edit and retry
          </el-button>
          <el-button
            v-else-if="detail.own"
            :disabled="detail.status === 'building'"
            @click="detailId = null; onCommand('edit', detail)"
          >
            Edit packages
          </el-button>
          <el-button v-if="detail.shown?.status === 'ready'" type="primary" @click="detailId = null; emit('use')">
            Use in a notebook
          </el-button>
        </div>
      </template>
    </el-dialog>

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
.env-header--untitled {
  justify-content: flex-end;
}
.env-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.env-search {
  width: 240px;
}
.env-new {
  font-size: 13px;
  font-weight: 500;
}
/* Cards side by side, as many as fit. */
.env-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  margin-top: 8px;
}
.env-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px 12px 10px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    border-color: theme.$purple_1;
    outline: none;
  }
  &.is-failed {
    border-color: rgba(theme.$red_2, 0.4);
  }
}
.env-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.env-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: theme.$gray_6;
}
.env-tag {
  flex-shrink: 0;
  padding: 0 5px;
  border-radius: 3px;
  background: theme.$purple_tint;
  color: theme.$purple_2;
  font-size: 10px;
  font-weight: 600;
}
.env-more-wrap {
  flex-shrink: 0;
  margin-right: -4px;
}
.env-meta {
  font-size: 12px;
  color: theme.$gray_4;
}
.env-packages-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_5;
}
.env-card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  min-height: 20px;
}
.env-foot-link {
  margin-left: auto;
}
.env-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 3px;
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
.env-detail-sub {
  margin: -8px 0 12px;
  font-size: 13px;
  color: theme.$gray_4;
}
.env-detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.env-spacer {
  flex: 1;
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
