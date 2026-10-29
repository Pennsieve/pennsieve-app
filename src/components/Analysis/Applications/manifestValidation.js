// Checking an app.yml against its JSON Schema: the bundled copy of
// https://schemas.pennsieve.io/app-manifest/v1.json, the one app-deploy-service
// validates releases against. The Ajv setup and the dotted field paths
// ("inputs.0.formats") are the metadata records' (utils/jsonSchemaValidation);
// the messages are app.yml's, in plain words.
import { load as loadYaml, YAMLException } from "js-yaml";

import { createSchemaValidator, errorFieldPath } from "@/utils/jsonSchemaValidation";
import manifestSchema from "./app-manifest.v1.schema.json";

let validate = null;
// Compiled on first use, then reused.
const validator = () => (validate ||= createSchemaValidator().compile(manifestSchema));

// Hints for the patterns and formats app.yml uses, by the field they're on.
const PATTERN_HINTS = [
  [/(^|\.)orcid$/, "must be an ORCID iD, like 0000-0002-1825-0097"],
  [/\.formats\.\d+$/, "must be an EDAM format id, like format_3590"],
  [/\.mediaTypes\.\d+$/, "must be a media type, like text/csv"],
  [/(^|\.)email$/, "must be an email address"],
  // With two or more outputs, each is written to OUTPUT_DIR/<name>/.
  [/^outputs\.\d+\.name$/, "is a folder name with two or more outputs: lowercase letters, numbers and dashes"],
];
const patternHint = (path) =>
  (PATTERN_HINTS.find(([re]) => re.test(path)) || [null, "isn't in the expected form"])[1];

// The runtime's if/then rules (runtime allOf 0..2), as their own sentences.
const RUNTIME_RULES = [
  "sessionType only applies to a live session: set interactive: true",
  "a Jupyter session needs a kernel: python or r",
  "kernel only applies to a Jupyter session: set sessionType: jupyter",
];

// An input or output's if/then rules ($defs/port allOf 0..1), as their own
// sentences, each on the field it's about.
const PORT_RULES = [
  { field: "name", message: "as a folder name (its own folder), can only have lowercase letters, numbers and dashes" },
  { field: "mediaTypes", message: "needs a folder format: pick one, e.g. OME-Zarr or MEF3" },
];

const TYPE_NAMES = { object: "a mapping", array: "a list" };

function problemFor(error) {
  const { keyword, params = {}, schemaPath = "" } = error;
  const rule = schemaPath.match(/\/runtime\/allOf\/(\d)\/then\//);
  if (rule) return { path: "runtime", message: RUNTIME_RULES[Number(rule[1])] };

  const path = errorFieldPath(error);
  // Ajv reports a $ref'd definition's own path: #/allOf/<n>/then/… for a port.
  const portRule = /^(inputs|outputs)\.\d+/.test(path) && schemaPath.match(/^#\/allOf\/(\d)\/then\//);
  if (portRule && PORT_RULES[Number(portRule[1])]) {
    const { field, message } = PORT_RULES[Number(portRule[1])];
    const port = path.replace(/\.(name|mediaTypes)$/, "");
    return { path: `${port}.${field}`, message };
  }
  switch (keyword) {
    case "if":
      return null; // the then-branch error says why
    case "additionalProperties":
      return {
        path: path === "Root" ? params.additionalProperty : `${path}.${params.additionalProperty}`,
        message: `isn't a field app.yml knows: ${params.additionalProperty}`,
      };
    case "required":
      return { path, message: `is missing ${params.missingProperty}` };
    case "enum":
      return { path, message: `must be one of ${(params.allowedValues || []).join(", ")}` };
    case "const":
      return { path, message: `must be ${JSON.stringify(params.allowedValue)}` };
    case "pattern":
    case "format":
      return { path, message: patternHint(path) };
    case "type":
      return { path, message: `must be ${TYPE_NAMES[params.type] || `a ${params.type}`}` };
    default:
      return { path, message: error.message || "isn't valid" };
  }
}

function toProblems(errors) {
  const seen = new Set();
  const out = [];
  for (const e of errors || []) {
    const p = problemFor(e);
    if (!p) continue;
    const key = `${p.path}\u0000${p.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** An app.yml document (already parsed) against the schema: { valid, problems: [{ path, message }] }. */
export function validateManifestDoc(doc) {
  const check = validator();
  const valid = check(doc);
  return { valid: !!valid, problems: valid ? [] : toProblems(check.errors) };
}

/** app.yml text: YAML syntax first, then the schema. A valid one comes back with its document. */
export function validateManifestText(text) {
  if (!text || !text.trim()) {
    return { valid: false, problems: [{ path: "Root", message: "the file is empty" }] };
  }
  let doc;
  try {
    doc = loadYaml(text);
  } catch (e) {
    const line = e instanceof YAMLException && e.mark ? e.mark.line + 1 : null;
    return {
      valid: false,
      problems: [{ path: line ? `Line ${line}` : "Root", message: `isn't valid YAML: ${(e && e.reason) || "syntax error"}` }],
    };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { valid: false, problems: [{ path: "Root", message: "must be a mapping of fields (application:, runtime:, …)" }] };
  }
  return { ...validateManifestDoc(doc), doc };
}

/** A problem as one line: "path: message". */
export const problemText = (p) => `${p.path}: ${p.message}`;

/**
 * The schema problems in a manifest the builder wrote, minus what the builder's
 * own checks already say: a missing name (nameMissing) and parameter problems
 * (paramErrors).
 */
export function builderProblems(manifest, { nameMissing = false, paramErrors = false } = {}) {
  return validateManifestDoc(manifest).problems.filter(
    (p) =>
      !(nameMissing && (p.path === "application.name" || (p.path === "application" && /missing name$/.test(p.message)))) &&
      !(paramErrors && p.path.startsWith("parameters"))
  );
}
