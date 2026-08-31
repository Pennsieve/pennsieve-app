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

import { dump as dumpYaml, load as loadYaml } from "js-yaml";

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
  // GPU is a compute type, not a separate capability block. Older manifests
  // wrote `runtime.gpu: {enabled: true}`; that is read as this value.
  GPU: "gpu",
});

export const DEFAULT_COMPUTE_TYPES = Object.freeze([COMPUTE_TYPES.STANDARD]);

/**
 * Data types a port (input/output) can carry. Used to validate that an
 * upstream application's outputs are compatible with a downstream
 * application's inputs when wiring a workflow. `any` matches everything.
 *
 * The authoritative vocabulary is the platform's package types, served by
 * `GET {api2Url}/packages/types` (analysisModule/fetchPackageTypes). This list
 * is only the fallback used before that call lands or when it fails — pass the
 * fetched list to portDataTypeOptions() instead of reading this directly.
 */
export const FALLBACK_PORT_DATA_TYPES = Object.freeze([
  { value: "any", label: "Any" },
]);

/**
 * Options for a port's `dataType` control: "Any" first, then the package types
 * the platform reports. Anything the manifest already declares but the server
 * does not list is kept as well, so opening an older app.yml never silently
 * drops its port types.
 *
 * @param {Array<{value: string, label: string}>} [packageTypes]  from the store
 * @param {string[]} [declared]  dataTypes already present in the manifest
 */
export const portDataTypeOptions = (packageTypes, declared = []) => {
  const options = [...FALLBACK_PORT_DATA_TYPES];
  const seen = new Set(options.map((o) => o.value));
  for (const t of asArray(packageTypes)) {
    if (!t?.value || seen.has(t.value)) continue;
    seen.add(t.value);
    options.push({ value: t.value, label: t.label || t.value });
  }
  for (const value of asArray(declared)) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: value });
  }
  return options;
};

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
 * @property {Array<string|number>} [validValues]  Permitted choices. Presence
 *           means "render a dropdown", whatever the declared type.
 * @property {number} [min]                Inclusive min for `number`.
 * @property {number} [max]                Inclusive max for `number`.
 */

/**
 * @typedef {Object} PortSchema
 * @property {string} name
 * @property {string} [description]
 * @property {string} dataType            A package type from GET /packages/types,
 *                                       or "any".
 * @property {boolean} [required]         Inputs only: must be connected.
 */

/**
 * @typedef {Object} ApplicationSchema
 * @property {{cpu: (number|null), memory: (number|null)}} resources
 * @property {{computeTypes: string[]}} runtime
 * @property {ParameterSchema[]} parameters
 * @property {PortSchema[]} inputs
 * @property {PortSchema[]} outputs
 * @property {string[]} tags
 * @property {string[]} categories
 */

/* ──────────────────────────────────────────────────────────────────────────
 * Factories — produce well-formed empty/default building blocks
 * ────────────────────────────────────────────────────────────────────────── */

/** @returns {ParameterSchema} */
export const createParameter = (overrides = {}) => ({
  name: "",
  label: "",
  description: "",
  type: PARAM_TYPES.STRING,
  required: false,
  defaultValue: null,
  validValues: [],
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
  // Manifest-only descriptors. The backend's app.yml describes ports by media
  // type and cardinality rather than by `dataType`; we retain them for display
  // and validation. buildManifest() does not emit them.
  mediaTypes: [],
  cardinality: "",
  ...overrides,
});

/**
 * A blank, fully-formed schema for a brand-new application.
 * @returns {ApplicationSchema}
 */
export const createApplicationSchema = (overrides = {}) => ({
  resources: { cpu: null, memory: null },
  runtime: { computeTypes: [...DEFAULT_COMPUTE_TYPES] },
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

  // `validValues` / `defaultValue` are the keys app.yml and the API both use;
  // `allowedValues` / `default` are read as legacy aliases only.
  const validValues = asArray(raw.validValues ?? raw.allowedValues);
  const defaultValue = raw.defaultValue ?? raw.default ?? null;

  // A manifest has no separate "enum" type — a choice parameter is written as
  // `type: string` with `validValues`, so an explicit string type does not
  // out-vote the choices. A number or boolean keeps its declared type and
  // still offers its choices.
  const declared = Object.values(PARAM_TYPES).includes(raw.type)
    ? raw.type
    : null;
  const type =
    validValues.length && (declared === null || declared === PARAM_TYPES.STRING)
      ? PARAM_TYPES.ENUM
      : declared || PARAM_TYPES.STRING;

  return createParameter({
    name: raw.name ?? "",
    label: raw.label ?? "",
    description: raw.description ?? "",
    type,
    // A parameter with no default has nothing to pre-populate the run form
    // with, so it is treated as required unless it says otherwise explicitly.
    required:
      raw.required == null
        ? defaultValue == null || defaultValue === ""
        : Boolean(raw.required),
    defaultValue,
    validValues,
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

/**
 * Did a legacy `gpu:` descriptor ask for a GPU? Accepts the structured object
 * as well as the bare number/boolean forms found in older manifests.
 */
const legacyGpuEnabled = (gpu) => {
  if (!gpu) return false;
  if (typeof gpu === "number") return gpu > 0;
  if (typeof gpu === "boolean") return gpu;
  return Boolean(gpu.enabled ?? Number(gpu.count) > 0);
};

/**
 * Normalize a `computeTypes` list off a runtime/runtimeConfig object: map the
 * legacy "ecs" alias to "standard" and fold a legacy `gpu:` block in as the
 * "gpu" compute type, since that is all it ever meant.
 * @returns {string[]}
 */
const parseComputeTypes = (rc) => {
  const declared = Array.isArray(rc?.computeTypes) ? rc.computeTypes : [];
  const types = declared.map((t) =>
    t === "ecs" ? COMPUTE_TYPES.STANDARD : t,
  );
  if (legacyGpuEnabled(rc?.gpu)) types.push(COMPUTE_TYPES.GPU);
  const unique = [...new Set(types.filter(Boolean))];
  return unique.length ? unique : [...DEFAULT_COMPUTE_TYPES];
};

/**
 * Normalize a raw API application object into the editable ApplicationSchema
 * the form binds to.
 * @param {Object} app
 * @returns {ApplicationSchema}
 */
export const parseApplication = (app) => {
  const rc = app?.runtimeConfig || {};

  return createApplicationSchema({
    resources: { cpu: rc.cpu ?? null, memory: rc.memory ?? null },
    runtime: { computeTypes: parseComputeTypes(rc) },
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
    // Carried through so port compatibility can compare media types when a
    // manifest describes ports that way.
    mediaTypes: asArray(raw?.mediaTypes).map(String),
    cardinality: typeof raw?.cardinality === "string" ? raw.cardinality : "",
  });

/* ──────────────────────────────────────────────────────────────────────────
 * Serialization — editable ApplicationSchema  ->  API payload
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Strip a parameter down to the fields meaningful for its type so we never
 * send (for example) `min` on a plain text param.
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
  // Choices are independent of type — `validValues` is what the run form and
  // the Workflow Builder read back off `paramSchema`.
  const choices = asArray(p.validValues);
  if (choices.length) out.validValues = choices;
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

  // GPU rides in `computeTypes`; there is no separate gpu block to emit.
  const runtimeConfig = {
    cpu: s.resources?.cpu != null ? Number(s.resources.cpu) : null,
    memory: s.resources?.memory != null ? Number(s.resources.memory) : null,
    computeTypes:
      s.runtime?.computeTypes?.length
        ? [...s.runtime.computeTypes]
        : [...DEFAULT_COMPUTE_TYPES],
  };

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
 * Serialization — editable ApplicationSchema  ->  app.yml manifest
 * ────────────────────────────────────────────────────────────────────────── */

/** Canonical location of the example app.yml manifest (served as a static asset). */
export const MANIFEST_EXAMPLE_URL =
  "https://app.pennsieve.io/static/schemas/app-manifest.v1.yml";

export const MANIFEST_SCHEMA_VERSION = "1.0";

/**
 * Roles an application can play within a workflow. Only `processor` is
 * supported today, so it is the sole option the manifest builder offers and
 * the value any unrecognized `application.type` normalizes to.
 */
export const APPLICATION_TYPES = Object.freeze([
  { value: "processor", label: "Processor" },
]);

/**
 * Serialize one parameter into the manifest shape:
 *
 *   - name: threshold
 *     type: number
 *     description: Detection threshold.
 *     defaultValue: "0.5"
 *     validValues: ["0.1", "0.5", "0.9"]
 *
 * Three things differ from the editable model. There is no `enum` type — a
 * choice parameter is a `string` carrying `validValues`. Values are written as
 * strings, which is how both the run form and the API carry them. And
 * `required` is implied by the absence of a `defaultValue`, so it is emitted
 * only when the parameter contradicts that.
 */
const manifestParameter = (p) => {
  const out = {
    name: (p.name || "").trim(),
    type: p.type === PARAM_TYPES.ENUM ? PARAM_TYPES.STRING : p.type,
  };
  if (p.label && p.label.trim()) out.label = p.label.trim();
  if (p.description && p.description.trim()) out.description = p.description.trim();

  const def = coerceParameterValue(p, p.defaultValue);
  const hasDefault = def != null && def !== "";
  if (hasDefault) out.defaultValue = String(def);
  if (Boolean(p.required) !== !hasDefault) out.required = Boolean(p.required);

  const choices = asArray(p.validValues).map(String);
  if (choices.length) out.validValues = choices;

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
 * Build the `app.yml` manifest object from the editable schema plus the
 * metadata the form collects. This is what the author commits (serialized to
 * YAML) to their repository, and it is written in the same shape the platform
 * serves: application metadata under `application:`, cpu/memory under
 * `runtime:` alongside `computeTypes`, and no standalone `gpu:` block.
 *
 * @param {ApplicationSchema} schema
 * @param {{name?: string, description?: string, applicationType?: string,
 *          id?: string, version?: string, maintainers?: Array,
 *          schemaVersion?: string, timeoutSeconds?: number}} [meta]
 * @returns {Object} app.yml manifest
 */
export const buildManifest = (schema, meta = {}) => {
  const s = schema || createApplicationSchema();
  const manifest = {
    schemaVersion: meta.schemaVersion || MANIFEST_SCHEMA_VERSION,
  };

  const str = (v) => (v == null ? "" : String(v).trim());

  const application = {};
  if (str(meta.id)) application.id = str(meta.id);
  if (str(meta.name)) application.name = str(meta.name);
  if (str(meta.description)) application.description = str(meta.description);
  if (meta.applicationType) application.type = meta.applicationType;
  if (str(meta.version)) application.version = str(meta.version);

  const mMaintainers = asArray(meta.maintainers)
    .map((m) => (typeof m === "string" ? { name: m } : m))
    .filter((m) => m && str(m.name))
    .map((m) => (str(m.email) ? { name: str(m.name), email: str(m.email) } : { name: str(m.name) }));
  if (mMaintainers.length) application.maintainers = mMaintainers;

  const mCategories = asArray(s.categories).map(str).filter(Boolean);
  const mTags = asArray(s.tags).map(str).filter(Boolean);
  if (mCategories.length) application.categories = mCategories;
  if (mTags.length) application.tags = mTags;

  if (Object.keys(application).length) manifest.application = application;

  // cpu / memory belong to `runtime`, and a GPU requirement is simply the
  // "gpu" compute type — never a `gpu:` mapping of its own.
  const runtime = {};
  if (s.resources?.cpu != null) runtime.cpu = Number(s.resources.cpu);
  if (s.resources?.memory != null) runtime.memory = Number(s.resources.memory);
  runtime.computeTypes = s.runtime?.computeTypes?.length
    ? [...s.runtime.computeTypes]
    : [...DEFAULT_COMPUTE_TYPES];
  if (meta.timeoutSeconds != null && meta.timeoutSeconds !== "") {
    runtime.timeoutSeconds = Number(meta.timeoutSeconds);
  }
  manifest.runtime = runtime;

  const mParams = asArray(s.parameters).filter((p) => (p.name || "").trim());
  if (mParams.length) manifest.parameters = mParams.map(manifestParameter);

  const mInputs = asArray(s.inputs).filter((p) => (p.name || "").trim());
  const mOutputs = asArray(s.outputs).filter((p) => (p.name || "").trim());
  if (mInputs.length) manifest.inputs = mInputs.map(manifestPort);
  if (mOutputs.length) manifest.outputs = mOutputs.map(manifestPort);

  return manifest;
};

/* ──────────────────────────────────────────────────────────────────────────
 * YAML (de)serialization — manifest object  <->  app.yml text
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Serialize a manifest object to the YAML an author commits as `app.yml`. A
 * `$schema` carried by the manifest is emitted as a `yaml-language-server`
 * directive comment (the YAML convention for editor autocomplete/validation)
 * rather than a data key, so the body stays clean. buildManifest() does not set
 * one, so manifests written here carry no directive.
 *
 * @param {Object} manifest  manifest object (e.g. from buildManifest)
 * @returns {string} app.yml text
 */
export const manifestToYaml = (manifest) => {
  const { $schema, ...rest } = manifest || {};
  const body = dumpYaml(rest, { lineWidth: -1, noRefs: true });
  return $schema ? `# yaml-language-server: $schema=${$schema}\n${body}` : body;
};

/**
 * Convenience: build the manifest from an editable schema + meta and serialize
 * it to app.yml in one step.
 *
 * @param {ApplicationSchema} schema
 * @param {{name?: string, description?: string, applicationType?: string}} [meta]
 * @returns {string} app.yml text
 */
export const serializeManifestYaml = (schema, meta) =>
  manifestToYaml(buildManifest(schema, meta));

/* ──────────────────────────────────────────────────────────────────────────
 * Manifest shapes
 *
 * Two `app.yml` shapes exist in the wild and reading must tolerate both:
 *
 *   nested — canonical. What the backend serves in `assets["app.yml"]` and
 *            what buildManifest() emits: application metadata under
 *            `application:`, cpu/memory under `runtime:` next to
 *            `computeTypes` (GPU is one of those types), parameter defaults
 *            keyed `defaultValue`.
 *
 *   flat   — legacy. Metadata top-level, cpu/memory under `resources:`,
 *            defaults keyed `default`, GPU as a `runtime.gpu` mapping. Still
 *            read, never written.
 *
 * Settled with the backend team (ClickUp 868kf8e27) — the nested shape won.
 * ────────────────────────────────────────────────────────────────────────── */

export const MANIFEST_SHAPES = Object.freeze({
  NESTED: "nested",
  FLAT: "flat",
});

/**
 * A manifest is nested when it carries an `application` mapping; everything
 * else is treated as flat.
 * @returns {"nested"|"flat"}
 */
export const detectManifestShape = (manifest) =>
  manifest &&
  typeof manifest.application === "object" &&
  manifest.application !== null &&
  !Array.isArray(manifest.application)
    ? MANIFEST_SHAPES.NESTED
    : MANIFEST_SHAPES.FLAT;

/**
 * Maintainers are `[{name, email?}]` in the manifest, but tolerate bare
 * strings so a hand-written `maintainers: [alice]` still reads.
 * @returns {{name: string, email: string}[]}
 */
const parseMaintainers = (raw) =>
  asArray(raw)
    .map((m) =>
      typeof m === "string"
        ? { name: m.trim(), email: "" }
        : { name: (m?.name ?? "").trim(), email: (m?.email ?? "").trim() },
    )
    .filter((m) => m.name || m.email);

/**
 * Parse a committed `app.yml` manifest — either raw YAML text or an
 * already-parsed object — back into the top-level metadata and the editable
 * ApplicationSchema the form binds to. This is the consumption-side inverse of
 * buildManifest(): Pennsieve reads the file from the source repository and maps
 * it onto the application. Tolerant of partial/legacy manifests.
 *
 * The `yaml-language-server` directive comment is ignored by the YAML parser,
 * so manifests produced by serializeManifestYaml round-trip cleanly.
 *
 * @param {string|Object} source  raw app.yml text or a parsed manifest object
 * @returns {{ meta: {name: string, description: string, applicationType: string},
 *             schema: ApplicationSchema }}
 */
export const parseManifest = (source) => {
  const manifest =
    typeof source === "string" ? loadYaml(source) || {} : source || {};

  const nested = detectManifestShape(manifest) === MANIFEST_SHAPES.NESTED;
  // In the nested shape the application metadata lives under `application`
  // and cpu/memory sit on `runtime`; in the flat shape both are top-level.
  const app = nested ? manifest.application || {} : manifest;
  const runtime = manifest.runtime || {};
  const resources = nested ? runtime : manifest.resources || {};

  const rawType = nested ? app.type : app.applicationType;

  const meta = {
    name: typeof app.name === "string" ? app.name : "",
    description: typeof app.description === "string" ? app.description : "",
    applicationType: APPLICATION_TYPES.some((t) => t.value === rawType)
      ? rawType
      : "processor",
    // Present in the nested shape only; empty strings/arrays otherwise so
    // callers never have to branch on shape.
    id: typeof app.id === "string" ? app.id : "",
    version: app.version == null ? "" : String(app.version),
    maintainers: parseMaintainers(app.maintainers),
    schemaVersion:
      manifest.schemaVersion == null ? "" : String(manifest.schemaVersion),
    timeoutSeconds:
      typeof runtime.timeoutSeconds === "number" ? runtime.timeoutSeconds : null,
    shape: nested ? MANIFEST_SHAPES.NESTED : MANIFEST_SHAPES.FLAT,
  };

  const schema = createApplicationSchema({
    resources: {
      cpu: resources.cpu ?? null,
      memory: resources.memory ?? null,
    },
    runtime: { computeTypes: parseComputeTypes(runtime) },
    // Both manifest shapes go through parseParameter, which reads the
    // canonical `defaultValue`/`validValues` and the legacy `default`/
    // `allowedValues` alike.
    parameters: asArray(manifest.parameters).map(parseParameter),
    inputs: asArray(manifest.inputs).map(parsePort),
    outputs: asArray(manifest.outputs).map(parsePort),
    tags: asArray(nested ? app.tags : manifest.tags),
    categories: asArray(nested ? app.categories : manifest.categories),
  });

  return { meta, schema };
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
        // Any type may carry choices: the manifest declares a dropdown as
        // `type: string` (or number) plus `validValues`.
        validValues: asArray(p.validValues),
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

  // Choices are checked for every type, not just `enum`: a manifest can
  // declare `type: number` with `validValues`.
  const choices = asArray(param.validValues).map(String);
  if (choices.length && !choices.includes(String(value))) {
    return { valid: false, error: "Not a valid value" };
  }

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
    if (p.type === PARAM_TYPES.ENUM && !asArray(p.validValues).length) {
      errors.push(`${where} is a choice but has no valid values`);
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

  // The backend's manifest describes ports by media type rather than by
  // `dataType`. When both sides declare media types, compare those — otherwise
  // every nested-manifest port would read as `any` and match everything.
  const outMedia = asArray(output.mediaTypes);
  const inMedia = asArray(input.mediaTypes);
  if (outMedia.length && inMedia.length) {
    const wildcard = (t) => t === "*/*" || t === "application/octet-stream";
    if (outMedia.some(wildcard) || inMedia.some(wildcard)) return true;
    return outMedia.some((o) => inMedia.includes(o));
  }

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
