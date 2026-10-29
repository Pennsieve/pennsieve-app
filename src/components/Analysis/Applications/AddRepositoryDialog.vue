<script setup>
// Add a repository: a guided wizard (addRepository.js has the pure parts),
// laid out like the notebook and publish-app dialogs: what the step is for
// and what's chosen so far on the left, the step on the right.
//
//   1. The repository: one Pennsieve already sees, or any on GitHub. When
//      GitHub lets us, Pennsieve adds it to the GitHub App itself (a public
//      repository, or one the user administers); otherwise the step links to
//      GitHub and ticks itself when the repository shows up.
//   2. Where releases go: the App Store, Discover, or both.
//   3. Who can use the app, set before the app exists; the first release
//      creates it with this sharing. Skipped for Discover only, or when the
//      app exists already (it's shared from its page).
//   4. A release: build the latest one GitHub has, make a new one, or later.
//
// The draft is kept in this browser, so a trip to GitHub resumes here.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";
import * as siteConfig from "@/site-config/site.json";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { useGetToken } from "@/composables/useGetToken";
import { fetchRepository } from "./githubRepository";
import { fetchReleaseStatus, latestVersion, nextVersions, publishRelease, publishStoredRelease, tagProblem } from "./release";
import { hasAccess, manualAccessUrl, requestRepositoryAccess } from "./repositoryAccess";
import ShareAccessEditor from "./ShareAccessEditor.vue";
import {
  DESTINATIONS,
  STEPS,
  accessPayload,
  clearDraft,
  destinationsOf,
  firstToDo,
  loadDraft,
  newDraft,
  nextStep,
  parseRepoInput,
  pickerRepos,
  prevStep,
  repoName,
  repoUrl,
  saveDraft,
  sharingApplies,
  sharingSummary,
  stepsFor,
} from "./addRepository";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Open on this repository ({ owner, repo }), e.g. from a repository's card.
  initialRepo: { type: Object, default: null },
});
const emit = defineEmits(["update:modelValue", "saved", "done"]);
const store = useStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const draft = ref(loadDraft());
watch(draft, (d) => saveDraft(d), { deep: true });

const api2Url = computed(() => store.state.config?.api2Url);
const organization = computed(() => store.state.activeOrganization?.organization || null);
const organizationId = computed(() => organization.value?.id || null);
const profile = computed(() => store.state.profile);

// --- 1. The repository -------------------------------------------------

const repo = computed(() => (draft.value.owner && draft.value.repo ? { owner: draft.value.owner, repo: draft.value.repo } : null));
const name = computed(() => repoName(draft.value));
const url = computed(() => repoUrl(draft.value));

// The repositories Pennsieve sees, to pick from; anything else is typed.
const knownRepos = computed(() => pickerRepos(store.getters["codeReposModule/myRepos"] || []));
const knownRepo = (fullName) => knownRepos.value.find((r) => r.fullName.toLowerCase() === String(fullName || "").toLowerCase());
const repoInput = ref(name.value);
const repoProblem = ref("");

// What the services say about the repository.
const access = ref(null);
const accessBusy = ref(false);
const repository = ref(null);

const applications = computed(() => store.state.analysisModule?.applications || []);
const normalize = (u) => String(u || "").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
const existingApp = computed(() => (url.value ? applications.value.find((a) => normalize(a.sourceUrl) === normalize(url.value)) || null : null));
const appExists = computed(() => Boolean(existingApp.value));

// Start on a repository: a fresh draft when it's a different one.
const useRepo = ({ owner, repo: repoName_ }) => {
  if (draft.value.owner !== owner || draft.value.repo !== repoName_) {
    draft.value = { ...newDraft(), owner, repo: repoName_ };
  }
  repoInput.value = `${owner}/${repoName_}`;
  repoProblem.value = "";
  access.value = null;
  repository.value = null;
  releaseStatus.value = null;
  releaseOutcome.value = null;
  const known = knownRepo(`${owner}/${repoName_}`);
  if (known) {
    // Pennsieve sees it already: its settings are the starting point.
    access.value = { kind: "accessible" };
    if (known.enabled) {
      draft.value.appstore = Boolean(known.repo.publishing_to_appstore);
      draft.value.discover = Boolean(known.repo.publishing_to_discover);
    }
  }
};
const onRepoInput = (value) => {
  const parsed = parseRepoInput(value);
  if (!parsed) {
    repoProblem.value = value ? "Enter the repository as owner/name, or paste its GitHub URL." : "";
    return;
  }
  useRepo(parsed);
};

// Ask github-service for access: it adds the repository to the GitHub App
// when GitHub allows, or says what to do on GitHub.
const ensureAccess = async () => {
  if (!repo.value || hasAccess(access.value)) return hasAccess(access.value);
  accessBusy.value = true;
  try {
    const token = await useGetToken();
    access.value = await requestRepositoryAccess(api2Url.value, repo.value, token);
    if (hasAccess(access.value)) {
      stopPolling();
      store.dispatch("codeReposModule/fetchAllMyRepos").catch(() => {});
      return true;
    }
    startPolling();
    return false;
  } finally {
    accessBusy.value = false;
  }
};

// While the user adds the repository on GitHub, look for it.
const checking = ref(false);
const checkRepository = async () => {
  if (!repo.value || !api2Url.value || checking.value) return;
  checking.value = true;
  try {
    const found = await fetchRepository(api2Url.value, repo.value);
    if (found) {
      repository.value = found;
      if (!hasAccess(access.value)) {
        access.value = { kind: "accessible" };
        stopPolling();
        store.dispatch("codeReposModule/fetchAllMyRepos").catch(() => {});
      }
    }
  } finally {
    checking.value = false;
  }
};
let poll = null;
const polling = ref(false);
const startPolling = () => {
  stopPolling();
  poll = setInterval(checkRepository, 6000);
  polling.value = true;
};
const stopPolling = () => {
  if (poll) clearInterval(poll);
  poll = null;
  polling.value = false;
};
onBeforeUnmount(stopPolling);

const manualUrl = computed(() => manualAccessUrl(access.value, siteConfig.githubAppUrl));
const openExternal = (u) => window.open(u, "_blank", "noopener");
const accessMessage = computed(() => {
  const o = access.value;
  if (!o || hasAccess(o)) return "";
  switch (o.kind) {
    case "noInstallation":
      return `The Pennsieve GitHub App isn't installed for ${o.owner || draft.value.owner}. Install it on GitHub and pick the repository; this step completes itself once Pennsieve sees it.`;
    case "notVisible":
      return `Pennsieve can't see ${name.value}. It's private and outside the GitHub App's repositories, so add it on GitHub; this step completes itself once Pennsieve sees it.`;
    case "notAdmin":
      return `Only an admin of ${name.value} can give the Pennsieve GitHub App access to it. Ask them to add it on GitHub, or add it yourself if you can.`;
    case "notLinked":
      return "Link your GitHub account first (My Workspace → Settings → Integrations).";
    case "unavailable":
      return "Adding repositories from here isn't available yet. Add the repository to the Pennsieve GitHub App on GitHub.";
    default:
      return o.message || "Pennsieve couldn't reach GitHub. Try again.";
  }
});
const accessLinkLabel = computed(() => (access.value?.kind === "noInstallation" ? "Install the GitHub App" : "Add it on GitHub"));

// --- 2. Destinations, 3. Sharing ----------------------------------------

const chosen = computed(() => Boolean(draft.value.appstore || draft.value.discover));
const sharing = computed(() => sharingApplies(draft.value, { appExists: appExists.value }));
// A change after saving means saving again.
watch(
  () => [draft.value.appstore, draft.value.discover, draft.value.visibility, draft.value.entries],
  () => {
    draft.value.settingsSaved = false;
  },
  { deep: true }
);

// The workspace the dialog is opened from is the natural first share.
const prefillSharing = () => {
  if (draft.value.sharingPrefilled || draft.value.entries.length || !organization.value) return;
  draft.value.entries = [
    { type: "workspace", id: organization.value.id, name: organization.value.name, organizationId: organization.value.id },
  ];
  draft.value.sharingPrefilled = true;
};

const saving = ref(false);
const saveSettings = async () => {
  if (!repo.value || !chosen.value) return false;
  saving.value = true;
  try {
    const meId = profile.value?.id || profile.value?.intId;
    await store.dispatch("codeReposModule/updateRepoPublishingSettings", {
      repoUrl: url.value,
      publish_to_discover: draft.value.discover,
      publish_to_appstore: draft.value.appstore,
      ...(sharing.value && { access: accessPayload(draft.value, meId, organizationId.value) }),
    });
    draft.value.settingsSaved = true;
    emit("saved", { ...repo.value, destinations: destinationsOf(draft.value) });
    return true;
  } catch (err) {
    console.error(err);
    ElMessage.error("Couldn't save the publishing settings. Please try again.");
    return false;
  } finally {
    saving.value = false;
  }
};

// --- 4. The release ------------------------------------------------------

const releaseStatus = ref(null);
const releaseBusy = ref(false);
const releaseOutcome = ref(null);
const loadRelease = async () => {
  if (!repo.value || !hasAccess(access.value)) return;
  const token = await useGetToken();
  const [found, status] = await Promise.all([fetchRepository(api2Url.value, repo.value), fetchReleaseStatus(api2Url.value, repo.value, token)]);
  if (found) repository.value = found;
  releaseStatus.value = status;
};
const knownTags = computed(() => (repository.value?.releases || []).map((r) => r.label).filter(Boolean));
const latest = computed(() => latestVersion([...knownTags.value, releaseStatus.value?.latestTag].filter(Boolean)));
const suggestions = computed(() => nextVersions(latest.value));
const BUMPS = [
  { key: "patch", label: "Patch", hint: "fixes" },
  { key: "minor", label: "Minor", hint: "new features" },
  { key: "major", label: "Major", hint: "breaking changes" },
];
const bump = ref("");
const pickBump = (key) => {
  bump.value = key;
  draft.value.releaseTag = suggestions.value[key];
};
const tagIssue = computed(() => (draft.value.releaseChoice === "new" ? tagProblem(draft.value.releaseTag, knownTags.value, latest.value) : ""));
const released = computed(() => Boolean(draft.value.releasedTag));
// The first choice offered: the latest release when there is one.
watch([latest, () => draft.value.releaseChoice], ([l, choice]) => {
  if (!choice) draft.value.releaseChoice = l ? "existing" : "new";
  if (draft.value.releaseChoice === "new" && !draft.value.releaseTag) pickBump(l ? "patch" : "minor");
});

const destinationLabels = computed(() => DESTINATIONS.filter((d) => draft.value[d.key]).map((d) => d.label));
const release = async () => {
  if (!repo.value || releaseBusy.value) return;
  releaseBusy.value = true;
  releaseOutcome.value = null;
  try {
    const token = await useGetToken();
    if (draft.value.releaseChoice === "existing") {
      const outcome = await publishStoredRelease(api2Url.value, repo.value, { label: latest.value, destinations: destinationsOf(draft.value) }, token);
      releaseOutcome.value = outcome;
      if (outcome.kind === "accepted") {
        draft.value.releasedTag = outcome.label;
        draft.value.releaseUrl = releaseStatus.value?.latestUrl || `${url.value}/releases/tag/${outcome.label}`;
        emit("done", { ...repo.value, tag: outcome.label, destinations: destinationsOf(draft.value) });
      }
    } else {
      const outcome = await publishRelease(api2Url.value, repo.value, { tag: draft.value.releaseTag }, token);
      releaseOutcome.value = outcome;
      if (outcome.kind === "released") {
        draft.value.releasedTag = outcome.tag;
        draft.value.releaseUrl = outcome.url;
        emit("done", { ...repo.value, tag: outcome.tag, destinations: destinationsOf(draft.value) });
      }
    }
  } finally {
    releaseBusy.value = false;
  }
};
const releaseMessage = computed(() => {
  const o = releaseOutcome.value;
  if (!o) return "";
  switch (o.kind) {
    case "accepted":
    case "released":
      return "";
    case "noDestinations":
      return "The repository has no destination turned on. Go back a step and pick one.";
    case "needsApproval":
      return "The repository's owner hasn't accepted the Pennsieve GitHub App's permissions yet.";
    case "noPush":
      return "You can't push to this repository, so you can't release it from here. Release it on GitHub instead.";
    case "notLinked":
      return "Link your GitHub account in your profile first.";
    case "tagExists":
      return "That tag exists already; pick a new version.";
    case "nothingNew":
      return o.message || "Nothing new to release since the latest release. Build that one instead.";
    case "invalid":
      return o.message || "The app.yml on the default branch doesn't parse.";
    case "unavailable":
      return "Releasing from here isn't available yet. Release on GitHub; Pennsieve picks it up.";
    default:
      return o.message || "The release failed.";
  }
});
const doneMessage = computed(() => {
  const parts = [];
  if (draft.value.appstore) parts.push("Pennsieve is building the app; it appears in the App Store when the build is done.");
  if (draft.value.discover) parts.push("Discover is archiving the release and minting its DOI.");
  return parts.join(" ");
});

// --- The steps --------------------------------------------------------------

const steps = computed(() => stepsFor(draft.value, { access: access.value, appExists: appExists.value }));
const stepState = (key) => steps.value.find((s) => s.key === key) || {};
const stepTitles = ["Pick the repository", "Where releases go", "Who can use the app", "Release it"];
const stepLabels = ["Repository", "Destinations", "Sharing", "Release"];
const stepAbouts = [
  "Pennsieve publishes a GitHub repository's releases. Pick one Pennsieve already sees, or paste any GitHub URL: Pennsieve adds it to the GitHub App for you when GitHub allows, and tells you what to do on GitHub when not.",
  "Each release of the repository is sent where you choose: built into an app for workflows, archived on Discover with a DOI, or both. You can change this later from My Code.",
  "The app doesn't exist until its first release is built, but you can decide now who can use it. The owner is always you; change it later from the app's page.",
  "A release is what Pennsieve publishes. Build one GitHub already has, make a new one from here, or leave it for later: every release on GitHub is picked up.",
];
const step = ref(0);
const isLast = computed(() => step.value === STEPS.length - 1);
const key = computed(() => STEPS[step.value]);

const canNext = computed(() => {
  switch (key.value) {
    case "repository":
      return Boolean(repo.value) && !repoProblem.value && !accessBusy.value;
    case "destinations":
      return chosen.value && !saving.value;
    case "sharing":
      return !saving.value;
    default:
      return false;
  }
});
const next = async () => {
  if (!canNext.value) return;
  switch (key.value) {
    case "repository":
      if (!(await ensureAccess())) return;
      break;
    case "destinations":
      if (!sharing.value && !(await saveSettings())) return;
      break;
    case "sharing":
      if (!(await saveSettings())) return;
      break;
    default:
      return;
  }
  step.value = nextStep(steps.value, step.value);
  if (key.value === "sharing") prefillSharing();
  if (key.value === "release") loadRelease();
};
const back = () => {
  step.value = prevStep(steps.value, step.value);
};
// A step the user may jump to from the progress bar: one done, or the first
// still to do.
const canGoTo = (i) => i <= firstToDo(steps.value) && !steps.value[i]?.skipped;
const goTo = (i) => {
  if (!canGoTo(i)) return;
  step.value = i;
  if (STEPS[i] === "release") loadRelease();
};
const finishLater = () => {
  draft.value.releaseChoice = "later";
  emit("done", { ...repo.value, tag: "", destinations: destinationsOf(draft.value) });
  close();
};

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      stopPolling();
      return;
    }
    if (props.initialRepo?.owner && props.initialRepo?.repo) useRepo(props.initialRepo);
    else if (repo.value && knownRepo(name.value) && !hasAccess(access.value)) access.value = { kind: "accessible" };
    repoInput.value = name.value;
    step.value = firstToDo(steps.value);
    if (key.value === "sharing") prefillSharing();
    if (key.value === "release") loadRelease();
    else if (repo.value && !hasAccess(access.value)) checkRepository().then(() => (step.value = firstToDo(steps.value)));
  },
  { immediate: true }
);

// What's chosen so far, for the left column.
const soFar = computed(() => {
  const rows = [];
  if (name.value) rows.push({ label: "Repository", value: name.value });
  if (name.value) {
    rows.push({
      label: "Access",
      value: hasAccess(access.value) ? (access.value.kind === "added" ? "added just now" : "Pennsieve sees it") : access.value ? "not yet" : "to check",
    });
  }
  if (step.value >= 1) rows.push({ label: "Releases go to", value: destinationLabels.value.join(" and ") || "nowhere yet" });
  if (step.value >= 2 && draft.value.appstore) {
    rows.push({ label: "App sharing", value: appExists.value ? "from the app's page" : sharingSummary(draft.value) });
  }
  if (step.value >= 3) rows.push({ label: "Release", value: draft.value.releasedTag || "not yet" });
  return rows;
});

const startOver = () => {
  clearDraft();
  draft.value = newDraft();
  repoInput.value = "";
  repoProblem.value = "";
  access.value = null;
  repository.value = null;
  releaseStatus.value = null;
  releaseOutcome.value = null;
  bump.value = "";
  stopPolling();
  step.value = 0;
};
const close = () => {
  visible.value = false;
  if (released.value || draft.value.releaseChoice === "later") {
    clearDraft();
    draft.value = newDraft();
    access.value = null;
  }
};
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="stepTitles[step]"
    width="min(840px, 96vw)"
    append-to-body
    class="add-repository-dialog"
    :close-on-click-modal="false"
  >
    <div class="wizard-body">
      <ol class="wizard-progress">
        <li
          v-for="(label, i) in stepLabels"
          :key="i"
          class="wizard-progress__step"
          :class="{ active: step === i, done: stepState(STEPS[i]).done, skipped: stepState(STEPS[i]).skipped, reachable: canGoTo(i) }"
        >
          <button type="button" :disabled="!canGoTo(i)" :title="stepTitles[i]" @click="goTo(i)">
            <span class="wizard-progress__mark">{{ stepState(STEPS[i]).done && step !== i ? "✓" : stepState(STEPS[i]).skipped ? "–" : i + 1 }}</span>
            <span class="wizard-progress__label">{{ label }}</span>
          </button>
        </li>
      </ol>

      <div class="nb-layout">
        <aside class="nb-info">
          <p class="nb-info__about">{{ stepAbouts[step] }}</p>
          <template v-if="soFar.length">
            <h4 class="nb-info__title">This repository</h4>
            <dl class="nb-info__list">
              <template v-for="row in soFar" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd :title="row.value">{{ row.value }}</dd>
              </template>
            </dl>
          </template>
        </aside>
        <div class="nb-content">
          <!-- 1. The repository -->
          <div v-if="step === 0" class="wizard-step">
            <label class="wizard-field">
              <span>Repository</span>
              <el-select
                v-model="repoInput"
                filterable
                allow-create
                default-first-option
                :reserve-keyword="false"
                placeholder="owner/name, or paste a GitHub URL"
                class="repo-picker"
                @change="onRepoInput"
              >
                <el-option v-for="r in knownRepos" :key="r.fullName" :label="r.fullName" :value="r.fullName">
                  <span class="repo-option">
                    <span class="repo-option__name">{{ r.fullName }}</span>
                    <span class="repo-option__meta">{{ r.enabled ? "set up" : "Pennsieve sees it" }}</span>
                  </span>
                </el-option>
              </el-select>
              <small v-if="repoProblem" class="is-error">{{ repoProblem }}</small>
              <small v-else>The repositories listed are the ones the Pennsieve GitHub App can see. Any other one on GitHub works too.</small>
            </label>

            <p v-if="repo && hasAccess(access)" class="wizard-note is-ok">
              Pennsieve {{ access.kind === "added" ? "added" : "sees" }}
              <a :href="url" target="_blank" rel="noopener">{{ name }}</a>.
            </p>
            <template v-else-if="repo && access">
              <p class="wizard-note is-warning">{{ accessMessage }}</p>
              <div v-if="access.kind !== 'notLinked'" class="wizard-actions">
                <bf-button @click="openExternal(manualUrl)">{{ accessLinkLabel }}</bf-button>
                <bf-button class="secondary" :disabled="checking || accessBusy" @click="ensureAccess">{{ accessBusy ? "Checking…" : "Check again" }}</bf-button>
              </div>
              <p v-if="polling" class="wizard-aside">Waiting for the repository to show up…</p>
            </template>
            <p v-else-if="repo" class="wizard-aside">
              Next asks GitHub to give the Pennsieve App access to <code>{{ name }}</code>, as you.
            </p>
          </div>

          <!-- 2. Destinations -->
          <div v-else-if="step === 1" class="wizard-step">
            <div class="wizard-field">
              <span>Each release goes to</span>
              <div class="wizard-choices">
                <div v-for="d in DESTINATIONS" :key="d.key" class="wizard-choice">
                  <el-checkbox v-model="draft[d.key]">{{ d.label }}</el-checkbox>
                  <small>{{ d.hint }}</small>
                </div>
              </div>
            </div>
            <p v-if="appExists" class="wizard-aside">
              The App Store has this app already<template v-if="existingApp?.name">: {{ existingApp.name }}</template>. New releases become new versions of it.
            </p>
            <p v-if="!chosen" class="wizard-note is-warning">Pick at least one.</p>
          </div>

          <!-- 3. Sharing -->
          <div v-else-if="step === 2" class="wizard-step">
            <ShareAccessEditor
              v-model="draft.entries"
              v-model:visibility="draft.visibility"
              :owner-id="profile?.id || profile?.intId || null"
              :organization-id="organizationId"
            />
          </div>

          <!-- 4. Release -->
          <div v-else class="wizard-step">
            <template v-if="released">
              <p class="wizard-note is-ok">
                <strong>{{ draft.releasedTag }}</strong> is on its way.
                <a v-if="draft.releaseUrl" :href="draft.releaseUrl" target="_blank" rel="noopener">See the release</a>
              </p>
              <p class="wizard-step-desc">{{ doneMessage }}</p>
            </template>
            <template v-else>
              <p class="wizard-step-desc">
                Releases of <code>{{ name }}</code> go to {{ destinationLabels.join(" and ") }}.
                <template v-if="latest"> The latest release on GitHub is <strong>{{ latest }}</strong><template v-if="releaseStatus?.commitsSince">, with {{ releaseStatus.commitsSince }} new commit{{ releaseStatus.commitsSince === 1 ? "" : "s" }} since</template>.</template>
                <template v-else> The repository has no release yet.</template>
              </p>
              <el-radio-group v-model="draft.releaseChoice" class="release-choices">
                <div v-if="latest" class="wizard-choice">
                  <el-radio value="existing">Build {{ latest }}, the latest release</el-radio>
                  <small>Nothing changes on GitHub; Pennsieve fetches the release and publishes it.</small>
                </div>
                <div class="wizard-choice">
                  <el-radio value="new">Release a new version</el-radio>
                  <small>Tags the default branch on GitHub and publishes a release, as you.</small>
                </div>
                <div class="wizard-choice">
                  <el-radio value="later">Not now</el-radio>
                  <small>Every release you make on GitHub is picked up from here on.</small>
                </div>
              </el-radio-group>
              <div v-if="draft.releaseChoice === 'new'" class="release-new">
                <div class="wizard-field">
                  <span>Version</span>
                  <el-radio-group :model-value="bump" size="small" @update:model-value="pickBump">
                    <el-radio-button v-for="b in BUMPS" :key="b.key" :value="b.key" :title="b.hint">{{ b.label }} · {{ suggestions[b.key] }}</el-radio-button>
                  </el-radio-group>
                  <el-input v-model="draft.releaseTag" class="release-tag" placeholder="v1.2.3" @input="bump = ''" />
                  <small v-if="tagIssue" class="is-error">{{ tagIssue }}</small>
                </div>
              </div>
              <p v-if="releaseMessage" class="wizard-note is-error">
                {{ releaseMessage }}
                <a v-if="releaseOutcome?.reviewUrl" :href="releaseOutcome.reviewUrl" target="_blank" rel="noopener">Review the permissions</a>
                <a v-else-if="releaseOutcome?.kind === 'noPush' || releaseOutcome?.kind === 'unavailable'" :href="`${url}/releases/new`" target="_blank" rel="noopener">Release on GitHub</a>
              </p>
            </template>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="run-dialog-footer">
        <div class="wizard-footer-left">
          <bf-button class="secondary" @click="close">{{ released ? "Close" : "Cancel" }}</bf-button>
          <button v-if="!released" type="button" class="wizard-link" @click="startOver">Start over</button>
        </div>
        <div class="wizard-footer-right">
          <bf-button v-if="step > 0 && !released" class="secondary" @click="back">Back</bf-button>
          <bf-button v-if="!isLast" :disabled="!canNext" :processing="accessBusy || saving" @click="next">
            {{ key === "repository" && repo && !hasAccess(access) ? "Give access" : "Next" }}
          </bf-button>
          <bf-button v-else-if="released" @click="close">Done</bf-button>
          <bf-button v-else-if="draft.releaseChoice === 'later'" @click="finishLater">Done</bf-button>
          <bf-button v-else-if="draft.releaseChoice === 'existing'" :processing="releaseBusy" :disabled="!latest" @click="release">Build {{ latest }}</bf-button>
          <bf-button v-else :processing="releaseBusy" :disabled="Boolean(tagIssue) || !draft.releaseTag" @click="release">Release {{ draft.releaseTag }}</bf-button>
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

/* The progress bar: each step named, done ones ticked and reachable. */
.wizard-progress {
  display: flex;
  justify-content: center;
  gap: 4px;
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
}
.wizard-progress__step {
  display: flex;
  align-items: center;

  button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: none;
    border-radius: 14px;
    background: none;
    font: inherit;
    font-size: 12px;
    color: theme.$gray_4;
    cursor: default;
  }
  &.reachable button {
    cursor: pointer;
  }
  &.reachable button:hover {
    background: theme.$gray_1;
  }
  &.active button {
    color: theme.$black;
    font-weight: 600;
  }
  &.done button {
    color: theme.$gray_5;
  }
  & + &::before {
    content: "";
    width: 16px;
    height: 1px;
    margin-right: 4px;
    background: theme.$gray_2;
  }
}
.wizard-progress__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid theme.$gray_3;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;

  .active & {
    border-color: theme.$purple_1;
    background: theme.$purple_1;
    color: theme.$white;
  }
  .done & {
    border-color: theme.$green_1;
    background: theme.$green_1;
    color: theme.$white;
  }
  .skipped & {
    border-color: theme.$gray_2;
    color: theme.$gray_3;
  }
}
@media (max-width: 900px) {
  .wizard-progress__label {
    display: none;
  }
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
  small.is-error {
    color: theme.$red_1;
  }
}
.repo-picker {
  width: 100%;
}
.repo-option {
  display: flex;
  align-items: center;
  gap: 12px;
}
.repo-option__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
.repo-option__meta {
  font-size: 12px;
  color: theme.$gray_4;
}
.wizard-choices,
.release-choices {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.wizard-choice {
  display: flex;
  flex-direction: column;

  :deep(.el-radio) {
    height: auto;
  }
  small {
    margin-left: 24px;
    font-size: 11px;
    color: theme.$gray_4;
  }
}
.release-new {
  margin: 14px 0 0 24px;
  padding-top: 10px;
  border-top: 1px dashed theme.$gray_2;
}
.release-tag {
  max-width: 200px;
  margin-top: 6px;
}
.wizard-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.wizard-aside {
  margin: 0 0 8px;
  font-size: 12px;
  color: theme.$gray_4;

  code {
    background: theme.$gray_1;
    padding: 1px 5px;
    border-radius: 3px;
    color: theme.$gray_6;
  }
}
.wizard-note {
  margin: 6px 0 12px;
  padding: 8px 10px;
  border-radius: 4px;
  background: theme.$gray_0;
  font-size: 12px;
  line-height: 1.5;

  &.is-ok {
    background: theme.$teal_tint;
  }
  &.is-error,
  &.is-warning {
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
