<script setup>
// Choosing a dandiset of the DANDI Archive with DANDI's own search
// (utils/dandi), its version, and the folder of it to take: all of it, or a
// folder below. A view of it is made from these (viewsService
// createDandiView): its files, each read from its blob in the archive's
// bucket. Used by the new notebook dialog and the running session's Inputs
// panel.
import { onMounted, ref, watch } from "vue";
import { searchDandi, dandiVersions, listDandiFolder, dandiUrl } from "@/utils/dandi";
import OpenDataFolders from "./OpenDataFolders.vue";

// The chosen dandiset (a searchDandi result, its version the one chosen)
// and folder: "" for all of it, else ending in /.
const dataset = defineModel("dataset", { default: null });
const prefix = defineModel("prefix", { type: String, default: "" });

const query = ref("");
const results = ref([]);
const count = ref(null);
const next = ref(null);
const loading = ref(false);
const error = ref("");
let seq = 0;
let timer = null;

// A newer search wins.
async function search({ more = false } = {}) {
  const mine = ++seq;
  loading.value = true;
  error.value = "";
  try {
    const res = await searchDandi({ query: query.value, page: more ? next.value : 1 });
    if (mine !== seq) return;
    results.value = more ? [...results.value, ...res.datasets] : res.datasets;
    count.value = res.count;
    next.value = res.next;
  } catch (err) {
    console.error("Failed to search DANDI:", err);
    if (mine === seq) {
      if (!more) results.value = [];
      error.value = "DANDI couldn't be searched just now.";
    }
  } finally {
    if (mine === seq) loading.value = false;
  }
}

const onQuery = () => {
  clearTimeout(timer);
  timer = setTimeout(() => search(), 400);
};
onMounted(() => {
  if (!dataset.value) search();
});

// The chosen dandiset's versions, newest published first, the draft last.
const versions = ref([]);
watch(
  () => dataset.value?.id,
  async (id) => {
    versions.value = [];
    if (!id) return;
    try {
      const list = await dandiVersions(id);
      if (dataset.value?.id === id) versions.value = list;
    } catch (err) {
      console.error("Failed to list the dandiset's versions:", err);
    }
  },
  { immediate: true }
);
function chooseVersion(version) {
  const v = versions.value.find((x) => x.version === version);
  if (!v || !dataset.value) return;
  dataset.value = { ...dataset.value, version: v.version, name: v.name || dataset.value.name, files: v.files, size: v.size };
  prefix.value = "";
}

function choose(d) {
  dataset.value = d;
  prefix.value = "";
}

function clear() {
  dataset.value = null;
  prefix.value = "";
  if (!results.value.length) search();
}

const listFolder = ({ prefix: p, startsWith }) =>
  listDandiFolder({ id: dataset.value.id, version: dataset.value.version, prefix: p, startsWith });

const formatSize = (bytes) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const filesLine = (n) => (n ? `${n.toLocaleString("en-US")} file${n === 1 ? "" : "s"}` : "");
const versionLabel = (v) => (v === "draft" ? "draft (may still change)" : `version ${v}`);
</script>

<template>
  <div class="dd-picker">
    <!-- The dandiset chosen: its header and version, then its folders. -->
    <div v-if="dataset" class="dd-selected">
      <div class="dd-head">
        <div class="dd-head__text">
          <div class="dd-head__name">{{ dataset.name }}</div>
          <div class="dd-meta">
            <a :href="dandiUrl(dataset.id, dataset.version)" target="_blank" rel="noopener">DANDI:{{ dataset.id }}</a>
            <span v-if="dataset.files">{{ filesLine(dataset.files) }}</span>
            <span v-if="dataset.size">{{ formatSize(dataset.size) }}</span>
          </div>
        </div>
        <el-select
          v-if="versions.length > 1"
          class="dd-version"
          size="small"
          :model-value="dataset.version"
          aria-label="Version"
          @update:model-value="chooseVersion"
        >
          <el-option v-for="v in versions" :key="v.version" :label="versionLabel(v.version)" :value="v.version" />
        </el-select>
        <span v-else class="dd-meta">{{ versionLabel(dataset.version) }}</span>
        <button type="button" class="dd-head__clear" title="Choose another dandiset" aria-label="Choose another dandiset" @click="clear">
          &times;
        </button>
      </div>
      <OpenDataFolders
        :key="`${dataset.id}/${dataset.version}`"
        class="dd-browser"
        dataset="dandiarchive"
        :root-label="`DANDI:${dataset.id}`"
        :list="listFolder"
        :filter-finds-more="false"
        v-model:prefix="prefix"
      />
    </div>

    <!-- Choosing one: DANDI's search. -->
    <template v-else>
      <el-input v-model="query" placeholder="Search DANDI..." clearable @input="onQuery" @clear="search()" />
      <p v-if="count != null && !loading" class="dd-count">
        {{ count.toLocaleString("en-US") }} dandiset{{ count === 1 ? "" : "s" }}
      </p>
      <div class="dd-cards">
        <button v-for="d in results" :key="d.id" type="button" class="dd-card" @click="choose(d)">
          <span class="dd-card__name">{{ d.name }}</span>
          <span class="dd-meta">
            <span>DANDI:{{ d.id }}</span>
            <span>{{ d.published ? `version ${d.version}` : "draft only" }}</span>
            <span v-if="d.contact">{{ d.contact }}</span>
            <span v-if="d.files">{{ filesLine(d.files) }}</span>
            <span v-if="d.size">{{ formatSize(d.size) }}</span>
          </span>
        </button>
        <div v-if="loading" class="dd-msg">Searching DANDI…</div>
        <div v-else-if="error" class="dd-msg">{{ error }}</div>
        <div v-else-if="!results.length" class="dd-msg">No dandisets found</div>
        <button v-else-if="next" type="button" class="dd-more" @click="search({ more: true })">More dandisets</button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.dd-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.dd-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  margin-top: 8px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.dd-count + .dd-cards {
  margin-top: 0;
}
.dd-card {
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
.dd-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.dd-meta {
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
.dd-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.dd-more {
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
.dd-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid theme.$gray_2;
}
.dd-head__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.dd-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.dd-version {
  width: 190px;
  flex-shrink: 0;
}
.dd-head__clear {
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
.dd-browser {
  margin-top: 12px;
}
</style>
