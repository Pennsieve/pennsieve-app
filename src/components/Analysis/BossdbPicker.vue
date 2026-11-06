<script setup>
// Choosing what a notebook takes from BossDB (utils/bossdb): whole
// collections, experiments or channels, several at once, as the Open Data
// bucket has them, described where BossDB's API can. Each is a folder of
// the bossdb entry; views-service takes the volumes in them whole, as
// precomputed stacks read in place. Used by the new notebook dialog and the
// running session's Inputs panel.
import { computed, onMounted, ref } from "vue";
import {
  bossdbCollections,
  searchBossdb,
  bossdbExperiments,
  bossdbChannels,
  bossdbUrl,
  addPick,
  pickCovers,
  BOSSDB_MAX_PICKS,
} from "@/utils/bossdb";

// What's chosen: [{ prefix, label, level, description, type }].
const picks = defineModel("picks", { type: Array, default: () => [] });

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
const full = computed(() => picks.value.length >= BOSSDB_MAX_PICKS);

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
onMounted(loadCollections);

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
    const list = await bossdbChannels(collection.value, e.name);
    if (current()) channels.value = list;
  });
}

function up(to) {
  if (to === "collections") collection.value = "";
  experiment.value = null;
}

// A folder's state: chosen, inside a chosen one, or free.
const chosen = (prefix) => picks.value.some((p) => p.prefix === prefix);
const within = (prefix) => picks.value.some((p) => p.prefix !== prefix && pickCovers(p, prefix));
function toggle(pick) {
  if (chosen(pick.prefix)) picks.value = picks.value.filter((p) => p.prefix !== pick.prefix);
  else if (!within(pick.prefix) && !full.value) picks.value = addPick(picks.value, pick);
}
const remove = (prefix) => (picks.value = picks.value.filter((p) => p.prefix !== prefix));

const collectionPick = (c) => ({ prefix: `${c}/`, label: `${c} (whole collection)`, level: "collection", description: "", type: "" });
const experimentPick = (e) => ({
  prefix: `${collection.value}/${e.name}/`,
  label: `${collection.value} · ${e.name}`,
  level: "experiment",
  description: e.description,
  type: "",
});
const channelPick = (ch) => ({
  prefix: ch.path,
  label: `${collection.value} · ${experiment.value.name} · ${ch.name}`,
  level: "channel",
  description: experiment.value.description,
  type: ch.type,
});
</script>

<template>
  <div class="bd-picker">
    <!-- What's chosen, to remove. -->
    <div v-if="picks.length" class="bd-picks">
      <span v-for="p in picks" :key="p.prefix" class="bd-pick" :title="p.prefix">
        {{ p.label }}
        <button type="button" class="bd-pick__remove" :aria-label="`Remove ${p.label}`" @click="remove(p.prefix)">&times;</button>
      </span>
      <span v-if="full" class="bd-picks__note">At most {{ BOSSDB_MAX_PICKS }}.</span>
    </div>

    <nav class="bd-crumbs" aria-label="BossDB">
      <button type="button" class="bd-crumb" :class="{ 'is-current': !collection }" @click="up('collections')">Collections</button>
      <template v-if="collection">
        <span class="bd-crumbs__sep">/</span>
        <button type="button" class="bd-crumb" :class="{ 'is-current': !experiment }" @click="up('experiments')">{{ collection }}</button>
        <a class="bd-crumbs__link" :href="bossdbUrl(collection)" target="_blank" rel="noopener" title="On bossdb.org">↗</a>
      </template>
      <template v-if="experiment">
        <span class="bd-crumbs__sep">/</span>
        <span class="bd-crumb is-current">{{ experiment.name }}</span>
      </template>
    </nav>

    <!-- Collections: tick one to take all of it, or open it. -->
    <template v-if="!collection">
      <el-input v-model="query" class="bd-search" placeholder="Search BossDB collections..." clearable />
      <p v-if="!loading && !error && collections.length" class="bd-count">
        {{ query.trim() ? `${shown.length} of ` : "" }}{{ collections.length }} collections · tick one to take all of it, or open it to choose
      </p>
      <div class="bd-cards pp-list">
        <div v-for="c in shown" :key="c" class="bd-row" :class="{ 'is-chosen': chosen(`${c}/`) }">
          <input
            type="checkbox"
            :checked="chosen(`${c}/`)"
            :disabled="!chosen(`${c}/`) && full"
            :aria-label="`Take all of ${c}`"
            @change="toggle(collectionPick(c))"
          />
          <button type="button" class="bd-card" @click="openCollection(c)">
            <span class="bd-card__name">{{ c }}</span>
          </button>
        </div>
        <div v-if="loading" class="bd-msg">Loading BossDB…</div>
        <div v-else-if="error" class="bd-msg">{{ error }}</div>
        <div v-else-if="!shown.length" class="bd-msg">No BossDB collections found</div>
      </div>
    </template>

    <!-- A collection's experiments. -->
    <div v-else-if="!experiment" class="bd-cards pp-list">
      <div
        v-for="e in experiments"
        :key="e.name"
        class="bd-row"
        :class="{ 'is-chosen': chosen(`${collection}/${e.name}/`), 'is-within': within(`${collection}/${e.name}/`) }"
      >
        <input
          type="checkbox"
          :checked="chosen(`${collection}/${e.name}/`) || within(`${collection}/${e.name}/`)"
          :disabled="within(`${collection}/${e.name}/`) || (!chosen(`${collection}/${e.name}/`) && full)"
          :aria-label="`Take all of ${e.name}`"
          @change="toggle(experimentPick(e))"
        />
        <button type="button" class="bd-card" @click="openExperiment(e)">
          <span class="bd-card__name">{{ e.name }}</span>
          <span v-if="e.description" class="bd-desc">{{ e.description }}</span>
          <span v-if="e.channels || e.levels" class="bd-meta">
            <span v-if="e.channels">{{ e.channels.length }} channel{{ e.channels.length === 1 ? "" : "s" }}</span>
            <span v-if="e.levels">{{ e.levels }} resolution levels</span>
          </span>
        </button>
      </div>
      <div v-if="loading" class="bd-msg">Loading experiments…</div>
      <div v-else-if="error" class="bd-msg">{{ error }}</div>
      <div v-else-if="!experiments.length" class="bd-msg">No experiments</div>
    </div>

    <!-- An experiment's channels: each a volume. -->
    <div v-else class="bd-cards pp-list">
      <p v-if="experiment.description" class="bd-desc bd-desc--lead">{{ experiment.description }}</p>
      <div
        v-for="ch in channels"
        :key="ch.name"
        class="bd-row"
        :class="{ 'is-chosen': chosen(ch.path), 'is-within': within(ch.path) }"
      >
        <input
          type="checkbox"
          :checked="chosen(ch.path) || within(ch.path)"
          :disabled="within(ch.path) || (!chosen(ch.path) && full)"
          :aria-label="`Take ${ch.name}`"
          @change="toggle(channelPick(ch))"
        />
        <button type="button" class="bd-card" :disabled="within(ch.path)" @click="toggle(channelPick(ch))">
          <span class="bd-card__name">{{ ch.name }}</span>
          <span class="bd-meta">
            <span v-if="ch.type">{{ ch.type }}</span>
            <span v-if="ch.datatype">{{ ch.datatype }}</span>
            <span>{{ ch.path }}</span>
          </span>
        </button>
      </div>
      <div v-if="loading" class="bd-msg">Loading channels…</div>
      <div v-else-if="error" class="bd-msg">{{ error }}</div>
      <div v-else-if="!channels.length" class="bd-msg">This experiment has no volumes in the Open Data bucket</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/theme";

.bd-picks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.bd-pick {
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
.bd-pick__remove {
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
.bd-picks__note {
  font-size: 12px;
  color: theme.$gray_4;
}
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
.bd-crumbs__link {
  color: theme.$gray_4;
  text-decoration: none;
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
.bd-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-left: 14px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$white;

  input[type="checkbox"] {
    flex-shrink: 0;
    margin-top: 13px;
  }
  &.is-chosen {
    background: theme.$purple_tint;
  }
  &.is-within {
    background: theme.$gray_1;
  }
}
.bd-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 10px 14px 10px 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) .bd-card__name {
    color: theme.$purple_2;
  }
  &:disabled {
    cursor: default;
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
}
.bd-msg {
  padding: 8px 14px;
  font-size: 12px;
  color: theme.$gray_4;
}
</style>
