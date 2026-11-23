<script setup>
// Multi-cell interactive Jupyter notebook for a workflow run. Connects to the
// live kernel via @jupyterlab/services (through the per-node auth-proxy sidecar),
// loads/saves a notebook.ipynb on EFS, and provides a Jupyter-like editing
// surface (code + markdown cells, per-cell run, run-all, restart, command-mode
// keyboard shortcuts).
import { onMounted, onBeforeUnmount, nextTick, ref, computed, watch } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { useJupyterSession } from "@/composables/useJupyterSession";
import { markSessionEnded } from "../RunMonitor/endedSessions";
import NotebookCell from "./NotebookCell.vue";
import AssistSpend from "./AssistSpend.vue";
import FileBrowser from "./FileBrowser.vue";
import AddDataDialog from "./AddDataDialog.vue";
import { useSessionInputs } from "./useSessionInputs";
import EnvironmentPanel from "./EnvironmentPanel.vue";
import { sessionPathCode } from "./pathCode";
import { acceptedCode, addCellSpend, assistRequest, budgetPause, cellCode, followUpRequest, requestCost, sessionFiles } from "./assistHelpers";
import RuntimeMark from "../WorkflowGraph/RuntimeMark.vue";
import { fetchRun } from "../RunMonitor/runDetails";
import { runOnGpu, runNodeId, gpuShortLabel, gpuMarkTitle, sessionRestrictions } from "../RunMonitor/notebookHelpers";
import IconWarningCircle from "@/components/icons/IconWarningCircle.vue";
import { nodeGpu, nodeRegion } from "../ComputeNodes/computeNodeHelpers";
import { useComputeResourcesStore } from "@/stores/computeResourcesStore";
import { useStore } from "vuex";
import * as siteConfig from "@/site-config/site.json";
import {
  VideoPlay,
  DArrowRight,
  FolderOpened,
  RefreshRight,
  Document,
  Plus,
  ArrowDown,
  SwitchButton,
  Loading,
} from "@element-plus/icons-vue";

const props = defineProps({
  runId: { type: String, required: true },
});

// A GPU session (the session app's gpu variant): marked in the header, and
// the environment panel warns about environments that bring their own
// torch, tensorflow or jax. Read from the run; a CPU session until it is.
// The header names the run's node's GPU (its GPU tier) where known.
const onGpu = ref(false);
const sessionGpu = ref(null);
// The run's compute node, where known: its region and tier say what a
// download from another region costs (useSessionInputs).
const sessionNode = ref(null);
const vuexStore = useStore();
const computeResourcesStore = useComputeResourcesStore();
async function loadRunNode(run) {
  const nodeId = runNodeId(run);
  if (!nodeId) return null;
  try {
    let nodes = vuexStore.getters["analysisModule/computeNodes"] || [];
    if (!nodes.some((n) => n.uuid === nodeId)) {
      await vuexStore.dispatch("analysisModule/fetchComputeNodes");
      nodes = vuexStore.getters["analysisModule/computeNodes"] || [];
    }
    return nodes.find((n) => n.uuid === nodeId) || null;
  } catch {
    return null;
  }
}
async function loadSessionGpu(node) {
  if (!node) return null;
  try {
    const tiers = await computeResourcesStore.fetchGpuTiers(vuexStore.getters.activeOrganization?.organization?.id);
    return nodeGpu(node, tiers || []);
  } catch {
    return null;
  }
}
watch(
  () => props.runId,
  async (id) => {
    onGpu.value = false;
    sessionGpu.value = null;
    sessionNode.value = null;
    if (!id) return;
    const run = await fetchRun(siteConfig.api2Url, id);
    if (id !== props.runId) return;
    onGpu.value = runOnGpu(run);
    const node = await loadRunNode(run);
    if (id !== props.runId) return;
    sessionNode.value = node && { region: nodeRegion(node), deploymentMode: node.deploymentMode || "" };
    if (!onGpu.value) return;
    const gpu = await loadSessionGpu(node);
    if (id === props.runId) sessionGpu.value = gpu;
  },
  { immediate: true }
);

// What a session on its node can't do (a compliant node: no internet), said
// when it opens until dismissed. Dismissed per session, in this browser.
// (inputs is set up below; the computed reads it when the page renders.)
const restrictions = computed(() => sessionRestrictions(sessionNode.value, { canAddData: inputs.canAdd }));
const restrictionsKey = computed(() => `nb-restrictions-dismissed:${props.runId}`);
const restrictionsDismissed = ref(false);
watch(
  restrictionsKey,
  (key) => {
    try {
      restrictionsDismissed.value = localStorage.getItem(key) === "1";
    } catch {
      restrictionsDismissed.value = false;
    }
  },
  { immediate: true }
);
function dismissRestrictions() {
  restrictionsDismissed.value = true;
  try {
    localStorage.setItem(restrictionsKey.value, "1");
  } catch {
    /* kept for this page only */
  }
}

// The run's page: where ending the session leads, since the run carries on
// (its next steps, e.g. a download target's zip, show there). In its
// workspace, or in My Analysis for a personal run (no orgId).
const route = useRoute();
const router = useRouter();
const runRoute = computed(() =>
  route.params.orgId
    ? { name: "run-detail", params: { orgId: route.params.orgId, runId: props.runId } }
    : { name: "my-run-detail", params: { runId: props.runId } }
);

const {
  status,
  connectingMessage,
  connectPhase,
  kernelStatus,
  kernelName,
  kernelPackages,
  error,
  cells,
  dirty,
  saving,
  notebookSource,
  connect,
  close,
  disconnect,
  save,
  openNotebookFrom,
  findInputNotebooks,
  listDir,
  readText,
  fetchInputs,
  inputsStatus,
  cancelInputs,
  inputSources,
  addInputSource,
  removeInputSource,
  environmentState,
  switchEnvironment,
  clearEnvironment,
  assistStatus,
  askAssist,
  askAgent,
  complete,
  inspect,
  setSource,
  addCell,
  addCellAbove,
  deleteCell,
  moveCell,
  changeCellType,
  clearAllOutputs,
  executeCell,
  runAll,
  interrupt,
  restart,
  restartAndRunAll,
} = useJupyterSession();

/* ---- connect progress (simulated, time-calibrated) ------------------------
   There's no real progress signal for a launching kernel, so we simulate one to
   give a sense of how long the wait is. The "connecting" phase (broker + Fargate
   task coming up) is calibrated to ~1 min; once we're attaching to the kernel
   the remaining wait is short, so we recalibrate to ~16s. The bar eases toward a
   ceiling (never a false 100%) until the session is actually ready. */
const PHASE = {
  connecting: { ms: 60000, ceiling: 90 },
  kernel: { ms: 16000, ceiling: 98 },
};
const progress = ref(0); // 0–100
const etaSeconds = ref(null);
let progressTimer = null;
let phaseStart = 0;
let phaseFloor = 0;
let phaseMs = 0;
let phaseCeiling = 0;

function tickProgress() {
  const elapsed = Date.now() - phaseStart;
  const frac = Math.min(1, elapsed / phaseMs);
  const eased = 1 - Math.pow(1 - frac, 2); // ease-out: decelerates near the end
  const val = phaseFloor + (phaseCeiling - phaseFloor) * eased;
  if (val > progress.value) progress.value = val;
  const remain = Math.ceil((phaseMs - elapsed) / 1000);
  etaSeconds.value = remain > 0 ? remain : 0;
}

function beginPhase(name) {
  const cfg = PHASE[name];
  if (!cfg) return;
  phaseStart = Date.now();
  phaseFloor = progress.value; // continue from wherever the bar is now
  phaseMs = cfg.ms;
  phaseCeiling = cfg.ceiling;
  tickProgress();
  if (!progressTimer) progressTimer = setInterval(tickProgress, 200);
}

function stopProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

// Drive the bar off the session status + connect phase.
watch(status, (s) => {
  if (s === "connecting") {
    progress.value = 0;
    beginPhase("connecting");
  } else if (s === "ready") {
    progress.value = 100;
    etaSeconds.value = 0;
    stopProgress();
  } else {
    stopProgress(); // error / closed / idle
  }
});
watch(connectPhase, (p) => {
  if (p === "kernel" && status.value === "connecting") beginPhase("kernel");
});

const etaLabel = computed(() => {
  if (etaSeconds.value == null) return "";
  if (etaSeconds.value <= 0) return "Almost ready — finishing up…";
  if (etaSeconds.value >= 60) return "Estimated wait: about a minute";
  return `Estimated wait: about ${etaSeconds.value}s`;
});

const selectedId = ref(null);
const cellRefs = new Map();
const ending = ref(false);
const confirmEnd = ref(false);
// The sidebar shows or hides from the folder button at the start of the
// notebook toolbar, and stays as the user left it in this browser.
const SIDEBAR_OPEN_KEY = "pennsieve.notebook.sidebarOpen";
function storedOpen() {
  try {
    return localStorage.getItem(SIDEBAR_OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}
const showFiles = ref(storedOpen());

// Below this toolbar width the buttons keep only their icons (each has a
// tooltip), so the toolbar stays on one line beside the sidebar.
const COMPACT_TOOLBAR_PX = 900;
const toolbarRef = ref(null);
// The AI spend meter, when shown, needs about this much more room.
const SPEND_METER_PX = 200;
const toolbarWidth = ref(Infinity);
const compactToolbar = computed(() => toolbarWidth.value < COMPACT_TOOLBAR_PX + (assistAvailable.value ? SPEND_METER_PX : 0));
let toolbarObserver = null;
watch(toolbarRef, (el) => {
  toolbarObserver?.disconnect();
  toolbarObserver = null;
  if (!el || typeof ResizeObserver === "undefined") return;
  toolbarObserver = new ResizeObserver(([entry]) => {
    toolbarWidth.value = entry.contentRect.width;
  });
  toolbarObserver.observe(el);
});
function toggleSidebar() {
  showFiles.value = !showFiles.value;
  try {
    localStorage.setItem(SIDEBAR_OPEN_KEY, String(showFiles.value));
  } catch {
    // not remembered
  }
}

// The sidebar's width, dragged from its right edge and remembered in this
// browser (a convenience only: it may not persist).
const SIDEBAR_KEY = "pennsieve.notebook.sidebarWidth";
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 300;
const clampWidth = (w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(w)));
function storedWidth() {
  try {
    const w = parseInt(localStorage.getItem(SIDEBAR_KEY), 10);
    return Number.isFinite(w) ? clampWidth(w) : SIDEBAR_DEFAULT;
  } catch {
    return SIDEBAR_DEFAULT;
  }
}
const sidebarWidth = ref(storedWidth());
const resizingSidebar = ref(false);
let resizeStart = null;

function onSidebarMove(e) {
  if (!resizeStart) return;
  sidebarWidth.value = clampWidth(resizeStart.width + e.clientX - resizeStart.x);
}
function endSidebarResize() {
  if (!resizeStart) return;
  resizeStart = null;
  resizingSidebar.value = false;
  window.removeEventListener("pointermove", onSidebarMove);
  window.removeEventListener("pointerup", endSidebarResize);
  try {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth.value));
  } catch {
    // not remembered; the width still applies to this page
  }
}
function startSidebarResize(e) {
  resizeStart = { x: e.clientX, width: sidebarWidth.value };
  resizingSidebar.value = true;
  window.addEventListener("pointermove", onSidebarMove);
  window.addEventListener("pointerup", endSidebarResize);
}
// Arrow keys on the focused handle resize it too.
function nudgeSidebar(delta) {
  sidebarWidth.value = clampWidth(sidebarWidth.value + delta);
  try {
    localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth.value));
  } catch {
    // not remembered
  }
}
const fileBrowserRef = ref(null);

// The session's view inputs, shown in Session files under input/; adding
// one opens the platforms' dialog.
const inputs = useSessionInputs({
  runId: () => props.runId,
  node: () => sessionNode.value,
  fetchInputs,
  inputsStatus,
  cancelInputs,
  inputSources,
  addInputSource,
  removeInputSource,
  ready: computed(() => status.value === "ready"),
  onDownloaded: () => fileBrowserRef.value?.refresh?.(),
});
const addingData = ref(false);
let lastD = 0;

// One-time info dialog shown when a session opens. Dismissed permanently per
// browser via localStorage (mirrors the app's other "seen-…" info dismissals).
const INFO_DISMISS_KEY = "seen-notebook-info";
const showInfoDialog = ref(false);
const dontShowInfoAgain = ref(false);
function maybeShowInfo() {
  try {
    if (localStorage.getItem(INFO_DISMISS_KEY) === "true") return;
  } catch (_) {
    /* private mode / storage blocked — just show it */
  }
  showInfoDialog.value = true;
}
function dismissInfo() {
  if (dontShowInfoAgain.value) {
    try {
      localStorage.setItem(INFO_DISMISS_KEY, "true");
    } catch (_) {
      /* ignore: persistence is best-effort */
    }
  }
  showInfoDialog.value = false;
}

// Opening an existing .ipynb (output/ is always empty at start, so candidates
// live in input/). Banner offers the staged notebook(s); the file browser's
// per-file "open" action loads any .ipynb on demand.
const inputNotebooks = ref([]);
const showInputBanner = ref(false);
const inputChoice = ref("");
const pendingOpenPath = ref(null); // truthy → discard-unsaved-changes dialog open
const opening = ref(false);

async function scanInputNotebooks() {
  try {
    const found = await findInputNotebooks();
    inputNotebooks.value = found;
    showInputBanner.value = found.length > 0;
    inputChoice.value = found.length === 1 ? found[0].path : "";
  } catch {
    /* best-effort: no banner if the scan fails */
  }
}

// Open a notebook by path; guard unsaved edits first (replacing cells is lossy).
function requestOpen(path) {
  if (!path) return;
  if (dirty.value) pendingOpenPath.value = path;
  else doOpen(path);
}

async function doOpen(path) {
  opening.value = true;
  try {
    const ok = await openNotebookFrom(path);
    if (ok) {
      selectedId.value = cells.value.length ? cells.value[0].id : null;
      showInputBanner.value = false;
      pendingOpenPath.value = null;
      fileBrowserRef.value?.refresh?.();
    }
  } finally {
    opening.value = false;
  }
}

function confirmDiscardOpen() {
  if (pendingOpenPath.value) doOpen(pendingOpenPath.value);
}

function openFromBanner() {
  if (inputChoice.value) requestOpen(inputChoice.value);
}

function setCellRef(id, el) {
  if (el) cellRefs.set(id, el);
  else cellRefs.delete(id);
}

const idx = (id) => cells.value.findIndex((c) => c.id === id);
const selectedCell = () => cells.value[idx(selectedId.value)] || null;

onMounted(async () => {
  await connect(props.runId);
  if (cells.value.length) selectedId.value = cells.value[0].id;
  if (status.value === "ready") {
    scanInputNotebooks();
    maybeShowInfo();
  }
  window.addEventListener("keydown", onKeydown, true);
  window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
  toolbarObserver?.disconnect();
  endSidebarResize();
  window.removeEventListener("keydown", onKeydown, true);
  window.removeEventListener("beforeunload", onBeforeUnload);
  stopProgress();
  // Best-effort flush of unsaved edits before dropping the connection, so a
  // later reconnect reopens the latest work. Fire-and-forget (unmount can't
  // await); the request is issued before disconnect() disposes the manager.
  // No-op after an explicit close — contents is already gone, so save() bails.
  if (dirty.value && status.value === "ready") save();
  // Leave the session running; just drop the local connection.
  disconnect();
});

// In-app navigation away from the notebook: await a save of unsaved edits BEFORE
// the route changes, so the persisted working copy is current and a later
// reconnect reopens the latest work. Unlike the onBeforeUnmount flush (which
// can't await), this guarantees the write completes for the common case (the
// user clicking elsewhere in the app). We never block navigation — a failed save
// still lets the user leave (autosave + the beforeunload warning are the net).
onBeforeRouteLeave(async () => {
  if (dirty.value && status.value === "ready") {
    try {
      await save();
    } catch (_) {
      /* don't trap the user on a save error */
    }
  }
  return true;
});

function onBeforeUnload(e) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}

function select(id) {
  selectedId.value = id;
}

function selectRel(delta) {
  const i = idx(selectedId.value);
  const j = i + delta;
  if (j >= 0 && j < cells.value.length) selectedId.value = cells.value[j].id;
}

async function focusCell(id) {
  selectedId.value = id;
  await nextTick();
  const ref = cellRefs.get(id);
  ref?.focus?.();
}

/* ---- code assistant -------------------------------------------------------
   On a node with LLM access the session's sidecar has a code assistant: ✦ or
   Cmd/Ctrl-I on a cell, Ask… on a file, Fix on an error. Its state is the
   cell's _assist (AssistBar); one cell has it at a time. What it writes goes
   into a cell only when the user takes it, and runs only on an action that
   says so (Use and run, Insert below and run), never on a stopped, partial reply. */
// { available, agent, model, budget }: the agent (it looks, and can run its
// fix) on a newer session image, else the sidecar's single-shot assistant.
const assistInfo = ref({ available: false });
const assistAvailable = computed(() => !!assistInfo.value.available);
// Why the assistant is paused ("" when it isn't): no AI budget left, as the
// governor's figures say or as it refused a request. It comes back by
// itself: while paused, the figures are asked for again every few minutes.
const assistPaused = computed(() => (assistAvailable.value ? assistInfo.value.usedUp || budgetPause(assistInfo.value.budget) : ""));
let pauseTimer = null;
watch(assistPaused, (paused) => {
  clearInterval(pauseTimer);
  pauseTimer = null;
  if (!paused) return;
  pauseTimer = setInterval(async () => {
    const info = await assistStatus();
    if (info.available && !budgetPause(info.budget)) assistInfo.value = { ...info, usedUp: "" };
  }, 5 * 60 * 1000);
});
onBeforeUnmount(() => clearInterval(pauseTimer));
watch(status, async (s) => {
  if (s === "ready") assistInfo.value = await assistStatus();
});
// Requests in flight, by cell: Stop and closing end them.
const assistAborts = new Map();
// The last request's { usage, budget }, and the tokens all this page's
// requests used, for the toolbar's spend.
const assistLast = ref(null);
const assistTokens = ref(0);
const usageTokens = (u) =>
  u ? (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0;

// The kernel's packages, for the assistant to write code that imports: asked
// once per environment (silently, behind a running cell; not waited for long).
let packagesFor = null; // { key, list }
async function assistPackages() {
  const key = JSON.stringify([kernelName.value, environmentState.value?.active || null]);
  if (packagesFor?.key === key) return packagesFor.list;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 5000));
  const found = await Promise.race([kernelPackages().catch(() => null), timeout]);
  const list = (found || []).map((p) => p.name);
  if (found) packagesFor = { key, list };
  return list;
}

function closeAssist(cell) {
  assistAborts.get(cell.id)?.abort();
  assistAborts.delete(cell.id);
  delete cell._assist;
}

function openAssist(cell, { mode = "write", file = "" } = {}) {
  if (!assistAvailable.value || assistPaused.value || cell.cell_type !== "code") return;
  for (const c of cells.value) if (c._assist && c.id !== cell.id) closeAssist(c);
  if (cell._assist?.state === "asking") return;
  // An agent that says it can suggests a next cell when nothing is typed
  // (not for a file: that asks what to do with it).
  const canSuggest = !!assistInfo.value.agent && (assistInfo.value.modes || []).includes("suggest") && mode === "write" && !file;
  cell._assist = { ...newAssist(mode, file), canSuggest };
  select(cell.id);
  if (mode === "fix") submitAssist(cell, "");
}

// A bar's state. followUps: the agent continues a proposal's conversation
// with a follow-up (asked: what was asked in it so far).
function newAssist(mode = "write", file = "") {
  const followUps = !!assistInfo.value.agent && !!assistInfo.value.followUps;
  return { mode, file, canSuggest: false, followUps, asked: [], prompt: "", state: "idle", text: "", error: "", steps: [], note: "", usage: null, budget: null };
}

// After a proposal is put in a cell: the bar stays on it, empty, for a
// follow-up in the same conversation. used: the proposal is in the cell;
// usedOutputs: its outputs then (a run since replaces them).
function keepFollowUp(target, a) {
  if (!target || !a.followUps || !a.conversationId) return;
  target._assist = { ...newAssist(), conversationId: a.conversationId, asked: a.asked || [], used: true, usedOutputs: target.outputs };
}

// An agent's event, onto the bar's state (step, run, note, usage, budget).
function onAgentEvent(a, ev) {
  if (ev.type === "step") {
    const i = a.steps.findIndex((s) => s.id === ev.id);
    if (i >= 0) a.steps[i] = { ...a.steps[i], ...ev };
    else a.steps.push(ev);
  } else if (ev.type === "run") a.run = ev;
  else if (ev.type === "note") a.note = ev.text;
  else if (ev.type === "usage") {
    a.usage = ev;
    assistLast.value = { usage: ev, budget: null };
  } else if (ev.type === "budget") {
    // The request's cost: the run's, or the change in the node's spend.
    const cost = requestCost(assistInfo.value.budget, ev);
    const budget = cost == null ? ev : { ...ev, requestUsd: cost };
    a.budget = budget;
    // Figures with budget left lift a pause.
    assistInfo.value = { ...assistInfo.value, budget: ev, usedUp: budgetPause(ev) ? assistInfo.value.usedUp : "" };
    assistLast.value = { usage: a.usage, budget };
  }
}

// Asks: the agent when the session has one (allowRun continues a fix's
// conversation: Fix and run), else the single-shot assistant. (Writing on
// the single-shot assistant was tried, 2026-11-23: a third of the agent's
// cost, but on a knowledge graph's questions it guessed values the agent
// looks up, right 1 time in 6 against the agent's 4.)
async function submitAssist(cell, prompt, { allowRun = false, codeOnly = false, followUp = false } = {}) {
  const a = cell._assist;
  if (!a) return;
  const info = assistInfo.value;
  const viaAgent = !!info.agent;
  a.via = viaAgent ? "agent" : "single";
  // Each request (a continuation too) counts its own tokens.
  Object.assign(a, { prompt, state: "asking", error: "", note: "", running: allowRun, usage: null, countedTokens: 0, partial: false });
  // A follow-up continues the conversation; anything else but Fix and run
  // starts one.
  if (!allowRun) Object.assign(a, { text: "", answer: "", steps: [], usage: null, budget: null, outputs: null, conversationId: followUp ? a.conversationId : "" });
  if (!allowRun && prompt) a.asked = [...(followUp ? a.asked || [] : []), prompt];
  const controller = new AbortController();
  assistAborts.set(cell.id, controller);
  try {
    if (viaAgent) {
      const body =
        allowRun && a.conversationId
          ? { mode: "fix", conversationId: a.conversationId, allowRun: true }
          : followUp
          ? followUpRequest({ conversationId: a.conversationId, prompt, cell, used: !!a.used, ran: !!a.used && cell.outputs !== a.usedOutputs })
          : assistRequest({
              mode: a.mode,
              prompt,
              cell,
              cells: cells.value,
              kernelName: kernelName.value,
              file: a.file,
              // inputs is reactive(): its sources is the list itself.
              files: sessionFiles(inputs.sources, kernelName.value),
              packages: await assistPackages(),
            });
      if (codeOnly) body.codeOnly = true;
      const proposal = await askAgent(body, { signal: controller.signal, onEvent: (ev) => onAgentEvent(a, ev) });
      // A question's answer is words, not code.
      if (proposal.kind === "answer") a.lastAnswer = proposal.answer;
      Object.assign(a, {
        text: proposal.kind === "answer" ? "" : proposal.code,
        answer: proposal.kind === "answer" ? proposal.answer : "",
        summary: proposal.summary || "",
        outputs: proposal.outputs || null,
        conversationId: proposal.conversationId,
        // The new proposal isn't in the cell (yet).
        used: false,
      });
    } else {
      const body = assistRequest({
        mode: a.mode,
        prompt,
        cell,
        cells: cells.value,
        kernelName: kernelName.value,
        file: a.file,
        files: sessionFiles(inputs.sources, kernelName.value),
        packages: await assistPackages(),
      });
      await askAssist(body, {
        onText: (t) => (a.text = t),
        onUsage: (u) => {
          a.usage = u;
          assistLast.value = { usage: u, budget: null };
        },
        signal: controller.signal,
      });
      // Its cost: the change in the governor's figures across it (the
      // single-shot assistant reports none of its own).
      const after = await assistStatus().catch(() => null);
      if (after?.available) {
        const cost = requestCost(info.budget, after.budget);
        a.budget = cost == null ? after.budget : { ...after.budget, requestUsd: cost };
        assistInfo.value = { ...assistInfo.value, budget: after.budget };
        assistLast.value = { usage: a.usage, budget: a.budget };
      }
    }
    a.state = "done";
  } catch (e) {
    // Stopped: what came so far can be used, but not run in one click (partial).
    if (controller.signal.aborted) Object.assign(a, { state: a.text ? "done" : "idle", partial: !!a.text });
    else if (e?.budgetExceeded) {
      // No budget left: said calmly, and the assistant pauses.
      Object.assign(a, { state: "budget", notice: e.message, running: false });
      assistInfo.value = { ...assistInfo.value, usedUp: e.message };
    } else Object.assign(a, { state: "error", error: e?.message || String(e) });
  } finally {
    // What the request cost goes on the cell it was for, saved with the
    // notebook.
    if (a.usage && !a.countedTokens) {
      cell.ai = addCellSpend(cell.ai, a.usage, a.budget?.requestUsd, a.via);
      dirty.value = true;
    }
    assistTokens.value += usageTokens(a.usage) - (a.countedTokens || 0);
    a.countedTokens = usageTokens(a.usage);
    a.running = false;
    if (assistAborts.get(cell.id) === controller) assistAborts.delete(cell.id);
  }
}

// Fix and run. The agent runs its fix in the kernel and tries again while
// it fails (a few times, in one conversation); a clean run's code and output
// go into the cell as they are, without running it again. A fix that never
// ran cleanly stays on offer. Without the agent: use the fix and run it once.
async function fixAndRun(cell) {
  const a = cell._assist;
  if (!assistInfo.value.agent) {
    setSource(cell.id, acceptedCode(a.text));
    closeAssist(cell);
    await onRun(cell, { advance: false });
    return;
  }
  await submitAssist(cell, "", { allowRun: true });
  if (cell._assist !== a || a.state !== "done") return;
  if (a.outputs) {
    setSource(cell.id, acceptedCode(a.text));
    cell.outputs = a.outputs;
    cell.execution_count = null;
    closeAssist(cell);
    // Its run's outputs are in the cell: a follow-up sends them.
    keepFollowUp(cell, a);
    if (cell._assist) cell._assist.usedOutputs = null;
    fileBrowserRef.value?.refresh?.();
  } else {
    a.state = "failed";
  }
}

function onAssist(cell, { action, prompt }) {
  const a = cell._assist;
  if (action === "open") return a ? null : openAssist(cell);
  if (action === "fix") return openAssist(cell, { mode: "fix" });
  if (!a) return;
  if (action === "submit") {
    if (a.mode === "suggest") a.mode = "write";
    submitAssist(cell, prompt);
  } else if (action === "suggest") {
    // With something typed: a next step with that in mind.
    a.mode = "suggest";
    submitAssist(cell, prompt || "");
  } else if (action === "refine") submitAssist(cell, prompt, { followUp: true }); else if (action === "stop") assistAborts.get(cell.id)?.abort();
  else if (action === "clear-file") a.file = "";
  else if (action === "discard") closeAssist(cell);
  else if (action === "accept-run") fixAndRun(cell);
  else if (action === "insert-answer") {
    // An answer, kept in the notebook as a Markdown cell below.
    const id = addCell(cell.id, "markdown");
    setSource(id, `${a.answer}\n\n_Answered by the AI assistant._`);
    const md = cells.value[idx(id)];
    if (md) md._editing = false;
    closeAssist(cell);
  } else if (action === "answer-to-code") {
    // Code for what was asked, with what the answer found.
    const asked = a.prompt;
    a.answer = "";
    submitAssist(cell, `${asked}\n\nWrite code for this. What you found before: ${a.lastAnswer || ""}`.slice(0, 3900), { codeOnly: true });
  }
  else if (["accept", "use-run", "insert-below", "insert-below-run"].includes(action)) {
    const code = acceptedCode(a.text);
    if (!cellCode(a.text)) return;
    closeAssist(cell);
    let id = cell.id;
    if (action.startsWith("insert-below")) id = addCell(cell.id, "code");
    setSource(id, code);
    keepFollowUp(cells.value[idx(id)], a);
    focusCell(id);
    // ...and run, for the actions that say so.
    if (action.endsWith("-run")) {
      const target = cells.value[idx(id)];
      if (target) Promise.resolve(onRun(target, { advance: false })).catch((e) => console.warn("Running the cell failed:", e));
    }
  }
}

// A file's Ask… (the file browser): the assistant on a cell of its own,
// about that file.
function askAboutFile(path) {
  let cell = selectedCell();
  if (!cell || cell.cell_type !== "code" || cell.source.trim()) {
    const id = addCell(cell ? cell.id : null, "code");
    cell = cells.value[idx(id)];
  }
  openAssist(cell, { file: path });
}

// Insert a filesystem path (from the file browser) into the selected code cell
// as a quoted string; if no code cell is selected, create one.
function insertPath(path) {
  insertCode(sessionPathCode(path, kernelName.value));
}
// A file's starter code (the file browser's Code action) as a cell of its
// own: the selected cell when it's an empty code cell, else a new one below
// it. It isn't run.
function insertSnippet(code) {
  let cell = selectedCell();
  if (!cell || cell.cell_type !== "code" || cell.source.trim()) {
    const id = addCell(cell ? cell.id : null, "code");
    select(id);
    cell = cells.value[idx(id)];
  }
  setSource(cell.id, code);
  focusCell(cell.id);
}
function insertCode(literal) {
  let cell = selectedCell();
  if (!cell || cell.cell_type !== "code") {
    const id = addCell(cell ? cell.id : null, "code");
    select(id);
    cell = cells.value[idx(id)];
  }
  const sep = cell.source && !cell.source.endsWith("\n") ? "\n" : "";
  setSource(cell.id, `${cell.source}${sep}${literal}`);
  focusCell(cell.id);
}

// Run a cell, then advance / insert per the shortcut used.
async function onRun(cell, opts = {}) {
  if (cell.cell_type === "code") {
    await executeCell(cell.id);
    // A run may have written files — refresh the browser.
    fileBrowserRef.value?.refresh?.();
  } else {
    cell._editing = false; // render markdown (parent owns the cells array)
  }
  if (opts.insertBelow) {
    const id = addCell(cell.id, "code");
    focusCell(id);
    return;
  }
  if (opts.advance === false) return; // Cmd/Ctrl-Enter: stay
  const i = idx(cell.id);
  if (i === cells.value.length - 1) {
    const id = addCell(cell.id, "code");
    focusCell(id);
  } else {
    selectedId.value = cells.value[i + 1].id;
  }
}

function onChangeType(cell, type) {
  changeCellType(cell.id, type);
}

function runSelected() {
  const cell = selectedCell();
  if (cell) onRun(cell, { advance: true });
}

function addCellFromMenu(type) {
  select(addCell(selectedId.value, type));
}

function onKernelCommand(cmd) {
  if (cmd === "interrupt") interrupt();
  else if (cmd === "restart") restart();
  else if (cmd === "restartRunAll") restartAndRunAll();
  else if (cmd === "clear") clearAllOutputs();
}

// Save writes notebook.ipynb to output/ on EFS — refresh the browser so the
// file appears without a manual reload.
async function saveAndRefresh() {
  await save();
  fileBrowserRef.value?.refresh?.();
}

// End the interactive session (resumes the workflow). Confirmed via the in-app
// dialog. "Save & end" writes the notebook then commits the session (notebook +
// generated files upload). "Discard & end" clears output/ so nothing uploads —
// the whole session is thrown away. On a failed save we keep the dialog open
// rather than tearing down unsaved work.
async function endSession(saveFirst) {
  ending.value = true;
  try {
    if (saveFirst) {
      const saved = await save();
      if (!saved) return;
      await close();
    } else {
      await close({ discardOutput: true });
    }
  } finally {
    ending.value = false;
    if (status.value === "closed") confirmEnd.value = false;
  }
  if (status.value === "closed") {
    // The run page says it's saving and finishing, not just "Running".
    markSessionEnded(props.runId);
    router.replace(runRoute.value);
  }
}

// Command-mode keyboard shortcuts (ignored while a CodeMirror editor has focus).
function onKeydown(e) {
  if (status.value !== "ready") return;
  const inEditor = document.activeElement?.closest?.(".cm-editor");
  const inField =
    document.activeElement?.closest?.("input, select, textarea") && !inEditor;
  // Save works from anywhere.
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveAndRefresh();
    return;
  }
  if (inEditor || inField) return;

  const cell = selectedCell();
  if (!cell) return;
  const k = e.key;

  if (k === "Enter" && e.shiftKey) {
    e.preventDefault();
    onRun(cell, { advance: true });
    return;
  }
  if (k === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    onRun(cell, { advance: false });
    return;
  }
  if (k === "Enter") {
    e.preventDefault();
    if (cell.cell_type === "markdown") cell._editing = true;
    focusCell(cell.id);
    return;
  }
  if (k === "ArrowUp" || k === "k") {
    e.preventDefault();
    selectRel(-1);
    return;
  }
  if (k === "ArrowDown" || k === "j") {
    e.preventDefault();
    selectRel(1);
    return;
  }
  if (k === "a") {
    e.preventDefault();
    select(addCellAbove(cell.id, "code"));
    return;
  }
  if (k === "b") {
    e.preventDefault();
    select(addCell(cell.id, "code"));
    return;
  }
  if (k === "m") {
    e.preventDefault();
    changeCellType(cell.id, "markdown");
    return;
  }
  if (k === "y") {
    e.preventDefault();
    changeCellType(cell.id, "code");
    return;
  }
  if (k === "d") {
    const now = Date.now();
    if (now - lastD < 600) {
      e.preventDefault();
      const i = idx(cell.id);
      deleteCell(cell.id);
      const next = cells.value[Math.min(i, cells.value.length - 1)];
      if (next) selectedId.value = next.id;
      lastD = 0;
    } else {
      lastD = now;
    }
    return;
  }
}

// Which notebook is loaded, e.g. "analysis.ipynb (from input)". Empty for a
// fresh/seeded notebook.
const notebookSourceLabel = computed(() => {
  const p = notebookSource.value;
  if (!p) return "";
  const name = p.split("/").pop();
  return p.startsWith("input") ? `${name} (from input)` : name;
});

const kernelPill = computed(() => {
  const s = kernelStatus.value;
  if (s === "idle") return { label: "idle", cls: "ok" };
  if (s === "busy") return { label: "busy", cls: "busy" };
  if (s === "starting" || s === "restarting") return { label: s, cls: "warn" };
  if (s === "dead") return { label: "dead", cls: "err" };
  return { label: s, cls: "" };
});
</script>

<template>
  <div class="nb">
    <!-- End-session confirmation (Pennsieve dialog, not the browser prompt) -->
    <el-dialog
      v-model="confirmEnd"
      title="End interactive session?"
      width="460px"
      :close-on-click-modal="!ending"
      :show-close="!ending"
      align-center
    >
      <p class="nb-confirm-text">
        Ending the session shuts down the kernel and resumes the workflow at the
        next step. <strong>Save &amp; end</strong> uploads the notebook and any
        files it generated to Pennsieve. <strong>Discard &amp; end</strong>
        throws the whole session away — nothing from this session is uploaded.
      </p>
      <p v-if="dirty" class="nb-confirm-warn">You have unsaved changes.</p>
      <p v-if="error" class="nb-confirm-err">{{ error }}</p>
      <template #footer>
        <el-button :disabled="ending" @click="confirmEnd = false">Cancel</el-button>
        <el-button
          type="danger"
          plain
          :disabled="ending"
          @click="endSession(false)"
        >
          Discard &amp; end
        </el-button>
        <el-button type="primary" :loading="ending" @click="endSession(true)">
          Save &amp; end
        </el-button>
      </template>
    </el-dialog>

    <!-- One-time "how notebook sessions work" info dialog -->
    <el-dialog
      v-model="showInfoDialog"
      title="How notebook sessions work"
      width="520px"
      align-center
    >
      <ul class="nb-info-list">
        <li class="nb-info-item">
          <strong>Sessions close after inactivity.</strong>
          After about 1 hour with no activity the kernel shuts down and the
          workflow resumes, so save before stepping away. In-memory variables are
          lost on timeout — your notebook is recovered, but you'll re-run cells to
          rebuild state.
        </li>
        <li class="nb-info-item">
          <strong>Your output folder is uploaded to Pennsieve.</strong>
          Anything you write to the <code>output/</code> folder is uploaded to the
          output location you selected when you started the session.
        </li>
        <li class="nb-info-item">
          <strong>Opening an existing notebook may overwrite it.</strong>
          An opened notebook replaces the original only when your selected output
          folder is the same folder the notebook is stored in; otherwise it's
          saved as a new file.
        </li>
        <li class="nb-info-item">
          <strong>Leaving doesn't end the session.</strong>
          You can navigate away and reconnect later — the session keeps running
          (and your work autosaves) until you end it or it times out.
        </li>
        <li class="nb-info-item">
          <strong>Ending is your choice to keep or discard.</strong>
          <em>Save &amp; end</em> uploads your work; <em>Discard &amp; end</em>
          uploads nothing from the session.
        </li>
      </ul>
      <template #footer>
        <div class="nb-info-footer">
          <el-checkbox v-model="dontShowInfoAgain">Don't show this again</el-checkbox>
          <el-button type="primary" @click="dismissInfo">Got it</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Discard-unsaved-changes guard when opening another notebook -->
    <el-dialog
      :model-value="!!pendingOpenPath"
      @update:model-value="(v) => { if (!v && !opening) pendingOpenPath = null; }"
      title="Open notebook?"
      width="460px"
      :close-on-click-modal="!opening"
      :show-close="!opening"
      align-center
    >
      <p class="nb-confirm-text">
        Opening a notebook replaces the current cells, and you have unsaved
        changes that will be lost. Save first if you want to keep them.
      </p>
      <template #footer>
        <el-button :disabled="opening" @click="pendingOpenPath = null">
          Cancel
        </el-button>
        <el-button type="primary" :loading="opening" @click="confirmDiscardOpen">
          Discard &amp; open
        </el-button>
      </template>
    </el-dialog>

    <!-- states -->
    <!-- Connecting: full empty-state while the kernel task launches + warms up.
         Surfaces the live stage message (connecting → starting/reconnecting →
         waiting) so a cold start (image pull, ~1 min) doesn't look stalled. -->
    <div v-if="status === 'connecting'" class="nb-empty">
      <img
        class="nb-empty__illo"
        src="@/assets/images/illustrations/illo-dr_azumi_1.svg"
        alt=""
      />
      <h2 class="nb-empty__title">Getting your notebook ready</h2>
      <div class="nb-empty__status">
        <el-icon class="nb-empty__spin"><Loading /></el-icon>
        <span class="nb-empty__msg">{{ connectingMessage }}</span>
      </div>
      <div class="nb-empty__bar">
        <span class="nb-empty__bar-fill" :style="{ width: progress + '%' }" />
      </div>
      <p v-if="etaLabel" class="nb-empty__eta">{{ etaLabel }}</p>
      <p class="nb-empty__hint">
        We're launching an interactive compute session for this run. The first
        launch can take up to a minute while the environment is pulled and
        started — you can leave this tab open.
      </p>
    </div>

    <div v-if="status === 'error'" class="nb-empty">
      <img
        class="nb-empty__illo"
        src="@/assets/images/illustrations/illo-dr_azumi_1.svg"
        alt=""
      />
      <h2 class="nb-empty__title">Couldn't connect to your notebook</h2>
      <p class="nb-empty__msg nb-empty__msg--error">{{ error }}</p>
      <el-button type="primary" @click="connect(props.runId)">Try again</el-button>
    </div>

    <div v-if="status === 'closed'" class="nb-empty">
      <img
        class="nb-empty__illo"
        src="@/assets/images/illustrations/illo-dr_azumi_1.svg"
        alt=""
      />
      <h2 class="nb-empty__title">Session ended</h2>
      <p class="nb-empty__msg">Your kernel has been shut down and the workflow will continue at the next step.</p>
      <router-link :to="runRoute" class="nb-empty__link">View the run →</router-link>
    </div>

    <!-- file browser + notebook -->
    <div v-if="status === 'ready'" class="nb-main">
      <aside
        v-show="showFiles"
        id="nb-sidebar"
        class="nb-files"
        :class="{ 'is-resizing': resizingSidebar }"
        :style="{ width: `${sidebarWidth}px`, flexBasis: `${sidebarWidth}px` }"
      >
        <div class="nb-files__content">
        <EnvironmentPanel
          :environment-state="environmentState"
          :switch-environment="switchEnvironment"
          :clear-environment="clearEnvironment"
          :ready="status === 'ready'"
          :kernel-name="kernelName"
          :gpu="onGpu"
          :kernel-packages="kernelPackages"
        />
        <AddDataDialog
          v-if="inputs.canAdd"
          v-model="addingData"
          :sources="inputs.sources"
          :add-input-source="addInputSource"
          @added="inputs.loadSources()"
        />
        <div class="nb-files__browser">
          <FileBrowser
            ref="fileBrowserRef"
            :list-dir="listDir"
            :read-text="readText"
            :ready="status === 'ready'"
            :kernel-name="kernelName"
            :inputs="inputs"
            @insert-path="insertPath"
            @open-notebook="requestOpen"
            @insert-snippet="insertSnippet"
            :assist-available="assistAvailable"
            :assist-paused="assistPaused"
            @ask-file="askAboutFile"
            @add-data="addingData = true"
          />
        </div>
        </div>
        <div
          class="nb-files__resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the sidebar"
          :aria-valuenow="sidebarWidth"
          :aria-valuemin="SIDEBAR_MIN"
          :aria-valuemax="SIDEBAR_MAX"
          tabindex="0"
          @pointerdown.prevent="startSidebarResize"
          @dblclick="nudgeSidebar(SIDEBAR_DEFAULT - sidebarWidth)"
          @keydown.left.prevent="nudgeSidebar(-20)"
          @keydown.right.prevent="nudgeSidebar(20)"
        />
      </aside>

      <!-- The notebook pane: its toolbar and banner sit over the notebook only,
           so the sidebar runs the full height beside them. -->
      <div class="nb-pane">
        <!-- toolbar -->
        <div ref="toolbarRef" class="nb-toolbar" :class="{ 'is-compact': compactToolbar }" v-if="status === 'ready'">
          <el-tooltip :content="showFiles ? 'Hide inputs and session files' : 'Show inputs and session files'" :show-after="400">
            <el-button
              size="small"
              class="nb-sidebar-toggle"
              :class="{ 'is-on': showFiles }"
              :icon="FolderOpened"
              :aria-label="showFiles ? 'Hide the sidebar' : 'Show the sidebar'"
              aria-controls="nb-sidebar"
              :aria-expanded="showFiles"
              @click="toggleSidebar"
            />
          </el-tooltip>
          <span class="nb-div" />
          <el-tooltip content="Save (⌘/Ctrl+S)" :show-after="400">
            <el-button size="small" :icon="Document" :loading="saving" aria-label="Save" @click="saveAndRefresh">
              <span v-if="!compactToolbar">Save</span><span v-if="dirty" class="nb-dirty">•</span>
            </el-button>
          </el-tooltip>

          <el-dropdown trigger="click" @command="addCellFromMenu">
            <el-button size="small" :icon="Plus" aria-label="Add a cell" :title="compactToolbar ? 'Add a cell' : undefined">
              <span v-if="!compactToolbar">Add</span><el-icon class="nb-caret"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="code">Code cell</el-dropdown-item>
                <el-dropdown-item command="markdown">Markdown cell</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <span class="nb-div" />

          <el-tooltip content="Run selected (Shift+Enter)" :show-after="400">
            <el-button size="small" type="primary" :icon="VideoPlay" aria-label="Run" @click="runSelected">
              <span v-if="!compactToolbar">Run</span>
            </el-button>
          </el-tooltip>
          <el-tooltip content="Run all cells" :show-after="400">
            <el-button size="small" :icon="DArrowRight" aria-label="Run all" @click="runAll">
              <span v-if="!compactToolbar">Run all</span>
            </el-button>
          </el-tooltip>

          <el-dropdown trigger="click" @command="onKernelCommand">
            <el-button size="small" :icon="RefreshRight" aria-label="Kernel" :title="compactToolbar ? 'Kernel' : undefined">
              <span v-if="!compactToolbar">Kernel</span><el-icon class="nb-caret"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="interrupt">Interrupt</el-dropdown-item>
                <el-dropdown-item command="restart">Restart</el-dropdown-item>
                <el-dropdown-item command="restartRunAll">Restart &amp; run all</el-dropdown-item>
                <el-dropdown-item command="clear" divided>Clear all outputs</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <span v-if="notebookSourceLabel" class="nb-source" :title="`Editing ${notebookSource}`">
            <el-icon class="nb-source__icon"><Document /></el-icon>
            <template v-if="!compactToolbar">editing: {{ notebookSourceLabel }}</template>
          </span>

          <span class="nb-spacer" />

          <span v-if="onGpu" class="nb-gpu" :title="gpuMarkTitle(sessionGpu)">
            <RuntimeMark runtime="gpu" compact :label="gpuMarkTitle(sessionGpu)" /><template v-if="!compactToolbar">{{ gpuShortLabel(sessionGpu) }}</template>
          </span>

          <AssistSpend v-if="assistAvailable" :budget="assistInfo.budget" :last="assistLast" :tokens="assistTokens" :compact="compactToolbar" />

          <span
            class="nb-kernel"
            :class="`nb-kernel--${kernelPill.cls}`"
            :title="`${kernelName || 'Kernel'} · ${kernelPill.label}`"
          >
            <el-icon v-if="kernelPill.cls === 'busy'" class="nb-kernel__spin"><Loading /></el-icon>
            <span class="nb-kernel__dot" />
            <template v-if="!compactToolbar">{{ kernelName || "Kernel" }} · </template>{{ kernelPill.label }}
          </span>

          <el-tooltip content="End session" :show-after="400" :disabled="!compactToolbar">
            <el-button
              size="small"
              type="danger"
              plain
              :icon="SwitchButton"
              :loading="ending"
              aria-label="End session"
              @click="confirmEnd = true"
            >
              <span v-if="!compactToolbar">End session</span>
            </el-button>
          </el-tooltip>
        </div>

        <!-- What a session on this node can't do (a compliant node: no
             internet), once per session until dismissed. -->
        <div v-if="restrictions && !restrictionsDismissed" class="nb-restrictions" role="note">
          <IconWarningCircle class="nb-restrictions__icon" :width="16" :height="16" />
          <div class="nb-restrictions__text">
            <strong>{{ restrictions.title }}</strong>
            <ul>
              <li v-for="item in restrictions.items" :key="item">{{ item }}</li>
            </ul>
          </div>
          <button type="button" class="nb-restrictions__close" aria-label="Dismiss" title="Dismiss" @click="dismissRestrictions">&times;</button>
        </div>

        <!-- Offer to open an existing notebook staged in input/ -->
        <div v-if="status === 'ready' && showInputBanner" class="nb-open-banner">
          <span class="nb-open-banner__text">
            <template v-if="inputNotebooks.length === 1">
              Found a notebook in your input files:
              <strong>{{ inputNotebooks[0].name }}</strong>
            </template>
            <template v-else>
              Found {{ inputNotebooks.length }} notebooks in your input files —
              choose one to open.
            </template>
          </span>
          <el-select
            v-if="inputNotebooks.length > 1"
            v-model="inputChoice"
            size="small"
            placeholder="Choose a notebook"
            class="nb-open-banner__select"
          >
            <el-option
              v-for="nb in inputNotebooks"
              :key="nb.path"
              :label="nb.name"
              :value="nb.path"
            />
          </el-select>
          <el-button
            size="small"
            type="primary"
            :loading="opening"
            :disabled="!inputChoice"
            @click="openFromBanner"
          >
            Open
          </el-button>
          <el-button size="small" text @click="showInputBanner = false">
            Dismiss
          </el-button>
        </div>

        <div class="nb-doc">
          <NotebookCell
            v-for="(cell, i) in cells"
            :key="cell.id"
            :ref="(el) => setCellRef(cell.id, el)"
            :cell="cell"
            :selected="cell.id === selectedId"
            :is-first="i === 0"
            :is-last="i === cells.length - 1"
            @select="select(cell.id)"
            @update:source="setSource(cell.id, $event)"
            @run="onRun(cell, $event)"
            @edit="cell._editing = true"
            @add-below="select(addCell(cell.id, 'code'))"
            @delete="deleteCell(cell.id)"
            @move-up="moveCell(cell.id, -1)"
            @move-down="moveCell(cell.id, 1)"
            @change-type="onChangeType(cell, $event)"
            @focus-prev="selectRel(-1)"
            @focus-next="selectRel(1)"
            :assist-available="assistAvailable"
            :assist-paused="assistPaused"
            :complete="complete"
            :inspect="inspect"
            @assist="onAssist(cell, $event)"
          />
          <div class="nb-add-row">
            <el-button size="small" :icon="Plus" @click="focusCell(addCell(null, 'code'))">
              Add cell
            </el-button>
            <span v-if="error" class="nb-inline-err">{{ error }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nb {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  background: #fff;
}
/* Toolbar matches the platform action bar (builder-header): white, 48px,
   gray_3 underline, brand-navy primary actions. */
.nb-toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 24px;
  border-bottom: 1px solid #cccccc; /* gray_3 */
  background: #ffffff;
  flex-wrap: wrap;
}
/* Brand-navy primary buttons within the toolbar (matches bf-button primary). */
.nb-toolbar :deep(.el-button--primary) {
  --el-button-bg-color: #011f5b; /* purple_3 */
  --el-button-border-color: #011f5b;
  --el-button-hover-bg-color: #4d628c; /* purple_2 */
  --el-button-hover-border-color: #4d628c;
  --el-button-active-bg-color: #011f5b;
  --el-button-active-border-color: #011f5b;
}
/* Spacing is owned by the toolbar's flex `gap`; cancel Element Plus's default
   adjacent-button margin so gaps don't double up unevenly (some buttons are
   wrapped in el-tooltip, some aren't). */
.nb-toolbar :deep(.el-button + .el-button) {
  margin-left: 0;
}
.nb-caret {
  margin-left: 4px;
  vertical-align: middle;
}
/* The sidebar toggle: a plain button, tinted while the sidebar is open (the
   app's primary style would paint the icon the same navy as its fill). */
.nb-sidebar-toggle.is-on {
  background: #e6e9ef; /* purple_tint */
  border-color: #808fad; /* purple_1 */
  color: #011f5b; /* purple_3 */
}
.nb-toolbar.is-compact {
  flex-wrap: nowrap;
  gap: 6px;
}
/* An icon-only button still renders its (now empty) label wrapper, whose left
   margin would push the icon off centre. */
.nb-toolbar.is-compact :deep(.el-button > span:empty) {
  display: none;
}
.nb-div { width: 1px; align-self: stretch; margin: 2px 4px; background: #e5e5e5; }
.nb-spacer { flex: 1; }
.nb-dirty { color: #f9a23a; font-weight: 700; margin-left: 2px; } /* orange_1 */
.nb-source {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 280px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #6b87b3; /* muted navy */
}
.nb-source__icon { font-size: 13px; }
.nb-gpu {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #4d4d4d; /* gray_5 */
  margin-right: 8px;
}
.nb-kernel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #4d4d4d; /* gray_5 */
  padding: 4px 10px;
  border-radius: 12px;
  background: #f2f2f2; /* gray_0 */
}
.nb-kernel__dot { width: 8px; height: 8px; border-radius: 50%; background: #999; }
.nb-kernel__spin { animation: nb-spin 1s linear infinite; }
.nb-kernel--ok { background: #edf8f1; color: #14a758; }
.nb-kernel--ok .nb-kernel__dot { background: #17bb62; }
.nb-kernel--busy { background: #e6e9ef; color: #011f5b; }
.nb-kernel--busy .nb-kernel__dot { display: none; }
.nb-kernel--warn { background: #fef6eb; color: #e0912a; }
.nb-kernel--warn .nb-kernel__dot { background: #f9a23a; }
.nb-kernel--err { background: #feeeec; color: #c14d49; }
.nb-kernel--err .nb-kernel__dot { background: #f25641; }
@keyframes nb-spin { to { transform: rotate(360deg); } }

.nb-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.nb-files {
  position: relative;
  flex: 0 0 300px;
  width: 300px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.nb-files__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.nb-files.is-resizing {
  user-select: none;
}
/* A thin grab strip on the sidebar's right edge; double-click resets it. */
.nb-files__resize {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 2;
}
.nb-files__resize:hover,
.nb-files__resize:focus-visible,
.nb-files.is-resizing .nb-files__resize {
  background: #808fad; /* purple_1 */
  outline: none;
}
.nb-files__browser {
  flex: 1;
  min-height: 0;
}
.nb-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.nb-doc {
  flex: 1;
  min-width: 0;
  overflow: auto;
  /* Roomy column with small side gutters; only large monitors get centered
     margins (cap keeps long lines readable). */
  padding: 20px max(24px, calc((100% - 1280px) / 2)) 120px;
}
.nb-add-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0 12px 52px;
}
.nb-inline-err { color: #c14d49; font-size: 12px; }

/* Full-height empty state for connecting / error / closed — illustration,
   title, live status, and a reassuring hint while the kernel warms up. */
.nb-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px 24px;
  text-align: center;
}
.nb-empty__illo {
  width: 200px;
  height: auto;
  max-width: 60%;
  opacity: 0.9;
}
.nb-empty__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1c1c1c; /* gray_6 */
}
.nb-empty__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #011f5b; /* purple_3 */
}
.nb-empty__spin {
  font-size: 16px;
  animation: nb-spin 1s linear infinite;
}
.nb-empty__msg {
  font-size: 14px;
  color: #4d4d4d; /* gray_5 */
  margin: 0;
  max-width: 440px;
  line-height: 1.5;
}
.nb-empty__msg--error { color: #c14d49; }
/* Determinate progress bar — the fill width is a simulated, time-calibrated
   estimate (no real progress signal exists for a launching kernel). */
.nb-empty__bar {
  width: 240px;
  max-width: 70%;
  height: 4px;
  border-radius: 2px;
  background: #e6e9ef;
  overflow: hidden;
}
.nb-empty__bar-fill {
  display: block;
  width: 0;
  height: 100%;
  border-radius: 2px;
  background: #011f5b; /* purple_3 */
  transition: width 0.2s linear;
}
.nb-empty__eta {
  margin: 0;
  font-size: 12px;
  color: #4d628c; /* purple_2 */
}
.nb-empty__hint {
  margin: 0;
  font-size: 13px;
  color: #888;
  max-width: 420px;
  line-height: 1.5;
}
.nb-empty__link {
  display: inline-block;
  margin-top: 4px;
  padding: 8px 16px;
  border-radius: 6px;
  background: #011f5b; /* purple_3 */
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s ease;
}
.nb-empty__link:hover { background: #4d628c; /* purple_2 */ }
.nb-confirm-text { margin: 0; color: #4d4d4d; line-height: 1.5; }
.nb-confirm-text code {
  background: #f2f2f2;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.nb-confirm-warn { margin: 12px 0 0; color: #e0912a; font-size: 13px; } /* orange */
.nb-confirm-err { margin: 12px 0 0; color: #c14d49; font-size: 13px; }

/* Info dialog */
.nb-info-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.nb-info-item {
  font-size: 13px;
  line-height: 1.5;
  color: #4d4d4d; /* gray_5 */
  padding-left: 16px;
  position: relative;
}
.nb-info-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #011f5b; /* purple_3 */
}
.nb-info-item strong { color: #333333; /* gray_6 */ }
.nb-info-item code {
  background: #f2f2f2;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.nb-info-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nb-open-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 24px;
  background: #eef2f9; /* light navy tint */
  border-bottom: 1px solid #d7e0ef;
  font-size: 13px;
  color: #333333; /* gray_6 */
  flex-wrap: wrap;
}
.nb-open-banner__text { flex: 1; min-width: 180px; }
.nb-restrictions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 24px;
  background: #fef6eb; /* orange_tint */
  border-bottom: 1px solid #f6dcb6;
  font-size: 13px;
  color: #333333; /* gray_6 */
}
.nb-restrictions__icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: #e0912a; /* orange_2 */
}
.nb-restrictions__text {
  flex: 1;
  min-width: 0;

  ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
  li + li {
    margin-top: 2px;
  }
}
.nb-restrictions__close {
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0 2px;
  font-size: 18px;
  line-height: 1;
  color: #71747c; /* gray_4 */
  cursor: pointer;
}
.nb-open-banner__select { width: 240px; }
</style>
