// Shared helpers for the Notebooks tab + launcher. A "notebook" is a published
// workflow that hosts an interactive kernel; the kernel (python/r) is derived
// from the workflow. Kept tiny + isolated so the matching rule is easy to adjust
// as more notebook environments are published.

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
  if (name.includes("jupyter") || name.includes("python")) return "jupyter";
  if (/\br\b/.test(name) && (name.includes("notebook") || name.includes("session"))) {
    return "r";
  }
  // An interactive node with no explicit sessionType defaults to Python/Jupyter.
  if (node) return "jupyter";
  return null;
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
