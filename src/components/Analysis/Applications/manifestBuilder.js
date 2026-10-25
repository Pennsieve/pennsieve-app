// The app manifest builder's own rules, pure so they're easy to test: what
// kind of app it is (batch or interactive) and what that writes,
// the builder's sections and which of them a problem belongs to, the field a
// problem points at, the EDAM formats the picker offers, and the Gallery card
// an app.yml gives.
import { load as loadYaml } from "js-yaml";
import { createPort, normalizeEdamFormat, normalizeOrcid, parseManifest, PARAM_TYPES, validateParameterValue, isEarlierLayout, isNumericType } from "./applicationSchema";

/* ─────────────── Kind: batch or interactive ─────────────── */

export const APP_KINDS = Object.freeze([
  { value: "batch", label: "Batch", hint: "Runs on its inputs and exits, as a workflow step." },
  { value: "interactive", label: "Interactive", hint: "A live session people work in; the workflow waits until it ends." },
]);

// The interactive session types the platform runs today (runtime.sessionType).
export const SESSION_KINDS = Object.freeze([{ value: "jupyter", label: "Jupyter" }]);

// An app is interactive when its app.yml says it's a live session.
export const appKind = (schema) => (schema?.runtime?.interactive ? "interactive" : "batch");

// What an interactive app takes and gives when nothing more is said: any
// files, as the Pennsieve session apps declare them.
export const interactivePorts = () => ({
  inputs: [createPort({ name: "files", description: "Files to open in the session, staged under input/" })],
  outputs: [createPort({ name: "files", description: "What the session writes under output/" })],
});

/**
 * Switch the app's kind, in place. Nothing entered is dropped: a batch app's
 * parameters stay in the form (hidden, and not written) while it's
 * interactive, so switching back finds them. An interactive app with no inputs
 * or outputs yet gets the "any files" ones; a Jupyter session, a language.
 */
export function setAppKind(schema, kind) {
  const rt = schema.runtime;
  if (kind === "interactive") {
    rt.interactive = true;
    rt.sessionType = rt.sessionType || SESSION_KINDS[0].value;
    if (rt.sessionType === "jupyter") rt.kernel = rt.kernel || "python";
    if (!schema.inputs.length && !schema.outputs.length) Object.assign(schema, interactivePorts());
  } else {
    rt.interactive = false;
    rt.sessionType = "";
    rt.kernel = "";
  }
}

// The schema the manifest is written from: an interactive app's has no
// parameters (they're the batch app's, kept in the form only).
export const manifestSchemaFor = (schema) =>
  appKind(schema) === "interactive" ? { ...schema, parameters: [] } : schema;

/* ─────────────── Sections and the fields problems point at ─────────────── */

export const SECTIONS = Object.freeze([
  { key: "about", label: "About" },
  { key: "does", label: "What it does" },
  { key: "runs", label: "How it runs" },
  { key: "people", label: "People" },
]);

// The kind chooser owns these: they're what "Interactive" writes.
const KIND_FIELDS = new Set(["runtime", "runtime.interactive", "runtime.sessionType", "runtime.kernel"]);

// The section a problem's path ("inputs.0.formats.1") belongs to.
export function sectionOfPath(path) {
  const p = String(path || "");
  // What kind of app it is heads the form, in About.
  if (KIND_FIELDS.has(p)) return "about";
  if (/^application\.maintainers/.test(p)) return "people";
  if (/^(inputs|outputs|parameters)(\.|$)/.test(p)) return "does";
  if (/^(runtime|schemaVersion)(\.|$)/.test(p)) return "runs";
  return "about";
}


/**
 * The field a problem's path points at, as the form marks its fields
 * (data-field): a list item's own index stays ("parameters.0.name",
 * "application.maintainers.1"), an index into a value's list doesn't
 * ("inputs.0.formats.1" -> "inputs.0.formats"). Null for problems with no
 * field ("Line 3", "Root").
 */
export function fieldKeyOfPath(path) {
  let p = String(path || "");
  if (!p || p === "Root" || /^Line \d+$/.test(p)) return null;
  if (p === "application") return "application.name";
  if (KIND_FIELDS.has(p)) return "kind";
  // A maintainer's fields are one row.
  const maintainer = p.match(/^application\.maintainers\.\d+/);
  if (maintainer) return maintainer[0];
  // Drop indexes into a value's list, keeping a list item's own.
  const parts = p.split(".");
  while (parts.length > 2 && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(".");
}

/**
 * The builder's own checks, as { path, message } like the schema's: the name
 * the app needs, and a batch step's parameters (unique, single-token names,
 * choices with values, min below max, defaults that fit).
 */
export function builderChecks(meta, schema) {
  const out = [];
  if (!String(meta?.name || "").trim()) out.push({ path: "application.name", message: "is required" });
  if (appKind(schema) === "interactive") return out;
  const seen = new Set();
  (schema?.parameters || []).forEach((p, i) => {
    const at = `parameters.${i}`;
    const name = String(p.name || "").trim();
    if (!name) out.push({ path: `${at}.name`, message: "is missing a name" });
    else if (/\s/.test(name)) out.push({ path: `${at}.name`, message: "can't contain spaces" });
    else if (seen.has(name)) out.push({ path: `${at}.name`, message: `"${name}" is used twice` });
    else seen.add(name);
    if (p.type === PARAM_TYPES.ENUM && !(p.validValues || []).length) {
      out.push({ path: `${at}.validValues`, message: "is a choice but has no values" });
    }
    if (isNumericType(p.type) && p.min != null && p.max != null && p.min !== "" && p.max !== "" && Number(p.min) > Number(p.max)) {
      out.push({ path: `${at}.max`, message: "is below min" });
    }
    if (p.defaultValue != null && p.defaultValue !== "") {
      const res = validateParameterValue(p, p.defaultValue);
      if (!res.valid) out.push({ path: `${at}.defaultValue`, message: res.error });
    }
  });
  return out;
}

// Each section's problems: { about: [...], does: [...], runs: [...], people: [...] }.
export function problemsBySection(problems) {
  const by = Object.fromEntries(SECTIONS.map((s) => [s.key, []]));
  for (const p of problems || []) by[sectionOfPath(p.path)].push(p);
  return by;
}

// Problems by the field they point at: { "parameters.0.name": ["is missing a name"], … }.
export function problemsByField(problems) {
  const by = {};
  for (const p of problems || []) {
    const key = fieldKeyOfPath(p.path);
    if (key) (by[key] ||= []).push(p.message);
  }
  return by;
}

/* ─────────────── EDAM formats the picker offers ─────────────── */

/**
 * Common research formats, by their EDAM format id. Each id was checked
 * against the EDAM ontology (EDAM_dev.owl, 1.26 dev, github.com/edamontology/
 * edamontology) and none is deprecated. EDF, BDF, NWB and MEF3 have no EDAM
 * format yet: describe those by media type. Any other format_NNNN can be typed.
 */
export const EDAM_FORMATS = Object.freeze([
  { id: "format_3752", label: "CSV" },
  { id: "format_3475", label: "TSV" },
  { id: "format_3464", label: "JSON" },
  { id: "format_3750", label: "YAML" },
  { id: "format_3590", label: "HDF5" },
  { id: "format_3626", label: "MAT (MATLAB)" },
  { id: "format_3650", label: "NetCDF" },
  { id: "format_3915", label: "Zarr" },
  { id: "format_4003", label: "NumPy" },
  { id: "format_4002", label: "pickle" },
  { id: "format_3549", label: "NIfTI-1 (nii)" },
  { id: "format_3548", label: "DICOM" },
  { id: "format_3591", label: "TIFF" },
  { id: "format_3727", label: "OME-TIFF" },
  { id: "format_3603", label: "PNG" },
  { id: "format_3604", label: "SVG" },
  { id: "format_3997", label: "MPEG-4" },
  { id: "format_1930", label: "FASTQ" },
  { id: "format_1929", label: "FASTA" },
  { id: "format_2572", label: "BAM" },
  { id: "format_2573", label: "SAM" },
  { id: "format_3462", label: "CRAM" },
  { id: "format_3016", label: "VCF" },
  { id: "format_3003", label: "BED" },
  { id: "format_1975", label: "GFF3" },
  { id: "format_2306", label: "GTF" },
  { id: "format_3913", label: "Loom" },
  { id: "format_3244", label: "mzML" },
  { id: "format_3620", label: "XLSX" },
  { id: "format_3508", label: "PDF" },
  { id: "format_2331", label: "HTML" },
  { id: "format_3987", label: "ZIP" },
  { id: "format_3981", label: "TAR" },
]);

// "HDF5 (format_3590)", or the id alone for one not in the list.
export function edamLabel(id) {
  const f = EDAM_FORMATS.find((x) => x.id === id);
  return f ? `${f.label} (${f.id})` : id;
}

// The picker's options: the list, plus any id the port already has.
export function edamOptions(selected = []) {
  const known = new Set(EDAM_FORMATS.map((f) => f.id));
  return [
    ...EDAM_FORMATS.map((f) => ({ value: f.id, label: edamLabel(f.id) })),
    ...selected.filter((id) => id && !known.has(id)).map((id) => ({ value: id, label: id })),
  ];
}

// What the picker keeps of a typed or chosen value: an EDAM id, from its
// http://edamontology.org/ form too, or a label from the list ("hdf5").
export function normalizeFormatPick(value) {
  const v = normalizeEdamFormat(value);
  if (/^format_\d{4}$/.test(v)) return v;
  const byLabel = EDAM_FORMATS.find((f) => f.label.toLowerCase() === v.toLowerCase());
  return byLabel ? byLabel.id : v;
}

/* ─────────────── The Gallery card an app.yml gives ─────────────── */

/**
 * An app record as the Gallery reads it, from a manifest the builder wrote:
 * one version whose stored manifest is the app.yml's (tags, runtime and
 * ports at the top, as app-deploy-service keeps them).
 */
export function previewApp(manifest) {
  const a = manifest?.application || {};
  return {
    name: a.name || "",
    description: "",
    versions: [
      {
        version: "",
        createdAt: new Date(0).toISOString(),
        manifest: {
          name: a.name || "",
          description: a.description || "",
          tags: a.tags || [],
          runtime: manifest?.runtime || {},
          inputs: manifest?.inputs || [],
          outputs: manifest?.outputs || [],
        },
      },
    ],
  };
}

/* ─────────────── Opened for an app: its app.yml, or a start from what we know ─────────────── */

// owner/repo from an app's GitHub source URL, or null.
export function repoOf(sourceUrl) {
  const m = String(sourceUrl || "").match(/github\.com\/([^/]+)\/([^/\s?#]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, ""), fullName: `${m[1]}/${m[2].replace(/\.git$/, "")}` } : null;
}

// The app.yml text among an app's repository files (the detail's assets).
const manifestAsset = (assets) => {
  const key = Object.keys(assets || {}).find((k) => /^app\.ya?ml$/i.test(k));
  return key ? String(assets[key] || "") : "";
};

// The signed-in user as a maintainer: name, email, and ORCID iD if linked.
export function maintainerFromProfile(profile) {
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  if (!name) return null;
  const orcid = normalizeOrcid(profile?.orcid?.orcid || "");
  return { name, email: profile?.email || "", orcid };
}

/*
  What the builder starts from when it's opened for an app (?app=<uuid>): its
  repository's app.yml if it has one that reads; else a new manifest from what
  Pennsieve knows of it: the repository's name and description, its current
  parameters, and the signed-in user as maintainer. Pennsieve keeps no compute
  settings or tags for an app without an app.yml, so those start at the
  builder's defaults. { meta, schema, fromManifest }.
*/
export function prefillFromApp(app, profile = {}, { repoDescription = "" } = {}) {
  const raw = manifestAsset(app?.assets);
  // An app.yml in the earlier flat layout isn't read (nor by the platform):
  // start from what Pennsieve knows, and say the file was in that layout.
  let earlierLayout = false;
  if (raw.trim()) {
    try {
      const doc = loadYaml(raw);
      if (doc && typeof doc === "object" && !Array.isArray(doc)) {
        if (isEarlierLayout(doc)) earlierLayout = true;
        else return { ...parseManifest(doc), fromManifest: true, earlierLayout };
      }
    } catch {
      // A broken app.yml: start from what Pennsieve knows instead.
    }
  }
  const maintainer = maintainerFromProfile(profile);
  const doc = {
    application: {
      name: app?.name || repoOf(app?.sourceUrl)?.repo || "",
      description: repoDescription || app?.description || "",
      maintainers: maintainer ? [maintainer] : [],
    },
    parameters: (Array.isArray(app?.params) ? app.params : [])
      .filter((p) => p?.name)
      .map((p) => ({
        name: p.name,
        type: p.type || PARAM_TYPES.STRING,
        ...(p.description && { description: p.description }),
        ...(p.required && { required: true }),
        ...(p.defaultValue != null && p.defaultValue !== "" && { defaultValue: p.defaultValue }),
        ...(Array.isArray(p.validValues) && p.validValues.length && { validValues: p.validValues }),
      })),
  };
  return { ...parseManifest(doc), fromManifest: false, earlierLayout };
}

