import { describe, it, expect } from "vitest";
import { formatCost, graphStatusColor, nodeBorderColor, nodeMetricRows, statusMarkOf } from "./runHelpers";

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
