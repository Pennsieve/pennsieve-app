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
  });
});
