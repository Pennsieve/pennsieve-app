<script setup>
// Multi-cell interactive Jupyter notebook for a workflow run. Connects to the
// live kernel via @jupyterlab/services (through the per-node auth-proxy sidecar),
// loads/saves a notebook.ipynb on EFS, and provides a Jupyter-like editing
// surface (code + markdown cells, per-cell run, run-all, restart, command-mode
// keyboard shortcuts).
import { onMounted, onBeforeUnmount, nextTick, ref, computed } from "vue";
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

const {
  status,
  connectingMessage,
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

const selectedId = ref(null);
const cellRefs = new Map();
const ending = ref(false);
const confirmEnd = ref(false);
const showFiles = ref(true);
const fileBrowserRef = ref(null);
let lastD = 0;

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
  if (status.value === "ready") scanInputNotebooks();
  window.addEventListener("keydown", onKeydown, true);
  window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown, true);
  window.removeEventListener("beforeunload", onBeforeUnload);
  // Leave the session running; just drop the local connection.
  disconnect();
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

// End the interactive session (resumes the workflow). Confirmed via the
// in-app dialog — `saveFirst` writes notebook.ipynb to output/ before closing.
// On a failed save we keep the dialog open rather than tearing down unsaved work.
async function endSession(saveFirst) {
  ending.value = true;
  try {
    if (saveFirst) {
      const saved = await save();
      if (!saved) return;
    }
    await close();
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
        next step. Save first to write
        <code>output/notebook.ipynb</code> so your work is passed along.
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
          Close without saving
        </el-button>
        <el-button type="primary" :loading="ending" @click="endSession(true)">
          Save &amp; close
        </el-button>
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
    <p v-if="status === 'connecting'" class="nb-msg">{{ connectingMessage }}</p>
    <p v-if="status === 'error'" class="nb-msg nb-msg--error">{{ error }}</p>
    <p v-if="status === 'closed'" class="nb-msg">Session ended. The workflow will continue.</p>

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
.nb-msg { padding: 20px; color: #4d4d4d; }
.nb-msg--error { color: #c14d49; }
.nb-confirm-text { margin: 0; color: #4d4d4d; line-height: 1.5; }
.nb-confirm-text code {
  background: #f2f2f2;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}
.nb-confirm-warn { margin: 12px 0 0; color: #e0912a; font-size: 13px; } /* orange */
.nb-confirm-err { margin: 12px 0 0; color: #c14d49; font-size: 13px; }
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
