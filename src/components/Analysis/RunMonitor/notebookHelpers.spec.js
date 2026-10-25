import { describe, it, expect } from "vitest";
import { launchableKernels, kernelOutput } from "./notebookHelpers";

describe("launchableKernels", () => {
  const py = { uuid: "py", dag: [{ type: "processor", runtimeConfig: { interactive: true } }, { type: "data-target", targetType: "pennsieve" }] };
  const pyDownload = { uuid: "pyd", dag: [{ type: "processor", runtimeConfig: { interactive: true } }, { type: "data-target", targetType: "download" }] };
  it("leaves out kernels that write to a dataset outside a workspace", () => {
    expect(launchableKernels([py, pyDownload], { personal: true })).toEqual([pyDownload]);
    expect(launchableKernels([py, pyDownload])).toEqual([py, pyDownload]);
  });
  it("names where results go", () => {
    expect(kernelOutput(pyDownload)).toBe("Results as a download");
    expect(kernelOutput(py)).toBe("Results saved to a dataset");
    expect(kernelOutput({ dag: [] })).toBe("");
  });
});
