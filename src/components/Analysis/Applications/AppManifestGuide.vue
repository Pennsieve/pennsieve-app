<script setup>
import { ref } from "vue";

/*
  The canonical app.yml example shown in the guide. This is the reference
  manifest served at EXAMPLE_URL, reproduced verbatim so the guide never
  documents a field the reference does not declare. Kept as a string so it can
  be rendered as-is and copied to the clipboard in one click.
*/
const exampleManifest = `schemaVersion: 1.0.0
application:
  name: test-private-repo-3
  description: this is a test repo for development purposes
  version: 1.0.1
  maintainers:
    - name: edmore
  tags:
    - demo
runtime:
  cpu: 1024
  memory: 2048
  computeTypes:
    - standard
  timeoutSeconds: 300
parameters:
  - name: threshold
    type: number
    description: Detection threshold.
    defaultValue: "0.5"
    validValues:
      - "0.1"
      - "0.5"
      - "0.9"
  - name: mode
    type: string
    description: Processing mode.
    defaultValue: fast
    validValues:
      - fast
      - accurate
  - name: verbose
    type: boolean
    description: Enable verbose logging.
    defaultValue: "false"
  - name: channel
    type: string
    description: Channel to analyze (no default, treated as required).
inputs:
  - name: package
    description: Pipeline package file.
    mediaTypes:
      - application/octet-stream
outputs:
  - name: package
    description: Pipeline package file.
    mediaTypes:
      - application/octet-stream`;

const EXAMPLE_URL = "https://app.pennsieve.io/static/schemas/app-manifest.v1.yml";

const copied = ref(false);

const copyExample = async () => {
  try {
    await navigator.clipboard.writeText(exampleManifest);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    copied.value = false;
  }
};

/*
  Field reference tables. Driven by data, and deliberately limited to the
  fields the reference manifest at EXAMPLE_URL declares, so the guide stays in
  lock-step with it.
*/
const topLevelFields = [
  { name: "schemaVersion", type: "string", required: true, desc: "Manifest schema version. The reference declares 1.0.0." },
  { name: "application", type: "object", required: true, desc: "Application metadata — see the table below." },
  { name: "runtime", type: "object", required: false, desc: "cpu (units), memory (MB), computeTypes, and timeoutSeconds." },
  { name: "parameters", type: "object[]", required: false, desc: "Run-time parameters and their defaults — see the table below." },
  { name: "inputs", type: "object[]", required: false, desc: "Typed inputs the application consumes, used for workflow validation." },
  { name: "outputs", type: "object[]", required: false, desc: "Typed outputs the application produces, used for workflow validation." },
];

const applicationFields = [
  { name: "name", type: "string", required: true, desc: "Human-readable application name." },
  { name: "description", type: "string", required: false, desc: "Short description of what the application does." },
  { name: "version", type: "string", required: false, desc: "Version of the application this manifest describes." },
  { name: "maintainers", type: "object[]", required: false, desc: "Who maintains the application. Each entry has a name." },
  { name: "tags", type: "string[]", required: false, desc: "Free-form labels for search and filtering." },
];

const runtimeFields = [
  { name: "cpu", type: "number", required: false, desc: "Default CPU units (1024 = 1 vCPU)." },
  { name: "memory", type: "number", required: false, desc: "Default memory reservation in MB." },
  { name: "computeTypes", type: "string[]", required: false, desc: "Compute environments the application supports. A GPU application lists gpu here — there is no separate gpu block." },
  { name: "timeoutSeconds", type: "number", required: false, desc: "How long a run may take before it is timed out." },
];

const parameterFields = [
  { name: "name", type: "string", required: true, desc: "Parameter name. Unique among parameters." },
  { name: "type", type: "string", required: true, desc: "Value type: string, number, or boolean." },
  { name: "description", type: "string", required: false, desc: "What the parameter controls." },
  { name: "defaultValue", type: "string", required: false, desc: "Value used when the user does not supply one. Written as a string, including for number and boolean parameters. A parameter with no default is treated as required." },
  { name: "validValues", type: "string[]", required: false, desc: "Restricts the parameter to this set of values, rendered as a picker in the workflow builder." },
];

const inputOutputFields = [
  { name: "name", type: "string", required: true, desc: "Name. Unique among inputs (or outputs)." },
  { name: "description", type: "string", required: false, desc: "What flows through this input or output." },
  { name: "mediaTypes", type: "string[]", required: false, desc: "Media types accepted or produced, e.g. application/octet-stream." },
];
</script>

<template>
  <div class="manifest-guide">
    <header class="guide-header">
      <h1>Application manifest (app.yml)</h1>
      <p class="lede">
        Applications are published from a GitHub repository. Add an
        <code>app.yml</code> file to the root of your repository to declare its
        runtime, parameters, and inputs/outputs. When you publish the
        repository to the App Store, Pennsieve reads this file and uses it to
        populate the application's defaults — including the default values shown
        when the application is added to a workflow.
      </p>
      <router-link
        :to="{ name: 'application-manifest-builder' }"
        class="builder-cta"
      >
        Build your app.yml with the manifest builder &rsaquo;
      </router-link>
    </header>

    <section class="guide-section">
      <h2>1. Add app.yml to your repository</h2>
      <p>
        Create a file named <code>app.yml</code> in the root of your repository
        and commit it. The manifest below is the reference &mdash; a complete,
        valid <code>app.yml</code> using every field this guide documents.
        Copy it and replace the values with your own.
      </p>
      <div class="code-block">
        <div class="code-toolbar">
          <span class="code-filename">app.yml</span>
          <button class="copy-btn" type="button" @click="copyExample">
            {{ copied ? "Copied!" : "Copy" }}
          </button>
        </div>
        <pre><code>{{ exampleManifest }}</code></pre>
      </div>
      <p class="guide-note">
        This example is also served as a file you can download and adapt:
        <a :href="EXAMPLE_URL" target="_blank" rel="noopener">{{ EXAMPLE_URL }}</a>.
      </p>
    </section>

    <section class="guide-section">
      <h2>2. Publish to the App Store</h2>
      <p>
        From <strong>My Code</strong>, enable
        <strong>Publishing &rarr; App Store</strong> on the repository. Pennsieve
        validates <code>app.yml</code> during registration and maps it onto the
        application: <code>runtime</code> becomes the runtime configuration,
        <code>parameters</code> become the typed parameter schema, and
        <code>inputs</code>/<code>outputs</code> are used to validate
        workflow connections.
      </p>
      <p class="guide-note guide-note--warn">
        If <code>app.yml</code> is missing or fails validation, the application
        still registers, but with no declared defaults — every parameter must
        then be configured manually for each run.
      </p>
    </section>

    <section class="guide-section">
      <h2>Top-level fields</h2>
      <table class="field-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in topLevelFields" :key="f.name">
            <td><code>{{ f.name }}</code></td>
            <td>{{ f.type }}</td>
            <td>{{ f.required ? "Yes" : "—" }}</td>
            <td>{{ f.desc }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="guide-section">
      <h2>Application fields</h2>
      <p>
        Everything under <code>application</code> describes the app itself.
      </p>
      <table class="field-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in applicationFields" :key="f.name">
            <td><code>{{ f.name }}</code></td>
            <td>{{ f.type }}</td>
            <td>{{ f.required ? "Yes" : "—" }}</td>
            <td>{{ f.desc }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="guide-section">
      <h2>Runtime fields</h2>
      <p>
        <code>runtime</code> carries the defaults a run starts from. A GPU
        application declares <code>gpu</code> among its
        <code>computeTypes</code>; there is no standalone <code>gpu</code>
        block.
      </p>
      <table class="field-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in runtimeFields" :key="f.name">
            <td><code>{{ f.name }}</code></td>
            <td>{{ f.type }}</td>
            <td>{{ f.required ? "Yes" : "—" }}</td>
            <td>{{ f.desc }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="guide-section">
      <h2>Parameter fields</h2>
      <p>
        <code>parameters</code> declares the values a user supplies when the
        application runs. Each entry becomes a field in the workflow builder,
        pre-filled with its <code>defaultValue</code>. A parameter with no
        default is treated as required. Note that
        <code>defaultValue</code> and <code>validValues</code> are written as
        strings even for <code>number</code> and <code>boolean</code>
        parameters.
      </p>
      <table class="field-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in parameterFields" :key="f.name">
            <td><code>{{ f.name }}</code></td>
            <td>{{ f.type }}</td>
            <td>{{ f.required ? "Yes" : "—" }}</td>
            <td>{{ f.desc }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="guide-section">
      <h2>Inputs &amp; outputs</h2>
      <p>
        Entries in <code>inputs</code> and <code>outputs</code> declare what
        the application consumes and produces. Each names the
        <code>mediaTypes</code> it carries. Pennsieve uses these to validate
        that two applications can be connected in a workflow.
      </p>
      <table class="field-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in inputOutputFields" :key="f.name">
            <td><code>{{ f.name }}</code></td>
            <td>{{ f.type }}</td>
            <td>{{ f.required ? "Yes" : "—" }}</td>
            <td>{{ f.desc }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="guide-bottom-spacer" aria-hidden="true" />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.manifest-guide {
  max-width: 900px;
  margin: 0;
  padding: 16px 24px 0;
}

/*
  BfPage stretches the stage's last child to the viewport (flex: 1, min-height:
  0), so content taller than the viewport overflows the root box and any
  padding-bottom on it is painted mid-scroll. A spacer in the content flow is
  what actually puts room after the last section.
*/
.guide-bottom-spacer {
  flex: 0 0 96px;
  height: 96px;
}

.guide-header {
  margin-bottom: 32px;

  h1 {
    font-size: 24px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  .lede {
    font-size: 15px;
    color: theme.$gray_5;
    line-height: 1.6;
    margin: 0 0 16px;
  }

  .builder-cta {
    display: inline-block;
    font-size: 14px;
    font-weight: 500;
    color: theme.$purple_1;
  }
}

.guide-section {
  margin-bottom: 40px;

  h2 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.6;
    margin: 0 0 12px 0;
  }
}

code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.9em;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 3px;
  padding: 1px 5px;
}

.code-block {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  overflow: hidden;
  margin: 0 0 12px 0;

  .code-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: theme.$gray_1;
    border-bottom: 1px solid theme.$gray_2;
    padding: 6px 12px;
  }

  .code-filename {
    font-family: "SFMono-Regular", Consolas, Menlo, monospace;
    font-size: 13px;
    color: theme.$gray_5;
  }

  .copy-btn {
    background: none;
    border: 1px solid theme.$gray_3;
    border-radius: 3px;
    color: theme.$purple_1;
    cursor: pointer;
    font-size: 13px;
    padding: 2px 10px;

    &:hover {
      background: rgba(theme.$purple_1, 0.08);
    }
  }

  pre {
    margin: 0;
    padding: 16px;
    overflow-x: auto;
    background: #fff;

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
}

.guide-note {
  background: rgba(theme.$purple_1, 0.08);
  border-left: 3px solid theme.$purple_1;
  padding: 12px 16px;
  font-size: 13px;
  color: theme.$gray_5;

  &--warn {
    background: rgba(#e0a800, 0.1);
    border-left-color: #e0a800;
  }
}

.field-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th,
  td {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid theme.$gray_2;
    vertical-align: top;
  }

  th {
    color: theme.$gray_6;
    font-weight: 500;
    border-bottom: 2px solid theme.$gray_2;
  }

  td {
    color: theme.$gray_5;
  }
}
</style>
