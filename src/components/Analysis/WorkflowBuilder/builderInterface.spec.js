import { describe, it, expect } from "vitest";
import { canvasDefinition, toInterfaceDefinition, slugId } from "./builderInterface";

const canvas = [
  { id: "node_1_abc", type: "data-source", dependsOn: [], position: { x: 0, y: 0 } },
  { id: "step", type: "processor", sourceUrl: "git://app", tag: "v1", dependsOn: ["node_1_abc"], inputs: [{ from: "node_1_abc", input: "data" }], position: { x: 1, y: 0 } },
  { id: "node_2_def", type: "data-target", targetType: "download", dependsOn: ["step"], defaultParams: { pathPrefix: "summary", name: "r" }, position: { x: 2, y: 0 } },
];
const names = { node_1_abc: "Signals", node_2_def: "Summary" };

describe("toInterfaceDefinition", () => {
  it("saves source and target nodes as inputs and outputs, named", () => {
    const def = toInterfaceDefinition(canvas, {
      nameOf: (id) => names[id],
      routedPortsOf: (s) => (s === "step" ? ["summary", "figures"] : []),
      extrasOf: (id) => (id === "node_2_def" ? { accepts: ["Pennsieve Dataset"], required: true } : {}),
    });
    expect(def.inputs).toEqual([{ id: "signals", name: "Signals", position: { x: 0, y: 0 } }]);
    expect(def.outputs).toEqual([{
      id: "summary", name: "Summary",
      from: { step: "step", output: "summary" },
      accepts: ["download", "Pennsieve Dataset"],
      default: { targetType: "download", params: { name: "r" } },
      required: true,
      position: { x: 2, y: 0 },
    }]);
    expect(def.processors).toHaveLength(1);
    expect(def.processors[0].dependsOn).toEqual(["signals"]);
    expect(def.processors[0].inputs).toEqual([{ from: "signals", input: "data" }]);
  });

  it("keeps ids it didn't generate, and tells same names apart", () => {
    const two = [
      { id: "files", type: "data-source", dependsOn: [] },
      { id: "node_3_x", type: "data-source", dependsOn: [] },
      { id: "s", type: "processor", dependsOn: ["files", "node_3_x"] },
    ];
    const def = toInterfaceDefinition(two, { nameOf: () => "files" });
    expect(def.inputs.map((i) => i.id)).toEqual(["files", "files-2"]);
  });

  it("can't save an output that isn't fed by exactly one step", () => {
    const fromSource = [canvas[0], { id: "t", type: "data-target", targetType: "download", dependsOn: ["node_1_abc"] }];
    expect(toInterfaceDefinition(fromSource, { nameOf: () => "x" })).toBeNull();
  });
});

describe("canvasDefinition", () => {
  it("draws inputs and outputs as nodes, an output's port as its prefix", () => {
    const wf = {
      inputs: [{ id: "signals", name: "Signals", position: { x: 0, y: 0 } }],
      outputs: [{ id: "summary", name: "Summary", from: { step: "step", output: "summary" }, default: { targetType: "Pennsieve Dataset" } }],
      dag: [{ id: "step", type: "processor", dependsOn: ["signals"] }],
    };
    const dag = canvasDefinition(wf).dag;
    expect(dag[0]).toMatchObject({ id: "signals", type: "data-source", name: "Signals", position: { x: 0, y: 0 } });
    expect(dag[2]).toMatchObject({ id: "summary", type: "data-target", targetType: "Pennsieve Dataset", defaultParams: { PATH_PREFIX: "summary" } });
  });

  it("leaves a workflow without an interface as it is", () => {
    const wf = { dag: [{ id: "s", type: "data-source" }] };
    expect(canvasDefinition(wf)).toBe(wf);
  });
});

it("slugId", () => {
  expect(slugId(" EEG signals (raw) ", "input")).toBe("eeg-signals-raw");
  expect(slugId("", "input")).toBe("input");
});
