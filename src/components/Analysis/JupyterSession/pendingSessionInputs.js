// The inputs a new notebook takes once its session runs: a workspace
// dataset's records (and its files, where views take them) as a view, which
// views-service builds while the session's container starts rather than
// before the run is sent. The New Notebook dialog starts each view, sends
// the run without it and hands it here by run id; the session page
// (useSessionInputs) adds it to the running session, as + Add data does,
// once the view is built and the session's sidecar is connected, then drops
// it. Kept in memory and in localStorage, so a reload of the session page
// still finishes the job; a day on, an entry is let go (the session, or the
// view's build, is long over). Storage can be unavailable (a private
// window, blocked site data): then only this page load has them.
//
// An input: { nodeId, name, viewId, version, datasetId, label }. name is
// its folder of input/ (sessionFolderName), label what the tree says while
// it's on its way ("<dataset>: <input>").

const PREFIX = "pennsieve.pendingSessionInputs.";
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

// runId -> { at, inputs }
const memory = new Map();

const storageOf = (opts) => ("storage" in (opts || {}) ? opts.storage : globalThis.localStorage);
const nowOf = (opts) => (opts?.now || Date.now)();

function readStored(runId, storage) {
  try {
    const raw = storage?.getItem(PREFIX + runId);
    const entry = raw ? JSON.parse(raw) : null;
    return entry && Array.isArray(entry.inputs) ? entry : null;
  } catch {
    return null;
  }
}

function writeStored(runId, entry, storage) {
  try {
    if (entry?.inputs.length) storage?.setItem(PREFIX + runId, JSON.stringify(entry));
    else storage?.removeItem(PREFIX + runId);
  } catch {
    // Not kept past this page load.
  }
}

// Lets go of the entries a day old, in storage (other runs' too) and here.
export function sweepPendingInputs(opts = {}) {
  const storage = storageOf(opts);
  const now = nowOf(opts);
  for (const [runId, entry] of memory) if (now - entry.at > PENDING_TTL_MS) memory.delete(runId);
  try {
    const keys = [];
    for (let i = 0; i < (storage?.length || 0); i++) {
      const key = storage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      const entry = readStored(key.slice(PREFIX.length), storage);
      if (!entry || !(now - entry.at <= PENDING_TTL_MS)) storage.removeItem(key);
    }
  } catch {
    // Nothing to sweep where storage can't be read.
  }
}

// Hands a run's inputs to its session page.
export function holdPendingInputs(runId, inputs, opts = {}) {
  if (!runId || !inputs?.length) return;
  sweepPendingInputs(opts);
  const entry = { at: nowOf(opts), inputs: inputs.map((i) => ({ ...i })) };
  memory.set(runId, entry);
  writeStored(runId, entry, storageOf(opts));
}

// The run's inputs still to add to its session ([] for none, or once a day
// old).
export function pendingInputsOf(runId, opts = {}) {
  if (!runId) return [];
  const storage = storageOf(opts);
  const entry = memory.get(runId) || readStored(runId, storage);
  if (!entry) return [];
  if (!(nowOf(opts) - entry.at <= PENDING_TTL_MS)) {
    memory.delete(runId);
    writeStored(runId, null, storage);
    return [];
  }
  return entry.inputs.map((i) => ({ ...i }));
}

// One of them added to the session (by its view): it's done.
export function dropPendingInput(runId, viewId, opts = {}) {
  const storage = storageOf(opts);
  const entry = memory.get(runId) || readStored(runId, storage);
  if (!entry) return;
  const next = { ...entry, inputs: entry.inputs.filter((i) => i.viewId !== viewId) };
  if (next.inputs.length) memory.set(runId, next);
  else memory.delete(runId);
  writeStored(runId, next, storage);
}

/* ------------------------------------------------------------- naming --- */
// The folder of input/ a view gets, after its name, as the session's
// sidecar names the view a session starts with (session-proxy
// viewFolderName: what isn't a letter, digit, '.', '_' or '-' becomes '-',
// trimmed of them at both ends): a records view the dialog named
// "Mouse study: Input data" is input/Mouse-study-Input-data/ either way, so
// code reads INPUT_DIR / "Mouse-study-Input-data/metadata/..." as it did
// when the view was the run's own input. At most 60 characters (the
// sidecar allows 80; workflow-service records an added source's name up to
// 64, which leaves room for a -2); "dataset" when nothing is left.
const FOLDER_MAX = 60;
export function sessionFolderName(viewName = "") {
  let name = String(viewName)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  if (name.length > FOLDER_MAX) name = name.slice(0, FOLDER_MAX).replace(/[-._]+$/, "");
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) ? name : "dataset";
}

// The folder of a run's input that joins its session once it runs: after
// its view's name when it's the notebook's only input (as the sidecar
// names the view a session starts with), else the input's node id (the
// folder a session with several inputs gives each, made a folder name as
// the view's is when it isn't one: workflow-service takes only those).
export const pendingFolderName = ({ viewName, nodeId, only }) =>
  only || !nodeId ? sessionFolderName(viewName) : /^[A-Za-z0-9._-]{1,60}$/.test(nodeId) ? nodeId : sessionFolderName(nodeId);

/* ---------------------------------------------------------- attaching --- */
// Whether a failure is worth trying again in a moment: no answer, or the
// service's own trouble (not a refusal).
export const transientFailure = (e) => !e?.status || e.status >= 500 || e.status === 429;

const sleepFor = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Stopped.", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Stopped.", "AbortError"));
      },
      { once: true }
    );
  });

// Adds a pending input to the running session: waits for its view to be
// built (waitForView, which says when the build failed or took too long),
// then adds it (addInputSource: on the run, then the sidecar) as
// input/<name>/, or the next free name (-2, -3) when taken has it or the
// sidecar says input/ holds it already (a 409 of its own; the run's
// refusals aren't retried). A transient failure is tried again, tries times
// in all. Resolves the folder it got.
export async function attachPendingInput(
  input,
  { waitForView, addInputSource, taken = new Set(), signal, tries = 3, sleep = sleepFor, retryMs = 2000 }
) {
  let view = null;
  for (let attempt = 1; !view; attempt++) {
    try {
      view = await waitForView(input.viewId, { signal });
    } catch (e) {
      // The build failed or took too long (a ViewBuildError) isn't
      // asked again here: Retry does.
      if (e?.name === "AbortError" || e?.name === "ViewBuildError" || attempt >= tries || !transientFailure(e)) throw e;
      await sleep(retryMs * attempt, signal);
    }
  }
  const version = view?.version || input.version;
  const folder = (n) => (n > 1 ? `${input.name}-${n}` : input.name);
  for (let n = 1; ; n++) {
    if (taken.has(folder(n))) continue;
    for (let attempt = 1; ; attempt++) {
      if (signal?.aborted) throw new DOMException("Stopped.", "AbortError");
      try {
        await addInputSource(folder(n), input.viewId, version);
        return folder(n);
      } catch (e) {
        if (e?.status === 409 && e?.source === "sidecar" && n < 20) break;
        if (attempt >= tries || !transientFailure(e)) throw e;
        await sleep(retryMs * attempt, signal);
      }
    }
  }
}

/* ------------------------------------------------------------ the node --- */
// Whether a compute node's sessions can add a view while they run, as far
// as its provisioner's version says (its session sidecar is the same
// release): from v1.37.0, and on a compliant node from v1.41.0 (before, a
// compliant sidecar couldn't fetch a view's crate). A node without a
// version ("latest", a development build) is taken to; the session page
// still says when it can't (useSessionInputs).
const ADDS_VIEWS = [1, 37, 0];
const ADDS_VIEWS_COMPLIANT = [1, 41, 0];
export function nodeAddsViews(node) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(node?.provisionerImageTag || "").trim());
  if (!m) return true;
  const v = m.slice(1).map(Number);
  const min = (node?.deploymentMode || "").toLowerCase() === "compliant" ? ADDS_VIEWS_COMPLIANT : ADDS_VIEWS;
  for (let i = 0; i < 3; i++) if (v[i] !== min[i]) return v[i] > min[i];
  return true;
}

// Which of a new notebook's view inputs (routeWorkspaceInputs' viaView)
// join its session once it runs (later), and which are built before the
// run is sent (now): an input the workflow requires is bound when the run
// is sent (workflow-service refuses a run without it), and a node whose
// sessions can't add views gets them all before it starts. nodes are the
// dialog's data-source nodes (an interface's carry their input).
export function splitSessionViews(viaView, { nodes = [], computeNode = null } = {}) {
  const addsViews = nodeAddsViews(computeNode);
  const later = [];
  const now = [];
  for (const v of viaView || []) {
    const input = nodes.find((d) => d.id === v.id)?.input;
    (addsViews && (!input || input.optional) ? later : now).push(v);
  }
  return { later, now };
}
