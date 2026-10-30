import { describe, it, expect } from "vitest";
import {
  launchableKernels,
  kernelOutput,
  notebookKernel,
  isNotebookWorkflow,
  kernelLabel,
  nonSavingAlternative,
  kernelCards,
  cardOf,
  gpuSessionUnfit,
  gpuReasonNote,
  BASIC_GPU_REASON,
  notebookGpu,
  runOnGpu,
} from "./notebookHelpers";

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

describe("CPU and GPU kernels", () => {
  const nb = (uuid, extra = {}, notebook = {}) => ({
    uuid,
    name: uuid,
    dag: [{ id: "s", type: "processor", sourceUrl: "https://github.com/Pennsieve/pennsieve-jupyter-session" }],
    ...extra,
    notebook: { kernel: "python", savesTo: "download", ...notebook },
  });

  it("pairs a kernel's CPU and GPU workflows into one card", () => {
    const cpu = nb("py-cpu", {}, { variant: "cpu" });
    const gpu = nb("py-gpu", {}, { variant: "gpu", gpu: true });
    const r = nb("r", {}, { kernel: "r" });
    const cards = kernelCards([cpu, r, gpu]);
    expect(cards.map((c) => [c.cpu?.uuid || null, c.gpu?.uuid || null])).toEqual([
      ["py-cpu", "py-gpu"],
      ["r", null],
    ]);
    expect(cardOf(cards, "py-gpu")).toBe(cards[0]);
    expect(cardOf(cards, "nope")).toBeNull();
  });

  it("keeps workflows without variants as they were, one card each", () => {
    const a = nb("a");
    const b = nb("b", {}, { savesTo: "dataset" });
    expect(kernelCards([a, b]).map((c) => [c.cpu.uuid, c.gpu])).toEqual([
      ["a", null],
      ["b", null],
    ]);
  });

  it("doesn't pair kernels whose results go elsewhere", () => {
    const cpu = nb("cpu", {}, { variant: "cpu" });
    const gpu = nb("gpu", {}, { variant: "gpu", gpu: true, savesTo: "dataset" });
    expect(kernelCards([cpu, gpu]).length).toBe(2);
  });

  it("says why a node can't host a GPU session", () => {
    const fit = { maxGpuInstances: 2, deploymentMode: "secure" };
    expect(gpuSessionUnfit(fit)).toEqual([]);
    expect(gpuSessionUnfit({ maxGpuInstances: 0, deploymentMode: "secure" })).toEqual(["No GPUs"]);
    expect(gpuSessionUnfit({ maxGpuInstances: 1 })).toEqual(["Basic mode: GPU notebooks need a secure or compliant node"]);
    expect(gpuSessionUnfit({ maxGpuInstances: 1, deploymentMode: "basic" })).toEqual([BASIC_GPU_REASON]);
    // Compliant nodes reach sessions through their private proxy, GPU ones too.
    expect(gpuSessionUnfit({ maxGpuInstances: 1, deploymentMode: "compliant" })).toEqual([]);
    expect(gpuSessionUnfit({ maxGpuInstances: 1, deploymentMode: "Secure" })).toEqual([]);
    expect(gpuReasonNote(gpuSessionUnfit({ maxGpuInstances: 1 }))).toMatch(/basic-mode gateway can't reach.*GPU workflow steps work on this node/);
    expect(gpuReasonNote(["No GPUs"])).toBe("");
    expect(gpuSessionUnfit(fit, () => "Provisioner v1.24.0; update")).toEqual(["Provisioner v1.24.0; update"]);
    expect(notebookGpu({ notebook: { gpu: true } })).toBe(true);
    expect(notebookGpu({ notebook: {} })).toBe(false);
  });

  it("knows a run's session runs on a GPU", () => {
    const step = { id: "s", type: "processor" };
    expect(runOnGpu({ dag: [step], processorConfigs: [{ nodeId: "s", executionTarget: "gpu" }] })).toBe(true);
    expect(runOnGpu({ dag: [{ ...step, runtimeConfig: { computeTypes: ["gpu"] } }] })).toBe(true);
    expect(runOnGpu({ dag: [{ ...step, computeType: "standard", runtimeConfig: { computeTypes: ["gpu"] } }] })).toBe(false);
    expect(runOnGpu({ dag: [step] })).toBe(false);
    expect(runOnGpu(null)).toBe(false);
  });
});
