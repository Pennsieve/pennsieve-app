<script setup>
// Choosing CELLxGENE datasets (utils/cellxgene), several at once: the
// datasets of the Census release views-service offers, searched here by
// title, collection, tissue, assay or disease and narrowed by organism.
// Each is one .h5ad; a view takes the ones ticked. Used by the new notebook
// dialog and a running session's "Add data".
import { computed, onMounted, ref, watch } from "vue";
import {
  cellxgeneDatasets,
  searchCellxgene,
  cellxgeneOrganisms,
  cellxgeneCollectionUrl,
  CELLXGENE_MAX_PICKS,
} from "@/utils/cellxgene";

// What's ticked: [{ id, title, file, size, collectionId, collectionName }].
const picks = defineModel("picks", { type: Array, default: () => [] });

const catalog = ref(null); // { release, datasets }
const loading = ref(false);
const error = ref("");
const query = ref("");
const organism = ref("");
// The first matches; "Show more" adds more.
const PAGE = 100;
const shownCount = ref(PAGE);

const datasets = computed(() => catalog.value?.datasets || []);
const organisms = computed(() => cellxgeneOrganisms(datasets.value));
const results = computed(() => searchCellxgene(datasets.value, query.value, organism.value));
const shown = computed(() => results.value.slice(0, shownCount.value));
watch([query, organism], () => (shownCount.value = PAGE));

const pickedIds = computed(() => new Set(picks.value.map((p) => p.id)));
const full = computed(() => picks.value.length >= CELLXGENE_MAX_PICKS);
const pickedSize = computed(() => picks.value.reduce((n, p) => n + (p.size || 0), 0));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    catalog.value = await cellxgeneDatasets();
  } catch (err) {
    console.error("Failed to load the CELLxGENE datasets:", err);
    error.value = err?.status === 404 ? "CELLxGENE's datasets aren't available here yet." : "CELLxGENE's datasets couldn't be loaded.";
  } finally {
    loading.value = false;
  }
}

function toggle(d) {
  if (pickedIds.value.has(d.id)) picks.value = picks.value.filter((p) => p.id !== d.id);
  else if (!full.value) {
    const { id, title, file, size, collectionId, collectionName } = d;
    picks.value = [...picks.value, { id, title, file, size, collectionId, collectionName }];
  }
}
const remove = (id) => (picks.value = picks.value.filter((p) => p.id !== id));

const formatSize = (bytes) => {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
};
const cells = (n) => (n ? `${n.toLocaleString("en-US")} cells` : "");
const TERMS_SHOWN = 3;
const some = (list) => (list.length > TERMS_SHOWN ? `${list.slice(0, TERMS_SHOWN).join(", ")} +${list.length - TERMS_SHOWN}` : list.join(", "));

onMounted(() => {
  if (!catalog.value) load();
});
</script>

<template>
  <div class="cx-picker">
    <!-- What's ticked, to remove. -->
    <div v-if="picks.length" class="cx-picks">
      <span v-for="p in picks" :key="p.id" class="cx-pick" :title="p.collectionName">
        {{ p.title }}
        <button type="button" class="cx-pick__remove" :aria-label="`Remove ${p.title}`" @click="remove(p.id)">&times;</button>
      </span>
      <span class="cx-picks__note">
        {{ picks.length }} dataset{{ picks.length === 1 ? "" : "s" }} · {{ formatSize(pickedSize) }}{{ full ? ` · at most ${CELLXGENE_MAX_PICKS}` : "" }}
      </span>
    </div>

    <div class="cx-search">
      <el-input v-model="query" placeholder="Search by title, collection, tissue, disease..." clearable />
      <el-select v-model="organism" class="cx-search__organism" placeholder="Any organism" clearable>
        <el-option v-for="o in organisms" :key="o" :label="o" :value="o" />
      </el-select>
    </div>
    <p v-if="catalog" class="cx-count">
      {{ results.length.toLocaleString("en-US") }} dataset{{ results.length === 1 ? "" : "s" }} · Census
      {{ catalog.release }} · tick the ones to take
    </p>

    <div class="cx-cards pp-list">
      <div v-if="loading" class="cx-msg">Loading CELLxGENE's datasets…</div>
      <div v-else-if="error" class="cx-msg">{{ error }}</div>
      <label v-for="d in shown" :key="d.id" class="cx-row" :class="{ 'is-chosen': pickedIds.has(d.id) }">
        <input type="checkbox" :checked="pickedIds.has(d.id)" :disabled="!pickedIds.has(d.id) && full" @change="toggle(d)" />
        <span class="cx-card">
          <span class="cx-card__name">{{ d.title }}</span>
          <span class="cx-meta">
            <a :href="cellxgeneCollectionUrl(d.collectionId)" target="_blank" rel="noopener" @click.stop>{{ d.collectionName }}</a>
          </span>
          <span class="cx-meta">
            <span v-if="d.organisms.length">{{ some(d.organisms) }}</span>
            <span v-if="d.tissues.length">{{ some(d.tissues) }}</span>
            <span v-if="d.assays.length">{{ some(d.assays) }}</span>
          </span>
          <span class="cx-meta">
            <span v-if="d.cellCount">{{ cells(d.cellCount) }}</span>
            <span v-if="d.size">{{ formatSize(d.size) }}</span>
            <span v-if="d.diseases.length && !(d.diseases.length === 1 && d.diseases[0] === 'normal')">{{ some(d.diseases) }}</span>
          </span>
        </span>
      </label>
      <div v-if="catalog && !results.length" class="cx-msg">No CELLxGENE datasets found</div>
      <button v-else-if="results.length > shown.length" type="button" class="cx-more" @click="shownCount += PAGE">
        Show more ({{ (results.length - shown.length).toLocaleString("en-US") }} left)
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.cx-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  max-height: 84px;
  overflow-y: auto;
}
.cx-pick {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 4px 2px 8px;
  border-radius: 12px;
  background: theme.$purple_tint;
  font-size: 12px;
  color: theme.$gray_6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cx-pick__remove {
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
.cx-picks__note {
  font-size: 12px;
  color: theme.$gray_4;
}
.cx-search {
  display: flex;
  gap: 8px;
}
.cx-search__organism {
  width: 180px;
  flex-shrink: 0;
}
.cx-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.cx-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.cx-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
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
.cx-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.cx-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  overflow-wrap: anywhere;
}
.cx-meta {
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
.cx-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.cx-more {
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
</style>
