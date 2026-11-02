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
  };
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

// Whether a spec is the identity an app.yml names (taxonomyId, assembly or
// seqcol, annotation, properties); fields the identity leaves out match
// anything.
const matchesIdentity = (s, id) =>
  !!id &&
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

// Whether a catalog entry is the app's default for the input (its default,
// or the reference it pins).
export const isAppDefault = (entry, reference) =>
  matchesIdentity(specOf(entry), reference?.choice === "app" ? reference : reference?.default);

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
