// The Workflows tab's views, and searching, filtering and sorting its Library:
// pure, so the rules are easy to test and change.
import { appNames, ioSummary, outputLabel } from "./workflowSummary";
import { normalizeUrl } from "../RunMonitor/runHelpers";
import { versionManifest } from "../WorkflowBuilder/appManifestInfo";
import { isNotebookWorkflow } from "../RunMonitor/notebookHelpers";
import { interfaceDag } from "../RunMonitor/workflowInterface";
import { fieldsOf, domainOfTag, appDomain } from "../Applications/appDomains";

// Whether a workflow matches a search: its name, description, tags, the
// apps it runs, or what goes in and comes out ("spike" finds the one running
// spike-detect; "download" the ones that produce a download).
export function matchesSearch(wf, query, { applications = [], targetTypes = [] } = {}) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const haystack = [wf.name, wf.description, ...(wf.tags || []), ...appNames(wf, applications), ioSummary(wf, targetTypes)]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

// What a workflow takes in: "dataset" with a data source, "none" without.
export const inputKind = (wf) => (interfaceDag(wf).some((n) => n.type === "data-source") ? "dataset" : "none");

// The target types a workflow writes to.
export const outputTypes = (wf) => [
  ...new Set(interfaceDag(wf).filter((n) => n.type === "data-target" && n.targetType).map((n) => n.targetType)),
];

// The output choices for a list: each target type some workflow writes to,
// with its label.
export function outputOptions(list, targetTypes = []) {
  const types = [...new Set(list.flatMap(outputTypes))];
  return types
    .map((t) => ({ value: t, label: outputLabel(t, targetTypes) || t }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Each app step's app, by its source URL (null for an app not loaded).
function stepApps(wf, applications) {
  const byUrl = new Map((applications || []).map((a) => [normalizeUrl(a.sourceUrl), a]));
  return interfaceDag(wf)
    .filter((n) => n.sourceUrl)
    .map((n) => byUrl.get(normalizeUrl(n.sourceUrl)) || null);
}

// A workflow with tags is what its tags say; one without is what its steps'
// apps are (their app.yml tags, in step order), so a workflow nobody has
// tagged yet still has a place in the filters.
const tagged = (wf) => (wf?.tags || []).length > 0;

// The research fields a workflow serves.
export function workflowFields(wf, applications = []) {
  if (tagged(wf)) return fieldsOf(wf);
  return [...new Set(stepApps(wf, applications).flatMap((app) => fieldsOf(versionManifest(app))))];
}

// The domains a workflow is for (what it handles: imaging, visualization…,
// appDomains.js); an app's is the first its tags name.
export function workflowDomains(wf, applications = []) {
  if (tagged(wf)) return [...new Set((wf.tags || []).map(domainOfTag).filter(Boolean))];
  return [...new Set(stepApps(wf, applications).map((app) => appDomain(app)).filter(Boolean))];
}

// The domain chips for a list: each domain some workflow is for, with how
// many workflows; subjects first, then the most common.
export function domainOptions(list, applications = []) {
  const counts = new Map();
  for (const wf of list || []) for (const d of workflowDomains(wf, applications)) counts.set(d, (counts.get(d) || 0) + 1);
  return [...counts]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => Number(!!b.domain.subject) - Number(!!a.domain.subject) || b.count - a.count || a.domain.label.localeCompare(b.domain.label));
}

// What an untagged workflow's card shows in place of tags: the tags its apps'
// domains and fields go by ("imaging", "neuroscience"), so a card says why a
// chip filter matched it. Empty for a tagged workflow (its own tags show).
export function inheritedTags(wf, applications = []) {
  if (tagged(wf)) return [];
  return [...new Set([...workflowDomains(wf, applications).map((d) => d.tag), ...workflowFields(wf, applications).map((f) => f.tag)])];
}

// The field chips for a list: each field some workflow serves, with how
// many workflows, most common first.
export function fieldOptions(list, applications = []) {
  const counts = new Map();
  for (const wf of list || []) for (const f of workflowFields(wf, applications)) counts.set(f, (counts.get(f) || 0) + 1);
  return [...counts]
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count || a.field.label.localeCompare(b.field.label));
}

// officialOnly keeps Pennsieve's; domain is a domain's key, field a research
// field's.
export function applyFilters(list, { query, input = "any", output = "any", domain = "any", field = "any", officialOnly = false, ...context } = {}) {
  return list.filter(
    (wf) =>
      (!officialOnly || wf.official) &&
      (input === "any" || inputKind(wf) === input) &&
      (output === "any" || outputTypes(wf).includes(output)) &&
      (domain === "any" || workflowDomains(wf, context.applications).some((d) => d.key === domain)) &&
      (field === "any" || workflowFields(wf, context.applications).some((f) => f.key === field)) &&
      matchesSearch(wf, query, context)
  );
}

// The Library's facets: what each takes, and its value when nothing is chosen.
export const INPUT_OPTIONS = [
  { value: "dataset", label: "Takes a dataset" },
  { value: "none", label: "No input" },
];
export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];
export const FACET_DEFAULTS = { domain: "any", field: "any", input: "any", output: "any", status: "active" };

// The facets set away from their defaults, as removable chips: { key, label }
// in the panel's order (status, domain, field, input, output). The labels
// come from the options shown (domainOptions, fieldOptions, outputOptions);
// a value no longer offered (another scope's) shows by its key.
export function activeFilters(state = {}, { domains = [], fields = [], outputs = [] } = {}) {
  const set = (key) => state[key] !== undefined && state[key] !== FACET_DEFAULTS[key];
  const chips = [];
  if (set("status")) {
    chips.push({ key: "status", label: `Status: ${STATUS_OPTIONS.find((o) => o.value === state.status)?.label || state.status}` });
  }
  if (set("domain")) {
    const d = domains.find((o) => o.domain.key === state.domain);
    chips.push({ key: "domain", label: d?.domain.label || state.domain });
  }
  if (set("field")) {
    const f = fields.find((o) => o.field.key === state.field);
    chips.push({ key: "field", label: f?.field.label || state.field });
  }
  if (set("input")) {
    chips.push({ key: "input", label: INPUT_OPTIONS.find((o) => o.value === state.input)?.label || state.input });
  }
  if (set("output")) {
    const o = outputs.find((x) => x.value === state.output);
    chips.push({ key: "output", label: `Output: ${o?.label || state.output}` });
  }
  return chips;
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
  return stepApps(wf, applications).every((app) => versionManifest(app));
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

// The Library lists workflows to run; notebooks start on the Notebooks tab,
// so they're left out unless asked for (e.g. to manage the notebook
// workflows a workspace such as Pennsieve Admin publishes).
export const libraryWorkflows = (list = [], includeNotebooks = false) =>
  includeNotebooks ? list : list.filter((wf) => !isNotebookWorkflow(wf));

