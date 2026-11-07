import { describe, it, expect } from "vitest";
import { importStatusUrl, importSummary, importStillMoving, isDatasetImport } from "./runImports";

describe("runImports", () => {
  it("builds the status url for one run target", () => {
    expect(importStatusUrl("https://api2", "N:dataset:1", "run-1", "dataset-llm")).toBe(
      "https://api2/upload/manifest/run-results/import?dataset_id=N%3Adataset%3A1&run_id=run-1&target_id=dataset-llm"
    );
  });

  it("knows dataset imports", () => {
    expect(isDatasetImport({ targetType: "Pennsieve Dataset", datasetId: "N:dataset:1" })).toBe(true);
    expect(isDatasetImport({ targetType: "download", datasetId: "" })).toBe(false);
    expect(isDatasetImport({ targetType: "Pennsieve Dataset" })).toBe(false);
  });

  it("says how an import is going", () => {
    expect(importSummary(null)).toBeNull();
    expect(importSummary({ total: 0 })).toBeNull();
    expect(importSummary({ total: 5, imported: 3, inProgress: 2 })).toEqual({ state: "importing", text: "Importing: 3 of 5 files" });
    expect(importSummary({ total: 1, imported: 1 })).toEqual({ state: "done", text: "1 file imported" });
    expect(importSummary({ total: 5, imported: 4, failed: 1 })).toEqual({ state: "failed", text: "1 of 5 files couldn't be imported" });
  });

  it("asks again while files are moving or pages are still coming", () => {
    expect(importStillMoving({ inProgress: 2 }, "SUCCEEDED")).toBe(true);
    expect(importStillMoving(null, "STARTED")).toBe(true);
    expect(importStillMoving({ inProgress: 0, failed: 1 }, "SUCCEEDED")).toBe(false);
  });
});
