// Searching, filtering and sorting the Gallery's workflows: pure, so the
// rules are easy to test and change.
import { appNames, ioSummary } from "./workflowSummary";
import { getTargetTypeLabel } from "../RunMonitor/runHelpers";

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
    .map((t) => ({ value: t, label: getTargetTypeLabel(t, targetTypes) || t }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

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
  { value: "recent", label: "Recently used" },
  { value: "runs", label: "Most run" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
];

// Sorted copies; ties go to the newest, then by name.
export function sortWorkflows(list, sort = "recent") {
  const byName = (a, b) => (a.name || "").localeCompare(b.name || "");
  const tie = (a, b) => created(b) - created(a) || byName(a, b);
  const cmp = {
    recent: (a, b) => lastRun(b) - lastRun(a) || tie(a, b),
    runs: (a, b) => runs(b) - runs(a) || tie(a, b),
    newest: tie,
    name: (a, b) => byName(a, b) || created(b) - created(a),
  }[sort] || tie;
  return [...list].sort(cmp);
}
