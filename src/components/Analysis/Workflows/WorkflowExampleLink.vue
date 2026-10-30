<script setup>
/*
  A workflow's sample output (the API's "example"; the workflow page's header and Details panel): opens the PDF
  (a summary of one successful run) in the sample output viewer, over the page. On the latest version it's
  the newest version's example that has one ("Example from version N" when
  that's an older version); on an older version shown, that version's own.
  Two forms: `variant="icon"` (the page header: a PDF icon button, the version
  and run in its tooltip) and `variant="row"` (the Details panel: an info row
  with the version, the run, Open and, for editors, Remove). Nothing shows
  where there's no example or the feature isn't served.
*/
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessageBox } from "element-plus";
import EventBus from "../../../utils/event-bus";
import IconPDF from "../../icons/IconPDF.vue";
import { exampleLabel, exampleVersion, PDF_URL_FRESH_MS } from "./runExamples";
import SampleOutputViewer from "./SampleOutputViewer.vue";

const props = defineProps({
  uuid: { type: String, default: "" },
  // The version shown, or null for the latest.
  version: { type: Number, default: null },
  canEdit: { type: Boolean, default: false },
  // "icon": the header's PDF button; "row": the Details panel's info row.
  variant: { type: String, default: "icon" },
  // The workflow's name, for the viewer's title and the downloaded file's name.
  workflowName: { type: String, default: "" },
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
const runLabel = computed(() => example.value?.runName || example.value?.runId || "");
const pagesLabel = computed(() => {
  const n = example.value?.pages;
  return n ? `${n} page${n === 1 ? "" : "s"}` : "";
});
const title = computed(() => {
  if (!example.value) return "";
  const parts = [`${label.value}: a PDF summary of run ${runLabel.value}`];
  if (pagesLabel.value) parts.push(pagesLabel.value);
  return `${parts.join(", ")}. Captions and overview are AI-written.`;
});

const viewerOpen = ref(false);
const subtitle = computed(() => {
  if (!example.value) return "";
  const parts = [`Version ${exampleVersion(example.value)}`, `run ${runLabel.value}`];
  if (pagesLabel.value) parts.push(pagesLabel.value);
  return parts.join(" · ");
});
// The link shown, fresh: the one in hand while it's young, else asked again.
const pdfSource = async () => {
  if (Date.now() - fetchedAt.value < PDF_URL_FRESH_MS && example.value?.pdfUrl) return example.value.pdfUrl;
  const found = await fetchExample();
  example.value = found;
  fetchedAt.value = Date.now();
  return found?.pdfUrl || null;
};
const open = () => {
  viewerOpen.value = true;
};

const remove = async () => {
  const version = exampleVersion(example.value);
  if (!version) return;
  try {
    await ElMessageBox.confirm(
      `Version ${version} will no longer have a sample output. A run can be used as its sample output again.`,
      "Remove the sample output?",
      { confirmButtonText: "Remove", cancelButtonText: "Cancel", type: "warning" }
    );
  } catch {
    return;
  }
  removing.value = true;
  try {
    await store.dispatch("analysisModule/deleteWorkflowVersionExample", { uuid: props.uuid, version });
    EventBus.$emit("toast", { detail: { type: "success", msg: `Removed the sample output of version ${version}.` } });
    await load();
  } catch (err) {
    const msg =
      err?.status === 403 ? "Only someone who can edit this workflow can remove its sample output." : "Could not remove the sample output.";
    EventBus.$emit("toast", { detail: { type: "error", msg } });
  } finally {
    removing.value = false;
  }
};
</script>

<template>
  <el-tooltip v-if="example && variant === 'icon'" :content="title" placement="bottom">
    <button type="button" class="wf-example-icon" :aria-label="title" @click="open">
      <IconPDF :width="20" :height="20" color="currentColor" />
    </button>
  </el-tooltip>

  <div v-else-if="example && variant === 'row'" class="info-row wf-example-row">
    <span class="info-label">Sample output</span>
    <span class="info-value">
      <button type="button" class="wf-example-row__open" @click="open">
        <IconPDF :width="14" :height="14" color="currentColor" />
        <span>PDF summary{{ pagesLabel ? ` (${pagesLabel})` : "" }}</span>
      </button>
      <span class="wf-example-row__meta">
        Version {{ exampleVersion(example) }} · run {{ runLabel }}
      </span>
      <button v-if="canEdit" type="button" class="wf-example__remove" :disabled="removing" @click="remove">
        Remove sample output
      </button>
    </span>
  </div>
  <SampleOutputViewer
    v-if="example"
    v-model="viewerOpen"
    :source="pdfSource"
    :workflow-name="workflowName"
    :version="exampleVersion(example)"
    :subtitle="subtitle"
  />
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.wf-example-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}
.wf-example-row .info-value {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.wf-example-row__open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: theme.$purple_3;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}
.wf-example-row__meta {
  font-size: 12px;
  color: theme.$gray_5;
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
