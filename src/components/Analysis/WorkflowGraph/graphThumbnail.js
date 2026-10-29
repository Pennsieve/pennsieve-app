// A workflow's graph as a thumbnail: the builder's auto-arrange (dagre, top
// to bottom, compact boxes), as plain boxes and edge lines for an SVG. No
// canvas, so a gallery of them stays cheap.
import dagre from "@dagrejs/dagre";
import { COMPACT_BOX } from "./graphDensity";

// A DAG node's kind, as the graph pages colour them.
export function nodeKind(node) {
  if (node?.type === "data-source") return "source";
  if (node?.type === "data-target") return "target";
  return "processor";
}

// The builder's strip colours (CompactFlowNode), and the tints of source and
// target cards.
export const KIND_COLOR = { source: "#6366f1", processor: "#E0912A", target: "#64748b" };
export const KIND_FILL = { source: "#eef2ff", processor: "#ffffff", target: "#f1f5f9" };

// An input's or output's pill, as on the graph pages.
export const PILL_BOX = { width: 200, height: 44 };

// { width, height, nodes: [{ id, kind, x, y, w, h }], edges: [{ points }] }
// for a definition's dag (nodes with dependsOn), or null when it has none.
export function thumbnailLayout(dag) {
  const nodes = (dag || []).filter((n) => n && n.id);
  if (!nodes.length) return null;
  const box = COMPACT_BOX;
  // Inputs and outputs are pills (IoPill), at their size.
  const sizeOf = (n) => (nodeKind(n) === "processor" ? box : PILL_BOX);
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: box.nodesep, ranksep: box.ranksep, marginx: 0, marginy: 0 });
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) g.setNode(n.id, { width: sizeOf(n).width, height: sizeOf(n).height });
  for (const n of nodes) {
    for (const dep of n.dependsOn || []) if (ids.has(dep)) g.setEdge(dep, n.id);
  }
  dagre.layout(g);
  const graph = g.graph();
  return {
    width: graph.width || box.width,
    height: graph.height || box.height,
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      const { width: w, height: h } = sizeOf(n);
      return { id: n.id, kind: nodeKind(n), x: p.x - w / 2, y: p.y - h / 2, w, h };
    }),
    edges: g.edges().map((e) => ({ id: `${e.v}->${e.w}`, points: g.edge(e).points || [] })),
  };
}
