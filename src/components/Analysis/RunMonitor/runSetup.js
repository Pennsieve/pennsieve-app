// A run's setup on its configure page: which compute node and dataset it
// runs on. The page offers every node, with the ones that can't run this
// workflow greyed out and why, and starts from the node and dataset last used
// for the workflow here (or the one node that fits).
//
// Pure, but for the remembered choices (localStorage, guarded).
import { interactiveCapable } from "./notebookHelpers";
import { targetWritesToDataset } from "./dataTargets";
import { hasInterface, worksWithoutDataset } from "./workflowInterface";
import { provisionerGateReason } from "./variantGate";

// Why a node can't run a workflow, as short reasons ("Paused", "No LLM
// access"), [] when it can. steps: the workflow's DAG; manifestOf(stepId):
// the step's app.yml (or null); computeTypeOf(stepId): where the step will
// run (standard, lambda, gpu). With app variants: nonDefaultVariant(stepId)
// says a step runs a variant other than its version's default, which needs
// the node's provisioner to pass the gate ({ min, allowUnversioned },
// variantGate.js).
export function nodeUnfit(node, steps, manifestOf = () => null, computeTypeOf = () => "", { nonDefaultVariant = () => false, gate = null } = {}) {
  if (!node) return ["Unknown node"];
  const reasons = [];
  if (node.status && node.status !== "Enabled") reasons.push(node.status === "Paused" ? "Paused" : node.status);
  const apps = (steps || []).filter((s) => s.type === "processor");
  const llm = node.enableLLMAccess === true || node.enableLLMAccess === "true";
  if (!llm && apps.some((s) => manifestOf(s.id)?.runtime?.llm)) reasons.push("No LLM access");
  if (!interactiveCapable(node) && apps.some((s) => manifestOf(s.id)?.runtime?.interactive)) reasons.push("No notebook sessions");
  if (!((node.maxGpuInstances || 0) > 0) && apps.some((s) => computeTypeOf(s.id) === "gpu")) reasons.push("No GPU");
  if (node.deploymentMode === "compliant" && (steps || []).some((s) => computeTypeOf(s.id) === "lambda")) {
    reasons.push("Compliant nodes don't run Lambda steps");
  }
  if (gate && apps.some((s) => nonDefaultVariant(s.id))) {
    const why = provisionerGateReason(node, gate);
    if (why) reasons.push(why);
  }
  return reasons;
}

const key = (scope, workflowId) => `pennsieve.runSetup.${scope || "mine"}.${workflowId}`;

// The node and dataset last used for a workflow in a workspace (scope: its
// id, or "" for My Workspace), or {}.
export function rememberedSetup(scope, workflowId) {
  try {
    return JSON.parse(localStorage.getItem(key(scope, workflowId)) || "{}") || {};
  } catch {
    return {};
  }
}

export function rememberSetup(scope, workflowId, setup) {
  try {
    localStorage.setItem(key(scope, workflowId), JSON.stringify({ computeNodeId: setup.computeNodeId || "", datasetId: setup.datasetId || "" }));
  } catch {
    // not remembered; the next run starts without it
  }
}

// The node to start from: the one asked for (a rerun's), else the one last
// used if it still fits, else the only one that fits, else none.
export function defaultNode(requested, remembered, nodes, fits) {
  const usable = (id) => id && nodes.some((n) => n.uuid === id && fits(n));
  if (requested) return requested;
  if (usable(remembered)) return remembered;
  const fitting = nodes.filter(fits);
  return fitting.length === 1 ? fitting[0].uuid : "";
}

// Outside a workspace (My Workspace) a run has no dataset, so a workflow
// can't run there yet if it reads from one (inputs, data-source nodes) or must
// write to one: a data target that writes to a dataset, or, of a workflow with
// outputs, a required output that accepts only datasets. Downloads and
// reference data need none (as the compute node allows on a user's run).
// Where inputs can take public datasets' files (publicInputs: views-service
// is deployed), inputs need no dataset either.
export const needsDataset = (wf, { publicInputs = false } = {}) => {
  if (hasInterface(wf)) return (!publicInputs && (wf.inputs?.length || 0) > 0) || !worksWithoutDataset(wf.outputs);
  return (wf?.dag || []).some(
    (d) => (d.type === "data-source" && !publicInputs) || (d.type === "data-target" && targetWritesToDataset(d.targetType))
  );
};
