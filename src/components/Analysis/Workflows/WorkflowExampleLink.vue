<script setup>
/*
  A workflow's Example (the workflow page's header): opens the example PDF
  (a summary of one successful run) in a new tab. On the latest version it's
  the newest version's example that has one ("Example from version N" when
  that's an older version); on an older version shown, that version's own.
  Whoever can edit the workflow may remove it. Nothing shows where there's
  no example or the feature isn't served.
*/
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessageBox } from "element-plus";
import EventBus from "../../../utils/event-bus";
import BfButton from "../../shared/bf-button/BfButton.vue";
import { exampleLabel, exampleVersion, openPdf, PDF_URL_FRESH_MS } from "./runExamples";

const props = defineProps({
  uuid: { type: String, default: "" },
  // The version shown, or null for the latest.
  version: { type: Number, default: null },
  canEdit: { type: Boolean, default: false },
});

const store = useStore();
const example = ref(null);
const fetchedAt = ref(0);
const removing = ref(false);
let seq = 0;

const fetchExample = () =>
  props.version
    ? store.dispatch("analysisModule/fetchWorkflowVersionExample", { uuid: props.uuid, version: props.version })
    : store.dispatch("analysisModule/fetchWorkflowExample", props.uuid);

const load = async () => {
  const mine = ++seq;
  example.value = null;
  if (!props.uuid) return;
  try {
    const found = await fetchExample();
    if (mine !== seq) return;
    example.value = found;
    fetchedAt.value = Date.now();
  } catch {
    // nothing shown
  }
};
watch(() => [props.uuid, props.version], load, { immediate: true });

const label = computed(() => exampleLabel(example.value));
const title = computed(() => {
  const e = example.value;
  if (!e) return "";
  const parts = [`A PDF summary of run ${e.runName || e.runId}`];
  if (e.pages) parts.push(`${e.pages} page${e.pages === 1 ? "" : "s"}`);
  return `${parts.join(", ")}. Captions and overview are AI-written.`;
});

const open = async () => {
  const fresh = Date.now() - fetchedAt.value < PDF_URL_FRESH_MS && example.value?.pdfUrl;
  try {
    await openPdf(
      fresh ||
        (async () => {
          const found = await fetchExample();
          example.value = found;
          fetchedAt.value = Date.now();
          return found?.pdfUrl || null;
        })
    );
  } catch {
    EventBus.$emit("toast", { detail: { type: "error", msg: "Could not open the example PDF." } });
  }
};

const remove = async () => {
  const version = exampleVersion(example.value);
  if (!version) return;
  try {
    await ElMessageBox.confirm(
      `Version ${version} will no longer have an example. A run can be set as its example again.`,
      "Remove the example?",
      { confirmButtonText: "Remove", cancelButtonText: "Cancel", type: "warning" }
    );
  } catch {
    return;
  }
  removing.value = true;
  try {
    await store.dispatch("analysisModule/deleteWorkflowVersionExample", { uuid: props.uuid, version });
    EventBus.$emit("toast", { detail: { type: "success", msg: `Removed the example of version ${version}.` } });
    await load();
  } catch (err) {
    const msg =
      err?.status === 403 ? "Only someone who can edit this workflow can remove its example." : "Could not remove the example.";
    EventBus.$emit("toast", { detail: { type: "error", msg } });
  } finally {
    removing.value = false;
  }
};
</script>

<template>
  <span v-if="example" class="wf-example">
    <bf-button class="secondary" :title="title" @click="open">{{ label }}</bf-button>
    <button v-if="canEdit" type="button" class="wf-example__remove" :disabled="removing" @click="remove">
      Remove example
    </button>
  </span>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.wf-example {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.wf-example__remove {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_5;
  cursor: pointer;
  text-decoration: underline;

  &:hover {
    color: theme.$red_1;
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}
</style>
