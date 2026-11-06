<script setup>
// Adding a view to a running session, from a data platform: the platforms
// in their groups on the left (PlatformList), the chosen one's picker on
// the right (PlatformPane), as the new notebook dialog's data step. What's
// chosen is made into a view and staged by the session's sidecar as
// input/<name>/ (useJupyterSession addInputSource); "added" says its name.
import { computed, ref, watch } from "vue";
import PlatformList from "../PlatformList.vue";
import PlatformPane from "../PlatformPane.vue";
import { PLATFORMS } from "../platforms";
import { newSelection, clearSelection, selectionReady } from "../platformSelection";

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

const p = computed(() => PLATFORMS[platform.value]);
const part = computed(() => sel[platform.value]);
const addReady = computed(() => selectionReady(platform.value, sel));

// A source already in the session with the same files.
const addDuplicate = computed(() => (addReady.value ? props.sources.find((s) => p.value.sameAs(part.value, s)) || null : null));
const addDuplicateLabel = computed(() => (p.value.sameLabel || p.value.viewName)(part.value));

async function addData() {
  if (!addReady.value || adding.value || addDuplicate.value) return;
  adding.value = true;
  addError.value = null;
  try {
    const view = await p.value.createView(part.value);
    const folder = (n) => p.value.folderName(part.value, n);
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
