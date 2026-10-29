// Input ports: a link from one step to a named input of another (ports,
// phase 2). An app with two or more declared inputs gets a connection point
// per input on the canvas, beside its "all inputs" point; an app with one
// declared input takes every plain link as a link to that input. A link is
// saved on the step as inputs: [{ from, output, input }] next to dependsOn,
// and at run start workflow-service puts each link's files where the input's
// placement says (INPUT_DIR/<input>/ or the root of INPUT_DIR), taking only
// the output's folder when the link leaves an output port. A plain link into
// "all inputs" takes its source whole, at the root, as before.
//
// Pure: on Vue Flow nodes and edges and app.yml ports.

import { portOfHandle, portHandleId, routedOutputs } from "./outputPorts";

const HANDLE_PREFIX = "in:";

const namedInputs = (manifestPorts) => (manifestPorts?.inputs || []).filter((p) => p?.name);

// The inputs a step takes one by one: two or more declared inputs.
export function routedInputs(manifestPorts) {
  const inputs = namedInputs(manifestPorts);
  return inputs.length >= 2 ? inputs : [];
}

// The input every plain link into a step feeds: its only declared input.
export function soleInput(manifestPorts) {
  const inputs = namedInputs(manifestPorts);
  return inputs.length === 1 ? inputs[0].name : "";
}

export const inputHandleId = (name) => `${HANDLE_PREFIX}${name}`;

// The input a link arrives at, or "" for the step's "all inputs" point.
export const inputOfHandle = (handle) =>
  typeof handle === "string" && handle.startsWith(HANDLE_PREFIX) ? handle.slice(HANDLE_PREFIX.length) : "";

// An edge's id: one per pair of steps, or per pair of points when a link
// uses ports, so two outputs of one step can feed two inputs of another.
export function edgeId(source, target, sourceHandle, targetHandle) {
  const out = portOfHandle(sourceHandle);
  const input = inputOfHandle(targetHandle);
  return out || input ? `e${source}:${out}-${target}:${input}` : `e${source}-${target}`;
}

// Whether a link may be drawn between these points: not the same one twice,
// and an input takes one link. An output port goes to a data target or to
// an input of an app, not to its "all inputs" point.
export function linkAllowed(src, tgt, sourceHandle, targetHandle, edges = []) {
  const input = inputOfHandle(targetHandle);
  if (input && !routedInputs(tgt?.data?.manifestPorts).some((p) => p.name === input)) {
    return { ok: false, reason: "unknown-input" };
  }
  if (input && edges.some((e) => e.target === tgt.id && inputOfHandle(e.targetHandle) === input)) {
    return { ok: false, reason: "input-taken" };
  }
  const out = portOfHandle(sourceHandle);
  if (out && tgt?.type === "default" && !input && routedInputs(tgt?.data?.manifestPorts).length) {
    return { ok: false, reason: "port-to-all" };
  }
  // A step's links into another are all to its inputs or all plain: once a
  // step links to an input, the run takes only what its links say from it.
  const isLink = (e) => !!(inputOfHandle(e.targetHandle) || e.data?.input);
  const between = edges.filter((e) => e.source === src.id && e.target === tgt.id);
  if (between.some((e) => isLink(e) !== !!input)) return { ok: false, reason: "mixed" };
  const same = edges.some(
    (e) =>
      e.source === src.id &&
      e.target === tgt.id &&
      (portOfHandle(e.sourceHandle) || "") === (out || "") &&
      (inputOfHandle(e.targetHandle) || e.data?.input || "") === (input || "")
  );
  return same ? { ok: false, reason: "duplicate" } : { ok: true };
}

// The link an edge makes, for saving: the input it feeds and the output it
// leaves from. The handles say so once the manifests are in; before that,
// what the edge was loaded with (edge.data). A plain link into a step with
// one declared input feeds that input when it's the step's only plain link.
export function linkOfEdge(edge, target, plainLinksIn = 1) {
  const input =
    inputOfHandle(edge.targetHandle) ||
    edge.data?.input ||
    (plainLinksIn === 1 ? soleInput(target?.data?.manifestPorts) : "");
  if (!input) return null;
  const output = portOfHandle(edge.sourceHandle) || edge.data?.output || "";
  return output ? { from: edge.source, output, input } : { from: edge.source, input };
}

const plainLinksInto = (nodeId, edges) =>
  edges.filter((e) => e.target === nodeId && !inputOfHandle(e.targetHandle) && !e.data?.input).length;

// A step's links, for saving (an app step's inputs field), from the edges
// into it. Steps that aren't apps have none.
export function linksOf(node, edges) {
  if (node?.type !== "default") return [];
  const plain = plainLinksInto(node.id, edges);
  return edges.filter((e) => e.target === node.id).map((e) => linkOfEdge(e, node, plain)).filter(Boolean);
}

// The link one edge makes into an app step, or null for a plain one.
export function edgeLink(edge, target, edges) {
  if (target?.type !== "default") return null;
  return linkOfEdge(edge, target, plainLinksInto(target.id, edges));
}

// What a link joins: the output(s) it takes and the input it feeds, from the
// two apps' ports; null when the input isn't declared (nothing to compare).
export function linkPorts(link, sourcePorts, targetPorts) {
  const input = (targetPorts?.inputs || []).find((p) => p.name === link?.input);
  if (!input) return null;
  const outputs = (sourcePorts?.outputs || []).filter((p) => !link.output || p.name === link.output);
  return { outputs, input };
}

// The edges a saved step's links and dependencies draw: one per link, with
// the link kept on the edge until the manifests place it on its points
// (attachInputPorts), and one per dependency without a link.
export function edgesForStep(step, makeEdge) {
  const links = Array.isArray(step.inputs) ? step.inputs : [];
  const edges = links.map((l) =>
    makeEdge({ source: l.from, target: step.id, data: { input: l.input, ...(l.output && { output: l.output }) } })
  );
  const linked = new Set(links.map((l) => l.from));
  for (const dep of step.dependsOn || []) {
    if (!linked.has(dep)) edges.push(makeEdge({ source: dep, target: step.id }));
  }
  return edges;
}

// Edges on the points their links name, once manifests are in: an input with
// its own point, an output with its own port. Unchanged edges are returned
// as they were.
export function attachInputPorts(edges, nodes) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  return (edges || []).map((e) => {
    if (!e.data?.input && !e.data?.output) return e;
    const tgt = byId.get(e.target);
    const src = byId.get(e.source);
    let next = e;
    if (e.data.input && !inputOfHandle(e.targetHandle) && routedInputs(tgt?.data?.manifestPorts).some((p) => p.name === e.data.input)) {
      next = { ...next, targetHandle: inputHandleId(e.data.input) };
    }
    if (e.data.output && !portOfHandle(e.sourceHandle) && routedOutputs(src?.data?.manifestPorts).some((p) => p.name === e.data.output)) {
      next = { ...next, sourceHandle: portHandleId(e.data.output) };
    }
    if (next === e) return e;
    return { ...next, id: edgeId(next.source, next.target, next.sourceHandle, next.targetHandle) };
  });
}

// A workflow's links as comparable strings: "from:output>step:input" per
// link and "dep>step" per dependency without one.
export function linkKeys(steps) {
  return (steps || []).flatMap((s) => {
    const links = Array.isArray(s.inputs) ? s.inputs : [];
    const linked = new Set(links.map((l) => l.from));
    return [
      ...links.map((l) => `${l.from}:${l.output || ""}>${s.id}:${l.input}`),
      ...(s.dependsOn || []).filter((d) => !linked.has(d)).map((d) => `${d}>${s.id}`),
    ];
  });
}
