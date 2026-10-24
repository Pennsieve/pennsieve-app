import { describe, it, expect } from "vitest";
import { runPageIsNotebook } from "./notebookHelpers";

describe("runPageIsNotebook", () => {
  const runs = [{ uuid: "nb", workflowName: "jupyter-notebook" }, { uuid: "wf", workflowName: "spike-sorting" }];
  it("is a notebook's page when opened from Notebooks, or when the run is a notebook's", () => {
    expect(runPageIsNotebook({ params: { runId: "wf" }, query: { from: "notebooks" } }, runs)).toBe(true);
    expect(runPageIsNotebook({ params: { runId: "nb" }, query: {} }, runs)).toBe(true);
    expect(runPageIsNotebook({ params: { runId: "wf" }, query: {} }, runs)).toBe(false);
    expect(runPageIsNotebook({ params: { runId: "unknown" }, query: {} }, runs)).toBe(false);
  });
});
