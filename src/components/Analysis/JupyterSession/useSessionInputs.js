// The session's view inputs, as the Session files tree shows them: each
// view is a folder of input/, and what it holds shows there whether it's on
// the session's disk or not yet. The session's sidecar downloads what the
// user asks for (useJupyterSession fetchInputs), signing it with the run's
// own credential, and says how far each file has got (inputsStatus); it can
// stop them (cancelInputs, on a sidecar new enough). While the session
// runs, views can be added (AddDataDialog) and removed: the sidecar lists
// what's staged (inputSources), which can differ from the run's data
// sources. A new notebook's dataset records can join the session once it
// runs (pendingSessionInputs): they're added here when their view is built.
import { computed, onBeforeUnmount, reactive, ref, toValue, watch } from "vue";
import { ElMessageBox } from "element-plus";
import { notebookBackend } from "@/notebooks/host";
import { CancelUnavailable } from "@/composables/useJupyterSession";
import { getView, listEntries, waitForView } from "@/utils/viewsService";
import { pendingInputsOf, dropPendingInput, attachPendingInput } from "./pendingSessionInputs";
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
  // Whether the session's sources have been read (whether it can add views
  // is known then).
  let sourcesRead = false;
  const currentRun = () => (typeof runId === "function" ? runId() : runId);

  // One read at a time: a second caller waits for the one under way.
  let loadingSources = null;
  function loadSources() {
    loadingSources ||= readSources().finally(() => (loadingSources = null));
    return loadingSources;
  }
  async function readSources() {
    error.value = null;
    loading.value = true;
    try {
      const id = typeof runId === "function" ? runId() : runId;
      const run = await notebookBackend()
        .getRun(id)
        .catch((e) => {
          throw new Error(`Could not read the run (${e.status ?? e.message}).`);
        });
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
              // not the plain names a picker holds; and the record files
              // it found on disk, which count as downloaded.
              models: s.models || [],
              staged: new Set(s.staged || []),
            }))
            .filter((s) => s.nodeId)
        : runViews.map(([nodeId, ds]) => ({ nodeId, inputFolder: "", viewId: ds.viewId, version: ds.viewVersion, models: [], staged: new Set() }));
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
          // A workspace dataset's records: the view is named for the
          // dataset (its source is the dataset's node id).
          const workspace = first.sourceType === "workspace";
          return {
            ...s,
            // An Open Data view's own name says which folder of the dataset.
            name: (first.openDataset || workspace ? view?.name : first.name) || view?.name || "Dataset",
            subtitle: inputSubtitle({
              platform: workspace ? "Workspace dataset" : platformReading(first.openDataset, first.publisher)?.name,
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
      sourcesRead = true;
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

  onBeforeUnmount(() => {
    clearTimeout(pollTimer);
    attachAbort?.abort();
  });

  /* ------------------------------------------------- joining the session --- */
  // The run's inputs still to join the session (pendingSessionInputs): the
  // dataset's records, started by the New Notebook dialog and built while
  // the session started. Each is { ...input, state, error }: state
  // "preparing" (its view is being built), "adding" (being added),
  // "failed" (error says why; retryPending tries again) or "unavailable"
  // (the session can't add views: an older or compliant node's sidecar).
  const pending = ref([]);
  let attachAbort = null;
  const pendingOf = (viewId) => pending.value.find((p) => p.viewId === viewId);
  function setPending(viewId, state, err = null) {
    const p = pendingOf(viewId);
    if (!p) return;
    p.state = state;
    p.error = err;
  }

  // What's held for this run, keeping the state of those under way.
  function readPending() {
    const held = pendingInputsOf(currentRun());
    pending.value = held.map((i) => pendingOf(i.viewId) || { ...i, state: null, error: null });
  }
  watch(
    () => currentRun(),
    () => {
      attachAbort?.abort();
      attachAbort = null;
      pending.value = [];
      sourcesRead = false;
      // The new run's own, once its session is connected.
      if (toValue(ready)) loadSources().then(attachPending);
    }
  );

  // Adds those not under way, once the session's views are read: each when
  // its view is built, one by one as they're ready. While the sources
  // couldn't be read (the session isn't reachable yet), each says so with
  // Retry; the next connect tries again too.
  function attachPending() {
    readPending();
    if (!pending.value.length) return;
    if (error.value || !sourcesRead) {
      for (const p of pending.value) {
        if (!underWay(p)) setPending(p.viewId, "failed", `${p.label || "The dataset's records"} couldn't join the session yet: ${error.value || "its inputs couldn't be read"}`);
      }
      return;
    }
    if (!canAdd.value) {
      for (const p of pending.value) {
        if (p.state !== "unavailable") {
          setPending(
            p.viewId,
            "unavailable",
            `This session can't add data while it runs (its compute node needs an update), so ${p.label || "the dataset's records"} couldn't join it. Update the node and start the notebook again.`
          );
        }
      }
      return;
    }
    if (!attachAbort) attachAbort = new AbortController();
    for (const p of pending.value) if (!underWay(p)) attachOne(p.viewId, attachAbort.signal);
  }
  const underWay = (p) => p.state === "preparing" || p.state === "adding";

  async function attachOne(viewId, signal) {
    const run = currentRun();
    const p = pendingOf(viewId);
    if (!p) return;
    // Added already (the page was reloaded before it was let go).
    if (sources.value.some((s) => s.viewId === viewId)) {
      dropPendingInput(run, viewId);
      pending.value = pending.value.filter((x) => x.viewId !== viewId);
      return;
    }
    setPending(viewId, "preparing");
    try {
      const taken = new Set(sources.value.map((s) => s.inputFolder || s.nodeId).filter(Boolean));
      const folder = await attachPendingInput(
        { ...p },
        {
          waitForView: async (id, opts) => {
            const view = await waitForView(id, opts);
            setPending(viewId, "adding");
            return view;
          },
          // Not when another tab of this session (or this page before a
          // reload) has added it meanwhile: the sidecar lists it then.
          addInputSource: async (name, id, version) => {
            const now = inputSources ? await inputSources().catch(() => null) : null;
            const there = now?.find?.((s) => s.viewId === id);
            if (there) throw Object.assign(new Error("added already"), { status: 409, added: there.root ? "" : there.name });
            return addInputSource(name, id, version);
          },
          taken,
          signal,
        }
      );
      dropPendingInput(run, viewId);
      if (run !== currentRun()) return;
      await loadSources();
      pending.value = pending.value.filter((x) => x.viewId !== viewId);
      // Its record files on the disk, as a session that started with the
      // view has them (staged before it started); its other files a click
      // away, as ever, the knowledge graph's too (large for a big dataset).
      const source = sources.value.find((s) => s.nodeId === folder);
      const records = source ? source.entries.filter((e) => e.cratePath.startsWith("metadata/") && !e.cratePath.startsWith("metadata/kgx/")) : [];
      if (records.length) await requestEntries(source, records);
    } catch (e) {
      if (e?.name === "AbortError") return;
      if (e?.added !== undefined) {
        dropPendingInput(run, viewId);
        if (run !== currentRun()) return;
        await loadSources();
        pending.value = pending.value.filter((x) => x.viewId !== viewId);
        return;
      }
      console.warn("[inputs] adding", p.label || viewId, e?.message || e);
      setPending(viewId, "failed", `${p.label || "The dataset's records"} couldn't join the session: ${e?.message || e}`);
    }
  }

  // Tries a failed one again (the sources read again first: the session may
  // have come back).
  async function retryPending(viewId) {
    const p = pendingOf(viewId);
    if (!p || (p.state !== "failed" && p.state !== "unavailable")) return;
    p.state = null;
    p.error = null;
    await loadSources();
    attachPending();
  }

  // Whether data can be added: not on a compliant node, whose sidecar
  // can't fetch a new view's crate (removing still works).
  const canAdd = computed(() => canChange.value && canAddViews(sidecarCanAdd.value, node()));

  /* ------------------------------------------------------------- the tree --- */
  // What a folder of the tree holds from the views, beside what's on disk:
  // { name, type: folder|file|stack, size, count, source, entry, rel }. At
  // input/, the views' own folders.
  function overlay(dirPath) {
    const rows = [];
    if (dirPath === "input") {
      for (const s of sources.value) if (s.inputFolder) rows.push({ name: s.inputFolder, type: "folder", source: s, rel: "", root: true });
      // An input on its way: a row of its own until it's added.
      for (const p of pending.value) {
        if (!sources.value.some((s) => s.viewId === p.viewId)) rows.push({ name: p.name, type: "pending", pending: p });
      }
    }
    const at = sourceAt(sources.value, dirPath);
    if (at) {
      for (const r of folderContents(at.source.entries, at.rel, at.source.stacks)) {
        rows.push({ ...r, source: at.source, rel: r.type === "folder" ? r.path : at.rel });
      }
    }
    return rows;
  }

  // A file's download state: the sidecar's, or done for a record file it
  // found staged before the session started.
  const stateOf = (source, path) =>
    states.value[inputKey(source.nodeId, path)] || (source.staged?.has(path) ? { state: "done", size: entrySize(source, path) } : undefined);
  const entrySize = (source, path) => source.entries.find((e) => e.cratePath === path)?.size || 0;
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
  // Bytes of the inputs in the session: the downloads done, and the record
  // files staged before it started.
  const inputBytes = computed(
    () =>
      Object.values(states.value).reduce((n, st) => n + (st?.state === "done" ? st.size || st.bytes || 0 : 0), 0) +
      sources.value.reduce((n, s) => n + [...(s.staged || [])].reduce((m, p) => m + (stateOf(s, p) && !states.value[inputKey(s.nodeId, p)] ? entrySize(s, p) : 0), 0), 0)
  );
  // What's still to come of downloads under way.
  const active = computed(() => Object.values(states.value).filter((st) => st.state === "queued" || st.state === "downloading"));
  const activeLeft = computed(() => active.value.reduce((n, st) => n + Math.max(0, (st.size || 0) - (st.bytes || 0)), 0));
  const diskUse = computed(() => inputsDiskUse(inputBytes.value, diskGiB.value));
  // The disk left for more, as far as the inputs say (the environment and
  // the user's own files use it too); null when the disk isn't known.
  const freeBytes = computed(() => (diskGiB.value ? Math.max(0, diskGiB.value * GiB - inputBytes.value - activeLeft.value) : null));
  /* --------------------------------------------------------- what it costs --- */
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

  // Once the session is connected: its views, then the inputs still to
  // join it. (Last, as it can run at once.)
  watch(
    ready,
    async (r) => {
      if (!r) return;
      if (!sources.value.length || !sourcesRead) await loadSources();
      attachPending();
    },
    { immediate: true }
  );

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
    canAdd,
    pending,
    retryPending,
  });
}
