<script setup>
// Adding a view to a running session, from a data platform: a Pennsieve
// Discover dataset version, an OpenNeuro, SPARC, Epilepsy.Science or AWS
// Open Data dataset or a folder of one, BossDB data, or a dandiset version or
// a folder of it. It's made into a view and staged by the session's sidecar
// as input/<name>/ (useJupyterSession addInputSource); "added" says its name.
import { computed, ref, watch } from "vue";
import { createOpenDataView, createOpenDataViewOf, createDandiView, openDataViewName, viewForDataset } from "@/utils/viewsService";
import OpenDataPicker from "../OpenDataPicker.vue";
import DiscoverPicker from "../DiscoverPicker.vue";
import OpenNeuroPicker from "../OpenNeuroPicker.vue";
import { OPENNEURO_REGISTRY } from "@/utils/openNeuro";
import PortalPicker from "../PortalPicker.vue";
import DandiPicker from "../DandiPicker.vue";
import { DANDI_REGISTRY, dandiViewTitle } from "@/utils/dandi";
import BossdbPicker from "../BossdbPicker.vue";
import { BOSSDB_REGISTRY, bossdbViewName } from "@/utils/bossdb";
import { OPEN_DATA_PORTALS } from "@/utils/openDataPortals";
import PlatformMark from "../PlatformMark.vue";
import { DATA_PLATFORMS } from "../dataPlatforms";
import { addedSourceName } from "./inputsHelpers";

const props = defineProps({
  // The session's views (useSessionInputs), to tell one of the same files.
  sources: { type: Array, default: () => [] },
  addInputSource: { type: Function, required: true },
});
const emit = defineEmits(["added"]);
const addOpen = defineModel({ type: Boolean, default: false });

// Another view while the session runs, from a data platform: a Pennsieve
// Discover dataset version, or an OpenNeuro, SPARC, Epilepsy.Science or AWS
// Open Data dataset or a folder of one, a BossDB volume, or a dandiset
// version or a folder
// of it, made into a view and staged as input/<name>/.
const addPlatform = ref("discover");
const addDataset = ref(null);
const addPrefix = ref("");
const addDiscover = ref(null);
const addDiscoverVersion = ref(null);
const addOpenNeuro = ref(null);
const addOpenNeuroPrefix = ref("");
const addDandi = ref(null);
const addDandiPrefix = ref("");
const addBossdbPicks = ref([]);
// A SPARC or Epilepsy.Science dataset: a folder of the portal's Open Data
// entry. Choosing the other portal starts over.
const addPortal = ref(null);
const addPortalPrefix = ref("");
const addIsPortal = computed(() => addPlatform.value in OPEN_DATA_PORTALS);
const addRegistry = computed(() => OPEN_DATA_PORTALS[addPlatform.value]?.registry || "");
watch(addPlatform, () => {
  addPortal.value = null;
  addPortalPrefix.value = "";
});
const adding = ref(false);
const addError = ref(null);

// Each opening starts over.
watch(addOpen, (open) => {
  if (open) startOver();
});
function startOver() {
  addDataset.value = null;
  addPrefix.value = "";
  addDiscover.value = null;
  addDiscoverVersion.value = null;
  addOpenNeuro.value = null;
  addOpenNeuroPrefix.value = "";
  addDandi.value = null;
  addDandiPrefix.value = "";
  addBossdbPicks.value = [];
  addPortal.value = null;
  addPortalPrefix.value = "";
  addError.value = null;
}

const addReady = computed(() =>
  addPlatform.value === "discover"
    ? !!addDiscover.value
    : addPlatform.value === "openNeuro"
    ? !!addOpenNeuro.value
    : addPlatform.value === "bossdb"
    ? addBossdbPicks.value.length > 0
    : addPlatform.value === "dandi"
    ? !!addDandi.value
    : addIsPortal.value
    ? !!addPortal.value
    : !!addDataset.value
);

// A source already in the session with the same files: the same Discover
// dataset version, or the same Open Data dataset and folder.
const addDuplicate = computed(() => {
  if (addPlatform.value === "discover") {
    const d = addDiscover.value;
    if (!d) return null;
    return props.sources.find((s) => s.sourceDatasetId === d.id && s.sourceVersion === addDiscoverVersion.value) || null;
  }
  if (addPlatform.value === "openNeuro") {
    const d = addOpenNeuro.value;
    if (!d) return null;
    const name = openDataViewName(d.name, addOpenNeuroPrefix.value);
    return props.sources.find((s) => s.openDataset === OPENNEURO_REGISTRY && s.viewName === name) || null;
  }
  if (addPlatform.value === "bossdb") {
    if (!addBossdbPicks.value.length) return null;
    const name = bossdbViewName(addBossdbPicks.value);
    return props.sources.find((s) => s.openDataset === BOSSDB_REGISTRY && s.viewName === name) || null;
  }
  if (addPlatform.value === "dandi") {
    const d = addDandi.value;
    if (!d) return null;
    const name = openDataViewName(dandiViewTitle(d), addDandiPrefix.value);
    return props.sources.find((s) => s.openDataset === DANDI_REGISTRY && s.viewName === name) || null;
  }
  if (addIsPortal.value) {
    const d = addPortal.value;
    if (!d) return null;
    const name = openDataViewName(d.name, addPortalPrefix.value);
    return props.sources.find((s) => s.openDataset === addRegistry.value && s.viewName === name) || null;
  }
  const d = addDataset.value;
  if (!d) return null;
  const name = openDataViewName(d.title, addPrefix.value);
  return props.sources.find((s) => s.openDataset === d.name && s.viewName === name) || null;
});
const addDuplicateLabel = computed(() =>
  addPlatform.value === "discover"
    ? `Version ${addDiscoverVersion.value} of ${addDiscover.value?.name}`
    : addPlatform.value === "openNeuro"
    ? `This folder of ${addOpenNeuro.value?.name}`
    : addPlatform.value === "bossdb"
    ? bossdbViewName(addBossdbPicks.value)
    : addPlatform.value === "dandi"
    ? `This folder of ${addDandi.value?.name} (${addDandi.value?.version})`
    : addIsPortal.value
    ? `This folder of ${addPortal.value?.name}`
    : `This folder of ${addDataset.value?.title}`
);

async function addData() {
  if (!addReady.value || adding.value || addDuplicate.value) return;
  adding.value = true;
  addError.value = null;
  try {
    let view, folder;
    if (addPlatform.value === "discover") {
      const d = addDiscover.value;
      view = await viewForDataset({ datasetId: d.id, version: addDiscoverVersion.value, name: d.name });
      folder = (n) => `dataset-${d.id}-v${addDiscoverVersion.value}${n > 1 ? `-${n}` : ""}`;
    } else if (addPlatform.value === "openNeuro") {
      const d = addOpenNeuro.value;
      view = await createOpenDataView({ dataset: OPENNEURO_REGISTRY, title: d.name, prefix: addOpenNeuroPrefix.value });
      folder = (n) => addedSourceName(OPENNEURO_REGISTRY, addOpenNeuroPrefix.value, n);
    } else if (addPlatform.value === "bossdb") {
      const picks = addBossdbPicks.value;
      view = await createOpenDataViewOf({ dataset: BOSSDB_REGISTRY, name: bossdbViewName(picks), prefixes: picks.map((p) => p.prefix) });
      // Named after what's chosen: bossdb-witvliet2020-Dataset_1-em for
      // one, its collection for several of one.
      const one = picks.length === 1 ? picks[0].prefix : picks[0].prefix.split("/")[0];
      folder = (n) => addedSourceName(BOSSDB_REGISTRY, `${one.replace(/\/$/, "").replaceAll("/", "-")}/`, n);
    } else if (addPlatform.value === "dandi") {
      const d = addDandi.value;
      const p = addDandiPrefix.value;
      view = await createDandiView({ dandiset: d.id, version: d.version, title: dandiViewTitle(d), prefix: p });
      folder = (n) => addedSourceName(DANDI_REGISTRY, p || `${d.id}/`, n);
    } else if (addIsPortal.value) {
      const d = addPortal.value;
      const registry = addRegistry.value;
      view = await createOpenDataView({ dataset: registry, title: d.name, prefix: addPortalPrefix.value });
      folder = (n) => addedSourceName(registry, addPortalPrefix.value, n);
    } else {
      const d = addDataset.value;
      view = await createOpenDataView({ dataset: d.name, title: d.title, prefix: addPrefix.value });
      folder = (n) => addedSourceName(d.name, addPrefix.value, n);
    }
    // The next free folder name: input/ may hold one already.
    let added = "";
    for (let n = 1; ; n++) {
      try {
        await props.addInputSource(folder(n), view.id, view.version);
        added = folder(n);
        break;
      } catch (e) {
        if (e?.status !== 409 || n >= 20) throw e;
      }
    }
    addOpen.value = false;
    emit("added", added);
  } catch (e) {
    addError.value = e?.message || String(e);
  } finally {
    adding.value = false;
  }
}
</script>

<template>
    <el-dialog v-model="addOpen" title="Add data to the session" width="min(820px, 96vw)" append-to-body>
      <div class="add__platforms" role="tablist">
        <button
          v-for="(p, key) in DATA_PLATFORMS"
          :key="key"
          type="button"
          role="tab"
          class="add__platform"
          :class="{ 'is-picked': addPlatform === key }"
          :aria-selected="addPlatform === key"
          @click="addPlatform = key"
        >
          <PlatformMark :platform="key" :size="32" />
          <span class="add__platform-text">
            <span class="add__platform-name">{{ p.name }}</span>
            <span class="add__platform-desc">{{ p.desc }}</span>
          </span>
        </button>
      </div>
      <p class="add__dialog-desc">It joins the session as a folder of input/; you pick which files to download.</p>
      <template v-if="addOpen">
        <DiscoverPicker
          v-if="addPlatform === 'discover'"
          v-model:dataset="addDiscover"
          v-model:version="addDiscoverVersion"
        />
        <OpenNeuroPicker
          v-else-if="addPlatform === 'openNeuro'"
          v-model:dataset="addOpenNeuro"
          v-model:prefix="addOpenNeuroPrefix"
        />
        <BossdbPicker v-else-if="addPlatform === 'bossdb'" v-model:picks="addBossdbPicks" />
        <DandiPicker
          v-else-if="addPlatform === 'dandi'"
          v-model:dataset="addDandi"
          v-model:prefix="addDandiPrefix"
        />
        <PortalPicker
          v-else-if="addIsPortal"
          :key="addPlatform"
          :portal="addPlatform"
          v-model:dataset="addPortal"
          v-model:prefix="addPortalPrefix"
        />
        <OpenDataPicker v-else v-model:dataset="addDataset" v-model:prefix="addPrefix" />
      </template>
      <p v-if="addDuplicate" class="add__msg add__msg--error">
        {{ addDuplicateLabel }} is already in the session, as input/{{ addDuplicate.nodeId }}/.
      </p>
      <p v-if="addError" class="add__msg add__msg--error">{{ addError }}</p>
      <template #footer>
        <el-button @click="addOpen = false">Cancel</el-button>
        <el-button type="primary" :disabled="!addReady || !!addDuplicate" :loading="adding" @click="addData">Add to session</el-button>
      </template>
    </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.add__dialog-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$gray_5;
}
.add__platforms {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.add__platform {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: theme.$gray_1;
  }
  /* Calm: a thin accent on the left and a faint tint. */
  &.is-picked {
    background: theme.$gray_1;
    box-shadow: inset 2px 0 0 theme.$purple_3;
  }
}
.add__platform-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.add__platform-name {
  font-weight: 600;
  font-size: 14px;
  color: theme.$gray_6;
}
.add__platform-desc {
  font-size: 12px;
  color: theme.$gray_4;
}
.add__msg {
  padding: 6px 0;
  margin: 0;
  color: theme.$gray_4;
  font-size: 12px;
}
.add__msg--error {
  color: theme.$red_2;
  white-space: pre-wrap;
}
</style>
