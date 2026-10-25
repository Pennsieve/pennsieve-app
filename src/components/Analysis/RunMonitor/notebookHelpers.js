// Shared helpers for the Notebooks tab + launcher. A "notebook" is a published
// workflow that hosts an interactive kernel; the kernel (python/r) is derived
// from the workflow. Kept tiny + isolated so the matching rule is easy to adjust
// as more notebook environments are published.
import { targetWritesToDataset } from "./dataTargets";

// Returns the kernel/session type for a workflow, or null if it isn't a
// notebook. The authoritative signal is an interactive node's declared
// sessionType (e.g. "r"); we fall back to the workflow name when the listing
// doesn't expose nodes. Definitions may carry either `dag` or `processors`.
export function notebookKernel(wf) {
  const nodes = wf?.dag || wf?.processors || [];
  const node = nodes.find(
    (n) =>
      n?.runtimeConfig?.interactive ||
      n?.interactive ||
      n?.runtimeConfig?.sessionType ||
      n?.sessionType
  );
  const sessionType = node && (node.runtimeConfig?.sessionType || node.sessionType);
  if (sessionType) return sessionType === "python" ? "jupyter" : sessionType;

  // Name fallback (separators normalized so "r-notebook", "R Session", and
  // "Pennsieve R Session" all match).
  const name = (wf?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (isRetiredEnvironmentBuilder(wf)) return null;
  if (name.includes("jupyter")) return "jupyter";
  // Standardized notebook names are "Pennsieve - <Language> Notebook - <version>";
  // require the notebook/session qualifier so a workflow that merely mentions a
  // language isn't mistaken for a kernel (mirrors the R branch).
  if (name.includes("python") && (name.includes("notebook") || name.includes("session"))) {
    return "jupyter";
  }
  if (/\br\b/.test(name) && (name.includes("notebook") || name.includes("session"))) {
    return "r";
  }
  // An interactive node with no explicit sessionType defaults to Python/Jupyter.
  if (node) return "jupyter";
  return null;
}

// The old "Pennsieve - Build Python/R Environment" workflows, retired now that
// environments come from environments-service. They may still be published,
// and their names mention a language, so they must not pass for notebooks.
export function isRetiredEnvironmentBuilder(wf) {
  const name = (wf?.name || "").toLowerCase();
  return name.includes("build") || name.includes("environment");
}

export function isNotebookWorkflow(wf) {
  return !!notebookKernel(wf);
}

// Whether a run page (run-detail) belongs under the Notebooks tab rather than
// Workflows: the tab it was opened from (?from=notebooks|workflows), else
// whether it's a notebook's run among those loaded (a link from elsewhere).
export function runPageIsNotebook(route, runs = []) {
  if (route?.query?.from === "notebooks") return true;
  if (route?.query?.from === "workflows") return false;
  const runId = route?.params?.runId;
  const run = runId && (runs || []).find((r) => r.uuid === runId);
  return !!run && isNotebookWorkflow({ name: run.workflowName });
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

// Human label for a kernel/session type ("jupyter" == Python today).
export function kernelLabel(sessionType) {
  if (!sessionType || sessionType === "jupyter" || sessionType === "python") {
    return "Python";
  }
  if (sessionType === "r") return "R";
  return sessionType;
}

// The kernels a notebook can start with here: active ones (an archived
// kernel's runs still count as notebooks, but it can't start new ones), and
// outside a workspace (My Workspace), where a run has no dataset to write
// to, not those whose results go to one.
export function launchableKernels(workflows = [], { personal = false } = {}) {
  return workflows.filter(
    (wf) =>
      wf?.isActive !== false &&
      !(personal && (wf?.dag || []).some((d) => d.type === "data-target" && targetWritesToDataset(d.targetType)))
  );
}

// Where a kernel's results go, in a word, to tell same-language kernels apart.
export function kernelOutput(wf) {
  const targets = (wf?.dag || []).filter((d) => d.type === "data-target").map((d) => d.targetType);
  if (!targets.length) return "";
  if (targets.every((t) => t === "download")) return "Results as a download";
  if (targets.some((t) => targetWritesToDataset(t))) return "Results saved to a dataset";
  return "";
}
