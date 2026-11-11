import { describe, it, expect } from "vitest";
import { formatCost, graphStatusColor, isRunningStatus, lambdaMemory, nodeBorderColor, nodeMetricRows, processorConfigEntry, RUNNING_STATUSES, runsEmptyState, statusMarkOf } from "./runHelpers";

describe("formatCost", () => {
  it("says a tiny cost is under a hundredth of a cent, not $0.0000", () => {
    expect(formatCost(0.000004)).toBe("< $0.0001");
    expect(formatCost(0.0003)).toBe("$0.0003");
    expect(formatCost(1.234)).toBe("$1.23");
    expect(formatCost(0)).toBe("$0.00");
  });
});

describe("statusMarkOf", () => {
  it("marks a step that ended, and none that's pending or running", () => {
    expect(statusMarkOf("SUCCEEDED")).toEqual({ glyph: "✓", kind: "done" });
    expect(statusMarkOf("FAILED").kind).toBe("failed");
    expect(statusMarkOf("CANCELED").kind).toBe("canceled");
    expect(statusMarkOf("STARTED")).toBeNull();
    expect(statusMarkOf("NOT_STARTED")).toBeNull();
  });
});

describe("graphStatusColor", () => {
  it("keeps colour for what needs a look, and greys a step that succeeded", () => {
    expect(graphStatusColor("SUCCEEDED")).toBe(graphStatusColor("NOT_STARTED"));
    expect(graphStatusColor("FAILED")).toBe("#E94B4B");
    expect(graphStatusColor("STARTED")).toBe("#06b6d4");
    expect(nodeBorderColor("processor", "SUCCEEDED")).toBe(graphStatusColor("NOT_STARTED"));
    expect(nodeBorderColor("data-source", null)).toBe("#6366f1");
  });
});

describe("inputProgressLine", () => {
  it("says how far an input's download got, by bytes, else files", async () => {
    const { inputProgressLine } = await import("./runHelpers");
    expect(inputProgressLine({ files: 1204, filesTotal: 3400, bytes: 380, bytesTotal: 1000 })).toBe("38% · 1,204 of 3,400 files");
    expect(inputProgressLine({ files: 1, filesTotal: 4, bytes: 0, bytesTotal: 0 })).toBe("25% · 1 of 4 files");
    expect(inputProgressLine({ files: 0, filesTotal: 1, bytes: 0, bytesTotal: 10 })).toBe("0% · 0 of 1 file");
    expect(inputProgressLine({ files: 9, filesTotal: 9, bytes: 12, bytesTotal: 10 })).toBe("100% · 9 of 9 files");
    expect(inputProgressLine(null)).toBe("");
  });
});

describe("nodeMetricRows", () => {
  it("shows what a step used of what it was given, with a short image", () => {
    const rows = nodeMetricRows({
      computeType: "standard", status: "SUCCEEDED", durationSec: 177.2, cpuUnits: 2048, memoryConfiguredMiB: 12288, memoryMiB: 12288,
      maxMemoryUsedMiB: 3772, maxCpuUtilized: 1947.5, estimatedCost: 0.0066,
      imageUri: "941165240011.dkr.ecr.us-east-1.amazonaws.com/dev-appstore-private-use1@sha256:e88e50ee7710ed04a1560dd42b0d4541af3780e2dd1030f41",
    });
    const byLabel = Object.fromEntries(rows.filter((r) => r.label).map((r) => [r.label, r.value]));
    expect(byLabel["CPU used"]).toBe("1.90 of 2.0 vCPU (95%)");
    expect(byLabel["Memory used"]).toBe("3,772 of 12,288 MiB (31%)");
    expect(byLabel["Duration"]).toBe("2m 57s");
    expect(byLabel["Status"]).toBe("Complete");
    expect(byLabel["Image"]).toBe("dev-appstore-private-use1@sha256:e88e50ee7710…");
    expect(rows.find((r) => r.label === "Image").title).toContain("941165240011");
    expect(rows.some((r) => r.note)).toBe(false);
    expect(Object.keys(byLabel)).not.toContain("Memory");
    expect(Object.keys(byLabel)).not.toContain("Volume (EBS)");
  });

  it("shows a step's EBS volume when it had one", () => {
    const rows = nodeMetricRows({ computeType: "standard", cpuUnits: 1024, memoryMiB: 2048, volumeGiB: 100, estimatedCost: 0.01 });
    const byLabel = Object.fromEntries(rows.filter((r) => r.label).map((r) => [r.label, r.value]));
    expect(byLabel["Volume (EBS)"]).toBe("100 GiB");
  });

  it("says when a short step has no usage sample, and gives a Lambda step its report", () => {
    const rows = nodeMetricRows({ computeType: "standard", durationSec: 52.7, cpuUnits: 256, memoryConfiguredMiB: 512, memoryMiB: 512, estimatedCost: 0.0002 });
    const byLabel = Object.fromEntries(rows.filter((r) => r.label).map((r) => [r.label, r.value]));
    expect(byLabel["CPU"]).toBe("0.25 vCPU");
    expect(byLabel["Memory"]).toBe("512 MiB");
    expect(rows.find((r) => r.note).note).toMatch(/under a minute/);

    const lambda = nodeMetricRows({ computeType: "lambda", durationSec: 0.21, billedDurationMs: 213, memoryConfiguredMiB: 512, maxMemoryUsedMiB: 42 });
    const l = Object.fromEntries(lambda.filter((r) => r.label).map((r) => [r.label, r.value]));
    expect(l["Memory used"]).toBe("42 of 512 MiB (8%)");
    expect(l["Billed"]).toBe("213 ms");
    expect(lambda.some((r) => r.note)).toBe(false);
  });
});

describe("processorConfigEntry", () => {
  it("sends the disk a batch step on Fargate asks for, and not another step's", () => {
    expect(processorConfigEntry("a", { executionTarget: "standard", diskGiB: 300 })).toEqual({ nodeId: "a", executionTarget: "standard", diskGiB: 300 });
    expect(processorConfigEntry("a", { diskGiB: "500" })).toEqual({ nodeId: "a", diskGiB: 500 });
    expect(processorConfigEntry("a", { executionTarget: "standard", diskGiB: "" })).toEqual({ nodeId: "a", executionTarget: "standard" });
    expect(processorConfigEntry("a", { executionTarget: "lambda", diskGiB: 300 })).toEqual({ nodeId: "a", executionTarget: "lambda" });
    expect(processorConfigEntry("a", { executionTarget: "gpu", diskGiB: 300 })).toEqual({ nodeId: "a", executionTarget: "gpu" });
    expect(processorConfigEntry("a", { executionTarget: "standard", interactive: true, diskGiB: 300 })).toEqual({ nodeId: "a", executionTarget: "standard", interactive: true, sessionType: "jupyter" });
  });
  const fits = { available: true, reasons: [], known: true, overridable: false };
  const over = { available: false, reasons: ["memory 16384 MB"], known: true, overridable: true };
  const hard = { available: false, reasons: ["image is 12 GB"], known: true, overridable: false };

  it("builds an app step's entry from its settings", () => {
    expect(processorConfigEntry("a", { executionTarget: "standard", version: "v1", cpu: "1024", memory: "4096" }, fits)).toEqual({
      nodeId: "a",
      executionTarget: "standard",
      version: "v1",
      cpu: "1024",
      memory: "4096",
    });
    expect(processorConfigEntry("a", {})).toEqual({ nodeId: "a" });
    expect(processorConfigEntry("a", { executionTarget: "standard", interactive: true }, fits)).toEqual({
      nodeId: "a",
      executionTarget: "standard",
      interactive: true,
      sessionType: "jupyter",
    });
  });

  it("marks a Lambda picked as an override, and nothing else", () => {
    expect(processorConfigEntry("a", { executionTarget: "lambda" }, over)).toEqual({ nodeId: "a", executionTarget: "lambda", lambdaOverride: true });
    expect(processorConfigEntry("a", { executionTarget: "lambda" }, fits)).not.toHaveProperty("lambdaOverride");
    expect(processorConfigEntry("a", { executionTarget: "lambda" }, hard)).not.toHaveProperty("lambdaOverride");
    expect(processorConfigEntry("a", { executionTarget: "standard" }, over)).not.toHaveProperty("lambdaOverride");
    expect(processorConfigEntry("a", { executionTarget: "gpu" }, over)).not.toHaveProperty("lambdaOverride");
    expect(processorConfigEntry("a", { executionTarget: "lambda" })).not.toHaveProperty("lambdaOverride");
  });

  it("caps a Lambda step's memory at 10240, and only a Lambda step's", () => {
    expect(processorConfigEntry("a", { executionTarget: "lambda", memory: "16384" }, over).memory).toBe("10240");
    expect(processorConfigEntry("a", { executionTarget: "lambda", memory: "3008" }, fits).memory).toBe("3008");
    expect(processorConfigEntry("a", { executionTarget: "standard", memory: "16384" }, over).memory).toBe("16384");
  });
});

describe("lambdaMemory", () => {
  it("caps memory at Lambda's most", () => {
    expect(lambdaMemory("20000")).toBe("10240");
    expect(lambdaMemory(20000)).toBe("10240");
    expect(lambdaMemory("10240")).toBe("10240");
    expect(lambdaMemory("512")).toBe("512");
    expect(lambdaMemory("")).toBe("");
  });
});

describe("runsEmptyState", () => {
  const done = { status: "SUCCEEDED" };
  it("shows nothing while the first page loads", () => {
    expect(runsEmptyState({ loading: true, runs: [] })).toBe(null);
  });
  it("is empty with no runs, no more pages and no history", () => {
    expect(runsEmptyState({ runs: [] })).toBe("empty");
  });
  it("is idle with a history but none running", () => {
    expect(runsEmptyState({ runs: [done] })).toBe("idle");
    expect(runsEmptyState({ runs: [], hasMore: true })).toBe("idle");
    expect(runsEmptyState({ runs: [], hasHistory: true })).toBe("idle");
  });
  it("shows nothing while a run is queued, running or ending", () => {
    for (const status of RUNNING_STATUSES) expect(runsEmptyState({ runs: [done, { status }] })).toBe(null);
  });
  it("leaves a filtered list to its own no-results", () => {
    expect(runsEmptyState({ runs: [], filtered: true })).toBe(null);
    expect(runsEmptyState({ runs: [done], filtered: true })).toBe(null);
  });
  it("names the running statuses", () => {
    expect(RUNNING_STATUSES).toEqual(["NOT_STARTED", "STARTED", "FINALIZING"]);
    expect(isRunningStatus("STARTED")).toBe(true);
    expect(isRunningStatus("SUCCEEDED")).toBe(false);
  });
});
