import { describe, it, expect } from "vitest";
import { routeWorkspaceInputs } from "./workspaceInputs";

const inputs = [
  { id: "both", datasetId: "N:dataset:a", packageIds: ["N:package:1"], models: ["case"], filePaths: "source" },
  { id: "records", datasetId: "N:dataset:a", packageIds: [], models: ["*"] },
  { id: "files", datasetId: "N:dataset:b", packageIds: ["N:package:2"], models: [] },
  { id: "public", datasetId: "N:dataset:a", packageIds: ["N:package:3"], models: [] },
  { id: "left", datasetId: "N:dataset:a", packageIds: ["N:package:4"], models: ["*"] },
  { id: "empty", datasetId: "N:dataset:a", packageIds: [], models: [] },
];
const opts = { publicIds: new Set(["public"]), leftOut: new Set(["left"]) };

describe("routeWorkspaceInputs", () => {
  it("sends files and records together through views where views take files", () => {
    const { viaView, packages } = routeWorkspaceInputs(inputs, { ...opts, filesAsViews: true });
    expect(viaView.map((v) => [v.id, v.packageIds, v.models])).toEqual([
      ["both", ["N:package:1"], ["case"]],
      ["records", [], ["*"]],
      ["files", ["N:package:2"], []],
    ]);
    expect(viaView[0].filePaths).toBe("source");
    expect(packages).toEqual([]);
  });

  it("keeps files as packages elsewhere, records through views", () => {
    const { viaView, packages } = routeWorkspaceInputs(inputs, opts);
    expect(viaView.map((v) => [v.id, v.packageIds, v.models])).toEqual([
      ["both", [], ["case"]],
      ["records", [], ["*"]],
    ]);
    expect(packages).toEqual([
      { id: "both", packageIds: ["N:package:1"] },
      { id: "files", packageIds: ["N:package:2"] },
    ]);
  });

  it("leaves out an input without a dataset", () => {
    expect(routeWorkspaceInputs([{ id: "x", packageIds: [], models: ["*"] }]).viaView).toEqual([]);
  });
});
