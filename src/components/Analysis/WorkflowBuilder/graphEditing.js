// Rules for editing the builder's graph: pure, on Vue Flow nodes and edges.
import { routedInputs } from "./inputPorts";

// Whether a connection from src to tgt may be made: not to itself, not into
// an input, not out of an output, and not twice (except into an app with an
// input point each, where each link goes to another input: linkAllowed).
export function canConnect(src, tgt, edges = []) {
  if (!src || !tgt || src.id === tgt.id) return false;
  if (tgt.type === "data-source" || src.type === "data-target") return false;
  if (routedInputs(tgt.data?.manifestPorts).length) return true;
  return !edges.some((e) => e.source === src.id && e.target === tgt.id);
}

// The step to select when moving from one with an arrow key: down to what
// it feeds, up to what feeds it, left and right to the nearest step at about
// the same height.
export function neighbourInDirection(nodes, edges, fromId, direction) {
  const from = nodes.find((n) => n.id === fromId);
  if (!from) return null;
  const byId = (id) => nodes.find((n) => n.id === id);
  const closestX = (list) =>
    list.sort((a, b) => Math.abs(a.position.x - from.position.x) - Math.abs(b.position.x - from.position.x))[0]?.id || null;
  if (direction === "down") return closestX(edges.filter((e) => e.source === fromId).map((e) => byId(e.target)).filter(Boolean));
  if (direction === "up") return closestX(edges.filter((e) => e.target === fromId).map((e) => byId(e.source)).filter(Boolean));
  const sameRow = nodes.filter((n) => n.id !== fromId && Math.abs(n.position.y - from.position.y) < 40);
  const side = direction === "left"
    ? sameRow.filter((n) => n.position.x < from.position.x).sort((a, b) => b.position.x - a.position.x)
    : sameRow.filter((n) => n.position.x > from.position.x).sort((a, b) => a.position.x - b.position.x);
  return side[0]?.id || null;
}
