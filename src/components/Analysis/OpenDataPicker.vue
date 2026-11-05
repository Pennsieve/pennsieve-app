<script setup>
// Choosing a dataset of the Registry of Open Data on AWS, from views-service's
// catalog, and the folder of it to take: the whole dataset, or a folder
// opened one level at a time (the folder shown is the one chosen). A view of
// it is made from these (viewsService createOpenDataView). Used by the new
// notebook dialog and the running session's Inputs panel.
import { computed, onMounted, ref } from "vue";
import { openDataCatalog, searchOpenData } from "@/utils/viewsService";
import OpenDataFolders from "./OpenDataFolders.vue";

// The chosen dataset (a listOpenData entry) and folder ("" for all of it,
// else ending in /).
const dataset = defineModel("dataset", { default: null });
const prefix = defineModel("prefix", { type: String, default: "" });

const catalog = ref([]);
const openDataLoading = ref(false);
const openDataError = ref("");
const openDataQuery = ref("");
// The first matches; the search narrows the rest.
const OPEN_DATA_SHOWN = 50;
const openDataResults = computed(() => searchOpenData(catalog.value, openDataQuery.value).slice(0, OPEN_DATA_SHOWN));

async function loadOpenData() {
  openDataLoading.value = true;
  openDataError.value = "";
  try {
    catalog.value = await openDataCatalog();
  } catch (err) {
    console.error("Failed to load the Open Data catalog:", err);
    openDataError.value = "The AWS Open Data catalog couldn't be loaded.";
  } finally {
    openDataLoading.value = false;
  }
}

function clearOpenDataDataset() {
  dataset.value = null;
  prefix.value = "";
}

// A card's tile: the dataset's initials, as the registry has no images.
const initials = (title = "") =>
  title
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "OD";
const TAGS_SHOWN = 3;

onMounted(() => {
  if (!catalog.value.length) loadOpenData();
});
</script>

<template>
  <div class="open-data-picker">
    <!-- The dataset chosen: its header, then its folders, one level at a time. -->
    <div v-if="dataset" class="od-selected">
      <div class="od-head">
        <div class="od-head__text">
          <div class="od-head__name">{{ dataset.title }}</div>
          <div class="od-head__meta">
            <span v-if="dataset.publisher">{{ dataset.publisher }}</span>
            <a :href="dataset.url" target="_blank" rel="noopener">registry.opendata.aws/{{ dataset.name }}</a>
            <span v-if="dataset.regions.length">{{ dataset.regions.join(", ") }}</span>
          </div>
          <div v-if="dataset.keywords.length" class="od-tags">
            <span v-for="k in dataset.keywords.slice(0, TAGS_SHOWN)" :key="k" class="od-tag">{{ k }}</span>
          </div>
        </div>
        <button
          type="button"
          class="od-head__clear"
          title="Choose another dataset"
          aria-label="Choose another dataset"
          @click="clearOpenDataDataset"
        >
          &times;
        </button>
      </div>

      <OpenDataFolders class="od-browser" :dataset="dataset.name" :root-label="dataset.name" v-model:prefix="prefix" />
    </div>

    <!-- Choosing one: search the catalog. -->
    <template v-else>
      <el-input v-model="openDataQuery" placeholder="Search AWS Open Data..." clearable class="od-search" />
      <div class="od-cards">
        <div v-if="openDataLoading" class="od-msg">Loading the catalog…</div>
        <div v-else-if="openDataError" class="od-msg">{{ openDataError }}</div>
        <button
          v-for="d in openDataResults"
          :key="d.name"
          type="button"
          class="od-card"
          @click="dataset = d"
        >
          <span class="od-tile" aria-hidden="true">{{ initials(d.title) }}</span>
          <span class="od-info">
            <span class="od-card__name">{{ d.title }}</span>
            <span class="od-head__meta">
              <span v-if="d.publisher">{{ d.publisher }}</span>
              <span v-if="d.regions.length">{{ d.regions.join(", ") }}</span>
            </span>
            <span v-if="d.summary" class="od-summary">{{ d.summary }}</span>
            <span v-if="d.keywords.length" class="od-tags">
              <span v-for="k in d.keywords.slice(0, TAGS_SHOWN)" :key="k" class="od-tag">{{ k }}</span>
            </span>
          </span>
        </button>
        <div v-if="!openDataLoading && !openDataError && openDataResults.length === 0" class="od-msg">
          No AWS Open Data datasets found
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

/* Calm, as the rest of the platform: white, hairlines, 4px corners. */
.od-search {
  margin-bottom: 12px;
}
.od-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.od-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
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
.od-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.od-tile {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: theme.$teal_tint;
  color: theme.$teal_2;
  font-size: 13px;
  font-weight: 600;
}
.od-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.od-summary {
  font-size: 12px;
  line-height: 1.45;
  color: theme.$gray_5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.od-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.od-tag {
  padding: 1px 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 11px;
  line-height: 16px;
  color: theme.$gray_5;
}

/* The chosen dataset */
.od-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid theme.$gray_2;
}
.od-head__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.od-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.od-head__meta {
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
.od-head__clear {
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
.od-browser {
  margin-top: 12px;
}
.od-msg {
  padding: 8px 12px;
  font-size: 12px;
  color: theme.$gray_4;
}
</style>
