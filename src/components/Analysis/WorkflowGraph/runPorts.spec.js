import { describe, it, expect } from "vitest";
import { portEdges, stepPoints } from "./runPorts";

// The e2e workflow: two sources into A's two inputs, A's two outputs into
// B's two inputs, A's summary into the probe, B's summary to a download.
const ports = {
  inputs: [{ name: "signals" }, { name: "events" }],
  outputs: [{ name: "summary" }, { name: "copies" }],
};
const dag = [
  { id: "signals", type: "data-source", dependsOn: [] },
  { id: "events", type: "data-source", dependsOn: [] },
  {
    id: "a",
    type: "processor",
    dependsOn: ["signals", "events"],
    inputs: [
      { from: "signals", input: "signals" },
      { from: "events", input: "events" },
    ],
  },
  {
    id: "b",
    type: "processor",
    dependsOn: ["a"],
    inputs: [
      { from: "a", output: "copies", input: "signals" },
      { from: "a", output: "summary", input: "events" },
    ],
  },
  { id: "probe", type: "processor", dependsOn: ["a"], inputs: [{ from: "a", output: "summary", input: "report" }] },
  { id: "download", type: "data-target", dependsOn: ["b"] },
];
const nodes = [
  { id: "signals", type: "data-source", data: {} },
  { id: "events", type: "data-source", data: {} },
  { id: "a", type: "default", data: { manifestPorts: ports } },
  { id: "b", type: "default", data: { manifestPorts: ports } },
  { id: "probe", type: "default", data: { manifestPorts: { inputs: [{ name: "report" }], outputs: [{ name: "result" }] } } },
  { id: "download", type: "data-target", data: { defaultParams: { pathPrefix: "summary" } } },
];
const style = (src) => ({ stroke: src });

describe("portEdges", () => {
  const edges = portEdges(dag, nodes, style);
  const between = (s, t) => edges.filter((e) => e.source === s && e.target === t);

  it("draws each link between the same steps as its own line, on its ports", () => {
    const ab = between("a", "b");
    expect(ab.map((e) => [e.sourceHandle, e.targetHandle]).sort()).toEqual([
      ["out:copies", "in:signals"],
      ["out:summary", "in:events"],
    ]);
    expect(new Set(ab.map((e) => e.id)).size).toBe(2);
  });

  it("leaves a single-input step's link on its main point, from the output's port", () => {
    expect(between("a", "probe").map((e) => [e.sourceHandle, e.targetHandle])).toEqual([["out:summary", "target"]]);
  });

  it("draws a link into a target from the output its path prefix names", () => {
    expect(between("b", "download").map((e) => e.sourceHandle)).toEqual(["out:summary"]);
  });

  it("colours a line by its source", () => {
    expect(between("signals", "a")[0].style).toEqual({ stroke: "signals" });
  });

  it("keeps lines apart when the ports aren't known", () => {
    const bare = nodes.map((n) => ({ ...n, data: {} }));
    const ab = portEdges(dag, bare, style).filter((e) => e.source === "a" && e.target === "b");
    expect(ab).toHaveLength(2);
    expect(new Set(ab.map((e) => e.id)).size).toBe(2);
    expect(ab.every((e) => e.sourceHandle === "source" && e.targetHandle === "target")).toBe(true);
  });
});

describe("stepPoints", () => {
  const edges = portEdges(dag, nodes, style);

  it("gives a point per routed port, spread over the card", () => {
    expect(stepPoints("b", ports, edges, "in").map((p) => [p.name, p.at])).toEqual([
      ["signals", 0.25],
      ["events", 0.75],
    ]);
  });

  it("adds the main point when a line uses it", () => {
    // A's outputs: summary and copies by port, and no plain line out.
    expect(stepPoints("a", ports, edges, "out").map((p) => p.name)).toEqual(["summary", "copies"]);
    const plain = [...edges, { source: "a", target: "x", sourceHandle: "source" }];
    expect(stepPoints("a", ports, plain, "out").map((p) => p.name)).toEqual(["summary", "copies", ""]);
  });

  it("is the one main point for a step without routed ports", () => {
    expect(stepPoints("download", null, edges, "in")).toEqual([{ name: "", port: null, at: 0.5 }]);
  });
});
