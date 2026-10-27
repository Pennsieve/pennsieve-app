/*
  A workflow's interface (workflow-service): where data enters (inputs) and
  leaves (outputs), which each run binds to data and destinations. A workflow
  declaring one keeps only steps in its DAG; withInterfaceNodes shows it as
  the source and target nodes a run of it has (workflow-service expands it
  the same way), so the configure page and graph handle both kinds. A
  workflow without one has its source and target nodes in its DAG already.
*/
import { targetWritesToDataset } from "./dataTargets";

// No destination: the run still makes the output, but doesn't save it.
export const NO_DESTINATION = "none";

export const hasInterface = (wf) => (wf?.inputs?.length || 0) + (wf?.outputs?.length || 0) > 0;

// The DAG with a source node per input and a target node per output (of its
// default destination, else the first it accepts), each carrying the input
// or output it stands for. Unchanged for a workflow without an interface.
export const withInterfaceNodes = (wf) => {
  if (!hasInterface(wf)) return wf;
  const steps = wf.dag || [];
  const sources = (wf.inputs || []).map((input) => ({
    id: input.id,
    type: "data-source",
    name: input.name,
    dependsOn: [],
    ...(input.position && { position: input.position }),
    input,
  }));
  const targets = (wf.outputs || []).map((output) => ({
    id: output.id,
    type: "data-target",
    name: output.name,
    targetType: output.default?.targetType || output.accepts?.[0] || "",
    dependsOn: [output.from?.step].filter(Boolean),
    defaultParams: output.default?.params || {},
    ...(output.position && { position: output.position }),
    output,
  }));
  return { ...wf, dag: [...sources, ...steps, ...targets] };
};

// The destinations a run may bind an output to here: the target types it
// accepts (any the registry has, when it names none), outside a workspace
// only those that don't write to a dataset, and no destination unless it's
// required.
export const destinationChoices = (output, { targetTypes = [], myWorkspace = false } = {}) => {
  const accepted = output?.accepts?.length ? output.accepts : targetTypes.map((t) => t.targetType);
  const choices = accepted.filter((t) => !(myWorkspace && targetWritesToDataset(t)));
  return output?.required ? choices : [...choices, NO_DESTINATION];
};

// Whether a run outside a workspace can bind every output it must (as
// workflow-service's WorksWithoutDataset).
export const worksWithoutDataset = (outputs = []) =>
  outputs.every((o) => !o.required || !o.accepts?.length || o.accepts.some((t) => !targetWritesToDataset(t)));

// A workflow's DAG with its inputs and outputs as source and target nodes, for
// anything that reads where its data comes from and goes (summaries, filters,
// thumbnails).
export const interfaceDag = (wf) => withInterfaceNodes(wf)?.dag || [];
