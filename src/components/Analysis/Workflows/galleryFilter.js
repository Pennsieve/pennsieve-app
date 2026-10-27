// The Workflows tab's views, and searching, filtering and sorting its Library:
// pure, so the rules are easy to test and change.
import { appNames, ioSummary, outputLabel } from "./workflowSummary";
import { normalizeUrl } from "../RunMonitor/runHelpers";
import { versionManifest } from "../WorkflowBuilder/appManifestInfo";
import { isNotebookWorkflow } from "../RunMonitor/notebookHelpers";

// Whether a workflow matches a search: its name, description, the apps it
// runs, or what goes in and comes out ("spike" finds the one running
// spike-detect; "download" the ones that produce a download).
export function matchesSearch(wf, query, { applications = [], targetTypes = [] } = {}) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = [wf.name, wf.description, ...appNames(wf, applications), ioSummary(wf, targetTypes)]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

// What a workflow takes in: "dataset" with a data source, "none" without.
export const inputKind = (wf) => ((wf?.dag || []).some((n) => n.type === "data-source") ? "dataset" : "none");

// The target types a workflow writes to.
export const outputTypes = (wf) => [
  ...new Set((wf?.dag || []).filter((n) => n.type === "data-target" && n.targetType).map((n) => n.targetType)),
];

// The output choices for a list: each target type some workflow writes to,
// with its label.
export function outputOptions(list, targetTypes = []) {
  const types = [...new Set(list.flatMap(outputTypes))];
  return types
    .map((t) => ({ value: t, label: outputLabel(t, targetTypes) || t }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// officialOnly keeps Pennsieve's.
export function applyFilters(list, { query, input = "any", output = "any", officialOnly = false, ...context } = {}) {
  return list.filter(
    (wf) =>
      (!officialOnly || wf.official) &&
      (input === "any" || inputKind(wf) === input) &&
      (output === "any" || outputTypes(wf).includes(output)) &&
      matchesSearch(wf, query, context)
  );
}

const lastRun = (wf) =>
  Date.parse(wf?.lastRunAt || wf?.metrics?.lastRunAt || wf?.metrics?.lastRunCompletedAt || "") || 0;
const created = (wf) => Date.parse(wf?.createdAt || "") || 0;
const runs = (wf) => wf?.metrics?.totalRuns ?? 0;

export const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "recent", label: "Recently used" },
  { value: "runs", label: "Most run" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
];

// Whether every app step's app has an app.yml (a workflow of no apps does).
function appsDeclared(wf, applications) {
  const byUrl = new Map((applications || []).map((a) => [normalizeUrl(a.sourceUrl), a]));
  return (wf?.dag || [])
    .filter((n) => n.sourceUrl)
    .every((n) => versionManifest(byUrl.get(normalizeUrl(n.sourceUrl))));
}

// Recommended, in tiers that can be explained: official first, then active
// ones, then those whose apps all have an app.yml, then the most run, then
// the most recently run.
export function recommendedTier(wf, applications = []) {
  return [wf?.official ? 0 : 1, wf?.isActive === false ? 1 : 0, appsDeclared(wf, applications) ? 0 : 1];
}

// Sorted copies; ties go to the newest, then by name.
export function sortWorkflows(list, sort = "recent", { applications = [] } = {}) {
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  const tie = (a, b) => created(b) - created(a) || byName(a, b);
  const tiers = sort === "recommended" ? new Map(list.map((wf) => [wf, recommendedTier(wf, applications)])) : null;
  const byTier = (a, b) => tiers.get(a).reduce((d, t, i) => d || t - tiers.get(b)[i], 0);
  const cmp = {
    recommended: (a, b) => byTier(a, b) || runs(b) - runs(a) || lastRun(b) - lastRun(a) || tie(a, b),
    recent: (a, b) => lastRun(b) - lastRun(a) || tie(a, b),
    runs: (a, b) => runs(b) - runs(a) || tie(a, b),
    newest: tie,
    name: (a, b) => byName(a, b) || created(b) - created(a),
  }[sort] || tie;
  return [...list].sort(cmp);
}

// The Workflows tab's views: Library (the workflows), Live (their runs),
// Builder. Without one in the URL, the view last used, else Library.
// Live first: what's running and how it went is what's looked at most; then
// the Library, to start a workflow; then the Builder, to make one.
export const WORKFLOW_VIEWS = [
  { key: "live", label: "Live" },
  { key: "library", label: "Library" },
  { key: "builder", label: "Builder" },
];
// The view to show: the one asked for (?view), else the one last used here,
// else, on a first visit, Live when the workspace has runs (hasRuns) and the
// Library when it has none (nothing to watch yet).
export function workflowsView(requested, last, hasRuns = false) {
  const known = (v) => WORKFLOW_VIEWS.some((o) => o.key === v);
  if (known(requested)) return requested;
  if (known(last)) return last;
  return hasRuns ? "live" : "library";
}

// The Library lists workflows to run; notebooks start on the Notebooks tab.
export const libraryWorkflows = (list = []) => list.filter((wf) => !isNotebookWorkflow(wf));

