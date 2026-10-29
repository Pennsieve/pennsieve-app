// What an app is for, from the tags its app.yml declares: a short list of
// domains, each with a hue and an icon, that the Apps tab's banners are
// coloured by. Tags are free text, so each domain lists the spellings people
// use ("EEG", "iEEG", "electrophysiology"); a tag matches regardless of case
// and punctuation. An app whose tags match none is grey: a colour always
// means a domain. The same tags also name research fields (FIELDS, below),
// which filter but never colour.
import { versionManifest, shortMediaType, sessionTypeOf } from "../WorkflowBuilder/appManifestInfo";

// A domain is a subject (what the app is about: EEG, imaging, genomics…) or
// a task (what it does with it: visualization, conversion, statistics…).
// The icon is an SVG path on a 24×24 grid, drawn as a stroke.
export const DOMAINS = [
  {
    key: "ephys",
    subject: true,
    label: "Electrophysiology",
    tag: "electrophysiology",
    hue: 245,
    aliases: ["eeg", "ieeg", "seeg", "ecog", "ephys", "lfp", "emg", "ecg", "ekg", "meg", "neurophysiology", "edf", "signal-processing", "time-series", "timeseries"],
    icon: "M2 12h4l2-6 4 12 3-9 2 3h5",
  },
  {
    key: "spikes",
    subject: true,
    label: "Spike sorting",
    tag: "spike-sorting",
    hue: 340,
    aliases: ["spikes", "spike", "spike-detection", "single-unit", "kilosort"],
    icon: "M3 18h18M6 18V8M10 18v-6M14 18V4M18 18v-8",
  },
  {
    key: "imaging",
    subject: true,
    label: "Imaging",
    tag: "imaging",
    hue: 185,
    aliases: ["image", "images", "neuroimaging", "microscopy", "mri", "fmri", "ct", "pet", "dicom", "nifti", "histology", "segmentation", "registration", "calcium-imaging", "image-processing"],
    icon: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01",
  },
  {
    key: "genomics",
    subject: true,
    label: "Genomics",
    tag: "genomics",
    hue: 135,
    aliases: ["sequencing", "rna-seq", "rnaseq", "scrna-seq", "dna", "rna", "omics", "transcriptomics", "proteomics", "genetics", "bioinformatics", "single-cell", "scrna", "seurat"],
    icon: "M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12M9 7h6M9 17h6",
  },
  {
    // Cells counted one by one as they flow past (or fly, in mass
    // cytometry): a subject of its own, not imaging, though both see cells.
    key: "cytometry",
    subject: true,
    label: "Cytometry",
    tag: "cytometry",
    // Magenta: the widest gap between the subjects' strong hues (indigo
    // 245, crimson 340); the tasks near it (280, 315) are muted.
    hue: 300,
    aliases: ["flow-cytometry", "flow", "spectral-flow", "spectral-cytometry", "mass-cytometry", "cytof", "fcs", "immunophenotyping"],
    // Three cells, each with a nucleus.
    icon: "M4 9a4 4 0 1 0 8 0a4 4 0 1 0-8 0M8 9h.01M13 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0M16 16h.01M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 5h.01",
  },
  {
    key: "ml",
    label: "Machine learning",
    tag: "machine-learning",
    hue: 280,
    aliases: ["ml", "ai", "deep-learning", "neural-network", "llm", "classification", "prediction", "inference"],
    // A small network in layers (3, 2, 1), left to right: not an X, which
    // in a round badge reads as a close button.
    icon: "M4 6h.01M4 12h.01M4 18h.01M12 9h.01M12 15h.01M20 12h.01M4 6l8 3M4 12l8-3M4 12l8 3M4 18l8-3M12 9l8 3M12 15l8-3",
  },
  {
    key: "stats",
    label: "Statistics",
    tag: "statistics",
    hue: 20,
    aliases: ["stats", "analytics", "regression", "quantification"],
    icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
  {
    key: "viz",
    label: "Visualization",
    tag: "visualization",
    hue: 45,
    aliases: ["viz", "visualisation", "plotting", "plots", "figures", "dashboard"],
    icon: "M3 3v18h18M7 15l4-5 3 3 5-7",
  },
  {
    key: "convert",
    label: "Conversion",
    tag: "conversion",
    hue: 210,
    aliases: ["convert", "converter", "format-conversion", "etl", "ingest", "ingestion", "bids"],
    icon: "M4 8h14l-4-4M20 16H6l4 4",
  },
  {
    key: "qc",
    label: "Quality control",
    tag: "quality-control",
    hue: 85,
    aliases: ["qc", "qa", "validation", "validate", "curation", "cleaning"],
    icon: "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  },
  {
    key: "preprocessing",
    label: "Preprocessing",
    tag: "preprocessing",
    hue: 165,
    aliases: ["preprocess", "pre-processing", "filtering", "filter", "denoising", "artifact-removal", "normalization", "resampling", "re-referencing"],
    icon: "M3 5h18l-7 8v6l-4 2v-8z",
  },
  {
    key: "report",
    label: "Report",
    tag: "report",
    hue: 315,
    aliases: ["reports", "reporting", "summary", "summarize", "pdf-report"],
    icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  },
  {
    key: "notebook",
    label: "Notebook",
    tag: "notebook",
    hue: 225,
    aliases: ["notebooks", "interactive", "jupyter", "rstudio", "human-in-the-loop"],
    icon: "M4 4h16v16H4zM8 10l3 2-3 2M13 15h4",
  },
];

// "Spike Sorting", "spike_sorting", "spikesorting" -> "spikesorting".
const normalize = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const BY_TAG = new Map();
for (const d of DOMAINS) for (const t of [d.tag, d.key, d.label, ...d.aliases]) BY_TAG.set(normalize(t), d);

export const domainOfTag = (tag) => BY_TAG.get(normalize(tag)) || null;

// The app's domain: the first subject its tags name, since what an app is
// about says more than what it does ("visualization, single-cell" is
// Genomics); else the first task; else Notebook for an app
// whose app.yml says it's a live Jupyter session.
export function domainOf(manifest) {
  const named = (manifest?.tags || []).map(domainOfTag).filter(Boolean);
  const d = named.find((x) => x.subject) || named[0];
  if (d) return d;
  const runtime = manifest?.runtime;
  if (runtime?.interactive && (runtime.sessionType || "jupyter") === "jupyter") return DOMAINS.find((d) => d.key === "notebook");
  return null;
}

// The research field an app serves (neuroscience, immunology…): a second
// axis, read from the same tags. Where the domain says what data an app
// handles, the field says whose research it's for, so an MRI app is Imaging
// and Neuroscience. An app can have several fields, and they never colour
// anything: a colour always means a domain. Some tags count for both axes
// ("neuroimaging", "immunophenotyping"); each axis matches on its own.
export const FIELDS = [
  {
    key: "neuroscience",
    label: "Neuroscience",
    tag: "neuroscience",
    aliases: ["neuro", "neuroimaging", "neurology", "brain", "epilepsy", "neurophysiology", "cognitive-neuroscience"],
  },
  {
    key: "immunology",
    label: "Immunology",
    tag: "immunology",
    aliases: ["immune", "immune-health", "immunophenotyping", "immune-profiling", "immuno-oncology"],
  },
  {
    key: "oncology",
    label: "Oncology",
    tag: "oncology",
    aliases: ["cancer", "tumor", "tumour"],
  },
  {
    key: "cardiology",
    label: "Cardiology",
    tag: "cardiology",
    aliases: ["cardiac", "cardiovascular", "heart"],
  },
  {
    key: "clinical",
    label: "Clinical research",
    tag: "clinical-research",
    aliases: ["clinical", "clinical-trial", "clinical-trials"],
  },
];

const FIELD_BY_TAG = new Map();
for (const f of FIELDS) for (const t of [f.tag, f.key, f.label, ...f.aliases]) FIELD_BY_TAG.set(normalize(t), f);

export const fieldOfTag = (tag) => FIELD_BY_TAG.get(normalize(tag)) || null;

// An app's fields, in the order its tags first name them.
export function fieldsOf(manifest) {
  return [...new Set((manifest?.tags || []).map(fieldOfTag).filter(Boolean))];
}

// The tags the app.yml builder suggests: each domain's own, then the
// spellings people use, so a typed "EEG" lands on a known "eeg"; then the
// fields', so "Neuroscience" lands on "neuroscience".
export const SUGGESTED_TAGS = [
  ...new Set([...DOMAINS, ...FIELDS].flatMap((d) => [d.tag, ...d.aliases])),
];

// The builder's tag options: each domain's preferred tag (subjects first, then
// tasks, in DOMAINS order) and the aliases that colour a card the same way.
// Each field's tag, as a group of its own: a field doesn't colour the card,
// so it isn't Preferred. Its aliases aren't listed (several are a domain's
// too); typing one finds the field's tag.
export function preferredTagGroups() {
  const ordered = [...DOMAINS.filter((d) => d.subject), ...DOMAINS.filter((d) => !d.subject)];
  return {
    preferred: ordered.map((domain) => ({ tag: domain.tag, domain })),
    aliases: ordered.flatMap((domain) => domain.aliases.filter((a) => a !== domain.tag).map((tag) => ({ tag, domain }))),
    fields: FIELDS.map((field) => ({ tag: field.tag, field })),
  };
}

// Whether a tag option matches what's typed: the tag, its domain's (or
// field's) label and, for a preferred tag, the aliases ("spike" finds
// spike-sorting).
export function tagOptionMatches(option, query, { preferred = false } = {}) {
  const q = normalize(query);
  if (!q) return true;
  const named = option.domain || option.field;
  const words = [option.tag, named?.label, ...(preferred ? named?.aliases || [] : [])];
  return words.filter(Boolean).some((w) => normalize(w).includes(q));
}

// The preferred tag to suggest: an alias names a domain whose preferred tag
// the app doesn't have yet ("eeg" -> electrophysiology); else a field's
// ("epilepsy" -> neuroscience), so apps of a field share one tag. Free-typed
// tags with neither suggest nothing.
export function tagDomainNudge(tags = []) {
  const have = new Set(tags.map(normalize));
  for (const t of tags) {
    const domain = domainOfTag(t);
    if (domain && !have.has(normalize(domain.tag))) return { tag: domain.tag, domain, label: domain.label };
  }
  for (const t of tags) {
    const field = fieldOfTag(t);
    if (field && !have.has(normalize(field.tag))) return { tag: field.tag, field, label: field.label };
  }
  return null;
}

// Whether any tag names a domain, i.e. the card gets a colour.
export const hasDomainTag = (tags = []) => tags.some((t) => !!domainOfTag(t));

// A typed tag, as the suggestion it matches when there is one ("EEG" ->
// "eeg", "Machine Learning" -> "machine-learning"), else as typed.
export function canonicalTag(tag) {
  const t = String(tag || "").trim();
  const n = normalize(t);
  return SUGGESTED_TAGS.find((s) => normalize(s) === n) || t;
}

// Each domain's colours, from its hue: a subject's strong, a task's quieter,
// so what an app is about reads first. bg: the banner; tile: the app's tile;
// ink: text and icons on them; line: chip borders and edges; accent: the
// domain's mark elsewhere (a canvas step's strip, a filter chip's dot).
export function domainColors(domain) {
  if (!domain) return NEUTRAL_COLORS;
  const h = domain.hue;
  return domain.subject
    ? { bg: `hsl(${h}, 65%, 96%)`, tile: `hsl(${h}, 60%, 88%)`, ink: `hsl(${h}, 55%, 30%)`, line: `hsl(${h}, 40%, 72%)`, accent: `hsl(${h}, 60%, 45%)` }
    : { bg: `hsl(${h}, 30%, 96%)`, tile: `hsl(${h}, 28%, 88%)`, ink: `hsl(${h}, 30%, 32%)`, line: `hsl(${h}, 20%, 74%)`, accent: `hsl(${h}, 35%, 50%)` };
}

// An app with no domain is grey: a colour always means a domain. Its accent
// is none, so a canvas step keeps the processor's own colour.
export const NEUTRAL_COLORS = Object.freeze({
  bg: "hsl(220, 12%, 96%)",
  tile: "hsl(220, 10%, 89%)",
  ink: "hsl(220, 9%, 35%)",
  line: "hsl(220, 8%, 78%)",
  accent: null,
});

// The domain of an app (of a version, by tag), from its app.yml.
export const appDomain = (app, tag) => domainOf(versionManifest(app, tag));
export const appColors = (app, tag) => domainColors(appDomain(app, tag));

// The domains of a list of apps, most common first, with how many apps each:
// the Apps tab's filter chips.
export function domainCounts(apps) {
  const counts = new Map();
  for (const app of apps || []) {
    const d = appDomain(app);
    if (d) counts.set(d, (counts.get(d) || 0) + 1);
  }
  return [...counts]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => Number(!!b.domain.subject) - Number(!!a.domain.subject) || b.count - a.count || a.domain.label.localeCompare(b.domain.label));
}

// The fields of an app (of a version, by tag), from its app.yml.
export const appFields = (app, tag) => fieldsOf(versionManifest(app, tag));

// The fields among apps, most common first, with how many apps each: the
// Apps tab's Field chips. An app counts once for each of its fields.
export function fieldCounts(apps) {
  const counts = new Map();
  for (const app of apps || []) for (const f of appFields(app)) counts.set(f, (counts.get(f) || 0) + 1);
  return [...counts]
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count || a.field.label.localeCompare(b.field.label));
}

const typesOf = (ports) => [...new Set((ports || []).flatMap((p) => (p.mediaTypes || []).map(shortMediaType)))];

// What an app's banner shows: { manifest, domain, colors, interactive,
// inputs, outputs }. Its colours are its domain's, else grey; inputs and
// outputs are the media types its app.yml declares, short ("EDF").
export function appBanner(app) {
  const manifest = versionManifest(app);
  const domain = domainOf(manifest);
  return {
    manifest: !!manifest,
    domain,
    colors: domainColors(domain),
    interactive: !!sessionTypeOf(app),
    inputs: typesOf(manifest?.inputs),
    outputs: typesOf(manifest?.outputs),
  };
}

// The types that fit on one row of a banner, and how many more there are:
// as many as fit in `width` px (a chip is ~7px a letter plus 15px of padding
// and gap), keeping room for "+n" while any are left out; always the first,
// which the chip shortens with an ellipsis when it alone is too long.
export function fitTypes(types, width = 130) {
  const chip = (t) => String(t).length * 7 + 15;
  const MORE = 30;
  const shown = [];
  let used = 0;
  for (let i = 0; i < types.length; i++) {
    const need = used + chip(types[i]) + (i < types.length - 1 ? MORE : 0);
    if (shown.length && need > width) break;
    shown.push(types[i]);
    used += chip(types[i]);
  }
  return { types: shown, more: types.length - shown.length };
}
