import { describe, it, expect, beforeEach } from "vitest";
import { nodeUnfit, rememberedSetup, rememberSetup, defaultNode, needsDataset } from "./runSetup";

const steps = [
  { id: "src", type: "data-source" },
  { id: "probe", type: "processor" },
  { id: "b", type: "processor" },
];

describe("nodeUnfit", () => {
  const llm = (id) => (id === "probe" ? { runtime: { llm: true } } : null);

  it("lets a node that has what the workflow needs run it", () => {
    expect(nodeUnfit({ status: "Enabled", enableLLMAccess: true }, steps, llm)).toEqual([]);
  });

  it("refuses GPU notebooks on basic nodes, but not GPU workflow steps", () => {
    const gpu = (id) => (id === "b" ? "gpu" : "standard");
    const node = { status: "Enabled", maxGpuInstances: 2, maxInteractiveSessions: 2 };
    // A batch GPU step: any node with GPUs, basic included.
    expect(nodeUnfit(node, steps, () => null, gpu)).toEqual([]);
    // A GPU notebook: secure or compliant only.
    const session = (id) => (id === "b" ? { runtime: { interactive: true } } : null);
    expect(nodeUnfit(node, steps, session, gpu)).toEqual(["Basic mode: GPU notebooks need a secure or compliant node"]);
    expect(nodeUnfit({ ...node, deploymentMode: "secure" }, steps, session, gpu)).toEqual([]);
    expect(nodeUnfit({ ...node, deploymentMode: "compliant" }, steps, session, gpu)).toEqual([]);
  });

  it("says why a node can't", () => {
    expect(nodeUnfit({ status: "Paused", enableLLMAccess: false }, steps, llm)).toEqual(["Paused", "No LLM access"]);
    expect(nodeUnfit({ status: "Enabled" }, steps, () => ({ runtime: { interactive: true } }))).toEqual(["No notebook sessions"]);
    expect(nodeUnfit({ status: "Enabled" }, steps, () => null, (id) => (id === "b" ? "gpu" : "standard"))).toEqual(["No GPU"]);
    expect(nodeUnfit({ status: "Enabled", deploymentMode: "compliant" }, steps, () => null, (id) => (id === "b" ? "lambda" : ""))).toEqual([
      "Compliant nodes don't run Lambda steps",
    ]);
  });
});

describe("remembered setup", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the last node and dataset per workspace and workflow", () => {
    rememberSetup("org-1", "wf-1", { computeNodeId: "n1", datasetId: "N:dataset:1" });
    expect(rememberedSetup("org-1", "wf-1")).toEqual({ computeNodeId: "n1", datasetId: "N:dataset:1" });
    expect(rememberedSetup("org-2", "wf-1")).toEqual({});
  });
});

describe("defaultNode", () => {
  const nodes = [{ uuid: "a" }, { uuid: "b" }, { uuid: "c" }];
  const fits = (n) => n.uuid !== "c";

  it("starts from the one asked for, then the remembered one if it fits, then the only fitting one", () => {
    expect(defaultNode("c", "a", nodes, fits)).toBe("c");
    expect(defaultNode("", "a", nodes, fits)).toBe("a");
    expect(defaultNode("", "c", nodes, fits)).toBe("");
    expect(defaultNode("", "", [{ uuid: "a" }, { uuid: "c" }], fits)).toBe("a");
  });
});

describe("needsDataset", () => {
  it("is true for a data source or a dataset target, not for a layer target", () => {
    expect(needsDataset({ dag: [{ type: "data-source" }] })).toBe(true);
    expect(needsDataset({ dag: [{ type: "data-target", targetType: "pennsieve-dataset" }] })).toBe(true);
    expect(needsDataset({ dag: [{ type: "processor" }, { type: "data-target", targetType: "persistent-layer" }] })).toBe(false);
    expect(needsDataset(null)).toBe(false);
    expect(needsDataset({ dag: [{ type: "processor" }, { type: "data-target", targetType: "download" }] })).toBe(false);
  });

  it("of a workflow with inputs and outputs: inputs, or an output that must go to a dataset", () => {
    const out = (o) => ({ id: "o", name: "o", from: { step: "s" }, ...o });
    expect(needsDataset({ inputs: [{ id: "i", name: "i" }], dag: [] })).toBe(true);
    expect(needsDataset({ outputs: [out({ accepts: ["download", "Pennsieve Dataset"], required: true })], dag: [] })).toBe(false);
    expect(needsDataset({ outputs: [out({ accepts: ["Pennsieve Dataset"], required: true })], dag: [] })).toBe(true);
    expect(needsDataset({ outputs: [out({ accepts: ["Pennsieve Dataset"] })], dag: [] })).toBe(false);
  });

  it("where inputs can take public files, only for an output that must go to a dataset", () => {
    const out = (o) => ({ id: "o", name: "o", from: { step: "s" }, ...o });
    const publicInputs = { publicInputs: true };
    expect(needsDataset({ inputs: [{ id: "i", name: "i" }], dag: [] }, publicInputs)).toBe(false);
    expect(needsDataset({ inputs: [{ id: "i", name: "i" }], outputs: [out({ accepts: ["Pennsieve Dataset"], required: true })], dag: [] }, publicInputs)).toBe(true);
    expect(needsDataset({ dag: [{ type: "data-source" }] }, publicInputs)).toBe(false);
    expect(needsDataset({ dag: [{ type: "data-source" }, { type: "data-target", targetType: "pennsieve-dataset" }] }, publicInputs)).toBe(true);
  });
});
