<script setup>
// Choosing a dataset of a data portal in the Registry of Open Data on AWS
// (SPARC or Epilepsy.Science, utils/openDataPortals), and the folder of it
// to take: its folder in the portal's bucket, or one below it. The bucket's
// folders are the datasets, described by their manifests; words search
// them with Discover. A view of it is made from these like any Open Data
// dataset's (viewsService createOpenDataView). Used by the new notebook
// dialog and the running session's Inputs panel.
import { computed, onMounted, ref } from "vue";
import { OPEN_DATA_PORTALS, portalDataset, portalDatasetIds, searchPortal } from "@/utils/openDataPortals";
import { DATA_PLATFORMS } from "./dataPlatforms";
import OpenDataFolders from "./OpenDataFolders.vue";
import IconCompass from "@/components/icons/IconCompass.vue";

const props = defineProps({
  portal: { type: String, required: true }, // sparc | epilepsyScience
});

// The chosen dataset (a toPortalDataset) and folder: its folder ("704/")
// or one below it.
const dataset = defineModel("dataset", { default: null });
const prefix = defineModel("prefix", { type: String, default: "" });

const PAGE = 25;
const registry = computed(() => OPEN_DATA_PORTALS[props.portal].registry);
const portalName = computed(() => DATA_PLATFORMS[props.portal].name);

const ids = ref([]); // the bucket's datasets, newest first
const matches = ref([]); // the ids the search leaves, in order
const shown = ref(PAGE);
const described = ref({}); // id -> its dataset, or null when it has no manifest
const query = ref("");
const loading = ref(false);
const error = ref("");
let seq = 0;
let timer = null;

const results = computed(() =>
  matches.value
    .slice(0, shown.value)
    .map((id) => described.value[id])
    .filter(Boolean)
);
const describing = computed(() => matches.value.slice(0, shown.value).some((id) => !(id in described.value)));

// The manifests of the datasets on show, read once each.
async function describe(list) {
  await Promise.all(
    list
      .filter((id) => !(id in described.value))
      .map((id) =>
        portalDataset(props.portal, id)
          .then((d) => (described.value = { ...described.value, [id]: d }))
          .catch(() => (described.value = { ...described.value, [id]: null }))
      )
  );
}

async function search() {
  const mine = ++seq;
  loading.value = true;
  error.value = "";
  try {
    if (!ids.value.length) ids.value = await portalDatasetIds(props.portal);
    const found = await searchPortal(query.value, ids.value);
    if (mine !== seq) return;
    matches.value = found;
    shown.value = PAGE;
    await describe(found.slice(0, PAGE));
  } catch (err) {
    console.error(`Failed to list ${portalName.value}:`, err);
    if (mine === seq) {
      matches.value = [];
      error.value = `${portalName.value} couldn't be listed just now.`;
    }
  } finally {
    if (mine === seq) loading.value = false;
  }
}

function more() {
  shown.value += PAGE;
  describe(matches.value.slice(0, shown.value));
}

const onQuery = () => {
  clearTimeout(timer);
  timer = setTimeout(() => search(), 400);
};
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
  if (!matches.value.length) search();
}

// A dataset's banner is a .jpg or a .png: the next is tried when one isn't
// there, and the placeholder shows when neither is.
const bannerTry = ref({}); // id -> which of its banners
const bannerOf = (d) => d.banners[bannerTry.value[d.id] || 0] || "";
const nextBanner = (d) => (bannerTry.value = { ...bannerTry.value, [d.id]: (bannerTry.value[d.id] || 0) + 1 });
</script>

<template>
  <div class="pp-picker">
    <!-- The dataset chosen: its header, then its folders. -->
    <div v-if="dataset" class="pp-selected">
      <div class="pp-head">
        <div class="pp-banner">
          <img v-if="bannerOf(dataset)" :src="bannerOf(dataset)" alt="" @error="nextBanner(dataset)" />
          <IconCompass v-else :width="20" :height="20" color="#b3bcce" />
        </div>
        <div class="pp-head__text">
          <div class="pp-head__name">{{ dataset.name }}</div>
          <div v-if="dataset.authors" class="pp-authors">{{ dataset.authors }}</div>
          <div class="pp-meta">
            <span>Dataset {{ dataset.id }}</span>
            <span v-if="dataset.version">version {{ dataset.version }}</span>
            <span v-if="dataset.organization">{{ dataset.organization }}</span>
            <a v-if="dataset.doi" :href="`https://doi.org/${dataset.doi}`" target="_blank" rel="noopener">DOI {{ dataset.doi }}</a>
          </div>
        </div>
        <button type="button" class="pp-head__clear" title="Choose another dataset" aria-label="Choose another dataset" @click="clear">
          &times;
        </button>
      </div>
      <OpenDataFolders
        class="pp-browser"
        :dataset="registry"
        :root="`${dataset.id}/`"
        :root-label="`Dataset ${dataset.id}`"
        v-model:prefix="prefix"
      />
    </div>

    <!-- Choosing one: the bucket's datasets, or those the words find. -->
    <template v-else>
      <el-input v-model="query" :placeholder="`Search ${portalName}...`" clearable @input="onQuery" @clear="search()" />
      <p v-if="!loading && !error && ids.length" class="pp-count">
        {{ query.trim() ? `${matches.length.toLocaleString("en-US")} of ` : "" }}{{ ids.length.toLocaleString("en-US") }} datasets
      </p>
      <div class="pp-cards">
        <button v-for="d in results" :key="d.id" type="button" class="pp-card" @click="choose(d)">
          <span class="pp-banner">
            <img v-if="bannerOf(d)" :src="bannerOf(d)" alt="" loading="lazy" @error="nextBanner(d)" />
            <IconCompass v-else :width="20" :height="20" color="#b3bcce" />
          </span>
          <span class="pp-card__text">
            <span class="pp-card__name">{{ d.name }}</span>
            <span v-if="d.authors" class="pp-authors">{{ d.authors }}</span>
            <span class="pp-meta">
              <span>Dataset {{ d.id }}</span>
              <span v-if="d.organization">{{ d.organization }}</span>
              <span v-if="d.published">{{ d.published }}</span>
            </span>
          </span>
        </button>
        <div v-if="loading || describing" class="pp-msg">Loading datasets…</div>
        <div v-else-if="error" class="pp-msg">{{ error }}</div>
        <div v-else-if="!results.length" class="pp-msg">No {{ portalName }} datasets found</div>
        <button v-else-if="matches.length > shown" type="button" class="pp-more" @click="more">More datasets</button>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.pp-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.pp-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  margin-top: 8px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.pp-count + .pp-cards {
  margin-top: 0;
}
.pp-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
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
.pp-card__text,
.pp-head__text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.pp-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pp-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$gray_1;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.pp-authors {
  font-size: 12px;
  color: theme.$gray_5;
}
.pp-meta {
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
.pp-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.pp-more {
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
.pp-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid theme.$gray_2;
}
.pp-head__text {
  flex: 1;
}
.pp-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.pp-head__clear {
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
.pp-browser {
  margin-top: 12px;
}
</style>
