// What a workflow card says about a workflow, from its definition.
import { extractRepoName, findAppByUrl, getTargetTypeLabel } from "../RunMonitor/runHelpers";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Dataset files → 3 steps → Pennsieve Dataset": what goes in, how many
// steps, what comes out.
export function ioSummary(wf, targetTypes = []) {
  const dag = wf?.dag || [];
  const sources = dag.filter((n) => n.type === "data-source").length;
  const steps = dag.filter((n) => n.type !== "data-source" && n.type !== "data-target").length;
  const targets = [
    ...new Set(dag.filter((n) => n.type === "data-target").map((n) => getTargetTypeLabel(n.targetType, targetTypes))),
  ].filter(Boolean);
  const input = sources === 0 ? "No input" : sources === 1 ? "Dataset files" : `${sources} inputs`;
  const output = targets.length ? targets.join(", ") : "Results";
  return [input, plural(steps, "step"), output].join(" → ");
}

// The names of the apps a workflow runs, in order, once each.
export function appNames(wf, applications = []) {
  const names = [];
  for (const n of wf?.dag || []) {
    if (n.type === "data-source" || n.type === "data-target") continue;
    const app = findAppByUrl(n.sourceUrl, applications);
    const name = app?.name || extractRepoName(n.sourceUrl) || "";
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

// "Run 12× · last 2 days ago", "Never run".
export function usageLine(wf, relativeTime) {
  const total = wf?.metrics?.totalRuns ?? 0;
  if (!total) return "Never run";
  const last = wf?.lastRunAt || wf?.metrics?.lastRunAt || wf?.metrics?.lastRunCompletedAt || null;
  const rel = last ? relativeTime(last) : "";
  return rel ? `Run ${total}× · last ${rel}` : `Run ${total}×`;
}
