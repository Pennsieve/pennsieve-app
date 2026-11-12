<script setup>
/*
  "Generate release report": the sample run of a version on a compute node
  of the owner's, when the platform's runner could not run it
  (releaseReportRun.js). Pick a node, start; the dialog follows the run and
  registers its results, after which the report is made. Reopened on a
  version whose run is on record, it picks the run up again.
*/
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useStore } from "vuex";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { nodeGpu, gpuName } from "../ComputeNodes/computeNodeHelpers";
import {
  fetchRun,
  fetchSamplePlan,
  nodeRunOffer,
  nodesFor,
  recordSampleRun,
  registerSampleResults,
  retryLater,
  runOutcome,
  sampleRunPayload,
} from "./releaseReportRun";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  app: { type: Object, default: null }, // { uuid, name }
  version: { type: Object, default: null }, // a version, with fixtures and sampleRun
});
const emit = defineEmits(["update:modelValue", "started", "registered"]);
const store = useStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});
const api2Url = computed(() => store.state.config?.api2Url || "");

// Phases: plan (loading the plan and nodes) → pick → starting → running →
// registering → done; error at any point keeps the phase it happened in.
const phase = ref("plan");
const plan = ref(null);
const nodes = ref([]);
const nodeId = ref("");
const run = ref(null); // { uuid, status }
const error = ref("");
const note = ref("");
const loading = ref(false);
let timer = null;

const offer = computed(() => nodeRunOffer(props.version));
const chosenNode = computed(() => nodes.value.find((n) => n.uuid === nodeId.value) || null);
const nodeLine = (n) => {
  const g = nodeGpu(n);
  return g ? `${n.name} · ${gpuName(g)}` : n.name;
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
onBeforeUnmount(stop);

const reset = () => {
  stop();
  phase.value = "plan";
  plan.value = null;
  run.value = null;
  error.value = "";
  note.value = "";
  nodeId.value = "";
};

const close = () => {
  visible.value = false;
};

// Follow a run until it ends, then register it.
const follow = (runId) => {
  stop();
  phase.value = "running";
  const tick = async () => {
    try {
      const r = await fetchRun(api2Url.value, runId);
      run.value = r;
      const outcome = runOutcome(r?.status);
      if (outcome === "running") return;
      stop();
      if (outcome === "failed") {
        phase.value = "failed";
        error.value = r?.errorMessage ? `The run failed: ${r.errorMessage}` : "The run did not succeed, so there are no results to report on.";
        return;
      }
      await register(runId);
    } catch (e) {
      error.value = e?.message || String(e);
    }
  };
  tick();
  timer = setInterval(tick, 15000);
};

// Register the results; while download-service is still making the
// archive, try again shortly.
const register = async (runId) => {
  phase.value = "registering";
  error.value = "";
  note.value = "The run finished. Collecting its results for the report…";
  const attempt = async () => {
    try {
      await registerSampleResults(api2Url.value, props.app.uuid, props.version.uuid, runId);
      stop();
      phase.value = "done";
      note.value = "";
      emit("registered", { runId });
    } catch (e) {
      if (retryLater(e)) {
        note.value = "The run's results are still being packed; checking again in a moment…";
        return;
      }
      stop();
      phase.value = "failed";
      error.value = e?.message || String(e);
    }
  };
  stop();
  await attempt();
  if (phase.value === "registering") timer = setInterval(attempt, 20000);
};

const load = async () => {
  reset();
  if (!props.app?.uuid || !props.version?.uuid) return;
  // A run already on record: pick it up.
  if (offer.value?.kind === "running") {
    run.value = { uuid: offer.value.runId, status: "RUNNING" };
    nodeId.value = offer.value.computeNodeId;
    follow(offer.value.runId);
    return;
  }
  loading.value = true;
  try {
    const [p] = await Promise.all([
      fetchSamplePlan(api2Url.value, props.app.uuid, props.version.uuid),
      store.dispatch("analysisModule/fetchComputeNodes", { force: true }).catch(() => {}),
    ]);
    plan.value = p;
    nodes.value = nodesFor(store.state.analysisModule.computeNodes, { gpu: !!p.gpu });
    if (nodes.value.length === 1) nodeId.value = nodes.value[0].uuid;
    phase.value = "pick";
  } catch (e) {
    phase.value = "failed";
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
};

const start = async () => {
  if (!plan.value || !nodeId.value) return;
  phase.value = "starting";
  error.value = "";
  try {
    const created = await store.dispatch("analysisModule/createRun", sampleRunPayload(plan.value, nodeId.value));
    const runId = created?.executionRunId || created?.uuid;
    if (!runId) throw new Error("workflow-service did not name the run");
    await recordSampleRun(api2Url.value, props.app.uuid, props.version.uuid, runId, nodeId.value);
    run.value = { uuid: runId, status: "RUNNING" };
    emit("started", { runId, computeNodeId: nodeId.value });
    follow(runId);
  } catch (e) {
    phase.value = "pick";
    error.value = e?.message || String(e);
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) load();
    else stop();
  }
);

const title = computed(() => `Generate release report · ${props.version?.version || ""}`);
const runLink = computed(() => (run.value?.uuid ? { name: store.state.activeOrganization?.organization?.id ? "run-detail" : "my-run-detail", params: { runId: run.value.uuid } } : null));
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="560px" append-to-body class="release-report-dialog" @closed="reset">
    <div v-if="loading" class="rr-muted">Loading…</div>

    <!-- Pick a node -->
    <template v-else-if="phase === 'pick' || phase === 'starting'">
      <p class="rr-lead">
        The platform could not run this version on its test inputs
        <template v-if="plan?.reason"> ({{ plan.reason.message || plan.reason.code }})</template>.
        Run it once on a compute node of yours; the report is made from that run.
      </p>
      <div v-if="nodes.length" class="rr-field">
        <label for="rr-node">Compute node{{ plan?.gpu ? " (with a GPU)" : "" }}</label>
        <el-select id="rr-node" v-model="nodeId" placeholder="Choose a node" class="rr-select">
          <el-option v-for="n in nodes" :key="n.uuid" :label="nodeLine(n)" :value="n.uuid" />
        </el-select>
      </div>
      <el-alert v-else type="warning" :closable="false" show-icon>
        <template #title>No {{ plan?.gpu ? "GPU " : "" }}compute node is enabled in this workspace. Add one under Compute nodes and come back.</template>
      </el-alert>
      <ul class="rr-notes">
        <li>The run uses the node's compute and bills your account for it.</li>
        <li>The outputs go into the version's release report, which is public for a public app.</li>
        <li>Inputs are the release's own test inputs, not any of your data.</li>
      </ul>
      <el-alert v-if="error" type="error" :closable="false" show-icon class="rr-error"><template #title>{{ error }}</template></el-alert>
      <div class="rr-actions">
        <bf-button class="secondary" @click="close">Cancel</bf-button>
        <bf-button :disabled="!nodeId || phase === 'starting'" :processing="phase === 'starting'" @click="start">Start the sample run</bf-button>
      </div>
    </template>

    <!-- Following the run -->
    <template v-else-if="phase === 'running' || phase === 'registering'">
      <p class="rr-lead">
        <template v-if="phase === 'running'">Running on {{ chosenNode ? chosenNode.name : "your compute node" }} · {{ run?.status || "starting" }}</template>
        <template v-else>{{ note }}</template>
      </p>
      <p v-if="phase === 'running'" class="rr-muted">
        You can close this; the run goes on. Open the version again later to finish, or
        <router-link v-if="runLink" :to="runLink">watch the run</router-link>.
      </p>
      <el-alert v-if="error" type="error" :closable="false" show-icon class="rr-error"><template #title>{{ error }}</template></el-alert>
      <div class="rr-actions">
        <bf-button class="secondary" @click="close">Close</bf-button>
      </div>
    </template>

    <!-- Done -->
    <template v-else-if="phase === 'done'">
      <p class="rr-lead">The run's results are registered. The release report is being written and appears on this page in a minute or two.</p>
      <div class="rr-actions">
        <bf-button @click="close">Done</bf-button>
      </div>
    </template>

    <!-- Failed -->
    <template v-else-if="phase === 'failed'">
      <el-alert type="error" :closable="false" show-icon><template #title>{{ error || "Something went wrong." }}</template></el-alert>
      <p v-if="runLink" class="rr-muted"><router-link :to="runLink">Open the run</router-link> to see its log.</p>
      <div class="rr-actions">
        <bf-button class="secondary" @click="close">Close</bf-button>
        <bf-button v-if="plan" @click="phase = 'pick'">Try again</bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.rr-lead {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.5;
}
.rr-muted {
  color: theme.$gray_5;
  font-size: 13px;
}
.rr-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  label {
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_6;
  }
}
.rr-select {
  width: 100%;
}
.rr-notes {
  margin: 8px 0 12px;
  padding-left: 18px;
  font-size: 13px;
  color: theme.$gray_6;
  li {
    margin-bottom: 4px;
  }
}
.rr-error {
  margin-bottom: 12px;
}
.rr-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
