import { describe, it, expect } from "vitest";
import { COMPACT_BOX, layoutBox, recenter, overlaps } from "./graphDensity";

const DETAILED = { width: 280, height: 80, nodesep: 120, ranksep: 150 };
const node = (id, x, y) => ({ id, position: { x, y } });

describe("layoutBox", () => {
  it("is the compact box unless detailed", () => {
    expect(layoutBox(false, DETAILED)).toBe(COMPACT_BOX);
    expect(layoutBox(true, DETAILED)).toBe(DETAILED);
  });
});

describe("recenter", () => {
  it("keeps each node's centre when its box changes", () => {
    const [n] = recenter([node("a", 100, 200)], DETAILED, COMPACT_BOX);
    expect(n.position).toEqual({ x: 130, y: 220 });
    expect(n.position.x + COMPACT_BOX.width / 2).toBe(100 + DETAILED.width / 2);
    const [back] = recenter([n], COMPACT_BOX, DETAILED);
    expect(back.position).toEqual({ x: 100, y: 200 });
  });
});

describe("overlaps", () => {
  it("is true when two boxes come too close", () => {
    // 60px apart: closer than a detailed card (80px tall) plus the margin,
    // further than a compact one (40px).
    expect(overlaps([node("a", 0, 0), node("b", 0, 60)], DETAILED)).toBe(true);
    expect(overlaps([node("a", 0, 0), node("b", 0, 60)], COMPACT_BOX)).toBe(false);
    expect(overlaps([node("a", 0, 0), node("b", 400, 0)], DETAILED)).toBe(false);
  });
});
