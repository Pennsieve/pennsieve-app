import { describe, it, expect } from "vitest";
import {
  routedInputs,
  soleInput,
  inputHandleId,
  inputOfHandle,
  edgeId,
  linkAllowed,
  linksOf,
  edgesForStep,
  attachInputPorts,
  linkKeys,
  edgeLink,
  linkPorts,
} from "./inputPorts";

// test-ports-processor: two inputs, two outputs.
const ports = {
  inputs: [{ name: "signals" }, { name: "events" }],
  outputs: [{ name: "summary" }, { name: "copies" }],
};
const app = (id, manifestPorts = ports) => ({ id, type: "default", data: { manifestPorts } });
const a = app("a");
const b = app("b");
const one = app("one", { inputs: [{ name: "study" }], outputs: [{ name: "result" }] });
const edge = (source, target, sourceHandle = "source", targetHandle = "target", data) => ({
  id: edgeId(source, target, sourceHandle, targetHandle),
  source,
  target,
  sourceHandle,
  targetHandle,
  ...(data && { data }),
});

describe("input ports", () => {
  it("gives a point per input only to apps with two or more", () => {
    expect(routedInputs(ports).map((p) => p.name)).toEqual(["signals", "events"]);
    expect(routedInputs(one.data.manifestPorts)).toEqual([]);
    expect(soleInput(one.data.manifestPorts)).toBe("study");
    expect(soleInput(ports)).toBe("");
    expect(inputOfHandle(inputHandleId("signals"))).toBe("signals");
    expect(inputOfHandle("target")).toBe("");
  });

  it("names edges by their points, so two links can join the same steps", () => {
    expect(edgeId("a", "b", "source", "target")).toBe("ea-b");
    expect(edgeId("a", "b", "out:copies", "in:signals")).toBe("ea:copies-b:signals");
    expect(edgeId("a", "b", "out:summary", "in:events")).not.toBe(edgeId("a", "b", "out:copies", "in:signals"));
  });

  it("lets two outputs feed two inputs, and several links feed one input", () => {
    const edges = [edge("a", "b", "out:copies", "in:signals")];
    expect(linkAllowed(a, b, "out:summary", "in:events", edges).ok).toBe(true);
    expect(linkAllowed(a, b, "out:summary", "in:signals", edges).ok).toBe(true);
    expect(linkAllowed(app("c"), b, "out:copies", "in:signals", edges).ok).toBe(true);
    expect(linkAllowed(a, b, "out:copies", "in:signals", []).ok).toBe(true);
    expect(linkAllowed(a, b, "out:copies", "in:nope", []).reason).toBe("unknown-input");
    // An output port goes to an input, not to "all inputs".
    expect(linkAllowed(a, b, "out:copies", "target", []).reason).toBe("port-to-all");
    // All outputs to one input is a link too.
    expect(linkAllowed(a, b, "source", "in:events", edges).ok).toBe(true);
  });

  it("doesn't mix plain links and links to inputs between the same steps", () => {
    expect(linkAllowed(a, b, "source", "target", [edge("a", "b", "out:copies", "in:signals")]).reason).toBe("mixed");
    expect(linkAllowed(a, b, "source", "in:signals", [edge("a", "b")]).reason).toBe("mixed");
    expect(linkAllowed(a, b, "source", "target", [edge("a", "b")]).reason).toBe("duplicate");
  });

  it("saves a step's links from the edges into it", () => {
    const edges = [
      edge("a", "b", "out:copies", "in:signals"),
      edge("src", "b", "source", "in:events"),
      edge("x", "b"),
    ];
    expect(linksOf(b, edges)).toEqual([
      { from: "a", output: "copies", input: "signals" },
      { from: "src", input: "events" },
    ]);
  });

  it("saves a plain link into a one-input app as a link to that input, when it's the only one", () => {
    expect(linksOf(one, [edge("a", "one", "out:summary")])).toEqual([{ from: "a", output: "summary", input: "study" }]);
    expect(linksOf(one, [edge("a", "one"), edge("x", "one")])).toEqual([]);
    expect(linksOf({ id: "t", type: "data-target" }, [edge("a", "t", "out:copies")])).toEqual([]);
  });

  it("keeps a loaded link until its points are known", () => {
    const loaded = edge("a", "b", "source", "target", { input: "signals", output: "copies" });
    expect(linksOf(b, [loaded])).toEqual([{ from: "a", output: "copies", input: "signals" }]);
  });

  it("draws a saved step's links, then puts them on their points", () => {
    const make = ({ source, target, data }) => ({ id: `e${source}-${target}`, source, target, sourceHandle: "source", targetHandle: "target", ...(data && { data }) });
    const step = {
      id: "b",
      dependsOn: ["a", "x"],
      inputs: [
        { from: "a", output: "copies", input: "signals" },
        { from: "a", output: "summary", input: "events" },
      ],
    };
    const drawn = edgesForStep(step, make);
    expect(drawn.map((e) => [e.source, e.data?.input || ""])).toEqual([["a", "signals"], ["a", "events"], ["x", ""]]);

    const placed = attachInputPorts(drawn, [a, b]);
    expect(placed.map((e) => `${e.sourceHandle}>${e.targetHandle}`)).toEqual(["out:copies>in:signals", "out:summary>in:events", "source>target"]);
    expect(new Set(placed.map((e) => e.id)).size).toBe(3);
    // Saved again, the same links.
    expect(linksOf(b, placed)).toEqual(step.inputs);
  });

  it("compares workflows by their links and plain dependencies", () => {
    const steps = [{ id: "b", dependsOn: ["a", "x"], inputs: [{ from: "a", output: "copies", input: "signals" }] }];
    expect(linkKeys(steps)).toEqual(["a:copies>b:signals", "x>b"]);
    expect(linkKeys([{ id: "b", dependsOn: ["a"] }])).toEqual(["a>b"]);
  });

  it("says what a link joins, for checking it", () => {
    const linked = edge("a", "b", "out:copies", "in:signals");
    const link = edgeLink(linked, b, [linked]);
    expect(link).toEqual({ from: "a", output: "copies", input: "signals" });
    expect(linkPorts(link, ports, ports)).toEqual({ outputs: [{ name: "copies" }], input: { name: "signals" } });
    // All outputs to one input: every output is a candidate.
    expect(linkPorts({ from: "a", input: "events" }, ports, ports).outputs).toHaveLength(2);
    expect(linkPorts({ from: "a", input: "nope" }, ports, ports)).toBeNull();
    expect(edgeLink(edge("a", "b"), b, [edge("a", "b")])).toBeNull();
  });
});
