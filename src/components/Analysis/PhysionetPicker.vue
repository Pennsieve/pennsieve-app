<script setup>
// Choosing a PhysioNet project from the Open Data catalog's PhysioNet
// entries (utils/physionet), a version of it (its newest unless the user
// picks another), and the folder of that version to take. A view of it is
// made from these like any Open Data dataset's (viewsService
// createOpenDataView). Used by the new notebook dialog and a running
// session's "Add data".
import { computed, onMounted, ref } from "vue";
import { openDataCatalog, searchOpenData } from "@/utils/viewsService";
import { physionetProjects, physionetVersions, physionetUrl } from "@/utils/physionet";
import OpenDataFolders from "./OpenDataFolders.vue";

// The chosen project (a listOpenData entry) and folder: a version's
// ("1.0.0/") or one below it.
const dataset = defineModel("dataset", { default: null });
const prefix = defineModel("prefix", { type: String, default: "" });

const projects = ref([]);
const loading = ref(false);
const error = ref("");
const query = ref("");
const SHOWN = 50;
const results = computed(() => searchOpenData(projects.value, query.value).slice(0, SHOWN));
const found = computed(() => searchOpenData(projects.value, query.value).length);

const versions = ref([]);
const versionsLoading = ref(false);
const versionsError = ref("");
// The version shown: the first folder of the prefix.
const version = computed(() => prefix.value.split("/")[0] || "");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    projects.value = physionetProjects(await openDataCatalog());
  } catch (err) {
    console.error("Failed to load the PhysioNet projects:", err);
    error.value = "PhysioNet's projects couldn't be loaded.";
  } finally {
    loading.value = false;
  }
}

async function loadVersions(d) {
  versionsLoading.value = true;
  versionsError.value = "";
  try {
    const list = await physionetVersions(d.name);
    if (dataset.value !== d) return;
    versions.value = list;
    if (!version.value && list.length) prefix.value = `${list[0]}/`;
    if (!list.length) versionsError.value = "This project has no published versions to take.";
  } catch (err) {
    console.error("Failed to list the project's versions:", err);
    if (dataset.value === d) versionsError.value = err?.message || "The project's versions couldn't be listed.";
  } finally {
    if (dataset.value === d) versionsLoading.value = false;
  }
}

function choose(d) {
  dataset.value = d;
  prefix.value = "";
  versions.value = [];
  loadVersions(d);
}

function clear() {
  dataset.value = null;
  prefix.value = "";
  versions.value = [];
}

const pickVersion = (v) => (prefix.value = `${v}/`);

const TAGS_SHOWN = 3;
// The registry's tags for a project, without the ones every one has.
const COMMON_TAGS = new Set(["aws-pds", "life sciences", "health", "medicine"]);
const tagsOf = (d) => d.keywords.filter((k) => !COMMON_TAGS.has(k.toLowerCase())).slice(0, TAGS_SHOWN);

onMounted(() => {
  if (!projects.value.length) load();
  if (dataset.value) loadVersions(dataset.value);
});
</script>

<template>
  <div class="pn-picker">
    <!-- The project chosen: its header and version, then its folders. -->
    <div v-if="dataset" class="pn-selected">
      <div class="pn-head">
        <div class="pn-head__text">
          <div class="pn-head__name">{{ dataset.title }}</div>
          <div class="pn-meta">
            <a :href="physionetUrl(dataset.name)" target="_blank" rel="noopener">physionet.org/content/{{ dataset.name }}</a>
            <span v-if="dataset.regions.length">{{ dataset.regions.join(", ") }}</span>
          </div>
        </div>
        <el-select
          v-if="versions.length"
          :model-value="version"
          class="pn-head__version"
          size="small"
          aria-label="Version"
          @update:model-value="pickVersion"
        >
          <el-option v-for="(v, i) in versions" :key="v" :label="i === 0 ? `${v} (latest)` : v" :value="v" />
        </el-select>
        <button type="button" class="pn-head__clear" title="Choose another project" aria-label="Choose another project" @click="clear">
          &times;
        </button>
      </div>
      <div v-if="versionsLoading" class="pn-msg">Listing its versions…</div>
      <div v-else-if="versionsError" class="pn-msg">{{ versionsError }}</div>
      <OpenDataFolders
        v-else-if="version"
        :key="version"
        class="pn-browser"
        :dataset="dataset.name"
        :root="`${version}/`"
        :root-label="`${dataset.name} ${version}`"
        v-model:prefix="prefix"
      />
    </div>

    <!-- Choosing one: its open projects, searched here. -->
    <template v-else>
      <el-input v-model="query" placeholder="Search PhysioNet..." clearable class="pn-search" />
      <p v-if="projects.length" class="pn-count">
        {{ found.toLocaleString("en-US") }} open-access project{{ found === 1 ? "" : "s" }}
      </p>
      <div class="pn-cards">
        <div v-if="loading" class="pn-msg">Loading PhysioNet's projects…</div>
        <div v-else-if="error" class="pn-msg">{{ error }}</div>
        <button v-for="d in results" :key="d.name" type="button" class="pn-card" @click="choose(d)">
          <span class="pn-card__name">{{ d.title }}</span>
          <span class="pn-meta">
            <span>{{ d.name }}</span>
            <span v-for="k in tagsOf(d)" :key="k">{{ k }}</span>
          </span>
          <span v-if="d.summary" class="pn-summary">{{ d.summary }}</span>
        </button>
        <div v-if="!loading && !error && !results.length" class="pn-msg">No PhysioNet projects found</div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.pn-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.pn-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.pn-card {
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

  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: theme.$gray_1;
  }
}
.pn-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pn-summary {
  font-size: 12px;
  line-height: 1.45;
  color: theme.$gray_5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.pn-meta {
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
.pn-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.pn-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid theme.$gray_2;
}
.pn-head__text {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.pn-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pn-head__version {
  flex-shrink: 0;
  width: 130px;
}
.pn-head__clear {
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
.pn-browser {
  margin-top: 12px;
}
</style>
