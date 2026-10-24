// Undo and redo for the builder's graph. The graph is snapshotted as it
// settles (a short pause after any change); a snapshot differing from the
// last becomes a step back. Restoring a snapshot replaces nodes and edges.
//
// A snapshot keeps each node's position and a deep copy of its data (an
// app's record is shared, being read-only), and each edge's ends.
import { watch } from "vue";

const SETTLE_MS = 350;
const LIMIT = 100;

function cloneNode(n) {
  const { application, ...rest } = n.data || {};
  const data = JSON.parse(JSON.stringify(rest));
  if (application !== undefined) data.application = application;
  return { id: n.id, type: n.type, position: { x: n.position.x, y: n.position.y }, data };
}
const cloneEdge = (e) => ({ ...e, selected: false, style: e.style ? { ...e.style } : undefined });

export function snapshot(nodes, edges) {
  return { nodes: nodes.map(cloneNode), edges: edges.map(cloneEdge) };
}

// What makes two snapshots the same edit state: ids, types, rounded
// positions, data (without the app record and the ports read from it), and
// connections. Selection and Vue Flow's own bookkeeping don't count.
export function snapshotKey(s) {
  return JSON.stringify({
    n: s.nodes.map((n) => {
      // eslint-disable-next-line no-unused-vars
      const { application, manifestPorts, hasManifest, ...data } = n.data || {};
      return [n.id, n.type, Math.round(n.position.x), Math.round(n.position.y), data, application?.uuid];
    }),
    e: s.edges.map((e) => [e.source, e.target]),
  });
}

export function useGraphHistory({ nodes, edges, enabled = () => true, onRestore = () => {} }) {
  let past = [];
  let future = [];
  let current = null;
  let currentKey = "";
  let restoring = false;
  let timer = null;

  function record() {
    if (restoring || !enabled()) return;
    const s = snapshot(nodes.value, edges.value);
    const key = snapshotKey(s);
    if (key === currentKey) return;
    if (current) {
      past.push(current);
      if (past.length > LIMIT) past.shift();
    }
    future = [];
    current = s;
    currentKey = key;
  }

  watch([nodes, edges], () => {
    clearTimeout(timer);
    timer = setTimeout(record, SETTLE_MS);
  }, { deep: true });

  function restore(s) {
    restoring = true;
    current = s;
    currentKey = snapshotKey(s);
    const copy = snapshot(s.nodes, s.edges);
    nodes.value = copy.nodes;
    edges.value = copy.edges;
    onRestore();
    // The change the restore causes settles as the current snapshot.
    setTimeout(() => (restoring = false), SETTLE_MS + 50);
  }

  return {
    undo() {
      clearTimeout(timer);
      record();
      if (!past.length) return false;
      future.push(current);
      restore(past.pop());
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(current);
      restore(future.pop());
      return true;
    },
    // Forget the history: a workflow was loaded or a new one started.
    reset() {
      clearTimeout(timer);
      past = [];
      future = [];
      current = snapshot(nodes.value, edges.value);
      currentKey = snapshotKey(current);
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    record,
  };
}
