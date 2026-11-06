<script setup>
// Choosing ENCODE experiments and their files (utils/encode): ENCODE's
// search finds released experiments, by words and narrowed by assay and
// organism; opening one lists its files, the default analysis's ticked to
// start with. Several experiments can be taken, each a folder of the
// notebook's input. Used by the new notebook dialog and a running session's
// "Add data".
import { computed, onMounted, ref, watch } from "vue";
import {
  searchEncode,
  encodeFiles,
  defaultFiles,
  encodeUrl,
  ENCODE_MAX_EXPERIMENTS,
  ENCODE_MAX_FILES,
} from "@/utils/encode";

// What's taken: [{ accession, assay, biosample, files: [{ key, name, size }] }].
const picks = defineModel("picks", { type: Array, default: () => [] });

const query = ref("");
const assay = ref("");
const organism = ref("");
const results = ref([]);
const total = ref(null);
const assays = ref([]);
const organisms = ref([]);
const loading = ref(false);
const error = ref("");
const PAGE = 25;
let seq = 0;
let timer = null;

// ENCODE's search takes a second or two; a newer search wins.
async function search({ more = false } = {}) {
  const mine = ++seq;
  loading.value = true;
  error.value = "";
  try {
    const res = await searchEncode({
      query: query.value,
      assay: assay.value,
      organism: organism.value,
      from: more ? results.value.length : 0,
      limit: PAGE,
    });
    if (mine !== seq) return;
    results.value = more ? [...results.value, ...res.experiments] : res.experiments;
    total.value = res.total;
    // The filters offer what the other filters and words leave.
    if (!assay.value) assays.value = res.assays;
    if (!organism.value) organisms.value = res.organisms;
  } catch (err) {
    console.error("Failed to search ENCODE:", err);
    if (mine === seq) {
      if (!more) results.value = [];
      error.value = "ENCODE couldn't be searched just now.";
    }
  } finally {
    if (mine === seq) loading.value = false;
  }
}
const onQuery = () => {
  clearTimeout(timer);
  timer = setTimeout(() => search(), 400);
};
watch([assay, organism], () => search());

/* ------------------------------------------------- an experiment's files --- */
const open = ref(null); // an experiment of the results
const files = ref([]);
const ticked = ref(new Set()); // keys
const filesLoading = ref(false);
const filesError = ref("");

const pickOf = (accession) => picks.value.find((p) => p.accession === accession);

async function openExperiment(e) {
  open.value = e;
  files.value = [];
  filesError.value = "";
  filesLoading.value = true;
  try {
    const list = await encodeFiles(e.accession);
    if (open.value !== e) return;
    files.value = list;
    const taken = pickOf(e.accession);
    ticked.value = new Set((taken ? taken.files : defaultFiles(list)).map((f) => f.key));
    if (!list.length) filesError.value = "This experiment has no released files in ENCODE's public bucket.";
  } catch (err) {
    console.error("Failed to list the experiment's files:", err);
    if (open.value === e) filesError.value = "Its files couldn't be listed just now.";
  } finally {
    if (open.value === e) filesLoading.value = false;
  }
}
const back = () => (open.value = null);

function toggle(f) {
  const next = new Set(ticked.value);
  if (next.has(f.key)) next.delete(f.key);
  else if (next.size < ENCODE_MAX_FILES) next.add(f.key);
  ticked.value = next;
}
const tick = (list) => (ticked.value = new Set(list.slice(0, ENCODE_MAX_FILES).map((f) => f.key)));
const tickedFiles = computed(() => files.value.filter((f) => ticked.value.has(f.key)));
const tickedSize = computed(() => tickedFiles.value.reduce((n, f) => n + f.size, 0));
const hasDefault = computed(() => files.value.some((f) => f.preferred));

const fullOfExperiments = computed(() => picks.value.length >= ENCODE_MAX_EXPERIMENTS);
const openTaken = computed(() => !!(open.value && pickOf(open.value.accession)));
const canTake = computed(() => tickedFiles.value.length > 0 && (openTaken.value || !fullOfExperiments.value));

// Takes the open experiment with the files ticked (again, if it's taken).
function take() {
  if (!canTake.value) return;
  const e = open.value;
  const pick = {
    accession: e.accession,
    assay: e.assay,
    biosample: e.biosample,
    files: tickedFiles.value.map(({ key, name, size }) => ({ key, name, size })),
  };
  picks.value = openTaken.value ? picks.value.map((p) => (p.accession === e.accession ? pick : p)) : [...picks.value, pick];
  open.value = null;
}
const remove = (accession) => (picks.value = picks.value.filter((p) => p.accession !== accession));

const pickedFiles = computed(() => picks.value.reduce((n, p) => n + p.files.length, 0));
const pickedSize = computed(() => picks.value.reduce((n, p) => n + p.files.reduce((m, f) => m + (f.size || 0), 0), 0));

const formatSize = (bytes) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const replicates = (r) => (r.length ? `rep ${r.join(", ")}` : "");

onMounted(() => search());
</script>

<template>
  <div class="en-picker">
    <!-- What's taken, to remove. -->
    <div v-if="picks.length" class="en-picks">
      <span v-for="p in picks" :key="p.accession" class="en-pick" :title="`${p.assay} · ${p.biosample}`">
        {{ p.accession }} · {{ p.files.length }} file{{ p.files.length === 1 ? "" : "s" }}
        <button type="button" class="en-pick__remove" :aria-label="`Remove ${p.accession}`" @click="remove(p.accession)">&times;</button>
      </span>
      <span class="en-picks__note">{{ pickedFiles }} files · {{ formatSize(pickedSize) }}</span>
    </div>

    <!-- An experiment's files. -->
    <div v-if="open" class="en-open">
      <div class="en-head">
        <div class="en-head__text">
          <div class="en-head__name">{{ open.assay }} · {{ open.biosample }}</div>
          <div class="en-meta">
            <a :href="encodeUrl(open.accession)" target="_blank" rel="noopener">{{ open.accession }}</a>
            <span v-if="open.lab">{{ open.lab }}</span>
          </div>
        </div>
        <button type="button" class="en-back" @click="back">← Experiments</button>
      </div>
      <div v-if="files.length" class="en-bar">
        <span>{{ tickedFiles.length }} of {{ files.length }} files · {{ formatSize(tickedSize) || "0 B" }}</span>
        <button v-if="hasDefault" type="button" class="en-link" @click="tick(defaultFiles(files))">Default analysis</button>
        <button type="button" class="en-link" @click="tick(files)">All</button>
        <button type="button" class="en-link" @click="tick([])">None</button>
      </div>
      <div class="en-cards pp-list">
        <div v-if="filesLoading" class="en-msg">Listing its files…</div>
        <div v-else-if="filesError" class="en-msg">{{ filesError }}</div>
        <label v-for="f in files" :key="f.key" class="en-row" :class="{ 'is-chosen': ticked.has(f.key) }">
          <input
            type="checkbox"
            :checked="ticked.has(f.key)"
            :disabled="!ticked.has(f.key) && ticked.size >= ENCODE_MAX_FILES"
            @change="toggle(f)"
          />
          <span class="en-card">
            <span class="en-card__name">{{ f.name }}<span v-if="f.preferred" class="en-tag">default</span></span>
            <span class="en-meta">
              <span>{{ f.outputType }}</span>
              <span v-if="f.format">{{ f.format }}</span>
              <span v-if="f.assembly">{{ f.assembly }}</span>
              <span v-if="f.replicates.length">{{ replicates(f.replicates) }}</span>
              <span v-if="f.size">{{ formatSize(f.size) }}</span>
            </span>
          </span>
        </label>
      </div>
      <div class="en-actions">
        <span v-if="fullOfExperiments && !openTaken" class="en-picks__note">At most {{ ENCODE_MAX_EXPERIMENTS }} experiments.</span>
        <el-button v-if="openTaken" @click="remove(open.accession); back()">Remove experiment</el-button>
        <el-button type="primary" :disabled="!canTake" @click="take">
          {{ openTaken ? "Update" : "Take" }} {{ tickedFiles.length }} file{{ tickedFiles.length === 1 ? "" : "s" }}
        </el-button>
      </div>
    </div>

    <!-- Finding experiments: ENCODE's search. -->
    <template v-else>
      <div class="en-search">
        <el-input v-model="query" placeholder="Search ENCODE experiments..." clearable @input="onQuery" @clear="search()" />
        <el-select v-model="assay" class="en-search__filter" placeholder="Any assay" clearable filterable>
          <el-option v-for="a in assays" :key="a" :label="a" :value="a" />
        </el-select>
        <el-select v-model="organism" class="en-search__filter" placeholder="Any organism" clearable>
          <el-option v-for="o in organisms" :key="o" :label="o" :value="o" />
        </el-select>
      </div>
      <p v-if="total != null && !loading" class="en-count">
        {{ total.toLocaleString("en-US") }} released experiment{{ total === 1 ? "" : "s" }} · open one to choose its files
      </p>
      <div class="en-cards pp-list">
        <button
          v-for="e in results"
          :key="e.accession"
          type="button"
          class="en-result"
          :class="{ 'is-chosen': !!pickOf(e.accession) }"
          @click="openExperiment(e)"
        >
          <span class="en-card__name">{{ e.assay }} · {{ e.biosample }}</span>
          <span class="en-meta">
            <span>{{ e.accession }}</span>
            <span v-if="e.lab">{{ e.lab }}</span>
            <span v-if="e.released">{{ e.released }}</span>
            <span v-if="pickOf(e.accession)">{{ pickOf(e.accession).files.length }} files taken</span>
          </span>
          <span v-if="e.description" class="en-desc">{{ e.description }}</span>
        </button>
        <div v-if="loading" class="en-msg">Searching ENCODE…</div>
        <div v-else-if="error" class="en-msg">{{ error }}</div>
        <div v-else-if="!results.length" class="en-msg">No ENCODE experiments found</div>
        <button v-else-if="results.length < total" type="button" class="en-more" @click="search({ more: true })">More experiments</button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

/* The experiment open fills the picker, its file list the rest of it. */
.en-open {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.en-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  max-height: 84px;
  overflow-y: auto;
}
.en-pick {
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
.en-pick__remove {
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
.en-picks__note {
  font-size: 12px;
  color: theme.$gray_4;
}
.en-search {
  display: flex;
  gap: 8px;
}
.en-search__filter {
  width: 170px;
  flex-shrink: 0;
}
.en-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.en-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.en-result {
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
.en-row {
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
.en-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.en-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  overflow-wrap: anywhere;
}
.en-tag {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 11px;
  font-weight: 400;
  color: theme.$gray_5;
}
.en-desc {
  font-size: 12px;
  line-height: 1.45;
  color: theme.$gray_5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.en-meta {
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
.en-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.en-more,
.en-link,
.en-back {
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
.en-more {
  padding: 8px 14px;
  text-align: left;
}
.en-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid theme.$gray_2;
}
.en-head__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.en-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.en-back {
  flex-shrink: 0;
  padding: 0;
}
.en-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 10px 0 8px;
  font-size: 12px;
  color: theme.$gray_4;
}
.en-link {
  padding: 0;
  font-size: 12px;
}
.en-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
