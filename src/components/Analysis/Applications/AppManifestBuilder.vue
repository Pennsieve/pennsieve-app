<script setup>
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";

import ApplicationSchemaEditor from "./ApplicationSchemaEditor.vue";
import {
  createApplicationSchema,
  buildManifest,
  serializeManifestYaml,
  parseManifest,
  validateParameters,
  APPLICATION_TYPES,
  MANIFEST_SCHEMA_URL,
} from "./applicationSchema";

const router = useRouter();

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
});

const schema = ref(createApplicationSchema());

/*
  Derived manifest + live preview
*/
const manifest = computed(() => buildManifest(schema.value, meta));

/*
  YAML preview — the exact app.yml the author commits. Serialization (including
  the yaml-language-server directive) lives in the schema module so the builder
  and any consumer stay in lock-step.
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
  return { valid: errors.length === 0, errors };
});

/*
  Import — load an existing app.yml back into the form. Parses the YAML through
  the schema module (the same path a consumer uses) and repopulates both the
  top-level metadata and the editable schema.
*/
const fileInput = ref(null);

const openImport = () => fileInput.value?.click();

const importManifest = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const { meta: parsedMeta, schema: parsedSchema } = parseManifest(text);
    meta.name = parsedMeta.name;
    meta.description = parsedMeta.description;
    meta.applicationType = parsedMeta.applicationType;
    schema.value = parsedSchema;
    ElMessage.success(`Loaded ${file.name}`);
  } catch (e) {
    ElMessage.error("Could not parse that file as a valid app.yml manifest.");
  } finally {
    // Reset so selecting the same file again re-triggers the change event.
    event.target.value = "";
  }
};

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

const goToGuide = () => router.push({ name: "application-manifest-guide" });
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
      <div class="builder-header-actions">
        <el-button @click="openImport">Import app.yml</el-button>
        <input
          ref="fileInput"
          type="file"
          accept=".yml,.yaml,application/x-yaml,text/yaml"
          class="hidden-file-input"
          @change="importManifest"
        />
      </div>
    </header>

    <div class="builder-body">
      <!-- ─────────────── Form ─────────────── -->
      <div class="builder-form">
        <section class="schema-section">
          <h4 class="schema-section-title">Details</h4>

          <div class="field-row">
            <label class="field-label">Name <span class="req">*</span></label>
            <el-input
              v-model="meta.name"
              placeholder="e.g. Spike Sorter"
              maxlength="100"
              class="field-control"
            />
          </div>

          <div class="field-row">
            <label class="field-label">Type</label>
            <el-select v-model="meta.applicationType" class="field-control">
              <el-option
                v-for="t in APPLICATION_TYPES"
                :key="t.value"
                :label="t.label"
                :value="t.value"
              />
            </el-select>
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
              {{ validation.errors.length }} item(s) need attention before you
              publish:
            </p>
            <ul>
              <li v-for="(err, i) in validation.errors" :key="i">{{ err }}</li>
            </ul>
          </div>

          <pre class="preview-code"><code>{{ manifestYaml }}</code></pre>

          <p class="preview-footnote">
            Validated against
            <a :href="MANIFEST_SCHEMA_URL" target="_blank" rel="noopener">
              app-manifest.v1.json
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;

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

.builder-header-actions {
  flex: 0 0 auto;
}

.hidden-file-input {
  display: none;
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

  ul {
    margin: 0;
    padding-left: 18px;
  }

  li {
    line-height: 1.5;
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
</style>
