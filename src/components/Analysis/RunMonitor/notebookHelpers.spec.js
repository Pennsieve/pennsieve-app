import { describe, it, expect } from "vitest";
import { launchableKernels, kernelOutput, notebookKernel, isNotebookWorkflow, kernelLabel } from "./notebookHelpers";

// workflow-service's computed field: a notebook only when a step's app.yml
// declares an interactive Jupyter session.
const py = { uuid: "py", notebook: { kernel: "python", savesTo: "dataset", worksWithoutDataset: false } };
const pyDownload = { uuid: "pyd", notebook: { kernel: "python", savesTo: "download", worksWithoutDataset: true } };
const r = { uuid: "r", notebook: { kernel: "r", savesTo: "none", worksWithoutDataset: true } };

describe("notebook workflows", () => {
  it("are those workflow-service marks, never by name", () => {
    expect(isNotebookWorkflow(py)).toBe(true);
    expect(isNotebookWorkflow({ name: "Pennsieve - Python Notebook - 3.12" })).toBe(false);
    expect(isNotebookWorkflow({ dag: [{ type: "processor", runtimeConfig: { interactive: true } }] })).toBe(false);
    expect(notebookKernel(r)).toBe("r");
    expect(notebookKernel({})).toBeNull();
    expect(kernelLabel("python")).toBe("Python");
    expect(kernelLabel("r")).toBe("R");
  });
});

describe("launchableKernels", () => {
  it("leaves out archived ones, and outside a workspace those that write to a dataset", () => {
    expect(launchableKernels([py, pyDownload, r], { personal: true })).toEqual([pyDownload, r]);
    expect(launchableKernels([py, pyDownload])).toEqual([py, pyDownload]);
    expect(launchableKernels([py, { ...pyDownload, isActive: false }])).toEqual([py]);
    expect(launchableKernels([{ uuid: "x", name: "Jupyter Notebook" }])).toEqual([]);
  });
  it("names where results go", () => {
    expect(kernelOutput(pyDownload)).toBe("Results as a download");
    expect(kernelOutput(py)).toBe("Results saved to a dataset");
    expect(kernelOutput(r)).toBe("Results stay in the session");
    expect(kernelOutput({})).toBe("");
  });
});
