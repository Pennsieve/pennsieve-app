<script setup>
/*
  A run's "Use as workflow sample output" (run page, Run Details; the API calls it the run's example): for a run that succeeded,
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
import IconCheck from "../../icons/IconCheck.vue";
import IconPDF from "../../icons/IconPDF.vue";
import IconRotateRight from "../../icons/IconRotateRight.vue";
import SampleOutputViewer from "../Workflows/SampleOutputViewer.vue";
import {
  canEditWorkflow,
  exhaustedLimit,
  jobActive,
  jobStatusText,
  limitMessage,
  limitSentence,
  POLL_MS,
  setExampleError,
} from "../Workflows/runExamples";

const props = defineProps({
  // "header": the run page's header (primary button, status inline); "panel": stacked.
  placement: { type: String, default: "panel" },
  // The run (analysisModule's selectedWorkflowActivity).
  run: { type: Object, default: null },
});

const store = useStore();

const canEdit = ref(false);
const available = ref(false); // GET /runs/{id}/example answered
const job = ref(null);
const limits = ref(null);
const example = ref(null); // this run's example, once known (pdfUrl signed)
const currentSample = ref(null); // the version's sample output now (null: none or unknown)

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
// The version's current example (null: none, undefined: not known yet), for the dialog's wording.
const versionExample = ref(undefined);
const versionExampleIsThisRun = computed(() => !!versionExample.value && versionExample.value.runId === runId.value);
// This run is the version's sample output now (and nothing is being generated for it).
const isCurrentSample = computed(
  () => !!currentSample.value && currentSample.value.runId === runId.value && !jobActive(job.value)
);
const loadCurrentSample = async (seq) => {
  if (!version.value || !props.run?.workflowUuid) return;
  try {
    const found = await store.dispatch("analysisModule/fetchWorkflowVersionExample", {
      uuid: props.run.workflowUuid,
      version: version.value,
    });
    if (seq === undefined || seq === loadSeq) currentSample.value = found || null;
  } catch {
    // shown as not the sample output
  }
};
const shown = computed(() => succeeded.value && canEdit.value && available.value);
const hasPdf = computed(() => job.value?.status === "READY");
const exhausted = computed(() => exhaustedLimit(limits.value));
const limitText = computed(() => limitSentence(limits.value));

const schedulePoll = (seq) => {
  stopPolling();
  if (!jobActive(job.value)) return;
  pollTimer = setTimeout(async () => {
    if (seq !== loadSeq) return;
    try {
      const status = await store.dispatch("analysisModule/fetchRunExample", runId.value);
      if (seq !== loadSeq) return;
      if (status) {
        const wasActive = jobActive(job.value);
        job.value = status.job;
        limits.value = status.limits;
        if (wasActive && status.job?.status === "READY") await loadCurrentSample(seq);
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
  currentSample.value = null;
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
    await loadCurrentSample(seq);
    if (seq !== loadSeq) return;
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

// regenerate: opened from "Regenerate" on a run that is already the sample output.
const openDialog = async (regenerate = false) => {
  dialogError.value = "";
  refresh.value = regenerate === true;
  versionExample.value = undefined;
  dialogOpen.value = true;
  // Whether the version has an example now, and from which run.
  if (version.value && props.run?.workflowUuid) {
    store
      .dispatch("analysisModule/fetchWorkflowVersionExample", { uuid: props.run.workflowUuid, version: version.value })
      .then((found) => (versionExample.value = found || null))
      .catch(() => (versionExample.value = undefined));
  }
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
    if (result.example) {
      example.value = { ...result.example, fetchedAt: Date.now() };
      currentSample.value = result.example; // reused or restored: it is the sample output now
    }
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

const viewerOpen = ref(false);
const viewerSubtitle = computed(() =>
  [version.value ? `Version ${version.value}` : "", `run ${(props.run?.name || "").trim() || runId.value}`]
    .filter(Boolean)
    .join(" · ")
);
const viewPdf = () => {
  openError.value = "";
  viewerOpen.value = true;
};

defineExpose({ openDialog });
</script>

<template>
  <div v-if="shown" class="run-example" :class="`run-example--${placement}`">
    <!-- Header, this run is the sample output: a status pill and two icon actions. -->
    <template v-if="isCurrentSample && placement === 'header'">
      <span class="run-example__actions">
        <el-tooltip content="Regenerate the sample output PDF from this run" placement="bottom">
          <button type="button" class="run-example__icon" aria-label="Regenerate the sample output PDF" @click="openDialog(true)">
            <IconRotateRight :width="16" :height="16" color="currentColor" />
          </button>
        </el-tooltip>
        <el-tooltip content="View the sample output PDF" placement="bottom">
          <button type="button" class="run-example__icon" aria-label="View the sample output PDF" @click="viewPdf">
            <IconPDF :width="18" :height="18" color="currentColor" />
          </button>
        </el-tooltip>
      </span>
      <el-tooltip :content="`This run is the sample output of version ${version} of the workflow.`" placement="bottom">
        <span class="run-example__pill" role="status">
          <IconCheck :width="14" :height="14" color="currentColor" />
          Workflow sample output
        </span>
      </el-tooltip>
    </template>
    <template v-else-if="isCurrentSample">
      <bf-button class="secondary run-example__btn" disabled>✓ Workflow sample output (version {{ version }})</bf-button>
      <div class="run-example__status" role="status">
        <span>This run is the workflow's sample output.</span>
        <button type="button" class="run-example__link" @click="viewPdf">View PDF</button>
        <button type="button" class="run-example__link" @click="openDialog(true)">Regenerate</button>
      </div>
    </template>
    <template v-else>
      <bf-button
        :class="[placement === 'header' ? 'primary' : 'secondary', 'run-example__btn']"
        :disabled="jobActive(job)"
        @click="openDialog()"
      >
        Use as workflow sample output
      </bf-button>
      <div v-if="job" class="run-example__status" role="status" :class="`is-${(job.status || '').toLowerCase()}`">
        <span>{{ jobStatusText(job) }}</span>
        <button v-if="hasPdf" type="button" class="run-example__link" @click="viewPdf">View sample output PDF</button>
      </div>
    </template>
    <p v-if="openError" class="run-example__error">{{ openError }}</p>

    <SampleOutputViewer
      v-model="viewerOpen"
      :source="pdfUrl"
      :workflow-name="run?.workflowName || ''"
      :version="version"
      :subtitle="viewerSubtitle"
    />

    <el-dialog
      v-model="dialogOpen"
      title="Use as workflow sample output"
      width="520px"
      :close-on-click-modal="!submitting"
      :show-close="!submitting"
      align-center
      append-to-body
    >
      <div class="run-example__dialog">
        <p>
          Pennsieve will generate a <strong>PDF summary of this run's outputs</strong> and show it with the
          workflow as its sample output: a representative example of what the workflow produces.
        </p>
        <ul>
          <li>Figures and data are copied from the outputs the run saved to datasets; nothing is redrawn or recomputed.</li>
          <li>Captions and a short overview are written by AI and labelled as such in the PDF.</li>
          <li>Generating it takes about a minute.</li>
        </ul>
        <p class="run-example__target">
          <template v-if="!version">It becomes the sample output of this run's workflow version.</template>
          <template v-else-if="versionExampleIsThisRun">
            This run is already the sample output of <strong>version {{ version }}</strong>.
          </template>
          <template v-else-if="versionExample">
            It replaces the current sample output of <strong>version {{ version }}</strong>
            (from run {{ versionExample.runName || versionExample.runId }}).
          </template>
          <template v-else-if="versionExample === null">
            <strong>Version {{ version }}</strong> has no sample output yet; this summary becomes it.
          </template>
          <template v-else>It becomes the sample output of <strong>version {{ version }}</strong>.</template>
          Everyone who can see the workflow can open it.
        </p>

        <p v-if="limitText" class="run-example__note">{{ limitText }}</p>

        <el-checkbox v-if="hasPdf" v-model="refresh" class="run-example__refresh">
          Regenerate: this run already has a sample output PDF; generate a new one (counts against today's limits)
        </el-checkbox>

        <p v-if="exhausted && !dialogError" class="run-example__error">
          {{ limitMessage(exhausted.key) }}
        </p>
        <p v-if="jobActive(job)" class="run-example__note">A sample output of this run is being generated now.</p>
        <p v-if="dialogError" class="run-example__error" role="alert">{{ dialogError }}</p>
      </div>
      <template #footer>
        <div class="run-example__footer">
        <bf-button class="secondary" :disabled="submitting" @click="dialogOpen = false">Cancel</bf-button>
        <bf-button
          class="primary"
          :processing="submitting"
          processing-text="Setting…"
          :disabled="!!exhausted || jobActive(job)"
          @click="confirm"
        >
          {{ hasPdf && !refresh ? "Use this run's PDF" : "Use as workflow sample output" }}
        </bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.run-example__pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: theme.$green_tint;
  color: theme.$green_2;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}
.run-example__actions {
  display: inline-flex;
  gap: 6px;
}
.run-example__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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
.run-example.run-example--header {
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  gap: 12px;
  margin: 0;

  .run-example__btn {
    width: auto;
    margin: 0;
  }
  .run-example__status {
    margin: 0;
    font-size: 13px;
  }
}
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
.run-example__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
