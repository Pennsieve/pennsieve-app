import { describe, it, expect } from "vitest";
import { builderReadiness, readinessLabel, requiredUnset } from "./builderReadiness";

const src = { id: "s", type: "data-source", data: { label: "Input data" } };
const app = (extra = {}) => ({ id: "a", type: "default", data: { label: "spike", paramSchema: [], defaultParams: {}, ...extra } });
const tgt = (targetType = "pennsieve") => ({ id: "t", type: "data-target", data: { label: "Output", targetType } });
const chain = [
  { id: "e1", source: "s", target: "a" },
  { id: "e2", source: "a", target: "t" },
];

describe("builderReadiness", () => {
  it("is ready for a named, connected input → app → output", () => {
    const r = builderReadiness({ name: "EEG", nodes: [src, app(), tgt()], edges: chain });
    expect(r.ready).toBe(true);
    expect(readinessLabel(r)).toBe("Ready to save");
  });

  it("lists what blocks saving, per node", () => {
    const r = builderReadiness({ name: " ", nodes: [src, app(), tgt(null)], edges: [chain[0]] });
    expect(r.ready).toBe(false);
    expect(r.blocking.map((i) => i.id)).toEqual(["name", "unconnected:a", "unconnected:t", "target-type:t"]);
    expect(r.blocking[1].nodeId).toBe("a");
    expect(readinessLabel(r)).toBe("4 things to fix");
  });

  it("asks for an input, an app and an output on an empty canvas", () => {
    const r = builderReadiness({ name: "x", nodes: [], edges: [] });
    expect(r.blocking.map((i) => i.id)).toEqual(["apps", "source", "target"]);
  });

  it("warns, without blocking, about mismatched types and unset required parameters", () => {
    const a = app({ paramSchema: [{ name: "channel" }, { name: "threshold", defaultValue: "0.5" }, { name: "mode", required: true }], defaultParams: { mode: "fast" } });
    const r = builderReadiness({
      name: "EEG",
      nodes: [src, a, tgt()],
      edges: chain,
      edgeIssues: [{ id: "e2", source: "spike", target: "Output", targetId: "t" }],
    });
    expect(r.ready).toBe(true);
    expect(r.warnings.map((i) => i.id)).toEqual(["edge:e2", "param:a:channel"]);
    expect(readinessLabel(r)).toBe("Ready · 2 to check");
  });
});

describe("requiredUnset", () => {
  it("is the parameters with neither a default nor a value", () => {
    const n = app({ paramSchema: [{ name: "a" }, { name: "b", defaultValue: "1" }, { name: "c", required: false }], defaultParams: { c: "x" } });
    expect(requiredUnset(n)).toEqual(["a"]);
  });
});
