// What an app is for, from the tags its app.yml declares: a short list of
// domains, each with a hue and an icon, that the Gallery's app banners are
// coloured by. Tags are free text, so each domain lists the spellings people
// use ("EEG", "iEEG", "electrophysiology"); a tag matches regardless of case
// and punctuation. Tags that match none leave the app coloured by its name.
import { versionManifest, shortMediaType, sessionTypeOf } from "../WorkflowBuilder/appManifestInfo";
import { appTitle } from "./appCards";

// A domain is a subject (what the app is about: EEG, imaging, genomics…) or
// a task (what it does with it: visualization, conversion, statistics…).
// The icon is an SVG path on a 24×24 grid, drawn as a stroke.
export const DOMAINS = [
  {
    key: "ephys",
    subject: true,
    label: "Electrophysiology",
    tag: "electrophysiology",
    hue: 255,
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
    hue: 190,
    aliases: ["image", "images", "microscopy", "mri", "fmri", "ct", "pet", "dicom", "nifti", "histology", "segmentation", "registration", "calcium-imaging", "image-processing"],
    icon: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01",
  },
  {
    key: "genomics",
    subject: true,
    label: "Genomics",
    tag: "genomics",
    hue: 140,
    aliases: ["sequencing", "rna-seq", "rnaseq", "scrna-seq", "dna", "rna", "omics", "transcriptomics", "proteomics", "genetics", "bioinformatics", "single-cell", "scrna", "seurat"],
    icon: "M7 3c0 6 10 6 10 12s-10 6-10 6M17 3c0 6-10 6-10 12M9 7h6M9 17h6",
  },
  {
    key: "ml",
    label: "Machine learning",
    tag: "machine-learning",
    hue: 290,
    aliases: ["ml", "ai", "deep-learning", "neural-network", "llm", "classification", "prediction", "inference"],
    icon: "M5 6h.01M5 18h.01M12 12h.01M19 6h.01M19 18h.01M5 6l7 6 7-6M5 18l7-6 7 6",
  },
  {
    key: "stats",
    label: "Statistics",
    tag: "statistics",
    hue: 28,
    aliases: ["stats", "analytics", "regression", "quantification"],
    icon: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  },
  {
    key: "viz",
    label: "Visualization",
    tag: "visualization",
    hue: 48,
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
    hue: 100,
    aliases: ["qc", "qa", "validation", "validate", "curation", "cleaning"],
    icon: "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  },
  {
    key: "notebook",
    label: "Notebook",
    tag: "notebook",
    hue: 230,
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
// whose app.yml says it's a live session.
export function domainOf(manifest) {
  const named = (manifest?.tags || []).map(domainOfTag).filter(Boolean);
  const d = named.find((x) => x.subject) || named[0];
  if (d) return d;
  if (manifest?.runtime?.interactive || manifest?.runtime?.sessionType) return DOMAINS.find((d) => d.key === "notebook");
  return null;
}

// The tags the app.yml builder suggests: each domain's own, then the
// spellings people use, so a typed "EEG" lands on a known "eeg".
export const SUGGESTED_TAGS = [...new Set(DOMAINS.flatMap((d) => [d.tag, ...d.aliases]))];

// A typed tag, as the suggestion it matches when there is one ("EEG" ->
// "eeg", "Machine Learning" -> "machine-learning"), else as typed.
export function canonicalTag(tag) {
  const t = String(tag || "").trim();
  const n = normalize(t);
  return SUGGESTED_TAGS.find((s) => normalize(s) === n) || t;
}

const nameHue = (app) => {
  let h = 0;
  for (const c of appTitle(app)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

const typesOf = (ports) => [...new Set((ports || []).flatMap((p) => (p.mediaTypes || []).map(shortMediaType)))];

// What an app's banner shows: { manifest, domain, hue, inputs, outputs }.
// Its hue is its domain's, else its name's (as the initials tiles); inputs
// and outputs are the media types its app.yml declares, short ("EDF").
export function appBanner(app) {
  const manifest = versionManifest(app);
  const domain = domainOf(manifest);
  return {
    manifest: !!manifest,
    domain,
    hue: domain ? domain.hue : nameHue(app),
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
