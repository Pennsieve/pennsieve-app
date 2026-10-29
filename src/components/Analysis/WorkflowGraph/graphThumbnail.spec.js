import { describe, it, expect } from "vitest";
import { nodeKind, thumbnailLayout } from "./graphThumbnail";

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
    expect(l.edges.every((e) => e.points.length >= 2)).toBe(true);
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
});
