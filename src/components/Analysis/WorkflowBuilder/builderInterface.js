/*
  The builder's canvas and a workflow's interface (inputs and outputs,
  workflow-service). On the canvas an input is a data-source node and an
  output a data-target node, so linking, ports and checks work as they always
  have; these convert between that and the definition.

  - canvasDefinition: a workflow with an interface as the DAG the canvas
    draws: its inputs and outputs as source and target nodes, an output's port
    as its target's path prefix (so attachPorts draws the link from that port).
  - toInterfaceDefinition: the canvas's processors as a definition with
    inputs, outputs and steps; null when the canvas can't be one (an output
    not fed by exactly one step).

  Pure.
*/
import { hasInterface, withInterfaceNodes } from "../RunMonitor/workflowInterface";
import { targetWritesToDataset } from "../RunMonitor/dataTargets";
import { PREFIX_PARAMS } from "./outputPorts";

const prefixKey = (targetType) => (targetWritesToDataset(targetType) ? "PATH_PREFIX" : "pathPrefix");

export function canvasDefinition(wf) {
  if (!hasInterface(wf)) return wf;
  const expanded = withInterfaceNodes(wf);
  return {
    ...expanded,
    dag: expanded.dag.map((n) => {
      const port = n.output?.from?.output;
      if (!port || !n.targetType) return n;
      return { ...n, defaultParams: { ...(n.defaultParams || {}), [prefixKey(n.targetType)]: port } };
    }),
  };
}

// An id from a name, as an input's or output's id may be (it names folders
// on the compute node): letters, digits, '-' and '_'.
export const slugId = (name, fallback) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || fallback;

// Node ids the builder generates; an input or output saved with one gets an
// id from its name instead (input/<name>/ rather than input/node_17…/).
const GENERATED_ID = /^node_\d+_[a-z0-9]+$/;

// processors: the canvas as serialized (steps, source and target nodes).
// nameOf(id): the input's or output's name; routedPortsOf(stepId): the
// names of the step's routed outputs; extrasOf(id): { optional, accepts,
// required } set in its panel.
export function toInterfaceDefinition(processors, { nameOf, routedPortsOf = () => [], extrasOf = () => ({}) }) {
  const steps = processors.filter((p) => p.type !== "data-source" && p.type !== "data-target");
  const stepIds = new Set(steps.map((s) => s.id));
  const taken = new Set(stepIds);
  const ids = new Map();
  const idFor = (p) => {
    let id = GENERATED_ID.test(p.id) ? slugId(nameOf(p.id), p.type === "data-source" ? "input" : "output") : p.id;
    for (let i = 2; taken.has(id); i++) id = `${id.replace(/-\d+$/, "")}-${i}`;
    taken.add(id);
    ids.set(p.id, id);
    return id;
  };

  const inputs = [];
  const outputs = [];
  for (const p of processors) {
    if (p.type === "data-source") {
      inputs.push({
        id: idFor(p),
        name: nameOf(p.id),
        ...(extrasOf(p.id).optional && { optional: true }),
        ...(p.position && { position: p.position }),
      });
    } else if (p.type === "data-target") {
      const deps = p.dependsOn || [];
      if (deps.length !== 1 || !stepIds.has(deps[0])) return null;
      const step = deps[0];
      const params = { ...(p.defaultParams || {}) };
      let port = "";
      for (const key of PREFIX_PARAMS) {
        if (params[key] && routedPortsOf(step).includes(params[key])) {
          port = params[key];
          delete params[key];
        }
      }
      const extra = extrasOf(p.id);
      const accepts = extra.accepts?.length ? [...new Set([...(p.targetType ? [p.targetType] : []), ...extra.accepts])] : [];
      outputs.push({
        id: idFor(p),
        name: nameOf(p.id),
        from: { step, ...(port && { output: port }) },
        ...(accepts.length && { accepts }),
        ...(p.targetType && { default: { targetType: p.targetType, ...(Object.keys(params).length && { params }) } }),
        ...(extra.required && { required: true }),
        ...(p.position && { position: p.position }),
      });
    }
  }
  // Steps name inputs by their new ids.
  const rename = (id) => ids.get(id) || id;
  const renamed = steps.map((s) => ({
    ...s,
    dependsOn: (s.dependsOn || []).map(rename),
    ...(s.inputs && { inputs: s.inputs.map((l) => ({ ...l, from: rename(l.from) })) }),
  }));
  return { inputs, outputs, processors: renamed };
}
