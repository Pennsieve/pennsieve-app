<script setup>
/*
  Publish a release of the app's repository from Pennsieve, as the user (their
  linked GitHub account). The release webhook then adds the version to the
  app store, as for a release made on GitHub, which keeps working too.
*/
import { computed, ref, watch } from "vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import { useGetToken } from "@/composables/useGetToken";
import { latestVersion, nextVersions, tagProblem, publishRelease } from "./release";
import { variantTagWarning } from "./versionVariants";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  api2Url: { type: String, required: true },
  // { owner, repo }
  repo: { type: Object, required: true },
  // Versions already released: the repository's releases and the app store's.
  knownTags: { type: Array, default: () => [] },
  defaultBranch: { type: String, default: "" },
  // Where the branch stands against the latest release (fetchReleaseStatus).
  status: { type: Object, default: null },
  // The app has variants (its newest version's app.yml): one release builds
  // each, and a tag can't contain "--".
  hasVariants: { type: Boolean, default: false },
  // The release's builds, once the app store has it (versionVariants
  // releaseProgress), for an app with variants; null otherwise.
  progress: { type: Object, default: null },
});
const emit = defineEmits(["update:modelValue", "released"]);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

// The latest release: of the versions known (the repository's, the app
// store's) and the one the release check found (status.latestTag), which
// the repository list doesn't always have.
const latest = computed(() => latestVersion([...props.knownTags, props.status?.latestTag].filter(Boolean)));
const suggestions = computed(() => nextVersions(latest.value));
const BUMPS = [
  { key: "patch", label: "Patch", hint: "fixes" },
  { key: "minor", label: "Minor", hint: "new features" },
  { key: "major", label: "Major", hint: "breaking changes" },
];

const bump = ref("patch");
const tag = ref("");
const target = ref("");
const notes = ref("");
const sending = ref(false);
const outcome = ref(null);

// Fresh each time it opens: the next patch version (v0.1.0 for an app's
// first release), the default branch.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    bump.value = latest.value ? "patch" : "minor";
    tag.value = suggestions.value[bump.value];
    target.value = props.defaultBranch || "";
    notes.value = "";
    outcome.value = null;
  },
  { immediate: true }
);
const pickBump = (key) => {
  bump.value = key;
  tag.value = suggestions.value[key];
};

const problem = computed(() => tagProblem(tag.value, props.knownTags, latest.value));
const variantWarning = computed(() => variantTagWarning(tag.value, props.hasVariants));
const statusText = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "Waiting");
const released = computed(() => outcome.value?.kind === "released");

const release = async () => {
  if (problem.value || sending.value) return;
  sending.value = true;
  outcome.value = null;
  try {
    const token = await useGetToken();
    outcome.value = await publishRelease(props.api2Url, props.repo, { tag: tag.value, target: target.value, notes: notes.value }, token);
    if (outcome.value.kind === "released") emit("released", outcome.value);
  } finally {
    sending.value = false;
  }
};

const fullName = computed(() => `${props.repo.owner}/${props.repo.repo}`);
</script>

<template>
  <el-dialog v-model="visible" title="Publish a release" width="520px" append-to-body class="release-dialog">
    <!-- Done -->
    <div v-if="released" class="rd-done">
      <p>
        <strong>{{ outcome.tag }}</strong> is released on
        <a :href="outcome.url" target="_blank" rel="noopener">{{ fullName }}</a>.
      </p>
      <p class="rd-muted">
        The app store adds the version in a few minutes. This page shows it when it's there.
      </p>
      <!-- An app with variants: one build each -->
      <div v-if="progress && progress.tag" class="rd-progress">
        <div v-for="r in progress.rows" :key="r.id || r.name" class="rd-progress-row">
          <span>{{ r.name }}</span>
          <span class="rd-muted">{{ statusText(r.status) }}<template v-if="r.failureReason">: {{ r.failureReason }}</template></span>
        </div>
      </div>
      <p v-else-if="hasVariants" class="rd-muted">Each of the app's variants is built; their progress shows here once the version is listed.</p>
    </div>

    <template v-else>
      <p class="rd-intro">
        Tags <strong>{{ target || defaultBranch || "the default branch" }}</strong> on
        <a :href="`https://github.com/${fullName}`" target="_blank" rel="noopener">{{ fullName }}</a>
        and publishes a release, as you. The app store then adds the version.
        <template v-if="latest"> The latest is <strong>{{ latest }}</strong><template v-if="status?.commitsSince">, with {{ status.commitsSince }} new commit{{ status.commitsSince === 1 ? "" : "s" }} since</template>.</template>
      </p>

      <div class="rd-field">
        <label class="rd-label">Version</label>
        <el-radio-group :model-value="bump" size="small" @update:model-value="pickBump">
          <el-radio-button v-for="b in BUMPS" :key="b.key" :value="b.key" :title="b.hint">
            {{ b.label }} · {{ suggestions[b.key] }}
          </el-radio-button>
        </el-radio-group>
        <el-input v-model="tag" class="rd-tag" placeholder="v1.2.3" @input="bump = ''" />
        <p v-if="problem" class="rd-error">{{ problem }}</p>
        <p v-else-if="variantWarning" class="rd-error">{{ variantWarning }}</p>
      </div>

      <div class="rd-field">
        <label class="rd-label">Branch or commit</label>
        <el-input v-model="target" :placeholder="defaultBranch || 'main'" />
      </div>

      <div class="rd-field">
        <label class="rd-label">Notes <span class="rd-muted">optional</span></label>
        <el-input
          v-model="notes"
          type="textarea"
          :rows="4"
          placeholder="Leave empty and GitHub writes them from the pull requests merged since the last release."
        />
      </div>

      <!-- Why it didn't happen -->
      <div v-if="outcome" class="rd-outcome">
        <template v-if="outcome.kind === 'nothingNew'">{{ outcome.message || "Nothing new since the latest release." }}</template>
        <template v-else-if="outcome.kind === 'tagExists'">{{ outcome.message || `${tag} already exists.` }} Pick a new version.</template>
        <template v-else-if="outcome.kind === 'needsApproval'">
          Pennsieve's GitHub app needs approval on {{ repo.owner }} to publish releases.
          <a v-if="outcome.reviewUrl" :href="outcome.reviewUrl" target="_blank" rel="noopener">Review it on GitHub</a>
        </template>
        <template v-else-if="outcome.kind === 'noPush'">You can't push to {{ fullName }}, so you can't release it.</template>
        <template v-else-if="outcome.kind === 'notLinked'">Link your GitHub account (Profile → Integrations) to publish releases.</template>
        <template v-else-if="outcome.kind === 'unavailable'">
          Publishing releases isn't available here yet.
          <a :href="`https://github.com/${fullName}/releases/new`" target="_blank" rel="noopener">Release on GitHub</a>
        </template>
        <template v-else>
          {{ outcome.message }}
          <a :href="`https://github.com/${fullName}/releases/new`" target="_blank" rel="noopener">Release on GitHub</a>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="rd-footer">
        <template v-if="released">
          <bf-button @click="visible = false">Done</bf-button>
        </template>
        <template v-else>
          <bf-button class="secondary" @click="visible = false">Cancel</bf-button>
          <bf-button :processing="sending" :disabled="!!problem || sending" @click="release">Release {{ tag }}</bf-button>
        </template>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.rd-intro {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_6;
}
.rd-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.rd-label {
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.rd-tag {
  max-width: 200px;
}
.rd-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.rd-progress-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.rd-muted {
  font-weight: 400;
  color: theme.$gray_4;
}
.rd-error {
  margin: 0;
  font-size: 12px;
  color: theme.$red_1;
}
.rd-outcome {
  padding: 8px 10px;
  border: 1px solid theme.$red_1;
  border-radius: 4px;
  background: theme.$red_tint;
  font-size: 13px;
  line-height: 1.5;
  color: theme.$gray_6;
}
.rd-done p {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.5;
}
.rd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
