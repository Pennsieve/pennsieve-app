<script setup>
// JupyterLab-style file browser for the kernel's filesystem (the per-run EFS
// mount). Lazily expands directories via the Contents API, shows size/modified,
// and lets the user copy a path, insert it into the notebook, or download a
// file (e.g. results from output/). Refreshes on demand (and the parent calls
// refresh() after cell runs).
import { ref, watch } from "vue";
import FileNode from "./FileNode.vue";

const props = defineProps({
  listDir: { type: Function, required: true },
  downloadFile: { type: Function, required: true },
  ready: { type: Boolean, default: false },
});

const emit = defineEmits(["insert-path", "open-notebook"]);

// Tree node: { name, path, type, size, last_modified, children, open, loading }
const roots = ref([]);
const loading = ref(false);
const error = ref(null);

function decorate(entry) {
  return {
    ...entry,
    children: null,
    open: false,
    loading: false,
  };
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
  if (
    input.children &&
    input.children.length === 1 &&
    input.children[0].type === "directory"
  ) {
    await toggle(input.children[0]);
  }
}

async function toggle(node) {
  if (node.type !== "directory") return;
  node.open = !node.open;
  if (node.open && node.children == null) {
    node.loading = true;
    try {
      const entries = await props.listDir(node.path);
      node.children = entries.map(decorate);
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

function icon(node) {
  if (node.type === "directory") return node.open ? "📂" : "📁";
  if (node.type === "notebook") return "📓";
  return "📄";
}

function copyPath(node) {
  navigator.clipboard?.writeText(node.path).catch(() => {});
}

async function download(node) {
  const blob = await props.downloadFile(node.path);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = node.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="fb">
    <div class="fb__head">
      <span class="fb__title">Files</span>
      <button class="fb__refresh" title="Refresh" :disabled="loading" @click="refresh">⟳</button>
    </div>

    <p v-if="!ready" class="fb__msg">Connecting…</p>
    <p v-else-if="loading && !roots.length" class="fb__msg">Loading…</p>
    <p v-else-if="error" class="fb__msg fb__msg--error">{{ error }}</p>
    <p v-else-if="!roots.length" class="fb__msg">No files.</p>

    <ul v-else class="fb__tree">
      <FileNode
        v-for="node in roots"
        :key="node.path"
        :node="node"
        :depth="0"
        :icon-of="icon"
        :fmt-size="fmtSize"
        :fmt-time="fmtTime"
        @toggle="toggle"
        @copy="copyPath"
        @download="download"
        @insert="emit('insert-path', $event)"
        @open="emit('open-notebook', $event)"
      />
    </ul>
  </div>
</template>

<style scoped>
.fb {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: 1px solid #e5e5e5;
  background: #f7f7f7;
  font-size: 13px;
  min-width: 0;
}
.fb__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid #e5e5e5;
}
.fb__title {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #4d4d4d;
}
.fb__refresh {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #4d4d4d;
  border-radius: 4px;
  padding: 2px 6px;
}
.fb__refresh:hover { background: #e6e9ef; } /* purple_tint */
.fb__tree {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow: auto;
  flex: 1;
}
.fb__msg {
  padding: 10px;
  color: #999;
  font-size: 12px;
}
.fb__msg--error { color: #c14d49; }
</style>
