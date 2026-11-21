<script setup>
// The summary of a view's structured layout (structuredLayouts.js): the
// metadata records or the knowledge graph, as one object. It's read from
// the layout's own description (the crate's models, the graph's
// graph.json) and the view's entries, and offers the layout's starter code,
// its path, its files as the plain folder, and downloading what isn't in
// the session. Everything shown is text: nothing from the files is markup.
import { computed, ref, watch } from "vue";
import IconGraph from "@/components/icons/IconGraph.vue";
import { parseKgxGraph } from "./structuredLayouts";

const props = defineProps({
  // The bundle's tree node ({ path, view: { source } }) and its layout
  // ({ id, folder, files, models, entry }).
  node: { type: Object, required: true },
  layout: { type: Object, required: true },
  inputs: { type: Object, default: null },
  readText: { type: Function, default: null },
  snippets: { type: Array, default: () => [] },
  // The layout's files not in the session and not under way.
  left: { type: Array, default: () => [] },
  fmtSize: { type: Function, required: true },
});
const emit = defineEmits(["insert-snippet", "copy", "show-files", "download", "download-files"]);
const open = defineModel({ type: Boolean, default: false });

const entry = computed(() => props.layout.entry);
const source = computed(() => props.node.view?.source || null);
const isGraph = computed(() => props.layout.id === "kgx");

// The layout's files: the view's entries, by crate path, with whether each
// is in the session.
const files = computed(() => {
  const s = source.value;
  if (!s) return [];
  const byPath = new Map(s.entries.map((e) => [e.cratePath, e]));
  const parent = props.layout.folder.replace(/[^/]+$/, "");
  return props.layout.files
    .map((p) => byPath.get(p))
    .filter(Boolean)
    .map((e) => ({ entry: e, name: e.cratePath.slice(parent.length), size: e.size || 0, state: props.inputs?.stateOf(s, e.cratePath)?.state || "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
});
const totalSize = computed(() => files.value.reduce((n, f) => n + f.size, 0));
const leftSize = computed(() => props.left.reduce((n, e) => n + (e.size || 0), 0));

/* ------------------------------------------------------------ the graph --- */
// graph.json, read from the session's disk when it's there.
const summaryFile = computed(() => (entry.value.summaryFile ? files.value.find((f) => f.name.endsWith(`/${entry.value.summaryFile}`)) : null));
const graph = ref(null);
const loading = ref(false);
async function loadSummary() {
  if (!isGraph.value || !props.readText) return;
  loading.value = true;
  try {
    graph.value = parseKgxGraph(await props.readText(`${props.node.path}/${entry.value.summaryFile}`));
  } finally {
    loading.value = false;
  }
}
watch(open, (o) => o && loadSummary(), { immediate: true });
// Downloaded while the panel is open: read it.
watch(
  () => summaryFile.value?.state,
  (st) => {
    if (open.value && st === "done" && !graph.value) loadSummary();
  }
);
// The description files to download for the summary: graph.json and the
// summary in kgx graph-summary's form beside it.
const describe = computed(() => files.value.filter((f) => /\/(graph\.json|graph_stats\.yaml)$/.test(f.name) && f.state !== "done"));
const describeSize = computed(() => describe.value.reduce((n, f) => n + f.size, 0));
const describing = computed(() => describe.value.some((f) => ["queued", "downloading"].includes(f.state)));

const BIOLINK = {
  none: "none: its categories and predicates are Pennsieve's (pennsieve:)",
  partial: "partial: some categories or predicates are Biolink",
  full: "full: every category and predicate is Biolink",
};
const num = (n) => (n == null ? "–" : n.toLocaleString());
function when(t) {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString();
}
// The longest lists are cut, with how many more there are.
const TOP = 12;
const shown = (list) => list.slice(0, TOP);
const more = (list) => Math.max(0, list.length - TOP);

/* -------------------------------------------------------------- records --- */
const models = computed(() => props.layout.models || []);
const recordSize = (path) => source.value?.entries.find((e) => e.cratePath === path)?.size;
const tables = computed(() => files.value.filter((f) => !f.name.startsWith("models/")));

function pick(s) {
  open.value = false;
  emit("insert-snippet", s);
}
function act(name) {
  open.value = false;
  emit(name);
}
</script>

<template>
  <el-dialog v-model="open" width="min(640px, 96vw)" append-to-body class="lp-dialog">
    <template #header>
      <div class="lp__head">
        <IconGraph v-if="entry.icon === 'graph'" class="lp__icon lp__icon--graph" :width="20" :height="20" />
        <img v-else class="lp__icon" src="/file-icons/icon-tabular.svg" alt="" />
        <div>
          <div class="lp__title">{{ entry.label }}</div>
          <div class="lp__path">{{ node.path }}</div>
        </div>
      </div>
    </template>

    <p class="lp__note">
      Generated from {{ source?.name || "the dataset" }}'s metadata records: read-only, and rebuilt with the view.
      <a :href="entry.spec" target="_blank" rel="noopener noreferrer">{{ entry.specLabel }}</a>
    </p>

    <!-- The knowledge graph: graph.json's counts and provenance. -->
    <template v-if="isGraph">
      <p v-if="loading && !graph" class="lp__msg">Reading graph.json…</p>
      <div v-else-if="!graph" class="lp__msg">
        The summary is in graph.json, which isn't in the session yet.
        <button v-if="describe.length && !describing" class="lp__btn" @click="emit('download-files', describe.map((f) => f.entry))">
          Download it ({{ fmtSize(describeSize) }})
        </button>
        <span v-else-if="describing">Downloading…</span>
      </div>
      <template v-else>
        <dl class="lp__facts">
          <dt>Source dataset</dt>
          <dd>
            {{ source?.name || "–" }}
            <span v-if="graph.source.datasetNodeId" class="lp__dim">{{ graph.source.datasetNodeId }}</span>
          </dd>
          <dt>Generated</dt>
          <dd>{{ graph.generatedAt ? when(graph.generatedAt) : "–" }}</dd>
          <dt>Biolink</dt>
          <dd>{{ BIOLINK[graph.biolink] || "–" }}</dd>
          <dt>Size</dt>
          <dd>
            {{ num(graph.nodes) }} nodes, {{ num(graph.edges) }} edges
            <span v-if="graph.droppedEdges" class="lp__dim">({{ num(graph.droppedEdges) }} links to records outside it left out)</span>
          </dd>
        </dl>
        <div class="lp__cols">
          <section>
            <h4 class="lp__h">Nodes by category</h4>
            <table class="lp__table">
              <tr v-for="c in shown(graph.categories)" :key="c.name">
                <td>{{ c.name }}</td>
                <td class="lp__num">{{ num(c.count) }}</td>
              </tr>
            </table>
            <p v-if="more(graph.categories)" class="lp__dim">and {{ more(graph.categories) }} more</p>
          </section>
          <section>
            <h4 class="lp__h">Edges by predicate</h4>
            <table class="lp__table">
              <tr v-for="c in shown(graph.predicates)" :key="c.name">
                <td>{{ c.name }}</td>
                <td class="lp__num">{{ num(c.count) }}</td>
              </tr>
            </table>
            <p v-if="more(graph.predicates)" class="lp__dim">and {{ more(graph.predicates) }} more</p>
          </section>
        </div>
      </template>
    </template>

    <!-- The metadata records: models and their versions, from the crate. -->
    <template v-else>
      <h4 class="lp__h">Models</h4>
      <table v-if="models.length" class="lp__table">
        <tr>
          <th>Model</th>
          <th>Versions</th>
          <th class="lp__num">Records file</th>
        </tr>
        <tr v-for="m in models" :key="m.name">
          <td>{{ m.name }}</td>
          <td>{{ m.versions.map((v) => v.version).join(", ") }}</td>
          <td class="lp__num">{{ fmtSize(m.versions.reduce((n, v) => n + (recordSize(v.records) || 0), 0)) }}</td>
        </tr>
      </table>
      <p v-else class="lp__msg">No models listed.</p>
      <p v-if="tables.length" class="lp__dim">
        With {{ tables.map((t) => t.name).join(" and ") }}: how records link<template v-if="tables.length > 1">, and to files</template>.
      </p>
    </template>

    <h4 class="lp__h">Files · {{ files.length }} · {{ fmtSize(totalSize) }}</h4>
    <ul class="lp__files">
      <li v-for="f in files" :key="f.name">
        <span class="lp__file">{{ f.name }}</span>
        <span class="lp__dim">{{ f.state === "done" ? "in the session" : f.state === "failed" ? "failed" : f.state ? "downloading" : "not downloaded" }}</span>
        <span class="lp__num">{{ fmtSize(f.size) }}</span>
      </li>
    </ul>

    <template #footer>
      <div class="lp__actions">
        <span v-if="snippets.length" class="lp__code">
          <span class="lp__dim">Code</span>
          <button v-for="s in snippets" :key="s.id" class="lp__chip" :title="`${s.title}: adds a cell`" @click="pick(s)">{{ s.label }}</button>
        </span>
        <span class="lp__spacer" />
        <el-button size="small" title="Copy its path, as code (INPUT_DIR / …)" @click="act('copy')">Copy path</el-button>
        <el-button size="small" title="Its files, as a plain folder" @click="act('show-files')">Show files</el-button>
        <el-button v-if="left.length" size="small" type="primary" :title="`Download the ${left.length} files not in the session`" @click="act('download')">
          Download ({{ fmtSize(leftSize) }})
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.lp__head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lp__icon {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
}
.lp__icon--graph {
  color: theme.$purple_2;
}
.lp__title {
  font-size: 16px;
  font-weight: 600;
  color: theme.$gray_6;
}
.lp__path {
  font-size: 12px;
  color: theme.$gray_4;
  word-break: break-all;
}
.lp__note {
  margin: 0 0 12px;
  padding: 6px 10px;
  border-left: 2px solid theme.$purple_2;
  background: theme.$purple_tint;
  font-size: 12px;
  color: theme.$gray_5;
}
.lp__msg {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_5;
}
.lp__facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0 0 12px;
  font-size: 13px;

  dt {
    color: theme.$gray_4;
  }
  dd {
    margin: 0;
    color: theme.$gray_6;
  }
}
.lp__cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.lp__h {
  margin: 12px 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.lp__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;

  th {
    text-align: left;
    font-weight: 500;
    color: theme.$gray_4;
  }
  td,
  th {
    padding: 2px 6px 2px 0;
    border-bottom: 1px solid theme.$gray_1;
    word-break: break-word;
  }
}
.lp__num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.lp__dim {
  font-size: 11px;
  color: theme.$gray_4;
}
.lp__files {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;

  li {
    display: flex;
    gap: 8px;
    padding: 2px 0;
  }
}
.lp__file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: theme.$gray_6;
}
.lp__btn {
  margin-left: 6px;
  border: 1px solid theme.$purple_2;
  border-radius: 3px;
  background: theme.$white;
  padding: 1px 8px;
  font: inherit;
  color: theme.$purple_2;
  cursor: pointer;
}
.lp__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.lp__spacer {
  flex: 1;
}
.lp__code {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
/* The file browser's Code chips. */
.lp__chip {
  border: 1px solid theme.$gray_2;
  border-radius: 10px;
  background: theme.$white;
  padding: 1px 9px;
  font-size: 11px;
  color: theme.$purple_2;
  cursor: pointer;
}
.lp__chip:hover,
.lp__chip:focus-visible {
  border-color: theme.$purple_2;
  background: theme.$purple_tint;
  outline: none;
}
</style>
