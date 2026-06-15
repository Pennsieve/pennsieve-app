<script setup>
// A single notebook cell (code or markdown), styled like Jupyter: an In[n]
// prompt gutter, a CodeMirror editor, a hover toolbar, and rendered outputs
// (code) or rendered markdown. Transient UI state (_running, _editing) lives on
// the cell object; structural/source changes are emitted to the parent.
import { computed, ref } from "vue";
import { marked } from "marked";
import CodeMirrorEditor from "./CodeMirrorEditor.vue";
import PlotlyOutput from "./PlotlyOutput.vue";
import MathOutput from "./MathOutput.vue";

const props = defineProps({
  cell: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  isFirst: { type: Boolean, default: false },
  isLast: { type: Boolean, default: false },
});

const emit = defineEmits([
  "select",
  "update:source",
  "run", // { advance, insertBelow }
  "edit", // enter markdown edit mode
  "add-below",
  "delete",
  "move-up",
  "move-down",
  "change-type",
  "focus-prev",
  "focus-next",
]);

const editorRef = ref(null);

const isCode = computed(() => props.cell.cell_type === "code");
const editing = computed(() =>
  isCode.value ? true : !!props.cell._editing
);

const promptLabel = computed(() => {
  if (!isCode.value) return "";
  if (props.cell._running) return "[*]";
  return props.cell.execution_count != null ? `[${props.cell.execution_count}]` : "[ ]";
});

// Render a markdown string to HTML (used for markdown cells AND text/markdown
// outputs).
function renderMd(src) {
  try {
    return marked.parse(src ?? "", { breaks: true, gfm: true });
  } catch (_) {
    return `<pre>${escapeHtml(src ?? "")}</pre>`;
  }
}

const renderedMarkdown = computed(() => {
  const src = props.cell.source?.trim();
  if (!src) return '<p class="nb-md-empty">Empty markdown cell — double-click to edit</p>';
  return renderMd(props.cell.source);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
  );
}

// Strip ANSI escape codes from tracebacks for readable plain-text errors.
const ANSI = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s) => String(s || "").replace(ANSI, "");

function onSource(val) {
  emit("update:source", val);
}

function run(opts) {
  // The parent renders markdown (clears _editing) and handles advance/insert.
  emit("run", opts);
}

function editMarkdown() {
  if (!isCode.value) {
    emit("select");
    emit("edit");
  }
}

function focus() {
  editorRef.value?.focus?.();
}

defineExpose({ focus });

// ---- output rendering helpers ----
function imgSrc(data) {
  if (data["image/png"]) return `data:image/png;base64,${data["image/png"]}`;
  if (data["image/jpeg"]) return `data:image/jpeg;base64,${data["image/jpeg"]}`;
  if (data["image/gif"]) return `data:image/gif;base64,${data["image/gif"]}`;
  return null;
}
function htmlOf(data) {
  const h = data["text/html"];
  return Array.isArray(h) ? h.join("") : h;
}
function textOf(data) {
  const t = data["text/plain"];
  return Array.isArray(t) ? t.join("") : t;
}
function svgOf(data) {
  const s = data["image/svg+xml"];
  return Array.isArray(s) ? s.join("") : s;
}
function markdownOf(data) {
  const m = data["text/markdown"];
  return Array.isArray(m) ? m.join("") : m;
}
function jsonOf(data) {
  const j = data["application/json"];
  if (j === undefined) return null;
  try {
    return typeof j === "string" ? j : JSON.stringify(j, null, 2);
  } catch (_) {
    return String(j);
  }
}
function plotlyOf(data) {
  return data["application/vnd.plotly.v1+json"] || null;
}
// A friendly notice for rich output types we knowingly don't render (so users
// get an explanation instead of a raw text/plain dump or a blank).
function unsupportedMessage(data) {
  const keys = Object.keys(data || {});
  if (keys.some((k) => k.startsWith("application/vnd.vega"))) {
    return "This is a Vega/Vega-Lite (Altair) chart, which the Pennsieve notebook viewer doesn’t render yet — Plotly and matplotlib charts are fully supported, so use one of those instead.";
  }
  if (keys.some((k) => k.startsWith("application/vnd.jupyter.widget"))) {
    return "This is an interactive widget (ipywidgets), which isn’t supported in the Pennsieve notebook viewer.";
  }
  if (keys.includes("application/pdf")) {
    return "This is a PDF output, which the Pennsieve notebook viewer doesn’t render — save it to output/ and download it instead.";
  }
  return null;
}
function latexOf(data) {
  const l = data["text/latex"];
  return Array.isArray(l) ? l.join("") : l;
}
</script>

<template>
  <div
    class="nb-cell"
    :class="{ 'nb-cell--selected': selected, 'nb-cell--md': !isCode }"
    @click="emit('select')"
  >
    <!-- selection bar -->
    <div class="nb-cell__bar" />

    <!-- prompt gutter -->
    <div class="nb-cell__prompt" :class="{ 'nb-cell__prompt--running': cell._running }">
      {{ promptLabel }}
    </div>

    <div class="nb-cell__body">
      <!-- hover toolbar -->
      <div class="nb-cell__toolbar" @click.stop>
        <button class="nb-tbtn nb-tbtn--run" title="Run (Shift+Enter)" @click="run({ advance: true })">▶</button>
        <select
          class="nb-type"
          :value="cell.cell_type"
          title="Cell type"
          @change="emit('change-type', $event.target.value)"
        >
          <option value="code">Code</option>
          <option value="markdown">Markdown</option>
        </select>
        <span class="nb-tspacer" />
        <button class="nb-tbtn" title="Move up" :disabled="isFirst" @click="emit('move-up')">↑</button>
        <button class="nb-tbtn" title="Move down" :disabled="isLast" @click="emit('move-down')">↓</button>
        <button class="nb-tbtn" title="Insert cell below" @click="emit('add-below')">＋</button>
        <button class="nb-tbtn nb-tbtn--del" title="Delete cell" @click="emit('delete')">🗑</button>
      </div>

      <!-- editor / rendered markdown -->
      <div v-if="editing" class="nb-cell__editor">
        <CodeMirrorEditor
          ref="editorRef"
          :model-value="cell.source"
          :language="isCode ? 'python' : 'markdown'"
          :autofocus="selected"
          @update:model-value="onSource"
          @run="run({ advance: true })"
          @run-in-place="run({ advance: false })"
          @run-insert-below="run({ insertBelow: true })"
          @focus="emit('select')"
          @arrow-up="emit('focus-prev')"
          @arrow-down="emit('focus-next')"
        />
      </div>
      <div
        v-else
        class="nb-md-rendered markdown-body"
        v-html="renderedMarkdown"
        @dblclick="editMarkdown"
      />

      <!-- outputs (code cells only) -->
      <div v-if="isCode && cell.outputs.length" class="nb-outputs">
        <div v-for="(o, i) in cell.outputs" :key="i" class="nb-output">
          <!-- execute_result keeps an Out[n] prompt -->
          <template v-if="o.output_type === 'stream'">
            <pre class="nb-stream" :class="{ 'nb-stderr': o.name === 'stderr' }">{{ Array.isArray(o.text) ? o.text.join('') : o.text }}</pre>
          </template>

          <template v-else-if="o.output_type === 'error'">
            <pre class="nb-stderr">{{ o.ename }}: {{ o.evalue }}
{{ stripAnsi((o.traceback || []).join('\n')) }}</pre>
          </template>

          <template v-else>
            <!-- execute_result / display_data: richest mime first -->
            <PlotlyOutput v-if="plotlyOf(o.data)" :spec="plotlyOf(o.data)" />
            <img v-else-if="imgSrc(o.data)" class="nb-img" :src="imgSrc(o.data)" alt="output" />
            <div v-else-if="svgOf(o.data)" class="nb-svg" v-html="svgOf(o.data)" />
            <div v-else-if="htmlOf(o.data)" class="nb-html markdown-body" v-html="htmlOf(o.data)" />
            <MathOutput v-else-if="latexOf(o.data)" :latex="latexOf(o.data)" />
            <div
              v-else-if="markdownOf(o.data)"
              class="nb-md-rendered markdown-body"
              v-html="renderMd(markdownOf(o.data))"
            />
            <pre v-else-if="jsonOf(o.data) != null" class="nb-json">{{ jsonOf(o.data) }}</pre>
            <div v-else-if="unsupportedMessage(o.data)" class="nb-unsupported">
              {{ unsupportedMessage(o.data) }}
            </div>
            <pre v-else-if="textOf(o.data)" class="nb-text">{{ textOf(o.data) }}</pre>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nb-cell {
  position: relative;
  display: grid;
  grid-template-columns: 44px 1fr;
  align-items: flex-start;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 6px 4px 0;
  margin: 6px 0;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}
.nb-cell:hover {
  background: #fafafa;
}
.nb-cell--selected,
.nb-cell--selected:hover {
  border-color: #e5e5e5; /* gray_2 */
  background: #f7f7f7; /* gray_1 */
}
.nb-cell__bar {
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: transparent;
}
.nb-cell--selected .nb-cell__bar {
  background: #011f5b; /* purple_3 (brand navy) */
}
.nb-cell__prompt {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  color: #999; /* gray_4 */
  text-align: right;
  padding: 11px 8px 0 0;
  user-select: none;
  white-space: nowrap;
}
.nb-cell__prompt--running {
  color: #011f5b; /* purple_3 */
  font-weight: 700;
}
.nb-cell__body {
  position: relative;
  min-width: 0;
}
.nb-cell__editor {
  border: 1px solid #e5e5e5; /* gray_2 */
  border-radius: 6px;
  background: #f7f7f7; /* gray_1 */
  overflow: hidden;
}
.nb-cell--selected .nb-cell__editor {
  border-color: #b3bcce; /* purple_0_7 */
  background: #ffffff;
}
.nb-cell--md .nb-cell__editor {
  background: #f7f7f7; /* gray_1 */
}

/* hover toolbar */
.nb-cell__toolbar {
  position: absolute;
  top: -12px;
  right: 4px;
  display: none;
  gap: 2px;
  align-items: center;
  background: #fff;
  border: 1px solid #e5e5e5; /* gray_2 */
  border-radius: 2px;
  padding: 2px 4px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 2;
}
.nb-cell:hover .nb-cell__toolbar,
.nb-cell--selected .nb-cell__toolbar {
  display: flex;
}
.nb-tbtn {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 4px;
  color: #4d4d4d; /* gray_5 */
}
.nb-tbtn:hover { background: #e6e9ef; } /* purple_tint */
.nb-tbtn:disabled { opacity: 0.3; cursor: default; }
.nb-tbtn--run { color: #14a758; } /* green_2 */
.nb-tbtn--del:hover { background: #feeeec; color: #c14d49; } /* red_tint / red_2 */
.nb-tspacer { width: 6px; }
.nb-type {
  font-size: 11px;
  border: 1px solid #cccccc; /* gray_3 */
  border-radius: 4px;
  padding: 1px 2px;
  background: #ffffff;
  color: #4d4d4d; /* gray_5 */
}

/* rendered markdown */
.nb-md-rendered {
  padding: 6px 10px;
  cursor: text;
  font-size: 14px;
  line-height: 1.55;
  color: #333333; /* gray_6 */
}
:deep(.nb-md-empty) { color: #999; font-style: italic; } /* gray_4 */

/* Tight, on-theme styling for rendered markdown so notes stay compact. */
.nb-md-rendered :deep(> :first-child) { margin-top: 0; }
.nb-md-rendered :deep(> :last-child) { margin-bottom: 0; }
.nb-md-rendered :deep(h1),
.nb-md-rendered :deep(h2),
.nb-md-rendered :deep(h3),
.nb-md-rendered :deep(h4) {
  margin: 0.5em 0 0.3em;
  font-weight: 600;
  line-height: 1.3;
  color: #011f5b; /* purple_3 */
}
.nb-md-rendered :deep(h1) { font-size: 1.35em; }
.nb-md-rendered :deep(h2) { font-size: 1.2em; }
.nb-md-rendered :deep(h3) { font-size: 1.08em; }
.nb-md-rendered :deep(h4) { font-size: 1em; }
.nb-md-rendered :deep(p) { margin: 0.4em 0; }
.nb-md-rendered :deep(ul),
.nb-md-rendered :deep(ol) { margin: 0.4em 0; padding-left: 1.4em; }
.nb-md-rendered :deep(li) { margin: 0.12em 0; }
.nb-md-rendered :deep(a) { color: #011f5b; text-decoration: underline; }
.nb-md-rendered :deep(code) {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.86em;
  background: #f2f2f2; /* gray_0 */
  padding: 1px 5px;
  border-radius: 4px;
}
.nb-md-rendered :deep(pre) {
  margin: 0.5em 0;
  padding: 10px 12px;
  background: #f7f7f7; /* gray_1 */
  border-radius: 6px;
  overflow-x: auto;
}
.nb-md-rendered :deep(pre code) { background: none; padding: 0; font-size: 0.85em; }
.nb-md-rendered :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0 0 0 12px;
  border-left: 3px solid #e5e5e5; /* gray_2 */
  color: #6b7280;
}
.nb-md-rendered :deep(table) { border-collapse: collapse; margin: 0.5em 0; }
.nb-md-rendered :deep(th),
.nb-md-rendered :deep(td) { border: 1px solid #e5e5e5; padding: 4px 8px; }

/* outputs */
.nb-outputs {
  margin-top: 6px;
  padding-left: 2px;
}
.nb-output { margin: 2px 0; }
.nb-output pre,
.nb-stream,
.nb-text {
  margin: 0;
  padding: 6px 8px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  background: #ffffff;
  color: #333333; /* gray_6 */
}
.nb-stderr {
  background: #feeeec !important; /* red_tint */
  color: #c14d49; /* red_2 */
}
.nb-json {
  background: #f7f7f7 !important; /* gray_1 — distinguish JSON from plain text */
  border-radius: 4px;
}
.nb-unsupported {
  margin: 2px 0;
  padding: 8px 10px;
  font-size: 12.5px;
  line-height: 1.5;
  color: #71564a; /* warn text */
  background: #fdf3e7; /* orange tint */
  border: 1px solid #f3d9a8;
  border-radius: 4px;
}
.nb-img { max-width: 100%; height: auto; display: block; }
.nb-html, .nb-svg { padding: 6px 8px; overflow-x: auto; }

/* Rich HTML output tables (pandas DataFrames, etc.) — clean, on-theme. */
.nb-html :deep(table),
.nb-html :deep(table.dataframe) {
  border-collapse: collapse;
  border: none;
  margin: 2px 0;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: #333333; /* gray_6 */
}
.nb-html :deep(th),
.nb-html :deep(td) {
  border: 1px solid #ededed;
  padding: 4px 10px;
  text-align: right;
  white-space: nowrap;
  vertical-align: middle;
}
.nb-html :deep(thead th) {
  background: #f2f2f2; /* gray_0 */
  color: #011f5b; /* purple_3 */
  font-weight: 600;
  border-bottom: 2px solid #e0e0e0;
}
/* Row index cells (pandas emits <th> in tbody for the index). */
.nb-html :deep(tbody th) {
  background: #fafafa;
  color: #4d4d4d; /* gray_5 */
  font-weight: 600;
  text-align: left;
}
.nb-html :deep(tbody tr:nth-child(even) td) {
  background: #fafbfc;
}
.nb-html :deep(tbody tr:hover td),
.nb-html :deep(tbody tr:hover th) {
  background: #eef2ff; /* subtle navy tint */
}
</style>
