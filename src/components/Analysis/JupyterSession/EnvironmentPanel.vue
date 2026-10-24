<script setup>
// The session's environment: one of the user's environments (environments-
// service) over the image's own packages, picked while the session runs. The
// session's sidecar fetches it with the run's own credential, unpacks it and
// restarts the kernel (useJupyterSession switchEnvironment); the notebook
// stays, its variables are cleared. Hidden for R kernels, on sites without
// environments-service, and on sessions from before environments.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowRight } from "@element-plus/icons-vue";
import IconWarningCircle from "@/components/icons/IconWarningCircle.vue";
import { environmentsServiceUrl, getEnvironment, listEnvironments } from "@/utils/environmentsService";
import { SessionEnvironmentsUnavailable } from "@/composables/useJupyterSession";
import { environmentChoices, matchesQuery, packageSummary, switchBusy, switchLabel } from "./environmentHelpers";

const props = defineProps({
  environmentState: { type: Function, required: true },
  switchEnvironment: { type: Function, required: true },
  clearEnvironment: { type: Function, required: true },
  ready: { type: Boolean, default: false },
  // The kernel's language and version, e.g. "Python 3.12.3".
  kernelName: { type: String, default: "" },
});

const available = ref(false); // the site has environments-service
const outdated = ref(false); // the session's node predates environments
const collapsed = ref(false);
const loading = ref(false);
const error = ref(null);

const environments = ref([]);
const versionsById = ref({}); // all versions, for environments whose latest isn't ready
const active = ref(null); // { environmentId, version } from the sidecar
const sw = ref(null); // the sidecar's latest switch
const picked = ref("");
const query = ref("");

const isPython = computed(() => !props.kernelName || props.kernelName.toLowerCase().startsWith("python"));
const choices = computed(() => environmentChoices(environments.value, props.kernelName, versionsById.value));
const shown = computed(() => choices.value.filter((c) => matchesQuery(c, query.value)));
const busy = computed(() => switchBusy(sw.value));
const progress = computed(() => switchLabel(sw.value));
const failed = computed(() => (sw.value?.state === "failed" ? sw.value.error : ""));

// The active environment, named from the user's list (the sidecar knows ids).
const current = computed(() => {
  if (!active.value) return null;
  const env = environments.value.find((e) => e.id === active.value.environmentId);
  const choice = choices.value.find((c) => c.id === active.value.environmentId);
  const packages = choice?.version === active.value.version ? choice.packages : null;
  return {
    name: env?.name || "An environment",
    version: active.value.version,
    packages: packages ? packageSummary(packages) : "",
  };
});
const pickedChoice = computed(() => choices.value.find((c) => c.id === picked.value) || null);
const pickedIsActive = computed(
  () => !!pickedChoice.value && active.value?.environmentId === pickedChoice.value.id && active.value?.version === pickedChoice.value.version
);

const POLL_MS = 1500;
let pollTimer = null;

async function load() {
  if (!environmentsServiceUrl()) return;
  loading.value = true;
  error.value = null;
  try {
    available.value = true;
    await readState();
    const list = await listEnvironments();
    environments.value = list;
    // An environment whose latest version is building or failed may still
    // have an older ready one.
    const others = list.filter((e) => e.language === "python" && e.latest?.status !== "ready" && e.latestVersion > 1);
    const read = await Promise.all(others.map((e) => getEnvironment(e.id).catch(() => null)));
    versionsById.value = Object.fromEntries(others.map((e, i) => [e.id, read[i]?.versions || []]));
  } catch (e) {
    if (e instanceof SessionEnvironmentsUnavailable) {
      outdated.value = true;
      return;
    }
    console.warn("[environment]", e?.message || e);
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function readState() {
  const state = await props.environmentState();
  const wasBusy = busy.value;
  active.value = state.active;
  sw.value = state.switch;
  if (wasBusy && sw.value?.state === "done") {
    ElMessage.success(active.value ? `Using ${current.value?.name}. The kernel restarted.` : "Back to the image's packages. The kernel restarted.");
  }
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  pollTimer = null;
  if (!busy.value) return;
  pollTimer = setTimeout(async () => {
    try {
      await readState();
    } catch (e) {
      console.warn("[environment] state:", e?.message || e);
      schedulePoll();
    }
  }, POLL_MS);
}

async function confirmRestart(title, message, confirmButtonText) {
  try {
    await ElMessageBox.confirm(message, title, { confirmButtonText, cancelButtonText: "Cancel", type: "warning" });
    return true;
  } catch (_) {
    return false;
  }
}

const RESTART_NOTE = "The kernel restarts: your notebook stays, but its variables are cleared.";

async function use() {
  const c = pickedChoice.value;
  if (!c || c.disabled || busy.value) return;
  if (!(await confirmRestart(`Use ${c.name}?`, RESTART_NOTE, "Use and restart"))) return;
  await send(() => props.switchEnvironment(c.id, c.version));
}

async function stopUsing() {
  if (busy.value) return;
  if (!(await confirmRestart("Stop using this environment?", `Only the image's packages stay. ${RESTART_NOTE}`, "Stop and restart"))) return;
  await send(() => props.clearEnvironment());
}

async function send(request) {
  try {
    const state = await request();
    active.value = state.active;
    sw.value = state.switch;
    schedulePoll();
  } catch (e) {
    ElMessage.error(e?.message || String(e));
  }
}

watch(
  () => props.ready,
  (ready) => {
    if (ready && !available.value && !outdated.value && !loading.value) load();
  },
  { immediate: true }
);
onBeforeUnmount(() => clearTimeout(pollTimer));
</script>

<template>
  <div v-if="available && isPython" class="env" :class="{ 'env--collapsed': collapsed }">
    <button class="env__head" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <span class="env__title">Environment</span>
      <span v-if="collapsed && !outdated" class="env__peek">{{ current ? current.name : "Image packages" }}</span>
      <el-icon class="env__chevron" :class="{ 'is-open': !collapsed }"><ArrowRight /></el-icon>
    </button>

    <div v-if="!collapsed" class="env__body">
      <p v-if="outdated" class="env__msg">
        This notebook's compute node needs an update before it can switch environments. Update the node, then start
        a new notebook.
      </p>
      <template v-else>
      <div class="env__current">
        <template v-if="current">
          <div class="env__name">{{ current.name }}</div>
          <div class="env__sub">
            Version {{ current.version }}<template v-if="current.packages"> · {{ current.packages }}</template>
          </div>
        </template>
        <template v-else>
          <div class="env__name env__name--none">Image packages only</div>
          <div class="env__sub">Pick an environment to add your packages.</div>
        </template>
      </div>

      <p v-if="busy" class="env__msg env__msg--busy">
        <span class="env__spinner" aria-hidden="true" />{{ progress }}
      </p>
      <p v-else-if="failed" class="env__msg env__msg--error">
        <IconWarningCircle :width="12" :height="12" class="env__warn" />{{ failed }}
      </p>
      <p v-else-if="error" class="env__msg env__msg--error">{{ error }}</p>

      <template v-if="choices.length">
        <el-select
          v-model="picked"
          class="env__select"
          size="small"
          filterable
          :filter-method="(q) => (query = q)"
          placeholder="Choose an environment…"
          no-match-text="No environment has that name or package"
          :disabled="busy"
          @visible-change="(open) => open || (query = '')"
        >
          <el-option
            v-for="c in shown"
            :key="c.id"
            :value="c.id"
            :label="c.name"
            :disabled="!!c.disabled"
            class="env__option"
          >
            <div class="env__option-name">
              {{ c.name }}
              <span v-if="c.official" class="env__tag">Pennsieve</span>
              <span class="env__option-state">{{ c.disabled || `v${c.version}` }}</span>
            </div>
            <div v-if="c.packages.length" class="env__option-packages">{{ packageSummary(c.packages) }}</div>
          </el-option>
        </el-select>
        <div class="env__actions">
          <el-button
            type="primary"
            size="small"
            :disabled="!pickedChoice || !!pickedChoice.disabled || pickedIsActive || busy"
            @click="use"
          >
            {{ pickedIsActive ? "In use" : "Use and restart kernel" }}
          </el-button>
          <button v-if="current && !busy" class="env__link" @click="stopUsing">Stop using</button>
        </div>
      </template>
      <p v-else-if="!loading" class="env__msg">You have no environments yet.</p>
      <p v-else class="env__msg">Loading your environments…</p>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.env {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-bottom: 1px solid theme.$gray_2;
  border-right: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 13px;
}
/* Section header as the app's side-panel accordions: title, chevron right. */
.env__head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 10px;
  border: none;
  border-bottom: 1px solid theme.$gray_2;
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.env--collapsed .env__head {
  border-bottom: none;
}
.env__title {
  font-weight: 600;
  font-size: 13px;
  color: theme.$gray_6;
}
.env__peek {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_4;
}
.env__chevron {
  margin-left: auto;
  color: theme.$gray_5;
  transition: transform 0.2s ease;
}
.env__chevron.is-open {
  transform: rotate(90deg);
}
.env__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px 10px;
}
.env__name {
  font-weight: 600;
  color: theme.$black;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.env__name--none {
  font-weight: 500;
  color: theme.$gray_5;
}
.env__sub {
  margin-top: 2px;
  font-size: 11px;
  color: theme.$gray_4;
}
.env__select {
  width: 100%;
}
.env__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.env__link {
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 12px;
  color: theme.$purple_2;
  cursor: pointer;
}
.env__link:hover {
  text-decoration: underline;
}
.env__msg {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: theme.$gray_4;
}
.env__msg--busy {
  align-items: center;
  color: theme.$gray_6;
}
.env__msg--error {
  color: theme.$red_2;
  white-space: pre-wrap;
  word-break: break-word;
}
.env__warn {
  flex-shrink: 0;
  margin-top: 2px;
}
.env__spinner {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border: 2px solid theme.$gray_3;
  border-top-color: theme.$purple_2;
  border-radius: 50%;
  animation: env-spin 0.8s linear infinite;
}
@keyframes env-spin {
  to {
    transform: rotate(360deg);
  }
}
.env__option {
  height: auto;
  padding-top: 4px;
  padding-bottom: 4px;
  line-height: 1.3;
}
.env__option-name {
  display: flex;
  align-items: center;
  gap: 6px;
}
.env__option-state {
  margin-left: auto;
  font-size: 11px;
  color: theme.$gray_4;
}
.env__option-packages {
  font-size: 11px;
  color: theme.$gray_4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.env__tag {
  padding: 0 4px;
  border-radius: 3px;
  background: theme.$purple_tint;
  color: theme.$purple_2;
  font-size: 10px;
  font-weight: 600;
}
</style>
