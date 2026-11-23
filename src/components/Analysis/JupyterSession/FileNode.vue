<script>
// Recursive file-tree row. Declared with an explicit name so it can reference
// itself in its own template (Vue resolves self-recursive components by name).
export default { name: "FileNode" };
</script>

<script setup>
// A row of the Session files tree: a file or folder on the session's disk,
// or, under input/, one a view holds that isn't downloaded yet (virtual,
// greyed, a click away), one under way (its progress, to cancel), or a stack
// (a Zarr, a precomputed volume: read in place, its Code on hover). A view's
// own folder says where it's from and how much of it is in the session.
import { computed, ref } from "vue";
import { VIEW_CRATE_DIR } from "@/composables/useJupyterSession";
import { visibleEntries } from "./fileBrowserHelpers";
import { stackFormat, stackIcon, costLine } from "./inputsHelpers";
import { fileSnippets, folderSnippets, stackSnippets } from "./fileSnippets";
import AssistIcon from "./AssistIcon.vue";
import LayoutPanel from "./LayoutPanel.vue";
import IconGraph from "@/components/icons/IconGraph.vue";

const props = defineProps({
  node: { type: Object, required: true },
  // Show dot-files and dot-folders (.pennsieve, .datalad); hidden otherwise.
  showHidden: { type: Boolean, default: false },
  // Leave out what a view holds that isn't downloaded.
  onlyLocal: { type: Boolean, default: false },
  depth: { type: Number, default: 0 },
  iconOf: { type: Function, required: true },
  fmtSize: { type: Function, required: true },
  fmtTime: { type: Function, required: true },
  // The session's view inputs (useSessionInputs), or null.
  inputs: { type: Object, default: null },
  // Reads a small text file of the session: a structured layout's summary.
  readText: { type: Function, default: null },
  // The kernel's name ("Python 3.12.3", "R 4.4.1"): the language of a file's starter code.
  kernelName: { type: String, default: "" },
  // The session has a code assistant: Code offers Ask… on any file.
  assistAvailable: { type: Boolean, default: false },
  // Why the assistant is paused (no AI budget left), or "".
  assistPaused: { type: String, default: "" },
});

const emit = defineEmits(["toggle", "copy", "insert", "open", "insert-snippet", "ask-file", "add-data"]);
const children = computed(() => visibleEntries(props.node.children, props.showHidden, props.onlyLocal));

const isNotebook = (node) => node.type === "notebook" || /\.ipynb$/i.test(node.name || "");

/* --------------------------------------------------------- from a view --- */
const view = computed(() => props.node.view || null);
const isStack = computed(() => props.node.type === "stack");
// A file of a view: its download, if asked for.
const fileState = computed(() =>
  props.inputs && view.value?.entry && props.node.type === "file" ? props.inputs.stateOf(view.value.source, view.value.entry.cratePath) : null
);
const remote = computed(() => props.node.virtual && props.node.type === "file");
const under = computed(() => ["queued", "downloading"].includes(fileState.value?.state));
const failed = computed(() => fileState.value?.state === "failed");
const progress = computed(() => {
  const st = fileState.value;
  if (!st || st.state === "queued") return "queued";
  return `${Math.floor((100 * (st.bytes || 0)) / (st.size || props.node.size || 1))}%`;
});
// A view's folder: how much of it is in the session, and what's left.
const isViewFolder = computed(() => props.inputs && view.value && props.node.type === "directory");
const viewProgress = computed(() => (isViewFolder.value && view.value.root ? props.inputs.folderProgress(view.value.source, "") : null));
// A view folder's row says where it's from, how much of it is in the
// session, and which models' records it holds (under metadata/).
const viewTitle = computed(() => {
  if (!viewProgress.value) return undefined;
  const models = view.value.source.models || [];
  const records = models.length ? `\nMetadata records of ${models.map((m) => m.name).join(", ")} under metadata/` : "";
  return `${view.value.source.name}\n${viewProgress.value.done} of ${viewProgress.value.total} files in the session${records}`;
});
/* ------------------------------------------------- structured layouts --- */
// A view's structured layout (structuredLayouts.js) is one row: its name
// and icon; a click opens its summary (LayoutPanel), its caret its files, in
// place, as does the panel's Show files. The metadata records are a group
// of the metadata folder's entries (FileBrowser), the knowledge graph its
// kgx/ folder; the folder itself says what it holds (node.note).
const layout = computed(() => (props.inputs && view.value && props.node.layout) || null);
const bundle = computed(() => !!layout.value);
const panelOpen = ref(false);
const layoutFiles = computed(() => new Set(layout.value?.files || []));
const layoutSize = computed(() =>
  layout.value ? view.value.source.entries.reduce((n, e) => n + (layoutFiles.value.has(e.cratePath) ? e.size || 0 : 0), 0) : 0
);
function showFiles() {
  if (!props.node.open) emit("toggle", props.node);
}
// How much of a layout is in the session: none (greyed, a cloud, Download),
// some, under way (its progress), or all (Load).
const layoutState = computed(() => {
  if (!layout.value) return null;
  const files = view.value.source.entries.filter((e) => layoutFiles.value.has(e.cratePath));
  let done = 0, under = 0, bytes = 0, size = 0;
  for (const e of files) {
    const st = props.inputs.stateOf(view.value.source, e.cratePath);
    if (st?.state === "done") done++;
    else if (st?.state === "queued" || st?.state === "downloading") {
      under++;
      bytes += st.bytes || 0;
      size += st.size || e.size || 0;
    }
  }
  return {
    total: files.length,
    done,
    under,
    percent: size ? Math.floor((100 * bytes) / size) : 0,
    none: done === 0 && under === 0,
    all: files.length > 0 && done === files.length,
  };
});
// The layout's Load: its first starter, once it's all downloaded.
const loadSnippet = computed(() => (layoutState.value?.all ? snippets.value.find((s) => s.id === "load") || null : null));
// The path its code reads.
const codePath = computed(() => (layout.value ? layout.value.entry.codePath(props.node.path) : props.node.path));

// A view folder's files not in the session and not under way.
const left = computed(() => (isViewFolder.value ? props.inputs.remainingIn(view.value.source, view.value.rel) : []));
// The layout's own (the panel's Download).
const layoutLeft = computed(() => (layout.value ? left.value.filter((e) => layoutFiles.value.has(e.cratePath)) : []));
// What the folder's ⤓ downloads: a layout's own files (the records, not
// the graph beside them), else all that's left.
const folderLeft = computed(() => (layout.value ? layoutLeft.value : left.value));
const leftSize = computed(() => folderLeft.value.reduce((n, e) => n + (e.size || 0), 0));
const selected = computed(() => remote.value && props.inputs.isSelected(view.value.source, view.value.entry.cratePath));
// Ticking shows on hover, and on every remote file once any is ticked.
const ticking = computed(() => props.inputs?.selected.size > 0);

// A download big enough to ask first, one that costs the node's account
// (from another region), or one that doesn't fit, waits here.
const confirm = ref(null); // { bytes, fits, cost, go }
function start(bytes, entries, go) {
  const c = props.inputs.check(bytes, entries);
  if (c.ask) confirm.value = { bytes, fits: c.fits, cost: c.cost, go };
  else go();
}
function download() {
  if (under.value) return;
  const { source, entry } = view.value;
  start(entry.size || 0, [entry], () => props.inputs.requestEntries(source, [entry]));
}
function downloadAll() {
  const { source } = view.value;
  const entries = folderLeft.value;
  start(leftSize.value, entries, () => props.inputs.requestEntries(source, entries));
}
// noted: don't say what it costs again in this session.
function go(noted = false) {
  const c = confirm.value;
  confirm.value = null;
  if (noted) props.inputs.noteCost();
  c?.go();
}

/* ------------------------------------------------------ starter code --- */
// A downloaded file of a known type, or a stack, offers a few cells (load,
// summarize, plot) on its Code action, in a strip under its row until one is
// picked. A stack in R has only one (its URL): Code adds it. The metadata
// folders of a view with metadata records, once something of it is
// downloaded, offer SQL over the records and a summary of the schemas:
// known by the folder's path in the view, not by its name.
const isFolder = computed(() => props.node.type === "directory");
const hasRecords = computed(() => (view.value?.source?.models || []).length > 0);
const snippets = computed(() => {
  // Not before something of it is downloaded: the code reads the disk.
  if (layout.value) return props.node.virtual ? [] : layout.value.entry.snippets(props.node.path, props.kernelName);
  if (isStack.value) return stackSnippets(view.value.entry, props.kernelName);
  if (isFolder.value) return props.node.virtual || !hasRecords.value ? [] : folderSnippets(props.node.path, view.value.rel, props.kernelName);
  return props.node.type === "file" && !remote.value && !isNotebook(props.node) ? fileSnippets(props.node.path, props.kernelName) : [];
});
// Ask… is the assistant's, on any downloaded file or stack.
const canAsk = computed(() => props.assistAvailable && (isStack.value || (props.node.type === "file" && !remote.value && !isNotebook(props.node))));
const hasCode = computed(() => snippets.value.length > 0 || canAsk.value);
function onCode() {
  if (snippets.value.length === 1 && !canAsk.value) pickSnippet(snippets.value[0]);
  else showSnippets.value = !showSnippets.value;
}
function ask() {
  showSnippets.value = false;
  emit("ask-file", props.node.path);
}
const showSnippets = ref(false);
function pickSnippet(s) {
  showSnippets.value = false;
  emit("insert-snippet", s.code);
}

// The panel's downloads: the layout's files, or its summary's (graph.json).
// One that asks first asks under the row: the panel makes way.
function downloadFiles(entries) {
  const size = entries.reduce((n, e) => n + (e.size || 0), 0);
  start(size, entries, () => props.inputs.requestEntries(view.value.source, entries));
  if (confirm.value) panelOpen.value = false;
}

/* ------------------------------------------------- joining the session --- */
// An input still on its way: what it's waiting for.
const pendingLine = computed(() =>
  props.node.pending?.state === "adding" ? "adding to the session…" : "preparing the dataset's records…"
);
const pendingTitle = computed(() => {
  const p = props.node.pending;
  if (!p) return undefined;
  if (p.error) return p.error;
  return `${p.label || p.name}\nThe dataset's records are being prepared; they join the session as input/${p.name}/ when they're ready.`;
});

function onRow() {
  const n = props.node;
  if (bundle.value) panelOpen.value = true;
  else if (n.type === "directory") emit("toggle", n);
  else if (isStack.value) return;
  else if (remote.value) download();
  else emit("insert", n.path);
}
</script>

<template>
  <li class="fn">
    <!-- An input joining the session (pendingSessionInputs): its dataset's
         records being prepared, then added; not a folder yet. -->
    <div
      v-if="node.pending"
      class="fn__row is-remote is-pending"
      :style="{ paddingLeft: depth * 14 + 8 + 'px' }"
      :title="pendingTitle"
    >
      <span class="fn__caret" />
      <img class="fn__icon" :src="iconOf({ name: node.name, type: 'directory' })" alt="" />
      <span class="fn__name">{{ node.name }}</span>
      <span class="fn__end">
        <span v-if="node.pending.error" class="fn__state fn__state--failed">couldn't be added</span>
        <template v-else>
          <span class="fn__spinner" aria-hidden="true" />
          <span class="fn__from fn__from--pending">{{ pendingLine }}</span>
        </template>
      </span>
    </div>
    <div
      v-else
      class="fn__row"
      :class="{ 'is-remote': remote || isStack || layoutState?.none, 'is-selected': selected }"
      :style="{ paddingLeft: depth * 14 + 8 + 'px' }"
      :title="
        bundle
          ? `${node.path}\n${layout.entry.title}: click for its summary, ▸ for its files` +
            (layoutState?.none ? '\nNot downloaded yet: Download brings it into the session' : layoutState && !layoutState.all ? `\n${layoutState.done} of ${layoutState.total} files downloaded` : '')
          : isStack
          ? `${node.path}\n${stackFormat(view.entry)}: read in place from the notebook`
          : remote
          ? `${node.path} · ${fmtSize(node.size)}\nNot downloaded yet: click to download`
          : `${node.path}${node.size != null ? ' · ' + fmtSize(node.size) : ''}${node.last_modified ? ' · ' + fmtTime(node.last_modified) : ''}`
      "
      @click="onRow"
    >
      <span class="fn__caret">
        <!-- A bundle's caret is its files: click it to expand in place. -->
        <button
          v-if="bundle"
          class="fn__expand"
          :aria-expanded="node.open"
          :aria-label="node.open ? 'Hide its files' : 'Show its files'"
          :title="node.open ? 'Hide its files' : 'Show its files'"
          @click.stop="emit('toggle', node)"
        >
          {{ node.open ? "▾" : "▸" }}
        </button>
        <template v-else-if="node.type === 'directory'">{{ node.open ? "▾" : "▸" }}</template>
        <input
          v-else-if="remote && !under"
          type="checkbox"
          class="fn__tick"
          :class="{ 'is-shown': ticking || selected }"
          :checked="selected"
          :aria-label="`Select ${node.name}`"
          @click.stop
          @change="inputs.toggleSelect(view.source, view.entry)"
        />
      </span>
      <IconGraph v-if="bundle && layout.entry.icon === 'graph'" class="fn__icon fn__icon--graph" :width="16" :height="16" />
      <img v-else-if="bundle" class="fn__icon" src="/file-icons/icon-tabular.svg" alt="" />
      <img v-else class="fn__icon" :src="isStack ? stackIcon(view.entry) : iconOf(node)" alt="" />
      <!-- The view's crate folder is shown by what it is; its name is in the row's title. -->
      <span
        class="fn__name"
        :class="{ 'fn__name--bundle': bundle }"
        :title="node.name === VIEW_CRATE_DIR ? 'This input\'s dataset view (.pennsieve/view.json, an RO-Crate): where its files come from, their sizes and checksums.' : undefined"
        >{{ bundle ? layout.entry.label : node.name === VIEW_CRATE_DIR ? "input manifest" : node.name }}</span
      >
      <span
        v-if="depth === 0 && node.type === 'directory' && node.name === 'output'"
        class="fn__tag fn__tag--out"
        title="Save files here to pass them to the next workflow step (OUTPUT_DIR)"
        >→ next step</span
      >
      <span
        v-else-if="depth === 0 && node.type === 'directory' && node.name === 'input'"
        class="fn__tag fn__tag--in"
        title="Your data: what the session's views hold, downloaded or not (INPUT_DIR)"
        >← data</span
      >
      <!-- The row's end, right-aligned: what it is (a view's folder: where it's
           from and how much is in the session; a file: not downloaded, its
           size, progress or failure), then its actions on hover. -->
      <span class="fn__end">
      <span v-if="viewProgress" class="fn__from" :title="viewTitle">
        {{ view.source.subtitle }} · {{ viewProgress.done }}/{{ viewProgress.total }} files<template v-if="view.source.models?.length"> · {{ view.source.models.length }} {{ view.source.models.length === 1 ? "model" : "models" }}</template>
      </span>
      <svg v-if="(remote && !under) || layoutState?.none" class="fn__cloud" width="12" height="12" viewBox="0 0 16 16" aria-label="Not downloaded">
        <path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .4-5.6 4 4 0 0 0-7.7-1A3.3 3.3 0 0 0 4.5 12.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
      </svg>

      <span v-if="node.note" class="fn__from" title="The dataset's metadata records, as tables and as a graph">{{ node.note }}</span>
      <span v-if="under" class="fn__state fn__state--active">{{ progress }}</span>
      <span v-else-if="failed" class="fn__state fn__state--failed" :title="fileState.error">failed · retry</span>
      <template v-else-if="bundle">
        <span v-if="layoutState.under" class="fn__state fn__state--active">downloading {{ layoutState.percent }}%</span>
        <!-- Greyed with a cloud when none is downloaded (said in the title). -->
        <span v-else-if="layoutState.none" class="fn__size">{{ fmtSize(layoutSize) }}</span>
        <span v-else-if="!layoutState.all" class="fn__size">{{ layoutState.done }}/{{ layoutState.total }}</span>
        <span v-else class="fn__size">{{ fmtSize(layoutSize) }}</span>
        <!-- Always shown (not on hover only): what to do with it next. -->
        <button
          v-if="!layoutState.under && !layoutState.all && layoutLeft.length"
          class="fn__now"
          :title="`Download its ${layoutLeft.length} files (${fmtSize(layoutLeft.reduce((n, e) => n + (e.size || 0), 0))}) into the session`"
          :aria-label="`Download ${layout.entry.label.toLowerCase()}`"
          @click.stop="downloadFiles(layoutLeft)"
        >
          ⤓
        </button>
        <button
          v-else-if="loadSnippet"
          class="fn__now"
          :title="`${loadSnippet.title}: adds a cell`"
          :aria-label="`Load ${layout.entry.label.toLowerCase()}`"
          @click.stop="pickSnippet(loadSnippet)"
        >
          Load
        </button>
      </template>
      <span v-else-if="isStack" class="fn__size">{{ view.entry.size ? fmtSize(view.entry.size) : stackFormat(view.entry) }}</span>
      <span v-else-if="node.type !== 'directory' && node.size != null" class="fn__size">{{ fmtSize(node.size) }}</span>

      <span class="fn__actions" @click.stop>
        <template v-if="depth === 0 && node.name === 'input' && inputs?.canAdd">
          <button class="fn__act fn__act--text" title="Add data from a data platform" @click="emit('add-data')">+ Add data</button>
        </template>
        <template v-else-if="isStack">
          <button
            class="fn__act fn__act--text"
            :class="{ 'is-on': showSnippets }"
            :title="`Starter code for this ${stackFormat(view.entry)}, read in place: load, summarize, plot`"
            :aria-expanded="showSnippets"
            @click="onCode"
          >
            Code
          </button>
        </template>
        <template v-else-if="under">
          <button class="fn__act" title="Cancel the download" aria-label="Cancel the download" @click="inputs.cancel([{ source: view.source, path: view.entry.cratePath }])">✕</button>
        </template>
        <template v-else-if="remote">
          <button class="fn__act" :title="`Download (${fmtSize(node.size)})`" aria-label="Download" @click="download">⤓</button>
        </template>
        <template v-else>
          <!-- (A layout's own ⤓ is always shown at its row's end.) -->
          <button
            v-if="isViewFolder && folderLeft.length && !bundle"
            class="fn__act"
            :title="`Download all ${folderLeft.length} not in the session (${fmtSize(leftSize)})`"
            aria-label="Download all"
            @click="downloadAll"
          >
            ⤓
          </button>
          <button
            v-if="isViewFolder && view.root && inputs.removable"
            class="fn__act"
            title="Remove from the session (downloaded files stay)"
            aria-label="Remove from the session"
            @click="inputs.remove(view.source)"
          >
            🗑
          </button>
          <button
            v-if="isNotebook(node)"
            class="fn__act fn__act--open"
            title="Open in notebook editor"
            @click="emit('open', node.path)"
          >
            ↪
          </button>
          <button
            v-if="hasCode"
            class="fn__act fn__act--text"
            :class="{ 'is-on': showSnippets }"
            :title="layout ? `Starter code for the ${layout.entry.label.toLowerCase()}` : isFolder ? 'Starter code for these metadata records: query them with SQL' : 'Starter code for this file: load, summarize, plot'"
            :aria-expanded="showSnippets"
            @click="onCode"
          >
            Code
          </button>
          <button class="fn__act" title="Insert the path into a cell, as code (INPUT_DIR / …)" @click="emit('insert', codePath)">↩</button>
          <button class="fn__act" title="Copy the path, as code (INPUT_DIR / …)" @click="emit('copy', { ...node, path: codePath })">⧉</button>
        </template>
      </span>
      </span>
    </div>

    <!-- A file's starter code: each adds a cell, which isn't run. -->
    <div v-if="showSnippets && hasCode" class="fn__snippets" :style="{ paddingLeft: depth * 14 + 28 + 'px' }">
      <button v-for="s in snippets" :key="s.id" class="fn__snippet" :title="`${s.title}: adds a cell`" @click.stop="pickSnippet(s)">
        {{ s.label }}
      </button>
      <button v-if="canAsk" class="fn__snippet fn__snippet--ask" :title="assistPaused || 'Ask the AI assistant for code for this file'" :disabled="!!assistPaused" @click.stop="ask"><AssistIcon :size="11" /> Ask…</button>
      <button class="fn__snippet-close" title="Close" aria-label="Close" @click.stop="showSnippets = false">✕</button>
    </div>

    <!-- A big download asks first; one that doesn't fit says so. -->
    <div v-if="confirm" class="fn__confirm" :style="{ paddingLeft: depth * 14 + 28 + 'px' }">
      <template v-if="confirm.fits">
        Download {{ fmtSize(confirm.bytes) }}?
        <template v-if="inputs.freeBytes != null">Leaves about {{ fmtSize(inputs.freeBytes - confirm.bytes) }} free.</template>
        <template v-if="confirm.cost">
          {{ costLine(confirm.cost) }}
        </template>
        <button class="fn__confirm-go" @click.stop="go()">Download</button>
        <button v-if="confirm.cost" class="fn__confirm-no" @click.stop="go(true)">Download, don't remind me</button>
        <button class="fn__confirm-no" @click.stop="confirm = null">Not now</button>
      </template>
      <template v-else>
        Doesn't fit: {{ fmtSize(confirm.bytes) }}, with about {{ fmtSize(inputs.freeBytes) }} free on the session's disk.
        <button class="fn__confirm-no" @click.stop="confirm = null">OK</button>
      </template>
    </div>

    <LayoutPanel
      v-if="layout && panelOpen"
      v-model="panelOpen"
      :node="node"
      :layout="layout"
      :inputs="inputs"
      :read-text="readText"
      :snippets="snippets"
      :left="layoutLeft"
      :fmt-size="fmtSize"
      :fmt-time="fmtTime"
      @insert-snippet="pickSnippet"
      @copy="emit('copy', { ...node, path: codePath })"
      @show-files="showFiles"
      @download="downloadFiles(layoutLeft)"
      @download-files="downloadFiles"
    />

    <span v-if="node.loading" class="fn__loading" :style="{ paddingLeft: (depth + 1) * 14 + 22 + 'px' }">
      loading…
    </span>

    <ul v-if="node.open && node.children && children.length" class="fn__children">
      <FileNode
        v-for="child in children"
        :key="child.key || child.path"
        :node="child"
        :depth="depth + 1"
        :show-hidden="showHidden"
        :only-local="onlyLocal"
        :icon-of="iconOf"
        :fmt-size="fmtSize"
        :fmt-time="fmtTime"
        :inputs="inputs"
        :read-text="readText"
        :kernel-name="kernelName"
        :assist-available="assistAvailable"
        :assist-paused="assistPaused"
        @toggle="emit('toggle', $event)"
        @copy="emit('copy', $event)"
        @insert="emit('insert', $event)"
        @open="emit('open', $event)"
        @insert-snippet="emit('insert-snippet', $event)"
        @ask-file="emit('ask-file', $event)"
        @add-data="emit('add-data')"
      />
    </ul>
    <span
      v-else-if="node.open && node.children && !children.length"
      class="fn__empty"
      :style="{ paddingLeft: (depth + 1) * 14 + 22 + 'px' }"
    >
      (empty)
    </span>
  </li>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.fn { list-style: none; }
.fn__children { list-style: none; margin: 0; padding: 0; }
.fn__row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px 3px 0;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 4px;
}
.fn__row:hover { background: theme.$purple_tint; }
.fn__row.is-selected { background: theme.$purple_tint; }
.fn__caret {
  display: inline-flex;
  align-items: center;
  width: 12px;
  color: theme.$gray_4;
  font-size: 10px;
  flex: 0 0 12px;
}
/* A remote file's checkbox sits where a folder's caret is: on hover, or on
   every one once any is ticked. */
.fn__tick {
  width: 11px;
  height: 11px;
  margin: 0;
  visibility: hidden;
  cursor: pointer;
}
.fn__tick.is-shown,
.fn__row:hover .fn__tick {
  visibility: visible;
}
.fn__icon { flex: 0 0 auto; width: 16px; height: 16px; }
.fn__icon--graph { color: theme.$purple_2; }
/* A bundle's caret is a button: its files, in place. */
.fn__expand {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.fn__expand:hover,
.fn__expand:focus-visible { color: theme.$purple_3; outline: none; }
.fn__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: theme.$gray_6;
}
/* A layout's name stays readable beside its size, state and button. */
.fn__name--bundle { flex: 0 1 auto; max-width: calc(100% - 10em); }
/* Sizes, states and actions in a column at the right. */
.fn__end {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding-left: 8px;
}
/* Not on the disk: in the view, a click away. */
.fn__row.is-remote .fn__name { color: theme.$gray_4; }
.fn__row.is-remote .fn__icon { opacity: 0.55; }
.fn__cloud { flex: 0 0 auto; color: theme.$gray_3; }
/* An input joining the session: not clickable, a small spinner by its line. */
.fn__row.is-pending { cursor: default; }
.fn__row.is-pending:hover { background: none; }
.fn__from--pending { max-width: 200px; color: theme.$purple_2; }
.fn__spinner {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border: 1.5px solid theme.$gray_2;
  border-top-color: theme.$purple_2;
  border-radius: 50%;
  animation: fn-spin 0.9s linear infinite;
}
@keyframes fn-spin {
  to { transform: rotate(360deg); }
}
.fn__size { color: theme.$gray_4; font-size: 11px; }
.fn__state { font-size: 11px; }
.fn__state--active { color: theme.$purple_2; }
.fn__state--failed { color: theme.$red_2; }
.fn__from {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: theme.$gray_4;
}
/* Flat, subtle folder hints — no pill, just small color-coded micro-text that
   only fully shows on hover of the row (kept faint otherwise). */
.fn__tag {
  margin-left: 8px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0.7;
}
.fn__tag--in {
  color: theme.$purple_1;
}
.fn__tag--out {
  color: theme.$green_2;
}
.fn__row:hover .fn__tag {
  opacity: 1;
}
.fn__actions {
  display: none;
  gap: 1px;
}
.fn__row:hover .fn__actions,
.fn__row:focus-within .fn__actions { display: flex; }
.fn__act {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: theme.$gray_5;
  padding: 1px 5px;
  border-radius: 2px;
}
.fn__now {
  flex: 0 0 auto;
  margin-left: 6px;
  padding: 0 6px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
  color: theme.$purple_2;
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
}
.fn__now:hover,
.fn__now:focus-visible {
  border-color: theme.$purple_2;
}
.fn__act--text {
  font-size: 11px;
  color: theme.$purple_2;
}
/* The row's own hover is purple_tint, so an action stands out from it in
   white with a hairline, and the same for keyboard focus. */
.fn__act:hover,
.fn__act:focus-visible {
  background: theme.$white;
  color: theme.$purple_3;
  box-shadow: inset 0 0 0 1px theme.$gray_3;
  outline: none;
}
.fn__act:active { background: theme.$gray_0; }
.fn__act--text.is-on { background: theme.$white; box-shadow: inset 0 0 0 1px theme.$gray_3; }
/* Starter code: small, quiet chips under the row. */
.fn__snippets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 1px 8px 4px 0;
}
.fn__snippet {
  border: 1px solid theme.$gray_2;
  border-radius: 10px;
  background: theme.$white;
  padding: 1px 9px;
  font-size: 11px;
  color: theme.$purple_2;
  cursor: pointer;
}
.fn__snippet:hover,
.fn__snippet:focus-visible {
  border-color: theme.$purple_2;
  background: theme.$purple_tint;
  outline: none;
}
/* The assistant's colour (status_purple), as on every AI action. */
.fn__snippet--ask {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-color: #d9cff4;
  color: theme.$status_purple;
}
.fn__snippet--ask:disabled {
  opacity: 0.45;
  cursor: default;
}
.fn__snippet--ask:hover:not(:disabled),
.fn__snippet--ask:focus-visible {
  border-color: theme.$status_purple;
  background: #f0ebfb;
}
.fn__snippet-close {
  border: none;
  background: none;
  padding: 1px 4px;
  font-size: 10px;
  color: theme.$gray_4;
  cursor: pointer;
}
.fn__act--open { color: theme.$purple_3; font-weight: 700; } /* purple_3 — primary file action */
.fn__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 2px 8px 4px 0;
  padding: 6px 8px;
  border-left: 2px solid theme.$orange_1;
  background: theme.$orange_tint;
  font-size: 11px;
  color: theme.$gray_5;
  white-space: normal;
}
.fn__confirm-go,
.fn__confirm-no {
  border: 1px solid theme.$gray_3;
  border-radius: 3px;
  background: theme.$white;
  padding: 1px 8px;
  font: inherit;
  cursor: pointer;
}
.fn__confirm-go {
  border-color: theme.$purple_2;
  color: theme.$purple_2;
}
.fn__loading,
.fn__empty {
  display: block;
  color: theme.$gray_4;
  font-size: 11px;
  font-style: italic;
  padding-top: 2px;
  padding-bottom: 2px;
}
</style>
