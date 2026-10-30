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
// A kernel with a notebook workflow that declares its input and output (whose
// input and results each session binds) is offered as that one only: the
// copies that differ only in where data comes from or goes are left out.
export function launchableKernels(workflows = [], { personal = false } = {}) {
  const usable = workflows.filter(
    (wf) => isNotebookWorkflow(wf) && wf.isActive !== false && !(personal && !wf.notebook.worksWithoutDataset)
  );
  const declares = (wf) => (wf.inputs?.length || 0) + (wf.outputs?.length || 0) > 0;
  const bound = new Set(usable.filter(declares).map(notebookKernel));
  return usable.filter((wf) => declares(wf) || !bound.has(notebookKernel(wf)));
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

// For a notebook that saves results to a dataset, the same-language kernel
// that doesn't (results as a download, or kept in the session): what someone
// who can only view the dataset can start instead. Null if there's none.
export function nonSavingAlternative(kernels = [], wf) {
  if (wf?.notebook?.savesTo !== "dataset") return null;
  const kernel = notebookKernel(wf);
  const others = kernels.filter((k) => k.uuid !== wf.uuid && notebookKernel(k) === kernel);
  return others.find((k) => k.notebook?.savesTo === "download") || others.find((k) => k.notebook?.savesTo === "none") || null;
}

/*
  CPU and GPU kernels (app variants, docs/app-variants.md section 6a). The
  session app has a cpu and a gpu variant, and Pennsieve publishes one
  official notebook workflow per kernel and variant; workflow-service marks
  each with notebook.variant and notebook.gpu. The wizard shows them as one
  kernel card with a Hardware toggle.
*/

// Whether a notebook workflow starts a GPU session.
export const notebookGpu = (wf) => wf?.notebook?.gpu === true;

// The session app a notebook workflow runs (its session step's sourceUrl),
// when the definition lists its steps; "" otherwise.
const sessionApp = (wf) => {
  const step = (wf?.dag || wf?.processors || []).find((d) => d.type === "processor" && d.sourceUrl);
  return String(step?.sourceUrl || "").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
};

// The kernel cards: [{ key, cpu, gpu }], each the CPU and GPU workflow of
// one kernel (either may be null), in the kernels' order. Workflows pair
// when they are variants (notebook.variant) of the same kernel, session app
// and results; one without variants is a card of its own (cpu).
export function kernelCards(kernels = []) {
  const cards = [];
  const byKey = new Map();
  for (const wf of kernels) {
    if (!wf?.notebook?.variant) {
      cards.push({ key: wf.uuid, cpu: wf, gpu: null });
      continue;
    }
    const io = (wf.inputs?.length || 0) + (wf.outputs?.length || 0) > 0 ? "interface" : wf.notebook.savesTo || "";
    const key = [notebookKernel(wf), sessionApp(wf), io].join("|");
    let card = byKey.get(key);
    if (!card) {
      card = { key, cpu: null, gpu: null };
      byKey.set(key, card);
      cards.push(card);
    }
    const side = notebookGpu(wf) ? "gpu" : "cpu";
    if (!card[side]) card[side] = wf;
  }
  return cards;
}

// The card a workflow is on.
export const cardOf = (cards, workflowId) =>
  (cards || []).find((c) => c.cpu?.uuid === workflowId || c.gpu?.uuid === workflowId) || null;

// Why a node can't host a GPU session, as short reasons, [] when it can: it
// has no GPUs; it is a basic-mode node (a GPU task gets no public address for
// the platform gateway, so v1 needs secure mode); its provisioner fails the
// variant gate (gateReason(node), variantGate.js). Nodes without notebook
// sessions aren't offered at all.
export function gpuSessionUnfit(node, gateReason = () => "") {
  const reasons = [];
  if (!((node?.maxGpuInstances || 0) > 0)) reasons.push("No GPUs");
  const mode = String(node?.deploymentMode || "basic").toLowerCase();
  if (mode !== "secure") reasons.push(mode === "compliant" ? "Compliant node" : "Basic-mode node: GPU notebooks need secure mode");
  const gate = gateReason(node);
  if (gate) reasons.push(gate);
  return reasons;
}

// Whether a run (as GET /runs/{id} returns it) runs its session on a GPU:
// a processor step whose execution target, compute type or stamped compute
// types say gpu.
export function runOnGpu(run) {
  const configs = run?.processorConfigs || run?.workflowInstanceConfiguration?.processorConfigs || [];
  return (run?.dag || []).some((d) => {
    if (d.type !== "processor") return false;
    const target = configs.find((c) => c.nodeId === d.id)?.executionTarget || d.computeType || d.runtimeConfig?.computeTypes?.[0];
    return target === "gpu";
  });
}
