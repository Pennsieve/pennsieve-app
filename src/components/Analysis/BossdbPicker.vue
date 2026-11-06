<script setup>
// Choosing a BossDB volume with BossDB's API (utils/bossdb): a collection,
// then one of its experiments (described), then one of its channels stored
// in the Open Data bucket. The notebook takes that channel's folder of the
// bossdb entry, which views-service takes whole as a precomputed volume,
// read in place. Used by the new notebook dialog and the running session's
// Inputs panel.
import { computed, onMounted, ref } from "vue";
import { bossdbCollections, searchBossdb, bossdbExperiments, bossdbChannels, bossdbUrl } from "@/utils/bossdb";

// The chosen volume ({ collection, experiment, channel, name, description,
// type, datatype }) and its folder in the bucket (prefix, ending in /).
const dataset = defineModel("dataset", { default: null });
const prefix = defineModel("prefix", { type: String, default: "" });

const collections = ref([]);
const query = ref("");
const collection = ref("");
const experiments = ref([]);
const experiment = ref(null);
const channels = ref([]);
const loading = ref("");
const error = ref("");
let seq = 0;

const shown = computed(() => searchBossdb(collections.value, query.value));

async function run(what, fn) {
  const mine = ++seq;
  loading.value = what;
  error.value = "";
  try {
    await fn(() => mine === seq);
  } catch (err) {
    console.error(`Failed to read BossDB (${what}):`, err);
    if (mine === seq) error.value = "BossDB couldn't be read just now.";
  } finally {
    if (mine === seq) loading.value = "";
  }
}

function loadCollections() {
  run("collections", async (current) => {
    const list = await bossdbCollections();
    if (current()) collections.value = list;
  });
}
onMounted(() => {
  if (!dataset.value) loadCollections();
});

function openCollection(name) {
  collection.value = name;
  experiment.value = null;
  experiments.value = [];
  run("experiments", async (current) => {
    const list = await bossdbExperiments(name);
    if (current()) experiments.value = list;
  });
}

function openExperiment(e) {
  experiment.value = e;
  channels.value = [];
  run("channels", async (current) => {
    const list = await bossdbChannels(collection.value, e.name, e.channels);
    if (current()) channels.value = list;
  });
}

function choose(ch) {
  dataset.value = {
    collection: collection.value,
    experiment: experiment.value.name,
    channel: ch.name,
    name: `${collection.value} · ${experiment.value.name} · ${ch.name}`,
    description: experiment.value.description,
    type: ch.type,
    datatype: ch.datatype,
  };
  prefix.value = ch.path;
}

// Back up a level: from the volume chosen to its collection's experiments.
function up(to) {
  if (dataset.value) {
    const name = dataset.value.collection;
    dataset.value = null;
    prefix.value = "";
    openCollection(name);
    return;
  }
  if (to === "collections") {
    collection.value = "";
    experiment.value = null;
    if (!collections.value.length) loadCollections();
  } else if (to === "experiments") {
    experiment.value = null;
  }
}
</script>

<template>
  <div class="bd-picker">
    <!-- The volume chosen. -->
    <div v-if="dataset" class="bd-head">
      <div class="bd-head__text">
        <div class="bd-head__name">{{ dataset.name }}</div>
        <div v-if="dataset.description" class="bd-desc">{{ dataset.description }}</div>
        <div class="bd-meta">
          <a :href="bossdbUrl(dataset.collection)" target="_blank" rel="noopener">bossdb.org/project/{{ dataset.collection }}</a>
          <span v-if="dataset.type">{{ dataset.type }}</span>
          <span v-if="dataset.datatype">{{ dataset.datatype }}</span>
          <span>{{ prefix }}</span>
        </div>
        <p class="bd-note">
          A Neuroglancer precomputed volume: the notebook reads it in place (CloudVolume),
          without downloading it.
        </p>
      </div>
      <button type="button" class="bd-head__clear" title="Choose another volume" aria-label="Choose another volume" @click="up()">
        &times;
      </button>
    </div>

    <template v-else>
      <nav class="bd-crumbs" aria-label="BossDB">
        <button type="button" class="bd-crumb" :class="{ 'is-current': !collection }" @click="up('collections')">Collections</button>
        <template v-if="collection">
          <span class="bd-crumbs__sep">/</span>
          <button type="button" class="bd-crumb" :class="{ 'is-current': !experiment }" @click="up('experiments')">{{ collection }}</button>
        </template>
        <template v-if="experiment">
          <span class="bd-crumbs__sep">/</span>
          <span class="bd-crumb is-current">{{ experiment.name }}</span>
        </template>
      </nav>

      <!-- Collections. -->
      <template v-if="!collection">
        <el-input v-model="query" class="bd-search" placeholder="Search BossDB collections..." clearable />
        <p v-if="!loading && !error && collections.length" class="bd-count">
          {{ query.trim() ? `${shown.length} of ` : "" }}{{ collections.length }} collections
        </p>
        <div class="bd-cards">
          <button v-for="c in shown" :key="c" type="button" class="bd-card" @click="openCollection(c)">
            <span class="bd-card__name">{{ c }}</span>
          </button>
          <div v-if="loading" class="bd-msg">Loading BossDB…</div>
          <div v-else-if="error" class="bd-msg">{{ error }}</div>
          <div v-else-if="!shown.length" class="bd-msg">No BossDB collections found</div>
        </div>
      </template>

      <!-- A collection's experiments. -->
      <div v-else-if="!experiment" class="bd-cards">
        <button v-for="e in experiments" :key="e.name" type="button" class="bd-card" @click="openExperiment(e)">
          <span class="bd-card__name">{{ e.name }}</span>
          <span v-if="e.description" class="bd-desc">{{ e.description }}</span>
          <span class="bd-meta">
            <span>{{ e.channels.length }} channel{{ e.channels.length === 1 ? "" : "s" }}</span>
            <span v-if="e.levels">{{ e.levels }} resolution levels</span>
          </span>
        </button>
        <div v-if="loading" class="bd-msg">Loading experiments…</div>
        <div v-else-if="error" class="bd-msg">{{ error }}</div>
        <div v-else-if="!experiments.length" class="bd-msg">No experiments</div>
      </div>

      <!-- An experiment's channels in the Open Data bucket. -->
      <div v-else class="bd-cards">
        <p v-if="experiment.description" class="bd-desc bd-desc--lead">{{ experiment.description }}</p>
        <button v-for="ch in channels" :key="ch.name" type="button" class="bd-card" @click="choose(ch)">
          <span class="bd-card__name">{{ ch.name }}</span>
          <span class="bd-meta">
            <span v-if="ch.type">{{ ch.type }}</span>
            <span v-if="ch.datatype">{{ ch.datatype }}</span>
            <span>{{ ch.path }}</span>
          </span>
        </button>
        <div v-if="loading" class="bd-msg">Loading channels…</div>
        <div v-else-if="error" class="bd-msg">{{ error }}</div>
        <div v-else-if="!channels.length" class="bd-msg">None of this experiment's channels are in the Open Data bucket</div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.bd-crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 13px;
}
.bd-crumbs__sep {
  color: theme.$gray_3;
}
.bd-crumb {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: theme.$purple_2;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
  &.is-current {
    color: theme.$gray_6;
    font-weight: 600;
    cursor: default;
    text-decoration: none;
  }
}
.bd-count {
  margin: 8px 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.bd-search + .bd-cards {
  margin-top: 8px;
}
.bd-cards {
  display: flex;
  flex-direction: column;
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
.bd-count + .bd-cards {
  margin-top: 0;
}
.bd-card {
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
.bd-card__name {
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.bd-desc {
  font-size: 12px;
  line-height: 1.45;
  color: theme.$gray_5;
}
.bd-desc--lead {
  margin: 0;
  padding: 10px 14px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$gray_1;
}
.bd-meta {
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
.bd-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
.bd-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.bd-head__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.bd-head__name {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
}
.bd-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.bd-head__clear {
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
</style>
