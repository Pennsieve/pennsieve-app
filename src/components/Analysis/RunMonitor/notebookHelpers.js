// Shared helpers for the Notebooks tab + launcher. A "notebook" is a published
// workflow that hosts an interactive kernel; the kernel (python/r) is derived
// from the workflow. Kept tiny + isolated so the matching rule is easy to adjust
// as more notebook environments are published.

// Returns the kernel/session type for a workflow, or null if it isn't a
// notebook. Primary signal is the well-known name ("Jupyter Notebook" = Python);
// falls back to an interactive DAG node.
export function notebookKernel(wf) {
  const name = (wf?.name || "").toLowerCase();
  if (name.includes("jupyter") || name.includes("python notebook")) {
    return "jupyter";
  }
  if (name.includes("r notebook")) return "r";
  const node = (wf?.dag || []).find(
    (n) =>
      n?.runtimeConfig?.interactive ||
      n?.interactive ||
      n?.runtimeConfig?.sessionType ||
      n?.sessionType
  );
  if (!node) return null;
  return node.runtimeConfig?.sessionType || node.sessionType || "jupyter";
}

export function isNotebookWorkflow(wf) {
  return !!notebookKernel(wf);
}

// Human label for a kernel/session type ("jupyter" == Python today).
export function kernelLabel(sessionType) {
  if (!sessionType || sessionType === "jupyter" || sessionType === "python") {
    return "Python";
  }
  if (sessionType === "r") return "R";
  return sessionType;
}
