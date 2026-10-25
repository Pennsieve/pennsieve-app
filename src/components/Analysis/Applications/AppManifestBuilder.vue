<script setup>
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
import { ElMessage } from "element-plus";

import BfButton from "../../shared/bf-button/BfButton.vue";
import ApplicationSchemaEditor from "./ApplicationSchemaEditor.vue";
import MoreOptions from "./MoreOptions.vue";
import AppBanner from "./AppBanner.vue";
import { createApplicationSchema, buildManifest, manifestToYaml, parseManifest, KERNELS, MANIFEST_EXAMPLE_URL } from "./applicationSchema";
import { builderProblems, validateManifestText } from "./manifestValidation";
import {
  APP_KINDS,
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
} from "./manifestBuilder";
import { appTitle, runsOn } from "./appCards";
import { useAppManifest } from "@/composables/useAppManifest";

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

function load({ meta: m, schema: s }) {
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

/* ─────────────── The manifest, and what's wrong with it ─────────────── */

// A notebook writes no parameters; the batch step's stay in the form.
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
const bySection = computed(() => problemsBySection(problems.value));
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

/* ─────────────── Start from: new, an existing app.yml, an app ─────────────── */

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

function startNew() {
  load({ meta: blankMeta(), schema: createApplicationSchema() });
  editingApp.value = "";
}

async function openExisting() {
  checkOpen.value = true;
  await nextTick();
  checkSection.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// An app from the store: its newest version's app.yml.
const { loadManifest } = useAppManifest();
const editingApp = ref("");
const loadingApp = ref(false);
const storeApps = computed(() =>
  [...(store.getters["analysisModule/applications"] || [])].sort((a, b) => appTitle(a).localeCompare(appTitle(b)))
);
async function editApp(uuid) {
  if (!uuid) return;
  const app = storeApps.value.find((a) => a.uuid === uuid);
  loadingApp.value = true;
  try {
    const parsed = await loadManifest(uuid);
    if (parsed) {
      load(parsed);
    } else {
      // No app.yml yet: start one with its name.
      load({ meta: { ...blankMeta(), name: appTitle(app), description: app?.description || "" }, schema: createApplicationSchema() });
      ElMessage.info(`${appTitle(app)} has no app.yml yet: this starts one.`);
    }
  } finally {
    loadingApp.value = false;
  }
}

// ?check=1 (the app page's "check it" link) opens the check.
onMounted(async () => {
  store.dispatch("analysisModule/fetchApplications").catch(() => {});
  if (route.query.check) await openExisting();
});

/* ─────────────── Preview: the card, or the app.yml ─────────────── */

const previewView = ref("card");
const cardApp = computed(() => previewApp(manifest.value));
const cardTags = computed(() => (manifest.value.application?.tags || []).slice(0, 4));

const copied = ref(false);
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
      <h1>Create an application manifest</h1>
      <p class="lede">
        Describe your app, then add the <code>app.yml</code> to the root of its GitHub repository.
        <a href="#" class="guide-link" @click.prevent="goToGuide">Read the manifest guide &rsaquo;</a>
      </p>
      <!-- Start from: a blank one, an app.yml you have, or an app in the store -->
      <div class="start-from">
        <span class="start-label">Start from</span>
        <button type="button" class="app-outline-button" @click="startNew">New</button>
        <button type="button" class="app-outline-button" @click="openExisting">Open an existing app.yml</button>
        <el-select
          v-model="editingApp"
          filterable
          clearable
          size="small"
          :loading="loadingApp"
          placeholder="Edit an app from the store…"
          class="start-app"
          @change="editApp"
        >
          <el-option v-for="a in storeApps" :key="a.uuid" :label="appTitle(a)" :value="a.uuid" />
        </el-select>
      </div>
    </header>

    <div class="builder-body">
      <!-- ─────────────── Section index ─────────────── -->
      <nav class="section-index" aria-label="Sections">
        <button
          v-for="s in SECTIONS"
          :key="s.key"
          type="button"
          class="index-item"
          :class="{ 'has-problems': bySection[s.key].length }"
          @click="goToSection(s.key)"
        >
          <span>{{ s.label }}</span>
          <span v-if="bySection[s.key].length" class="index-count">{{ bySection[s.key].length }}</span>
          <span v-else class="index-ok" aria-label="No problems">✓</span>
        </button>
      </nav>

      <!-- ─────────────── Form ─────────────── -->
      <div class="builder-form">
        <!-- Open an existing app.yml: check it against the schema, then open it here -->
        <section v-if="checkOpen" ref="checkSection" class="check-section">
          <div class="check-head">
            <h3 class="section-title">Open an existing app.yml</h3>
            <button type="button" class="app-outline-button" @click="checkOpen = false">Close</button>
          </div>
          <p class="field-hint">
            Paste an app.yml, or drop or pick the file, to check it against the schema Pennsieve validates releases
            with, and open it here.
          </p>
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
            <label class="field-label">Kind</label>
            <div class="field-control">
              <div class="kind-choice" role="radiogroup" aria-label="Kind of app">
                <button
                  v-for="k in APP_KINDS"
                  :key="k.value"
                  type="button"
                  role="radio"
                  class="kind-option"
                  :class="{ active: kind === k.value }"
                  :aria-checked="kind === k.value"
                  @click="kind = k.value"
                >
                  <span class="kind-label">{{ k.label }}</span>
                  <span class="kind-hint">{{ k.hint }}</span>
                </button>
              </div>
              <div v-if="kind === 'notebook'" class="kernel-row">
                <span class="kernel-label">Language</span>
                <el-select v-model="schema.runtime.kernel" size="small" class="kernel-select" aria-label="Kernel">
                  <el-option v-for="k in KERNELS" :key="k.value" :label="k.label" :value="k.value" />
                </el-select>
              </div>
              <p v-for="m in at('kind')" :key="m" class="field-error">{{ m }}</p>
            </div>
          </div>

          <div class="field-row" data-field="application.name" :class="{ 'has-problem': at('application.name').length }">
            <label class="field-label">Name <span class="req">*</span></label>
            <div class="field-control">
              <el-input v-model="meta.name" placeholder="my-application" maxlength="100" />
              <p v-for="m in at('application.name')" :key="m" class="field-error">{{ m }}</p>
            </div>
          </div>

          <div class="field-row" data-field="application.description" :class="{ 'has-problem': at('application.description').length }">
            <label class="field-label">Description</label>
            <div class="field-control">
              <el-input v-model="meta.description" type="textarea" :rows="2" placeholder="What does this application do?" />
              <p v-for="m in at('application.description')" :key="m" class="field-error">{{ m }}</p>
            </div>
          </div>

          <application-schema-editor v-model="schema" part="tags" :kind="kind" :problems="byField" />

          <p class="field-hint indent">
            The version is the release's tag, and the license is read from the repository's LICENSE file, so app.yml
            doesn't declare them.
          </p>
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
          <p class="field-hint">Who maintains the app.</p>
          <div
            v-for="(m, i) in meta.maintainers"
            :key="i"
            class="maintainer-card"
            :data-field="`application.maintainers.${i}`"
            :class="{ 'has-problem': at(`application.maintainers.${i}`).length }"
          >
            <div class="maintainer-row">
              <el-input v-model="m.name" placeholder="Name" size="small" />
              <el-input v-model="m.email" placeholder="Email (optional)" size="small" />
              <button type="button" class="app-outline-button" @click="removeMaintainer(i)">Remove</button>
            </div>
            <more-options label="ORCID iD" :force-open="!!m.orcid || !!at(`application.maintainers.${i}`).length">
              <el-input v-model="m.orcid" placeholder="0000-0002-1825-0097" size="small" class="full-width" />
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
              <button type="button" class="app-outline-button" @click="copyManifest">{{ copied ? "Copied!" : "Copy" }}</button>
              <bf-button class="compact flex" @click="downloadManifest">Download</bf-button>
            </div>
          </div>

          <div v-if="problems.length" class="preview-validation">
            <p class="preview-validation-title">
              {{ problems.length }} {{ problems.length === 1 ? "item needs" : "items need" }} attention before you
              publish:
            </p>
            <div class="validation-list">
              <button
                v-for="(p, i) in problems"
                :key="i"
                type="button"
                class="validation-item validation-link"
                @click="goToProblem(p)"
              >
                <span class="field-name">{{ p.path }}</span>
                <span class="error-message">{{ p.message }}</span>
              </button>
            </div>
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
            <p class="preview-footnote">As it will look in the Gallery.</p>
          </div>

          <template v-else>
            <pre class="preview-code"><code>{{ manifestYaml }}</code></pre>
            <p class="preview-footnote">
              Modeled on
              <a :href="MANIFEST_EXAMPLE_URL" target="_blank" rel="noopener">app-manifest.v1.yml</a>
            </p>
          </template>
        </div>
      </aside>
    </div>
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

  h1 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
  }
  .lede {
    margin: 0;
    max-width: 760px;
    font-size: 14px;
    line-height: 1.5;
    color: theme.$gray_5;
  }
  .guide-link {
    color: theme.$purple_3;
    white-space: nowrap;
  }
}
.start-from {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}
.start-label {
  font-size: 12px;
  color: theme.$gray_4;
}
.start-app {
  width: 260px;
}

.builder-body {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) minmax(0, 460px);
  gap: 28px;
  align-items: start;
}

/* ─────────────── Section index ─────────────── */
.section-index {
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.index-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border: none;
  border-left: 2px solid theme.$gray_2;
  background: none;
  font: inherit;
  font-size: 13px;
  color: theme.$gray_6;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-left-color: theme.$purple_1;
    color: theme.$purple_3;
  }
  &.has-problems {
    border-left-color: theme.$red_1;
  }
}
.index-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 3px;
  background: theme.$red_tint;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  color: theme.$red_2;
}
.index-ok {
  font-size: 12px;
  color: theme.$green_2;
}

/* ─────────────── Form ─────────────── */
.builder-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding-bottom: 64px;
}
.builder-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-margin-top: 16px;
}
.section-title {
  margin: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid theme.$gray_2;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;

  .label-helper {
    margin-left: 4px;
    font-weight: 400;
  }
}

.field-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  > .field-label {
    flex: 0 0 110px;
    padding-top: 6px;
    font-size: 13px;
    color: theme.$gray_6;

    .req {
      color: theme.$red_1;
    }
  }
}
.field-control {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
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

  &.indent {
    margin-left: 122px;
  }
}
.label-helper {
  font-weight: 400;
  color: theme.$gray_4;
}

/* What kind of app: two choices side by side */
.kind-choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.kind-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  background: theme.$white;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_1;
  }
  &.active {
    border-color: theme.$purple_3;
    box-shadow: 0 0 0 1px theme.$purple_3 inset;
  }
}
.kind-label {
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}
.kind-hint {
  font-size: 12px;
  line-height: 1.4;
  color: theme.$gray_5;
}
.kernel-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.kernel-label {
  font-size: 13px;
  color: theme.$gray_6;
}
.kernel-select {
  width: 160px;
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
.preview-footnote {
  margin: 0;
  padding: 8px 14px;
  border-top: 1px solid theme.$gray_2;
  font-size: 12px;
  color: theme.$gray_4;

  a {
    color: theme.$purple_3;
  }
}

/* The Gallery card, as ApplicationsGrid draws it. */
$card-height: 172px;
.card-preview {
  padding: 16px;
  background: theme.$gray_1;

  .preview-footnote {
    padding: 8px 0 0;
    border-top: none;
  }
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

/* Narrower: the index goes on top, then the preview below the form. */
@media (max-width: 1200px) {
  .builder-body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
  }
  .section-index {
    grid-column: 1 / -1;
    z-index: 2;
    flex-direction: row;
    flex-wrap: wrap;
    padding: 6px 0;
    background: theme.$white;
  }
  .index-item {
    border-left: none;
    border-bottom: 2px solid theme.$gray_2;

    &.has-problems {
      border-bottom-color: theme.$red_1;
    }
  }
}
@media (max-width: 900px) {
  .builder-body {
    grid-template-columns: 1fr;
  }
  .builder-preview {
    position: static;
  }
}
</style>
