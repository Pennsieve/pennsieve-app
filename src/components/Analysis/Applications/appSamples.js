/*
  An app's sample outputs: the workflows that run the app and have a sample
  output (a PDF summary of one run, see Workflows/runExamples.js), with the
  part of each PDF the app's step produced. The PDF's per-step index
  (example.steps) attributes figures and outputs to steps through the
  workflow's wiring; samples made before the index have no steps and are
  shown without pages.
*/
import { normalizeUrl } from "../RunMonitor/runHelpers";
import { interfaceDag } from "../RunMonitor/workflowInterface";

export const sameRepo = (a, b) => !!a && !!b && normalizeUrl(a).toLowerCase() === normalizeUrl(b).toLowerCase();

// The workflows (deduplicated by uuid) whose steps run the app.
export const workflowsUsingApp = (workflows, sourceUrl) => {
  const seen = new Set();
  return (workflows || []).filter((wf) => {
    if (!wf?.uuid || seen.has(wf.uuid)) return false;
    const uses = interfaceDag(wf).some(
      (n) => n.type !== "data-source" && n.type !== "data-target" && sameRepo(n.sourceUrl, sourceUrl)
    );
    if (uses) seen.add(wf.uuid);
    return uses;
  });
};

// "4–5, 8–10" from [4, 5, 8, 9, 10].
export const pageRanges = (pages) => {
  const sorted = [...new Set((pages || []).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
};

export const pagesText = (pages) => {
  const r = pageRanges(pages);
  if (!r) return "";
  return /[–,]/.test(r) ? `pages ${r}` : `page ${r}`;
};

const plural = (n, one) => `${n} ${one}${n === 1 ? "" : "s"}`;

// What the PDF shows of one step: "3 figures · 1 output · pages 4–5, 8–10",
// or why it shows nothing.
export const stepSummary = (step) => {
  if (!step) return "";
  const parts = [];
  if (step.figures) parts.push(plural(step.figures, "figure"));
  if (step.outputs) parts.push(plural(step.outputs, "output"));
  if (parts.length) {
    const pages = pagesText(step.pages);
    return pages ? `${parts.join(" · ")} · ${pages}` : parts.join(" · ");
  }
  return step.notStored
    ? "This run didn't save the step's outputs to a dataset, so the PDF doesn't show them."
    : "The PDF shows nothing this step produced on its own.";
};

// The first page showing the step, or null.
export const firstPage = (step) => {
  const pages = (step?.pages || []).filter((n) => Number.isInteger(n) && n > 0);
  return pages.length ? Math.min(...pages) : null;
};

// One workflow's sample output as the app's page shows it, or null where
// the sample doesn't include the app (its index has no step running it).
export const appSampleEntry = (wf, example, sourceUrl) => {
  if (!wf || !example) return null;
  const indexed = Array.isArray(example.steps);
  const steps = indexed ? example.steps.filter((s) => sameRepo(s.sourceUrl, sourceUrl)) : [];
  if (indexed && !steps.length) return null;
  return { workflow: { uuid: wf.uuid, name: wf.name || "Workflow" }, example, steps, indexed };
};

// Entries with something of the app's in the PDF first, then by name.
export const sortEntries = (entries) =>
  [...entries].sort((a, b) => {
    const shown = (e) => (e.steps.some((s) => s.figures || s.outputs) ? 0 : e.indexed ? 2 : 1);
    return shown(a) - shown(b) || a.workflow.name.localeCompare(b.workflow.name);
  });
