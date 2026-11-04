import { describe, it, expect } from "vitest";
import { nodeKind, thumbnailLayout, edgePath } from "./graphThumbnail";

const dag = [
  { id: "s1", type: "data-source", dependsOn: [] },
  { id: "s2", type: "data-source", dependsOn: [] },
  { id: "p1", type: "processor", dependsOn: ["s1", "s2"] },
  { id: "t1", type: "data-target", dependsOn: ["p1", "missing"] },
];

describe("thumbnailLayout", () => {
  it("lays the graph out top to bottom", () => {
    const l = thumbnailLayout(dag);
    const y = Object.fromEntries(l.nodes.map((n) => [n.id, n.y]));
    expect(y.s1).toBe(y.s2);
    expect(y.p1).toBeGreaterThan(y.s1);
    expect(y.t1).toBeGreaterThan(y.p1);
    expect(l.edges.map((e) => e.id).sort()).toEqual(["p1->t1", "s1->p1", "s2->p1"]);
    expect(l.edges.every((e) => e.points.length === 2)).toBe(true);
    // Each line runs from its source's bottom centre to its target's top centre.
    const at = Object.fromEntries(l.nodes.map((n) => [n.id, n]));
    for (const e of l.edges) {
      const [v, w] = e.id.split("->");
      expect(e.points[0]).toEqual({ x: at[v].x + at[v].w / 2, y: at[v].y + at[v].h });
      expect(e.points[1]).toEqual({ x: at[w].x + at[w].w / 2, y: at[w].y });
    }
    expect(l.width).toBeGreaterThan(0);
    expect(l.nodes.find((n) => n.id === "t1").kind).toBe("target");
    // Inputs and outputs at the pill's size, steps at the card's
    expect(l.nodes.find((n) => n.id === "s1")).toMatchObject({ w: 200, h: 44 });
    expect(l.nodes.find((n) => n.id === "p1")).toMatchObject({ w: 220, h: 40 });
  });

  it("has nothing to draw without nodes", () => {
    expect(thumbnailLayout([])).toBeNull();
    expect(thumbnailLayout(undefined)).toBeNull();
  });

  it("names the kinds as the graph pages do", () => {
    expect(nodeKind({ type: "data-source" })).toBe("source");
    expect(nodeKind({ type: "processor" })).toBe("processor");
    expect(nodeKind({})).toBe("processor");
  });

  it("draws an edge as a vertical S-curve between its two points", () => {
    expect(edgePath([{ x: 10, y: 20 }, { x: 50, y: 120 }])).toBe("M10,20 C10,70 50,70 50,120");
    // Close points still bend a little.
    expect(edgePath([{ x: 0, y: 0 }, { x: 0, y: 10 }])).toBe("M0,0 C0,12 0,-2 0,10");
    expect(edgePath([])).toBe("");
  });
});
