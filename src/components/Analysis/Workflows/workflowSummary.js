// What a workflow card says about a workflow, from its definition.
import { extractRepoName, findAppByUrl, getTargetTypeLabel } from "../RunMonitor/runHelpers";
import { interfaceDag } from "../RunMonitor/workflowInterface";

// A target type's label, or its name capitalised where it has none
// ("pennsieve" -> "Pennsieve").
export function outputLabel(targetType, targetTypes = []) {
  const label = getTargetTypeLabel(targetType, targetTypes);
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Dataset files → 3 steps → Pennsieve Dataset": what goes in, how many
// steps, what comes out.
export function ioSummary(wf, targetTypes = []) {
  const dag = interfaceDag(wf);
  const sources = dag.filter((n) => n.type === "data-source").length;
  const steps = dag.filter((n) => n.type !== "data-source" && n.type !== "data-target").length;
  const targets = [
    ...new Set(dag.filter((n) => n.type === "data-target").map((n) => outputLabel(n.targetType, targetTypes))),
  ].filter(Boolean);
  const input = sources === 0 ? "No input" : sources === 1 ? "Dataset files" : `${sources} inputs`;
  const output = targets.length ? targets.join(", ") : "Results";
  return [input, plural(steps, "step"), output].join(" → ");
}

// The names of the apps a workflow runs, in order, once each.
export function appNames(wf, applications = []) {
  const names = [];
  for (const n of interfaceDag(wf)) {
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

// What a card says a workflow is: its summary (the short line written for
// that), else its description as plain text, since descriptions are Markdown
// ("- **signals** feed…" reads as "signals feed…").
export function cardText(wf) {
  const summary = String(wf?.summary || "").trim();
  if (summary) return summary;
  return String(wf?.description || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(#{1,6}|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
