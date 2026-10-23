<script setup>
// The run's dataset-view inputs (a public dataset outside a workspace). The
// session starts with only each view's file list; the user browses it here,
// picks folders or files, and the session's sidecar downloads them into
// input/<data source>/ (useJupyterSession fetchInputs). The sidecar signs
// them with the run's own credential, so no link passes through the browser.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import * as siteConfig from "@/site-config/site.json";
import { useGetToken } from "@/composables/useGetToken";
import { getView, listEntries } from "@/utils/viewsService";
import {
  folderContents,
  filesUnder,
  inputKey,
  pendingFiles,
  rowStatus,
  summarize,
} from "./inputsHelpers";

const props = defineProps({
  runId: { type: String, required: true },
  fetchInputs: { type: Function, required: true },
  inputsStatus: { type: Function, required: true },
  ready: { type: Boolean, default: false },
});
// downloaded: files finished downloading, so the file browser can refresh.
const emit = defineEmits(["downloaded"]);

// One per view source: { nodeId, viewId, version, name, entries, folder }.
const sources = ref([]);
const loading = ref(false);
const hasViews = ref(false);
const error = ref(null);
const collapsed = ref(false);

// The sidecar's state of every file asked for: key -> { state, size, bytes, error }.
const states = ref({});
const selected = ref(new Set());
const requesting = ref(false);
const requestError = ref(null);

const POLL_MS = 2000;
let pollTimer = null;
let doneCount = 0;

// Reads the run's view sources, then their entries. A run with none shows
// no panel at all, not even while loading.
async function loadSources() {
  error.value = null;
  try {
    const token = await useGetToken();
    const resp = await fetch(
      `${siteConfig.api2Url}/compute/workflows/runs/${encodeURIComponent(props.runId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) throw new Error(`Could not read the run (${resp.status}).`);
    const run = await resp.json();
    const views = Object.entries(run.dataSources || {}).filter(
      ([, ds]) => ds?.kind === "viewVersion"
    );
    if (!views.length) return;
    hasViews.value = true;
    loading.value = true;
    sources.value = await Promise.all(
      views.map(async ([nodeId, ds]) => {
        const [view, entries] = await Promise.all([
          getView(ds.viewId).catch(() => null),
          listEntries(ds.viewId, ds.viewVersion),
        ]);
        return {
          nodeId,
          viewId: ds.viewId,
          version: ds.viewVersion,
          name: view?.sources?.[0]?.name || view?.name || "Dataset",
          sourceVersion: view?.sources?.[0]?.version,
          entries,
          folder: "",
        };
      })
    );
    await refreshStatus();
  } catch (e) {
    console.warn("[inputs]", e?.message || e);
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function refreshStatus() {
  const files = await props.inputsStatus();
  const next = {};
  for (const f of files) next[inputKey(f.source, f.path)] = f;
  states.value = next;
  const done = files.filter((f) => f.state === "done").length;
  if (done > doneCount) emit("downloaded");
  doneCount = done;
  schedulePoll(files.some((f) => f.state === "queued" || f.state === "downloading"));
}

function schedulePoll(active) {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (!active) return;
  pollTimer = setTimeout(async () => {
    try {
      await refreshStatus();
    } catch (e) {
      console.warn("[inputs] status:", e?.message || e);
      schedulePoll(true);
    }
  }, POLL_MS);
}

watch(
  () => props.ready,
  (ready) => {
    if (ready && !hasViews.value && !loading.value) loadSources();
  },
  { immediate: true }
);
onBeforeUnmount(() => clearTimeout(pollTimer));

/* --------------------------------------------------------------- browsing --- */
function open(source, folder) {
  source.folder = folder;
}

function crumbs(source) {
  const parts = source.folder ? source.folder.replace(/\/$/, "").split("/") : [];
  return parts.map((name, i) => ({ name, folder: parts.slice(0, i + 1).join("/") + "/" }));
}

// Each source's current folder, its rows with download badges. Computed once
// per change, not per row: a view can have thousands of files.
const panes = computed(() =>
  sources.value.map((source) => ({
    source,
    crumbs: crumbs(source),
    rows: folderContents(source.entries, source.folder).map((row) => {
      const files = filesUnder(source.entries, row.path);
      const stateOf = (e) => states.value[inputKey(source.nodeId, e.cratePath)];
      const failed = files
        .map(stateOf)
        .filter((st) => st?.state === "failed")
        .slice(0, 5)
        .map((st) => `${st.path}: ${st.error}`)
        .join("\n");
      return { ...row, status: rowStatus(summarize(files, stateOf)), failed };
    }),
  }))
);

/* -------------------------------------------------------------- selection --- */
const selectKey = (source, row) => inputKey(source.nodeId, row.path);

function toggle(source, row) {
  const key = selectKey(source, row);
  const next = new Set(selected.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selected.value = next;
}

const pending = computed(() => pendingFiles(sources.value, selected.value, states.value));
const pendingSize = computed(() => pending.value.reduce((n, f) => n + (f.size || 0), 0));

async function download() {
  if (!pending.value.length || requesting.value) return;
  requesting.value = true;
  requestError.value = null;
  try {
    await props.fetchInputs(pending.value.map(({ source, path }) => ({ source, path })));
    selected.value = new Set();
    await refreshStatus();
  } catch (e) {
    requestError.value = e?.message || String(e);
  } finally {
    requesting.value = false;
  }
}

/* ------------------------------------------------------------- formatting --- */
function fmtSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

</script>

<template>
  <div v-if="loading || sources.length || (error && hasViews)" class="inp" :class="{ 'inp--collapsed': collapsed }">
    <div class="inp__head">
      <button class="inp__toggle" @click="collapsed = !collapsed">
        {{ collapsed ? "▸" : "▾" }} <span class="inp__title">Inputs</span>
      </button>
    </div>

    <template v-if="!collapsed">
      <p v-if="loading" class="inp__msg">Loading the dataset's files…</p>
      <p v-else-if="error" class="inp__msg inp__msg--error">{{ error }}</p>

      <div v-for="{ source, crumbs: path, rows } in panes" :key="source.nodeId" class="inp__source">
        <div class="inp__name" :title="source.name">
          {{ source.name }}
          <span v-if="source.sourceVersion" class="inp__ver">v{{ source.sourceVersion }}</span>
        </div>
        <div class="inp__crumbs">
          <button class="inp__crumb" @click="open(source, '')">input/</button>
          <template v-for="c in path" :key="c.folder">
            <span>/</span>
            <button class="inp__crumb" @click="open(source, c.folder)">{{ c.name }}</button>
          </template>
        </div>
        <ul class="inp__list">
          <li v-for="row in rows" :key="row.path" class="inp__row">
            <input
              type="checkbox"
              :checked="selected.has(selectKey(source, row))"
              :aria-label="`Select ${row.name}`"
              @change="toggle(source, row)"
            />
            <button
              v-if="row.type === 'folder'"
              class="inp__label inp__label--folder"
              :title="row.path"
              @click="open(source, row.path)"
            >
              📁 {{ row.name }}
            </button>
            <span v-else class="inp__label" :title="row.path">{{ row.name }}</span>
            <span class="inp__meta">
              <template v-if="row.type === 'folder'">{{ row.count }} · </template>{{ fmtSize(row.size) }}
            </span>
            <span
              v-if="row.status"
              class="inp__state"
              :class="`inp__state--${row.status.cls}`"
              :title="row.failed"
            >
              {{ row.status.text }}
            </span>
          </li>
        </ul>
      </div>

      <div v-if="sources.length" class="inp__foot">
        <p v-if="requestError" class="inp__msg inp__msg--error">{{ requestError }}</p>
        <el-button
          size="small"
          type="primary"
          :disabled="!pending.length"
          :loading="requesting"
          @click="download"
        >
          Download to session
          <template v-if="pending.length">
            ({{ pending.length }} file{{ pending.length === 1 ? "" : "s" }}, {{ fmtSize(pendingSize) }})
          </template>
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.inp {
  display: flex;
  flex-direction: column;
  max-height: 55%;
  min-height: 0;
  border-bottom: 1px solid #e5e5e5;
  border-right: 1px solid #e5e5e5;
  background: #f7f7f7;
  font-size: 13px;
}
.inp--collapsed {
  max-height: none;
}
.inp__head {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e5e5;
}
.inp__toggle {
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  color: #4d4d4d;
}
.inp__title {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.inp__source {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.inp__name {
  padding: 6px 10px 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inp__ver {
  font-weight: 400;
  color: #808080;
}
.inp__crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px 10px;
  color: #808080;
  font-size: 12px;
}
.inp__crumb {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: #5039f7; /* purple_2 */
}
.inp__list {
  list-style: none;
  margin: 0;
  padding: 0 0 4px;
  overflow: auto;
  flex: 1;
}
.inp__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
}
.inp__row:hover {
  background: #e6e9ef; /* purple_tint */
}
.inp__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inp__label--folder {
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}
.inp__meta {
  color: #999;
  font-size: 11px;
  white-space: nowrap;
}
.inp__state {
  font-size: 11px;
  white-space: nowrap;
}
.inp__state--done {
  color: #17bb62;
}
.inp__state--active,
.inp__state--partial {
  color: #5039f7;
}
.inp__state--failed {
  color: #c14d49;
}
.inp__foot {
  padding: 8px 10px;
  border-top: 1px solid #e5e5e5;
}
.inp__foot .el-button {
  width: 100%;
}
.inp__msg {
  padding: 6px 10px;
  margin: 0;
  color: #999;
  font-size: 12px;
}
.inp__msg--error {
  color: #c14d49;
  white-space: pre-wrap;
}
</style>
