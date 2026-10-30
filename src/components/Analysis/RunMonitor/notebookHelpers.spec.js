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
  runVariants,
  offersRunVariants,
  defaultRunVariant,
  variantLabel,
  variantSetsResources,
  variantResources,
  variantNodeUnfit,
  sessionStepId,
  cardSelection,
  hardwareOptions,
  pickedOption,
  optionsForNode,
  nodeHardwareUnfit,
  hardwareForNode,
  hardwareLabel,
  gpuSessionHelp,
  gpuReviewResources,
  runNodeId,
  gpuShortLabel,
  gpuMarkTitle,
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

describe("variants per run", () => {
  const session = { id: "s", type: "processor", sourceUrl: "https://github.com/Pennsieve/pennsieve-jupyter-session" };
  // workflow-service's notebook.variants for pennsieve-jupyter-session v0.2.0.
  const VARIANTS = [
    { id: "cpu", name: "CPU", default: true, description: "A CPU kernel on Fargate.", computeTypes: ["standard"] },
    { id: "gpu", name: "GPU", gpu: true, computeTypes: ["gpu"], cpu: 4096, memory: 14336 },
  ];
  const nb = (uuid, notebook = {}, extra = {}) => ({
    uuid,
    name: uuid,
    dag: [session],
    inputs: [{ name: "files" }],
    outputs: [{ name: "results" }],
    ...extra,
    notebook: { kernel: "python", savesTo: "download", ...notebook },
  });
  const iface = nb("py", { variant: "cpu", variants: VARIANTS });
  const twin = nb("py-gpu", { variant: "gpu", gpu: true, variants: VARIANTS });
  const oldCpu = nb("old-cpu", { variant: "cpu" });
  const oldGpu = nb("old-gpu", { variant: "gpu", gpu: true });

  it("offers a choice only with two or more variants", () => {
    expect(runVariants(iface)).toBe(VARIANTS);
    expect(offersRunVariants(iface)).toBe(true);
    expect(runVariants(nb("one", { variant: "cpu", variants: [VARIANTS[0]] }))).toEqual([]);
    expect(runVariants(oldCpu)).toEqual([]);
    expect(runVariants(null)).toEqual([]);
  });

  it("preselects what the workflow runs, else the default", () => {
    expect(defaultRunVariant(iface)).toBe("cpu");
    expect(defaultRunVariant(twin)).toBe("gpu");
    expect(defaultRunVariant(nb("x", { variants: VARIANTS }))).toBe("cpu");
    expect(defaultRunVariant(nb("x", { variant: "tpu", variants: [VARIANTS[1], { id: "big" }] }))).toBe("gpu");
    expect(defaultRunVariant(oldCpu)).toBe("");
  });

  it("names variants and their resources", () => {
    expect(variantLabel(VARIANTS[1])).toBe("GPU");
    expect(variantLabel({ id: "big" })).toBe("big");
    expect(variantSetsResources(VARIANTS[0])).toBe(false);
    expect(variantSetsResources(VARIANTS[1])).toBe(true);
    expect(variantSetsResources({ id: "big", memory: 30720 })).toBe(true);
    expect(variantSetsResources(null)).toBe(false);
    expect(variantResources(VARIANTS[1])).toBe("4 vCPU · 14 GB");
    expect(variantResources(VARIANTS[0])).toBe("");
  });

  it("applies the node rules of the chosen variant", () => {
    const basicOld = { maxGpuInstances: 1, deploymentMode: "basic", provisionerImageTag: "v1.24.0" };
    const gate = (n) => (n.provisionerImageTag === "v1.24.0" ? "Provisioner v1.24.0; update" : "");
    expect(variantNodeUnfit(basicOld, VARIANTS[0], gate)).toEqual([]);
    expect(variantNodeUnfit(basicOld, VARIANTS[1], gate)).toEqual([BASIC_GPU_REASON, "Provisioner v1.24.0; update"]);
    expect(variantNodeUnfit({ maxGpuInstances: 0, deploymentMode: "secure" }, VARIANTS[1])).toEqual(["No GPUs"]);
    // A non-default CPU variant needs only the provisioner gate.
    expect(variantNodeUnfit(basicOld, { id: "big" }, gate)).toEqual(["Provisioner v1.24.0; update"]);
    expect(variantNodeUnfit(basicOld, null, gate)).toEqual([]);
  });

  it("finds the session step for the pick", () => {
    expect(sessionStepId([{ id: "src", type: "data-source" }, { id: "s", type: "processor" }])).toBe("s");
    expect(
      sessionStepId([
        { id: "a", type: "processor" },
        { id: "s", type: "processor", runtimeConfig: { interactive: true } },
      ])
    ).toBe("s");
    expect(sessionStepId([])).toBe("");
  });

  it("shows one card for a workflow with variants per run, and hides its twin", () => {
    const r = nb("r", { kernel: "r" });
    const cards = kernelCards([twin, iface, r]);
    expect(cards.map((c) => [c.cpu?.uuid, c.gpu?.uuid || null, c.perRun?.uuid || null])).toEqual([
      ["py", null, "py"],
      ["r", null, null],
    ]);
    expect(cards[0].twins).toEqual(["py-gpu"]);
    expect(cardOf(cards, "py-gpu")).toBe(cards[0]);
  });

  it("keeps pairing twins when no workflow offers variants per run", () => {
    const cards = kernelCards([oldCpu, oldGpu]);
    expect(cards.map((c) => [c.cpu?.uuid, c.gpu?.uuid, c.perRun])).toEqual([["old-cpu", "old-gpu", null]]);
  });

  it("opens a link to a hidden twin on the per-run kernel with the twin's variant", () => {
    const kernels = [iface, twin];
    const cards = kernelCards(kernels);
    expect(cardSelection(cards, "py-gpu", kernels)).toEqual({ workflowId: "py", variant: "gpu" });
    expect(cardSelection(cards, "py", kernels)).toEqual({ workflowId: "py", variant: "cpu" });
    expect(cardSelection(cards, "nope", kernels)).toBeNull();
    const old = kernelCards([oldCpu, oldGpu]);
    expect(cardSelection(old, "old-gpu", [oldCpu, oldGpu])).toEqual({ workflowId: "old-gpu", variant: "" });
  });

  it("marks a run whose session the run put on the GPU variant", () => {
    // The CPU workflow (saved computeType standard) run on gpu: the server
    // stamps the variant, clears the computeType and targets gpu.
    const run = {
      dag: [{ ...session, variant: "gpu", runtimeConfig: { interactive: true, computeTypes: ["gpu"] } }],
      processorConfigs: [{ nodeId: "s", executionTarget: "gpu", variant: "gpu" }],
    };
    expect(runOnGpu(run)).toBe(true);
    const cpuRun = {
      dag: [{ ...session, variant: "cpu", computeType: "standard", runtimeConfig: { computeTypes: ["standard"] } }],
      processorConfigs: [{ nodeId: "s", executionTarget: "standard" }],
    };
    expect(runOnGpu(cpuRun)).toBe(false);
  });
});

describe("the Hardware step", () => {
  const variants = [
    { id: "cpu", name: "CPU", default: true, gpu: false },
    { id: "gpu", name: "GPU", default: false, gpu: true, cpu: 4096, memory: 14336 },
  ];
  const perRun = { uuid: "nb", notebook: { kernel: "python", variant: "cpu", variants } };
  const perRunCard = { key: "k", cpu: perRun, gpu: null, perRun, twins: [] };
  const twinCard = { key: "t", cpu: { uuid: "c" }, gpu: { uuid: "g" }, perRun: null, twins: [] };
  const cpuNode = { uuid: "n1", deploymentMode: "secure", maxGpuInstances: 0 };
  const gpuNode = { uuid: "n2", deploymentMode: "secure", maxGpuInstances: 2, gpuTier: "medium" };
  const basicGpuNode = { uuid: "n3", deploymentMode: "basic", maxGpuInstances: 2 };
  const L4 = { tier: "medium", model: "NVIDIA L4", vramGB: 24, instanceType: "g6.2xlarge", vcpu: 8, memoryGB: 30, approx: false, maxInstances: 2 };

  it("offers a kernel's variants per run, or its CPU and GPU twins, or nothing", () => {
    expect(hardwareOptions(perRunCard).map((o) => [o.id, o.workflowId, o.variant, o.gpu])).toEqual([
      ["cpu", "nb", "cpu", false],
      ["gpu", "nb", "gpu", true],
    ]);
    expect(hardwareOptions(twinCard).map((o) => [o.id, o.workflowId, o.variant, o.gpu, o.default])).toEqual([
      ["cpu", "c", "", false, true],
      ["gpu", "g", "", true, false],
    ]);
    expect(hardwareOptions({ key: "x", cpu: { uuid: "x" }, gpu: null, perRun: null })).toEqual([]);
    expect(hardwareOptions(null)).toEqual([]);
  });

  it("finds the option a workflow and variant pick", () => {
    const opts = hardwareOptions(twinCard);
    expect(pickedOption(opts, "g", "")).toBe(opts[1]);
    expect(pickedOption(opts, "g", undefined)).toBe(opts[1]);
    expect(pickedOption(opts, "x", "")).toBeNull();
  });

  it("shows only what the node can run: no GPU chip on a node without GPUs", () => {
    const opts = hardwareOptions(perRunCard);
    expect(optionsForNode(opts, cpuNode).map((o) => o.id)).toEqual(["cpu"]);
    expect(optionsForNode(opts, basicGpuNode).map((o) => o.id)).toEqual(["cpu"]);
    expect(optionsForNode(opts, gpuNode).map((o) => o.id)).toEqual(["cpu", "gpu"]);
    expect(optionsForNode(opts, gpuNode, () => "Provisioner too old").map((o) => o.id)).toEqual(["cpu"]);
  });

  it("narrows the nodes by the hardware chosen first, the same rule", () => {
    const opts = hardwareOptions(perRunCard);
    // Nothing chosen yet: any node that runs one of them.
    expect(nodeHardwareUnfit(cpuNode, opts)).toEqual([]);
    // GPU chosen first (a link to the GPU twin): only nodes that run it.
    expect(nodeHardwareUnfit(cpuNode, [opts[1]])).toEqual(["No GPUs"]);
    expect(nodeHardwareUnfit(basicGpuNode, [opts[1]])).toEqual([BASIC_GPU_REASON]);
    expect(nodeHardwareUnfit(gpuNode, [opts[1]])).toEqual([]);
    expect(nodeHardwareUnfit(cpuNode, [])).toEqual([]);
  });

  it("keeps the pick on a node that runs it, else the node's default", () => {
    const opts = hardwareOptions(perRunCard);
    expect(hardwareForNode(opts, gpuNode, opts[1])).toBe(opts[1]);
    expect(hardwareForNode(opts, cpuNode, opts[1])).toBe(opts[0]);
    expect(hardwareForNode([opts[1]], cpuNode, opts[1])).toBeNull();
  });

  it("names the GPU option with the node's GPU and what a session gets", () => {
    const opts = hardwareOptions(perRunCard);
    expect(hardwareLabel(opts[1], L4)).toBe("GPU · NVIDIA L4 · 8 vCPU / 30 GB");
    expect(hardwareLabel(opts[1], null)).toBe("GPU");
    expect(hardwareLabel(opts[0], L4)).toBe("CPU");
    expect(hardwareLabel({ id: "big", name: "Big", cpu: 8192, memory: 32768 }, null)).toBe("Big · 8 vCPU · 32 GB");
    expect(hardwareLabel(null, L4)).toBe("");
  });

  it("says where a GPU session runs and what it gets, from the node", () => {
    expect(gpuSessionHelp(L4)).toContain("the node's NVIDIA L4 GPU (g6.2xlarge)");
    expect(gpuSessionHelp(L4)).toContain("billed while the notebook is open");
    expect(gpuSessionHelp(null)).toContain("the node's GPU instance");
    expect(gpuSessionHelp(L4)).not.toContain("T4");
    expect(gpuReviewResources(L4)).toBe("8 vCPU · 30 GB (the node's GPU instance)");
    expect(gpuReviewResources(null)).toBe("The node's GPU instance");
  });
});

describe("a GPU session's mark", () => {
  it("names the run's node's GPU where known", () => {
    const L4 = { model: "NVIDIA L4" };
    expect(gpuShortLabel(L4)).toBe("GPU (L4)");
    expect(gpuShortLabel({ model: "" })).toBe("GPU");
    expect(gpuShortLabel(null)).toBe("GPU");
    expect(gpuMarkTitle(L4)).toBe("Runs on a GPU (NVIDIA L4)");
    expect(gpuMarkTitle(null)).toBe("Runs on a GPU");
  });

  it("finds the run's node", () => {
    expect(runNodeId({ computeNodeUuid: "a" })).toBe("a");
    expect(runNodeId({ workflowInstanceConfiguration: { computeNodeId: "b" } })).toBe("b");
    expect(runNodeId(null)).toBe("");
  });
});
