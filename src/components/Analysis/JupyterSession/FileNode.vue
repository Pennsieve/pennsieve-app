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
});

const emit = defineEmits(["toggle", "copy", "insert", "open", "insert-stack", "add-data"]);
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
const left = computed(() => (isViewFolder.value ? props.inputs.remainingIn(view.value.source, view.value.rel) : []));
const leftSize = computed(() => left.value.reduce((n, e) => n + (e.size || 0), 0));
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
  const entries = left.value;
  start(leftSize.value, entries, () => props.inputs.requestEntries(source, entries));
}
// noted: don't say what it costs again in this session.
function go(noted = false) {
  const c = confirm.value;
  confirm.value = null;
  if (noted) props.inputs.noteCost();
  c?.go();
}

function onRow() {
  const n = props.node;
  if (n.type === "directory") emit("toggle", n);
  else if (isStack.value) return;
  else if (remote.value) download();
  else emit("insert", n.path);
}
</script>

<template>
  <li class="fn">
    <div
      class="fn__row"
      :class="{ 'is-remote': remote || isStack, 'is-selected': selected }"
      :style="{ paddingLeft: depth * 14 + 8 + 'px' }"
      :title="
        isStack
          ? `${node.path}\n${stackFormat(view.entry)}: read in place from the notebook`
          : remote
          ? `${node.path} · ${fmtSize(node.size)}\nNot downloaded yet: click to download`
          : `${node.path}${node.size != null ? ' · ' + fmtSize(node.size) : ''}${node.last_modified ? ' · ' + fmtTime(node.last_modified) : ''}`
      "
      @click="onRow"
    >
      <span class="fn__caret">
        <template v-if="node.type === 'directory'">{{ node.open ? "▾" : "▸" }}</template>
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
      <img class="fn__icon" :src="isStack ? stackIcon(view.entry) : iconOf(node)" alt="" />
      <!-- The view's crate folder is shown by what it is; its name is in the row's title. -->
      <span
        class="fn__name"
        :title="node.name === VIEW_CRATE_DIR ? 'This input\'s dataset view (.pennsieve/view.json, an RO-Crate): where its files come from, their sizes and checksums.' : undefined"
        >{{ node.name === VIEW_CRATE_DIR ? "input manifest" : node.name }}</span
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
      <span v-if="viewProgress" class="fn__from" :title="`${view.source.name}\n${viewProgress.done} of ${viewProgress.total} files in the session${view.source.models?.length ? `\nMetadata records of ${view.source.models.map((m) => m.name).join(', ')} under metadata/` : ''}`">
        {{ view.source.subtitle }} · {{ viewProgress.done }}/{{ viewProgress.total }}<template v-if="view.source.models?.length"> · {{ view.source.models.length }} {{ view.source.models.length === 1 ? "model" : "models" }}</template>
      </span>
      <svg v-if="remote && !under" class="fn__cloud" width="12" height="12" viewBox="0 0 16 16" aria-label="Not downloaded">
        <path d="M4.5 12.5h7.2a2.8 2.8 0 0 0 .4-5.6 4 4 0 0 0-7.7-1A3.3 3.3 0 0 0 4.5 12.5z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
      </svg>

      <span v-if="under" class="fn__state fn__state--active">{{ progress }}</span>
      <span v-else-if="failed" class="fn__state fn__state--failed" :title="fileState.error">failed · retry</span>
      <span v-else-if="isStack" class="fn__size">{{ view.entry.size ? fmtSize(view.entry.size) : stackFormat(view.entry) }}</span>
      <span v-else-if="node.type !== 'directory' && node.size != null" class="fn__size">{{ fmtSize(node.size) }}</span>

      <span class="fn__actions" @click.stop>
        <template v-if="depth === 0 && node.name === 'input' && inputs?.canAdd">
          <button class="fn__act fn__act--text" title="Add data from a data platform" @click="emit('add-data')">+ Add data</button>
        </template>
        <template v-else-if="isStack">
          <button class="fn__act fn__act--text" :title="`Add code that opens this ${stackFormat(view.entry)} in place`" @click="emit('insert-stack', view.entry)">Code</button>
        </template>
        <template v-else-if="under">
          <button class="fn__act" title="Cancel the download" aria-label="Cancel the download" @click="inputs.cancel([{ source: view.source, path: view.entry.cratePath }])">✕</button>
        </template>
        <template v-else-if="remote">
          <button class="fn__act" :title="`Download (${fmtSize(node.size)})`" aria-label="Download" @click="download">⤓</button>
        </template>
        <template v-else>
          <button
            v-if="isViewFolder && left.length"
            class="fn__act"
            :title="`Download all ${left.length} not in the session (${fmtSize(leftSize)})`"
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
          <button class="fn__act" title="Insert the path into a cell, as code (INPUT_DIR / …)" @click="emit('insert', node.path)">↩</button>
          <button class="fn__act" title="Copy the path, as code (INPUT_DIR / …)" @click="emit('copy', node)">⧉</button>
        </template>
      </span>
      </span>
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

    <span v-if="node.loading" class="fn__loading" :style="{ paddingLeft: (depth + 1) * 14 + 22 + 'px' }">
      loading…
    </span>

    <ul v-if="node.open && node.children && children.length" class="fn__children">
      <FileNode
        v-for="child in children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :show-hidden="showHidden"
        :only-local="onlyLocal"
        :icon-of="iconOf"
        :fmt-size="fmtSize"
        :fmt-time="fmtTime"
        :inputs="inputs"
        @toggle="emit('toggle', $event)"
        @copy="emit('copy', $event)"
        @insert="emit('insert', $event)"
        @open="emit('open', $event)"
        @insert-stack="emit('insert-stack', $event)"
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
.fn__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: theme.$gray_6;
}
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
