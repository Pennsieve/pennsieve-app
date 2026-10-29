<script setup>
// Publish an app: a guided wizard (publishApp.js has the pure parts).
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
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      ownerPrefilled();
      installed.value = false;
      released.value = false;
      checkRepository();
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
onBeforeUnmount(stopPolling);

const steps = computed(() => stepsFor(draft.value, { installed: installed.value, released: released.value }));
const stepState = (key) => steps.value.find((s) => s.key === key) || {};
// The current step is open unless the author opened another, or closed it
// ("none"); a done step can be opened to look.
const openStep = ref("");
const isOpen = (key) => (openStep.value ? openStep.value === key : stepState(key).current);
const toggle = (key) => {
  if (isOpen(key)) {
    openStep.value = stepState(key).current ? "none" : "";
  } else {
    openStep.value = key;
  }
};
const describeOk = computed(() => String(draft.value.name || "").trim().length >= 2);

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
    if (prOutcome.value.kind === "opened") draft.value.manifest = true;
  } finally {
    prBusy.value = false;
  }
};
const prMessage = computed(() => {
  const o = prOutcome.value;
  if (!o) return "";
  switch (o.kind) {
    case "opened":
      return "Pull request opened. Merge it on GitHub, then publish.";
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
      return "Released. Pennsieve is building the image; the app is in the gallery when it's done.";
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
  openStep.value = "";
  ownerPrefilled();
};
const close = () => {
  visible.value = false;
};
</script>

<template>
  <el-dialog v-model="visible" title="Publish an app" width="680px" append-to-body class="publish-app-dialog" @closed="openStep = ''">
    <p class="wizard-lead">
      An app is a repository with an <code>app.yml</code>. Describe it here, create the repository from
      Pennsieve's template, install the Pennsieve GitHub App on it, and publish the first release.
    </p>

    <ol class="wizard-steps">
      <!-- 1. Describe -->
      <li class="wizard-step" :class="{ 'is-done': stepState('describe').done, 'is-current': stepState('describe').current, 'is-open': isOpen('describe') }">
        <button type="button" class="wizard-step-head" @click="toggle('describe')">
          <span class="wizard-mark">{{ stepState("describe").done ? "✓" : "1" }}</span>
          <span class="wizard-title">Describe the app</span>
          <span v-if="stepState('describe').done && !isOpen('describe')" class="wizard-summary">{{ draft.name }}</span>
        </button>
        <div v-if="isOpen('describe')" class="wizard-body">
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
            <span>Where it may run</span>
            <div class="wizard-choices">
              <div class="wizard-choice is-fixed">
                <el-checkbox :model-value="true" disabled>As an ECS task (standard)</el-checkbox>
                <small>Any size, any duration. Always on.</small>
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
            <summary>The app.yml this writes</summary>
            <pre>{{ appYml }}</pre>
          </details>
          <div class="wizard-actions">
            <bf-button :disabled="!describeOk" @click="openStep = 'create'">Next</bf-button>
          </div>
        </div>
      </li>

      <!-- 2. Create the repository -->
      <li class="wizard-step" :class="{ 'is-done': stepState('create').done, 'is-current': stepState('create').current, 'is-open': isOpen('create') }">
        <button type="button" class="wizard-step-head" @click="toggle('create')">
          <span class="wizard-mark">{{ stepState("create").done ? "✓" : "2" }}</span>
          <span class="wizard-title">Create the repository</span>
          <span v-if="repo && !isOpen('create')" class="wizard-summary">{{ draft.owner }}/{{ draft.repo }}</span>
        </button>
        <div v-if="isOpen('create')" class="wizard-body">
          <p>
            GitHub creates it from Pennsieve's template, which has a working step to fill in and runs as every compute type.
            Pick the owner and name, create it on GitHub, then come back.
          </p>
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
            <el-checkbox v-model="draft.created" :disabled="installed">I created it</el-checkbox>
            <span class="wizard-aside">Already have a repository? Enter it above and tick this.</span>
          </div>
        </div>
      </li>

      <!-- 3. Install the GitHub App -->
      <li class="wizard-step" :class="{ 'is-done': stepState('install').done, 'is-current': stepState('install').current, 'is-open': isOpen('install') }">
        <button type="button" class="wizard-step-head" @click="toggle('install')">
          <span class="wizard-mark">{{ stepState("install").done ? "✓" : "3" }}</span>
          <span class="wizard-title">Install the Pennsieve GitHub App on it</span>
          <span v-if="installed && !isOpen('install')" class="wizard-summary">installed</span>
        </button>
        <div v-if="isOpen('install')" class="wizard-body">
          <p>
            Pennsieve reads the repository and publishes releases through its GitHub App. Install it on
            <a v-if="repo" :href="repoUrl(draft)" target="_blank" rel="noopener">{{ draft.owner }}/{{ draft.repo }}</a><span v-else>the repository</span>,
            or add the repository to an installation you have. This step ticks itself once Pennsieve sees it.
          </p>
          <div class="wizard-actions">
            <bf-button @click="installApp">Install the GitHub App</bf-button>
            <bf-button class="secondary" :disabled="checking" @click="checkRepository">{{ checking ? "Checking…" : "Check now" }}</bf-button>
          </div>
        </div>
      </li>

      <!-- 4. app.yml -->
      <li class="wizard-step" :class="{ 'is-done': stepState('manifest').done, 'is-current': stepState('manifest').current, 'is-open': isOpen('manifest') }">
        <button type="button" class="wizard-step-head" @click="toggle('manifest')">
          <span class="wizard-mark">{{ stepState("manifest").done ? "✓" : "4" }}</span>
          <span class="wizard-title">Add the app.yml</span>
        </button>
        <div v-if="isOpen('manifest')" class="wizard-body">
          <p>
            The template's app.yml is a placeholder; this one describes your app. Open a pull request with it and merge it on
            GitHub, or copy it and commit it yourself.
          </p>
          <div class="wizard-actions">
            <bf-button :disabled="!installed || prBusy" @click="openPullRequest">{{ prBusy ? "Opening…" : "Open a pull request" }}</bf-button>
            <bf-button class="secondary" @click="copyAppYml">Copy app.yml</bf-button>
            <el-checkbox v-model="draft.manifest">It's on the default branch</el-checkbox>
          </div>
          <p v-if="prMessage" class="wizard-note" :class="{ 'is-error': prOutcome && prOutcome.kind !== 'opened' }">
            {{ prMessage }}
            <a v-if="prOutcome?.url" :href="prOutcome.url" target="_blank" rel="noopener">Open it</a>
            <a v-else-if="prOutcome?.reviewUrl" :href="prOutcome.reviewUrl" target="_blank" rel="noopener">Review the permissions</a>
          </p>
          <details class="wizard-yml">
            <summary>app.yml</summary>
            <pre>{{ appYml }}</pre>
          </details>
        </div>
      </li>

      <!-- 5. Release -->
      <li class="wizard-step" :class="{ 'is-done': stepState('release').done, 'is-current': stepState('release').current, 'is-open': isOpen('release') }">
        <button type="button" class="wizard-step-head" @click="toggle('release')">
          <span class="wizard-mark">{{ stepState("release").done ? "✓" : "5" }}</span>
          <span class="wizard-title">Publish the first release</span>
          <span v-if="released && !isOpen('release')" class="wizard-summary">released</span>
        </button>
        <div v-if="isOpen('release')" class="wizard-body">
          <p>
            A release publishes the app: Pennsieve builds the image from the default branch and lists the app in the gallery
            when the build is done. Every later release is a new version.
          </p>
          <div class="wizard-row">
            <label class="wizard-field wizard-field--short">
              <span>Version</span>
              <el-input v-model="draft.releaseTag" placeholder="v0.1.0" />
            </label>
            <div class="wizard-actions">
              <bf-button :disabled="!installed || releaseBusy || released" @click="publish">{{ releaseBusy ? "Publishing…" : "Publish release" }}</bf-button>
            </div>
          </div>
          <p v-if="releaseStatus && releaseStatus.latestTag && !released" class="wizard-aside">
            Latest release on GitHub: {{ releaseStatus.latestTag }}.
          </p>
          <p v-if="releaseMessage" class="wizard-note" :class="{ 'is-error': releaseOutcome && releaseOutcome.kind !== 'released' }">
            {{ releaseMessage }}
            <a v-if="releaseOutcome?.url" :href="releaseOutcome.url" target="_blank" rel="noopener">See the release</a>
            <a v-else-if="releaseOutcome?.reviewUrl" :href="releaseOutcome.reviewUrl" target="_blank" rel="noopener">Review the permissions</a>
          </p>
        </div>
      </li>
    </ol>

    <template #footer>
      <div class="wizard-footer">
        <button type="button" class="wizard-link" @click="startOver">Start over</button>
        <bf-button class="secondary" @click="close">{{ released ? "Done" : "Close" }}</bf-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.wizard-lead {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_5;

  code {
    font-size: 12px;
  }
}

.wizard-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
}

.wizard-step {
  border-bottom: 1px solid theme.$gray_2;

  &:last-child {
    border-bottom: none;
  }
}

.wizard-step-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: none;
  text-align: left;
  font: inherit;
  cursor: pointer;

  .is-current & {
    background: theme.$teal_tint;
  }
}

.wizard-mark {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid theme.$gray_3;
  font-size: 12px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  color: theme.$gray_5;

  .is-done & {
    border-color: theme.$status_green;
    background: theme.$status_green;
    color: theme.$white;
  }

  .is-current & {
    border-color: theme.$teal_2;
    color: theme.$teal_2;
  }
}

.wizard-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: theme.$black;
}

.wizard-summary {
  font-size: 12px;
  color: theme.$gray_5;
}

.wizard-body {
  padding: 4px 12px 14px 44px;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_6;

  > p {
    margin: 0 0 10px;
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
  font-size: 12px;
  color: theme.$gray_4;
}

.wizard-note {
  margin: 6px 0 0;
  padding: 8px 10px;
  border-radius: 4px;
  background: theme.$teal_tint;
  font-size: 12px;

  &.is-error {
    background: #fef3c7;
  }

  a {
    margin-left: 6px;
  }
}

.wizard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
