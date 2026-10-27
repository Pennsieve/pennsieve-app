import { describe, it, expect } from "vitest";
import { formatCost, graphStatusColor, nodeBorderColor, statusMarkOf } from "./runHelpers";

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
