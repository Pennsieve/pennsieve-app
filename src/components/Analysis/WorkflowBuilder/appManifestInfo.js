// What the builder shows about an app from its versions' app.yml (the
// manifest app-deploy-service stores per version, on each entry of the app
// list's versions). Apps without an app.yml have none, and are shown and
// used as before, marked "No manifest".
import { validateAppConnection } from "../Applications/applicationSchema";
// The session type of an interactive (human-in-the-loop) app: "jupyter" (a
// notebook) or another kind; null for a batch app. Only as its app.yml
// declares it (runtime.interactive, runtime.sessionType): the one place an
// app says it's interactive.
export function sessionTypeOf(app) {
  const runtime = versionManifest(app)?.runtime;
  if (!runtime?.interactive) return null;
  return runtime.sessionType || "jupyter";
}

const newestFirst = (versions) =>
  [...(versions || [])].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

// The version a tag names, else the newest version that has a manifest.
function versionOf(app, tag) {
  const versions = newestFirst(app?.versions);
  if (tag) {
    const v = versions.find((x) => x.version === tag);
    if (v) return v;
  }
  return versions.find((v) => v.manifest) || null;
}

/*
  Variants (app.yml variants: docs/app-variants.md in workflow-service): one
  release builds several images of the app, e.g. a CPU and a GPU one. A
  version that has them carries defaultVariant, variantOrder and variants,
  either as stored (a map by id: { name, description, manifest, build }) or as
  a list ([{ id, name, description, default, manifest }], in order); its
  manifest is the default variant's. A version without them is one variant.
*/
const variantList = (version) => {
  const raw = version?.variants;
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw)) return raw.filter((v) => v && v.id);
  const order = (version.variantOrder || []).filter((id) => raw[id]);
  const rest = Object.keys(raw).filter((id) => !order.includes(id)).sort();
  return [...order, ...rest].map((id) => ({ ...raw[id], id }));
};

// A version's variants, in order, each { id, name, description, default,
// manifest, computeTypes, gpu, status, failureReason }; [] when it has
// none. The version is the tag's, else the newest with a manifest (as
// versionManifest).
export function variantsOf(app, tag) {
  const version = versionOf(app, tag);
  const list = variantList(version);
  if (!list.length) return [];
  const declared = list.find((v) => v.id === version.defaultVariant) || list.find((v) => v.default) || list[0];
  return list.map((v) => {
    const manifest = v.manifest || null;
    const computeTypes = manifest?.runtime?.computeTypes || [];
    return {
      id: v.id,
      name: v.name || manifest?.variant?.name || v.id,
      description: v.description || manifest?.variant?.description || "",
      default: v.id === declared.id,
      manifest,
      computeTypes,
      gpu: computeTypes.includes("gpu"),
      // Its build (app-deploy-service): registering, deployed, error or
      // disabled, and why it failed; "" where not given.
      status: v.status || "",
      failureReason: v.failureReason || "",
    };
  });
}

// The id of a version's default variant; "" when it has no variants.
export function defaultVariant(app, tag) {
  return variantsOf(app, tag).find((v) => v.default)?.id || "";
}

// The variants the palette offers as chips: an app's, when it has two or
// more (one variant is just the app).
export function paletteVariants(app) {
  const list = variantsOf(app);
  return list.length > 1 ? list : [];
}

// The variant a step keeps for its pinned version: the id, or "" for the
// default (which isn't written, so the version's default runs) and for one
// the version doesn't have.
export function stepVariant(app, tag, variant) {
  if (!variant) return "";
  const v = variantsOf(app, tag).find((x) => x.id === variant);
  return v && !v.default ? v.id : "";
}

// The manifest of a version (by tag), else of the newest version that has
// one; of its variant when one is given (and the version has it), else the
// default's, which is what the version's manifest is.
export function versionManifest(app, tag, variant) {
  const version = versionOf(app, tag);
  if (!version) return null;
  if (variant) {
    const v = variantList(version).find((x) => x.id === variant);
    if (v?.manifest) return v.manifest;
  }
  return version.manifest || null;
}

// Whether the platform serves manifests at all: until it does, no app can be
// said to lack one.
export const manifestsServed = (apps) => (apps || []).some((a) => (a.versions || []).some((v) => v.manifest));

// "application/edf" -> "EDF", "image/png" -> "PNG", "*/*" -> "Any";
// "application/octet-stream" -> "File"; a vendor type by its last part ("application/vnd.apache.parquet" ->
// "PARQUET").
export function shortMediaType(t) {
  if (!t || t === "*/*") return "Any";
  // Bytes of any kind: a file, not a format.
  if (t === "application/octet-stream") return "File";
  let sub = String(t).split("/").pop().replace(/^x-/, "").split("+")[0];
  if (sub.startsWith("vnd.")) sub = sub.split(".").pop();
  // The whole name ("open-ephys" -> "OPEN-EPHYS", "ome-zarr" -> "OME-ZARR"):
  // cutting at the first dash left "OPEN" and "OME". Only a compression
  // suffix is dropped ("nifti-gz" -> "NIFTI").
  return sub.replace(/-(gz|gzip|zip)$/, "").toUpperCase();
}

const portsLabel = (ports) => {
  const types = [...new Set((ports || []).flatMap((p) => (p.mediaTypes || []).map(shortMediaType)))];
  return types.join(", ");
};

// "EDF → JSON", or "" when the manifest declares no types.
export function ioLine(manifest) {
  if (!manifest) return "";
  const i = portsLabel(manifest.inputs);
  const o = portsLabel(manifest.outputs);
  if (!i && !o) return "";
  return `${i || "Any"} → ${o || "Any"}`;
}

// Whether an app's inputs accept what a step puts out: "fits" (media types
// match), "no" (they don't), or "unknown" (a side declares no types).
export function fitsAfter(stepPorts, manifest) {
  if (!stepPorts || !manifest) return "unknown";
  const { compatible, checked } = validateAppConnection(stepPorts, { inputs: manifest.inputs || [] });
  if (!checked) return "unknown";
  return compatible ? "fits" : "no";
}

// The palette's groups: what fits after the selected step (when one is),
// the user's own apps, then the rest; each by name.
export function paletteGroups(apps, { stepPorts = null, me = "", name = (a) => a.name } = {}) {
  const byName = (a, b) => name(a).localeCompare(name(b));
  const fits = stepPorts ? apps.filter((a) => fitsAfter(stepPorts, versionManifest(a)) === "fits") : [];
  const rest = apps.filter((a) => !fits.includes(a));
  const groups = [];
  if (stepPorts) groups.push({ key: "fits", label: "Fits after the selected step", apps: [...fits].sort(byName) });
  // Interactive apps (notebook kernels) are their own group, last: a step
  // where the workflow waits for someone to work in a session.
  const interactive = rest.filter((a) => sessionTypeOf(a));
  const batch = rest.filter((a) => !interactive.includes(a));
  const yours = batch.filter((a) => me && a.ownerId === me);
  const others = batch.filter((a) => !yours.includes(a));
  if (yours.length) groups.push({ key: "yours", label: "Yours", apps: yours.sort(byName) });
  groups.push({ key: "all", label: yours.length || stepPorts ? "Other apps" : "Apps", apps: others.sort(byName) });
  if (interactive.length) {
    groups.push({
      key: "interactive",
      label: "Interactive",
      note: "The workflow pauses here while someone works in a notebook.",
      apps: interactive.sort(byName),
    });
  }
  return groups.filter((g) => g.apps.length || g.key === "fits");
}

// Whether an app matches a search: name, description, tags, repository,
// its variants' names, and the media types it takes and produces.
export function matchesApp(app, query, name = (a) => a.name) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const m = versionManifest(app);
  const text = [
    name(app),
    m?.description || app.description,
    // Its variants' names and descriptions ("gpu", "ONCET").
    ...variantsOf(app).flatMap((v) => [v.id, v.name, v.description]),
    ...(m?.tags || []),
    app.sourceUrl,
    ioLine(m),
    ...((m?.inputs || []).concat(m?.outputs || []).flatMap((p) => p.mediaTypes || [])),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((w) => text.includes(w));
}
