<script setup>
/*
  A run's Set as example (run page, Run Details): for a run that succeeded,
  shown to whoever can edit its workflow. Its dialog says what will be made
  (a PDF summary of the run's figures and outputs; captions and a short
  overview AI-written and labelled; figures and data copied from the
  outputs), that it replaces the example of the run's workflow version, and
  what's left of today's limits. Once asked, the job's progress shows here
  (checked every 5 s while queued or generating), then a link to the PDF.
  Where the feature isn't served, none of it shows.
*/
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useStore } from "vuex";
import BfButton from "../../shared/bf-button/BfButton.vue";
import {
  canEditWorkflow,
  exhaustedLimit,
  jobActive,
  jobStatusText,
  limitMessage,
  limitRows,
  openPdf,
  POLL_MS,
  setExampleError,
} from "../Workflows/runExamples";

const props = defineProps({
  // The run (analysisModule's selectedWorkflowActivity).
  run: { type: Object, default: null },
});

const store = useStore();

const canEdit = ref(false);
const available = ref(false); // GET /runs/{id}/example answered
const job = ref(null);
const limits = ref(null);
const example = ref(null); // this run's example, once known (pdfUrl signed)

const dialogOpen = ref(false);
const refresh = ref(false);
const submitting = ref(false);
const dialogError = ref("");
const openError = ref("");

let pollTimer = null;
let loadSeq = 0;
const stopPolling = () => {
  clearTimeout(pollTimer);
  pollTimer = null;
};

const runId = computed(() => props.run?.uuid || "");
const succeeded = computed(() => props.run?.status === "SUCCEEDED");
const version = computed(() => props.run?.workflowVersion || null);
const shown = computed(() => succeeded.value && canEdit.value && available.value);
const hasPdf = computed(() => job.value?.status === "READY");
const exhausted = computed(() => exhaustedLimit(limits.value));
const rows = computed(() => limitRows(limits.value));

const schedulePoll = (seq) => {
  stopPolling();
  if (!jobActive(job.value)) return;
  pollTimer = setTimeout(async () => {
    if (seq !== loadSeq) return;
    try {
      const status = await store.dispatch("analysisModule/fetchRunExample", runId.value);
      if (seq !== loadSeq) return;
      if (status) {
        job.value = status.job;
        limits.value = status.limits;
      }
    } catch {
      // checked again below
    }
    schedulePoll(seq);
  }, POLL_MS);
};

const load = async () => {
  const seq = ++loadSeq;
  stopPolling();
  canEdit.value = false;
  available.value = false;
  job.value = null;
  limits.value = null;
  example.value = null;
  openError.value = "";
  const run = props.run;
  if (!run?.uuid || run.status !== "SUCCEEDED" || !run.workflowUuid) return;
  try {
    const workflow = await store.dispatch("analysisModule/fetchWorkflowDefinition", run.workflowUuid);
    if (seq !== loadSeq) return;
    canEdit.value = canEditWorkflow(workflow, store.state.profile);
    if (!canEdit.value) return;
    const status = await store.dispatch("analysisModule/fetchRunExample", run.uuid);
    if (seq !== loadSeq || !status) return;
    job.value = status.job;
    limits.value = status.limits;
    available.value = true;
    schedulePoll(seq);
  } catch {
    // Not shown: the workflow or the example status couldn't be read.
  }
};

watch(
  () => [runId.value, props.run?.status, props.run?.workflowUuid],
  load,
  { immediate: true }
);
onBeforeUnmount(() => {
  loadSeq++;
  stopPolling();
});

const openDialog = async () => {
  dialogError.value = "";
  refresh.value = false;
  dialogOpen.value = true;
  // The limits as they are now.
  try {
    const status = await store.dispatch("analysisModule/fetchRunExample", runId.value);
    if (status) {
      limits.value = status.limits;
      if (!jobActive(job.value)) job.value = status.job;
    }
  } catch {
    // the ones already shown
  }
};

const confirm = async () => {
  submitting.value = true;
  dialogError.value = "";
  try {
    const result = await store.dispatch("analysisModule/setRunExample", {
      runId: runId.value,
      refresh: hasPdf.value && refresh.value,
    });
    job.value = result.job;
    if (result.example) example.value = { ...result.example, fetchedAt: Date.now() };
    dialogOpen.value = false;
    schedulePoll(loadSeq);
  } catch (err) {
    dialogError.value = setExampleError(err);
    // A limit or a job in flight: show what's current.
    if (err?.status === 429 || err?.status === 409) {
      store
        .dispatch("analysisModule/fetchRunExample", runId.value)
        .then((s) => s && (limits.value = s.limits))
        .catch(() => {});
    }
  } finally {
    submitting.value = false;
  }
};

// A fresh signed link to this run's PDF: the version's example when it's
// this run's, else the run's own (POST without refresh answers with the
// existing PDF and makes nothing).
const pdfUrl = async () => {
  const cached = example.value;
  if (cached?.pdfUrl && Date.now() - cached.fetchedAt < 10 * 60 * 1000) return cached.pdfUrl;
  if (version.value && props.run?.workflowUuid) {
    const current = await store.dispatch("analysisModule/fetchWorkflowVersionExample", {
      uuid: props.run.workflowUuid,
      version: version.value,
    });
    if (current?.runId === runId.value && current.pdfUrl) {
      example.value = { ...current, fetchedAt: Date.now() };
      return current.pdfUrl;
    }
  }
  const result = await store.dispatch("analysisModule/setRunExample", { runId: runId.value, refresh: false });
  if (result.example?.pdfUrl) {
    example.value = { ...result.example, fetchedAt: Date.now() };
    return result.example.pdfUrl;
  }
  if (result.job) job.value = result.job;
  return null;
};

const viewPdf = async () => {
  openError.value = "";
  try {
    await openPdf(pdfUrl);
  } catch {
    openError.value = "Could not open the example PDF.";
  }
};

defineExpose({ openDialog });
</script>

<template>
  <div v-if="shown" class="run-example">
    <bf-button class="secondary run-example__btn" :disabled="jobActive(job)" @click="openDialog">
      Set as example
    </bf-button>
    <div v-if="job" class="run-example__status" role="status" :class="`is-${(job.status || '').toLowerCase()}`">
      <span>{{ jobStatusText(job) }}</span>
      <button v-if="hasPdf" type="button" class="run-example__link" @click="viewPdf">View example PDF</button>
    </div>
    <p v-if="openError" class="run-example__error">{{ openError }}</p>

    <el-dialog
      v-model="dialogOpen"
      title="Set as example"
      width="520px"
      :close-on-click-modal="!submitting"
      :show-close="!submitting"
      align-center
      append-to-body
    >
      <div class="run-example__dialog">
        <p>
          Pennsieve will make a <strong>PDF summary of this run</strong>: its figures and a summary of each output.
        </p>
        <ul>
          <li>Figures and data are copied from the run's outputs in its datasets; nothing is drawn or computed.</li>
          <li>Captions and a short overview are written by AI, and labelled as such in the PDF.</li>
        </ul>
        <p>
          It replaces the example of
          <strong>{{ version ? `version ${version}` : "this run's version" }}</strong>
          of the workflow, shown to everyone who can see the workflow.
        </p>

        <div v-if="rows.length" class="run-example__limits">
          <span class="run-example__limits-title">Left today</span>
          <span v-for="r in rows" :key="r.key" class="run-example__limit" :class="{ 'is-out': r.left <= 0 }">
            {{ r.label }}: {{ r.left }} of {{ r.limit }}
          </span>
        </div>

        <el-checkbox v-if="hasPdf" v-model="refresh" class="run-example__refresh">
          Regenerate: this run already has an example PDF; make a new one (counts against today's limits)
        </el-checkbox>

        <p v-if="exhausted && !dialogError" class="run-example__error">
          {{ limitMessage(exhausted.key) }}
        </p>
        <p v-if="jobActive(job)" class="run-example__note">An example of this run is being made now.</p>
        <p v-if="dialogError" class="run-example__error" role="alert">{{ dialogError }}</p>
      </div>
      <template #footer>
        <bf-button class="secondary mr-8" :disabled="submitting" @click="dialogOpen = false">Cancel</bf-button>
        <bf-button
          class="primary"
          :processing="submitting"
          processing-text="Setting…"
          :disabled="!!exhausted || jobActive(job)"
          @click="confirm"
        >
          {{ hasPdf && !refresh ? "Use this run's PDF" : "Set as example" }}
        </bf-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.run-example {
  margin-top: 8px;
}
.run-example__btn {
  width: 100%;
  justify-content: center;
}
.run-example__status {
  margin-top: 6px;
  font-size: 12px;
  color: theme.$gray_5;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: baseline;

  &.is-failed {
    color: theme.$red_1;
  }
}
.run-example__link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: theme.$purple_3;
  cursor: pointer;
  text-decoration: underline;
}
.run-example__dialog {
  color: theme.$gray_6;
  font-size: 14px;
  line-height: 1.5;

  p {
    margin: 0 0 10px;
  }
  ul {
    margin: 0 0 10px;
    padding-left: 18px;
  }
}
.run-example__limits {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 8px 10px;
  margin-bottom: 10px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  font-size: 12px;
}
.run-example__limits-title {
  font-weight: 600;
}
.run-example__limit.is-out {
  color: theme.$red_1;
}
.run-example__refresh {
  white-space: normal;
  height: auto;
  margin-bottom: 10px;
}
.run-example__note {
  font-size: 12px;
  color: theme.$gray_5;
}
.run-example__error {
  margin: 6px 0 0;
  font-size: 12px;
  color: theme.$red_1;
}
</style>
