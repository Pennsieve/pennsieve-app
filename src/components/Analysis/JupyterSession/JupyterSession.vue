<script setup>
// Multi-cell interactive Jupyter notebook for a workflow run. Connects to the
// live kernel via @jupyterlab/services (through the per-node auth-proxy sidecar),
// loads/saves a notebook.ipynb on EFS, and provides a Jupyter-like editing
// surface (code + markdown cells, per-cell run, run-all, restart, command-mode
// keyboard shortcuts).
import { onMounted, onBeforeUnmount, nextTick, ref, computed, watch } from "vue";
import { useRoute, onBeforeRouteLeave } from "vue-router";
import { useJupyterSession } from "@/composables/useJupyterSession";
import NotebookCell from "./NotebookCell.vue";
import FileBrowser from "./FileBrowser.vue";
import {
  VideoPlay,
  DArrowRight,
  RefreshRight,
  FolderOpened,
  Document,
  Plus,
  ArrowDown,
  SwitchButton,
  Loading,
} from "@element-plus/icons-vue";

const props = defineProps({
  runId: { type: String, required: true },
});

// Route to the Analysis tab (orgId from the current route) — offered as a way
// back once the session has ended and the notebook surface is gone.
const route = useRoute();
const analysisRoute = computed(() => ({
  name: "analysis",
  params: { orgId: route.params.orgId },
}));

const {
  status,
  connectingMessage,
  connectPhase,
  kernelStatus,
  kernelName,
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
  downloadFile,
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
const showFiles = ref(true);
const fileBrowserRef = ref(null);
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

// Insert a filesystem path (from the file browser) into the selected code cell
// as a quoted string; if no code cell is selected, create one.
function insertPath(path) {
  const literal = `"${path}"`;
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
    <!-- toolbar -->
    <div class="nb-toolbar" v-if="status === 'ready'">
      <el-tooltip content="Toggle file browser" :show-after="400">
        <el-button
          size="small"
          :type="showFiles ? 'primary' : 'default'"
          :icon="FolderOpened"
          @click="showFiles = !showFiles"
        >
          Files
        </el-button>
      </el-tooltip>

      <span class="nb-div" />

      <el-tooltip content="Save (⌘/Ctrl+S)" :show-after="400">
        <el-button size="small" :icon="Document" :loading="saving" @click="saveAndRefresh">
          Save<span v-if="dirty" class="nb-dirty">•</span>
        </el-button>
      </el-tooltip>

      <el-dropdown trigger="click" @command="addCellFromMenu">
        <el-button size="small" :icon="Plus">
          Add<el-icon class="nb-caret"><ArrowDown /></el-icon>
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
        <el-button size="small" type="primary" :icon="VideoPlay" @click="runSelected">Run</el-button>
      </el-tooltip>
      <el-tooltip content="Run all cells" :show-after="400">
        <el-button size="small" :icon="DArrowRight" @click="runAll">Run all</el-button>
      </el-tooltip>

      <el-dropdown trigger="click" @command="onKernelCommand">
        <el-button size="small" :icon="RefreshRight">
          Kernel<el-icon class="nb-caret"><ArrowDown /></el-icon>
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

      <span v-if="notebookSourceLabel" class="nb-source" :title="notebookSource">
        <el-icon class="nb-source__icon"><Document /></el-icon>
        editing: {{ notebookSourceLabel }}
      </span>

      <span class="nb-spacer" />

      <span class="nb-kernel" :class="`nb-kernel--${kernelPill.cls}`">
        <el-icon v-if="kernelPill.cls === 'busy'" class="nb-kernel__spin"><Loading /></el-icon>
        <span class="nb-kernel__dot" />
        {{ kernelName || "Kernel" }} · {{ kernelPill.label }}
      </span>

      <el-button
        size="small"
        type="danger"
        plain
        :icon="SwitchButton"
        :loading="ending"
        @click="confirmEnd = true"
      >
        End session
      </el-button>
    </div>

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
      <router-link :to="analysisRoute" class="nb-empty__link">Return to Analysis →</router-link>
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

    <!-- file browser + notebook -->
    <div v-if="status === 'ready'" class="nb-main">
      <aside v-show="showFiles" class="nb-files">
        <FileBrowser
          ref="fileBrowserRef"
          :list-dir="listDir"
          :download-file="downloadFile"
          :ready="status === 'ready'"
          @insert-path="insertPath"
          @open-notebook="requestOpen"
        />
      </aside>

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
  flex: 0 0 250px;
  width: 250px;
  min-height: 0;
  overflow: hidden;
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
.nb-open-banner__select { width: 240px; }
</style>
