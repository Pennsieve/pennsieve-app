<script setup>
// The picker of this workspace's data (workspacePlatform): a dataset, then
// its metadata records and its files, as the New notebook dialog picks them.
// Its parts are v-model:dataset, v-model:files and v-model:models.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useStore } from "vuex";
import AnalysisFilesTable from "@/components/FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "@/components/datasets/files/BreadcrumbNavigation/BreadcrumbNavigation.vue";
import MetadataRecordsChoice from "@pennsieve/notebooks/components/Analysis/MetadataRecordsChoice.vue";
import { useSendXhr } from "@/mixins/request/request_composable";
import toQueryParams from "@/utils/toQueryParams";
import { useGetToken } from "@/composables/useGetToken";
import { listWorkspaceModels } from "@/utils/workspaceModels";
import { workspaceFilesAsViews } from "@pennsieve/notebooks/utils/viewsService";
import * as siteConfig from "@/site-config/site.json";

const dataset = defineModel("dataset", { type: Object, default: null });
const files = defineModel("files", { type: Array, default: () => [] });
const models = defineModel("models", { type: Array, default: () => [] });

const store = useStore();
const filesWithRecords = workspaceFilesAsViews();

/* ------------------------------------------------------------ datasets ---- */
const query = ref("");
const datasets = ref([]);
const searching = ref(false);
let timer = null;
async function search(q = "") {
  searching.value = true;
  try {
    const params = toQueryParams({
      limit: 25,
      offset: 0,
      query: q,
      orderBy: "IntId",
      orderDirection: "Desc",
      type: "research",
      api_key: await useGetToken(),
    });
    const response = await useSendXhr(`${siteConfig.apiUrl}/datasets/paginated?${params}`);
    datasets.value = response?.datasets || response || [];
  } catch (err) {
    console.error("Failed to fetch datasets:", err);
    datasets.value = [];
  } finally {
    searching.value = false;
  }
}
const onSearch = () => {
  clearTimeout(timer);
  timer = setTimeout(() => search(query.value), 300);
};
// Opened again on a dataset already chosen (back to the data step): its
// records and files as they were, what's ticked still ticked.
onMounted(() => {
  if (!dataset.value) return search();
  restoreTicks();
  load(dataset.value);
});

/* ------------------------------------------------- records and files ---- */
const available = ref([]);
const listing = ref([]);
// While a folder's files are being read.
const loadingFiles = ref(false);
const ancestors = ref([]);
const current = ref({ content: { name: "" } });
const ok = (url) => useSendXhr(url);
const childrenUrl = async (kind, id) =>
  `${siteConfig.apiUrl}/${kind}/${id}?api_key=${await useGetToken()}&includeAncestors=true&limit=500&offset=0`;

// A dataset's records to offer and its top folder.
async function load(ds) {
  ancestors.value = [];
  current.value = { content: { name: "" } };
  available.value = [];
  listWorkspaceModels(ds.content.id)
    .then((m) => dataset.value === ds && (available.value = m))
    .catch(() => {});
  loadingFiles.value = true;
  try {
    listing.value = [...((await ok(await childrenUrl("datasets", ds.content.id))).children || [])];
  } catch (err) {
    console.error("Failed to fetch files:", err);
    listing.value = [];
  } finally {
    loadingFiles.value = false;
  }
}
// The dataset has no files at all (its top folder is empty).
const atTop = computed(() => !current.value.content?.id);
const noFiles = computed(() => !loadingFiles.value && atTop.value && !listing.value.length);
function open(ds) {
  dataset.value = ds;
  files.value = [];
  models.value = [];
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  load(ds);
}
// The files chosen, back in the table's store, by folder.
function restoreTicks() {
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  const byFolder = {};
  for (const f of files.value) (byFolder[f.content?.parentId || "root"] ||= []).push(f);
  for (const [parentId, selected] of Object.entries(byFolder)) {
    store.commit("analysisModule/SET_SELECTED_FILES", { selectedFiles: selected, parentId });
  }
}
function clear() {
  dataset.value = null;
  files.value = [];
  models.value = [];
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
  if (!datasets.value.length) search();
}
async function openFolder(file) {
  if (file.content.packageType !== "Collection") return;
  try {
    listing.value = [...((await ok(await childrenUrl("packages", file.content.id))).children || [])];
    if (current.value.content?.id && !ancestors.value.some((a) => a.content.id === current.value.content?.id)) {
      ancestors.value = [...ancestors.value, current.value];
    }
    current.value = file;
  } catch (err) {
    console.error("Failed to navigate:", err);
  }
}
async function toCrumb(id) {
  try {
    if (!id || id === "root") {
      listing.value = [...((await ok(await childrenUrl("datasets", dataset.value.content.id))).children || [])];
      ancestors.value = [];
      current.value = { content: { name: "" } };
      return;
    }
    listing.value = [...((await ok(await childrenUrl("packages", id))).children || [])];
    const i = ancestors.value.findIndex((a) => a.content.id === id);
    if (i >= 0) {
      current.value = ancestors.value[i];
      ancestors.value = ancestors.value.slice(0, i);
    }
  } catch (err) {
    console.error("Failed to navigate breadcrumb:", err);
  }
}
// The table keeps what's ticked per folder in the store; files are all of it.
function onSelect(selected, parentId) {
  store.commit("analysisModule/SET_SELECTED_FILES", { selectedFiles: selected, parentId: parentId || "root" });
  const all = [];
  const byFolder = store.state.analysisModule.selectedFilesForAnalysis;
  for (const pid in byFolder) all.push(...byFolder[pid]);
  files.value = all;
}
// Where views don't take workspace files, records replace the files.
watch(models, (m) => {
  if (filesWithRecords || !m.length) return;
  files.value = [];
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  store.commit("analysisModule/CLEAR_SELECTED_FILES");
});
</script>

<template>
  <div class="wdp">
    <template v-if="!dataset">
      <el-input v-model="query" placeholder="Search datasets..." clearable @input="onSearch" />
      <div class="wdp__datasets pp-list">
        <div v-if="searching" class="wdp__muted">Searching...</div>
        <button v-for="ds in datasets" :key="ds.content?.id" type="button" class="wdp__dataset" @click="open(ds)">
          <strong>{{ ds.content?.name }}</strong>
          <span v-if="ds.content?.description" class="wdp__muted">{{ ds.content.description }}</span>
        </button>
        <div v-if="!searching && !datasets.length" class="wdp__muted">No datasets found</div>
      </div>
    </template>
    <template v-else>
      <div class="wdp__chosen">
        <div class="wdp__chosen-text">
          <strong>{{ dataset.content?.name }}</strong>
          <span v-if="dataset.content?.description" class="wdp__muted">{{ dataset.content.description }}</span>
        </div>
        <el-button size="small" @click="clear">Change dataset</el-button>
      </div>
      <MetadataRecordsChoice
        v-if="available.length"
        v-model="models"
        :available="available"
        :hint="filesWithRecords ? 'Its records and the links between them, as they are when the session starts, with the files you choose below.' : 'Its records and the links between them, as they are when the session starts, instead of its files.'"
      />
      <p v-if="models.length && !filesWithRecords" class="wdp__muted">
        The notebook takes the dataset's metadata records. Untick them to choose its files instead.
      </p>
      <div v-else-if="loadingFiles && atTop" class="wdp__muted">Loading files…</div>
      <div v-else-if="noFiles" class="wdp__empty">
        <strong>No files in this dataset</strong>
        <span class="wdp__muted">
          {{ available.length ? "Its metadata records above are what the notebook starts with." : "Choose another dataset, or start without data." }}
        </span>
      </div>
      <template v-else>
        <div class="wdp__count">
          <strong>{{ files.length }}</strong> file{{ files.length === 1 ? "" : "s" }} selected
        </div>
        <breadcrumb-navigation
          is-light-background
          :ancestors="ancestors"
          :file="current"
          :file-id="current?.content?.id"
          @navigate-breadcrumb="toCrumb"
        />
        <div v-if="!loadingFiles && !listing.length" class="wdp__muted wdp__empty-folder">This folder is empty</div>
        <div v-else class="wdp__files pp-list">
          <analysis-files-table :data="listing" @selection-change="onSelect" @click-file-label="openFolder" />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../styles/theme";

.wdp {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wdp__datasets {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow-y: auto;
}
.wdp__dataset {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  text-align: left;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    border-color: theme.$purple_3;
  }
}
// The dataset chosen, and the way to another.
.wdp__chosen {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid theme.$purple_3;
  border-radius: 4px;
  background: theme.$purple_tint;
}
.wdp__chosen-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.wdp__files {
  max-height: 320px;
  overflow-y: auto;
}
.wdp__empty {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
  text-align: center;
  border: 1px dashed theme.$gray_3;
  border-radius: 4px;
}
.wdp__empty-folder {
  padding: 16px 0;
}
.wdp__muted {
  color: theme.$gray_4;
  font-size: 13px;
}
</style>
