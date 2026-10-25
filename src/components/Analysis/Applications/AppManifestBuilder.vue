<script setup>
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";

import BfButton from "../../shared/bf-button/BfButton.vue";
import ApplicationSchemaEditor from "./ApplicationSchemaEditor.vue";
import MoreOptions from "./MoreOptions.vue";
import FieldHint from "./FieldHint.vue";
import IconCopyDocument from "../../icons/IconCopyDocument.vue";
import IconDirectDownload from "../../icons/IconDirectDownload.vue";
import AppBanner from "./AppBanner.vue";
import { fetchRepository, canUpdateManifest } from "./githubRepository";
import { createApplicationSchema, buildManifest, manifestToYaml, parseManifest, KERNELS, MANIFEST_SHAPES } from "./applicationSchema";
import { openAppYmlPullRequest } from "./pullRequest";
import { builderProblems, validateManifestText } from "./manifestValidation";
import {
  APP_KINDS,
  SESSION_KINDS,
  SECTIONS,
  appKind,
  setAppKind,
  manifestSchemaFor,
  builderChecks,
  problemsBySection,
  problemsByField,
  fieldKeyOfPath,
  sectionOfPath,
  previewApp,
  prefillFromApp,
  repoOf,
} from "./manifestBuilder";
import { appTitle, runsOn } from "./appCards";
import { useGetToken } from "@/composables/useGetToken";

const router = useRouter();
const route = useRoute();
const store = useStore();

/*
  Form state
  ----------
  `meta` holds the application fields; `schema` the editable ApplicationSchema
  the form's parts bind to. buildManifest() merges the two into the app.yml the
  author commits to their repository.
*/
const blankMeta = () => ({ name: "", description: "", applicationType: "processor", maintainers: [] });
const meta = reactive(blankMeta());
const schema = ref(createApplicationSchema());

// Set when a loaded app.yml was in the earlier flat layout, which isn't read
// (nor by the platform): the form starts from what could be read.
const earlierLayout = ref(false);

function load({ meta: m, schema: s }) {
  earlierLayout.value = m.shape === MANIFEST_SHAPES.FLAT;
  Object.assign(meta, blankMeta(), {
    name: m.name,
    description: m.description,
    applicationType: m.applicationType,
    maintainers: (m.maintainers || []).map((x) => ({ name: "", email: "", orcid: "", ...x })),
  });
  schema.value = s;
}

const addMaintainer = () => meta.maintainers.push({ name: "", email: "", orcid: "" });
const removeMaintainer = (i) => meta.maintainers.splice(i, 1);

/* ─────────────── What kind of app it is ─────────────── */

const kind = computed({
  get: () => appKind(schema.value),
  set: (k) => setAppKind(schema.value, k),
});
const kindHint = computed(() => APP_KINDS.find((k) => k.value === kind.value)?.hint || "");

/* ─────────────── The manifest, and what's wrong with it ─────────────── */

// An interactive app writes no parameters; the batch app's stay in the form.
const manifest = computed(() => buildManifest(manifestSchemaFor(schema.value), meta));
const manifestYaml = computed(() => manifestToYaml(manifest.value));

/*
  Problems — the builder's own checks, then the schema app-deploy-service
  checks releases against, less what the builder already says. Shown at their
  fields and counted per section; they never block copy or download (an author
  may commit a partial manifest and finish later).
*/
const problems = computed(() => {
  const checks = builderChecks(meta, schema.value);
  const schemaProblems = builderProblems(manifest.value, {
    nameMissing: checks.some((p) => p.path === "application.name"),
    paramErrors: checks.some((p) => p.path.startsWith("parameters")),
  });
  return [...checks, ...schemaProblems];
});
// The summary's groups: the sections with problems, in form order.
const problemSections = computed(() => {
  const by = problemsBySection(problems.value);
  return SECTIONS.map((sec) => ({ ...sec, problems: by[sec.key] })).filter((sec) => sec.problems.length);
});
const byField = computed(() => problemsByField(problems.value));
const at = (key) => byField.value[key] || [];

/* ─────────────── Sections, and going to a problem ─────────────── */

const root = ref(null);
const sectionEls = reactive({});

function goToSection(key) {
  sectionEls[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// To the field a problem points at, else its section.
async function goToProblem(p) {
  const key = fieldKeyOfPath(p.path);
  const el = key && root.value?.querySelector(`[data-field="${CSS.escape(key)}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await nextTick();
    el.querySelector("input, textarea")?.focus({ preventScroll: true });
  } else {
    goToSection(sectionOfPath(p.path));
  }
}

/* ─────────────── Open: an existing app.yml, an app, or start over ─────────────── */

const checkOpen = ref(false);
const checkText = ref("");
const checkFileName = ref("");
const checkResult = computed(() => (checkText.value.trim() ? validateManifestText(checkText.value) : null));
const checkSection = ref(null);

function readCheckFile(file) {
  if (!file) return;
  checkFileName.value = file.name;
  const reader = new FileReader();
  reader.onload = () => (checkText.value = String(reader.result || ""));
  reader.readAsText(file);
}
const onCheckFile = (event) => readCheckFile(event.target.files?.[0]);
const onCheckDrop = (event) => readCheckFile(event.dataTransfer?.files?.[0]);

// Load the checked app.yml into the form, to fix it here.
function openInBuilder() {
  const doc = checkResult.value?.doc;
  if (!doc) return;
  load(parseManifest(doc));
  checkOpen.value = false;
}

// The page title: the app's app.yml when opened for one.
const pageTitle = computed(() => (forApp.value ? `app.yml for ${forApp.value.title}` : "Create an app.yml"));
const earlierLayoutDetail =
  "This app.yml uses an earlier layout that Pennsieve no longer reads, so nothing was loaded from it. Fill in the form and it writes the current layout.";

async function openExisting() {
  checkOpen.value = true;
  await nextTick();
  checkSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Opened for an app (?app=): the form waits for it, shown as placeholders, and
// fades in filled, instead of showing empty fields that fill in later.
const openingApp = ref(!!route.query.app);
/*
  Opened for an app from its page (?app=<uuid>): its repository's app.yml, or
  a new one from what Pennsieve knows (prefillFromApp). The repository's
  description comes from github-service, which keeps it; GitHub topics aren't
  kept anywhere, so tags start empty.
*/
const forApp = ref(null); // { uuid, title, repo, fromManifest }
// The app's GitHub installation, when it hasn't approved Pennsieve's updated
// permissions yet (so no pull request from here): its review link.
const prReview = ref(null);
const api2Url = computed(() => store.state.config?.api2Url || "");

async function getJson(url) {
  const token = await useGetToken();
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}
async function installationNeedingReview(owner) {
  try {
    const body = await getJson(`${api2Url.value}/github/installations`);
    const list = Array.isArray(body) ? body : body?.installations || [];
    return list.find((i) => i?.needs_review === true && String(i.name || "").toLowerCase() === owner.toLowerCase()) || null;
  } catch {
    return null;
  }
}

async function openForApp(uuid) {
  try {
    const app = await store.dispatch("analysisModule/fetchApplication", uuid);
    const repo = repoOf(app?.sourceUrl);
    const hasManifest = Object.keys(app?.assets || {}).some((k) => /^app\.ya?ml$/i.test(k));
    const repository = await fetchRepository(api2Url.value, repo);
    const start = prefillFromApp(app, store.state.profile, { repoDescription: repository?.description || "" });
    load(start);
    if (start.earlierLayout) earlierLayout.value = true;
    const profile = store.state.profile || {};
    const isOwner = !!app?.ownerId && (app.ownerId === profile.id || app.ownerId === profile.intId);
    // The owner, or someone who can push to the repository, updates it here.
    forApp.value = {
      uuid,
      title: start.meta.name || appTitle(app),
      repo,
      fromManifest: start.fromManifest,
      canUpdate: canUpdateManifest(isOwner, repository),
      hadManifest: hasManifest,
    };
    // The GitHub review hint can follow; the form needn't wait for it.
    if (repo) installationNeedingReview(repo.owner).then((r) => (prReview.value = r));
  } catch {
    ElMessage.error("Couldn't load that app; starting a new manifest.");
  } finally {
    openingApp.value = false;
  }
}

// The app's page, to go back to.
const appPageRoute = computed(() =>
  forApp.value
    ? route.params.orgId
      ? { name: "application-detail", params: { orgId: route.params.orgId, uuid: forApp.value.uuid } }
      : { name: "my-application-detail", params: { uuid: forApp.value.uuid } }
    : null
);

// ?check=1 (the app page's "check it" link) opens the check; ?app=<uuid> (its
// Create/Edit app.yml) opens that app's.
onMounted(async () => {
  if (route.query.app) await openForApp(String(route.query.app));
  if (route.query.check) await openExisting();
});

/* ─────────────── Preview: the card, or the app.yml ─────────────── */

const previewView = ref("card");
const cardApp = computed(() => previewApp(manifest.value));
const cardTags = computed(() => (manifest.value.application?.tags || []).slice(0, 4));

const copied = ref(false);
/* ─────────────── Open a pull request on the app's repository ─────────────── */
// For an app with a GitHub repo, someone who can update it (owner, or push
// access) opens a pull request with this app.yml instead of copying it.
// Hidden for the session if this Pennsieve can't yet (no route).
const prUnavailable = ref(false);
const prSending = ref(false);
const prOutcome = ref(null);
const canOpenPullRequest = computed(() => !!forApp.value?.repo && !!forApp.value?.canUpdate && !prUnavailable.value);
async function openPullRequest() {
  if (!canOpenPullRequest.value || problems.value.length || prSending.value) return;
  prSending.value = true;
  prOutcome.value = null;
  try {
    const token = await useGetToken();
    const outcome = await openAppYmlPullRequest(api2Url.value, forApp.value.repo, manifestYaml.value, token);
    if (outcome.kind === "unavailable") {
      prUnavailable.value = true;
      return;
    }
    prOutcome.value = outcome;
  } finally {
    prSending.value = false;
  }
}
const githubIntegrationRoute = { name: "user-github" };

const copyManifest = async () => {
  try {
    await navigator.clipboard.writeText(manifestYaml.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    copied.value = false;
  }
};

const downloadManifest = () => {
  const blob = new Blob([manifestYaml.value], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "app.yml";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// The guide next to this builder: My Analysis's outside a workspace.
const goToGuide = () =>
  router.push({ name: route.params.orgId ? "application-manifest-guide" : "my-application-manifest-guide" });
</script>

<template>
  <div ref="root" class="manifest-builder">
    <header class="builder-header">
      <router-link v-if="forApp" :to="appPageRoute" class="back-link">&larr; Back to the app</router-link>
      <div class="header-row">
        <div class="title-block">
          <h1>
            {{ pageTitle }}
            <a href="#" class="help-link" title="Manifest guide" aria-label="Manifest guide" @click.prevent="goToGuide">?</a>
            <!-- Check an app.yml you have (for an app, its file is already loaded) -->
            <a v-if="!forApp" href="#" class="check-link" @click.prevent="openExisting">Check an existing app.yml</a>
          </h1>
          <p v-if="forApp?.repo" class="header-sub">
            <a :href="`https://github.com/${forApp.repo.fullName}`" target="_blank" rel="noopener">{{ forApp.repo.fullName }}</a>
            <template v-if="!forApp.fromManifest && !forApp.hadManifest"> · new</template>
          </p>
          <!-- One short line each; the detail on hover -->
          <p v-if="earlierLayout" class="header-note" :title="earlierLayoutDetail">
            Earlier layout: starting from {{ forApp ? "the app's details" : "a blank form" }}
          </p>
          <p v-if="forApp && !forApp.canUpdate" class="header-note">
            Not your app: copy or download the file and propose it to {{ forApp.repo ? forApp.repo.fullName : "its repository" }}.
          </p>
        </div>
      </div>
    </header>

    <!-- Opened for an app: placeholders while it loads -->
    <div v-if="openingApp" class="builder-loading" aria-busy="true" aria-live="polite">
      <p class="builder-loading-text">Loading the app's details…</p>
      <div class="builder-body">
        <div class="builder-form">
          <div v-for="n in 4" :key="n" class="skeleton-field">
            <span class="skeleton skeleton-label" />
            <span class="skeleton skeleton-input" :class="{ 'skeleton-input--tall': n === 2 }" />
          </div>
        </div>
        <aside class="builder-preview">
          <span class="skeleton skeleton-card" />
        </aside>
      </div>
    </div>

    <transition name="builder-fade">
    <div v-if="!openingApp" class="builder-body">
      <!-- ─────────────── Form ─────────────── -->
      <div class="builder-form">
        <!-- Open an existing app.yml: check it against the schema, then open it here -->
        <section v-if="checkOpen" ref="checkSection" class="check-section">
          <div class="check-head">
            <h3 class="section-title">Open an existing app.yml</h3>
            <button type="button" class="app-outline-button" @click="checkOpen = false">Close</button>
          </div>
          <p class="field-hint">Paste or drop an app.yml to check it, then open it here.</p>
          <div class="check-drop" @dragover.prevent @drop.prevent="onCheckDrop">
            <el-input
              v-model="checkText"
              type="textarea"
              :rows="8"
              placeholder="application:&#10;  name: my-application&#10;…"
              class="check-input"
            />
          </div>
          <div class="check-actions">
            <label class="app-outline-button">
              Choose a file…
              <input type="file" accept=".yml,.yaml,text/yaml" class="check-file" @change="onCheckFile" />
            </label>
            <span v-if="checkFileName" class="check-file-name">{{ checkFileName }}</span>
          </div>

          <template v-if="checkResult">
            <div v-if="checkResult.valid" class="validation-success">
              <h4>✅ Valid app.yml</h4>
              <p>It follows the app.yml schema.</p>
            </div>
            <div v-else class="validation-section">
              <div class="validation-header">
                <h4>Validation Issues</h4>
                <p>Fix these so the release's app.yml follows the schema:</p>
              </div>
              <div class="validation-list">
                <div v-for="(p, i) in checkResult.problems" :key="i" class="validation-item">
                  <div class="field-name">{{ p.path }}</div>
                  <div class="error-message">{{ p.message }}</div>
                </div>
              </div>
            </div>
            <button v-if="checkResult.doc" type="button" class="app-outline-button" @click="openInBuilder">
              Open in the builder
            </button>
          </template>
        </section>

        <!-- About: what kind of app, its name, what it's for -->
        <section :ref="(el) => (sectionEls.about = el)" class="builder-section">
          <h3 class="section-title">About</h3>

          <div class="field-row" data-field="kind" :class="{ 'has-problem': at('kind').length }">
            <label class="field-label">Kind <field-hint :text="kindHint" /></label>
            <div class="kind-row">
              <div class="kind-switch" role="radiogroup" aria-label="Kind of app">
                <button
                  v-for="k in APP_KINDS"
                  :key="k.value"
                  type="button"
                  role="radio"
                  class="kind-option"
                  :class="{ active: kind === k.value }"
                  :aria-checked="kind === k.value"
                  :title="k.hint"
                  @click="kind = k.value"
                >
                  {{ k.label }}
                </button>
              </div>
              <template v-if="kind === 'interactive'">
                <el-select v-model="schema.runtime.sessionType" class="kind-select" aria-label="Session">
                  <el-option v-for="t in SESSION_KINDS" :key="t.value" :label="t.label" :value="t.value" />
                </el-select>
                <el-select
                  v-if="schema.runtime.sessionType === 'jupyter'"
                  v-model="schema.runtime.kernel"
                  class="kind-select"
                  aria-label="Language"
                >
                  <el-option v-for="k in KERNELS" :key="k.value" :label="k.label" :value="k.value" />
                </el-select>
              </template>
            </div>
            <p v-for="m in at('kind')" :key="m" class="field-error">{{ m }}</p>
          </div>

          <div class="field-row" data-field="application.name" :class="{ 'has-problem': at('application.name').length }">
            <label class="field-label">Name <span class="req">*</span></label>
            <el-input v-model="meta.name" placeholder="my-application" maxlength="100" />
            <p v-for="m in at('application.name')" :key="m" class="field-error">{{ m }}</p>
          </div>

          <div class="field-row" data-field="application.description" :class="{ 'has-problem': at('application.description').length }">
            <label class="field-label">Description</label>
            <el-input v-model="meta.description" type="textarea" :rows="2" placeholder="What does this application do?" />
            <p v-for="m in at('application.description')" :key="m" class="field-error">{{ m }}</p>
          </div>

          <application-schema-editor v-model="schema" part="tags" :kind="kind" :problems="byField" />
        </section>

        <!-- What it does: in, its settings, out -->
        <section :ref="(el) => (sectionEls.does = el)" class="builder-section">
          <h3 class="section-title">What it does</h3>
          <application-schema-editor v-model="schema" part="io" :kind="kind" :problems="byField" />
        </section>

        <!-- How it runs -->
        <section :ref="(el) => (sectionEls.runs = el)" class="builder-section">
          <h3 class="section-title">How it runs</h3>
          <application-schema-editor v-model="schema" part="runtime" :kind="kind" :problems="byField" />
        </section>

        <!-- People -->
        <section :ref="(el) => (sectionEls.people = el)" class="builder-section">
          <h3 class="section-title">People <span class="label-helper">optional</span></h3>
          <div
            v-for="(m, i) in meta.maintainers"
            :key="i"
            class="maintainer-card"
            :data-field="`application.maintainers.${i}`"
            :class="{ 'has-problem': at(`application.maintainers.${i}`).length }"
          >
            <div class="maintainer-row">
              <el-input v-model="m.name" placeholder="Name" />
              <el-input v-model="m.email" placeholder="Email (optional)" />
              <button type="button" class="app-outline-button" @click="removeMaintainer(i)">Remove</button>
            </div>
            <more-options label="ORCID iD" :force-open="!!m.orcid || !!at(`application.maintainers.${i}`).length">
              <el-input v-model="m.orcid" placeholder="0000-0002-1825-0097" class="full-width" />
            </more-options>
            <p v-for="msg in at(`application.maintainers.${i}`)" :key="msg" class="field-error">{{ msg }}</p>
          </div>
          <button type="button" class="app-outline-button add-row" @click="addMaintainer">+ Add maintainer</button>
        </section>
      </div>

      <!-- ─────────────── Preview: the card, or the app.yml ─────────────── -->
      <aside class="builder-preview">
        <div class="preview-card">
          <div class="preview-toolbar">
            <div class="preview-views" role="tablist">
              <button
                type="button"
                role="tab"
                class="preview-view"
                :class="{ active: previewView === 'card' }"
                :aria-selected="previewView === 'card'"
                title="As it will look in the Gallery"
                @click="previewView = 'card'"
              >
                Card
              </button>
              <button
                type="button"
                role="tab"
                class="preview-view"
                :class="{ active: previewView === 'yaml' }"
                :aria-selected="previewView === 'yaml'"
                @click="previewView = 'yaml'"
              >
                app.yml
              </button>
            </div>
            <div class="preview-actions">
              <!-- One main action: a pull request for an app its owner (or a
                   pusher) can update, else Download. Copy (and Download, when
                   the pull request is the main action) sit on the app.yml view. -->
              <el-tooltip
                v-if="canOpenPullRequest"
                :content="problems.length ? 'Fix the problems first' : `Opens a pull request on ${forApp.repo.fullName} that adds or updates app.yml at its root`"
                placement="top"
              >
                <span>
                  <bf-button
                    class="compact flex"
                    :disabled="!!problems.length || prSending"
                    :processing="prSending"
                    @click="openPullRequest"
                  >Open a pull request</bf-button>
                </span>
              </el-tooltip>
              <bf-button v-else class="compact flex" @click="downloadManifest">Download app.yml</bf-button>
            </div>
          </div>

          <!-- Problems, by section; each goes to its field -->
          <div v-if="problems.length" class="preview-validation">
            <p class="preview-validation-title">
              {{ problems.length }} {{ problems.length === 1 ? "item needs" : "items need" }} attention
            </p>
            <template v-for="sec in problemSections" :key="sec.key">
              <p class="problem-section">{{ sec.label }} <span class="problem-count">{{ sec.problems.length }}</span></p>
              <div class="validation-list">
                <button
                  v-for="(p, i) in sec.problems"
                  :key="i"
                  type="button"
                  class="validation-item validation-link"
                  @click="goToProblem(p)"
                >
                  <span class="field-name">{{ p.path }}</span>
                  <span class="error-message">{{ p.message }}</span>
                </button>
              </div>
            </template>
          </div>

          <!-- The Gallery card this app.yml gives -->
          <div v-if="previewView === 'card'" class="card-preview">
            <div class="app-card">
              <div class="app-thumb">
                <AppBanner :app="cardApp" />
              </div>
              <div class="app-body">
                <div class="app-title">
                  <span class="app-name" :class="{ 'is-empty': !meta.name.trim() }">{{ meta.name.trim() || "Your app" }}</span>
                </div>
                <p class="app-description">{{ meta.description.trim() || "No description." }}</p>
                <div v-if="cardTags.length" class="app-tags">
                  <span v-for="t in cardTags" :key="t" class="app-tag">{{ t }}</span>
                </div>
                <div class="app-meta">
                  <span v-if="runsOn(cardApp)" class="app-runs">{{ runsOn(cardApp) }}</span>
                </div>
              </div>
            </div>
          </div>

          <template v-else>
            <div class="code-view">
              <div class="code-tools">
                <el-tooltip :content="copied ? 'Copied' : 'Copy'" placement="top">
                  <button type="button" class="code-tool" aria-label="Copy" @click="copyManifest">
                    <IconCopyDocument :width="14" :height="14" />
                  </button>
                </el-tooltip>
                <el-tooltip v-if="canOpenPullRequest" content="Download app.yml" placement="top">
                  <button type="button" class="code-tool" aria-label="Download app.yml" @click="downloadManifest">
                    <IconDirectDownload :width="14" :height="14" />
                  </button>
                </el-tooltip>
              </div>
              <pre class="preview-code"><code>{{ manifestYaml }}</code></pre>
            </div>
          </template>
        </div>
        <!-- The pull request's outcome -->
        <div v-if="prOutcome" class="pr-outcome" :class="`pr-outcome--${prOutcome.kind}`" role="status">
          <template v-if="prOutcome.kind === 'opened'">
            <p>
              Pull request <strong>#{{ prOutcome.number }}</strong> opened on {{ forApp.repo.fullName }}.
              <a :href="prOutcome.url" target="_blank" rel="noopener">View on GitHub</a>
            </p>
            <p class="pr-outcome-note">Publish a release after merging it, so the App Store picks up the app.yml.</p>
          </template>
          <template v-else-if="prOutcome.kind === 'needsApproval'">
            <p>Pennsieve's GitHub app needs your approval to open pull requests in {{ forApp.repo.owner }}.</p>
            <p class="pr-outcome-note">
              <a v-if="prOutcome.reviewUrl" :href="prOutcome.reviewUrl" target="_blank" rel="noopener">Review on GitHub</a>
              <template v-if="prOutcome.organization"> · Only owners of {{ forApp.repo.owner }} can approve.</template>
              Copy or Download still work.
            </p>
          </template>
          <p v-else-if="prOutcome.kind === 'noPush'">
            You can't push to {{ forApp.repo.fullName }}. Copy or download the file and propose it to its owners.
          </p>
          <p v-else-if="prOutcome.kind === 'notLinked'">
            <router-link :to="githubIntegrationRoute">Link your GitHub account</router-link> to open pull requests, or copy or download the file.
          </p>
          <p v-else>Couldn't open the pull request: {{ prOutcome.message }}</p>
        </div>

        <!-- For an app without a pull request: where the file goes -->
        <p v-if="forApp?.repo && !canOpenPullRequest" class="preview-note">
          Add it to {{ forApp.repo.fullName }} as <code>app.yml</code>, then publish a release.
          <a v-if="prReview?.review_url" :href="prReview.review_url" target="_blank" rel="noopener">Approve Pennsieve's GitHub update</a>
        </p>
      </aside>
    </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.manifest-builder {
  max-width: 1440px;
  margin: 0;
  padding: 16px 32px 48px;
}

.builder-header {
  margin-bottom: 20px;

  .back-link {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 13px;
    color: theme.$purple_3;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
  .title-block {
    min-width: 0;
  }
  .help-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 6px;
    border: 1px solid theme.$gray_3;
    border-radius: 50%;
    font-size: 11px;
    font-weight: 600;
    color: theme.$gray_4;
    text-decoration: none;
    vertical-align: 2px;

    &:hover {
      border-color: theme.$purple_3;
      color: theme.$purple_3;
    }
  }
  .check-link {
    margin-left: 12px;
    font-size: 13px;
    font-weight: 400;
    color: theme.$purple_3;
    text-decoration: none;
    vertical-align: 2px;

    &:hover {
      text-decoration: underline;
    }
  }
  .header-sub {
    margin: 2px 0 0;
    font-size: 13px;
    color: theme.$gray_4;

    a {
      color: theme.$gray_5;
      text-decoration: none;

      &:hover {
        color: theme.$purple_3;
        text-decoration: underline;
      }
    }
  }
  /* A short notice line under the title, no box. */
  .header-note {
    margin: 4px 0 0;
    padding-left: 8px;
    border-left: 2px solid theme.$orange_1;
    font-size: 12px;
    color: theme.$gray_5;
    cursor: default;
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 4px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
  }
}

/* The form, then the preview beside it. */
.builder-loading-text {
  margin: 0 0 16px;
  font-size: 13px;
  color: theme.$gray_4;
}
.skeleton {
  display: block;
  border-radius: 3px;
  background: linear-gradient(90deg, theme.$gray_1 25%, theme.$gray_2 50%, theme.$gray_1 75%);
  background-size: 200% 100%;
  animation: builder-shimmer 1.4s ease-in-out infinite;
}
.skeleton-field {
  margin-bottom: 20px;
}
.skeleton-label {
  width: 120px;
  height: 12px;
  margin-bottom: 8px;
}
.skeleton-input {
  width: 100%;
  height: 32px;
}
.skeleton-input--tall {
  height: 72px;
}
.skeleton-card {
  width: 100%;
  height: 200px;
}
@keyframes builder-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
.builder-fade-enter-active {
  transition: opacity 0.2s ease;
}
.builder-fade-enter-from {
  opacity: 0;
}

.builder-body {
  display: grid;
  grid-template-columns: minmax(0, 720px) minmax(0, 460px);
  gap: 32px;
  align-items: start;
}

/* ─────────────── Form ─────────────── */
.builder-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 48px;
}
.builder-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-margin-top: 16px;
}
/* As the dashboards' section titles. */
.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_5;

  .label-helper {
    margin-left: 4px;
    font-weight: 400;
  }
}

/* A field: its label above, then the control. */
.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;

  > .field-label {
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;

    .req {
      color: theme.$red_1;
    }
  }
}
.has-problem :deep(.el-input__wrapper),
.has-problem :deep(.el-textarea__inner),
.has-problem :deep(.el-select__wrapper) {
  box-shadow: 0 0 0 1px theme.$red_1 inset;
}
.field-error {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$red_2;
}
.field-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;
}
.label-helper {
  font-weight: 400;
  color: theme.$gray_4;
}

/* What kind of app: a two-way switch, as the Analysis view switch, then
   an interactive app's session and language. */
.kind-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.kind-switch {
  display: inline-flex;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.kind-option {
  padding: 5px 14px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
  &.active {
    background: theme.$white;
    color: theme.$purple_3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}
.kind-select {
  width: 140px;
}

/* People */
.maintainer-card {
  padding: 10px 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$gray_1;

  &.has-problem {
    border-color: theme.$red_1;
  }
}
.maintainer-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  margin-bottom: 6px;
}
.add-row {
  align-self: flex-start;
}

/* The small outline buttons Applications uses. */
.app-outline-button {
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
}

code {
  padding: 1px 5px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$gray_1;
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 0.9em;
}

/* ─────────────── Open an existing app.yml ─────────────── */
.check-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  scroll-margin-top: 16px;

  .check-drop,
  .check-input,
  .validation-section,
  .validation-success {
    width: 100%;
    box-sizing: border-box;
  }
}
.check-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  .section-title {
    border-bottom: none;
    padding-bottom: 0;
  }
}
.check-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.check-file {
  display: none;
}
.check-file-name {
  font-size: 12px;
  color: theme.$gray_4;
}

/* Validation issues, as the metadata record generator shows them: the field,
   then what's wrong. */
.validation-list {
  display: flex;
  flex-direction: column;
}
.validation-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid theme.$gray_2;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .field-name {
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;
  }
  .error-message {
    font-size: 12px;
    line-height: 1.4;
    color: theme.$gray_5;
  }
}
/* A problem in the summary goes to its field. */
.validation-link {
  border-top: none;
  border-right: none;
  border-left: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover .field-name {
    color: theme.$purple_3;
    text-decoration: underline;
  }
}
.validation-section,
.validation-success {
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;

  h4 {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: theme.$gray_6;
  }
  p {
    margin: 0 0 6px;
    font-size: 12px;
    color: theme.$gray_5;
  }
}

/* ─────────────── Preview ─────────────── */
.builder-preview {
  position: sticky;
  top: 16px;
}
.preview-card {
  overflow: hidden;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$gray_1;
}
.preview-views {
  display: inline-flex;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
}
.preview-view {
  padding: 3px 10px;
  border: none;
  border-radius: 3px;
  background: none;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_5;
  cursor: pointer;

  &.active {
    background: theme.$gray_1;
    color: theme.$purple_3;
  }
}
.preview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* Copy and Download on the app.yml view, top right, as code views have them. */
.code-view {
  position: relative;

  /* Room for the tools, so the first lines don't run under them. */
  .preview-code {
    padding-right: 72px;
  }
}
.code-tools {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 2px;
}
.code-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: theme.$white;
  color: theme.$gray_4;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: theme.$gray_1;
    color: theme.$purple_3;
    outline: none;
  }
}
.problem-section {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  font-weight: 600;
  color: theme.$gray_6;
}
.problem-count {
  padding: 0 5px;
  border-radius: 3px;
  background: theme.$red_tint;
  font-size: 11px;
  color: theme.$red_2;
}
.preview-note {
  margin: 8px 2px 0;
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_4;
}
.preview-validation {
  max-height: 30vh;
  overflow: auto;
  padding: 10px 14px;
  border-bottom: 1px solid theme.$gray_2;
  background: theme.$orange_tint;
  font-size: 12px;
  color: theme.$gray_6;

  .preview-validation-title {
    margin: 0 0 6px;
    font-weight: 500;
  }
}
.preview-code {
  max-height: 70vh;
  margin: 0;
  padding: 16px;
  overflow: auto;

  code {
    padding: 0;
    border: none;
    background: none;
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_6;
    white-space: pre;
  }
}

/* The Gallery card, as ApplicationsGrid draws it. */
$card-height: 172px;
.card-preview {
  padding: 16px;
  background: theme.$gray_1;
}
.app-card {
  display: flex;
  height: $card-height;
  min-width: 0;
  overflow: hidden;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
}
.app-thumb {
  display: flex;
  flex: 0 0 $card-height;
  border-right: 1px solid theme.$gray_2;
}
.app-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 14px 16px 12px;
}
.app-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.app-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;

  &.is-empty {
    color: theme.$gray_4;
  }
}
.app-description {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.app-tags {
  display: flex;
  gap: 4px;
  overflow: hidden;
}
.app-tag {
  flex-shrink: 0;
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  font-size: 11px;
  color: theme.$gray_5;
}
.app-meta {
  margin-top: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_4;
}
.app-runs {
  color: theme.$gray_6;
}

/* Narrower: the preview below the form. */
@media (max-width: 900px) {
  .builder-body {
    grid-template-columns: 1fr;
  }
  .builder-preview {
    position: static;
  }
}
.pr-outcome {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$gray_1;
  font-size: 13px;
  color: theme.$gray_6;

  p {
    margin: 0;
  }
  a {
    color: theme.$purple_3;
  }
}
.pr-outcome--opened {
  border-color: theme.$green_1;
  background: theme.$green_tint;
}
.pr-outcome--needsApproval,
.pr-outcome--noPush,
.pr-outcome--notLinked {
  border-color: theme.$orange_1;
  background: theme.$orange_tint;
}
.pr-outcome--error {
  border-color: theme.$red_1;
  background: theme.$red_tint;
}
.pr-outcome-note {
  margin-top: 4px !important;
  font-size: 12px;
  color: theme.$gray_5;
}
</style>
