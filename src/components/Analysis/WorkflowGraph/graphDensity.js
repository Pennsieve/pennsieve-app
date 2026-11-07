// Workflow graphs (the run page and the workflow builder) show their nodes
// compact, one line each, or detailed. The choice is the viewer's, shared by
// both pages and kept in this browser.
import { ref } from "vue";

const STORAGE_KEY = "pennsieve.workflowGraph.detailed";

// The box each node takes in a layout, and the gaps dagre leaves between
// them. Compact nodes are all the same size.
export const COMPACT_BOX = { width: 220, height: 40, nodesep: 60, ranksep: 70 };

export function layoutBox(detailed, detailedBox) {
  return detailed ? detailedBox : COMPACT_BOX;
}

function storedDetailed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// One ref for every graph on the page, so the two pages agree.
const detailed = ref(storedDetailed());

export function useGraphDensity() {
  function setDetailed(value) {
    detailed.value = value;
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // not remembered; the choice still applies to this page
    }
  }
  return { detailed, setDetailed };
}

// Moves each node so its centre stays put when its box changes size: a
// switch between compact and detailed keeps the graph's arrangement,
// including one the user dragged by hand.
export function recenter(nodes, from, to) {
  const dx = (from.width - to.width) / 2;
  const dy = (from.height - to.height) / 2;
  return nodes.map((n) => ({
    ...n,
    position: { x: n.position.x + dx, y: n.position.y + dy },
  }));
}

// Whether any two nodes' boxes, plus a small margin, overlap: after growing
// to detailed, the graph is laid out again only if they do.
export function overlaps(nodes, box, margin = 16) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].position;
      const b = nodes[j].position;
      if (
        Math.abs(a.x - b.x) < box.width + margin &&
        Math.abs(a.y - b.y) < box.height + margin
      ) {
        return true;
      }
    }
  }
  return false;
}
