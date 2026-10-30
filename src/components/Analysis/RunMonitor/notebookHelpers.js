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

/*
  Variants per run. workflow-service lists, on a notebook whose session app
  version has variants, the variants a run can pick (notebook.variants:
  [{ id, name, description, default, gpu, computeTypes, cpu, memory }]),
  and takes the pick as the session step's processorConfigs variant. One
  workflow per kernel then serves CPU and GPU: the wizard shows a Hardware
  choice on its card instead of pairing twin workflows. Older
  workflow-services don't list them, and the twins pair as before.
*/

// The variants a run of a notebook workflow can pick, when there's a choice
// (two or more); [] otherwise.
export function runVariants(wf) {
  const variants = wf?.notebook?.variants || [];
  return variants.length > 1 ? variants : [];
}

// Whether a notebook workflow offers its variants per run.
export const offersRunVariants = (wf) => runVariants(wf).length > 0;

// The variant a run of wf picks unless the user picks another: the one the
// workflow runs (notebook.variant), else the version's default, else the
// first. "" when it offers none.
export function defaultRunVariant(wf) {
  const variants = runVariants(wf);
  if (!variants.length) return "";
  const own = wf.notebook.variant;
  if (own && variants.some((v) => v.id === own)) return own;
  return (variants.find((v) => v.default) || variants[0]).id;
}

// A variant's name for people: its name, else its id.
export const variantLabel = (v) => v?.name || v?.id || "";

// Whether a variant sets the session's resources itself (a GPU one runs on
// the GPU instance's; one whose app.yml declares cpu or memory), so the
// wizard asks for no CPU and memory.
export const variantSetsResources = (v) => !!v && (v.gpu === true || (v.cpu || 0) > 0 || (v.memory || 0) > 0);

// A variant's declared resources in a few words ("4 vCPU · 14 GB"), or "".
export function variantResources(v) {
  const parts = [];
  if ((v?.cpu || 0) > 0) parts.push(`${+(v.cpu / 1024).toFixed(2)} vCPU`);
  if ((v?.memory || 0) > 0) parts.push(`${+(v.memory / 1024).toFixed(1)} GB`);
  return parts.join(" · ");
}

// Why a node can't run a session on variant v, as short reasons, [] when it
// can: a GPU variant needs what gpuSessionUnfit says; another non-default
// variant only a provisioner that passes the variant gate (gateReason); the
// default runs anywhere notebooks do.
export function variantNodeUnfit(node, v, gateReason = () => "") {
  if (!v) return [];
  if (v.gpu) return gpuSessionUnfit(node, gateReason);
  if (v.default) return [];
  const gate = gateReason(node);
  return gate ? [gate] : [];
}

// The id of a workflow definition's session step (the one that takes the
// run's variant): its interactive step, else its first processor; "" when
// it has none.
export function sessionStepId(dag = []) {
  const steps = (dag || []).filter((d) => d.type === "processor");
  const live = steps.find((d) => d.runtimeConfig?.interactive || d.runtimeConfig?.sessionType || d.interactive);
  return (live || steps[0])?.id || "";
}

// The kernel cards: [{ key, cpu, gpu, perRun, twins }], in the kernels'
// order.
// - A card of a workflow that offers its variants per run (perRun) is that
//   workflow alone (cpu: it, gpu: null). Its twins, the same kernel's
//   workflows of the same session app and results that pin one variant
//   each (the GPU workflow published before variants per run), are left
//   out: their uuids are in twins, so a link to one still finds the card.
//   Of several such workflows, the one that runs the default variant is
//   preferred.
// - Otherwise each card holds the CPU and GPU workflow of one kernel
//   (either may be null). Workflows pair when they are variants
//   (notebook.variant) of the same kernel, session app and results; one
//   without variants is a card of its own (cpu).
export function kernelCards(kernels = []) {
  const cards = [];
  const byKey = new Map();
  for (const wf of kernels) {
    if (!wf?.notebook?.variant) {
      cards.push({ key: wf.uuid, cpu: wf, gpu: null, perRun: null, twins: [] });
      continue;
    }
    const io = (wf.inputs?.length || 0) + (wf.outputs?.length || 0) > 0 ? "interface" : wf.notebook.savesTo || "";
    const key = [notebookKernel(wf), sessionApp(wf), io].join("|");
    let card = byKey.get(key);
    if (!card) {
      card = { key, cpu: null, gpu: null, members: [] };
      byKey.set(key, card);
      cards.push(card);
    }
    card.members.push(wf);
  }
  return cards.map((card) => {
    if (!card.members) return card;
    const { members, ...rest } = card;
    const perRun = members.filter(offersRunVariants);
    if (perRun.length) {
      const runsDefault = (wf) => runVariants(wf).find((v) => v.id === wf.notebook.variant)?.default === true;
      const pick = perRun.find(runsDefault) || perRun[0];
      return { ...rest, cpu: pick, gpu: null, perRun: pick, twins: members.filter((wf) => wf !== pick).map((wf) => wf.uuid) };
    }
    const out = { ...rest, perRun: null, twins: [] };
    for (const wf of members) {
      const side = notebookGpu(wf) ? "gpu" : "cpu";
      if (!out[side]) out[side] = wf;
    }
    return out;
  });
}

// The card a workflow is on (also a twin a per-run card stands for).
export const cardOf = (cards, workflowId) =>
  (cards || []).find(
    (c) => c.cpu?.uuid === workflowId || c.gpu?.uuid === workflowId || (c.twins || []).includes(workflowId)
  ) || null;

// What starting workflowId (a link's ?start=) selects: { workflowId,
// variant } — a twin a per-run card stands for selects that card's
// workflow with the twin's variant; any other workflow itself, with its
// default run variant. null when no card has it.
export function cardSelection(cards, workflowId, kernels = []) {
  const card = cardOf(cards, workflowId);
  if (!card) return null;
  if (card.perRun && card.perRun.uuid !== workflowId) {
    const twin = (kernels || []).find((k) => k.uuid === workflowId);
    const variant = twin?.notebook?.variant;
    const offered = runVariants(card.perRun).some((v) => v.id === variant);
    return { workflowId: card.perRun.uuid, variant: offered ? variant : defaultRunVariant(card.perRun) };
  }
  const wf = card.perRun || [card.cpu, card.gpu].find((w) => w?.uuid === workflowId);
  return { workflowId, variant: defaultRunVariant(wf) };
}

// Why a node can't host a GPU notebook, as short reasons, [] when it can:
// - it has no GPUs;
// - it is a basic-mode node. GPU sessions run as EC2 tasks on the node's GPU
//   instances, and ECS can't give such a task its own public IP, which the
//   basic-mode gateway connects to. Secure and compliant nodes reach
//   sessions through the node's private session proxy, GPU ones too
//   (workflow-service WFS-5 and the provisioner PROV-2 refuse basic only);
// - its provisioner fails the variant gate (gateReason(node),
//   variantGate.js).
// Only notebooks: GPU workflow steps run on any node with GPU instances.
// Nodes without notebook sessions aren't offered at all.
export const BASIC_GPU_REASON = "Basic mode: GPU notebooks need a secure or compliant node";
export const BASIC_GPU_NOTE =
  "GPU sessions run on the node's GPU instances, which the basic-mode gateway can't reach. CPU notebooks and GPU workflow steps work on this node.";
export function gpuSessionUnfit(node, gateReason = () => "") {
  const reasons = [];
  if (!((node?.maxGpuInstances || 0) > 0)) reasons.push("No GPUs");
  const mode = String(node?.deploymentMode || "basic").toLowerCase();
  if (mode === "basic") reasons.push(BASIC_GPU_REASON);
  const gate = gateReason(node);
  if (gate) reasons.push(gate);
  return reasons;
}

// The longer note behind a reason, where there is one (the basic-mode one).
export const gpuReasonNote = (reasons) => ((reasons || []).includes(BASIC_GPU_REASON) ? BASIC_GPU_NOTE : "");

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
