/**
 * Application Schema
 * -----------------
 * Canonical, framework-free definition of an application's schema and the
 * helpers used to author it (Create/Edit Application form), serialize it for
 * the API, and consume it elsewhere (e.g. populating default parameter values
 * and validating input/output compatibility in the Workflow Builder).
 *
 * This module is the single source of truth for the schema shape. It is pure
 * (no Vue, no store, no network) so it can be imported anywhere and unit
 * tested in isolation.
 *
 * The schema covers everything the application ticket calls for:
 *   - runtime    : compute types (standard / lambda) and GPU configuration
 *   - resources  : CPU and memory
 *   - parameters : typed, defaultable, optionally-required run parameters
 *   - inputs     : ports the application consumes  (workflow validation)
 *   - outputs    : ports the application produces  (workflow validation)
 *   - tags       : free-form labels
 *   - categories : controlled-vocabulary classification
 *
 * ── Two shapes, one source of truth ──────────────────────────────────────
 *   1. The *editable* shape (`ApplicationSchema`) is nested and UI-friendly;
 *      form components bind directly to it.
 *   2. The *wire* shape is flatter and matches the existing API/model:
 *      `runtimeConfig`, the flat `params` map, and a richer `paramSchema`
 *      array. `parseApplication()` and `buildSchemaPayload()` bridge the two.
 *
 * Backwards compatibility: we still emit the flat `params` map that the API
 * and the current Workflow Builder already read, alongside the richer
 * `paramSchema`. Existing consumers keep working; new consumers can opt into
 * the richer schema.
 */

import {
  STANDARD_CPU_OPTIONS,
  getStandardMemoryOptions,
  formatResourceLabel,
} from "../RunMonitor/runHelpers";

/* ──────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────────── */

/** Supported parameter value types. Drives the form control and validation. */
export const PARAM_TYPES = Object.freeze({
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  ENUM: "enum",
});

/** Human-facing labels + the Element Plus control each type maps to. */
export const PARAM_TYPE_OPTIONS = Object.freeze([
  { value: PARAM_TYPES.STRING, label: "Text", control: "input" },
  { value: PARAM_TYPES.NUMBER, label: "Number", control: "number" },
  { value: PARAM_TYPES.BOOLEAN, label: "True / False", control: "switch" },
  { value: PARAM_TYPES.ENUM, label: "Choice", control: "select" },
]);

/** Compute runtimes an application may be built for. */
export const COMPUTE_TYPES = Object.freeze({
  STANDARD: "standard",
  LAMBDA: "lambda",
});

export const DEFAULT_COMPUTE_TYPES = Object.freeze([COMPUTE_TYPES.STANDARD]);

/**
 * Data types a port (input/output) can carry. Used to validate that an
 * upstream application's outputs are compatible with a downstream
 * application's inputs when wiring a workflow. `any` matches everything.
 */
export const PORT_DATA_TYPES = Object.freeze([
  { value: "any", label: "Any" },
  { value: "file", label: "File" },
  { value: "directory", label: "Directory" },
  { value: "package", label: "Pennsieve Package" },
  { value: "dataset", label: "Pennsieve Dataset" },
  { value: "tabular", label: "Tabular / CSV" },
  { value: "image", label: "Image" },
  { value: "timeseries", label: "Time Series" },
]);

/**
 * Controlled vocabulary for application categories. Free-form values are
 * still permitted (the form allows custom entries), but offering a curated
 * list keeps classification consistent and filterable.
 */
export const APPLICATION_CATEGORIES = Object.freeze([
  "Preprocessing",
  "Segmentation",
  "Registration",
  "Quantification",
  "Visualization",
  "Machine Learning",
  "Statistics",
  "Format Conversion",
  "Quality Control",
  "Utility",
]);

/* ──────────────────────────────────────────────────────────────────────────
 * Typedefs (JSDoc — this is a plain-JS codebase)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} ParameterSchema
 * @property {string} name                 Machine name (key passed to the app).
 * @property {string} [label]              Human-facing label; defaults to name.
 * @property {string} [description]        Help text shown next to the control.
 * @property {("string"|"number"|"boolean"|"enum")} type
 * @property {boolean} required            Must a value exist before a run?
 * @property {(string|number|boolean|null)} defaultValue  App-provided default.
 * @property {Array<string|number>} [allowedValues]  Choices for `enum`.
 * @property {number} [min]                Inclusive min for `number`.
 * @property {number} [max]                Inclusive max for `number`.
 */

/**
 * @typedef {Object} PortSchema
 * @property {string} name
 * @property {string} [description]
 * @property {string} dataType            One of PORT_DATA_TYPES values.
 * @property {boolean} [required]         Inputs only: must be connected.
 */

/**
 * @typedef {Object} GpuConfig
 * @property {boolean} enabled
 * @property {number} [count]             Number of GPUs (>=1 when enabled).
 * @property {string} [type]              Accelerator type, e.g. "nvidia-t4".
 */

/**
 * @typedef {Object} ApplicationSchema
 * @property {{cpu: (number|null), memory: (number|null)}} resources
 * @property {{computeTypes: string[], gpu: GpuConfig}} runtime
 * @property {ParameterSchema[]} parameters
 * @property {PortSchema[]} inputs
 * @property {PortSchema[]} outputs
 * @property {string[]} tags
 * @property {string[]} categories
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Factories — produce well-formed empty/default building blocks
 * ────────────────────────────────────────────────────────────────────────── */

/** @returns {GpuConfig} */
export const createGpuConfig = (overrides = {}) => ({
  enabled: false,
  count: 1,
  type: "",
  ...overrides,
});

/** @returns {ParameterSchema} */
export const createParameter = (overrides = {}) => ({
  name: "",
  label: "",
  description: "",
  type: PARAM_TYPES.STRING,
  required: false,
  defaultValue: null,
  allowedValues: [],
  min: null,
  max: null,
  ...overrides,
});

/** @returns {PortSchema} */
export const createPort = (overrides = {}) => ({
  name: "",
  description: "",
  dataType: "any",
  required: false,
  ...overrides,
});

/**
 * A blank, fully-formed schema for a brand-new application.
 * @returns {ApplicationSchema}
 */
export const createApplicationSchema = (overrides = {}) => ({
  resources: { cpu: null, memory: null },
  runtime: {
    computeTypes: [...DEFAULT_COMPUTE_TYPES],
    gpu: createGpuConfig(),
  },
  parameters: [],
  inputs: [],
  outputs: [],
  tags: [],
  categories: [],
  ...overrides,
});

/* ──────────────────────────────────────────────────────────────────────────
 * Parsing — API application  ->  editable ApplicationSchema
 * ────────────────────────────────────────────────────────────────────────── */

const asArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Coerce one raw parameter descriptor (from `paramSchema`) into a normalized
 * ParameterSchema. Tolerant of partial/legacy shapes.
 * @returns {ParameterSchema}
 */
const parseParameter = (raw) => {
  if (raw == null) return createParameter();
  const type = Object.values(PARAM_TYPES).includes(raw.type)
    ? raw.type
    : raw.allowedValues?.length || raw.validValues?.length
      ? PARAM_TYPES.ENUM
      : PARAM_TYPES.STRING;
  return createParameter({
    name: raw.name ?? "",
    label: raw.label ?? "",
    description: raw.description ?? "",
    type,
    required: Boolean(raw.required),
    defaultValue: raw.defaultValue ?? null,
    // `validValues` is the legacy key the Workflow Builder already reads.
    allowedValues: asArray(raw.allowedValues ?? raw.validValues),
    min: raw.min ?? null,
    max: raw.max ?? null,
  });
};

/**
 * Build the parameter list from whichever representation an application has:
 * the richer `paramSchema` array is preferred; otherwise we lift the flat
 * `params` map (string defaults) into typed parameters.
 * @returns {ParameterSchema[]}
 */
export const parseParameters = (app) => {
  if (!app) return [];
  if (Array.isArray(app.paramSchema) && app.paramSchema.length > 0) {
    return app.paramSchema.map(parseParameter);
  }
  if (app.params && typeof app.params === "object" && !Array.isArray(app.params)) {
    return Object.entries(app.params).map(([name, value]) =>
      createParameter({
        name,
        type: PARAM_TYPES.STRING,
        defaultValue: value === "" ? null : value,
      }),
    );
  }
  return [];
};

/** @returns {GpuConfig} */
const parseGpu = (rc) => {
  const gpu = rc?.gpu;
  if (!gpu) return createGpuConfig();
  // Accept either a structured object or a bare positive number/boolean.
  if (typeof gpu === "number") {
    return createGpuConfig({ enabled: gpu > 0, count: gpu || 1 });
  }
  if (typeof gpu === "boolean") return createGpuConfig({ enabled: gpu });
  return createGpuConfig({
    enabled: Boolean(gpu.enabled ?? (gpu.count > 0)),
    count: gpu.count ?? 1,
    type: gpu.type ?? "",
  });
};

/**
 * Normalize a raw API application object into the editable ApplicationSchema
 * the form binds to.
 * @param {Object} app
 * @returns {ApplicationSchema}
 */
export const parseApplication = (app) => {
  const rc = app?.runtimeConfig || {};
  const computeTypes =
    Array.isArray(rc.computeTypes) && rc.computeTypes.length
      ? rc.computeTypes.map((t) => (t === "ecs" ? COMPUTE_TYPES.STANDARD : t))
      : [...DEFAULT_COMPUTE_TYPES];

  return createApplicationSchema({
    resources: { cpu: rc.cpu ?? null, memory: rc.memory ?? null },
    runtime: { computeTypes, gpu: parseGpu(rc) },
    parameters: parseParameters(app),
    inputs: asArray(app?.inputs).map(parsePort),
    outputs: asArray(app?.outputs).map(parsePort),
    tags: asArray(app?.tags),
    categories: asArray(app?.categories),
  });
};

/** @returns {PortSchema} */
const parsePort = (raw) =>
  createPort({
    name: raw?.name ?? "",
    description: raw?.description ?? "",
    dataType: raw?.dataType ?? "any",
    required: Boolean(raw?.required),
  });

/* ──────────────────────────────────────────────────────────────────────────
 * Serialization — editable ApplicationSchema  ->  API payload
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Strip a parameter down to the fields meaningful for its type so we never
 * send (for example) `allowedValues` on a plain text param.
 * @returns {ParameterSchema}
 */
const serializeParameter = (p) => {
  const out = {
    name: (p.name || "").trim(),
    type: p.type,
    required: Boolean(p.required),
    defaultValue: coerceParameterValue(p, p.defaultValue),
  };
  if (p.label && p.label.trim()) out.label = p.label.trim();
  if (p.description && p.description.trim()) out.description = p.description.trim();
  if (p.type === PARAM_TYPES.ENUM) out.allowedValues = asArray(p.allowedValues);
  if (p.type === PARAM_TYPES.NUMBER) {
    if (p.min != null && p.min !== "") out.min = Number(p.min);
    if (p.max != null && p.max !== "") out.max = Number(p.max);
  }
  return out;
};

/**
 * The flat `{ name: defaultValue }` map the API and the current Workflow
 * Builder already consume. Only parameters that actually have a default are
 * included (required-with-no-default params are set at run time).
 * @param {ParameterSchema[]} parameters
 * @returns {Object<string,(string|number|boolean)>}
 */
export const flattenParams = (parameters) => {
  const out = {};
  for (const p of asArray(parameters)) {
    const name = (p.name || "").trim();
    if (!name) continue;
    const val = coerceParameterValue(p, p.defaultValue);
    if (val != null && val !== "") out[name] = val;
  }
  return out;
};

const serializePort = (port) => {
  const out = {
    name: (port.name || "").trim(),
    dataType: port.dataType || "any",
  };
  if (port.description && port.description.trim())
    out.description = port.description.trim();
  if (port.required) out.required = true;
  return out;
};

/**
 * Build the schema-related slice of the application create/update payload.
 * The caller merges this with the non-schema fields it owns (name, source,
 * account, computeNode, etc.).
 *
 * @param {ApplicationSchema} schema
 * @returns {Object} payload slice with runtimeConfig, params, paramSchema,
 *                   inputs, outputs, tags, categories.
 */
export const buildSchemaPayload = (schema) => {
  const s = schema || createApplicationSchema();
  const named = asArray(s.parameters).filter((p) => (p.name || "").trim());

  const runtimeConfig = {
    cpu: s.resources?.cpu != null ? Number(s.resources.cpu) : null,
    memory: s.resources?.memory != null ? Number(s.resources.memory) : null,
    computeTypes:
      s.runtime?.computeTypes?.length
        ? [...s.runtime.computeTypes]
        : [...DEFAULT_COMPUTE_TYPES],
  };
  if (s.runtime?.gpu?.enabled) {
    runtimeConfig.gpu = {
      enabled: true,
      count: Number(s.runtime.gpu.count) || 1,
      ...(s.runtime.gpu.type ? { type: s.runtime.gpu.type } : {}),
    };
  }

  const payload = { runtimeConfig };

  const params = flattenParams(named);
  if (Object.keys(params).length) payload.params = params;
  if (named.length) payload.paramSchema = named.map(serializeParameter);

  const inputs = asArray(s.inputs).filter((p) => (p.name || "").trim());
  const outputs = asArray(s.outputs).filter((p) => (p.name || "").trim());
  if (inputs.length) payload.inputs = inputs.map(serializePort);
  if (outputs.length) payload.outputs = outputs.map(serializePort);

  const tags = asArray(s.tags).map((t) => String(t).trim()).filter(Boolean);
  const categories = asArray(s.categories)
    .map((c) => String(c).trim())
    .filter(Boolean);
  if (tags.length) payload.tags = tags;
  if (categories.length) payload.categories = categories;

  return payload;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Serialization — editable ApplicationSchema  ->  app.json manifest
 * ────────────────────────────────────────────────────────────────────────── */

/** Canonical location of the manifest JSON Schema (served as a static asset). */
export const MANIFEST_SCHEMA_URL =
  "https://app.pennsieve.io/static/schemas/app.v1.json";

export const MANIFEST_SCHEMA_VERSION = "1.0";

/** Roles an application can play within a workflow. */
export const APPLICATION_TYPES = Object.freeze([
  { value: "processor", label: "Processor" },
  { value: "preprocessor", label: "Preprocessor" },
  { value: "postprocessor", label: "Postprocessor" },
]);

/**
 * Serialize one parameter into the manifest shape. Differs from the API
 * payload (`serializeParameter`) in that the default is keyed `default` (not
 * `defaultValue`) and empty/irrelevant fields are omitted to keep the emitted
 * app.json clean.
 */
const manifestParameter = (p) => {
  const out = { name: (p.name || "").trim(), type: p.type };
  if (p.label && p.label.trim()) out.label = p.label.trim();
  if (p.description && p.description.trim()) out.description = p.description.trim();
  if (p.required) out.required = true;
  const def = coerceParameterValue(p, p.defaultValue);
  if (def != null && def !== "") out.default = def;
  if (p.type === PARAM_TYPES.ENUM) out.allowedValues = asArray(p.allowedValues);
  if (p.type === PARAM_TYPES.NUMBER) {
    if (p.min != null && p.min !== "") out.min = Number(p.min);
    if (p.max != null && p.max !== "") out.max = Number(p.max);
  }
  return out;
};

const manifestPort = (port) => {
  const out = {
    name: (port.name || "").trim(),
    dataType: port.dataType || "any",
  };
  if (port.required) out.required = true;
  if (port.description && port.description.trim())
    out.description = port.description.trim();
  return out;
};

/**
 * Build the `app.json` manifest object from the editable schema plus the
 * top-level metadata the form collects. The result matches the JSON Schema at
 * MANIFEST_SCHEMA_URL and is what the author commits to their repository.
 *
 * @param {ApplicationSchema} schema
 * @param {{name?: string, description?: string, applicationType?: string}} [meta]
 * @returns {Object} app.json manifest
 */
export const buildManifest = (schema, meta = {}) => {
  const s = schema || createApplicationSchema();
  const manifest = {
    $schema: MANIFEST_SCHEMA_URL,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
  };

  if (meta.name && meta.name.trim()) manifest.name = meta.name.trim();
  if (meta.description && meta.description.trim())
    manifest.description = meta.description.trim();
  if (meta.applicationType) manifest.applicationType = meta.applicationType;

  const mCategories = asArray(s.categories)
    .map((c) => String(c).trim())
    .filter(Boolean);
  const mTags = asArray(s.tags).map((t) => String(t).trim()).filter(Boolean);
  if (mCategories.length) manifest.categories = mCategories;
  if (mTags.length) manifest.tags = mTags;

  const runtime = {
    computeTypes: s.runtime?.computeTypes?.length
      ? [...s.runtime.computeTypes]
      : [...DEFAULT_COMPUTE_TYPES],
  };
  if (s.runtime?.gpu?.enabled) {
    runtime.gpu = {
      enabled: true,
      count: Number(s.runtime.gpu.count) || 1,
      ...(s.runtime.gpu.type ? { type: s.runtime.gpu.type } : {}),
    };
  }
  manifest.runtime = runtime;

  const resources = {};
  if (s.resources?.cpu != null) resources.cpu = Number(s.resources.cpu);
  if (s.resources?.memory != null) resources.memory = Number(s.resources.memory);
  if (Object.keys(resources).length) manifest.resources = resources;

  const mParams = asArray(s.parameters).filter((p) => (p.name || "").trim());
  if (mParams.length) manifest.parameters = mParams.map(manifestParameter);

  const mInputs = asArray(s.inputs).filter((p) => (p.name || "").trim());
  const mOutputs = asArray(s.outputs).filter((p) => (p.name || "").trim());
  if (mInputs.length) manifest.inputs = mInputs.map(manifestPort);
  if (mOutputs.length) manifest.outputs = mOutputs.map(manifestPort);

  return manifest;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Consumption — default values & the paramSchema shape the builder reads
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The `[{ name, defaultValue, validValues }]` array the Workflow Builder
 * already understands, enriched with type/required/description. Use this to
 * feed `node.data.paramSchema` so the builder can populate and validate
 * parameter defaults from the application schema.
 * @param {ParameterSchema[]} parameters
 */
export const toParamSchema = (parameters) =>
  asArray(parameters)
    .filter((p) => (p.name || "").trim())
    .map((p) => {
      const coerced = coerceParameterValue(p, p.defaultValue);
      return {
        name: p.name.trim(),
        type: p.type,
        required: Boolean(p.required),
        description: p.description || "",
        // `undefined` (not null) signals "no default" to the builder UI.
        defaultValue: coerced == null || coerced === "" ? undefined : coerced,
        validValues:
          p.type === PARAM_TYPES.ENUM ? asArray(p.allowedValues) : [],
      };
    });

/**
 * Resolve the effective default-parameter map for a node: app-provided
 * defaults overlaid with any workflow-level overrides.
 * @param {ParameterSchema[]} parameters
 * @param {Object} [overrides]  workflow-level defaultParams override map
 */
export const extractDefaultParams = (parameters, overrides = {}) => {
  const base = flattenParams(parameters);
  return { ...base, ...(overrides || {}) };
};

/* ──────────────────────────────────────────────────────────────────────────
 * Validation
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Coerce a raw value to the parameter's declared type. Returns `null` for
 * empty/unset values so callers can distinguish "no value" from a real one.
 * @param {ParameterSchema} param
 * @param {*} value
 */
export function coerceParameterValue(param, value) {
  if (value == null || value === "") return null;
  switch (param?.type) {
    case PARAM_TYPES.NUMBER: {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case PARAM_TYPES.BOOLEAN:
      if (typeof value === "boolean") return value;
      return value === "true" || value === true || value === 1 || value === "1";
    default:
      return String(value);
  }
}

/**
 * Validate one parameter value against its schema.
 * @returns {{valid: boolean, error: (string|null)}}
 */
export function validateParameterValue(param, value) {
  const has = value != null && value !== "";
  if (param.required && !has) {
    return { valid: false, error: `${param.name || "Parameter"} is required` };
  }
  if (!has) return { valid: true, error: null };

  switch (param.type) {
    case PARAM_TYPES.NUMBER: {
      const n = Number(value);
      if (!Number.isFinite(n))
        return { valid: false, error: "Must be a number" };
      if (param.min != null && n < Number(param.min))
        return { valid: false, error: `Must be ≥ ${param.min}` };
      if (param.max != null && n > Number(param.max))
        return { valid: false, error: `Must be ≤ ${param.max}` };
      return { valid: true, error: null };
    }
    case PARAM_TYPES.ENUM: {
      const allowed = asArray(param.allowedValues).map(String);
      if (allowed.length && !allowed.includes(String(value)))
        return { valid: false, error: "Not an allowed value" };
      return { valid: true, error: null };
    }
    default:
      return { valid: true, error: null };
  }
}

/**
 * Validate the whole parameter list as it is authored in the form: names are
 * present, unique, and each enum/number is internally consistent.
 * @param {ParameterSchema[]} parameters
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateParameters(parameters) {
  const errors = [];
  const seen = new Set();
  asArray(parameters).forEach((p, i) => {
    const name = (p.name || "").trim();
    const where = name || `Parameter ${i + 1}`;
    if (!name) {
      errors.push(`${where} is missing a name`);
    } else if (seen.has(name)) {
      errors.push(`Duplicate parameter name "${name}"`);
    } else {
      seen.add(name);
    }
    if (p.type === PARAM_TYPES.ENUM && !asArray(p.allowedValues).length) {
      errors.push(`${where} is a choice but has no allowed values`);
    }
    if (
      p.type === PARAM_TYPES.NUMBER &&
      p.min != null &&
      p.max != null &&
      p.min !== "" &&
      p.max !== "" &&
      Number(p.min) > Number(p.max)
    ) {
      errors.push(`${where}: min is greater than max`);
    }
    // A declared default must itself satisfy the param's constraints.
    if (p.defaultValue != null && p.defaultValue !== "") {
      const res = validateParameterValue(p, p.defaultValue);
      if (!res.valid) errors.push(`${where} default: ${res.error}`);
    }
  });
  return { valid: errors.length === 0, errors };
}

/**
 * Are an upstream output and a downstream input compatible? `any` on either
 * side matches; otherwise data types must be equal. Used to validate
 * connections between applications in a workflow.
 * @param {PortSchema} output
 * @param {PortSchema} input
 */
export function arePortsCompatible(output, input) {
  if (!output || !input) return false;
  const a = output.dataType || "any";
  const b = input.dataType || "any";
  return a === "any" || b === "any" || a === b;
}

/**
 * Can `sourceApp`'s outputs satisfy `targetApp`'s required inputs? Returns the
 * required inputs that have no compatible upstream output. Empty array == ok.
 * @param {ApplicationSchema|Object} sourceApp  parsed schema or raw app
 * @param {ApplicationSchema|Object} targetApp
 * @returns {{compatible: boolean, unmetInputs: PortSchema[]}}
 */
export function validateAppConnection(sourceApp, targetApp) {
  const outputs = asArray(sourceApp?.outputs).map(parsePort);
  const inputs = asArray(targetApp?.inputs).map(parsePort);
  const required = inputs.filter((i) => i.required);
  const unmetInputs = required.filter(
    (input) => !outputs.some((output) => arePortsCompatible(output, input)),
  );
  return { compatible: unmetInputs.length === 0, unmetInputs };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Resource helpers (thin re-exports so consumers have one import surface)
 * ────────────────────────────────────────────────────────────────────────── */

export {
  STANDARD_CPU_OPTIONS,
  getStandardMemoryOptions,
  formatResourceLabel,
};
