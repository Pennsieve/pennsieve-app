/*
  Reference sources: a workflow input filled from Pennsieve's reference
  catalog (environments-service) rather than files. An app marks the step
  input that takes one with a `reference` block in app.yml (inputs[].reference:
  kind, assetClass, toolVersion, choice app|user, organisms, default); a run
  binds the input to a catalog reference with dataSources[id] =
  { kind: "reference", environmentId } and the step downloads its newest
  ready version into the input's folder. Unbound, the input takes the
  workflow's default (inputs[].default), else the app's own.
*/

export const REFERENCE_KIND = "reference";

// Common names for the organisms Pennsieve keeps references of, by NCBI
// taxonomy id; others show their scientific name.
const ORGANISMS = { 9606: "Human", 10090: "Mouse" };

// Assembly names for the accessions the catalog uses (GenBank and RefSeq).
const ASSEMBLIES = {
  "GCA_000001405.29": "GRCh38",
  "GCF_000001405.40": "GRCh38",
  "GCA_000001635.9": "GRCm39",
  "GCF_000001635.27": "GRCm39",
};

// What an asset class is, in words, and the tool that reads it.
const ASSET_CLASSES = {
  "salmon-index": { name: "Salmon indexes", tool: "salmon" },
  "brain-template": { name: "Brain templates", tool: "" },
};

// The catalog's kinds, in the order the reference data page lists them.
export const REFERENCE_KINDS = [
  { kind: "genome", label: "Genomes" },
  { kind: "template", label: "Templates" },
];

// An asset class in words: "Salmon indexes", else its own name.
export const assetClassName = (assetClass) => ASSET_CLASSES[assetClass]?.name || assetClass || "";

// The kind of reference an input takes, in a sentence's words: "Salmon
// indexes that salmon >=2 <3 can read".
export const referenceKindText = (reference) => {
  const c = ASSET_CLASSES[reference?.assetClass] || { name: reference?.assetClass || "References", tool: "" };
  return reference?.toolVersion && c.tool ? `${c.name} that ${c.tool} ${reference.toolVersion} can read` : c.name;
};

export const organismName = (taxonomyId, organism = "") =>
  ORGANISMS[taxonomyId] || organism || (taxonomyId ? `Taxon ${taxonomyId}` : "");

export const assemblyName = (accession) => ASSEMBLIES[accession] || accession || "";

export const annotationName = (annotation) =>
  annotation?.provider ? [annotation.provider, annotation.version].filter(Boolean).join(" ") : "";

// A catalog entry's spec (its version's), or a spec as given.
const specOf = (entryOrSpec) => entryOrSpec?.version?.spec || entryOrSpec?.spec || entryOrSpec || {};

// What a reference is, in a few words: its title ("MNI152NLin2009cAsym, 1 mm,
// brain"), else a genome's "Human · GRCh38 · GENCODE 50", else its
// properties' values. Takes a catalog entry, a spec, or an app.yml identity
// (taxonomyId, assembly, annotation, properties).
export const referenceLabel = (entryOrSpec) => {
  const s = specOf(entryOrSpec);
  if (s.title) return s.title;
  const genome = [organismName(s.taxonomyId, s.organism), assemblyName(s.assembly), annotationName(s.annotation)]
    .filter(Boolean)
    .join(" · ");
  return genome || Object.values(s.properties || {}).filter(Boolean).join(" · ");
};

// A catalog entry's facts, for a details pane.
export const referenceDetails = (entry) => {
  const v = entry?.version || {};
  const s = v.spec || {};
  return {
    id: entry?.id || "",
    label: referenceLabel(entry),
    organism: s.organism ? `${s.organism}${s.taxonomyId ? ` (${s.taxonomyId})` : ""}` : "",
    assembly: s.assembly ? [assemblyName(s.assembly), s.assembly].filter((x, i, a) => a.indexOf(x) === i).join(" · ") : "",
    annotation: annotationName(s.annotation),
    tool: [s.tool, s.toolVersion].filter(Boolean).join(" "),
    version: v.version || entry?.latestVersion || 0,
    sizeBytes: v.archive?.sizeBytes || 0,
    unpackedBytes: v.archive?.unpackedBytes || 0,
    sha256: v.archive?.sha256 || "",
    license: entry?.license || "",
    description: entry?.description || "",
    citation: entry?.citation || "",
    // A template's (or any reference's) own terms: [{ name, value }].
    properties: Object.entries(s.properties || {}).map(([name, value]) => ({ name, value })),
    // Where its files came from: { description, files: [{ path, url, sha256 }] }.
    source: { description: v.source?.description || "", files: v.source?.files || [] },
  };
};

// Whether an app.yml reference input can take a catalog entry: the same kind
// and asset class, the properties it asks for, and its organisms or the
// identity it pins. Tool-version ranges are left to the catalog.
export const inputTakes = (reference, entry) => {
  const s = specOf(entry);
  return (
    !!reference &&
    (reference.kind || "genome") === (entry?.kind || "genome") &&
    (!reference.assetClass || reference.assetClass === s.assetClass) &&
    Object.entries(reference.properties || {}).every(([k, v]) => String((s.properties || {})[k] ?? "") === String(v)) &&
    fitsInput(entry, reference)
  );
};

// The apps whose newest app.yml has an input that can take a catalog entry:
// [{ app, input, pinned }], pinned when the input names this very reference
// (choice: app). manifestOf is appManifestInfo's versionManifest.
export const appsUsing = (entry, applications, manifestOf) =>
  (applications || []).flatMap((app) =>
    (manifestOf(app)?.inputs || [])
      .filter((p) => inputTakes(p?.reference, entry))
      .map((p) => ({ app, input: p.name, pinned: p.reference.choice === "app" }))
  );

// What a catalog entry is, as app.yml names it: a genome's organism,
// assembly and annotation, and any properties.
const identityOf = (entry) => {
  const s = specOf(entry);
  const id = {};
  if (s.taxonomyId) id.taxonomyId = Number(s.taxonomyId);
  if (s.assembly) id.assembly = s.assembly;
  if (s.annotation?.provider) id.annotation = { provider: s.annotation.provider, version: String(s.annotation.version || "") };
  if (Object.keys(s.properties || {}).length) id.properties = { ...s.properties };
  return id;
};

// The app.yml reference block for an input filled from a catalog entry: kind,
// asset class, the tool's major version for an index, and choice app pinning
// the entry, or choice user with it as the default (and the organisms a run
// may pick from; none: any).
export const referenceBlock = (entry, { choice = "app", organisms = [] } = {}) => {
  const s = specOf(entry);
  const block = { kind: entry?.kind || "genome" };
  if (s.assetClass) block.assetClass = s.assetClass;
  const major = String(s.toolVersion || "").match(/^(\d+)/)?.[1];
  if (major) block.toolVersion = `>=${major} <${Number(major) + 1}`;
  block.choice = choice;
  if (choice === "app") return { ...block, ...identityOf(entry) };
  if (organisms.length) block.organisms = [...organisms];
  return { ...block, default: identityOf(entry) };
};

// A YAML scalar: strings quoted, so "1" stays a string; numbers bare.
const yamlValue = (v) => (typeof v === "number" ? String(v) : JSON.stringify(String(v)));
const yamlFlow = (o) => `{${Object.entries(o).map(([k, v]) => `${k}: ${yamlValue(v)}`).join(", ")}}`;

// The app.yml input that pins a catalog entry, for an app's author to paste
// under inputs.
export const referenceSnippet = (entry) => {
  const lines = [
    "- name: reference",
    `  description: ${yamlValue(referenceLabel(entry) || "Reference data")}`,
    "  placement: subfolder",
    "  reference:",
  ];
  for (const [k, v] of Object.entries(referenceBlock(entry))) {
    const bare = k === "kind" || k === "assetClass" || k === "choice";
    lines.push(`    ${k}: ${typeof v === "object" ? yamlFlow(v) : bare ? v : yamlValue(v)}`);
  }
  return lines.join("\n");
};

// The ports of an app version that are filled from the catalog.
export const referenceInputs = (ports) => (ports || []).filter((p) => p?.reference);

// The organisms a reference input offers: the one it pins (choice app), else
// those it lists (none: any).
export const offeredOrganisms = (reference) => {
  if (!reference) return [];
  if (reference.choice === "app") return reference.taxonomyId ? [reference.taxonomyId] : [];
  return (reference.organisms || []).map(Number).filter(Boolean);
};

// The catalog query for a reference input's candidates: its kind, asset
// class, tool versions (the catalog matches the ranges, as runs do) and the
// properties every match has (property.<name>). The organisms are filtered
// here (fitsInput), so one query serves them all.
export const catalogQuery = (reference) => {
  const q = { kind: reference?.kind || "genome" };
  if (reference?.assetClass) q.assetClass = reference.assetClass;
  if (reference?.toolVersion) q.toolVersion = String(reference.toolVersion);
  for (const [k, v] of Object.entries(reference?.properties || {})) q[`property.${k}`] = String(v);
  return q;
};

const sameAnnotation = (a, b) =>
  !b || ((a?.provider || "") === (b.provider || "") && String(a?.version || "") === String(b.version || ""));

// Whether an app.yml identity names anything (an empty default names none).
const namesSomething = (id) =>
  !!id && !!(id.taxonomyId || id.assembly || id.seqcol || id.annotation || Object.keys(id.properties || {}).length);

// Whether a spec is the identity an app.yml names (taxonomyId, assembly or
// seqcol, annotation, properties); fields the identity leaves out match
// anything.
const matchesIdentity = (s, id) =>
  namesSomething(id) &&
  (!id.taxonomyId || Number(s.taxonomyId) === Number(id.taxonomyId)) &&
  (!id.assembly || s.assembly === id.assembly) &&
  (!id.seqcol || s.seqcol === id.seqcol) &&
  sameAnnotation(s.annotation, id.annotation) &&
  Object.entries(id.properties || {}).every(([k, v]) => String((s.properties || {})[k] ?? "") === String(v));

// Whether a catalog entry can fill the input: one of its organisms, or the
// one it pins.
export const fitsInput = (entry, reference) => {
  const s = specOf(entry);
  if (reference?.choice === "app") return matchesIdentity(s, reference);
  const organisms = offeredOrganisms(reference);
  return !organisms.length || organisms.includes(Number(s.taxonomyId));
};

// The identity an input takes when nothing else is chosen: the reference it
// pins (choice: app), else its default.
export const defaultIdentity = (reference) => (reference?.choice === "app" ? reference : reference?.default) || null;

// Whether a catalog entry is the app's default for the input (its default,
// or the reference it pins).
export const isAppDefault = (entry, reference) => matchesIdentity(specOf(entry), defaultIdentity(reference));

// What a reference source fills its input with, in words: the entry chosen
// (by its title or identity), a chosen one not yet loaded, else the app's
// default.
export const choiceLabel = ({ entry = null, chosenId = "", reference = null } = {}) => {
  if (entry) return referenceLabel(entry) || "The chosen reference";
  if (chosenId) return "The chosen reference";
  const id = defaultIdentity(reference);
  return (id && referenceLabel(id)) || "The app's default";
};

// A cache of catalog entries by id, loading each input's candidates once:
// { known (a ref of id -> entry), remember(entries), ensureLoaded(references),
// isLoaded(reference) }. find is environmentsService.findReferences; ref is Vue's.
export const createReferenceCatalog = (find, ref) => {
  const known = ref({});
  const loaded = new Set();
  const answered = ref({}); // query keys the catalog has answered (reactive)
  const remember = (entries) => {
    known.value = { ...known.value, ...Object.fromEntries((entries || []).map((e) => [e.id, e])) };
  };
  const ensureLoaded = async (references) => {
    const pending = new Map();
    for (const r of references || []) {
      const key = JSON.stringify(catalogQuery(r));
      if (!loaded.has(key)) pending.set(key, r);
    }
    await Promise.all(
      [...pending].map(async ([key, r]) => {
        loaded.add(key);
        try {
          remember(await find(catalogQuery(r)));
          answered.value = { ...answered.value, [key]: true };
        } catch {
          loaded.delete(key); // named by the app's default meanwhile; tried again later
        }
      })
    );
  };
  const isLoaded = (reference) => !!answered.value[JSON.stringify(catalogQuery(reference))];
  return { known, remember, ensureLoaded, isLoaded };
};

// Whether the catalog lacks what an input takes when nothing is chosen: the
// reference it pins or its default, else any it can take. The input then
// takes files (its folder's contents, described by the reference).
export const catalogLacks = (reference, entries) => {
  const fits = (entries || []).filter((e) => inputTakes(reference, e));
  return namesSomething(defaultIdentity(reference)) ? !fits.some((e) => isAppDefault(e, reference)) : !fits.length;
};

// The app's default among the candidates, or null.
export const appDefault = (entries, reference) => (entries || []).find((e) => isAppDefault(e, reference)) || null;

// The step input a source fills from the catalog, in a workflow's or run's
// DAG: { step, input, reference }, or null for ordinary input data. portsOf
// (sourceInputs portsOfStep) gives a step's app.yml ports.
export const referenceTargetIn = (sourceId, dag, portsOf) => {
  for (const step of dag || []) {
    for (const link of Array.isArray(step?.inputs) ? step.inputs : []) {
      if (link?.from !== sourceId || !link.input) continue;
      const port = (portsOf?.(step.id)?.inputs || []).find((p) => p?.name === link.input && p.reference);
      if (port) return { step: step.id, input: port.name, reference: port.reference };
    }
  }
  return null;
};

// The references a run's steps used (each step's references, as
// workflow-service resolved them at run start): { step, path, source,
// environmentId, version, label, sha256, sizeBytes, unpackedBytes }.
export const runReferences = (dag) =>
  (dag || []).flatMap((n) => (Array.isArray(n?.references) ? n.references.map((r) => ({ step: n.id, ...r })) : []));

// The run request's binding of a reference source.
export const referenceSource = (environmentId) => ({ kind: REFERENCE_KIND, environmentId });

export const isReferenceSource = (source) => source?.kind === REFERENCE_KIND && !!source.environmentId;

// The candidates in the order the picker lists them: the app's default first,
// then by organism and label.
export const sortReferences = (entries, reference) =>
  [...(entries || [])].sort(
    (a, b) =>
      Number(isAppDefault(b, reference)) - Number(isAppDefault(a, reference)) ||
      referenceLabel(a).localeCompare(referenceLabel(b))
  );

// "2.1 GB".
export const formatSize = (bytes) => {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
};
