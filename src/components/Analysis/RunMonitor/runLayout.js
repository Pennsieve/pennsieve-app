/*
  Where a run's graph puts its nodes. A run keeps the DAG workflow-service
  stored when it started, positions and all; the workflow's layout can be
  saved again later (in place on its latest version, in the workflow view),
  and its runs should look like the workflow does now.

  - savedLayoutOf: a workflow definition's saved positions by node id, its
    inputs and outputs included (as the source and target nodes a run has).
  - placeRunNodes: each run node at the workflow's saved position, else at
    the run's own, or auto-layout when that would place the graph badly.
  - workflowLayouts: the saved layouts fetched, per workflow, so moving
    between runs doesn't fetch them again; the builder forgets one it saves.
*/
const hasXY = (p) => !!p && typeof p.x === "number" && typeof p.y === "number";

// Whether two nodes' boxes, plus a small margin, overlap.
const overlaps = ([a, b], box, margin = 16) =>
  Math.abs(a.position.x - b.position.x) < box.width + margin &&
  Math.abs(a.position.y - b.position.y) < box.height + margin;

export const savedLayoutOf = (definition) => {
  if (!definition) return {};
  // A workflow with an interface (workflow-service) has its inputs and
  // outputs beside its steps; a run has them as source and target nodes.
  const dag = [
    ...(definition.inputs || []),
    ...(definition.dag || definition.processors || []),
    ...(definition.outputs || []),
  ];
  const layout = {};
  for (const n of dag) {
    if (n?.id && hasXY(n.position)) layout[n.id] = { x: n.position.x, y: n.position.y };
  }
  return layout;
};

// The share of a run's nodes the workflow's layout must place for it to be
// used; below it, the workflow changed too much since the run.
export const MIN_LAYOUT_SHARE = 2 / 3;

// dag: the run's nodes ({ id, position }); layout: savedLayoutOf the
// workflow, or null when it couldn't be read; box: the detailed node box.
// -> { positions: { id: {x, y} }, needsAutoLayout }. In order:
//   1. the workflow's layout, when it places most of the nodes; nodes it
//      lacks (steps since removed) keep the run's position, unless that's
//      missing or lands on another node;
//   2. the run's own positions, when every node has one;
//   3. auto-layout.
export function placeRunNodes(dag, layout, { box, minShare = MIN_LAYOUT_SHARE } = {}) {
  const nodes = (dag || []).filter((d) => d?.id);
  if (nodes.length === 0) return { positions: {}, needsAutoLayout: true };
  const own = (d) => (hasXY(d.position) ? { x: d.position.x, y: d.position.y } : null);

  const known = nodes.filter((d) => layout && hasXY(layout[d.id]));
  if (known.length > 0 && known.length / nodes.length >= minShare) {
    const positions = {};
    const extras = [];
    for (const d of nodes) {
      if (hasXY(layout[d.id])) positions[d.id] = { ...layout[d.id] };
      else {
        const p = own(d);
        if (!p) return { positions: {}, needsAutoLayout: true };
        positions[d.id] = p;
        extras.push(d.id);
      }
    }
    const at = (id) => ({ position: positions[id] });
    const clash = box && extras.some((e) => nodes.some((d) => d.id !== e && overlaps([at(e), at(d.id)], box)));
    return clash ? { positions: {}, needsAutoLayout: true } : { positions, needsAutoLayout: false };
  }

  if (nodes.every((d) => own(d))) {
    return { positions: Object.fromEntries(nodes.map((d) => [d.id, own(d)])), needsAutoLayout: false };
  }
  return { positions: {}, needsAutoLayout: true };
}

// get(uuid, fetchDefinition) -> a promise of the workflow's saved layout, or
// null when it can't be read (the run's own positions are used then). A
// failure isn't kept, so a later run tries again.
export function createLayoutCache({ ttlMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const entries = new Map();
  return {
    get(uuid, fetchDefinition) {
      if (!uuid) return Promise.resolve(null);
      const hit = entries.get(uuid);
      if (hit && now() - hit.at < ttlMs) return hit.promise;
      const promise = Promise.resolve()
        .then(() => fetchDefinition(uuid))
        .then(savedLayoutOf)
        .catch(() => {
          if (entries.get(uuid)?.promise === promise) entries.delete(uuid);
          return null;
        });
      entries.set(uuid, { promise, at: now() });
      return promise;
    },
    forget(uuid) {
      if (uuid) entries.delete(uuid);
      else entries.clear();
    },
  };
}

export const workflowLayouts = createLayoutCache();
