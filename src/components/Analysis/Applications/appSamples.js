/*
  An app's sample outputs: the sample output PDFs (Workflows/runExamples.js)
  of the workflows the app is in.
*/
import { normalizeUrl } from "../RunMonitor/runHelpers";
import { interfaceDag } from "../RunMonitor/workflowInterface";

export const sameRepo = (a, b) => !!a && !!b && normalizeUrl(a).toLowerCase() === normalizeUrl(b).toLowerCase();

// The workflows (deduplicated by uuid) with a step running the app.
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

// One workflow's sample output as the app's page lists it, or null. note:
// how the report relates to the workflow's current version (Workflows/
// runExamples.js reportNote), kept only when there's one.
export const appSampleEntry = (wf, example, note = "") =>
  wf && example ? { workflow: { uuid: wf.uuid, name: wf.name || "Workflow" }, example, ...(note && { note }) } : null;

export const sortEntries = (entries) => [...entries].sort((a, b) => a.workflow.name.localeCompare(b.workflow.name));
