<script setup>
// Adding a view to a running session, from a data platform: the platforms
// in their groups on the left (PlatformList), the chosen one's picker on
// the right (PlatformPane), as the new notebook dialog's data step. What's
// chosen is made into a view and staged by the session's sidecar as
// input/<name>/ (useJupyterSession addInputSource); "added" says its name.
import { computed, ref, watch } from "vue";
import { createOpenDataView, createOpenDataViewOf, createDandiView, openDataViewName, viewForDataset } from "@/utils/viewsService";
import { OPENNEURO_REGISTRY } from "@/utils/openNeuro";
import { DANDI_REGISTRY, dandiViewTitle } from "@/utils/dandi";
import { BOSSDB_REGISTRY, bossdbViewName } from "@/utils/bossdb";
import { OPEN_DATA_PORTALS } from "@/utils/openDataPortals";
import PlatformList from "../PlatformList.vue";
import PlatformPane from "../PlatformPane.vue";
import { newSelection, clearSelection, selectionReady } from "../platformSelection";
import { addedSourceName } from "./inputsHelpers";

const props = defineProps({
  // The session's views (useSessionInputs), to tell one of the same files.
  sources: { type: Array, default: () => [] },
  addInputSource: { type: Function, required: true },
});
const emit = defineEmits(["added"]);
const addOpen = defineModel({ type: Boolean, default: false });

const platform = ref("discover");
const sel = newSelection();
const adding = ref(false);
const addError = ref(null);

// Each opening starts over.
watch(addOpen, (open) => {
  if (!open) return;
  clearSelection(sel);
  addError.value = null;
});

const addReady = computed(() => selectionReady(platform.value, sel));

// A view's name for what's chosen: two views of the same name are of the
// same files. For a Discover dataset version, its id and version instead.
const viewNameOf = () => {
  const p = platform.value;
  if (p === "bossdb") return bossdbViewName(sel.bossdb.picks);
  if (p === "dandi") return openDataViewName(dandiViewTitle(sel.dandi.dataset), sel.dandi.prefix);
  if (p === "openData") return openDataViewName(sel.openData.dataset.title, sel.openData.prefix);
  return openDataViewName(sel[p].dataset.name, sel[p].prefix);
};
const registryOf = () => {
  const p = platform.value;
  if (p === "openNeuro") return OPENNEURO_REGISTRY;
  if (p === "dandi") return DANDI_REGISTRY;
  if (p === "bossdb") return BOSSDB_REGISTRY;
  if (p in OPEN_DATA_PORTALS) return OPEN_DATA_PORTALS[p].registry;
  return sel.openData.dataset?.name;
};

// A source already in the session with the same files.
const addDuplicate = computed(() => {
  if (!addReady.value) return null;
  if (platform.value === "discover") {
    const { dataset, version } = sel.discover;
    return props.sources.find((s) => s.sourceDatasetId === dataset.id && s.sourceVersion === version) || null;
  }
  const name = viewNameOf();
  return props.sources.find((s) => s.openDataset === registryOf() && s.viewName === name) || null;
});
const addDuplicateLabel = computed(() =>
  platform.value === "discover" ? `Version ${sel.discover.version} of ${sel.discover.dataset?.name}` : viewNameOf()
);

async function addData() {
  if (!addReady.value || adding.value || addDuplicate.value) return;
  adding.value = true;
  addError.value = null;
  try {
    const p = platform.value;
    let view, folder;
    if (p === "discover") {
      const { dataset: d, version } = sel.discover;
      view = await viewForDataset({ datasetId: d.id, version, name: d.name });
      folder = (n) => `dataset-${d.id}-v${version}${n > 1 ? `-${n}` : ""}`;
    } else if (p === "bossdb") {
      const picks = sel.bossdb.picks;
      view = await createOpenDataViewOf({ dataset: BOSSDB_REGISTRY, name: bossdbViewName(picks), prefixes: picks.map((x) => x.prefix) });
      // Named after what's chosen: bossdb-witvliet2020-Dataset_1-em for
      // one, its collection for several of one.
      const one = picks.length === 1 ? picks[0].prefix : picks[0].prefix.split("/")[0];
      folder = (n) => addedSourceName(BOSSDB_REGISTRY, `${one.replace(/\/$/, "").replaceAll("/", "-")}/`, n);
    } else if (p === "dandi") {
      const { dataset: d, prefix } = sel.dandi;
      view = await createDandiView({ dandiset: d.id, version: d.version, title: dandiViewTitle(d), prefix });
      folder = (n) => addedSourceName(DANDI_REGISTRY, prefix || `${d.id}/`, n);
    } else {
      // An Open Data dataset or a folder of one: OpenNeuro's, a portal's,
      // or any in the registry.
      const { dataset: d, prefix } = sel[p];
      const registry = registryOf();
      view = await createOpenDataView({ dataset: registry, title: p === "openData" ? d.title : d.name, prefix });
      folder = (n) => addedSourceName(registry, prefix, n);
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
  <el-dialog v-model="addOpen" title="Add data to the session" width="min(1000px, 96vw)" top="5vh" class="add-dialog" append-to-body>
    <div class="add">
      <aside class="add__side">
        <PlatformList v-model="platform" />
        <p class="add__note">It joins the session as a folder of input/; you pick which files to download.</p>
      </aside>
      <div class="add__main">
        <PlatformPane v-if="addOpen" :platform="platform" :selection="sel" />
        <p v-if="addDuplicate" class="add__msg add__msg--error">
          {{ addDuplicateLabel }} is already in the session, as input/{{ addDuplicate.nodeId }}/.
        </p>
        <p v-if="addError" class="add__msg add__msg--error">{{ addError }}</p>
      </div>
    </div>
    <template #footer>
      <el-button @click="addOpen = false">Cancel</el-button>
      <el-button type="primary" :disabled="!addReady || !!addDuplicate" :loading="adding" @click="addData">Add to session</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

/* The platforms on the left, scrolling on their own; the picker fills the
   right. Stacked on a narrow screen. */
/* The dialog's height less its title and buttons: the platforms scroll in
   theirs, the picker's results in theirs. */
.add {
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: 24px;
  height: calc(90vh - 150px);
}
.add__side {
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.add__main {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.add__note {
  margin: 12px 0 0;
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
@media (max-width: 760px) {
  .add {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }
}
</style>
