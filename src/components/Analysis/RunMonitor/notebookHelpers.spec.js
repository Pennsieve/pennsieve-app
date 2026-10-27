import { describe, it, expect } from "vitest";
import { launchableKernels, kernelOutput, notebookKernel, isNotebookWorkflow, kernelLabel, nonSavingAlternative } from "./notebookHelpers";

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
  it("offers a kernel's notebook with an input and output as that kernel's only one", () => {
    const pyBound = {
      uuid: "pyb",
      notebook: { kernel: "python", savesTo: "download", worksWithoutDataset: true },
      inputs: [{ id: "data", name: "Data", optional: true }],
      outputs: [{ id: "results", name: "Results", from: { step: "nb" } }],
    };
    expect(launchableKernels([py, pyDownload, pyBound, r])).toEqual([pyBound, r]);
    expect(launchableKernels([py, pyDownload, pyBound, r], { personal: true })).toEqual([pyBound, r]);
  });
  it("names where results go", () => {
    expect(kernelOutput(pyDownload)).toBe("Results as a download");
    expect(kernelOutput(py)).toBe("Results saved to a dataset");
    expect(kernelOutput(r)).toBe("Results stay in the session");
    expect(kernelOutput({})).toBe("");
  });
});

describe("nonSavingAlternative", () => {
  const nb = (uuid, kernel, savesTo) => ({ uuid, notebook: { kernel, savesTo } });
  const pyDataset = nb("a", "python", "dataset");
  const pyNone = nb("b", "python", "none");
  const pyDownload = nb("c", "python", "download");
  const rDownload = nb("d", "r", "download");

  it("offers the same language's download notebook first, then one that saves nothing", () => {
    expect(nonSavingAlternative([pyDataset, pyNone, pyDownload, rDownload], pyDataset)).toBe(pyDownload);
    expect(nonSavingAlternative([pyDataset, pyNone, rDownload], pyDataset)).toBe(pyNone);
  });

  it("offers nothing for a notebook that doesn't save to a dataset, or with no same-language one", () => {
    expect(nonSavingAlternative([pyDataset, pyDownload], pyDownload)).toBeNull();
    expect(nonSavingAlternative([pyDataset, rDownload], pyDataset)).toBeNull();
  });
});
