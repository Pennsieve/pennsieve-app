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
import { fileIconForPath } from "@/utils/fileIconForPath";
import IconArrowUp from "@/components/icons/IconArrowUp.vue";
import IconDoneCheckCircle from "@/components/icons/IconDoneCheckCircle.vue";
import IconWarningCircle from "@/components/icons/IconWarningCircle.vue";
import {
  folderContents,
  filesUnder,
  inputKey,
  middleTruncate,
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

// The path to the current folder: the dataset root, then each folder. A deep
// path keeps its last two folders and folds the rest into "…", which opens
// the folder it stands for.
const MAX_CRUMBS = 2;

function crumbs(source) {
  const parts = source.folder ? source.folder.replace(/\/$/, "").split("/") : [];
  const all = parts.map((name, i) => ({ name, folder: parts.slice(0, i + 1).join("/") + "/" }));
  if (all.length <= MAX_CRUMBS) return all;
  const hidden = all[all.length - MAX_CRUMBS - 1];
  return [{ name: "…", folder: hidden.folder, title: source.folder }, ...all.slice(-MAX_CRUMBS)];
}

function up(source) {
  const parts = source.folder.replace(/\/$/, "").split("/");
  parts.pop();
  source.folder = parts.length ? `${parts.join("/")}/` : "";
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
      const summary = summarize(files, stateOf);
      return {
        ...row,
        label: middleTruncate(row.name, 26),
        status: rowStatus(summary),
        done: summary.total > 0 && summary.done === summary.total,
        failed,
      };
    }),
    // How much of the whole dataset is in the session.
    inSession: summarize(source.entries, (e) => states.value[inputKey(source.nodeId, e.cratePath)]).done,
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

// Every row of the folder that isn't already in the session, for "select all".
const selectable = (rows) => rows.filter((r) => !r.done);

function allSelected(source, rows) {
  const open = selectable(rows);
  return open.length > 0 && open.every((r) => selected.value.has(selectKey(source, r)));
}

function someSelected(source, rows) {
  return selectable(rows).some((r) => selected.value.has(selectKey(source, r)));
}

function toggleAll(source, rows) {
  const next = new Set(selected.value);
  const on = !allSelected(source, rows);
  for (const r of selectable(rows)) {
    if (on) next.add(selectKey(source, r));
    else next.delete(selectKey(source, r));
  }
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
      <button class="inp__toggle" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
        <span class="inp__caret">{{ collapsed ? "▸" : "▾" }}</span>
        <span class="inp__title">Inputs</span>
      </button>
    </div>

    <template v-if="!collapsed">
      <p v-if="loading" class="inp__msg">Loading the dataset's files…</p>
      <p v-else-if="error" class="inp__msg inp__msg--error">{{ error }}</p>

      <div v-for="{ source, crumbs: path, rows, inSession } in panes" :key="source.nodeId" class="inp__source">
        <div class="inp__dataset">
          <div class="inp__name" :title="source.name">{{ source.name }}</div>
          <div class="inp__sub">
            <span v-if="source.sourceVersion">Version {{ source.sourceVersion }} · </span>
            {{ inSession }} of {{ source.entries.length }} files in session
          </div>
        </div>

        <div class="inp__nav">
          <button
            class="inp__up"
            :disabled="!source.folder"
            title="Up one folder"
            aria-label="Up one folder"
            @click="up(source)"
          >
            <IconArrowUp :width="12" :height="12" />
          </button>
          <nav class="inp__crumbs" :title="source.folder || 'Dataset root'">
            <button class="inp__crumb" :class="{ 'is-current': !source.folder }" @click="open(source, '')">
              Dataset
            </button>
            <template v-for="(c, i) in path" :key="c.folder">
              <span class="inp__sep">/</span>
              <button
                class="inp__crumb"
                :class="{ 'is-current': i === path.length - 1 }"
                :title="c.title || c.name"
                @click="open(source, c.folder)"
              >
                {{ c.name }}
              </button>
            </template>
          </nav>
        </div>

        <label v-if="selectable(rows).length" class="inp__all">
          <input
            type="checkbox"
            :checked="allSelected(source, rows)"
            :indeterminate.prop="someSelected(source, rows) && !allSelected(source, rows)"
            @change="toggleAll(source, rows)"
          />
          Select all in this folder
        </label>

        <ul class="inp__list">
          <li
            v-for="row in rows"
            :key="row.path"
            class="inp__row"
            :class="{ 'is-selected': selected.has(selectKey(source, row)), 'is-done': row.done }"
          >
            <input
              type="checkbox"
              :checked="row.done || selected.has(selectKey(source, row))"
              :disabled="row.done"
              :aria-label="`Select ${row.name}`"
              @change="toggle(source, row)"
            />
            <button
              v-if="row.type === 'folder'"
              class="inp__label inp__label--folder"
              :title="`${row.path} · ${row.count} files · ${fmtSize(row.size)}`"
              @click="open(source, row.path)"
            >
              <img class="inp__icon" :src="fileIconForPath(row.name, { folder: true })" alt="" />
              <span class="inp__text">{{ row.label }}</span>
            </button>
            <span
              v-else
              class="inp__label"
              :title="`${row.path} · ${fmtSize(row.size)}`"
              @click="!row.done && toggle(source, row)"
            >
              <img class="inp__icon" :src="fileIconForPath(row.name)" alt="" />
              <span class="inp__text">{{ row.label }}</span>
            </span>

            <span v-if="row.status?.cls === 'done'" class="inp__state inp__state--done" title="In the session's input folder">
              <IconDoneCheckCircle :width="14" :height="14" />
            </span>
            <span
              v-else-if="row.status?.cls === 'failed'"
              class="inp__state inp__state--failed"
              :title="row.failed"
            >
              <IconWarningCircle :width="14" :height="14" />
            </span>
            <span
              v-else-if="row.status"
              class="inp__state"
              :class="`inp__state--${row.status.cls}`"
            >
              {{ row.status.text }}
            </span>
            <span v-else class="inp__meta">
              <template v-if="row.type === 'folder'">{{ row.count }} · </template>{{ fmtSize(row.size) }}
            </span>
          </li>
        </ul>
      </div>

      <div v-if="sources.length" class="inp__foot">
        <p v-if="requestError" class="inp__msg inp__msg--error">{{ requestError }}</p>
        <el-button
          v-if="pending.length || requesting"
          size="small"
          type="primary"
          :loading="requesting"
          @click="download"
        >
          Add {{ pending.length }} file{{ pending.length === 1 ? "" : "s" }} to session ({{ fmtSize(pendingSize) }})
        </el-button>
        <p v-else class="inp__hint">
          Select folders or files to add. They're copied into the notebook's input folder.
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.inp {
  display: flex;
  flex-direction: column;
  max-height: 60%;
  min-height: 0;
  border-bottom: 1px solid theme.$gray_2;
  border-right: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 13px;
}
.inp--collapsed {
  max-height: none;
}
.inp__head {
  padding: 8px 10px;
  border-bottom: 1px solid theme.$gray_2;
}
.inp__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  color: theme.$gray_5;
}
.inp__caret {
  width: 10px;
  font-size: 11px;
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
.inp__dataset {
  padding: 8px 10px 6px;
}
.inp__name {
  font-weight: 600;
  color: theme.$black;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.inp__sub {
  margin-top: 2px;
  font-size: 11px;
  color: theme.$gray_4;
}
.inp__nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-top: 1px solid theme.$gray_2;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$white;
}
.inp__up {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  color: theme.$gray_5;
  cursor: pointer;
}
.inp__up:disabled {
  color: theme.$gray_3;
  cursor: default;
}
.inp__crumbs {
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
}
.inp__crumb {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: theme.$purple_2;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}
.inp__crumb.is-current {
  color: theme.$purple_3;
  font-weight: 600;
  cursor: default;
}
.inp__sep {
  padding: 0 3px;
  color: theme.$gray_3;
}
.inp__all {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 2px;
  font-size: 11px;
  color: theme.$gray_4;
  cursor: pointer;
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
  padding: 3px 10px;
}
.inp__row:hover {
  background: theme.$gray_0;
}
.inp__row.is-selected {
  background: theme.$purple_tint;
}
.inp__row.is-done .inp__text {
  color: theme.$gray_4;
}
.inp__label {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.inp__label--folder {
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  font: inherit;
  color: inherit;
}
.inp__label--folder:hover .inp__text {
  color: theme.$purple_2;
  text-decoration: underline;
}
.inp__icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}
.inp__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inp__meta {
  color: theme.$gray_4;
  font-size: 11px;
  white-space: nowrap;
}
.inp__state {
  display: flex;
  align-items: center;
  font-size: 11px;
  white-space: nowrap;
}
.inp__state--done {
  color: theme.$green_1;
}
.inp__state--active,
.inp__state--partial {
  color: theme.$purple_2;
}
.inp__state--failed {
  color: theme.$red_2;
}
.inp__foot {
  padding: 8px 10px;
  border-top: 1px solid theme.$gray_2;
}
.inp__foot .el-button {
  width: 100%;
}
.inp__hint {
  margin: 0;
  font-size: 11px;
  color: theme.$gray_4;
  text-align: center;
}
.inp__msg {
  padding: 6px 10px;
  margin: 0;
  color: theme.$gray_4;
  font-size: 12px;
}
.inp__msg--error {
  color: theme.$red_2;
  white-space: pre-wrap;
}
</style>
