<script setup>
// Choosing Human Cell Atlas projects and their files (utils/hca): the
// open-access projects, searched here by title and narrowed by species,
// organ and assay; opening one lists its files of the formats chosen (all
// but raw reads to start with), its matrices ticked. Several projects can
// be taken, each a folder of the notebook's input. Used by the new notebook
// dialog and a running session's "Add data".
import { computed, onMounted, ref, watch } from "vue";
import {
  hcaProjectTitles,
  searchHcaTitles,
  hcaProjects,
  hcaFormats,
  hcaFiles,
  defaultFormats,
  hcaProjectUrl,
  HCA_MAX_PROJECTS,
  HCA_MAX_FILES,
} from "@/utils/hca";

// What's taken: [{ id, title, shortname, files: [{ id, name, sha256, size }] }].
const picks = defineModel("picks", { type: Array, default: () => [] });

const query = ref("");
const species = ref("");
const organ = ref("");
const assay = ref("");
const titles = ref([]);
const choices = ref({ species: [], organs: [], assays: [] });
const loading = ref(false);
const error = ref("");
// The projects shown are read a page at a time (their records are large).
const PAGE = 15;
const shownCount = ref(PAGE);
const details = ref(new Map()); // title -> project
const detailsLoading = ref(false);
let seq = 0;

const matching = computed(() => searchHcaTitles(titles.value, query.value));
const shown = computed(() => matching.value.slice(0, shownCount.value));

async function loadTitles() {
  const mine = ++seq;
  loading.value = true;
  error.value = "";
  try {
    const res = await hcaProjectTitles({ species: species.value, organ: organ.value, assay: assay.value });
    if (mine !== seq) return;
    titles.value = res.titles;
    // The filters offer what the others leave.
    choices.value = {
      species: species.value ? choices.value.species : res.species,
      organs: organ.value ? choices.value.organs : res.organs,
      assays: assay.value ? choices.value.assays : res.assays,
    };
  } catch (err) {
    console.error("Failed to list Human Cell Atlas projects:", err);
    if (mine === seq) error.value = "The Human Cell Atlas couldn't be searched just now.";
  } finally {
    if (mine === seq) loading.value = false;
  }
}

// Reads the projects shown that aren't read yet.
async function loadDetails() {
  const missing = shown.value.filter((t) => !details.value.has(t));
  if (!missing.length) return;
  detailsLoading.value = true;
  try {
    const projects = await hcaProjects(missing);
    const next = new Map(details.value);
    for (const p of projects) next.set(p.title, p);
    details.value = next;
  } catch (err) {
    console.error("Failed to read Human Cell Atlas projects:", err);
  } finally {
    detailsLoading.value = false;
  }
}

watch([species, organ, assay], () => {
  shownCount.value = PAGE;
  loadTitles();
});
watch(query, () => (shownCount.value = PAGE));
watch(shown, loadDetails);

/* --------------------------------------------------- a project's files --- */
const open = ref(null); // a project
const formats = ref([]); // [{ format, count }]
const chosenFormats = ref([]);
const files = ref([]);
const next = ref(null);
const ticked = ref(new Map()); // sha256 -> file
const filesLoading = ref(false);
const filesError = ref("");

const pickOf = (id) => picks.value.find((p) => p.id === id);

async function openProject(p) {
  open.value = p;
  formats.value = [];
  files.value = [];
  filesError.value = "";
  const taken = pickOf(p.id);
  ticked.value = new Map((taken?.files || []).map((f) => [f.sha256, f]));
  try {
    formats.value = await hcaFormats(p.id);
    if (open.value !== p) return;
    chosenFormats.value = defaultFormats(formats.value);
    await loadFiles({ startTicked: !taken });
  } catch (err) {
    console.error("Failed to list the project's files:", err);
    if (open.value === p) filesError.value = "Its files couldn't be listed just now.";
  }
}

async function loadFiles({ more = false, startTicked = false } = {}) {
  const p = open.value;
  if (!chosenFormats.value.length) {
    files.value = [];
    next.value = null;
    return;
  }
  filesLoading.value = true;
  filesError.value = "";
  try {
    const page = await hcaFiles(p.id, chosenFormats.value, { next: more ? next.value : null });
    if (open.value !== p) return;
    files.value = more ? [...files.value, ...page.files] : page.files;
    next.value = page.next;
    // The matrices ticked to start with.
    if (startTicked) {
      const m = new Map();
      for (const f of files.value) if (f.matrix && m.size < HCA_MAX_FILES) m.set(f.sha256, f);
      ticked.value = m;
    }
    if (!files.value.length) filesError.value = "No open-access files of these formats.";
  } catch (err) {
    console.error("Failed to list the project's files:", err);
    if (open.value === p) filesError.value = "Its files couldn't be listed just now.";
  } finally {
    if (open.value === p) filesLoading.value = false;
  }
}
function toggleFormat(format) {
  const set = new Set(chosenFormats.value);
  set.has(format) ? set.delete(format) : set.add(format);
  chosenFormats.value = formats.value.map((f) => f.format).filter((f) => set.has(f));
  loadFiles();
}
const back = () => (open.value = null);

function toggle(f) {
  const m = new Map(ticked.value);
  if (m.has(f.sha256)) m.delete(f.sha256);
  else if (m.size < HCA_MAX_FILES) m.set(f.sha256, f);
  ticked.value = m;
}
const tickAll = () => {
  const m = new Map(ticked.value);
  for (const f of files.value) if (m.size < HCA_MAX_FILES) m.set(f.sha256, f);
  ticked.value = m;
};
const tickedFiles = computed(() => [...ticked.value.values()]);
const tickedSize = computed(() => tickedFiles.value.reduce((n, f) => n + (f.size || 0), 0));

const fullOfProjects = computed(() => picks.value.length >= HCA_MAX_PROJECTS);
const openTaken = computed(() => !!(open.value && pickOf(open.value.id)));
const canTake = computed(() => tickedFiles.value.length > 0 && (openTaken.value || !fullOfProjects.value));

// Takes the open project with the files ticked (again, if it's taken).
function take() {
  if (!canTake.value) return;
  const p = open.value;
  const pick = {
    id: p.id,
    title: p.title,
    shortname: p.shortname,
    files: tickedFiles.value.map(({ id, name, sha256, size }) => ({ id, name, sha256, size })),
  };
  picks.value = openTaken.value ? picks.value.map((x) => (x.id === p.id ? pick : x)) : [...picks.value, pick];
  open.value = null;
}
const remove = (id) => (picks.value = picks.value.filter((p) => p.id !== id));

const pickedFiles = computed(() => picks.value.reduce((n, p) => n + p.files.length, 0));
const pickedSize = computed(() => picks.value.reduce((n, p) => n + p.files.reduce((m, f) => m + (f.size || 0), 0), 0));

const formatSize = (bytes) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const cells = (n) => (n ? `${Number(n).toLocaleString("en-US")} cells` : "");
const TERMS_SHOWN = 3;
const some = (list) => (list.length > TERMS_SHOWN ? `${list.slice(0, TERMS_SHOWN).join(", ")} +${list.length - TERMS_SHOWN}` : list.join(", "));

onMounted(loadTitles);
</script>

<template>
  <div class="hc-picker">
    <!-- What's taken, to remove. -->
    <div v-if="picks.length" class="hc-picks">
      <span v-for="p in picks" :key="p.id" class="hc-pick" :title="p.title">
        {{ p.shortname || p.title }} · {{ p.files.length }} file{{ p.files.length === 1 ? "" : "s" }}
        <button type="button" class="hc-pick__remove" :aria-label="`Remove ${p.title}`" @click="remove(p.id)">&times;</button>
      </span>
      <span class="hc-picks__note">{{ pickedFiles }} files · {{ formatSize(pickedSize) }}</span>
    </div>

    <!-- A project's files. -->
    <div v-if="open" class="hc-open">
      <div class="hc-head">
        <div class="hc-head__text">
          <div class="hc-head__name">{{ open.title }}</div>
          <div class="hc-meta">
            <a :href="hcaProjectUrl(open.id)" target="_blank" rel="noopener">{{ open.shortname || "On the HCA Data Portal" }}</a>
            <span v-if="open.species.length">{{ some(open.species) }}</span>
            <span v-if="open.cellCount">{{ cells(open.cellCount) }}</span>
          </div>
        </div>
        <button type="button" class="hc-back" @click="back">← Projects</button>
      </div>
      <div v-if="formats.length" class="hc-formats" role="group" aria-label="File formats">
        <button
          v-for="f in formats"
          :key="f.format"
          type="button"
          class="hc-format"
          :class="{ 'is-on': chosenFormats.includes(f.format) }"
          :aria-pressed="chosenFormats.includes(f.format)"
          @click="toggleFormat(f.format)"
        >
          {{ f.format }} <span class="hc-format__n">{{ f.count.toLocaleString("en-US") }}</span>
        </button>
      </div>
      <div v-if="files.length" class="hc-bar">
        <span>{{ tickedFiles.length }} file{{ tickedFiles.length === 1 ? "" : "s" }} ticked · {{ formatSize(tickedSize) || "0 B" }}</span>
        <button type="button" class="hc-link" @click="tickAll">All listed</button>
        <button type="button" class="hc-link" @click="ticked = new Map()">None</button>
      </div>
      <div class="hc-cards pp-list">
        <label v-for="f in files" :key="f.sha256" class="hc-row" :class="{ 'is-chosen': ticked.has(f.sha256) }">
          <input
            type="checkbox"
            :checked="ticked.has(f.sha256)"
            :disabled="!ticked.has(f.sha256) && ticked.size >= HCA_MAX_FILES"
            @change="toggle(f)"
          />
          <span class="hc-card">
            <span class="hc-card__name">{{ f.name }}</span>
            <span class="hc-meta">
              <span>{{ f.format }}</span>
              <span v-if="f.content">{{ f.content }}</span>
              <span v-if="f.size">{{ formatSize(f.size) }}</span>
            </span>
          </span>
        </label>
        <div v-if="filesLoading" class="hc-msg">Listing its files…</div>
        <div v-else-if="filesError" class="hc-msg">{{ filesError }}</div>
        <button v-else-if="next" type="button" class="hc-more" @click="loadFiles({ more: true })">More files</button>
      </div>
      <div class="hc-actions">
        <span v-if="fullOfProjects && !openTaken" class="hc-picks__note">At most {{ HCA_MAX_PROJECTS }} projects.</span>
        <el-button v-if="openTaken" @click="remove(open.id); back()">Remove project</el-button>
        <el-button type="primary" :disabled="!canTake" @click="take">
          {{ openTaken ? "Update" : "Take" }} {{ tickedFiles.length }} file{{ tickedFiles.length === 1 ? "" : "s" }}
        </el-button>
      </div>
    </div>

    <!-- Finding projects. -->
    <template v-else>
      <div class="hc-search">
        <el-input v-model="query" placeholder="Search Human Cell Atlas projects..." clearable />
      </div>
      <div class="hc-search hc-search--filters">
        <el-select v-model="species" placeholder="Any species" clearable>
          <el-option v-for="s in choices.species" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="organ" placeholder="Any organ" clearable filterable>
          <el-option v-for="o in choices.organs" :key="o" :label="o" :value="o" />
        </el-select>
        <el-select v-model="assay" placeholder="Any assay" clearable filterable>
          <el-option v-for="a in choices.assays" :key="a" :label="a" :value="a" />
        </el-select>
      </div>
      <p v-if="!loading && !error" class="hc-count">
        {{ matching.length.toLocaleString("en-US") }} open-access project{{ matching.length === 1 ? "" : "s" }} · open one to choose its files
      </p>
      <div class="hc-cards pp-list">
        <template v-for="t in shown" :key="t">
          <button
            v-if="details.get(t)"
            type="button"
            class="hc-result"
            :class="{ 'is-chosen': !!pickOf(details.get(t).id) }"
            @click="openProject(details.get(t))"
          >
            <span class="hc-card__name">{{ t }}</span>
            <span class="hc-meta">
              <span v-if="details.get(t).species.length">{{ some(details.get(t).species) }}</span>
              <span v-if="details.get(t).organs.length">{{ some(details.get(t).organs) }}</span>
              <span v-if="details.get(t).assays.length">{{ some(details.get(t).assays) }}</span>
              <span v-if="details.get(t).cellCount">{{ cells(details.get(t).cellCount) }}</span>
              <span v-if="pickOf(details.get(t).id)">{{ pickOf(details.get(t).id).files.length }} files taken</span>
            </span>
          </button>
          <div v-else class="hc-result hc-result--pending">
            <span class="hc-card__name">{{ t }}</span>
          </div>
        </template>
        <div v-if="loading" class="hc-msg">Searching the Human Cell Atlas…</div>
        <div v-else-if="error" class="hc-msg">{{ error }}</div>
        <div v-else-if="!matching.length" class="hc-msg">No Human Cell Atlas projects found</div>
        <button v-else-if="matching.length > shown.length" type="button" class="hc-more" :disabled="detailsLoading" @click="shownCount += PAGE">
          More projects
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

/* The project open fills the picker, its file list the rest of it. */
.hc-open {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.hc-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  max-height: 84px;
  overflow-y: auto;
}
.hc-pick {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 8px;
  border-radius: 12px;
  background: theme.$purple_tint;
  font-size: 12px;
  color: theme.$gray_6;
  white-space: nowrap;
}
.hc-pick__remove {
  border: none;
  background: none;
  padding: 0 2px;
  font-size: 14px;
  line-height: 1;
  color: theme.$gray_4;
  cursor: pointer;

  &:hover {
    color: theme.$gray_6;
  }
}
.hc-picks__note {
  font-size: 12px;
  color: theme.$gray_4;
}
.hc-search {
  display: flex;
  gap: 8px;
}
.hc-search--filters {
  margin-top: 8px;

  > * {
    flex: 1 1 0;
    min-width: 0;
  }
}
.hc-result--pending {
  cursor: default;
  color: theme.$gray_4;
}
.hc-formats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 4px;
}
.hc-format {
  padding: 2px 8px;
  border: 1px solid theme.$gray_2;
  border-radius: 12px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_5;
  cursor: pointer;

  &.is-on {
    border-color: theme.$purple_3;
    background: theme.$purple_tint;
    color: theme.$gray_6;
  }
}
.hc-format__n {
  color: theme.$gray_4;
}
.hc-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.hc-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.hc-result {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
  &.is-chosen {
    background: theme.$purple_tint;
  }
}
.hc-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$white;
  cursor: pointer;

  input[type="checkbox"] {
    flex-shrink: 0;
    margin-top: 3px;
  }
  &:hover {
    background: theme.$gray_1;
  }
  &.is-chosen {
    background: theme.$purple_tint;
  }
}
.hc-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.hc-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  overflow-wrap: anywhere;
}
.hc-tag {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 11px;
  font-weight: 400;
  color: theme.$gray_5;
}
.hc-desc {
  font-size: 12px;
  line-height: 1.45;
  color: theme.$gray_5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hc-meta {
  display: flex;
  flex-wrap: wrap;
  font-size: 12px;
  color: theme.$gray_4;

  > * + *::before {
    content: "·";
    margin: 0 6px;
    color: theme.$gray_3;
  }
  a {
    color: theme.$purple_2;
  }
}
.hc-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.hc-more,
.hc-link,
.hc-back {
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$purple_2;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
.hc-more {
  padding: 8px 14px;
  text-align: left;
}
.hc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid theme.$gray_2;
}
.hc-head__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.hc-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.hc-back {
  flex-shrink: 0;
  padding: 0;
}
.hc-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 10px 0 8px;
  font-size: 12px;
  color: theme.$gray_4;
}
.hc-link {
  padding: 0;
  font-size: 12px;
}
.hc-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
