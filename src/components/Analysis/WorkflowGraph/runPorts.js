// A run's graph with its ports (the detailed view): each link drawn from
// the output it leaves to the input it feeds, as the builder draws it, so
// two links between the same steps are two lines. The compact view keeps one
// line per dependency.
//
// Pure: on the run's DAG and each step's app.yml ports.

import { edgesForStep, attachInputPorts, inputOfHandle, routedInputs } from "../WorkflowBuilder/inputPorts";
import { attachPorts, portOfHandle, routedOutputs } from "../WorkflowBuilder/outputPorts";

// The edges of a run's steps on their ports. nodes are the graph's nodes,
// with data.manifestPorts on app steps and data.defaultParams (the target's
// params, for its path prefix) on targets; style(sourceId) colours a line.
// Edges whose ports aren't known stay on the steps' main points.
export function portEdges(dag, nodes, style) {
  const edges = (dag || []).flatMap((step) =>
    edgesForStep(step, ({ source, target, data }) => ({
      id: `e${source}-${target}`,
      source,
      target,
      sourceHandle: "source",
      targetHandle: "target",
      ...(data && { data }),
      animated: false,
      style: style(source),
    }))
  );
  const placed = attachInputPorts(attachPorts(edges, nodes), nodes);
  // Two links between the same steps whose ports aren't known share an id
  // until placed; keep each line its own.
  const seen = new Map();
  return placed.map((e) => {
    const n = seen.get(e.id) || 0;
    seen.set(e.id, n + 1);
    return n ? { ...e, id: `${e.id}#${n}` } : e;
  });
}

// A step's connection points on one side ("in" or "out"): one per routed
// port, then the main point ("all inputs" / "all outputs") when a line uses
// it or the step has no routed ports. Each with the share of the card's
// width it sits at the middle of.
export function stepPoints(nodeId, manifestPorts, edges, side) {
  const routed = side === "in" ? routedInputs(manifestPorts) : routedOutputs(manifestPorts);
  const usesMain = (edges || []).some((e) =>
    side === "in"
      ? e.target === nodeId && !inputOfHandle(e.targetHandle)
      : e.source === nodeId && !portOfHandle(e.sourceHandle)
  );
  const points = routed.map((p) => ({ name: p.name, port: p }));
  if (usesMain || !routed.length) points.push({ name: "", port: null });
  return points.map((p, i) => ({ ...p, at: (i + 0.5) / points.length }));
}
