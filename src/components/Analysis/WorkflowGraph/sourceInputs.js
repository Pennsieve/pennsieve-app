// What a workflow's data source is for: the app inputs it feeds, from the
// steps' links (inputs: [{ from, output, input }], ports). A source linked
// to an input is that input's data, so it's named after it everywhere it's
// shown (the canvas, the run dialogs, a run's page), and the file picker
// says what the input takes. A source no link names keeps its plain name.
//
// Pure: on DAG steps ({ id, inputs }) and app.yml ports.

import { shortMediaType, versionManifest } from "../WorkflowBuilder/appManifestInfo";
import { mediaTypeAccepts, normalizeMediaType } from "../Applications/applicationSchema";

// The inputs a source feeds: { step, input } per link from it.
export function inputsFedBy(sourceId, steps) {
  return (steps || []).flatMap((s) =>
    (Array.isArray(s?.inputs) ? s.inputs : [])
      .filter((l) => l?.from === sourceId && l.input)
      .map((l) => ({ step: s.id, input: l.input }))
  );
}

// A source's name: the inputs it feeds ("signals", "signals, events"), each
// once, else the fallback.
export function sourceLabel(sourceId, steps, fallback = "Input data") {
  const names = [...new Set(inputsFedBy(sourceId, steps).map((f) => f.input))];
  return names.length ? names.join(", ") : fallback;
}

// What the inputs a source feeds take, for its file picker: per input, its
// short media types and layout ("CSV", "BIDS"), from portsOf(stepId), the
// step's app.yml ports. Inputs whose app has no app.yml are left out.
export function sourceHints(sourceId, steps, portsOf) {
  return inputsFedBy(sourceId, steps)
    .map(({ step, input }) => {
      const port = (portsOf(step)?.inputs || []).find((p) => p?.name === input);
      if (!port) return null;
      const layout = [].concat(port.conformsTo || []).filter(Boolean);
      return {
        step,
        input,
        types: [...new Set([...(port.mediaTypes || []).map(shortMediaType), ...(port.formats || []).map((f) => EDAM_TYPES[f]).filter(Boolean)])],
        mediaTypes: (port.mediaTypes || []).map(normalizeMediaType).filter(Boolean),
        layout: layout.length ? String(layout[layout.length - 1]).split("@")[0].toUpperCase() : "",
        description: port.description || "",
      };
    })
    .filter(Boolean);
}

// One line for a picker: "signals takes CSV files", "study takes a BIDS
// folder", "a takes CSV; b takes JSON".
export function hintLine(hints) {
  const lines = (hints || []).map((h) => {
    if (h.layout) return `${h.input} takes a ${h.layout} folder`;
    if (h.types.length) return `${h.input} takes ${h.types.join(", ")} files`;
    return "";
  });
  return [...new Set(lines.filter(Boolean))].join("; ");
}

// The ports of a run's or workflow's step, from the app list: its app's
// app.yml at the step's version. For sourceHints on the run pages.
export function portsOfStep(dag, applications) {
  const norm = (u) => String(u || "").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
  return (stepId) => {
    const step = (dag || []).find((n) => n.id === stepId);
    const app = step?.sourceUrl && (applications || []).find((a) => norm(a.sourceUrl) === norm(step.sourceUrl));
    // The step's variant's (app variants), else the version's.
    return app ? versionManifest(app, step.tag, step.variant) : null;
  };
}

const listed = (names) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

// What to say when sources have no files yet: their inputs by name ("Select
// files for signals and events"), or how many.
export function missingFilesMessage(missingIds, dag) {
  const names = (missingIds || []).map((id) => sourceLabel(id, dag, ""));
  if (names.length && names.every(Boolean)) return `Select files for ${listed([...new Set(names)])}`;
  const n = (missingIds || []).length;
  return `Select files for ${n === 1 ? "data source" : `${n} data sources`}`;
}

// EDAM formats (app.yml formats) by the names files' extensions give them,
// for the scientific formats without a media type; others can't be checked.
const EDAM_TYPES = {
  format_1930: "FASTQ",
  format_1929: "FASTA",
  format_2572: "BAM",
  format_2573: "SAM",
  format_3016: "VCF",
};
// Extensions of those formats, compressed or not (reads.fastq.gz is FASTQ).
const FORMAT_EXTENSIONS = { fastq: "FASTQ", fq: "FASTQ", fasta: "FASTA", fa: "FASTA", fna: "FASTA", bam: "BAM", sam: "SAM", vcf: "VCF" };

// A file's type as the input hints name types ("CSV", "JSON", "NIFTI"), from
// its extension; a few extensions differ from their media type's name.
const EXTENSION_TYPES = {
  gz: "GZIP",
  xlsx: "SHEET",
  nii: "NIFTI",
  "nii.gz": "NIFTI",
  "ome.tif": "OME-TIFF",
  "ome.tiff": "OME-TIFF",
  tif: "TIFF",
  jpg: "JPEG",
  yml: "YAML",
  h5: "HDF5",
  hdf: "HDF5",
  txt: "PLAIN",
  tsv: "TAB-SEPARATED-VALUES",
  htm: "HTML",
};
export function fileShortType(name) {
  const lower = String(name || "").toLowerCase();
  const parts = lower.split(".");
  if (parts.length < 2) return "";
  const two = parts.slice(-2).join(".");
  if (EXTENSION_TYPES[two]) return EXTENSION_TYPES[two];
  const ext = parts[parts.length - 1];
  return EXTENSION_TYPES[ext] || ext.toUpperCase();
}

// Every type a file may be taken as: its own (fileShortType), and for a
// compressed file the format inside ("reads.fastq.gz": GZIP and FASTQ).
export function fileShortTypes(name) {
  const parts = String(name || "").toLowerCase().split(".");
  const types = new Set([fileShortType(name)]);
  if (parts.length > 2 && parts[parts.length - 1] === "gz") parts.pop();
  if (parts.length >= 2 && FORMAT_EXTENSIONS[parts[parts.length - 1]]) types.add(FORMAT_EXTENSIONS[parts[parts.length - 1]]);
  return [...types].filter(Boolean);
}

// A file's media types from the platform's formats (GET /packages/formats,
// the store's packageFormats: { value, extensions }), by its longest
// matching extension, as an upload types it: "a.nwb" is
// "application/x-hdf5; profile=nwb", "a.ome.tif" "image/tiff; profile=ome-tiff".
export function fileMediaTypes(name, formats) {
  const lower = String(name || "").toLowerCase();
  let best = 0;
  let types = [];
  for (const f of formats || []) {
    for (const e of f?.extensions || []) {
      const ext = String(e).toLowerCase();
      if (!ext || !lower.endsWith(ext) || ext.length < best) continue;
      if (ext.length > best) (best = ext.length), (types = []);
      types.push(normalizeMediaType(f.value));
    }
  }
  return [...new Set(types.filter(Boolean))];
}

// The chosen files a source's inputs don't take, by what they take (its
// hints): { names, expected: "JSON" }, or null when they all fit, when an
// input takes any file or a folder layout, or when its app declares no types
// (nothing to compare). With the platform's formats, a file also fits by
// media type: an NWB file fits an HDF5 input, an .h5 file not an NWB one.
export function fileTypeMismatches(fileNames, hints, formats = []) {
  const accepted = acceptedFileTypes(hints);
  if (!accepted) return null;
  const media = (hints || []).flatMap((h) => h.mediaTypes || []);
  const fits = (n) =>
    fileShortTypes(n).some((t) => accepted.has(t)) ||
    fileMediaTypes(n, formats).some((t) => media.some((a) => mediaTypeAccepts(a, t)));
  const names = (fileNames || []).filter((n) => !fits(n));
  return names.length ? { names, expected: [...accepted].join(" or ") } : null;
}

// The file types a source's inputs take (a Set of short types), or null when
// any file will do: an input takes any file or a folder layout, or its app
// declares no types.
export function acceptedFileTypes(hints) {
  const accepted = new Set();
  for (const h of hints || []) {
    if (h.layout || !h.types.length) return null;
    for (const t of h.types) {
      if (t === "Any" || t === "File") return null;
      accepted.add(t);
    }
  }
  return accepted.size ? accepted : null;
}

// The hints for one link: what the input a source feeds through it takes
// (step, and input when the link names one; else all that step's inputs it
// feeds).
export const linkHints = (hints, step, input = "") =>
  (hints || []).filter((h) => h.step === step && (!input || h.input === input));
