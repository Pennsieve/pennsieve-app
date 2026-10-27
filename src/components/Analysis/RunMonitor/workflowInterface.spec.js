import { describe, it, expect } from "vitest";
import { hasInterface, withInterfaceNodes, destinationChoices, worksWithoutDataset, NO_DESTINATION } from "./workflowInterface";

const wf = {
  inputs: [{ id: "files", name: "Files" }],
  outputs: [{ id: "results", name: "Results", from: { step: "step", output: "summary" }, accepts: ["download", "Pennsieve Dataset"], default: { targetType: "download", params: { name: "r" } } }],
  dag: [{ id: "step", type: "processor", dependsOn: ["files"] }],
};

describe("workflowInterface", () => {
  it("shows inputs and outputs as the source and target nodes a run has", () => {
    expect(hasInterface(wf)).toBe(true);
    const { dag } = withInterfaceNodes(wf);
    expect(dag.map((d) => [d.id, d.type])).toEqual([["files", "data-source"], ["step", "processor"], ["results", "data-target"]]);
    expect(dag[0]).toMatchObject({ name: "Files", input: wf.inputs[0] });
    expect(dag[2]).toMatchObject({ name: "Results", targetType: "download", dependsOn: ["step"], defaultParams: { name: "r" }, output: wf.outputs[0] });
    const old = { dag: [{ id: "s", type: "data-source" }] };
    expect(withInterfaceNodes(old)).toBe(old);
  });

  it("offers the destinations an output accepts, here", () => {
    const out = wf.outputs[0];
    expect(destinationChoices(out)).toEqual(["download", "Pennsieve Dataset", NO_DESTINATION]);
    expect(destinationChoices(out, { myWorkspace: true })).toEqual(["download", NO_DESTINATION]);
    expect(destinationChoices({ ...out, required: true })).toEqual(["download", "Pennsieve Dataset"]);
    expect(destinationChoices({ id: "o" }, { targetTypes: [{ targetType: "download" }, { targetType: "persistent-layer" }] })).toEqual(["download", "persistent-layer", NO_DESTINATION]);
  });

  it("works without a dataset when every required output can go elsewhere", () => {
    expect(worksWithoutDataset(wf.outputs)).toBe(true);
    expect(worksWithoutDataset([{ required: true, accepts: ["Pennsieve Dataset"] }])).toBe(false);
  });
});
