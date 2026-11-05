<script setup>
// Choosing an OpenNeuro dataset with OpenNeuro's own search (utils/openNeuro),
// and the folder of it to take: its ds folder in the Registry of Open Data
// on AWS's openneuro entry, or a folder below it. A view of it is made from
// these like any Open Data dataset's (viewsService createOpenDataView). Used
// by the new notebook dialog and the running session's Inputs panel.
import { onMounted, ref, watch } from "vue";
import { searchOpenNeuro, openNeuroUrl, OPENNEURO_MODALITIES, OPENNEURO_REGISTRY } from "@/utils/openNeuro";
import OpenDataFolders from "./OpenDataFolders.vue";

// The chosen dataset (a searchOpenNeuro result) and folder: its ds folder
// ("ds000001/") or one below it.
const dataset = defineModel("dataset", { default: null });
const prefix = defineModel("prefix", { type: String, default: "" });

const query = ref("");
const modality = ref("");
const results = ref([]);
const count = ref(null);
const next = ref(null);
const loading = ref(false);
const error = ref("");
let seq = 0;
let timer = null;

// OpenNeuro's search takes a few seconds; a newer search wins.
async function search({ more = false } = {}) {
  const mine = ++seq;
  loading.value = true;
  error.value = "";
  try {
    const res = await searchOpenNeuro({ query: query.value, modality: modality.value, after: more ? next.value : null });
    if (mine !== seq) return;
    results.value = more ? [...results.value, ...res.datasets] : res.datasets;
    count.value = res.count;
    next.value = res.next;
  } catch (err) {
    console.error("Failed to search OpenNeuro:", err);
    if (mine === seq) {
      if (!more) results.value = [];
      error.value = "OpenNeuro couldn't be searched just now.";
    }
  } finally {
    if (mine === seq) loading.value = false;
  }
}

const onQuery = () => {
  clearTimeout(timer);
  timer = setTimeout(() => search(), 400);
};
watch(modality, () => search());
onMounted(() => {
  if (!dataset.value) search();
});

function choose(d) {
  dataset.value = d;
  prefix.value = `${d.id}/`;
}

function clear() {
  dataset.value = null;
  prefix.value = "";
  if (!results.value.length) search();
}

const formatSize = (bytes) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const subjectsLine = (n) => (n ? `${n} subject${n === 1 ? "" : "s"}` : "");
</script>

<template>
  <div class="on-picker">
    <!-- The dataset chosen: its header, then its folders. -->
    <div v-if="dataset" class="on-selected">
      <div class="on-head">
        <div class="on-head__text">
          <div class="on-head__name">{{ dataset.name }}</div>
          <div class="on-meta">
            <a :href="openNeuroUrl(dataset.id)" target="_blank" rel="noopener">{{ dataset.id }}</a>
            <span v-if="dataset.tag">version {{ dataset.tag }}</span>
            <span v-if="dataset.modalities.length">{{ dataset.modalities.join(", ") }}</span>
            <span v-if="dataset.subjects">{{ subjectsLine(dataset.subjects) }}</span>
            <span v-if="dataset.size">{{ formatSize(dataset.size) }}</span>
          </div>
        </div>
        <button type="button" class="on-head__clear" title="Choose another dataset" aria-label="Choose another dataset" @click="clear">
          &times;
        </button>
      </div>
      <OpenDataFolders
        class="on-browser"
        :dataset="OPENNEURO_REGISTRY"
        :root="`${dataset.id}/`"
        :root-label="dataset.id"
        v-model:prefix="prefix"
      />
    </div>

    <!-- Choosing one: OpenNeuro's search. -->
    <template v-else>
      <div class="on-search">
        <el-input v-model="query" placeholder="Search OpenNeuro..." clearable @input="onQuery" @clear="search()" />
        <el-select v-model="modality" class="on-search__modality" placeholder="Any modality" clearable>
          <el-option v-for="m in OPENNEURO_MODALITIES" :key="m" :label="m.toUpperCase()" :value="m" />
        </el-select>
      </div>
      <p v-if="count != null && !loading" class="on-count">
        {{ count.toLocaleString("en-US") }} dataset{{ count === 1 ? "" : "s" }}
      </p>
      <div class="on-cards">
        <button v-for="d in results" :key="d.id" type="button" class="on-card" @click="choose(d)">
          <span class="on-card__name">{{ d.name }}</span>
          <span class="on-meta">
            <span>{{ d.id }}</span>
            <span v-if="d.modalities.length">{{ d.modalities.join(", ") }}</span>
            <span v-if="d.subjects">{{ subjectsLine(d.subjects) }}</span>
            <span v-if="d.size">{{ formatSize(d.size) }}</span>
          </span>
        </button>
        <div v-if="loading" class="on-msg">Searching OpenNeuro…</div>
        <div v-else-if="error" class="on-msg">{{ error }}</div>
        <div v-else-if="!results.length" class="on-msg">No OpenNeuro datasets found</div>
        <button v-else-if="next" type="button" class="on-more" @click="search({ more: true })">More datasets</button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.on-search {
  display: flex;
  gap: 8px;
}
.on-search__modality {
  width: 150px;
  flex-shrink: 0;
}
.on-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.on-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.on-card {
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
}
.on-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.on-meta {
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
.on-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.on-more {
  padding: 8px 14px;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$purple_2;
  text-align: left;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
.on-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid theme.$gray_2;
}
.on-head__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.on-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.on-head__clear {
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0 2px;
  font-size: 18px;
  line-height: 1;
  color: theme.$gray_4;
  cursor: pointer;

  &:hover {
    color: theme.$gray_6;
  }
}
.on-browser {
  margin-top: 12px;
}
</style>
