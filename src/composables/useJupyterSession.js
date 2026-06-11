// @/composables/useJupyterSession.js
//
// Drives an interactive Jupyter notebook for a workflow run from the browser:
//   1. poll workflow-service GET /runs/{id}/session/connect for the kernel URL
//      + a short-lived signed token (minted by the broker, verified by the
//      per-node auth-proxy sidecar),
//   2. open a kernel + contents manager via @jupyterlab/services through that
//      sidecar,
//   3. start a fresh notebook (output/ is empty on a new session; an existing
//      .ipynb in input/ can be opened on demand), edit/execute cells, stream
//      outputs,
//   4. save the .ipynb back to EFS via the Contents API,
//   5. close (sidecar -> kernel /api/shutdown -> the workflow resumes).
//
// The notebook document + files live on EFS; in-memory kernel state is
// ephemeral, so "resume" = reopen the .ipynb and re-run.

import { ref } from "vue";
import * as siteConfig from "@/site-config/site.json";
import { useGetToken } from "@/composables/useGetToken";
import {
  KernelManager,
  ContentsManager,
  ServerConnection,
} from "@jupyterlab/services";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toWs = (u) => u.replace(/^http/i, "ws");
const trimSlash = (u) => u.replace(/\/+$/, "");

// End a run's interactive session WITHOUT opening the notebook (e.g. from the
// runs dashboard or run detail). Resolves the kernel URL + signed token from the
// broker, then asks the sidecar to close — which shuts the kernel down, returns
// the Step Functions task token, and resumes the workflow. Lightweight: no
// kernel/contents managers, unlike the full useJupyterSession() session.
export async function endInteractiveSession(runId) {
  const token = await useGetToken();
  const connectUrl = `${siteConfig.api2Url}/compute/workflows/runs/${encodeURIComponent(
    runId
  )}/session/connect`;
  const resp = await fetch(connectUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 404) return; // already gone — nothing to end
  if (!resp.ok) {
    throw new Error(`Could not reach the session (${resp.status}).`);
  }
  const conn = await resp.json(); // { kernelUrl, token }
  const kernelBaseUrl = trimSlash(conn.kernelUrl);
  const closeResp = await fetch(`${kernelBaseUrl}/pennsieve/close`, {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${conn.token}` },
  });
  if (!closeResp.ok) {
    throw new Error(`Could not end the session (${closeResp.status}).`);
  }
}

// Save the notebook into output/ (a symlink to OUTPUT_DIR, relative to the
// workspace root_dir) so it's persisted as a run output and passed to the next
// workflow step — not left in the ephemeral workspace root.
const NOTEBOOK_PATH = "output/notebook.ipynb";

let cellSeq = 0;
const newId = () => `cell-${Date.now().toString(36)}-${cellSeq++}`;

// nbformat source can be a string or an array of lines; normalize to a string.
const joinSource = (s) => (Array.isArray(s) ? s.join("") : s || "");

function makeCell(cell_type = "code", source = "") {
  return {
    id: newId(),
    cell_type,
    source,
    outputs: [],
    execution_count: null,
    _running: false,
    _editing: cell_type === "markdown" ? source === "" : false,
  };
}

// Starter cells for a brand-new notebook (no saved .ipynb yet): one concise
// markdown note about the input/output convention + an empty code cell to start
// in. INPUT_DIR / OUTPUT_DIR / save_output() are predefined by the kernel's
// startup script.
function seedCells() {
  const intro =
    "**Workflow paths**\n\n" +
    "- `INPUT_DIR` — files from previous steps (read from here)\n" +
    "- `OUTPUT_DIR` — save here to pass files to the next step\n\n" +
    'Example: `df.to_csv(OUTPUT_DIR / "results.csv")`';
  return [makeCell("markdown", intro), makeCell("code", "")];
}

// Map nbformat cells (whose `source` may be a string or an array of lines) into
// our editor cell shape. Used both for the canonical output/notebook.ipynb and
// for opening an existing .ipynb the user picks from input/.
function nbCellsToCells(nbCells) {
  return (nbCells || []).map((c) => ({
    id: newId(),
    cell_type: c.cell_type === "markdown" ? "markdown" : "code",
    source: joinSource(c.source),
    outputs: Array.isArray(c.outputs) ? c.outputs : [],
    execution_count: c.execution_count ?? null,
    _running: false,
    _editing: false,
  }));
}

export function useJupyterSession() {
  const status = ref("idle"); // idle | connecting | ready | error | closed
  // What to show while status === "connecting"; updated once we know whether
  // we're attaching to a live kernel or launching a fresh one.
  const connectingMessage = ref("Connecting to your notebook…");
  const kernelStatus = ref("unknown"); // idle | busy | starting | restarting | dead ...
  const kernelName = ref(""); // e.g. "Python 3.12.3" — from the kernel's info reply
  const error = ref(null);
  const cells = ref([]);
  const dirty = ref(false);
  const saving = ref(false);
  const lastSavedAt = ref(null);
  // Path of the .ipynb the user opened into the session (null for a fresh/seeded
  // notebook). Surfaced in the toolbar so it's clear which notebook is loaded.
  const notebookSource = ref(null);

  let kernelManager = null;
  let contents = null;
  let kernel = null;
  let kernelBaseUrl = null;
  let sessionToken = null; // broker-signed session JWT (NOT the Cognito token)

  // ---- broker connect -------------------------------------------------------

  // Poll the broker until the kernel is ready. The interactive task isn't up the
  // instant a run starts — the workflow may still be on earlier steps, and the
  // Fargate task takes time to launch + pull its image. During that window the
  // endpoint legitimately returns 404 (no task tagged yet) then 202 (task
  // starting), and only 200 once the kernel is reachable. So we keep waiting
  // through 404/202/transient-5xx rather than failing on the first 404. ~5 min
  // window covers a cold first launch (image pull). Only 401/403 (access) and
  // other 4xx fail fast.
  // Poll fast (1s) early so a kernel that's already up is picked up promptly,
  // then back off to 2s for the long tail of a cold launch. Total window stays
  // ~5 min (30x1s + 135x2s = 300s) to cover a first-launch image pull.
  async function fetchConnection(
    runId,
    { fastMs = 1000, slowMs = 2000, fastAttempts = 30, maxAttempts = 165 } = {}
  ) {
    const url = `${siteConfig.api2Url}/compute/workflows/runs/${encodeURIComponent(
      runId
    )}/session/connect`;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const delay = attempt < fastAttempts ? fastMs : slowMs;
      let resp;
      try {
        const token = await useGetToken();
        resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      } catch (_) {
        // Network blip — wait and retry rather than fail the whole connect.
        await sleep(delay);
        continue;
      }
      if (resp.status === 200) return resp.json();
      if (resp.status === 401 || resp.status === 403) {
        throw new Error("You do not have access to this session.");
      }
      // 404 = task not launched yet, 202 = starting, 5xx = transient → keep waiting.
      if (resp.status === 404 || resp.status === 202 || resp.status >= 500) {
        await sleep(delay);
        continue;
      }
      throw new Error(`session connect failed (${resp.status})`);
    }
    throw new Error(
      "The kernel is taking longer than expected to start. It may still be launching — try reconnecting in a moment."
    );
  }

  // Construct a KernelManager and attach to (or start) a kernel, retrying while
  // the kernel HTTP endpoint is still warming up (502 / CORS-without-headers).
  // Retry at 1.5s (down from 2s): with the ALB health-check ramp shortened to
  // ~10-15s, the kernel endpoint stops 502'ing quickly, so a tighter cadence
  // catches the first healthy response sooner. ~90s total window preserved.
  async function acquireKernel(settings, { intervalMs = 1500, maxAttempts = 60 } = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let km = null;
      try {
        km = new KernelManager({ serverSettings: settings });
        await km.ready;
        const running = Array.from(km.running());
        let k;
        if (running.length) {
          connectingMessage.value = "Reconnecting to your running kernel…";
          k = km.connectTo({ model: running[0] });
        } else {
          connectingMessage.value =
            "Starting your kernel… this can take a minute on first launch.";
          k = await km.startNew({ name: "python3" });
        }
        kernelManager = km;
        return k;
      } catch (e) {
        lastErr = e;
        // Dispose the half-initialized manager before retrying.
        try {
          // eslint-disable-next-line no-unused-expressions
          km?.dispose?.();
        } catch (_) {
          /* ignore */
        }
        connectingMessage.value =
          "Waiting for the kernel to come online… this can take a minute on first launch.";
        await sleep(intervalMs);
      }
    }
    throw lastErr || new Error("Could not reach the kernel.");
  }

  async function connect(runId) {
    status.value = "connecting";
    connectingMessage.value = "Connecting to your notebook…";
    error.value = null;
    try {
      const conn = await fetchConnection(runId); // { kernelUrl, token, ... }
      kernelBaseUrl = trimSlash(conn.kernelUrl);
      sessionToken = conn.token;

      const settings = ServerConnection.makeSettings({
        baseUrl: kernelBaseUrl,
        wsUrl: toWs(kernelBaseUrl),
        token: conn.token,
      });

      contents = new ContentsManager({ serverSettings: settings });

      // Even after /session/connect returns a URL, the Jupyter server (and the
      // auth-proxy sidecar) inside the task may take a few more seconds to serve
      // — during which /api/kernels can 502 / fail CORS. KernelManager.ready
      // rejects on that, so retry the whole acquisition patiently instead of
      // surfacing a one-shot "failed to connect".
      kernel = await acquireKernel(settings);

      kernel.statusChanged.connect((_, s) => {
        kernelStatus.value = s;
      });
      kernelStatus.value = kernel.status;

      // Surface the real language + version (e.g. "Python 3.12.3") from the
      // kernel's info reply, rather than a hard-coded label.
      kernel.info
        .then((info) => {
          const li = info?.language_info || {};
          const name = li.name
            ? li.name.charAt(0).toUpperCase() + li.name.slice(1)
            : "Kernel";
          kernelName.value = li.version ? `${name} ${li.version}` : name;
        })
        .catch(() => {});

      await loadNotebook();
      status.value = "ready";
    } catch (e) {
      error.value = e?.message || String(e);
      status.value = "error";
    }
  }

  // ---- notebook load / save -------------------------------------------------

  function loadNotebook() {
    // A fresh interactive session always starts with an empty output/ folder —
    // there's never a saved output/notebook.ipynb to reopen — so always start a
    // new notebook rather than probing for one (which only ever 404s). To work
    // from an existing notebook, the user opens one staged in input/ via the
    // file browser (openNotebookFrom).
    cells.value = seedCells();
    dirty.value = false;
    lastSavedAt.value = null;
  }

  // Load an existing .ipynb (e.g. one staged in input/) into the editor,
  // REPLACING the current cells. Save still targets output/notebook.ipynb, so
  // this imports the chosen notebook into the working session — left dirty until
  // the user saves it out to OUTPUT_DIR.
  async function openNotebookFrom(path) {
    if (!contents) return false;
    try {
      const model = await contents.get(path, {
        content: true,
        type: "notebook",
      });
      const loaded = nbCellsToCells(model.content?.cells);
      cells.value = loaded.length ? loaded : seedCells();
      dirty.value = true;
      notebookSource.value = path;
      return true;
    } catch (e) {
      error.value = `Could not open ${path}: ${e?.message || e}`;
      return false;
    }
  }

  // Walk input/ (recursively, small depth cap) for .ipynb files — the candidates
  // a user can open when starting a session (output/ is always empty at start,
  // so any existing notebook to continue from lives under input/).
  async function findInputNotebooks() {
    if (!contents) return [];
    const found = [];
    const walk = async (path, depth) => {
      if (depth > 4) return;
      let model;
      try {
        model = await contents.get(path, { content: true });
      } catch {
        return;
      }
      const items = Array.isArray(model.content) ? model.content : [];
      for (const e of items) {
        if (e.type === "directory") {
          await walk(e.path, depth + 1);
        } else if (e.type === "notebook" || /\.ipynb$/i.test(e.name)) {
          found.push({ name: e.name, path: e.path });
        }
      }
    };
    await walk("input", 0);
    return found;
  }

  function toNbformat() {
    return {
      cells: cells.value.map((c) => {
        const base = {
          cell_type: c.cell_type,
          metadata: {},
          source: c.source,
        };
        if (c.cell_type === "code") {
          base.outputs = c.outputs || [];
          base.execution_count = c.execution_count ?? null;
        }
        return base;
      }),
      metadata: {
        kernelspec: { name: "python3", display_name: "Python 3" },
        language_info: { name: "python" },
      },
      nbformat: 4,
      nbformat_minor: 5,
    };
  }

  // Returns true on success, false if the save failed (so callers like
  // "Save & close" can avoid tearing down the session over unsaved work).
  async function save() {
    if (!contents) return false;
    saving.value = true;
    try {
      const model = await contents.save(NOTEBOOK_PATH, {
        type: "notebook",
        format: "json",
        content: toNbformat(),
      });
      dirty.value = false;
      lastSavedAt.value = model.last_modified || new Date().toISOString();
      return true;
    } catch (e) {
      error.value = `Save failed: ${e?.message || e}`;
      return false;
    } finally {
      saving.value = false;
    }
  }

  // ---- file browser (Contents API) -----------------------------------------

  // List a directory on the kernel's filesystem (EFS). Returns entries sorted
  // folders-first, then by name. path "" = the notebook root (execution dir).
  async function listDir(path = "") {
    if (!contents) return [];
    const model = await contents.get(path, { content: true });
    const items = Array.isArray(model.content) ? model.content : [];
    return items
      .map((e) => ({
        name: e.name,
        path: e.path,
        type: e.type, // directory | file | notebook
        size: e.size ?? null,
        last_modified: e.last_modified || null,
        mimetype: e.mimetype || null,
      }))
      .sort((a, b) => {
        if ((a.type === "directory") !== (b.type === "directory")) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }

  // Fetch a file's bytes via the Contents API (base64 for binary) as a Blob the
  // browser can download — used by the file browser's download action.
  async function downloadFile(path) {
    if (!contents) return null;
    const model = await contents.get(path, { content: true });
    if (model.format === "base64") {
      const bin = atob(model.content);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], {
        type: model.mimetype || "application/octet-stream",
      });
    }
    const text =
      typeof model.content === "string"
        ? model.content
        : JSON.stringify(model.content, null, 2);
    return new Blob([text], { type: model.mimetype || "text/plain" });
  }

  // ---- cell mutations -------------------------------------------------------

  const indexOf = (id) => cells.value.findIndex((c) => c.id === id);

  function setSource(id, source) {
    const c = cells.value[indexOf(id)];
    if (c && c.source !== source) {
      c.source = source;
      dirty.value = true;
    }
  }

  function addCell(afterId = null, type = "code") {
    const cell = makeCell(type);
    const at = afterId == null ? cells.value.length : indexOf(afterId) + 1;
    cells.value.splice(at, 0, cell);
    dirty.value = true;
    return cell.id;
  }

  function addCellAbove(id, type = "code") {
    const cell = makeCell(type);
    const at = Math.max(0, indexOf(id));
    cells.value.splice(at, 0, cell);
    dirty.value = true;
    return cell.id;
  }

  function deleteCell(id) {
    const i = indexOf(id);
    if (i === -1) return;
    cells.value.splice(i, 1);
    if (cells.value.length === 0) cells.value.push(makeCell("code"));
    dirty.value = true;
  }

  function moveCell(id, dir) {
    const i = indexOf(id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= cells.value.length) return;
    const arr = cells.value;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    dirty.value = true;
  }

  function changeCellType(id, type) {
    const c = cells.value[indexOf(id)];
    if (!c || c.cell_type === type) return;
    c.cell_type = type;
    if (type === "markdown") {
      c.outputs = [];
      c.execution_count = null;
      c._editing = true;
    }
    dirty.value = true;
  }

  function clearOutputs(id) {
    const c = cells.value[indexOf(id)];
    if (!c) return;
    c.outputs = [];
    c.execution_count = null;
    dirty.value = true;
  }

  function clearAllOutputs() {
    cells.value.forEach((c) => {
      c.outputs = [];
      c.execution_count = null;
    });
    dirty.value = true;
  }

  // ---- execution ------------------------------------------------------------

  // Apply carriage returns: within each line, a \r resets to the start, so keep
  // only the text after the last \r (collapses tqdm-style progress bars to their
  // final state instead of concatenating every update).
  function applyCarriageReturns(text) {
    if (text.indexOf("\r") === -1) return text;
    return text
      .split("\n")
      .map((line) => {
        const i = line.lastIndexOf("\r");
        return i === -1 ? line : line.slice(i + 1);
      })
      .join("\n");
  }

  // Coalesce consecutive stream outputs of the same name (matches Jupyter), and
  // collapse carriage returns so progress bars render cleanly.
  function pushOutput(cell, out) {
    if (out.output_type === "stream") {
      const last = cell.outputs[cell.outputs.length - 1];
      if (last && last.output_type === "stream" && last.name === out.name) {
        last.text = applyCarriageReturns(last.text + out.text);
        return;
      }
      out.text = applyCarriageReturns(out.text);
    }
    cell.outputs.push(out);
  }

  async function executeCell(id) {
    const cell = cells.value[indexOf(id)];
    if (!cell || cell.cell_type !== "code") return;
    if (!kernel) {
      error.value = "No active kernel.";
      return;
    }
    cell.outputs = [];
    cell.execution_count = null;
    cell._running = true;

    // clear_output(wait=True) defers the clear until the NEXT output arrives
    // (used by tqdm/animations/re-rendered plots to avoid flicker). Honor it.
    let pendingClear = false;
    const addOutput = (out) => {
      if (pendingClear) {
        cell.outputs = [];
        pendingClear = false;
      }
      pushOutput(cell, out);
    };

    const future = kernel.requestExecute({ code: cell.source, stop_on_error: true });
    future.onIOPub = (msg) => {
      const t = msg.header.msg_type;
      const c = msg.content;
      switch (t) {
        case "stream":
          addOutput({ output_type: "stream", name: c.name, text: c.text });
          break;
        case "execute_result":
          addOutput({
            output_type: "execute_result",
            data: c.data,
            metadata: c.metadata || {},
            execution_count: c.execution_count,
          });
          break;
        case "display_data":
        case "update_display_data":
          addOutput({
            output_type: "display_data",
            data: c.data,
            metadata: c.metadata || {},
          });
          break;
        case "error":
          addOutput({
            output_type: "error",
            ename: c.ename,
            evalue: c.evalue,
            traceback: c.traceback,
          });
          break;
        case "execute_input":
          if (typeof c.execution_count === "number") cell.execution_count = c.execution_count;
          break;
        case "clear_output":
          if (c.wait) {
            pendingClear = true; // clear when the next output arrives
          } else {
            cell.outputs = [];
            pendingClear = false;
          }
          break;
        default:
          break;
      }
    };
    try {
      const reply = await future.done;
      if (reply?.content?.execution_count != null) {
        cell.execution_count = reply.content.execution_count;
      }
    } finally {
      cell._running = false;
      dirty.value = true;
    }
  }

  async function runAll() {
    for (const c of cells.value) {
      if (c.cell_type === "code") await executeCell(c.id);
    }
  }

  async function interrupt() {
    try {
      await kernel?.interrupt();
    } catch (_) {}
  }

  async function restart() {
    try {
      await kernel?.restart();
      kernelStatus.value = kernel?.status || "unknown";
    } catch (e) {
      error.value = `Restart failed: ${e?.message || e}`;
    }
  }

  async function restartAndRunAll() {
    await restart();
    await runAll();
  }

  // ---- teardown -------------------------------------------------------------

  // Drop the local kernel/contents connections WITHOUT ending the session, so
  // navigating away / closing the tab leaves the kernel running to reconnect to.
  function disconnect() {
    try { kernel?.dispose?.(); } catch (_) {}
    try { kernelManager?.dispose?.(); } catch (_) {}
    try { contents?.dispose?.(); } catch (_) {}
    kernel = null;
    kernelManager = null;
    contents = null;
  }

  // End the session: ask the sidecar to close (it shuts the kernel server down,
  // which makes the container return the task token so the workflow resumes).
  async function close() {
    if (!kernelBaseUrl) {
      disconnect();
      status.value = "closed";
      return;
    }
    // Authenticate with the broker-signed SESSION token (the sidecar rejects the
    // Cognito token); include the promoted cookie as a fallback. Shutting the
    // kernel down is what makes the container return the task token and resume
    // the workflow — so if this request fails, the session is NOT closed and we
    // must surface that rather than silently flip the UI to "closed".
    try {
      const resp = await fetch(`${kernelBaseUrl}/pennsieve/close`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!resp.ok) {
        // The sidecar answered with an error status (e.g. auth) — the request
        // reached it and it refused, so the kernel is genuinely still running.
        error.value = `Could not end the session (${resp.status}). The kernel is still running — try again.`;
        return;
      }
    } catch (e) {
      // A network/CORS failure (no HTTP response) almost always means the close
      // succeeded and the task tore itself down mid-response — shutting the
      // kernel server down stops the whole task, including the sidecar serving
      // this request. Treat it as closed rather than blocking the UI. (A genuine
      // "couldn't reach it" failure resolves the same way the workflow does:
      // heartbeat/idle timeout reclaims it.)
      console.warn(
        "[notebook] close request did not return cleanly (task likely torn down):",
        e?.message || e
      );
    }
    disconnect();
    kernelStatus.value = "dead";
    status.value = "closed";
  }

  return {
    // state
    status,
    connectingMessage,
    kernelStatus,
    kernelName,
    error,
    cells,
    dirty,
    saving,
    lastSavedAt,
    notebookSource,
    // lifecycle
    connect,
    close,
    disconnect,
    // notebook
    save,
    openNotebookFrom,
    findInputNotebooks,
    // files
    listDir,
    downloadFile,
    // cells
    setSource,
    addCell,
    addCellAbove,
    deleteCell,
    moveCell,
    changeCellType,
    clearOutputs,
    clearAllOutputs,
    // execution
    executeCell,
    runAll,
    interrupt,
    restart,
    restartAndRunAll,
  };
}
