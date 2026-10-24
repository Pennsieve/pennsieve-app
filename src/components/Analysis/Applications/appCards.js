// What the Gallery's app cards show, and how they're searched, filtered
// and sorted: pure, from the application records.
import { normalizeUrl } from "../RunMonitor/runHelpers";
import { versionManifest } from "../WorkflowBuilder/appManifestInfo";

export function githubRepo(sourceUrl) {
  const m = (sourceUrl || "").match(/github\.com\/([^/]+)\/([^/\s.]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : null;
}

// The app's name: its own, or its repository's.
export function appTitle(app) {
  return app?.name || githubRepo(app?.sourceUrl)?.repo || "Unnamed app";
}

// The card's tile: the app's initials on a colour of its own, derived from
// its name, so it's stable and needs nothing from outside the platform.
export function appInitials(app) {
  const words = appTitle(app).split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2);
  return letters.toUpperCase();
}
export function appColor(app) {
  let h = 0;
  for (const c of appTitle(app)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return { background: `hsl(${h}, 55%, 92%)`, color: `hsl(${h}, 45%, 32%)` };
}

export function latestVersion(app) {
  return [...(app?.versions || [])].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0] || null;
}

const COMPUTE_LABEL = { standard: "Standard", lambda: "Lambda", gpu: "GPU" };
export const computeLabel = (t) => COMPUTE_LABEL[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");

// "v1.2.0", from a tag written with or without its "v".
export const versionLabel = (tag) => (tag ? (/^v/i.test(tag) ? tag : `v${tag}`) : "");

// What the app is: its app.yml's description, else its record's; one that
// only repeats the app's name says nothing.
export function appDescription(app) {
  const m = versionManifest(app);
  const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  return [m?.description, app?.description].find((d) => d && !same(d, appTitle(app)) && !same(d, m?.name)) || "";
}

// "Standard, Lambda · 2 vCPU · 4 GB": where it runs and what it asks for,
// as its app.yml declares it, else as its record has it.
export function runsOn(app) {
  const declared = versionManifest(app)?.runtime || {};
  const record = app?.runtimeConfig || {};
  const rc = {
    computeTypes: declared.computeTypes?.length ? declared.computeTypes : record.computeTypes,
    cpu: declared.cpu || record.cpu,
    memory: declared.memory || record.memory,
  };
  const parts = [];
  const types = (rc.computeTypes || []).map(computeLabel).filter(Boolean);
  if (types.length) parts.push(types.join(", "));
  const cpu = Number(rc.cpu);
  if (cpu > 0) parts.push(`${+(cpu / 1024).toFixed(2)} vCPU`);
  const mem = Number(rc.memory);
  if (mem > 0) parts.push(mem >= 1024 ? `${+(mem / 1024).toFixed(1)} GB` : `${mem} MB`);
  return parts.join(" · ");
}

// How many of the given workflows run the app.
export function workflowUses(app, workflows = []) {
  const url = normalizeUrl(app?.sourceUrl);
  if (!url) return 0;
  return workflows.filter((wf) => (wf.dag || []).some((n) => normalizeUrl(n.sourceUrl) === url)).length;
}

// The latest version's state, as a dot: green deployed, amber on its way,
// red failed, grey otherwise.
export function versionState(app) {
  const s = String(latestVersion(app)?.status || "").toLowerCase();
  if (["deployed", "active", "running"].includes(s)) return "ok";
  if (["registering", "deploying", "re-deploying", "pending"].includes(s)) return "pending";
  if (s.startsWith("error") || s === "stopped" || s === "failed") return "failed";
  return "none";
}

export function matchesAppSearch(app, query, readme = "") {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const r = githubRepo(app?.sourceUrl);
  const m = versionManifest(app);
  const haystack = [appTitle(app), app?.description, m?.description, ...(m?.tags || []), readme, r && `${r.owner}/${r.repo}`, latestVersion(app)?.version]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((w) => haystack.includes(w));
}

export const APP_SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "used", label: "Most used" },
  { value: "updated", label: "Recently updated" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
];

// Recommended, in tiers that can be explained: apps that can run (latest
// version deployed, then on its way, then failed), then those with an
// app.yml, then the most used, then the most recently updated.
const RUNNABLE = { ok: 0, pending: 1, none: 1, failed: 2 };
export const recommendedTier = (app) => [RUNNABLE[versionState(app)] ?? 1, versionManifest(app) ? 0 : 1];

export function sortApps(list, sort, workflows = []) {
  const created = (a) => Date.parse(a.createdAt || "") || 0;
  const updated = (a) => Date.parse(latestVersion(a)?.createdAt || a.createdAt || "") || 0;
  const byName = (a, b) => appTitle(a).localeCompare(appTitle(b));
  const uses = new Map(list.map((a) => [a, workflowUses(a, workflows)]));
  const tiers = new Map(list.map((a) => [a, recommendedTier(a)]));
  const byTier = (a, b) => tiers.get(a)[0] - tiers.get(b)[0] || tiers.get(a)[1] - tiers.get(b)[1];
  const cmp = {
    recommended: (a, b) => byTier(a, b) || uses.get(b) - uses.get(a) || updated(b) - updated(a) || byName(a, b),
    used: (a, b) => uses.get(b) - uses.get(a) || byName(a, b),
    updated: (a, b) => updated(b) - updated(a) || byName(a, b),
    newest: (a, b) => created(b) - created(a) || byName(a, b),
    name: byName,
  }[sort] || ((a, b) => created(b) - created(a));
  return [...list].sort(cmp);
}
