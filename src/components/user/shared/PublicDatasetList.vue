<template>
  <!-- As the Apps tab and My Code: the filters on the left, the search and
       Sort in one row, the chips and cards -->
  <div class="public-datasets">
    <FacetLayout
      storage-key="pennsieve.publicDatasets.filtersPanel"
      default-folded
      :chips="chips"
      @remove="removeChip"
      @clear-all="clearFacets"
    >
      <!-- As Analysis's views and My Code: what's listed on the left, the
           page's action on the right (propose a dataset of your own for
           publication), over the search and Sort -->
      <template #intro>
        <ContentIntro
          :text="canOpenNotebook
            ? 'Read-only datasets published to Pennsieve Discover: browse one, or open it in a notebook to work with its files on your own compute node.'
            : 'Read-only datasets published to Pennsieve Discover: open one to browse its files.'"
        >
          <template #actions>
            <bf-button @click="submitDataset">+ Submit a Dataset</bf-button>
          </template>
        </ContentIntro>
      </template>

      <template #filters>
        <FacetSection
          v-for="s in sections"
          :key="s.key"
          :title="s.title"
          :clearable="state.filters[s.key].length > 0"
          @clear="state.filters[s.key] = []"
        >
          <FacetOptions
            :options="s.options"
            :selected="state.filters[s.key]"
            :variant="s.key === 'tag' ? 'chips' : 'list'"
            :limit="s.key === 'tag' ? TAG_CHIPS : 5"
            @toggle="(k) => toggle(s.key, k)"
          />
        </FacetSection>
      </template>

      <template #toolbar>
        <el-input
          v-model="state.search"
          placeholder="Search public datasets…"
          clearable
          class="toolbar-search"
        />
        <label class="sort-control toolbar-sort">
          Sort
          <el-select v-model="state.sort" class="sort-select">
            <el-option v-for="o in sortChoices(state.search)" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </label>
      </template>

      <div v-if="filtered.length > 0" class="dataset-grid">
        <!-- A card: the dataset's banner on the left; what it is, who made
             it and its files on the right; Open and Notebook. -->
        <div
          v-for="dataset in paged"
          :key="dataset.id"
          class="ds-card"
          role="link"
          tabindex="0"
          @click="openDataset(dataset)"
          @keydown.enter="openDataset(dataset)"
        >
          <div class="ds-thumb">
            <img v-if="dataset.banner" :src="dataset.banner" :alt="`${dataset.name} banner`" />
            <IconCompass v-else :width="28" :height="28" color="currentColor" />
          </div>
          <div class="ds-body">
            <div class="ds-title">
              <span class="ds-name" :title="dataset.name">{{ dataset.name }}</span>
              <span v-if="dataset.version" class="ds-version">v{{ dataset.version }}</span>
            </div>
            <div v-if="cardByline(dataset)" class="ds-byline">{{ cardByline(dataset) }}</div>
            <p class="ds-description">{{ dataset.description || "No description." }}</p>
            <CardTags v-if="dataset.tags.length" :tags="dataset.tags" />
            <div class="ds-foot">
              <span class="ds-facts">{{ cardFacts(dataset) }}</span>
              <span class="ds-actions" @click.stop>
                <button type="button" class="ds-action" @click="openDataset(dataset)">Open</button>
                <button
                  v-if="canOpenNotebook"
                  type="button"
                  class="ds-action ds-action--notebook"
                  @click="router.push(notebookRoute(dataset))"
                >
                  ▶ Notebook
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <IconCompass :width="48" :height="48" color="#9ca3af" />
        <span v-if="loading">Loading public datasets…</span>
        <span v-else-if="error">Unable to load public datasets. Please try again.</span>
        <span v-else-if="state.search.trim()">
          No public datasets match <strong>"{{ state.search.trim() }}"</strong>
        </span>
        <span v-else-if="datasets.length">No public datasets match your filters</span>
        <span v-else>There are no public datasets to show right now.</span>
        <button v-if="filtersSet" type="button" class="clear-filters" @click="clearFilters">
          Clear search and filters
        </button>
      </div>

      <el-pagination
        v-if="filtered.length > PAGE_SIZE"
        class="datasets-pagination"
        :page-size="PAGE_SIZE"
        :pager-count="5"
        :current-page="state.page"
        layout="prev, pager, next"
        :total="filtered.length"
        @current-change="state.page = $event"
      />
    </FacetLayout>
  </div>
</template>

<script>
import { reactive } from "vue";
import { emptyFilters } from "./publicDatasetGallery";

// The search, sort, filters and page, kept while the user opens a dataset
// and comes back (the page is remounted).
const kept = reactive({ search: "", sort: "newest", sortTouched: false, filters: emptyFilters(), page: 1 });
// The last list loaded, by its search and sort: coming back shows it at once.
const cache = { key: "", datasets: [] };
</script>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import FacetLayout from "@/components/Analysis/Facets/FacetLayout.vue";
import ContentIntro from '@/components/shared/ContentIntro/ContentIntro.vue';
import FacetSection from "@/components/Analysis/Facets/FacetSection.vue";
import FacetOptions from "@/components/Analysis/Facets/FacetOptions.vue";
import CardTags from "@/components/Analysis/Facets/CardTags.vue";
import { toggleKey } from "@/components/Analysis/Facets/facets";
import IconCompass from "@/components/icons/IconCompass.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { viewsServiceUrl } from "@/utils/viewsService";
import { listPublicDatasets, notebookRoute } from "@/utils/publicDatasets";
import {
  FILTER_SECTIONS,
  sortOrder,
  sortChoices,
  sortDatasets,
  facetOptions,
  filterDatasets,
  filterChips,
  cardFacts,
  cardByline,
} from "./publicDatasetGallery";

const router = useRouter();
const state = kept;
const PAGE_SIZE = 20;
// Tags, as a cloud: a dozen, then up to 40 of the most used on "Show more"
// (many are one-offs; the search finds those), and those chosen.
const TAG_CHIPS = 12;
const TAG_LIMIT = 40;

// Each card opens its dataset's latest version in a notebook, where the
// site has views-service (PublicDatasetOverview's "Open in notebook").
const canOpenNotebook = !!viewsServiceUrl();

/* ------------------------------------------------------------- the list ---- */
// Discover searches and sorts; the page filters, counts and pages.
const datasets = ref(cache.datasets);
const loading = ref(false);
const error = ref(false);
let loadId = 0;
async function load() {
  const order = sortOrder(state.sort);
  const query = state.search.trim();
  const key = JSON.stringify([query, order.orderBy, order.orderDirection]);
  if (key === cache.key) return;
  const id = ++loadId;
  loading.value = true;
  error.value = false;
  try {
    const list = await listPublicDatasets({ query, orderBy: order.orderBy, orderDirection: order.orderDirection });
    if (id !== loadId) return;
    datasets.value = list;
    Object.assign(cache, { key, datasets: list });
  } catch (err) {
    if (id !== loadId) return;
    console.error("Failed to load public datasets:", err);
    error.value = true;
    datasets.value = [];
  } finally {
    if (id === loadId) loading.value = false;
  }
}
onMounted(load);

// A search reloads once typing stops; with one, the best matches come
// first unless the user chose a sort (and without one, Best match goes).
let searchTimer = null;
let sortBySearch = false;
const setSortForSearch = (sort) => {
  if (state.sort === sort) return;
  sortBySearch = true;
  state.sort = sort;
};
watch(
  () => state.search,
  (q, before) => {
    const has = !!q.trim();
    if (has !== !!(before || "").trim() && !state.sortTouched) setSortForSearch(has ? "relevance" : "newest");
    if (!has && state.sort === "relevance") setSortForSearch("newest");
    state.page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 300);
  }
);
watch(
  () => state.sort,
  () => {
    // A change the search made isn't the user's choice.
    if (!sortBySearch) state.sortTouched = true;
    sortBySearch = false;
    state.page = 1;
    load();
  }
);

/* ---------------------------------------------------------- the filters ---- */
const sections = computed(() =>
  FILTER_SECTIONS.map((s) => ({
    ...s,
    options: facetOptions(datasets.value, s.key, {
      limit: s.key === "tag" ? TAG_LIMIT : Infinity,
      selected: state.filters[s.key],
    }),
  })).filter((s) => s.options.length)
);
const toggle = (section, key) => {
  state.filters[section] = toggleKey(state.filters[section], key);
};
const chips = computed(() => filterChips(state.filters, datasets.value));
const removeChip = ({ key, value }) => {
  state.filters[key] = state.filters[key].filter((k) => k !== value);
};
// Clear all resets the filters (the search stays: it's in the toolbar).
const clearFacets = () => {
  state.filters = emptyFilters();
};
const filtersSet = computed(() => !!state.search.trim() || chips.value.length > 0);
function clearFilters() {
  state.search = "";
  clearFacets();
}

const filtered = computed(() => sortDatasets(filterDatasets(datasets.value, state.filters), state.sort));
watch(() => state.filters, () => (state.page = 1), { deep: true });
const paged = computed(() => {
  const start = (state.page - 1) * PAGE_SIZE;
  return filtered.value.slice(start, start + PAGE_SIZE);
});

// Data Publishing, its new-proposal dialog open.
const submitDataset = () => router.push({ name: "data-publishing", query: { openSubmitModal: "true" } });

const openDataset = (dataset) => {
  router.push({ name: "public-dataset-overview", params: { datasetId: dataset.id } });
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/element/input";
@use "../../../styles/element/pagination";

/* As the Apps tab: no padding of its own (the filter panel sits against
   the page's edges; FacetLayout pads the list). */
.public-datasets {
  min-height: 100%;
  background: theme.$white;
}

/* The search fills the toolbar's row up to Sort. */
.toolbar-search {
  flex: 1;
  min-width: 0;
}
.sort-control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: theme.$gray_5;
}
.sort-select {
  width: 150px;
}
@media (max-width: 767px) {
  /* The select alone says what it sorts by. */
  .toolbar-sort {
    font-size: 0;
  }
  .sort-select {
    width: 130px;
  }
}

/* Cards two or more to a row where 340px each fit, each as tall as its
   square banner (172px; 140px in a narrow card), as the Apps and
   Workflows cards: the rows line up, and the text fits the card. */
$card-height: 172px;
.dataset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
  gap: 16px;
}
.ds-card {
  display: flex;
  min-width: 0;
  container: ds-card / inline-size;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    outline: none;
  }
  &:hover .ds-actions,
  &:focus-within .ds-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
/* The banner, edge to edge; a compass on grey without one. */
.ds-thumb {
  display: flex;
  flex: 0 0 auto;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  width: $card-height;
  aspect-ratio: 1 / 1;
  border-right: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  color: theme.$gray_3;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
/* A narrow card: a smaller square, tighter text, one line of
   description (a dataset's card has a byline more than an app's). */
@container ds-card (max-width: 440px) {
  .ds-thumb {
    width: 140px;
  }
  .ds-body {
    padding: 10px 12px;
  }
  .ds-body .ds-description {
    -webkit-line-clamp: 1;
  }
}
/* The text fits the banner's height: it doesn't size the card (contain),
   and what doesn't fit is cut, never the card stretched. */
.ds-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
  padding: 14px 16px 12px;
  contain: size;
  overflow: hidden;
}
.ds-title {
  display: flex;
  flex-shrink: 0;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.ds-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.ds-version {
  flex-shrink: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.ds-byline {
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
  color: theme.$purple_3;
}
/* Two lines where the card has room (one in a narrow one): with the title,
   byline, tags and foot, what fits the banner's height. Should a line still
   not fit, the description gives way, never the foot. */
.ds-description {
  display: -webkit-box;
  flex-shrink: 1;
  min-height: 0;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
}
/* One line at the card's foot: the facts give way (…) to the buttons,
   shown over their end on hover (in the line on a touch screen). */
.ds-foot {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  // As tall as its buttons, which show over it on hover.
  min-height: 24px;
  margin-top: auto;
}
.ds-facts {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_4;
}
.ds-actions {
  position: absolute;
  right: 0;
  display: flex;
  gap: 6px;
  padding-left: 12px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0), theme.$white 12px);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.ds-action {
  white-space: nowrap;
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.ds-action--notebook {
  border-color: theme.$purple_3;
  background: theme.$purple_3;
  color: theme.$white;

  &:hover {
    background: theme.$purple_2;
    color: theme.$white;
  }
}
@media (hover: none) {
  .ds-actions {
    position: static;
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 0;
    background: none;
    pointer-events: auto;
    opacity: 1;
  }
}

.datasets-pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  --el-pagination-hover-color: #{theme.$purple_3};
}

.empty-state {
  text-align: center;
  padding: 32px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  color: theme.$gray_5;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.clear-filters {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$link-color;
  cursor: pointer;

  &:hover {
    color: theme.$link-color-hover;
  }
}
</style>
