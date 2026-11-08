<script setup>
// The session's environment: one of the user's environments (environments-
// service) over the image's own packages, picked while the session runs. The
// session's sidecar fetches it with the run's own credential, unpacks it and
// restarts the kernel (useJupyterSession switchEnvironment); the notebook
// stays, its variables are cleared. Hidden for R kernels, on sites without
// environments-service, and on sessions from before environments.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRememberedFold } from "./sectionFold";
import { ElMessage, ElMessageBox } from "element-plus";
import { ArrowRight } from "@element-plus/icons-vue";
import IconWarningCircle from "@/components/icons/IconWarningCircle.vue";
import { environmentsServiceUrl, getEnvironment, kernelLanguage, listEnvironments } from "@/utils/environmentsService";
import { SessionEnvironmentsUnavailable } from "@/composables/useJupyterSession";
import {
  environmentChoices,
  fromEnvironment,
  gpuEnvironmentWarning,
  gpuFrameworks,
  matchesQuery,
  packageSummary,
  requirementsText,
  switchBusy,
  switchLabel,
} from "./environmentHelpers";

const props = defineProps({
  environmentState: { type: Function, required: true },
  switchEnvironment: { type: Function, required: true },
  clearEnvironment: { type: Function, required: true },
  ready: { type: Boolean, default: false },
  // The kernel's language and version, e.g. "Python 3.12.3".
  kernelName: { type: String, default: "" },
  // A GPU session: environments that bring torch, tensorflow or jax are
  // warned about (their copy can replace the image's CUDA build).
  gpu: { type: Boolean, default: false },
  // Asks the kernel which packages it can import ([{ name, version }]).
  kernelPackages: { type: Function, default: null },
});

const available = ref(false); // the site has environments-service
const outdated = ref(false); // the session's node predates environments
// Folded or not, remembered in this browser.
const collapsed = useRememberedFold("environment");
const loading = ref(false);
const error = ref(null);

const environments = ref([]);
const versionsById = ref({}); // all versions, for environments whose latest isn't ready
const active = ref(null); // { environmentId, version } from the sidecar
const sw = ref(null); // the sidecar's latest switch
const picked = ref("");
const query = ref("");

// Python and R kernels load environments of their language.
const language = computed(() => kernelLanguage(props.kernelName));
const choices = computed(() => environmentChoices(environments.value, props.kernelName, versionsById.value));
const shown = computed(() => choices.value.filter((c) => matchesQuery(c, query.value)));
const busy = computed(() => switchBusy(sw.value));
const progress = computed(() => switchLabel(sw.value));
const failed = computed(() => (sw.value?.state === "failed" ? sw.value.error : ""));

/* ---------------------------------------------------- installed packages --- */
// What the kernel can import, asked when the list opens (and on Refresh):
// the image's, the environment's and any installed in the session. The
// environment's own are marked.
const packagesOpen = ref(false);
const packages = ref(null); // [{ name, version, fromEnvironment }]
const packagesLoading = ref(false);
const packagesError = ref("");
const packagesQuery = ref("");
const currentSpecs = computed(() => {
  if (!active.value) return [];
  const choice = choices.value.find((c) => c.id === active.value.environmentId);
  return choice?.version === active.value.version ? choice.packages : [];
});
const packagesShown = computed(() => {
  const q = packagesQuery.value.trim().toLowerCase();
  const list = fromEnvironment(packages.value || [], currentSpecs.value);
  return q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;
});
const fromEnvCount = computed(() => fromEnvironment(packages.value || [], currentSpecs.value).filter((p) => p.fromEnvironment).length);

async function loadPackages() {
  if (!props.kernelPackages || packagesLoading.value) return;
  packagesLoading.value = true;
  packagesError.value = "";
  try {
    const list = await props.kernelPackages();
    if (!list) throw new Error("The kernel didn't list its packages.");
    packages.value = list;
  } catch (e) {
    packagesError.value = e?.message || String(e);
  } finally {
    packagesLoading.value = false;
  }
}
function openPackages() {
  packagesOpen.value = true;
  packagesQuery.value = "";
  if (!packages.value) loadPackages();
}
function copyRequirements() {
  navigator.clipboard
    ?.writeText(requirementsText(packages.value))
    .then(() => ElMessage.success("Copied as requirements.txt"))
    .catch(() => {});
}

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
    gpuWarning: props.gpu && packages ? gpuEnvironmentWarning(packages) : "",
  };
});
// On a GPU session, an option's frameworks that would shadow the image's.
const optionGpuNote = (c) => (props.gpu ? gpuFrameworks(c.packages).join(", ") : "");

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
    const others = list.filter((e) => (e.language || "python") === language.value && e.latest?.status !== "ready" && e.latestVersion > 1);
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
    packages.value = null; // the kernel restarted with others
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

// Picking an environment is the switch: confirmed, since the kernel
// restarts. Picking the active one, or cancelling, changes nothing.
async function use(id) {
  const c = choices.value.find((x) => x.id === id);
  picked.value = "";
  changing.value = false;
  if (!c || c.disabled || busy.value) return;
  if (active.value?.environmentId === c.id && active.value?.version === c.version) return;
  // On a GPU session, the warning comes before the switch too.
  const warning = props.gpu ? gpuEnvironmentWarning(c.packages) : "";
  if (!(await confirmRestart(`Use ${c.name}?`, warning ? `${warning} ${RESTART_NOTE}` : RESTART_NOTE, "Use and restart"))) return;
  await send(() => props.switchEnvironment(c.id, c.version));
}

// With an environment in use, the list shows only on "Change".
const changing = ref(false);
const showPicker = computed(() => !current.value || changing.value);

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
  <div v-if="available" class="env" :class="{ 'env--collapsed': collapsed }">
    <button class="env__head" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <span class="env__title">Environment</span>
      <span v-if="collapsed && !outdated" class="env__peek">{{ current ? current.name : "Image packages" }}</span>
      <el-icon class="env__chevron" :class="{ 'is-open': !collapsed }"><ArrowRight /></el-icon>
    </button>

    <div v-if="!collapsed" class="env__body">
      <p v-if="outdated" class="env__msg">
        Update this notebook's compute node to switch environments, then start a new notebook.
      </p>
      <template v-else>
      <div class="env__current">
        <template v-if="current">
          <div class="env__name">{{ current.name }}</div>
          <div class="env__sub">
            Version {{ current.version }}<template v-if="current.packages"> · {{ current.packages }}</template>
          </div>
          <p v-if="current.gpuWarning" class="env__msg env__msg--warn">
            <IconWarningCircle :width="12" :height="12" class="env__warn" />{{ current.gpuWarning }}
          </p>
        </template>
        <template v-else>
          <div class="env__name env__name--none">Image packages only</div>
          <div class="env__sub">Pick an environment to add your packages; the kernel restarts.</div>
        </template>
      </div>

      <!-- With no environment (or while choosing one): the image's packages. -->
      <div v-if="kernelPackages && ready && !(current && !showPicker && !busy && choices.length)" class="env__actions env__actions--end">
        <button class="env__link env__packages" @click="openPackages">Installed packages</button>
      </div>

      <p v-if="busy" class="env__msg env__msg--busy">
        <span class="env__spinner" aria-hidden="true" />{{ progress }}
      </p>
      <p v-else-if="failed" class="env__msg env__msg--error">
        <IconWarningCircle :width="12" :height="12" class="env__warn" />{{ failed }}
      </p>
      <p v-else-if="error" class="env__msg env__msg--error">{{ error }}</p>

      <template v-if="choices.length">
        <div v-if="current && !showPicker && !busy" class="env__actions">
          <button class="env__link" @click="changing = true">Change</button>
          <button class="env__link env__link--quiet" @click="stopUsing">Stop using</button>
          <button v-if="kernelPackages && ready" class="env__link env__packages" @click="openPackages">Installed packages</button>
        </div>
        <el-select
          v-if="showPicker"
          :model-value="picked"
          class="env__select"
          size="small"
          filterable
          :filter-method="(q) => (query = q)"
          placeholder="Choose an environment…"
          no-match-text="No environment has that name or package"
          :disabled="busy"
          :automatic-dropdown="changing"
          @change="use"
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
            <div v-if="optionGpuNote(c)" class="env__option-gpu">Brings its own {{ optionGpuNote(c) }}: may not use the GPU</div>
          </el-option>
        </el-select>
        <button v-if="changing && !busy" class="env__link env__link--quiet" @click="changing = false">Cancel</button>
      </template>
      <p v-else-if="!loading" class="env__msg">You have no environments yet.</p>
      <p v-else class="env__msg">Loading your environments…</p>
      </template>
    </div>

    <!-- What the kernel can import, asked from the kernel itself. -->
    <el-dialog v-model="packagesOpen" title="Installed packages" width="min(560px, 94vw)" append-to-body>
      <div class="pk__bar">
        <el-input v-model="packagesQuery" size="small" placeholder="Filter packages…" clearable class="pk__filter" />
        <button class="env__link" :disabled="packagesLoading" @click="loadPackages">Refresh</button>
        <button class="env__link" :disabled="!packages?.length" @click="copyRequirements">Copy as requirements.txt</button>
      </div>
      <p v-if="packages" class="pk__count">
        {{ packages.length }} packages the kernel can import<template v-if="current && fromEnvCount">, {{ fromEnvCount }} from {{ current.name }}</template>: the image's, the
        environment's and any you installed in this session.
      </p>
      <p v-if="packagesLoading" class="env__msg">Asking the kernel… (it answers once a running cell finishes)</p>
      <p v-else-if="packagesError" class="env__msg env__msg--error">{{ packagesError }}</p>
      <ul v-if="packages && !packagesLoading" class="pk__list">
        <li v-for="p in packagesShown" :key="p.name" class="pk__row">
          <span class="pk__name">{{ p.name }}</span>
          <!-- Always a cell, so the versions line up. -->
          <span class="pk__tag-cell">
            <span v-if="p.fromEnvironment" class="pk__tag" :title="`${current?.name} asks for it`">environment</span>
          </span>
          <span class="pk__version">{{ p.version }}</span>
        </li>
        <li v-if="!packagesShown.length" class="env__msg">No package by that name.</li>
      </ul>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use "sass:color";
@use "../../../styles/theme";

.env {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-bottom: 1px solid color.mix(theme.$gray_2, theme.$gray_3); /* between sections: a touch stronger than the lines inside */
  border-right: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  font-size: 13px;
}
/* Section header as the workflow builder's panel headings (_sidePanel.scss
   .panel-heading): a small uppercase label on the panel's own background,
   no line under it (sections are set apart by a stronger line between
   them); its actions and chevron on the right. */
.env__head {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-bottom: none;
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.env--collapsed .env__head {
  border-bottom: none;
}
.env__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
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
  font-weight: 500;
  color: theme.$gray_6;
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
/* At the end of the actions row. */
.env__packages {
  margin-left: auto;
}
.env__actions--end {
  justify-content: flex-end;
}
.pk__bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pk__filter {
  flex: 1;
}
.pk__count {
  margin: 10px 0 6px;
  font-size: 12px;
  color: theme.$gray_4;
}
.pk__list {
  max-height: 50vh;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
}
/* Columns: name, the environment's tag, version (left-aligned). */
.pk__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 88px;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-bottom: 1px solid theme.$gray_1;
  font-size: 13px;
}
.pk__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: theme.$gray_6;
}
.pk__tag {
  padding: 0 6px;
  border-radius: 8px;
  background: theme.$purple_tint;
  font-size: 11px;
  color: theme.$purple_2;
}
.pk__tag-cell {
  display: flex;
}
.pk__version {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 12px;
  color: theme.$gray_5;
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
.env__link--quiet {
  color: theme.$gray_5;
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
.env__option-gpu {
  font-size: 11px;
  line-height: 1.3;
  color: theme.$red_2;
}
.env__msg--warn {
  color: theme.$gray_6;
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
