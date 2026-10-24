// What the builder shows about an app from its versions' app.yml (the
// manifest app-deploy-service stores per version, on each entry of the app
// list's versions). Apps without an app.yml have none, and are shown and
// used as before, marked "No manifest".
import { validateAppConnection } from "../Applications/applicationSchema";
import { notebookKernel } from "../RunMonitor/notebookHelpers";

// The session type of an interactive (human-in-the-loop) app, e.g. a
// notebook kernel: "jupyter" or "r"; null for a batch app. As its app.yml
// declares it (runtime.interactive, runtime.sessionType), else read from
// the name as the Notebooks page does (notebookKernel):
// "pennsieve-jupyter-session", "pennsieve-r-session".
export function sessionTypeOf(app) {
  const runtime = versionManifest(app)?.runtime;
  if (runtime?.sessionType) return runtime.sessionType === "python" ? "jupyter" : runtime.sessionType;
  if (runtime?.interactive) return "jupyter";
  const repo = (app?.sourceUrl || "").replace(/\.git$/, "").split("/").pop() || "";
  return notebookKernel({ name: [versionManifest(app)?.name, app?.name, repo].filter(Boolean).join(" ") });
}

const newestFirst = (versions) =>
  [...(versions || [])].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));

// The manifest of a version (by tag), else of the newest version that has one.
export function versionManifest(app, tag) {
  const versions = newestFirst(app?.versions);
  if (tag) {
    const v = versions.find((x) => x.version === tag);
    if (v) return v.manifest || null;
  }
  return versions.find((v) => v.manifest)?.manifest || null;
}

// Whether the platform serves manifests at all: until it does, no app can be
// said to lack one.
export const manifestsServed = (apps) => (apps || []).some((a) => (a.versions || []).some((v) => v.manifest));

// "application/edf" -> "EDF", "image/png" -> "PNG", "*/*" -> "Any".
export function shortMediaType(t) {
  if (!t || t === "*/*") return "Any";
  const sub = String(t).split("/").pop().replace(/^x-/, "").replace(/^vnd\./, "");
  return sub.split(/[.+-]/)[0].toUpperCase();
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

// Whether an app matches a search: name, description, tags, repository and
// the media types it takes and produces.
export function matchesApp(app, query, name = (a) => a.name) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const m = versionManifest(app);
  const text = [
    name(app),
    m?.description || app.description,
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
