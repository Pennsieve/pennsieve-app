// What an app is for, from the tags its app.yml declares: a short list of
// domains, each with a hue and an icon, that the Apps tab's banners are
// coloured by. Tags are free text, so each domain lists the spellings people
// use ("EEG", "iEEG", "electrophysiology"); a tag matches regardless of case
// and punctuation. An app whose tags match none is grey: a colour always
// means a domain. The same tags also name research fields (FIELDS, below),
// which filter but never colour.
//
// The table itself is app-domains v1 (app-domains.v1.json, a copy of
// app-deploy-service's lambda/service/appdomains/app-domains.v1.json, published
// at https://schemas.pennsieve.io/app-domains/v1.json): github-service draws
// the same banner for an app's Discover page from it, so the two match.
import { versionManifest, shortMediaType, sessionTypeOf } from "../WorkflowBuilder/appManifestInfo";
import APP_DOMAINS from "./app-domains.v1.json";

// A domain is a subject (what the app is about: EEG, imaging, genomics…) or
// a task (what it does with it: visualization, conversion, statistics…).
// The icon is an SVG path on a 24×24 grid, drawn as a stroke.
export const DOMAINS = APP_DOMAINS.domains;

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
export const FIELDS = APP_DOMAINS.fields;

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
const hsl = (h, { s, l }) => `hsl(${h}, ${s}%, ${l}%)`;
const paletteOf = (h, p) => ({ bg: hsl(h, p.bg), tile: hsl(h, p.tile), ink: hsl(h, p.ink), line: hsl(h, p.line), accent: p.accent ? hsl(h, p.accent) : null });

export function domainColors(domain) {
  if (!domain) return NEUTRAL_COLORS;
  return paletteOf(domain.hue, domain.subject ? APP_DOMAINS.colors.subject : APP_DOMAINS.colors.task);
}

// An app with no domain is grey: a colour always means a domain. Its accent
// is none, so a canvas step keeps the processor's own colour.
export const NEUTRAL_COLORS = Object.freeze(paletteOf(APP_DOMAINS.colors.neutral.hue, APP_DOMAINS.colors.neutral));

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
