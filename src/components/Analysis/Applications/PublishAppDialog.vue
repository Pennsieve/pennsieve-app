<script setup>
// Publish an app: a guided wizard (publishApp.js has the pure parts), laid
// out like the notebook dialog: what the step is for and what's chosen so
// far on the left, the step on the right.
//
//   1. Describe the app: name, what it does, where it may run, its size,
//      its inputs and outputs. The dialog writes app.yml from it.
//   2. Create the repository on GitHub, from Pennsieve's template, on
//      GitHub's own page prefilled (the author keeps their repository).
//   3. Install the Pennsieve GitHub App on it. The dialog polls the
//      repository and ticks the step when the app sees it.
//   4. Add app.yml: a pull request from here, or a copy to commit.
//   5. Publish: the first release. The app is in the gallery when its
//      image is built.
//
// The draft is kept in this browser, so closing and coming back resumes.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import * as siteConfig from "@/site-config/site.json";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { useGetToken } from "@/composables/useGetToken";
import { fetchRepository } from "./githubRepository";
import { openAppYmlPullRequest } from "./pullRequest";
import { fetchReleaseStatus, publishRelease } from "./release";
import { STANDARD_CPU_OPTIONS, getStandardMemoryOptions } from "../RunMonitor/runHelpers";
import {
  COMPUTE_CHOICES,
  STEPS,
  appYmlFor,
  clearDraft,
  installUrl,
  loadDraft,
  newDraft,
  repoUrl,
  saveDraft,
  slugify,
  stepsFor,
  templateUrl,
} from "./publishApp";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "published"]);
const store = useStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const draft = ref(loadDraft());
watch(draft, (d) => saveDraft(d), { deep: true });

// The repository name follows the app's name until the author edits it.
const repoTouched = ref(Boolean(draft.value.repo));
watch(
  () => draft.value.name,
  (name) => {
    if (!repoTouched.value) draft.value.repo = slugify(name);
  }
);
const ownerPrefilled = () => {
  if (!draft.value.owner) draft.value.owner = store.state.gitHubProfile?.login || "";
};

const memoryOptions = computed(() => getStandardMemoryOptions(draft.value.cpu));
watch(
  () => draft.value.cpu,
  () => {
    if (!memoryOptions.value.some((o) => o.value === draft.value.memory)) {
      draft.value.memory = memoryOptions.value[0]?.value || draft.value.memory;
    }
  }
);

const appYml = computed(() => appYmlFor(draft.value));
const api2Url = computed(() => store.state.config?.api2Url);
const repo = computed(() => (draft.value.owner && draft.value.repo ? { owner: draft.value.owner, repo: draft.value.repo } : null));
const repoName = computed(() => (repo.value ? `${draft.value.owner}/${draft.value.repo}` : ""));

// What the services say: the repository is known (the app is installed on
// it), and whether it has a release.
const installed = ref(false);
const released = ref(false);
const checking = ref(false);
const checkRepository = async () => {
  if (!repo.value || !api2Url.value || checking.value) return;
  checking.value = true;
  try {
    const found = await fetchRepository(api2Url.value, repo.value);
    installed.value = Boolean(found);
    if (found) {
      const latest = found.latest_release || found.latestRelease;
      if (latest?.label) {
        released.value = true;
        draft.value.releaseUrl = latest.release_url || latest.releaseUrl || draft.value.releaseUrl;
      }
    }
  } finally {
    checking.value = false;
  }
};

let poll = null;
const startPolling = () => {
  stopPolling();
  poll = setInterval(checkRepository, 6000);
};
const stopPolling = () => {
  if (poll) clearInterval(poll);
  poll = null;
};

// The steps: their state from the draft and the services, and the one shown.
const steps = computed(() => stepsFor(draft.value, { installed: installed.value, released: released.value }));
const stepState = (key) => steps.value.find((s) => s.key === key) || {};
const stepTitles = ["Describe the app", "Create the repository", "Give Pennsieve access", "Add the app.yml", "Release it"];
const stepAbouts = [
  "An app is a GitHub repository with an app.yml. Describe the app here; the dialog writes the app.yml for you, and the next steps put it on GitHub and release it.",
  "GitHub creates the repository from Pennsieve's template: a working step with a place for your code, runnable as every compute type. You keep the repository.",
  "Pennsieve reads the repository and builds its releases through the Pennsieve GitHub App. Install it on the repository, or add the repository to an installation you have.",
  "The template ships a placeholder app.yml. Replace it with the one written here: a pull request from this dialog, merged on GitHub, or a copy you commit yourself.",
  "A release publishes the app: Pennsieve builds the image and lists the app in the gallery when the build is done. Every later release is a new version.",
];
const step = ref(0);
// Where to open: the first step still to do, or the last when all are done.
const firstToDo = () => {
  const i = steps.value.findIndex((s) => s.current);
  return i < 0 ? STEPS.length - 1 : i;
};
const describeOk = computed(() => String(draft.value.name || "").trim().length >= 2);
const canNext = computed(() => {
  switch (STEPS[step.value]) {
    case "describe":
      return describeOk.value;
    case "create":
      return Boolean(repo.value) && (draft.value.created || installed.value);
    case "install":
      return installed.value;
    case "manifest":
      return draft.value.manifest;
    default:
      return false;
  }
});
const next = () => {
  if (step.value < STEPS.length - 1 && canNext.value) step.value += 1;
};
const back = () => {
  if (step.value > 0) step.value -= 1;
};
const isLast = computed(() => step.value === STEPS.length - 1);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      ownerPrefilled();
      installed.value = false;
      released.value = false;
      step.value = firstToDo();
      checkRepository().then(() => {
        step.value = firstToDo();
      });
      startPolling();
    } else {
      stopPolling();
    }
  },
  { immediate: true }
);
watch(repo, () => {
  installed.value = false;
  released.value = false;
  checkRepository();
});
// The access step ticks itself when the app sees the repository.
watch(installed, (v) => {
  if (v && STEPS[step.value] === "install") step.value += 1;
});
onBeforeUnmount(stopPolling);

// What's chosen so far, for the left column.
const runsAs = computed(() => {
  const kinds = ["container"];
  if (draft.value.lambda) kinds.push("Lambda");
  if (draft.value.gpu) kinds.push("GPU");
  return kinds.join(", ");
});
const sizeLabel = computed(() => {
  const cpu = STANDARD_CPU_OPTIONS.find((o) => o.value === draft.value.cpu)?.label || draft.value.cpu;
  const mem = memoryOptions.value.find((o) => o.value === draft.value.memory)?.label || draft.value.memory;
  return `${cpu}, ${mem}`;
});
const soFar = computed(() => {
  const rows = [];
  if (describeOk.value) {
    rows.push({ label: "Name", value: draft.value.name.trim() });
    rows.push({ label: "Runs as", value: runsAs.value });
    rows.push({ label: "Size", value: sizeLabel.value });
  }
  if (step.value >= 1 && repoName.value) {
    rows.push({ label: "Repository", value: repoName.value });
  }
  if (step.value >= 2 && repoName.value) {
    rows.push({ label: "Access", value: installed.value ? "installed" : "not yet" });
  }
  if (step.value >= 3) {
    rows.push({ label: "app.yml", value: stepState("manifest").done ? "merged" : "not yet" });
  }
  if (step.value >= 4) {
    rows.push({ label: "Release", value: released.value ? draft.value.releaseTag || "released" : "not yet" });
  }
  return rows;
});

const openExternal = (url) => window.open(url, "_blank", "noopener");
const createOnGitHub = () => {
  ownerPrefilled();
  openExternal(templateUrl(draft.value));
};
const installApp = () => openExternal(installUrl(siteConfig.githubAppUrl));

const copyAppYml = async () => {
  try {
    await navigator.clipboard.writeText(appYml.value);
    ElMessage.success("app.yml copied");
  } catch {
    ElMessage.error("Couldn't copy; select the text instead");
  }
};

// The app.yml pull request.
const prBusy = ref(false);
const prOutcome = ref(null);
const openPullRequest = async () => {
  if (!repo.value) return;
  prBusy.value = true;
  try {
    const token = await useGetToken();
    prOutcome.value = await openAppYmlPullRequest(api2Url.value, repo.value, appYml.value, token);
  } finally {
    prBusy.value = false;
  }
};
const prMessage = computed(() => {
  const o = prOutcome.value;
  if (!o) return "";
  switch (o.kind) {
    case "opened":
      return "Pull request opened. Merge it on GitHub, then tick Merged.";
    case "needsApproval":
      return "The repository's owner hasn't accepted the Pennsieve GitHub App's permissions yet.";
    case "noPush":
      return "You can't push to this repository, so commit the app.yml yourself.";
    case "notLinked":
      return "Link your GitHub account in your profile first.";
    case "unavailable":
      return "Pull requests aren't available here yet; commit the app.yml yourself.";
    default:
      return o.message || "The pull request failed.";
  }
});

// The release.
const releaseBusy = ref(false);
const releaseOutcome = ref(null);
const releaseStatus = ref(null);
const checkRelease = async () => {
  if (!repo.value || !installed.value) return;
  const token = await useGetToken();
  releaseStatus.value = await fetchReleaseStatus(api2Url.value, repo.value, token);
};
watch(installed, (v) => v && checkRelease());
const publish = async () => {
  if (!repo.value) return;
  releaseBusy.value = true;
  try {
    const token = await useGetToken();
    releaseOutcome.value = await publishRelease(api2Url.value, repo.value, { tag: draft.value.releaseTag }, token);
    if (releaseOutcome.value.kind === "released") {
      released.value = true;
      draft.value.releaseUrl = releaseOutcome.value.url;
      emit("published", { ...repo.value, tag: releaseOutcome.value.tag });
    }
  } finally {
    releaseBusy.value = false;
  }
};
const releaseMessage = computed(() => {
  const o = releaseOutcome.value;
  if (!o) return "";
  switch (o.kind) {
    case "released":
      return "Released. Pennsieve is building the image; the app appears here when it's done.";
    case "needsApproval":
      return "The repository's owner hasn't accepted the Pennsieve GitHub App's permissions yet.";
    case "noPush":
      return "You can't push to this repository.";
    case "notLinked":
      return "Link your GitHub account in your profile first.";
    case "tagExists":
      return "That tag exists already; pick a new version.";
    case "invalid":
      return o.message || "The app.yml on the default branch doesn't parse. Is the pull request merged?";
    case "nothingNew":
      return o.message || "Nothing new to release.";
    default:
      return o.message || "The release failed.";
  }
});

const startOver = () => {
  clearDraft();
  draft.value = newDraft();
  repoTouched.value = false;
  installed.value = false;
  released.value = false;
  prOutcome.value = null;
  releaseOutcome.value = null;
  releaseStatus.value = null;
  step.value = 0;
  ownerPrefilled();
};
const close = () => {
  visible.value = false;
};
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="stepTitles[step]"
    width="min(840px, 96vw)"
    append-to-body
    class="publish-app-dialog"
    :close-on-click-modal="false"
  >
    <div class="wizard-body">
      <div class="wizard-progress">
        <span
          v-for="(title, i) in stepTitles"
          :key="i"
          class="wizard-dot"
          :class="{ active: step === i, done: stepState(STEPS[i]).done }"
          :title="title"
        />
      </div>

      <div class="nb-layout">
        <aside class="nb-info">
          <p class="nb-info__about">{{ stepAbouts[step] }}</p>
          <template v-if="soFar.length">
            <h4 class="nb-info__title">This app</h4>
            <dl class="nb-info__list">
              <template v-for="row in soFar" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd :title="row.value">{{ row.value }}</dd>
              </template>
            </dl>
          </template>
        </aside>
        <div class="nb-content">
          <!-- 1. Describe -->
          <div v-if="step === 0" class="wizard-step">
            <label class="wizard-field">
              <span>Name</span>
              <el-input v-model="draft.name" placeholder="Spike Sorter" maxlength="80" />
            </label>
            <label class="wizard-field">
              <span>What it does</span>
              <el-input v-model="draft.description" type="textarea" :rows="2" placeholder="One or two sentences, shown in the gallery." maxlength="350" />
            </label>
            <label class="wizard-field">
              <span>Tags</span>
              <el-input v-model="draft.tags" placeholder="ephys, sorting" />
            </label>
            <div class="wizard-field">
              <span>Runs</span>
              <div class="wizard-choices">
                <div class="wizard-choice is-fixed">
                  <el-checkbox :model-value="true" disabled>As a container (standard)</el-checkbox>
                  <small>Any size, any duration.</small>
                </div>
                <div v-for="c in COMPUTE_CHOICES" :key="c.value" class="wizard-choice">
                  <el-checkbox v-model="draft[c.value]">{{ c.label }}</el-checkbox>
                  <small>{{ c.hint }}</small>
                </div>
              </div>
            </div>
            <div class="wizard-row">
              <label class="wizard-field">
                <span>CPU</span>
                <el-select v-model="draft.cpu" size="default">
                  <el-option v-for="o in STANDARD_CPU_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </label>
              <label class="wizard-field">
                <span>Memory</span>
                <el-select v-model="draft.memory" size="default">
                  <el-option v-for="o in memoryOptions" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
              </label>
            </div>
            <div class="wizard-row">
              <label class="wizard-field">
                <span>Inputs</span>
                <el-input v-model="draft.inputs" placeholder="data" />
                <small>Names, comma-separated. Each arrives in its own folder of INPUT_DIR.</small>
              </label>
              <label class="wizard-field">
                <span>Outputs</span>
                <el-input v-model="draft.outputs" placeholder="results" />
                <small>Each is written to its own folder of OUTPUT_DIR.</small>
              </label>
            </div>
            <details class="wizard-yml">
              <summary>Preview app.yml</summary>
              <pre>{{ appYml }}</pre>
            </details>
          </div>

          <!-- 2. Create the repository -->
          <div v-else-if="step === 1" class="wizard-step">
            <p class="wizard-step-desc">Create it on GitHub, then come back here and tick Done.</p>
            <div class="wizard-row">
              <label class="wizard-field">
                <span>GitHub owner</span>
                <el-input v-model="draft.owner" placeholder="your account or organization" />
              </label>
              <label class="wizard-field">
                <span>Repository name</span>
                <el-input v-model="draft.repo" placeholder="spike-sorter" @input="repoTouched = true" />
              </label>
            </div>
            <div class="wizard-actions">
              <bf-button :disabled="!draft.repo" @click="createOnGitHub">Create on GitHub</bf-button>
              <el-checkbox v-model="draft.created" :disabled="installed">Done</el-checkbox>
            </div>
            <p class="wizard-aside">Have a repository already? Enter it above and tick Done.</p>
          </div>

          <!-- 3. Install the GitHub App -->
          <div v-else-if="step === 2" class="wizard-step">
            <p class="wizard-step-desc">
              Install the Pennsieve GitHub App on
              <a v-if="repo" :href="repoUrl(draft)" target="_blank" rel="noopener">{{ repoName }}</a><span v-else>the repository</span>.
              This step completes itself once Pennsieve can see the repository.
            </p>
            <div class="wizard-actions">
              <bf-button @click="installApp">Install the GitHub App</bf-button>
              <bf-button class="secondary" :disabled="checking" @click="checkRepository">{{ checking ? "Checking…" : "Check now" }}</bf-button>
            </div>
            <p class="wizard-note" :class="{ 'is-ok': installed }">
              {{ installed ? "Pennsieve sees the repository." : "Waiting for the installation…" }}
            </p>
          </div>

          <!-- 4. app.yml -->
          <div v-else-if="step === 3" class="wizard-step">
            <p class="wizard-step-desc">
              Open a pull request from here and merge it on GitHub, or copy the <code>app.yml</code> and commit it
              yourself. Then tick Merged.
            </p>
            <div class="wizard-actions">
              <bf-button :disabled="!installed || prBusy" @click="openPullRequest">{{ prBusy ? "Opening…" : "Open a pull request" }}</bf-button>
              <bf-button class="secondary" @click="copyAppYml">Copy app.yml</bf-button>
              <el-checkbox v-model="draft.manifest">Merged</el-checkbox>
            </div>
            <p v-if="prMessage" class="wizard-note" :class="{ 'is-error': prOutcome && prOutcome.kind !== 'opened' }">
              {{ prMessage }}
              <a v-if="prOutcome?.url" :href="prOutcome.url" target="_blank" rel="noopener">Open it</a>
              <a v-else-if="prOutcome?.reviewUrl" :href="prOutcome.reviewUrl" target="_blank" rel="noopener">Review the permissions</a>
            </p>
            <details class="wizard-yml" open>
              <summary>app.yml</summary>
              <pre>{{ appYml }}</pre>
            </details>
          </div>

          <!-- 5. Release -->
          <div v-else class="wizard-step">
            <p class="wizard-step-desc">Pick the first version, then publish the release.</p>
            <div class="wizard-row">
              <label class="wizard-field wizard-field--short">
                <span>Version</span>
                <el-input v-model="draft.releaseTag" placeholder="v0.1.0" :disabled="released" />
              </label>
            </div>
            <p v-if="releaseStatus && releaseStatus.latestTag && !released" class="wizard-aside">
              Latest release on GitHub: {{ releaseStatus.latestTag }}.
            </p>
            <p v-if="releaseMessage" class="wizard-note" :class="{ 'is-error': releaseOutcome && releaseOutcome.kind !== 'released', 'is-ok': released }">
              {{ releaseMessage }}
              <a v-if="releaseOutcome?.url" :href="releaseOutcome.url" target="_blank" rel="noopener">See the release</a>
              <a v-else-if="releaseOutcome?.reviewUrl" :href="releaseOutcome.reviewUrl" target="_blank" rel="noopener">Review the permissions</a>
            </p>
            <p v-else-if="released && draft.releaseUrl" class="wizard-note is-ok">
              Released already.
              <a :href="draft.releaseUrl" target="_blank" rel="noopener">See the release</a>
            </p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="run-dialog-footer">
        <div class="wizard-footer-left">
          <bf-button class="secondary" @click="close">Cancel</bf-button>
          <button type="button" class="wizard-link" @click="startOver">Start over</button>
        </div>
        <div class="wizard-footer-right">
          <bf-button v-if="step > 0" class="secondary" @click="back">Back</bf-button>
          <bf-button v-if="!isLast" :disabled="!canNext" @click="next">Next</bf-button>
          <bf-button v-else-if="released" @click="close">Done</bf-button>
          <bf-button v-else :disabled="!installed || !draft.releaseTag" :processing="releaseBusy" @click="publish">
            Publish release
          </bf-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.wizard-body {
  min-height: 300px;
}

.wizard-progress {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 20px;
}
.wizard-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: theme.$gray_2;
}
.wizard-dot.active {
  background: theme.$purple_1;
}
.wizard-dot.done {
  background: theme.$green_1;
}

.nb-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 20px;
  min-height: 320px;
}
.nb-info {
  padding-right: 20px;
  border-right: 1px solid theme.$gray_2;
  font-size: 13px;
  color: theme.$gray_5;
}
.nb-info__about {
  margin: 0 0 16px;
  line-height: 1.5;
}
.nb-info__title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: theme.$gray_4;
}
.nb-info__list {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 10px;
  margin: 0;

  dt {
    color: theme.$gray_4;
  }
  dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: theme.$gray_6;
  }
}
.nb-content {
  min-width: 0;
}
/* A narrow screen: the step alone */
@media (max-width: 900px) {
  .nb-layout {
    display: block;
  }
  .nb-info {
    display: none;
  }
}

.wizard-step {
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_6;
}

.wizard-step-desc {
  color: theme.$gray_5;
  font-size: 13px;
  margin: 0 0 14px;

  code {
    background: theme.$gray_1;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 12px;
  }
}

.wizard-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
  margin-bottom: 10px;

  > span {
    font-size: 11px;
    font-weight: 600;
    color: theme.$gray_5;
  }

  small {
    font-size: 11px;
    color: theme.$gray_4;
  }

  &--short {
    flex: 0 0 160px;
  }
}

.wizard-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.wizard-choices {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wizard-choice {
  display: flex;
  flex-direction: column;

  small {
    margin-left: 24px;
    font-size: 11px;
    color: theme.$gray_4;
  }
}

.wizard-yml {
  margin: 4px 0 10px;

  summary {
    cursor: pointer;
    font-size: 12px;
    color: theme.$gray_5;
  }

  pre {
    margin: 6px 0 0;
    padding: 10px;
    max-height: 240px;
    overflow: auto;
    border-radius: 4px;
    background: theme.$gray_0;
    font-size: 11px;
    line-height: 1.45;
  }
}

.wizard-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.wizard-aside {
  margin: 0 0 8px;
  font-size: 12px;
  color: theme.$gray_4;
}

.wizard-note {
  margin: 6px 0 0;
  padding: 8px 10px;
  border-radius: 4px;
  background: theme.$gray_0;
  font-size: 12px;

  &.is-ok {
    background: theme.$teal_tint;
  }

  &.is-error {
    background: #fef3c7;
  }

  a {
    margin-left: 6px;
  }
}

.run-dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.wizard-footer-left,
.wizard-footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.wizard-footer-right {
  gap: 8px;
}

.wizard-link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_4;
  cursor: pointer;
  text-decoration: underline;
}
</style>
