<script setup>
/*
  Files and folders of published datasets for a run's input: search Discover,
  open a dataset (its latest version), browse its folders and tick what the
  input takes, from as many datasets as needed. The run takes them as one
  view kept for the run (utils/viewsService createRunView).

  v-model: the picks, each
    { datasetId, version, datasetName, path, name, isFolder, size }.
  whyNot(name): why a file can't be chosen ("" when it can): the input's
    file types. Folders can always be chosen.
*/
import { computed, ref } from "vue";
import { searchPublicDatasets, browsePublicFiles } from "@/utils/publicDatasets";
import { formatBytes } from "./dataTargets";

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  whyNot: { type: Function, default: () => "" },
});
const emit = defineEmits(["update:modelValue"]);

const PAGE = 500;

/* ---------------------------------------------------------------- search -- */
const results = ref([]);
const searching = ref(false);
let searchTimer = null;
let searchSeq = 0;
async function search(query = "") {
  const seq = ++searchSeq;
  searching.value = true;
  try {
    const found = await searchPublicDatasets(query);
    if (seq === searchSeq) results.value = found;
  } catch (err) {
    console.error("Failed to search public datasets:", err);
    if (seq === searchSeq) results.value = [];
  } finally {
    if (seq === searchSeq) searching.value = false;
  }
}
const onSearch = (query) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => search(query), 300);
};
search();

/* ---------------------------------------------------------------- browse -- */
const dataset = ref(null);
const path = ref("");
const files = ref([]);
const total = ref(0);
const loading = ref(false);
let browseSeq = 0;

async function load(append = false) {
  if (!dataset.value) return;
  const seq = ++browseSeq;
  loading.value = true;
  try {
    const page = await browsePublicFiles({
      id: dataset.value.id,
      version: dataset.value.version,
      path: path.value,
      limit: PAGE,
      offset: append ? files.value.length : 0,
    });
    if (seq !== browseSeq) return;
    files.value = append ? [...files.value, ...page.files] : page.files;
    total.value = page.totalCount;
  } catch (err) {
    console.error("Failed to list the dataset's files:", err);
    if (seq === browseSeq && !append) files.value = [];
  } finally {
    if (seq === browseSeq) loading.value = false;
  }
}

const openDataset = (id) => {
  dataset.value = results.value.find((d) => d.id === id) || null;
  path.value = "";
  files.value = [];
  load();
};
const openFolder = (p) => {
  path.value = p;
  load();
};
const crumbs = computed(() => {
  if (!path.value) return [];
  const parts = path.value.split("/");
  return parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join("/") }));
});

const isFolder = (f) => f.type === "Directory";

/* ----------------------------------------------------------------- picks -- */
const keyOf = (datasetId, version, p) => `${datasetId}:${version}:${p}`;
const picked = computed(() => new Set(props.modelValue.map((p) => keyOf(p.datasetId, p.version, p.path))));
// A chosen folder holds what's below it: shown ticked, and not chosen again.
const inChosenFolder = (p) =>
  props.modelValue.some(
    (k) => k.isFolder && k.datasetId === dataset.value?.id && k.version === dataset.value?.version && p.startsWith(`${k.path}/`)
  );
const isPicked = (f) => picked.value.has(keyOf(dataset.value.id, dataset.value.version, f.path)) || inChosenFolder(f.path);
const reasonNot = (f) => (isFolder(f) ? "" : props.whyNot(f.name));

const toggle = (f, on) => {
  const d = dataset.value;
  const key = keyOf(d.id, d.version, f.path);
  let next = props.modelValue.filter((p) => keyOf(p.datasetId, p.version, p.path) !== key);
  if (on) {
    // A folder takes in what was chosen inside it.
    if (isFolder(f)) next = next.filter((p) => !(p.datasetId === d.id && p.version === d.version && p.path.startsWith(`${f.path}/`)));
    next.push({ datasetId: d.id, version: d.version, datasetName: d.name, path: f.path, name: f.name, isFolder: isFolder(f), size: f.size || 0 });
  }
  emit("update:modelValue", next);
};
const remove = (pick) =>
  emit("update:modelValue", props.modelValue.filter((p) => keyOf(p.datasetId, p.version, p.path) !== keyOf(pick.datasetId, pick.version, pick.path)));

// The picks by dataset version, for the list of what's chosen.
const groups = computed(() => {
  const by = new Map();
  for (const p of props.modelValue) {
    const k = `${p.datasetId}:${p.version}`;
    if (!by.has(k)) by.set(k, { key: k, name: p.datasetName, version: p.version, picks: [] });
    by.get(k).picks.push(p);
  }
  return [...by.values()];
});
</script>

<template>
  <div class="pfp">
    <div class="pfp__search">
      <label for="pfp-dataset">Public dataset</label>
      <el-select
        id="pfp-dataset"
        :model-value="dataset?.id"
        filterable
        remote
        :remote-method="onSearch"
        :loading="searching"
        placeholder="Search published datasets"
        class="pfp__select"
        popper-class="dataset-option-popper"
        @update:model-value="openDataset"
      >
        <el-option v-for="d in results" :key="d.id" :label="d.name" :value="d.id">
          <div class="pfp__option">
            <img :src="d.banner || '/images/banner-placeholder.jpg'" alt="" loading="lazy" />
            <div>
              <span class="pfp__option-name">{{ d.name }}</span>
              <span class="pfp__option-meta">{{ [d.organizationName, d.authors].filter(Boolean).join(" · ") }}</span>
            </div>
          </div>
        </el-option>
      </el-select>
    </div>

    <div v-if="dataset" class="pfp__head">
      <img :src="dataset.banner || '/images/banner-placeholder.jpg'" alt="" />
      <div>
        <div class="pfp__name">{{ dataset.name }}</div>
        <div class="pfp__meta">
          Version {{ dataset.version }} · {{ dataset.fileCount.toLocaleString("en-US") }} files · {{ formatBytes(dataset.size) }}
        </div>
      </div>
    </div>

    <div v-if="dataset" class="pfp__browser">
      <nav class="pfp__crumbs">
        <button type="button" :disabled="!path" @click="openFolder('')">{{ dataset.name }}</button>
        <template v-for="c in crumbs" :key="c.path">
          <span>/</span>
          <button type="button" :disabled="c.path === path" @click="openFolder(c.path)">{{ c.name }}</button>
        </template>
      </nav>
      <p v-if="loading && !files.length" class="pfp__empty">Loading files…</p>
      <p v-else-if="!files.length" class="pfp__empty">This folder is empty.</p>
      <ul v-else class="pfp__files">
        <li v-for="f in files" :key="f.path" :class="{ 'is-off': reasonNot(f) && !isPicked(f) }" :title="reasonNot(f) || undefined">
          <el-checkbox
            :model-value="isPicked(f)"
            :disabled="(!!reasonNot(f) && !isPicked(f)) || inChosenFolder(f.path)"
            @update:model-value="(on) => toggle(f, on)"
          />
          <button v-if="isFolder(f)" type="button" class="pfp__folder" @click="openFolder(f.path)">{{ f.name }}/</button>
          <span v-else class="pfp__file">{{ f.name }}</span>
          <span class="pfp__size">{{ isFolder(f) ? "" : formatBytes(f.size || 0) }}</span>
        </li>
        <li v-if="files.length < total" class="pfp__more">
          <button type="button" class="text-link-btn" :disabled="loading" @click="load(true)">
            {{ loading ? "Loading…" : `Show more (${(total - files.length).toLocaleString("en-US")} left)` }}
          </button>
        </li>
      </ul>
    </div>
    <p v-else class="pfp__empty">Find a published dataset to choose its files. You can choose files from several datasets.</p>

    <div v-if="groups.length" class="pfp__chosen">
      <div v-for="g in groups" :key="g.key" class="pfp__group">
        <span class="pfp__group-name">{{ g.name }} <span>v{{ g.version }}</span></span>
        <span v-for="p in g.picks" :key="p.path" class="pfp__chip" :title="p.path">
          {{ p.isFolder ? `${p.name}/` : p.name }}
          <button type="button" :aria-label="`Remove ${p.name}`" @click="remove(p)">×</button>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.pfp {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pfp__search {
  display: flex;
  align-items: center;
  gap: 10px;

  label {
    font-size: 13px;
    font-weight: 600;
    color: theme.$gray_6;
    white-space: nowrap;
  }
}
.pfp__select {
  flex: 1;
}
.pfp__option {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  line-height: 1.3;

  img {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    object-fit: cover;
    background: theme.$gray_1;
  }
  div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
}
.pfp__option-name,
.pfp__option-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pfp__option-name {
  font-size: 13px;
  color: theme.$gray_6;
}
.pfp__option-meta {
  font-size: 11px;
  color: theme.$gray_4;
}
.pfp__head {
  display: flex;
  align-items: center;
  gap: 12px;

  img {
    width: 56px;
    height: 56px;
    object-fit: cover;
    background: theme.$gray_1;
  }
}
.pfp__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pfp__meta {
  font-size: 12px;
  color: theme.$gray_4;
}
.pfp__browser {
  border: 1px solid theme.$gray_2;
}
.pfp__crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid theme.$gray_2;
  font-size: 13px;
  color: theme.$gray_4;

  button {
    padding: 0;
    border: 0;
    background: none;
    color: theme.$purple_3;
    font: inherit;
    cursor: pointer;

    &:disabled {
      color: theme.$gray_6;
      cursor: default;
    }
  }
}
.pfp__files {
  max-height: 320px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 10px;
    border-bottom: 1px solid theme.$gray_1;
    font-size: 13px;

    &.is-off {
      color: theme.$gray_4;
    }
  }
}
.pfp__folder {
  padding: 0;
  border: 0;
  background: none;
  color: theme.$purple_3;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pfp__folder,
.pfp__file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pfp__size {
  color: theme.$gray_4;
  font-size: 12px;
  white-space: nowrap;
}
.pfp__more {
  justify-content: center;
}
.pfp__empty {
  margin: 0;
  padding: 16px 10px;
  color: theme.$gray_4;
  font-size: 13px;
}
.pfp__chosen {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pfp__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.pfp__group-name {
  font-weight: 600;
  color: theme.$gray_6;

  span {
    font-weight: 400;
    color: theme.$gray_4;
  }
}
.pfp__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 220px;
  padding: 2px 4px 2px 8px;
  border-radius: 3px;
  background: #eef2ff;
  color: theme.$gray_6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  button {
    padding: 0 4px;
    border: 0;
    background: none;
    color: theme.$gray_4;
    cursor: pointer;
  }
}
</style>
