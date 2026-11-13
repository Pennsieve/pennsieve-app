// The session's view inputs, as the Session files tree shows them: each
// view is a folder of input/, and what it holds shows there whether it's on
// the session's disk or not yet. The session's sidecar downloads what the
// user asks for (useJupyterSession fetchInputs), signing it with the run's
// own credential, and says how far each file has got (inputsStatus); it can
// stop them (cancelInputs, on a sidecar new enough). While the session
// runs, views can be added (AddDataDialog) and removed: the sidecar lists
// what's staged (inputSources), which can differ from the run's data
// sources.
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { ElMessageBox } from "element-plus";
import * as siteConfig from "@/site-config/site.json";
import { useGetToken } from "@/composables/useGetToken";
import { CancelUnavailable } from "@/composables/useJupyterSession";
import { getView, listEntries } from "@/utils/viewsService";
import {
  folderContents,
  splitStacks,
  inputKey,
  inputsDiskUse,
  inputSubtitle,
  transferCost,
  readCostNoted,
  writeCostNoted,
} from "./inputsHelpers";
import { platformReading } from "../platforms";

const POLL_MS = 2000;
const GiB = 2 ** 30;

// A view's folder in the session's tree: input/<its folder>, or input/
// itself for a view staged there (an older sidecar).
export const sourceBase = (source) => (source.inputFolder ? `input/${source.inputFolder}` : "input");

// The view a folder of the tree is in, and the folder in it ("" or "a/b/"),
// or null: the source whose folder is the longest that holds it.
export function sourceAt(sources, dirPath) {
  let best = null;
  for (const s of sources) {
    const base = sourceBase(s);
    if (dirPath !== base && !dirPath.startsWith(`${base}/`)) continue;
    if (!best || base.length > sourceBase(best).length) best = s;
  }
  if (!best) return null;
  const base = sourceBase(best);
  return { source: best, rel: dirPath === base ? "" : `${dirPath.slice(base.length + 1)}/` };
}

// Whether views can be added to the session: as its sidecar says, or, from a
// sidecar that doesn't say, on a node that isn't compliant (whose sidecar
// couldn't fetch a view's crate then).
export function canAddViews(sidecarSays, node) {
  if (typeof sidecarSays === "boolean") return sidecarSays;
  return (node?.deploymentMode || "").toLowerCase() !== "compliant";
}

// When a download is big enough to ask first: over 1 GiB, or over a tenth
// of the disk left, whichever is less. null when it doesn't fit at all.
export function downloadCheck(bytes, freeBytes) {
  if (freeBytes != null && bytes > freeBytes) return { fits: false, ask: true };
  const limit = Math.min(GiB, freeBytes != null ? freeBytes / 10 : GiB);
  return { fits: true, ask: bytes > limit };
}

// runId is the run's id, or a function that says it (a page that switches
// runs). node says the session's compute node ({ region, deploymentMode }),
// when known: a download from another region can cost its account.
export function useSessionInputs({
  node = () => null,
  runId,
  fetchInputs,
  inputsStatus,
  cancelInputs,
  inputSources,
  addInputSource,
  removeInputSource,
  ready,
  onDownloaded,
}) {
  // One per view: { nodeId, inputFolder, viewId, version, name, subtitle,
  // viewName, openDataset, sourceDatasetId, sourceVersion, entries, stacks }.
  // nodeId names it to the sidecar: the run's data source, or the folder an
  // added view was staged in.
  const sources = ref([]);
  // Whether views can be added and removed while the session runs.
  const canChange = ref(false);
  // Whether the session's sidecar says it can add views (null when it
  // doesn't say: one from before compliant sessions could add them).
  const sidecarCanAdd = ref(null);
  // The disk the session was started with (GiB); null for one without
  // (a GPU session: its instance's).
  const diskGiB = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const requestError = ref(null);
  // The sidecar's state of every file asked for: key -> { state, size, bytes, error }.
  const states = ref({});
  // Files ticked to download together: key -> { source, path, size }.
  const selected = ref(new Map());
  let pollTimer = null;
  let doneCount = 0;

  async function loadSources() {
    error.value = null;
    loading.value = true;
    try {
      const token = await useGetToken();
      const id = typeof runId === "function" ? runId() : runId;
      const resp = await fetch(`${siteConfig.api2Url}/compute/workflows/runs/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Could not read the run (${resp.status}).`);
      const run = await resp.json();
      const disks = (run.processorConfigs || []).map((c) => Number(c.diskGiB) || 0);
      diskGiB.value = Math.max(0, ...disks) || null;
      const runViews = Object.entries(run.dataSources || {}).filter(([, ds]) => ds?.kind === "viewVersion");
      // What the session has staged, when its sidecar can say; else the run's.
      let staged = null;
      if (inputSources) {
        try {
          staged = await inputSources();
        } catch (e) {
          console.warn("[inputs] sources:", e?.message || e);
        }
      }
      canChange.value = staged !== null && !!addInputSource;
      sidecarCanAdd.value = typeof staged?.canAdd === "boolean" ? staged.canAdd : null;
      const list = staged
        ? staged
            .map((s) => ({
              // The view staged in input/ itself is the run's data source's.
              nodeId: s.root ? runViews.find(([, ds]) => ds.viewId === s.viewId)?.[0] || runViews[0]?.[0] || "" : s.name,
              inputFolder: s.root ? "" : s.name,
              viewId: s.viewId,
              version: s.version,
              // The models whose records are in the session already
              // (staged before it started): the sidecar's objects
              // { name, version, schema, records } (paths in the folder),
              // not the plain names a picker holds.
              models: s.models || [],
            }))
            .filter((s) => s.nodeId)
        : runViews.map(([nodeId, ds]) => ({ nodeId, inputFolder: "", viewId: ds.viewId, version: ds.viewVersion, models: [] }));
      sources.value = await Promise.all(
        list.map(async (s) => {
          const [view, entries] = await Promise.all([
            getView(s.viewId).catch(() => null),
            listEntries(s.viewId, s.version, { includeStacks: true }),
          ]);
          // Its files are downloaded; its stacks (a Zarr, a precomputed
          // volume) are read in place.
          const { files, stacks } = splitStacks(entries);
          const first = view?.sources?.[0] || {};
          return {
            ...s,
            // An Open Data view's own name says which folder of the dataset.
            name: (first.openDataset ? view?.name : first.name) || view?.name || "Dataset",
            subtitle: inputSubtitle({
              platform: platformReading(first.openDataset, first.publisher)?.name,
              openDataset: first.openDataset || "",
              sourceVersion: first.version,
            }),
            viewName: view?.name || "",
            openDataset: first.openDataset || "",
            sourceDatasetId: first.datasetId || null,
            sourceVersion: first.version,
            entries: files,
            stacks,
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
    const files = await inputsStatus();
    const next = {};
    for (const f of files) next[inputKey(f.source, f.path)] = f;
    states.value = next;
    const done = files.filter((f) => f.state === "done").length;
    if (done > doneCount) onDownloaded?.();
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
    ready,
    (r) => {
      if (r && !sources.value.length && !loading.value) loadSources();
    },
    { immediate: true }
  );
  onBeforeUnmount(() => clearTimeout(pollTimer));

  /* ------------------------------------------------------------- the tree --- */
  // What a folder of the tree holds from the views, beside what's on disk:
  // { name, type: folder|file|stack, size, count, source, entry, rel }. At
  // input/, the views' own folders.
  function overlay(dirPath) {
    const rows = [];
    if (dirPath === "input") {
      for (const s of sources.value) if (s.inputFolder) rows.push({ name: s.inputFolder, type: "folder", source: s, rel: "", root: true });
    }
    const at = sourceAt(sources.value, dirPath);
    if (at) {
      for (const r of folderContents(at.source.entries, at.rel, at.source.stacks)) {
        rows.push({ ...r, source: at.source, rel: r.type === "folder" ? r.path : at.rel });
      }
    }
    return rows;
  }

  const stateOf = (source, path) => states.value[inputKey(source.nodeId, path)];
  // The files of a view under a folder of it ("" for all).
  const filesIn = (source, rel) => source.entries.filter((e) => e.cratePath.startsWith(rel));
  // How much of a view's folder is in the session: { done, total }.
  function folderProgress(source, rel) {
    const files = filesIn(source, rel);
    let done = 0;
    for (const e of files) if (stateOf(source, e.cratePath)?.state === "done") done++;
    return { done, total: files.length };
  }
  // Its files not in the session and not under way.
  const remainingIn = (source, rel) =>
    filesIn(source, rel).filter((e) => !["done", "queued", "downloading"].includes(stateOf(source, e.cratePath)?.state));

  /* -------------------------------------------------------- downloading --- */
  const inputBytes = computed(() =>
    Object.values(states.value).reduce((n, st) => n + (st?.state === "done" ? st.size || st.bytes || 0 : 0), 0)
  );
  // What's still to come of downloads under way.
  const active = computed(() => Object.values(states.value).filter((st) => st.state === "queued" || st.state === "downloading"));
  const activeLeft = computed(() => active.value.reduce((n, st) => n + Math.max(0, (st.size || 0) - (st.bytes || 0)), 0));
  const diskUse = computed(() => inputsDiskUse(inputBytes.value, diskGiB.value));
  // The disk left for more, as far as the inputs say (the environment and
  // the user's own files use it too); null when the disk isn't known.
  const freeBytes = computed(() => (diskGiB.value ? Math.max(0, diskGiB.value * GiB - inputBytes.value - activeLeft.value) : null));
  /* --------------------------------------------------------- what it costs --- */
  const currentRun = () => (typeof runId === "function" ? runId() : runId);
  // Whether the user said not to be told again in this session.
  const costNoted = ref(readCostNoted(currentRun()));
  watch(
    () => currentRun(),
    (id) => (costNoted.value = readCostNoted(id))
  );
  function noteCost() {
    costNoted.value = true;
    writeCostNoted(currentRun());
  }
  const entryOf = (source, path) => source.entries.find((e) => e.cratePath === path);
  // What downloading these ([{ source, path }] or entries of a source) would
  // cost the node's account: transferCost's, or null when nothing, or when
  // the user said not to be told again.
  function costOf(files) {
    if (costNoted.value) return null;
    const list = files.map((f) => {
      const e = f.cratePath ? f : entryOf(f.source, f.path);
      return { size: e?.size || f.size || 0, region: e?.region || "" };
    });
    return transferCost(list, node());
  }

  // Whether to ask before downloading: when it's big for the disk, or costs
  // the node's account (files, when given, say which).
  const check = (bytes, files = []) => {
    const c = downloadCheck(bytes, freeBytes.value);
    const cost = files.length ? costOf(files) : null;
    return { ...c, ask: c.ask || !!cost, cost };
  };

  // Asks the sidecar for files: [{ source, path }].
  async function request(files) {
    if (!files.length) return;
    requestError.value = null;
    try {
      await fetchInputs(files.map(({ source, path }) => ({ source: source.nodeId, path })));
      await refreshStatus();
    } catch (e) {
      requestError.value = e?.message || String(e);
    }
  }
  const requestEntries = (source, entries) => request(entries.map((e) => ({ source, path: e.cratePath })));

  async function cancel(files) {
    requestError.value = null;
    try {
      await cancelInputs(files.map(({ source, path }) => ({ source: source.nodeId, path })));
      await refreshStatus();
    } catch (e) {
      requestError.value =
        e instanceof CancelUnavailable ? "This session can't cancel downloads yet: its compute node needs an update." : e?.message || String(e);
    }
  }
  // Every download under way.
  function cancelAll() {
    const bySource = new Map(sources.value.map((s) => [s.nodeId, s]));
    return cancel(
      active.value.filter((st) => bySource.has(st.source)).map((st) => ({ source: bySource.get(st.source), path: st.path }))
    );
  }

  /* ------------------------------------------------------------- selection --- */
  const selectKey = (source, path) => inputKey(source.nodeId, path);
  const isSelected = (source, path) => selected.value.has(selectKey(source, path));
  function toggleSelect(source, entry) {
    const next = new Map(selected.value);
    const key = selectKey(source, entry.cratePath);
    if (next.has(key)) next.delete(key);
    else next.set(key, { source, path: entry.cratePath, size: entry.size || 0 });
    selected.value = next;
  }
  const clearSelection = () => (selected.value = new Map());
  const selectedSize = computed(() => [...selected.value.values()].reduce((n, f) => n + f.size, 0));
  const selectedCost = computed(() => costOf([...selected.value.values()]));
  async function downloadSelected() {
    const files = [...selected.value.values()];
    clearSelection();
    await request(files);
  }

  /* -------------------------------------------------------------- removing --- */
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
    requestError.value = null;
    try {
      await removeInputSource(source.nodeId);
      selected.value = new Map([...selected.value].filter(([, f]) => f.source.nodeId !== source.nodeId));
      await loadSources();
    } catch (e) {
      requestError.value = e?.message || String(e);
    }
  }

  return reactive({
    sources,
    canChange,
    loading,
    error,
    requestError,
    states,
    diskUse,
    freeBytes,
    active,
    activeLeft,
    selected,
    selectedSize,
    loadSources,
    overlay,
    stateOf,
    folderProgress,
    remainingIn,
    check,
    costNoted,
    noteCost,
    selectedCost,
    request,
    requestEntries,
    cancel,
    cancelAll,
    isSelected,
    toggleSelect,
    clearSelection,
    downloadSelected,
    remove,
    removable: computed(() => canChange.value && !!removeInputSource),
    // Whether data can be added: not on a compliant node, whose sidecar
    // can't fetch a new view's crate (removing still works).
    canAdd: computed(() => canChange.value && canAddViews(sidecarCanAdd.value, node())),
  });
}
