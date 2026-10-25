// Shared helpers for the Notebooks tab + launcher. A notebook is a workflow
// whose step's app declares, in its app.yml, a live Jupyter session;
// workflow-service says so as the workflow's \`notebook\` field ({kernel,
// savesTo, worksWithoutDataset}). Nothing here guesses from names.

// A notebook workflow's language ("python", "r"), or null if it isn't one.
export function notebookKernel(wf) {
  return wf?.notebook?.kernel || null;
}

export function isNotebookWorkflow(wf) {
  return !!wf?.notebook;
}

// Whether a run page (run-detail) belongs under the Notebooks tab rather than
// Workflows: the tab it was opened from (?from=notebooks|workflows), else
// whether it's a live session's run among those loaded (a link from
// elsewhere); workflow-service flags those runs interactive.
export function runPageIsNotebook(route, runs = []) {
  if (route?.query?.from === "notebooks") return true;
  if (route?.query?.from === "workflows") return false;
  const runId = route?.params?.runId;
  const run = runId && (runs || []).find((r) => r.uuid === runId);
  return !!run?.interactive;
}

// A compute node can host notebooks only if it has interactive sessions
// enabled, so non-interactive nodes are left out of the Notebooks-page node
// pickers.
export function interactiveCapable(cn) {
  return (
    (cn?.maxInteractiveSessions || 0) > 0 ||
    cn?.enableInteractive === true ||
    cn?.interactive === true
  );
}

// A notebook's language for people.
export function kernelLabel(kernel) {
  if (kernel === "python") return "Python";
  if (kernel === "r") return "R";
  return kernel || "";
}

// The kernels a notebook can start with here: active ones (an archived
// kernel's runs still count as notebooks, but it can't start new ones), and
// outside a workspace (My Workspace), where a run has no dataset to write
// to, not those whose results go to one.
export function launchableKernels(workflows = [], { personal = false } = {}) {
  return workflows.filter(
    (wf) => isNotebookWorkflow(wf) && wf.isActive !== false && !(personal && !wf.notebook.worksWithoutDataset)
  );
}

// Where a notebook's results go, in a few words, to tell same-language
// kernels apart.
const SAVES_TO = {
  download: "Results as a download",
  dataset: "Results saved to a dataset",
  none: "Results stay in the session",
};
export function kernelOutput(wf) {
  return SAVES_TO[wf?.notebook?.savesTo] || "";
}
