<script setup>
// Choosing Imaging Data Commons series (utils/idc): IDC's collections,
// searched here by name, cancer type and location and narrowed by species;
// opening one lists its series, of a modality if chosen, a page at a time,
// to tick. A slide (SM) is read in place, a region at a time; other series
// are files to download. Used by the new notebook dialog and a running
// session's "Add data".
import { computed, onMounted, ref } from "vue";
import { idcCollections, searchIdc, idcCollection, idcSeries, idcCollectionUrl, IDC_MAX_SERIES } from "@/utils/idc";

// What's ticked: series ({ uuid, bucket, collection, patient, modality,
// description, instances, size, slide }).
const picks = defineModel("picks", { type: Array, default: () => [] });

const collections = ref([]);
const loading = ref(false);
const error = ref("");
const query = ref("");
const species = ref("");
const speciesChoices = computed(() => [...new Set(collections.value.flatMap((c) => c.species))].sort());
const matching = computed(() => searchIdc(collections.value, query.value, species.value));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    collections.value = await idcCollections();
  } catch (err) {
    console.error("Failed to list IDC collections:", err);
    error.value = "IDC's collections couldn't be listed just now.";
  } finally {
    loading.value = false;
  }
}

/* --------------------------------------------- a collection's series --- */
const open = ref(null); // a collection
const detail = ref(null); // { modalities, series, sizeTB, patients }
const modality = ref("");
const series = ref([]);
const total = ref(0);
const page = ref(0);
const seriesLoading = ref(false);
const seriesError = ref("");
const PAGE_SIZE = 50;

async function openCollection(c) {
  open.value = c;
  detail.value = null;
  modality.value = "";
  series.value = [];
  try {
    const d = await idcCollection(c.id);
    if (open.value === c) detail.value = d;
  } catch (err) {
    console.error("Failed to read the collection:", err);
  }
  await loadSeries();
}

async function loadSeries({ more = false } = {}) {
  const c = open.value;
  seriesLoading.value = true;
  seriesError.value = "";
  try {
    const next = more ? page.value + 1 : 0;
    const res = await idcSeries({ collection: c.id, modality: modality.value, page: next, pageSize: PAGE_SIZE });
    if (open.value !== c) return;
    series.value = more ? [...series.value, ...res.series] : res.series;
    total.value = res.total;
    page.value = next;
    if (!series.value.length) seriesError.value = "No series here.";
  } catch (err) {
    console.error("Failed to list the collection's series:", err);
    if (open.value === c) seriesError.value = "Its series couldn't be listed just now.";
  } finally {
    if (open.value === c) seriesLoading.value = false;
  }
}
function chooseModality(m) {
  modality.value = modality.value === m ? "" : m;
  loadSeries();
}
const back = () => (open.value = null);

const ticked = computed(() => new Set(picks.value.map((s) => s.uuid)));
const full = computed(() => picks.value.length >= IDC_MAX_SERIES);
function toggle(s) {
  if (ticked.value.has(s.uuid)) picks.value = picks.value.filter((p) => p.uuid !== s.uuid);
  else if (!full.value) picks.value = [...picks.value, s];
}
const remove = (uuid) => (picks.value = picks.value.filter((p) => p.uuid !== uuid));

const downloadSize = computed(() => picks.value.filter((s) => !s.slide).reduce((n, s) => n + s.size, 0));
const slides = computed(() => picks.value.filter((s) => s.slide).length);

const formatSize = (bytes) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const TERMS_SHOWN = 3;
const some = (list) => (list.length > TERMS_SHOWN ? `${list.slice(0, TERMS_SHOWN).join(", ")} +${list.length - TERMS_SHOWN}` : list.join(", "));

onMounted(() => {
  if (!collections.value.length) load();
});
</script>

<template>
  <div class="ic-picker">
    <!-- What's ticked, to remove. -->
    <div v-if="picks.length" class="ic-picks">
      <span v-for="s in picks" :key="s.uuid" class="ic-pick" :title="`${s.collection} · ${s.description}`">
        {{ s.patient }} · {{ s.modality }}
        <button type="button" class="ic-pick__remove" :aria-label="`Remove ${s.patient} ${s.modality}`" @click="remove(s.uuid)">&times;</button>
      </span>
      <span class="ic-picks__note">
        {{ picks.length }} series{{ downloadSize ? ` · ${formatSize(downloadSize)} to download` : "" }}{{ slides ? ` · ${slides} slide${slides === 1 ? "" : "s"} read in place` : "" }}{{ full ? ` · at most ${IDC_MAX_SERIES}` : "" }}
      </span>
    </div>

    <!-- A collection's series. -->
    <div v-if="open" class="ic-open">
      <div class="ic-head">
        <div class="ic-head__text">
          <div class="ic-head__name">{{ open.name }}</div>
          <div class="ic-meta">
            <a :href="idcCollectionUrl(open.id)" target="_blank" rel="noopener">{{ open.id }}</a>
            <span v-if="open.cancerTypes.length">{{ some(open.cancerTypes) }}</span>
            <span v-if="detail">{{ detail.series.toLocaleString("en-US") }} series · {{ detail.sizeTB }} TB</span>
          </div>
        </div>
        <button type="button" class="ic-back" @click="back">← Collections</button>
      </div>
      <div v-if="detail?.modalities.length" class="ic-formats" role="group" aria-label="Modality">
        <button
          v-for="m in detail.modalities"
          :key="m"
          type="button"
          class="ic-format"
          :class="{ 'is-on': modality === m }"
          :aria-pressed="modality === m"
          @click="chooseModality(m)"
        >
          {{ m }}
        </button>
      </div>
      <p class="ic-count">
        {{ total.toLocaleString("en-US") }} series{{ modality ? ` of ${modality}` : "" }} · slides (SM) are read in place; others are files to download
      </p>
      <div class="ic-cards pp-list">
        <label v-for="s in series" :key="s.uuid" class="ic-row" :class="{ 'is-chosen': ticked.has(s.uuid) }">
          <input type="checkbox" :checked="ticked.has(s.uuid)" :disabled="!ticked.has(s.uuid) && full" @change="toggle(s)" />
          <span class="ic-card">
            <span class="ic-card__name">
              {{ s.patient }} · {{ s.modality }}<span v-if="s.slide" class="ic-tag">read in place</span>
            </span>
            <span class="ic-meta">
              <span v-if="s.description">{{ s.description }}</span>
              <span>{{ s.instances }} file{{ s.instances === 1 ? "" : "s" }}</span>
              <span v-if="s.size">{{ formatSize(s.size) }}</span>
            </span>
          </span>
        </label>
        <div v-if="seriesLoading" class="ic-msg">Listing its series…</div>
        <div v-else-if="seriesError" class="ic-msg">{{ seriesError }}</div>
        <button v-else-if="series.length < total" type="button" class="ic-more" @click="loadSeries({ more: true })">More series</button>
      </div>
    </div>

    <!-- Finding a collection. -->
    <template v-else>
      <div class="ic-search">
        <el-input v-model="query" placeholder="Search IDC collections by name, cancer or site..." clearable />
        <el-select v-model="species" class="ic-search__filter" placeholder="Any species" clearable>
          <el-option v-for="s in speciesChoices" :key="s" :label="s" :value="s" />
        </el-select>
      </div>
      <p v-if="collections.length" class="ic-count">
        {{ matching.length.toLocaleString("en-US") }} collection{{ matching.length === 1 ? "" : "s" }} · open one to choose its series
      </p>
      <div class="ic-cards pp-list">
        <div v-if="loading" class="ic-msg">Loading IDC's collections…</div>
        <div v-else-if="error" class="ic-msg">{{ error }}</div>
        <button v-for="c in matching" :key="c.id" type="button" class="ic-result" @click="openCollection(c)">
          <span class="ic-card__name">{{ c.name }}</span>
          <span class="ic-meta">
            <span v-if="c.cancerTypes.length">{{ some(c.cancerTypes) }}</span>
            <span v-if="c.locations.length">{{ some(c.locations) }}</span>
            <span v-if="c.species.length">{{ c.species.join(", ") }}</span>
            <span v-if="c.subjects">{{ c.subjects.toLocaleString("en-US") }} subjects</span>
          </span>
        </button>
        <div v-if="!loading && !error && collections.length && !matching.length" class="ic-msg">No IDC collections found</div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

/* The collection open fills the picker, its file list the rest of it. */
.ic-open {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}
.ic-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  max-height: 84px;
  overflow-y: auto;
}
.ic-pick {
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
.ic-pick__remove {
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
.ic-picks__note {
  font-size: 12px;
  color: theme.$gray_4;
}
.ic-search {
  display: flex;
  gap: 8px;
}
.ic-search__filter {
  width: 170px;
  flex-shrink: 0;
}
.ic-formats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 4px;
}
.ic-format {
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
.ic-format__n {
  color: theme.$gray_4;
}
.ic-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.ic-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.ic-result {
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
.ic-row {
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
.ic-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.ic-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  overflow-wrap: anywhere;
}
.ic-tag {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 11px;
  font-weight: 400;
  color: theme.$gray_5;
}
.ic-desc {
  font-size: 12px;
  line-height: 1.45;
  color: theme.$gray_5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.ic-meta {
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
.ic-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.ic-more,
.ic-link,
.ic-back {
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
.ic-more {
  padding: 8px 14px;
  text-align: left;
}
.ic-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid theme.$gray_2;
}
.ic-head__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.ic-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.ic-back {
  flex-shrink: 0;
  padding: 0;
}
.ic-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 10px 0 8px;
  font-size: 12px;
  color: theme.$gray_4;
}
.ic-link {
  padding: 0;
  font-size: 12px;
}
.ic-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
</style>
