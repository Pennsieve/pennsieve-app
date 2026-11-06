<script setup>
// JupyterLab-style file browser for the session's disk. Lazily expands
// directories via the Contents API, shows size/modified, and lets the user
// copy a path or insert it into the notebook. Under input/, each of the
// session's views (inputs: useSessionInputs) is a folder, and what it holds
// shows whether it's on the disk or not yet: a click downloads a file, a big
// one asks first, and a download under way can be cancelled. Files leave the
// session only through the run's data targets (e.g. a download target's
// zip), not from here. Refreshes on demand (and the parent calls refresh()
// after cell runs and downloads).
import { computed, ref, watch } from "vue";
import FileNode from "./FileNode.vue";
import { ArrowRight } from "@element-plus/icons-vue";
import { fileIconForPath } from "@/utils/fileIconForPath";
import { sessionPathCode } from "./pathCode";
import { visibleEntries, readShowHidden, writeShowHidden } from "./fileBrowserHelpers";
import { useRememberedFold } from "./sectionFold";

const props = defineProps({
  listDir: { type: Function, required: true },
  ready: { type: Boolean, default: false },
  // The kernel's language and version ("Python 3.12.3"): copied paths are
  // code for it (pathCode.js).
  kernelName: { type: String, default: "" },
  // The session's view inputs (useSessionInputs), or null.
  inputs: { type: Object, default: null },
});

const emit = defineEmits(["insert-path", "open-notebook", "insert-stack", "add-data"]);

// Tree node: { name, path, type, size, last_modified, children, open, loading }
const roots = ref([]);
// Folded or not, remembered in this browser.
const collapsed = useRememberedFold("files");
const loading = ref(false);
const error = ref(null);
// Dot-files and dot-folders (each input's .pennsieve/, a dataset's
// .datalad/) are hidden unless the user shows them; remembered here.
const showHidden = ref(readShowHidden());
watch(showHidden, (v) => writeShowHidden(v));
const shownRoots = computed(() => visibleEntries(roots.value, showHidden.value));

function decorate(entry) {
  return {
    ...entry,
    children: null,
    open: false,
    loading: false,
  };
}

// A folder's disk listing with what the views hold there: a file or folder
// on the disk gets its view ({ source, rel, entry, root }); one that isn't,
// a virtual node of its own (a file to download, a folder of them, a stack).
function withViews(disk, dirPath) {
  const rows = props.inputs ? props.inputs.overlay(dirPath) : [];
  if (!rows.length) return disk;
  const byName = new Map(disk.map((n) => [n.name, n]));
  for (const r of rows) {
    const view = { source: r.source, rel: r.rel, entry: r.entry || null, root: !!r.root };
    const onDisk = byName.get(r.name);
    if (onDisk) {
      onDisk.view = view;
      continue;
    }
    const type = r.type === "folder" ? "directory" : r.type;
    byName.set(r.name, { ...decorate({ name: r.name, path: `${dirPath}/${r.name}`, type, size: type === "directory" ? null : r.size }), virtual: true, view });
  }
  const dirsFirst = (n) => (n.type === "directory" ? 0 : 1);
  return [...byName.values()].sort((a, b) => dirsFirst(a) - dirsFirst(b) || a.name.localeCompare(b.name));
}

// A folder's children: on the disk (none for one that's only in a view),
// with what the views hold there.
async function childrenOf(node) {
  const disk = node.virtual ? [] : (await props.listDir(node.path)).map(decorate);
  return withViews(disk, node.path);
}

async function loadRoot(preserve = false) {
  if (!props.ready) return;
  // Remember which folders are expanded so a refresh (e.g. after Save) keeps
  // them open and surfaces newly-written files in place, rather than collapsing
  // the whole tree.
  const openPaths = preserve ? collectOpenPaths(roots.value) : null;
  loading.value = true;
  error.value = null;
  try {
    const entries = await props.listDir("");
    roots.value = entries.map(decorate);
    if (openPaths && openPaths.size) {
      await expandPaths(roots.value, openPaths);
    } else {
      await autoExpandInput();
    }
  } catch (e) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

function collectOpenPaths(nodes, acc = new Set()) {
  for (const n of nodes || []) {
    if (n.type === "directory" && n.open) {
      acc.add(n.path);
      collectOpenPaths(n.children, acc);
    }
  }
  return acc;
}

async function expandPaths(nodes, openPaths) {
  for (const n of nodes || []) {
    if (n.type === "directory" && openPaths.has(n.path)) {
      await toggle(n); // opens + lazily loads children
      await expandPaths(n.children, openPaths);
    }
  }
}

// Open input/ on load so staged data is visible without hunting; if there's a
// single data-source subfolder (the common case), drill into it so the actual
// files show — the user never has to click through the opaque node-id folder.
async function autoExpandInput() {
  const input = roots.value.find(
    (n) => n.type === "directory" && n.name === "input"
  );
  if (!input) return;
  await toggle(input);
  const shown = visibleEntries(input.children, showHidden.value);
  if (shown.length === 1 && shown[0].type === "directory") {
    await toggle(shown[0]);
  }
}

async function toggle(node) {
  if (node.type !== "directory") return;
  node.open = !node.open;
  if (node.open && node.children == null) {
    node.loading = true;
    try {
      node.children = await childrenOf(node);
    } catch (e) {
      node.children = [];
      error.value = e?.message || String(e);
    } finally {
      node.loading = false;
    }
  }
}

function refresh() {
  // Reload the tree, preserving expanded folders so new files show up in place.
  loadRoot(true);
}
// The views read (or one added or removed): the tree shows them.
watch(
  () => props.inputs?.sources,
  () => {
    if (props.ready && roots.value.length) refresh();
  }
);

defineExpose({ refresh });

watch(
  () => props.ready,
  (r) => {
    if (r) loadRoot();
  },
  { immediate: true }
);

function fmtSize(n) {
  if (n == null) return "";
  if (n < 0) n = 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fmtTime(t) {
  if (!t) return "";
  try {
    return new Date(t).toLocaleString();
  } catch (_) {
    return "";
  }
}

// The Pennsieve file icon for a node, as the dataset files table shows.
function icon(node) {
  return fileIconForPath(node.name, { folder: node.type === "directory" });
}

function copyPath(node) {
  navigator.clipboard?.writeText(sessionPathCode(node.path, props.kernelName)).catch(() => {});
}

</script>

<template>
  <div class="fb">
    <div class="fb__head" @click="collapsed = !collapsed">
      <span class="fb__title" title="What's on the session's disk: input/, output/ and your notebook">Session files</span>
      <span class="fb__head-actions">
        <!-- Dot-files and folders, such as each input's .pennsieve/ (its dataset view) -->
        <button
          v-if="!collapsed"
          class="fb__hidden-toggle"
          :class="{ 'is-on': showHidden }"
          :title="showHidden ? 'Hide hidden files' : 'Show hidden files (.pennsieve, .datalad)'"
          :aria-label="showHidden ? 'Hide hidden files' : 'Show hidden files'"
          :aria-pressed="showHidden"
          @click.stop="showHidden = !showHidden"
        >
          <svg v-if="showHidden" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
            <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.3" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
            <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.3" />
            <path d="M2.5 13.5 13.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
        </button>
        <button v-if="!collapsed" class="fb__refresh" title="Refresh" aria-label="Refresh" :disabled="loading" @click.stop="refresh">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13 8a5 5 0 1 1-1.46-3.54" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
            <path d="M13 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button class="fb__fold" :aria-expanded="!collapsed" aria-label="Fold session files" @click.stop="collapsed = !collapsed">
          <el-icon class="fb__chevron" :class="{ 'is-open': !collapsed }"><ArrowRight /></el-icon>
        </button>
      </span>
    </div>
    <template v-if="!collapsed">

    <p v-if="!ready" class="fb__msg">Connecting…</p>
    <p v-else-if="loading && !roots.length" class="fb__msg">Loading…</p>
    <p v-else-if="error" class="fb__msg fb__msg--error">{{ error }}</p>
    <p v-else-if="!roots.length" class="fb__msg">No files.</p>

    <ul v-if="ready && !error && shownRoots.length" class="fb__tree">
      <FileNode
        v-for="node in shownRoots"
        :key="node.path"
        :node="node"
        :depth="0"
        :show-hidden="showHidden"
        :icon-of="icon"
        :fmt-size="fmtSize"
        :fmt-time="fmtTime"
        :inputs="inputs"
        @toggle="toggle"
        @copy="copyPath"
        @insert="emit('insert-path', $event)"
        @open="emit('open-notebook', $event)"
        @insert-stack="emit('insert-stack', $event)"
        @add-data="emit('add-data')"
      />
    </ul>

    <!-- The inputs: what's ticked, what's under way, the disk. -->
    <div v-if="inputs && ready && (inputs.sources.length || inputs.requestError)" class="fb__foot">
      <div v-if="inputs.selected.size" class="fb__bar">
        <span class="fb__bar-text">{{ inputs.selected.size }} selected · {{ fmtSize(inputs.selectedSize) }}</span>
        <button class="fb__bar-btn" @click="inputs.clearSelection()">Clear</button>
        <button class="fb__bar-btn fb__bar-btn--go" @click="inputs.downloadSelected()">Download</button>
      </div>
      <div v-if="inputs.active.length" class="fb__bar">
        <span class="fb__bar-text">Downloading {{ inputs.active.length }} · {{ fmtSize(inputs.activeLeft) }} left</span>
        <button class="fb__bar-btn" @click="inputs.cancelAll()">Cancel all</button>
      </div>
      <p v-if="inputs.requestError" class="fb__msg fb__msg--error">{{ inputs.requestError }}</p>
      <div class="fb__disk" title="Files downloaded from the inputs, against the disk the session was started with. The environment and your own files use it too.">
        <span class="fb__disk-text">{{ inputs.diskUse.text }}</span>
        <span v-if="inputs.diskUse.share != null" class="fb__disk-bar" :class="{ 'is-full': inputs.diskUse.full }">
          <span :style="{ width: `${Math.round(inputs.diskUse.share * 100)}%` }" />
        </span>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.fb {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 13px;
  min-width: 0;
}
/* Section header as the workflow builder's panel headings (_sidePanel.scss
   .panel-heading): a small uppercase label on the panel's own background,
   no line under it (sections are set apart by a stronger line between
   them); its actions and chevron on the right. */
.fb__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  cursor: pointer;
  border-bottom: none;
}
.fb__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.fb__head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.fb__fold {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  padding: 2px 4px;
  cursor: pointer;
  color: theme.$gray_5;
}
.fb__chevron {
  transition: transform 0.2s ease;
}
.fb__chevron.is-open {
  transform: rotate(90deg);
}
.fb__hidden-toggle {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  padding: 2px 4px;
  border-radius: 3px;
  color: theme.$gray_4;
  cursor: pointer;

  &:hover {
    background: theme.$purple_tint;
    color: theme.$gray_6;
  }
  &.is-on {
    color: theme.$gray_6;
  }
}
/* The header's icon actions: the same size, the same grey as the eye. */
.fb__refresh {
  display: flex;
  align-items: center;
  border: none;
  background: none;
  cursor: pointer;
  color: theme.$gray_4;
  border-radius: 3px;
  padding: 2px 4px;
}
.fb__refresh:hover { background: theme.$purple_tint; color: theme.$gray_6; }
.fb__tree {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow: auto;
  flex: 1;
}
.fb__msg {
  padding: 10px;
  color: theme.$gray_4;
  font-size: 12px;
}
.fb__msg--error { color: theme.$red_2; white-space: pre-wrap; }
.fb__foot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid theme.$gray_2;
}
.fb__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: theme.$gray_6;
}
.fb__bar-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fb__bar-btn {
  flex-shrink: 0;
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  padding: 2px 10px;
  font: inherit;
  cursor: pointer;
}
.fb__bar-btn--go {
  border-color: theme.$purple_3;
  background: theme.$purple_3;
  color: theme.$white;
}
.fb__disk {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fb__disk-text {
  font-size: 11px;
  color: theme.$gray_4;
}
.fb__disk-bar {
  display: block;
  height: 4px;
  border-radius: 2px;
  background: theme.$gray_2;
  overflow: hidden;

  span {
    display: block;
    height: 100%;
    background: theme.$purple_2;
  }
  &.is-full span {
    background: theme.$orange_1;
  }
}
</style>
