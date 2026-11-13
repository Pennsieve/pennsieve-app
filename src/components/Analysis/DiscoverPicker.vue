<script setup>
// Choosing a published dataset of Pennsieve Discover and its version, read
// anonymously as on the public dataset pages; only openly published
// versions are offered (views take no embargoed ones). A view of it is made
// from these (viewsService viewForDataset). Used by the new notebook dialog
// and the running session's Inputs panel.
import { onMounted, ref, watch } from "vue";
import * as siteConfig from "@/site-config/site.json";
import { useSendXhr } from "@/mixins/request/request_composable";
import { pagePublicDatasets, listPublicModels } from "@/utils/publicDatasets";
import IconCompass from "@/components/icons/IconCompass.vue";
import MetadataRecordsChoice from "./MetadataRecordsChoice.vue";

// The chosen dataset ({ id, name, version, doi, fileCount, size, ... }) and
// version, and the metadata models whose records the notebook gets with
// the files (names; none for no records).
const dataset = defineModel("dataset", { default: null });
const version = defineModel("version", { default: null });
const models = defineModel("models", { default: () => [] });

// The models the chosen version publishes records of, when it does.
const availableModels = ref([]);
let modelsSeq = 0;
// A choice already made (the picker remounts between the dialog's steps)
// is kept as far as the version has those models.
async function loadModels() {
  const seq = ++modelsSeq;
  availableModels.value = [];
  if (!dataset.value || version.value == null) {
    models.value = [];
    return;
  }
  const found = await listPublicModels({ id: dataset.value.id, version: version.value });
  if (seq !== modelsSeq) return;
  availableModels.value = found;
  models.value = models.value.filter((m) => found.includes(m));
}
// A preset selection (a notebook opened from a dataset) loads its models
// too.
watch([dataset, version], () => loadModels(), { immediate: true });

const publicQuery = ref("");
const publicResults = ref([]);
// How many datasets the query matches in all: the list pages through them.
const publicTotal = ref(0);
const publicLoading = ref(false);
const publicVersions = ref([]);
let publicSearchTimer = null;
let publicSearchSeq = 0;

// The results of a query, or (more) its next page added to the ones
// shown. A later search's answer is never taken for an earlier one's.
async function searchPublicDatasets(query = "", more = false) {
  const seq = ++publicSearchSeq;
  publicLoading.value = true;
  try {
    const page = await pagePublicDatasets({ query, offset: more ? publicResults.value.length : 0 });
    if (seq !== publicSearchSeq) return;
    publicResults.value = more ? [...publicResults.value, ...page.datasets] : page.datasets;
    publicTotal.value = page.totalCount;
  } catch (err) {
    console.error("Failed to search public datasets:", err);
    if (seq !== publicSearchSeq) return;
    if (!more) publicResults.value = [];
    publicTotal.value = publicResults.value.length;
  } finally {
    if (seq === publicSearchSeq) publicLoading.value = false;
  }
}
const publicMore = () => searchPublicDatasets(publicQuery.value, true);

const onPublicSearch = () => {
  clearTimeout(publicSearchTimer);
  publicSearchTimer = setTimeout(() => searchPublicDatasets(publicQuery.value), 300);
};

async function selectPublicDataset(d) {
  dataset.value = d;
  version.value = d.version;
  publicVersions.value = [d.version];
  try {
    const url = `${siteConfig.discoverUrl}/datasets/${d.id}/versions`;
    const response = await useSendXhr(url, { method: "GET" });
    const versions = (Array.isArray(response) ? response : [])
      .map((v) => v.version)
      .filter((v) => Number.isInteger(v))
      .sort((a, b) => b - a);
    if (versions.length) publicVersions.value = versions;
  } catch (err) {
    console.error("Failed to load the dataset's versions:", err);
  }
}

function clearPublicDataset() {
  dataset.value = null;
  version.value = null;
  publicVersions.value = [];
}

onMounted(() => searchPublicDatasets());

const formatSize = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
</script>

<template>
  <div class="discover-picker">
  <div v-if="dataset" class="wizard-selection public-selection">
    <div class="public-row">
      <div class="public-banner">
        <img v-if="dataset.banner" :src="dataset.banner" alt="" />
        <div v-else class="public-banner-placeholder">
          <IconCompass :width="20" :height="20" color="#b3bcce" />
        </div>
      </div>
      <div class="public-info">
        <div class="wizard-selection-header">
          <span class="wizard-selection-name">{{ dataset.name }}</span>
          <button class="wizard-selection-clear" @click="clearPublicDataset">
            &times;
          </button>
        </div>
        <div v-if="dataset.authors" class="public-authors">
          {{ dataset.authors }}
        </div>
        <div v-if="dataset.organizationName" class="public-org">
          {{ dataset.organizationName }}
        </div>
        <div class="public-meta">
          <span>{{ dataset.fileCount }} files</span>
          <span>{{ formatSize(dataset.size) }}</span>
          <span v-if="dataset.doi">DOI {{ dataset.doi }}</span>
        </div>
      </div>
    </div>
    <div class="public-version">
      <label class="resource-label">Version</label>
      <el-select v-model="version" size="small" style="width: 140px">
        <el-option
          v-for="v in publicVersions"
          :key="v"
          :label="`Version ${v}`"
          :value="v"
        />
      </el-select>
    </div>
    <MetadataRecordsChoice v-model="models" :available="availableModels" class="public-records" />
  </div>
  <template v-else>
    <el-input
      v-model="publicQuery"
      placeholder="Search public datasets..."
      clearable
      class="wizard-search"
      @input="onPublicSearch"
    />
    <div class="wizard-cards pp-list">
      <div v-if="publicLoading" class="wizard-cards-loading">Searching...</div>
      <div
        v-for="ds in publicResults"
        :key="ds.id"
        class="wizard-card public-row"
        @click="selectPublicDataset(ds)"
      >
        <div class="public-banner">
          <img v-if="ds.banner" :src="ds.banner" alt="" loading="lazy" />
          <div v-else class="public-banner-placeholder">
            <IconCompass :width="20" :height="20" color="#b3bcce" />
          </div>
        </div>
        <div class="public-info">
          <div class="wizard-card-name public-name">{{ ds.name }}</div>
          <div v-if="ds.authors" class="public-authors">{{ ds.authors }}</div>
          <div v-if="ds.organizationName" class="public-org">
            {{ ds.organizationName }}
          </div>
          <div class="public-meta">
            <span>Version {{ ds.version }}</span>
            <span>{{ ds.fileCount }} files</span>
            <span>{{ formatSize(ds.size) }}</span>
          </div>
        </div>
      </div>
      <div v-if="!publicLoading && !publicResults.length" class="wizard-cards-loading">No published datasets match.</div>
      <div v-if="publicResults.length < publicTotal" class="public-more">
        <button type="button" class="text-link-btn" :disabled="publicLoading" @click="publicMore">
          {{ publicLoading ? "Loading…" : `Show more (${(publicTotal - publicResults.length).toLocaleString("en-US")} left)` }}
        </button>
      </div>
      <div
        v-if="!publicLoading && publicResults.length === 0"
        class="wizard-cards-loading"
      >
        No public datasets found
      </div>
    </div>
  </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.wizard-search {
  margin-bottom: 12px;
}
.wizard-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.wizard-card {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 12px 14px;
  background: theme.$white;
  cursor: pointer;
}
.wizard-card:hover {
  background: theme.$gray_1;
}
.wizard-card-name {
  font-weight: 600;
  font-size: 14px;
  color: theme.$gray_6;
}
.wizard-cards-loading {
  color: theme.$gray_4;
  font-size: 13px;
  padding: 12px 0;
}
.wizard-selection {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 12px 14px;
  background: theme.$white;
}
.wizard-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wizard-selection-name {
  font-weight: 600;
  color: theme.$gray_6;
}
.wizard-selection-clear {
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
  color: theme.$gray_4;
}
.public-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.wizard-card.public-row {
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    background: theme.$gray_1;
  }
}
.public-banner {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}
.public-banner-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.public-info {
  flex: 1;
  min-width: 0;
}
.public-name {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
}
.public-authors {
  font-size: 12px;
  color: theme.$gray_6;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.public-org {
  font-size: 12px;
  color: theme.$gray_5;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.public-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 4px;
}
.public-records {
  margin-top: 10px;
}
.public-more {
  padding: 8px 4px;
  text-align: center;
}
.public-selection .public-version {
  padding-left: 68px;
}
.public-version {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;

  .resource-label {
    margin-bottom: 0;
  }
}
.resource-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  margin-bottom: 6px;
}
</style>
