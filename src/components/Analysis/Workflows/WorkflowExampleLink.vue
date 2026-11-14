<script setup>
/*
  A workflow's sample output (the API's "example"; the workflow page's header and Details panel): opens the PDF
  (a summary of one successful run) in the sample output viewer, over the page. On the latest version it's
  the newest version's example that has one ("Example from version N" when
  that's an older version); on an older version shown, that version's own.
  Three forms: `variant="icon"` (the page header: a PDF icon button, the version
  and run in its tooltip), `variant="card"` (the side panel, above Workflow
  Details: the app page's report card, AppSampleCard, with the apps-updated
  note when it applies and, for editors, Remove) and `variant="row"` (an info
  row with the PDF link). Nothing shows
  where there's no example or the feature isn't served. The newest report is
  never hidden by a newer version: when its apps differ from the version
  shown's, a muted "Apps updated since this report" says so, the apps changed
  in its tooltip (reportNote.js).
*/
import { computed, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessageBox } from "element-plus";
import EventBus from "../../../utils/event-bus";
import IconPDF from "../../icons/IconPDF.vue";
import AppSampleCard from "../Applications/AppSampleCard.vue";
import { exampleLabel, exampleVersion, PDF_URL_FRESH_MS } from "./runExamples";
import SampleOutputViewer from "./SampleOutputViewer.vue";
import { workflowReportNote } from "./reportNote";

const props = defineProps({
  uuid: { type: String, default: "" },
  // The version shown, or null for the latest.
  version: { type: Number, default: null },
  canEdit: { type: Boolean, default: false },
  // "icon": the header's PDF button; "card": the side panel's report card;
  // "row": an info row.
  variant: { type: String, default: "icon" },
  // The workflow's name, for the viewer's title and the downloaded file's name.
  workflowName: { type: String, default: "" },
  // The workflow (or version) shown, with its dag: what the report's apps
  // are compared with.
  workflow: { type: Object, default: null },
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

const note = ref("");
const noteDetail = ref("");
let noteSeq = 0;
watch(
  () => [example.value?.jobId, example.value?.version, example.value?.fromVersion, props.workflow?.dag],
  async () => {
    const mine = ++noteSeq;
    const found = await workflowReportNote(store, props.uuid, example.value, props.workflow);
    if (mine !== noteSeq) return;
    note.value = found.text;
    noteDetail.value = found.detail;
  },
  { immediate: true }
);

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
  return `${parts.join(", ")}. Captions and overview are AI-written.${
    note.value ? ` ${note.value}: ${noteDetail.value}.` : ""
  }`;
});

// The card's sample (AppSampleCard reads pages, createdAt and previewUrl).
const cardSample = computed(() => (example.value ? { ...example.value, pipeline: false } : null));
const cardMeta = computed(() => {
  const d = new Date(example.value?.createdAt);
  const made = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  return [pagesLabel.value, made].filter(Boolean).join(" · ");
});
const cardLede = computed(
  () => `A PDF of one run of ${props.workflowName || "this workflow"}: its inputs, results and figures.`
);

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

  <AppSampleCard
    v-else-if="example && variant === 'card'"
    :sample="cardSample"
    :app-name="workflowName"
    :source="pdfSource"
    :title="label"
    :lede-text="cardLede"
    :meta-text="cardMeta"
    :note="note"
    :note-detail="noteDetail"
    compact
  >
    <template v-if="canEdit" #actions>
      <button type="button" class="wf-example__remove" :disabled="removing" @click="remove">Remove example</button>
    </template>
  </AppSampleCard>

  <div v-else-if="example && variant === 'row'" class="info-row wf-example-row">
    <span class="info-label">Example report</span>
    <span class="info-value">
      <button type="button" class="wf-example-row__open" @click="open">
        <IconPDF :width="14" :height="14" color="currentColor" />
        <span>View PDF{{ pagesLabel ? ` (${pagesLabel})` : "" }}</span>
      </button>
      <span v-if="note" class="wf-example-row__note" :title="noteDetail || undefined">{{ note }}</span>
      <button v-if="canEdit" type="button" class="wf-example__remove" :disabled="removing" @click="remove">
        Remove example
      </button>
    </span>
  </div>
  <SampleOutputViewer
    v-if="example && variant !== 'card'"
    v-model="viewerOpen"
    :source="pdfSource"
    :workflow-name="workflowName"
    :version="exampleVersion(example)"
    :subtitle="subtitle"
    :note="note"
    :note-detail="noteDetail"
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
/* The panel's rows (WorkflowBuilder .info-row): its scoped styles don't reach
   this component, so the row's are repeated here. */
.wf-example-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid theme.$gray_2;
}
.wf-example-row .info-label {
  font-size: 12px;
  font-weight: 600;
  color: theme.$gray_5;
  flex-shrink: 0;
  min-width: 80px;
}
.wf-example-row .info-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 12px;
  color: theme.$black;
  text-align: right;
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
.wf-example-row__note {
  font-size: 12px;
  font-style: italic;
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
