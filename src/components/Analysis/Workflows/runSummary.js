// What the run dialog's summary column says about the workflow being run:
// its steps (and whether any calls language models), its inputs by name
// with what they take, and its outputs with where they go. From the
// workflow's definition and its steps' app.yml (portsOfStep).
import { appNames, outputLabel } from "./workflowSummary";
import { sourceLabel, sourceHints, hintLine, portsOfStep } from "../WorkflowGraph/sourceInputs";

// Where an output goes, in a few words.
function outputWhere(node) {
  const params = node.defaultParams || {};
  if (node.targetType === "download") return "as a download";
  if (node.targetType === "persistent-layer") return "as an environment";
  const folder = String(params.TARGET_FOLDER || "").replace(/^\/+|\/+$/g, "");
  return folder ? `into ${folder}/` : "into the dataset";
}

export function runSummary(wf, applications = [], targetTypes = []) {
  const dag = wf?.dag || [];
  const portsOf = portsOfStep(dag, applications);
  const steps = dag.filter((n) => n.type !== "data-source" && n.type !== "data-target");
  return {
    name: wf?.name || "",
    version: wf?.latestVersion || null,
    apps: appNames(wf, applications),
    stepCount: steps.length,
    usesLLM: steps.some((n) => !!portsOf(n.id)?.runtime?.llm),
    inputs: dag
      .filter((n) => n.type === "data-source")
      .map((n) => ({ id: n.id, name: sourceLabel(n.id, dag), hint: hintLine(sourceHints(n.id, dag, portsOf)) })),
    outputs: dag
      .filter((n) => n.type === "data-target")
      .map((n) => ({ id: n.id, label: outputLabel(n.targetType, targetTypes) || "Output", where: outputWhere(n) })),
  };
}
