<script setup>
import { ref } from "vue";

/*
  The canonical app.yml example shown in the guide. Kept as a string so it can
  be rendered verbatim and copied to the clipboard in one click. The
  `# yaml-language-server` directive enables schema autocomplete/validation in
  editors such as VS Code.
*/
const exampleManifest = `# yaml-language-server: $schema=https://app.pennsieve.io/static/schemas/app-manifest.v1.json
schemaVersion: "1.0"

name: Spike Sorter
description: Detects and sorts neural spikes from extracellular recordings.
applicationType: processor
categories:
  - Preprocessing
  - Machine Learning
tags:
  - electrophysiology
  - spike-sorting

runtime:
  computeTypes:
    - standard
  gpu:
    enabled: true
    count: 1
    type: nvidia-t4

resources:
  cpu: 4096
  memory: 16384

parameters:
  - name: threshold
    label: Detection threshold (σ)
    description: Spike detection threshold in standard deviations.
    type: number
    required: true
    default: 5
    min: 1
    max: 20
  - name: sorter
    label: Sorting algorithm
    type: enum
    default: kilosort
    allowedValues:
      - kilosort
      - mountainsort
      - spykingcircus
  - name: drift_correction
    label: Enable drift correction
    type: boolean
    default: true

inputs:
  - name: recording
    dataType: timeseries
    required: true
    description: Raw extracellular recording.

outputs:
  - name: sorted_units
    dataType: package
    description: Sorted spike trains and unit metadata.`;

const SCHEMA_URL = "https://app.pennsieve.io/static/schemas/app-manifest.v1.json";

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
  Field reference tables. Driven by data so the guide stays in lock-step with the
  JSON Schema served at SCHEMA_URL.
*/
const topLevelFields = [
  { name: "schemaVersion", type: "string", required: true, desc: 'Manifest version. Must be "1.0".' },
  { name: "name", type: "string", required: true, desc: "Human-readable application name." },
  { name: "description", type: "string", required: false, desc: "Short description of what the application does." },
  { name: "applicationType", type: "enum", required: false, desc: "processor, preprocessor, or postprocessor." },
  { name: "categories", type: "string[]", required: false, desc: "Curated categories used to group applications." },
  { name: "tags", type: "string[]", required: false, desc: "Free-form labels for search and filtering." },
  { name: "runtime", type: "object", required: false, desc: "computeTypes and optional gpu configuration." },
  { name: "resources", type: "object", required: false, desc: "Default cpu (units) and memory (MB)." },
  { name: "parameters", type: "object[]", required: false, desc: "Run-time parameters with defaults." },
  { name: "inputs", type: "object[]", required: false, desc: "Typed input ports for workflow validation." },
  { name: "outputs", type: "object[]", required: false, desc: "Typed output ports for workflow validation." },
];

const parameterFields = [
  { name: "name", type: "string", required: true, desc: "Machine name passed to the application. Must be unique." },
  { name: "type", type: "enum", required: true, desc: "string, number, boolean, or enum." },
  { name: "label", type: "string", required: false, desc: "Label shown in the run form." },
  { name: "description", type: "string", required: false, desc: "Help text shown beneath the field." },
  { name: "required", type: "boolean", required: false, desc: "Whether a value must be supplied before a run starts." },
  { name: "default", type: "any", required: false, desc: "Default value that pre-populates the run form." },
  { name: "allowedValues", type: "array", required: false, desc: 'Permitted values. Required when type is "enum".' },
  { name: "min / max", type: "number", required: false, desc: "Bounds for numeric parameters." },
];

const portFields = [
  { name: "name", type: "string", required: true, desc: "Port name. Unique among inputs (or outputs)." },
  { name: "dataType", type: "enum", required: true, desc: "any, file, directory, package, dataset, tabular, image, timeseries." },
  { name: "description", type: "string", required: false, desc: "What flows through this port." },
  { name: "required", type: "boolean", required: false, desc: "Whether the port must be connected (inputs only)." },
];
</script>

<template>
  <div class="manifest-guide">
    <header class="guide-header">
      <h1>Application manifest (app.yml)</h1>
      <p class="lede">
        Applications are published from a GitHub repository. Add an
        <code>app.yml</code> file to the root of your repository to declare its
        runtime, resources, parameters, and inputs/outputs. When you publish the
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
        and commit it. The example below is a complete, valid manifest.
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
        Add the <code># yaml-language-server</code> directive shown above to get
        autocomplete and inline validation in editors such as VS Code. The schema
        lives at
        <a :href="SCHEMA_URL" target="_blank" rel="noopener">{{ SCHEMA_URL }}</a>.
      </p>
    </section>

    <section class="guide-section">
      <h2>2. Publish to the App Store</h2>
      <p>
        From <strong>My Code</strong>, enable
        <strong>Publishing &rarr; App Store</strong> on the repository. Pennsieve
        validates <code>app.yml</code> during registration and maps it onto the
        application: <code>resources</code> and <code>runtime</code> become the
        runtime configuration, <code>parameters</code> become the typed parameter
        schema, and <code>inputs</code>/<code>outputs</code> become the ports used
        to validate workflow connections.
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
      <h2>Parameter fields</h2>
      <p>
        Each entry in <code>parameters</code> describes one run-time input. The
        <code>default</code> value pre-populates the field when a user adds the
        application to a workflow.
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
      <h2>Input &amp; output ports</h2>
      <p>
        Entries in <code>inputs</code> and <code>outputs</code> declare typed
        ports. Pennsieve uses the <code>dataType</code> of an upstream output and
        a downstream input to validate that two applications can be connected in a
        workflow.
      </p>
      <table class="field-table">
        <thead>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr v-for="f in portFields" :key="f.name">
            <td><code>{{ f.name }}</code></td>
            <td>{{ f.type }}</td>
            <td>{{ f.required ? "Yes" : "—" }}</td>
            <td>{{ f.desc }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../styles/theme";

.manifest-guide {
  max-width: 900px;
  margin: 0;
  padding: 16px 24px 48px;
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
