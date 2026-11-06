<script setup>
// The run's dataset-view inputs (a public dataset outside a workspace). The
// session starts with only each view's file list; the user browses it here,
// picks folders or files, and the session's sidecar downloads them into
// input/<data source>/ (useJupyterSession fetchInputs). The sidecar signs
// them with the run's own credential, so no link passes through the browser.
// While the session runs, another view can be added (a Pennsieve Discover
// dataset, or an AWS Open Data dataset or a folder of one) and a view removed: the sidecar lists what's
// staged (useJupyterSession inputSources), which can differ from the run's
// data sources.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import * as siteConfig from "@/site-config/site.json";
import { useGetToken } from "@/composables/useGetToken";
import { getView, listEntries, createOpenDataView, createDandiView, openDataViewName, viewForDataset } from "@/utils/viewsService";
import OpenDataPicker from "../OpenDataPicker.vue";
import DiscoverPicker from "../DiscoverPicker.vue";
import OpenNeuroPicker from "../OpenNeuroPicker.vue";
import { OPENNEURO_REGISTRY } from "@/utils/openNeuro";
import PortalPicker from "../PortalPicker.vue";
import DandiPicker from "../DandiPicker.vue";
import { DANDI_REGISTRY, dandiViewTitle } from "@/utils/dandi";
import { OPEN_DATA_PORTALS } from "@/utils/openDataPortals";
import PlatformMark from "../PlatformMark.vue";
import { DATA_PLATFORMS } from "../dataPlatforms";
import { fileIconForPath } from "@/utils/fileIconForPath";
import { ArrowRight } from "@element-plus/icons-vue";
import IconDoneCheckCircle from "@/components/icons/IconDoneCheckCircle.vue";
import IconWarningCircle from "@/components/icons/IconWarningCircle.vue";
import {
  folderContents,
  splitStacks,
  stackFormat,
  stackIcon,
  filesUnder,
  inputKey,
  middleTruncate,
  pendingFiles,
  rowStatus,
  summarize,
  addedSourceName,
  inputSubtitle,
  inputsDiskUse,
} from "./inputsHelpers";
import { useRememberedFold } from "./sectionFold";

const props = defineProps({
  runId: { type: String, required: true },
  fetchInputs: { type: Function, required: true },
  inputsStatus: { type: Function, required: true },
  // The sidecar's view sources, and adding and removing one; null when the
  // session can't change its inputs.
  inputSources: { type: Function, default: null },
  addInputSource: { type: Function, default: null },
  removeInputSource: { type: Function, default: null },
  ready: { type: Boolean, default: false },
  // The sidebar's width in px: long names are shortened to fit it.
  width: { type: Number, default: 300 },
});
// downloaded: files finished downloading, so the file browser can refresh.
// insert-stack: a stack's entry, to open in place from the notebook (the
// session writes its code).
const emit = defineEmits(["downloaded", "insert-stack"]);

// One per view source: { nodeId, viewId, version, name, entries, folder,
// added }. nodeId is the source's input folder: the run's data source, or
// the name an added view was staged under.
const sources = ref([]);
// Whether views can be added and removed while the session runs.
const canChange = ref(false);
// The session's disk, as the user chose it (the run's processorConfigs
// diskGiB); null for a session without one (GPU: its instance's disk).
const diskGiB = ref(null);
const loading = ref(false);
const hasViews = ref(false);
const error = ref(null);
// Folded or not, remembered in this browser.
const collapsed = useRememberedFold("inputs");

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
    const disks = (run.processorConfigs || []).map((c) => Number(c.diskGiB) || 0);
    diskGiB.value = Math.max(0, ...disks) || null;
    const runViews = Object.entries(run.dataSources || {}).filter(
      ([, ds]) => ds?.kind === "viewVersion"
    );
    // What the session has staged, when its sidecar can say; else the run's.
    let staged = null;
    if (props.inputSources) {
      try {
        staged = await props.inputSources();
      } catch (e) {
        console.warn("[inputs] sources:", e?.message || e);
      }
    }
    canChange.value = staged !== null && !!props.addInputSource;
    const list = staged
      ? staged
          .map((s) => ({
            // The view staged in input/ itself is the run's data source's.
            nodeId: s.root ? runViews.find(([, ds]) => ds.viewId === s.viewId)?.[0] || runViews[0]?.[0] || "" : s.name,
            // Its folder of input/, which the session's sidecar names.
            inputFolder: s.root ? "" : s.name,
            viewId: s.viewId,
            version: s.version,
            added: !!s.added,
          }))
          .filter((s) => s.nodeId)
      : runViews.map(([nodeId, ds]) => ({ nodeId, inputFolder: "", viewId: ds.viewId, version: ds.viewVersion, added: false }));
    if (!list.length && !canChange.value) return;
    hasViews.value = true;
    loading.value = true;
    const before = new Map(sources.value.map((s) => [s.nodeId, s]));
    sources.value = await Promise.all(
      list.map(async (s) => {
        const [view, entries] = await Promise.all([
          getView(s.viewId).catch(() => null),
          listEntries(s.viewId, s.version, { includeStacks: true }),
        ]);
        // Its files are downloaded; its stacks (a Zarr) are read in place.
        const { files, stacks } = splitStacks(entries);
        return {
          ...s,
          // An Open Data view's own name says which folder of the dataset
          // (an OpenNeuro dataset is a folder of the openneuro entry).
          name: (view?.sources?.[0]?.openDataset ? view?.name : view?.sources?.[0]?.name) || view?.name || "Dataset",
          sourceVersion: view?.sources?.[0]?.version,
          // To tell a view of the same files when one is added.
          viewName: view?.name || "",
          openDataset: view?.sources?.[0]?.openDataset || "",
          sourceDatasetId: view?.sources?.[0]?.datasetId || null,
          entries: files,
          stacks,
          folder: before.get(s.nodeId)?.folder || "",
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
// Drill-down, one level at a time: the session's inputs as a list, then one
// input's folders with a breadcrumb back ("Inputs / Spell-IT-Out / stimuli").
// A session with one input opens straight into it. current is the input
// browsed, by its source; "" for the list.
const current = ref("");
const browsed = computed(
  () => sources.value.find((s) => s.nodeId === current.value) || (sources.value.length === 1 ? sources.value[0] : null)
);

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


// About how many characters of a name fit beside a row's checkbox, icon and
// size, at the rows' 12px type.
const labelChars = computed(() => Math.max(16, Math.floor((props.width - 120) / 6.4)));

// How much of an input is in the session.
const inSessionOf = (source) => summarize(source.entries, (e) => states.value[inputKey(source.nodeId, e.cratePath)]).done;

// The list of inputs: each with its name, where it came from and its
// folder, and how much is in the session.
const inputRows = computed(() =>
  sources.value.map((source) => ({
    source,
    subtitle: inputSubtitle({ openDataset: source.openDataset, sourceVersion: source.sourceVersion, folder: source.inputFolder }),
    // Cut at its end by the row (CSS): a name is known by its start.
    label: source.name,
    inSession: inSessionOf(source),
    total: source.entries.length,
  }))
);

// The input browsed's second line, as its row in the list.
const paneSubtitle = computed(() => {
  const source = browsed.value;
  return source ? inputSubtitle({ openDataset: source.openDataset, sourceVersion: source.sourceVersion, folder: source.inputFolder }) : "";
});

// The input browsed: its current folder, its rows with download badges.
// Computed once per change, not per row: a view can have thousands of files.
const pane = computed(() => {
  const source = browsed.value;
  if (!source) return null;
  return {
    source,
    crumbs: crumbs(source),
    rows: folderContents(source.entries, source.folder, source.stacks).map((row) => {
      if (row.type === "stack") {
        return { ...row, label: middleTruncate(row.name, labelChars.value), format: stackFormat(row.entry) };
      }
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
        label: middleTruncate(row.name, labelChars.value),
        status: rowStatus(summary),
        done: summary.total > 0 && summary.done === summary.total,
        failed,
      };
    }),
    // How much of the whole dataset is in the session.
    inSession: inSessionOf(source),
  };
});
// An input that's gone (removed) isn't browsed.
watch(sources, (list) => {
  if (current.value && !list.some((s) => s.nodeId === current.value)) current.value = "";
});

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
// A stack is read in place: there's nothing of it to download.
const selectable = (rows) => rows.filter((r) => !r.done && r.type !== "stack");

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
// What the downloaded inputs take of the session's disk.
const inputBytes = computed(() =>
  Object.values(states.value).reduce((n, st) => n + (st?.state === "done" ? st.size || st.bytes || 0 : 0), 0)
);
const diskUse = computed(() => inputsDiskUse(inputBytes.value, diskGiB.value));

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

/* ------------------------------------------------- adding and removing --- */
// Another view while the session runs, from a data platform: a Pennsieve
// Discover dataset version, or an OpenNeuro, SPARC, Epilepsy.Science or AWS
// Open Data dataset or a folder of one, or a dandiset version or a folder
// of it, made into a view and staged as input/<name>/.
const addOpen = ref(false);
const addPlatform = ref("discover");
const addDataset = ref(null);
const addPrefix = ref("");
const addDiscover = ref(null);
const addDiscoverVersion = ref(null);
const addOpenNeuro = ref(null);
const addOpenNeuroPrefix = ref("");
const addDandi = ref(null);
const addDandiPrefix = ref("");
// A SPARC or Epilepsy.Science dataset: a folder of the portal's Open Data
// entry. Choosing the other portal starts over.
const addPortal = ref(null);
const addPortalPrefix = ref("");
const addIsPortal = computed(() => addPlatform.value in OPEN_DATA_PORTALS);
const addRegistry = computed(() => OPEN_DATA_PORTALS[addPlatform.value]?.registry || "");
watch(addPlatform, () => {
  addPortal.value = null;
  addPortalPrefix.value = "";
});
const adding = ref(false);
const addError = ref(null);

function openAdd() {
  addDataset.value = null;
  addPrefix.value = "";
  addDiscover.value = null;
  addDiscoverVersion.value = null;
  addOpenNeuro.value = null;
  addOpenNeuroPrefix.value = "";
  addDandi.value = null;
  addDandiPrefix.value = "";
  addPortal.value = null;
  addPortalPrefix.value = "";
  addError.value = null;
  addOpen.value = true;
}

const addReady = computed(() =>
  addPlatform.value === "discover"
    ? !!addDiscover.value
    : addPlatform.value === "openNeuro"
    ? !!addOpenNeuro.value
    : addPlatform.value === "dandi"
    ? !!addDandi.value
    : addIsPortal.value
    ? !!addPortal.value
    : !!addDataset.value
);

// A source already in the session with the same files: the same Discover
// dataset version, or the same Open Data dataset and folder.
const addDuplicate = computed(() => {
  if (addPlatform.value === "discover") {
    const d = addDiscover.value;
    if (!d) return null;
    return sources.value.find((s) => s.sourceDatasetId === d.id && s.sourceVersion === addDiscoverVersion.value) || null;
  }
  if (addPlatform.value === "openNeuro") {
    const d = addOpenNeuro.value;
    if (!d) return null;
    const name = openDataViewName(d.name, addOpenNeuroPrefix.value);
    return sources.value.find((s) => s.openDataset === OPENNEURO_REGISTRY && s.viewName === name) || null;
  }
  if (addPlatform.value === "dandi") {
    const d = addDandi.value;
    if (!d) return null;
    const name = openDataViewName(dandiViewTitle(d), addDandiPrefix.value);
    return sources.value.find((s) => s.openDataset === DANDI_REGISTRY && s.viewName === name) || null;
  }
  if (addIsPortal.value) {
    const d = addPortal.value;
    if (!d) return null;
    const name = openDataViewName(d.name, addPortalPrefix.value);
    return sources.value.find((s) => s.openDataset === addRegistry.value && s.viewName === name) || null;
  }
  const d = addDataset.value;
  if (!d) return null;
  const name = openDataViewName(d.title, addPrefix.value);
  return sources.value.find((s) => s.openDataset === d.name && s.viewName === name) || null;
});
const addDuplicateLabel = computed(() =>
  addPlatform.value === "discover"
    ? `Version ${addDiscoverVersion.value} of ${addDiscover.value?.name}`
    : addPlatform.value === "openNeuro"
    ? `This folder of ${addOpenNeuro.value?.name}`
    : addPlatform.value === "dandi"
    ? `This folder of ${addDandi.value?.name} (${addDandi.value?.version})`
    : addIsPortal.value
    ? `This folder of ${addPortal.value?.name}`
    : `This folder of ${addDataset.value?.title}`
);

async function addData() {
  if (!addReady.value || adding.value || addDuplicate.value) return;
  adding.value = true;
  addError.value = null;
  try {
    let view, folder;
    if (addPlatform.value === "discover") {
      const d = addDiscover.value;
      view = await viewForDataset({ datasetId: d.id, version: addDiscoverVersion.value, name: d.name });
      folder = (n) => `dataset-${d.id}-v${addDiscoverVersion.value}${n > 1 ? `-${n}` : ""}`;
    } else if (addPlatform.value === "openNeuro") {
      const d = addOpenNeuro.value;
      view = await createOpenDataView({ dataset: OPENNEURO_REGISTRY, title: d.name, prefix: addOpenNeuroPrefix.value });
      folder = (n) => addedSourceName(OPENNEURO_REGISTRY, addOpenNeuroPrefix.value, n);
    } else if (addPlatform.value === "dandi") {
      const d = addDandi.value;
      const p = addDandiPrefix.value;
      view = await createDandiView({ dandiset: d.id, version: d.version, title: dandiViewTitle(d), prefix: p });
      folder = (n) => addedSourceName(DANDI_REGISTRY, p || `${d.id}/`, n);
    } else if (addIsPortal.value) {
      const d = addPortal.value;
      const registry = addRegistry.value;
      view = await createOpenDataView({ dataset: registry, title: d.name, prefix: addPortalPrefix.value });
      folder = (n) => addedSourceName(registry, addPortalPrefix.value, n);
    } else {
      const d = addDataset.value;
      view = await createOpenDataView({ dataset: d.name, title: d.title, prefix: addPrefix.value });
      folder = (n) => addedSourceName(d.name, addPrefix.value, n);
    }
    // The next free folder name: input/ may hold one already.
    let added = "";
    for (let n = 1; ; n++) {
      try {
        await props.addInputSource(folder(n), view.id, view.version);
        added = folder(n);
        break;
      } catch (e) {
        if (e?.status !== 409 || n >= 20) throw e;
      }
    }
    addOpen.value = false;
    await loadSources();
    // Straight into it, to pick its files.
    current.value = added;
  } catch (e) {
    addError.value = e?.message || String(e);
  } finally {
    adding.value = false;
  }
}

const removing = ref("");

async function remove(source) {
  try {
    await ElMessageBox.confirm(
      `Remove ${source.name} from the session? Files already downloaded from it stay in input/.`,
      "Remove input",
      { confirmButtonText: "Remove", cancelButtonText: "Cancel", type: "warning" }
    );
  } catch {
    return; // cancelled
  }
  removing.value = source.nodeId;
  requestError.value = null;
  try {
    await props.removeInputSource(source.nodeId);
    const next = new Set([...selected.value].filter((k) => !k.startsWith(inputKey(source.nodeId, ""))));
    selected.value = next;
    await loadSources();
  } catch (e) {
    requestError.value = e?.message || String(e);
  } finally {
    removing.value = "";
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
  <div v-if="loading || sources.length || canChange || (error && hasViews)" class="inp" :class="{ 'inp--collapsed': collapsed }">
    <!-- The section's header, with its action, as Session files' has its refresh -->
    <div class="inp__head" @click="collapsed = !collapsed">
      <span class="inp__title">Inputs</span>
      <span class="inp__head-actions">
        <button v-if="canChange && !collapsed" class="inp__add" title="Add a dataset to the session" @click.stop="openAdd">
          + Add data
        </button>
        <button class="inp__fold" :aria-expanded="!collapsed" aria-label="Fold inputs" @click.stop="collapsed = !collapsed">
          <el-icon class="inp__chevron" :class="{ 'is-open': !collapsed }"><ArrowRight /></el-icon>
        </button>
      </span>
    </div>

    <template v-if="!collapsed">
      <p v-if="loading" class="inp__msg">Loading the dataset's files…</p>
      <p v-else-if="error" class="inp__msg inp__msg--error">{{ error }}</p>

      <div v-if="pane" class="inp__source">
        <!-- The input: back to the list, its name, how much is in the session -->
        <div class="inp__nav">
          <button
            v-if="sources.length > 1"
            class="inp__back"
            title="All inputs"
            aria-label="All inputs"
            @click="current = ''"
          >
            <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <span
            class="inp__input-title"
            :title="pane.source.sourceVersion ? `${pane.source.name}, version ${pane.source.sourceVersion}` : pane.source.name"
          >
            {{ pane.source.name }}
          </span>
          <span class="inp__count" :title="`${pane.inSession} of ${pane.source.entries.length} files in the session`">
            {{ pane.inSession }}/{{ pane.source.entries.length }}
          </span>
          <button
            v-if="canChange && removeInputSource"
            class="inp__bin"
            :disabled="removing === pane.source.nodeId"
            title="Remove from session"
            :aria-label="`Remove ${pane.source.name} from the session`"
            @click="remove(pane.source)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 9h6.6l.7-9M6.8 7v4.5M9.2 7v4.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <!-- Where it came from and its folder -->
        <div class="inp__detail" :class="{ 'inp__detail--under-back': sources.length > 1 }">
          <span class="inp__detail-sub">{{ paneSubtitle }}</span>
        </div>
        <!-- Where in it: its top, then each folder -->
        <nav v-if="pane.source.folder" class="inp__path" aria-label="Folder">
          <button class="inp__crumb" @click="open(pane.source, '')">All files</button>
          <template v-for="(c, i) in pane.crumbs" :key="c.folder">
            <span class="inp__sep">/</span>
            <button
              class="inp__crumb"
              :class="{ 'is-current': i === pane.crumbs.length - 1 }"
              :title="c.title || c.name"
              @click="open(pane.source, c.folder)"
            >
              {{ c.name }}
            </button>
          </template>
        </nav>

        <label v-if="selectable(pane.rows).length" class="inp__all">
          <input
            type="checkbox"
            :checked="allSelected(pane.source, pane.rows)"
            :indeterminate.prop="someSelected(pane.source, pane.rows) && !allSelected(pane.source, pane.rows)"
            @change="toggleAll(pane.source, pane.rows)"
          />
          Select all in this folder
        </label>

        <ul class="inp__list">
          <li
            v-for="row in pane.rows"
            :key="row.path"
            class="inp__row"
            :class="{ 'is-selected': selected.has(selectKey(pane.source, row)), 'is-done': row.done, 'is-stack': row.type === 'stack' }"
          >
            <!-- A Zarr: read in place from the notebook, not downloaded. Its
                 size, and on hover the code that opens it, where a file's
                 size is; its checkbox keeps only its place. -->
            <template v-if="row.type === 'stack'">
              <input type="checkbox" class="inp__stack-gap" disabled tabindex="-1" aria-hidden="true" />
              <span class="inp__label inp__label--stack" :title="`${row.path}\n${row.format}, read in place from the notebook · ${fmtSize(row.size)}`">
                <img class="inp__icon" :src="stackIcon(row.entry)" alt="" />
                <span class="inp__text">{{ row.label }}</span>
              </span>
              <span class="inp__meta inp__stack-size">{{ fmtSize(row.size) }}</span>
              <button
                type="button"
                class="inp__stack-code"
                :title="`Add code that opens this ${row.format} in place to the notebook`"
                @click="emit('insert-stack', row.entry)"
              >
                Code
              </button>
            </template>
            <template v-else>
            <input
              type="checkbox"
              :checked="row.done || selected.has(selectKey(pane.source, row))"
              :disabled="row.done"
              :aria-label="`Select ${row.name}`"
              @change="toggle(pane.source, row)"
            />
            <button
              v-if="row.type === 'folder'"
              class="inp__label inp__label--folder"
              :title="`${row.path} · ${row.count} files · ${fmtSize(row.size)}`"
              @click="open(pane.source, row.path)"
            >
              <img class="inp__icon" :src="fileIconForPath(row.name, { folder: true })" alt="" />
              <span class="inp__text">{{ row.label }}</span>
            </button>
            <span
              v-else
              class="inp__label"
              :title="`${row.path} · ${fmtSize(row.size)}`"
              @click="!row.done && toggle(pane.source, row)"
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
            </template>
          </li>
        </ul>
      </div>

      <!-- The session's inputs: open one to pick its files. -->
      <ul v-else-if="sources.length" class="inp__inputs">
        <li v-for="r in inputRows" :key="r.source.nodeId">
          <div
            class="inp__input"
            role="button"
            tabindex="0"
            :title="`${r.source.name} · ${r.inSession} of ${r.total} files in the session`"
            @click="current = r.source.nodeId"
            @keydown.enter.prevent="current = r.source.nodeId"
          >
            <span class="inp__input-text">
              <span class="inp__input-name" :title="r.source.name">{{ r.label }}</span>
              <span class="inp__input-sub" :title="`${r.subtitle} (in input/)`">{{ r.subtitle }}</span>
            </span>
            <span class="inp__count">{{ r.inSession }}/{{ r.total }}</span>
            <svg class="inp__chevron-right" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
        </li>
      </ul>

      <div v-if="sources.length" class="inp__foot">
        <div class="inp__disk" :title="'Files you add from the inputs, against the disk the session was started with. The environment and your own files use it too.'">
          <span class="inp__disk-text">{{ diskUse.text }}</span>
          <span v-if="diskUse.share != null" class="inp__disk-bar" :class="{ 'is-full': diskUse.full }">
            <span :style="{ width: `${Math.max(diskUse.share * 100, 1)}%` }" />
          </span>
        </div>
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
      </div>
      <p v-else-if="requestError" class="inp__msg inp__msg--error">{{ requestError }}</p>
    </template>

    <el-dialog v-model="addOpen" title="Add data to the session" width="min(820px, 96vw)" append-to-body>
      <div class="inp__platforms" role="tablist">
        <button
          v-for="(p, key) in DATA_PLATFORMS"
          :key="key"
          type="button"
          role="tab"
          class="inp__platform"
          :class="{ 'is-picked': addPlatform === key }"
          :aria-selected="addPlatform === key"
          @click="addPlatform = key"
        >
          <PlatformMark :platform="key" :size="32" />
          <span class="inp__platform-text">
            <span class="inp__platform-name">{{ p.name }}</span>
            <span class="inp__platform-desc">{{ p.desc }}</span>
          </span>
        </button>
      </div>
      <p class="inp__dialog-desc">Its file list joins the Inputs panel; you pick which files to download.</p>
      <template v-if="addOpen">
        <DiscoverPicker
          v-if="addPlatform === 'discover'"
          v-model:dataset="addDiscover"
          v-model:version="addDiscoverVersion"
        />
        <OpenNeuroPicker
          v-else-if="addPlatform === 'openNeuro'"
          v-model:dataset="addOpenNeuro"
          v-model:prefix="addOpenNeuroPrefix"
        />
        <DandiPicker
          v-else-if="addPlatform === 'dandi'"
          v-model:dataset="addDandi"
          v-model:prefix="addDandiPrefix"
        />
        <PortalPicker
          v-else-if="addIsPortal"
          :key="addPlatform"
          :portal="addPlatform"
          v-model:dataset="addPortal"
          v-model:prefix="addPortalPrefix"
        />
        <OpenDataPicker v-else v-model:dataset="addDataset" v-model:prefix="addPrefix" />
      </template>
      <p v-if="addDuplicate" class="inp__msg inp__msg--error">
        {{ addDuplicateLabel }} is already in the session, as input/{{ addDuplicate.nodeId }}/.
      </p>
      <p v-if="addError" class="inp__msg inp__msg--error">{{ addError }}</p>
      <template #footer>
        <el-button @click="addOpen = false">Cancel</el-button>
        <el-button type="primary" :disabled="!addReady || !!addDuplicate" :loading="adding" @click="addData">Add to session</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use "sass:color";
@use "../../../styles/theme";

.inp {
  display: flex;
  flex-direction: column;
  max-height: 60%;
  min-height: 0;
  border-bottom: 1px solid color.mix(theme.$gray_2, theme.$gray_3); /* between sections: a touch stronger than the lines inside */
  border-right: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 13px;
}
.inp--collapsed {
  max-height: none;
}
/* Open, the section keeps a steady height whether it shows the list of
   inputs or a short folder, so Session files below doesn't jump; it grows
   with content up to its max-height. The list or folder fills it, and the
   hint and download button stay at the bottom. */
.inp:not(.inp--collapsed) {
  min-height: 240px;
}
/* The list of inputs: rows like the folder rows, on the panel's own
   background. */
.inp__back {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-left: -4px;
  border: none;
  border-radius: 3px;
  background: none;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    background: theme.$gray_0;
    color: theme.$gray_6;
  }
}
.inp__input-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
}
.inp__detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 12px 8px;
  border-bottom: 1px solid theme.$gray_2;
}
/* Lined up under the name, past the back chevron. */
.inp__detail--under-back {
  padding-left: 34px;
}
.inp__bin {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 2px;
  border-radius: 3px;
  color: theme.$gray_4;
  cursor: pointer;

  &:hover {
    background: theme.$gray_0;
    color: theme.$gray_6;
  }
  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
}
.inp__detail-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: theme.$gray_4;
}
.inp__path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px 12px 2px;
  font-size: 12px;
}
.inp__inputs {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
}
.inp__input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;

  &:hover {
    background: theme.$gray_0;
  }
  &:hover .inp__chevron-right {
    color: theme.$gray_5;
  }
}
.inp__input-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.inp__input-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_6;
}
.inp__input-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: theme.$gray_4;
}
.inp__disk {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.inp__disk-text {
  font-size: 11px;
  color: theme.$gray_4;
}
.inp__disk-bar {
  display: block;
  height: 3px;
  border-radius: 2px;
  background: theme.$gray_2;
  overflow: hidden;

  > span {
    display: block;
    height: 100%;
    background: theme.$purple_1;
  }
  &.is-full > span {
    background: theme.$orange_1;
  }
}
.inp__chevron-right {
  flex-shrink: 0;
  color: theme.$gray_3;
}
.inp__dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$gray_5;
}
.inp__platforms {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.inp__platform {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
  /* Calm: a thin accent on the left and a faint tint. */
  &.is-picked {
    background: theme.$gray_1;
    box-shadow: inset 2px 0 0 theme.$purple_3;
  }
}
.inp__platform-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.inp__platform-name {
  font-weight: 600;
  font-size: 14px;
  color: theme.$gray_6;
}
.inp__platform-desc {
  font-size: 12px;
  color: theme.$gray_4;
}
/* Section header as the app's side-panel accordions: title, chevron right. */
/* Section header as the workflow builder's panel headings (_sidePanel.scss
   .panel-heading): a small uppercase label on the panel's own background,
   no line under it (sections are set apart by a stronger line between
   them); its actions and chevron on the right. */
.inp__head {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-bottom: none;
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
/* Folded, the section's own border is the only line under it. */
.inp--collapsed .inp__head {
  border-bottom: none;
}
.inp__head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.inp__add {
  border: none;
  background: none;
  padding: 2px 4px;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$gray_6;
    text-decoration: underline;
  }
}
.inp__fold {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  padding: 2px 4px;
  cursor: pointer;
}
.inp__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.inp__chevron {
  color: theme.$gray_5;
  transition: transform 0.2s ease;
}
.inp__chevron.is-open {
  transform: rotate(90deg);
}
.inp__source {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
/* The input open: on the panel's own background, as the list it replaces,
   with a hairline under it. */
.inp__nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 2px;
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
  color: theme.$link-color;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}
/* The dataset's name takes what room the folders leave, and gives it up first. */
.inp__crumb--root {
  max-width: none;
  min-width: 48px;
  flex-shrink: 1;
}
.inp__crumb:not(.inp__crumb--root) {
  flex-shrink: 0;
}
.inp__count {
  flex-shrink: 0;
  margin-left: auto;
  padding-left: 6px;
  font-size: 11px;
  color: theme.$gray_4;
}
.inp__crumb:not(.is-current):hover {
  color: theme.$link-color-hover;
}
/* Where you are is plain text; the folders above it are links. */
.inp__crumb.is-current {
  color: theme.$gray_6;
  font-weight: 500;
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
/* The sidebar's sizes: 13px medium for the title of what's shown (the
   environment, the open input), 12px for list rows (inputs, files, as the
   Session files tree), 11px for second lines, counts and labels. */
.inp__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-size: 12px;
}
.inp__row:hover {
  background: theme.$gray_0;
}
.inp__row.is-selected {
  background: theme.$purple_tint;
}
/* A file in the session is shown as usual, with its check; it has nothing
   left to select, so its checkbox keeps only its place. */
.inp__row.is-done input[type="checkbox"] {
  visibility: hidden;
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
  color: theme.$link-color;
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
/* A stack has nothing to select: its checkbox keeps only its place, so
   names line up with the files'. */
.inp__stack-gap {
  visibility: hidden;
}
.inp__label--stack {
  cursor: default;
}
/* Its size, or on hover (or keyboard focus) the code that opens it: hidden
   but still reachable from the keyboard. */
.inp__stack-code {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 11px;
  color: theme.$purple_2;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
.inp__row.is-stack:hover,
.inp__row.is-stack:focus-within {
  .inp__stack-size {
    display: none;
  }
  .inp__stack-code {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip-path: none;
  }
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
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid theme.$gray_2;
}
.inp__foot .el-button {
  width: 100%;
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
