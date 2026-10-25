<script setup>
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { useRouter, useRoute } from "vue-router";

import ApplicationSchemaEditor from "./ApplicationSchemaEditor.vue";
import {
  createApplicationSchema,
  buildManifest,
  serializeManifestYaml,
  validateParameters,
  parseManifest,
  MANIFEST_EXAMPLE_URL,
} from "./applicationSchema";
import { builderProblems, validateManifestText } from "./manifestValidation";

const router = useRouter();
const route = useRoute();

/*
  Form state
  ----------
  `meta` holds the top-level manifest fields; `schema` is the editable
  ApplicationSchema the embedded editor binds to. buildManifest() merges the
  two into the app.yml the author commits to their repository.
*/
const meta = reactive({
  name: "",
  description: "",
  applicationType: "processor",
  // Who maintains the app: name, and optionally email and ORCID iD.
  maintainers: [],
});
const addMaintainer = () => meta.maintainers.push({ name: "", email: "", orcid: "" });
const removeMaintainer = (i) => meta.maintainers.splice(i, 1);

const schema = ref(createApplicationSchema());

/*
  Derived manifest + live preview
*/
const manifest = computed(() => buildManifest(schema.value, meta));

/*
  YAML preview — the exact app.yml the author commits. Serialization lives in
  the schema module so the builder and any consumer stay in lock-step.
*/
const manifestYaml = computed(() =>
  serializeManifestYaml(schema.value, meta),
);

/*
  Validation — surfaced inline; never blocks copy/download (an author may want
  to commit a partial manifest and finish later), but warns before they do.
*/
const validation = computed(() => {
  const errors = [];
  if (!meta.name.trim()) errors.push("Application name is required");
  const paramResult = validateParameters(schema.value.parameters);
  errors.push(...paramResult.errors);
  // Then the schema app-deploy-service checks releases against, on what the
  // builder writes, leaving out what the checks above already say.
  const problems = builderProblems(manifest.value, {
    nameMissing: !meta.name.trim(),
    paramErrors: paramResult.errors.length > 0,
  });
  return { valid: errors.length === 0 && problems.length === 0, errors, problems };
});
const attentionCount = computed(() => validation.value.errors.length + validation.value.problems.length);

/*
  Check an app.yml: paste one, or drop or pick the file, to see whether it
  follows the schema; a readable one can be opened here to fix it.
*/
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
  const parsed = parseManifest(doc);
  meta.name = parsed.meta.name;
  meta.description = parsed.meta.description;
  meta.applicationType = parsed.meta.applicationType;
  meta.maintainers = parsed.meta.maintainers.map((m) => ({ ...m }));
  schema.value = parsed.schema;
  checkOpen.value = false;
}

// ?check=1 (the app page's "check it" link) opens the check.
onMounted(async () => {
  if (route.query.check) {
    checkOpen.value = true;
    await nextTick();
    checkSection.value?.scrollIntoView({ block: "start" });
  }
});

/*
  Actions
*/
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
  <div class="manifest-builder">
    <header class="builder-header">
      <div>
        <h1>Create an application manifest</h1>
        <p class="lede">
          Fill in the form to generate an <code>app.yml</code> manifest, then
          add the file to the root of your application's GitHub repository. When
          the repository is published to the App Store, Pennsieve reads this
          manifest to configure the application's runtime, resources, and
          default parameter values.
          <a href="#" class="guide-link" @click.prevent="goToGuide">
            Read the manifest guide &rsaquo;
          </a>
        </p>
      </div>
    </header>

    <div class="builder-body">
      <!-- ─────────────── Form ─────────────── -->
      <div class="builder-form">
        <!-- Check an existing app.yml against the schema -->
        <section ref="checkSection" class="check-section">
          <button type="button" class="check-toggle" :aria-expanded="checkOpen" @click="checkOpen = !checkOpen">
            <span class="caret" :class="{ open: checkOpen }">▸</span>
            Check an app.yml
          </button>
          <div v-if="checkOpen" class="check-body">
            <p class="field-hint">
              Paste an app.yml, or drop or pick the file, to check it against the schema Pennsieve
              validates releases with.
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
          </div>
        </section>

        <section class="schema-section">
          <h4 class="schema-section-title">Details</h4>

          <div class="field-row">
            <label class="field-label">Name <span class="req">*</span></label>
            <el-input
              v-model="meta.name"
              placeholder="my-application"
              maxlength="100"
              class="field-control"
            />
          </div>

          <div class="field-row full-width">
            <label class="field-label">Description</label>
            <el-input
              v-model="meta.description"
              type="textarea"
              :rows="2"
              placeholder="What does this application do?"
              class="field-control"
            />
          </div>

          <div class="field-row full-width">
            <label class="field-label">Maintainers <span class="label-helper">optional</span></label>
            <div class="field-control maintainers">
              <div v-for="(m, i) in meta.maintainers" :key="i" class="maintainer-row">
                <el-input v-model="m.name" placeholder="Name" size="small" />
                <el-input v-model="m.email" placeholder="Email" size="small" />
                <el-input v-model="m.orcid" placeholder="ORCID iD, e.g. 0000-0002-1825-0097" size="small" />
                <el-button size="small" text @click="removeMaintainer(i)">Remove</el-button>
              </div>
              <el-button size="small" plain @click="addMaintainer">Add maintainer</el-button>
            </div>
          </div>
          <p class="field-hint">
            The version is the release's tag, and the license is read from the repository's
            LICENSE file, so app.yml doesn't declare them.
          </p>
        </section>

        <!-- Runtime, resources, parameters, ports, classification -->
        <application-schema-editor v-model="schema" />
      </div>

      <!-- ─────────────── Live preview ─────────────── -->
      <aside class="builder-preview">
        <div class="preview-card">
          <div class="preview-toolbar">
            <span class="preview-filename">app.yml</span>
            <div class="preview-actions">
              <el-button size="small" text @click="copyManifest">
                {{ copied ? "Copied!" : "Copy" }}
              </el-button>
              <el-button size="small" type="primary" @click="downloadManifest">
                Download
              </el-button>
            </div>
          </div>

          <div
            v-if="!validation.valid"
            class="preview-validation"
          >
            <p class="preview-validation-title">
              {{ attentionCount }} item(s) need attention before you
              publish:
            </p>
            <div class="validation-list">
              <div v-for="(err, i) in validation.errors" :key="`e${i}`" class="validation-item">
                <div class="error-message">{{ err }}</div>
              </div>
              <div v-for="(p, i) in validation.problems" :key="`p${i}`" class="validation-item">
                <div class="field-name">{{ p.path }}</div>
                <div class="error-message">{{ p.message }}</div>
              </div>
            </div>
          </div>

          <pre class="preview-code"><code>{{ manifestYaml }}</code></pre>

          <p class="preview-footnote">
            Modeled on
            <a :href="MANIFEST_EXAMPLE_URL" target="_blank" rel="noopener">
              app-manifest.v1.yml
            </a>
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../../styles/theme";

.manifest-builder {
  max-width: 1200px;
  margin: 0;
  padding: 16px 24px 48px;
}

.builder-header {
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px;
  }

  .lede {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.6;
    margin: 0;
    max-width: 760px;
  }

  .guide-link {
    color: theme.$purple_1;
    white-space: nowrap;
  }
}

.builder-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 480px);
  gap: 32px;
  align-items: start;
}

.builder-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 64px;
}

/* Shared field styles, matching ApplicationSchemaEditor. */
.schema-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schema-section-title {
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
  margin: 0;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;

  &.full-width {
    align-items: flex-start;
  }
}

.field-label {
  flex: 0 0 110px;
  font-size: 13px;
  color: theme.$gray_6;

  .req {
    color: theme.$red_1;
  }
}

.field-control {
  flex: 1 1 auto;
  width: 100%;
}

code {
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 0.9em;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 1px 5px;
}

/* ─────────────── Preview ─────────────── */
.builder-preview {
  position: sticky;
  top: 16px;
}

.preview-card {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: theme.$gray_1;
  border-bottom: 1px solid theme.$gray_2;
  padding: 6px 12px;
}

.preview-filename {
  font-family: "SFMono-Regular", Consolas, Menlo, monospace;
  font-size: 13px;
  color: theme.$gray_5;
}

.preview-actions {
  display: flex;
  gap: 4px;
}

.preview-validation {
  background: rgba(#e0a800, 0.1);
  border-bottom: 1px solid theme.$gray_2;
  padding: 10px 14px;
  font-size: 12px;
  color: theme.$gray_6;

  .preview-validation-title {
    margin: 0 0 6px;
    font-weight: 500;
  }
}

/* Validation issues, as the metadata record generator shows them: the field,
   then what's wrong. */
.validation-list {
  display: flex;
  flex-direction: column;
}
.validation-item {
  padding: 8px 0;
  border-bottom: 1px solid theme.$gray_2;

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  .field-name {
    margin-bottom: 2px;
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

/* Check an app.yml */
.check-section {
  border: 1px solid theme.$gray_2;
  background: #fff;
}
.check-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
  text-align: left;
  cursor: pointer;

  .caret {
    font-size: 11px;
    transition: transform 0.15s ease;
    &.open {
      transform: rotate(90deg);
    }
  }
}
.check-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 0 14px 14px;

  .check-drop,
  .check-input,
  .validation-section,
  .validation-success {
    width: 100%;
    box-sizing: border-box;
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

.preview-code {
  margin: 0;
  padding: 16px;
  max-height: 70vh;
  overflow: auto;

  code {
    background: none;
    border: none;
    padding: 0;
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
    color: theme.$purple_1;
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

.label-helper {
  font-weight: 400;
  color: theme.$gray_4;
}
.maintainers {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.maintainer-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr auto;
  gap: 6px;
  width: 100%;
}
.field-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: theme.$gray_4;
}
</style>
