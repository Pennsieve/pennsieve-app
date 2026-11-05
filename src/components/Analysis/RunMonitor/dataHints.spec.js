import { describe, it, expect } from "vitest";
import { acceptsInput, dataRegions, nodeDataReason, nodeDataNote, dataSize, suggestedDisk, isImagingData } from "./dataHints";
import { NOTEBOOK_DISK_OPTIONS } from "./notebookHelpers";

const GiB = 2 ** 30;

describe("data hints", () => {
  it("offers the kernels that can take the data", () => {
    const withInput = { inputs: [{ name: "input" }], outputs: [{ name: "results" }] };
    const optional = { inputs: [{ name: "input", optional: true }], outputs: [] };
    const legacy = { name: "old" };
    expect(acceptsInput(withInput, "openNeuro")).toBe(true);
    expect(acceptsInput(withInput, "none")).toBe(false);
    expect(acceptsInput(optional, "none")).toBe(true);
    expect(acceptsInput(legacy, "dataset")).toBe(true);
    expect(acceptsInput(legacy, "openData")).toBe(false);
    expect(acceptsInput(legacy, "public", { personal: true })).toBe(true);
    expect(acceptsInput(legacy, "dataset", { personal: true })).toBe(false);
  });

  it("knows where public data lives, and which nodes can reach it", () => {
    expect(dataRegions("openNeuro")).toEqual(["us-east-1"]);
    expect(dataRegions("sparc")).toEqual(["us-east-1"]);
    expect(dataRegions("epilepsyScience")).toEqual(["us-east-1"]);
    expect(dataRegions("openData", { openDataDataset: { regions: ["us-west-2"] } })).toEqual(["us-west-2"]);
    expect(dataRegions("public")).toEqual([]);
    const east = { deploymentMode: "Compliant", region: "us-east-1" };
    const west = { deploymentMode: "compliant", region: "us-west-2" };
    expect(nodeDataReason(east, "public")).toBe("");
    expect(nodeDataReason(west, "public")).toBe("");
    expect(nodeDataReason({ deploymentMode: "secure", region: "us-west-2" }, "openNeuro")).toBe("");
    // A compliant node reaches the anonymous Open Data buckets in its region.
    expect(nodeDataReason(east, "openNeuro")).toBe("");
    expect(nodeDataReason(east, "sparc")).toBe("");
    expect(nodeDataReason(east, "epilepsyScience")).toBe("");
    expect(nodeDataReason(west, "sparc")).toBe(
      "Can't reach data in us-east-1 (no internet access: only public data in us-west-2)"
    );
    const openData = (d) => nodeDataReason(east, "openData", { openDataDataset: d });
    expect(openData({ anonymous: true, regions: ["us-east-1"] })).toBe("");
    expect(openData({ anonymous: true, regions: ["us-east-2", "eu-west-1"] })).toBe(
      "Can't reach data in us-east-2, eu-west-1 (no internet access: only public data in us-east-1)"
    );
    expect(openData({ anonymous: false, regions: ["us-east-1"] })).toMatch(/Can't reach data in us-east-1/);
    expect(openData(null)).toMatch(/Can't reach this data/);
    expect(nodeDataNote({ region: "us-east-1" }, ["us-west-2"])).toMatch(/us-west-2.*us-east-1/);
    expect(nodeDataNote({ region: "us-west-2" }, ["us-west-2"])).toBe("");
    expect(nodeDataNote({}, ["us-west-2"])).toBe("");
  });

  it("suggests a disk for the data", () => {
    expect(dataSize("openNeuro", { openNeuroDataset: { size: 5 * GiB } })).toBe(5 * GiB);
    expect(dataSize("openData", {})).toBeNull();
    expect(suggestedDisk(2 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(64);
    expect(suggestedDisk(80 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(128);
    expect(suggestedDisk(150 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(200);
    expect(suggestedDisk(900 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(200);
    expect(suggestedDisk(null, NOTEBOOK_DISK_OPTIONS)).toBeNull();
  });

  it("tells imaging data", () => {
    expect(isImagingData("openNeuro", { openNeuroDataset: { modalities: ["mri"] } })).toBe(true);
    expect(isImagingData("openNeuro", { openNeuroDataset: { modalities: ["eeg"] } })).toBe(false);
    expect(isImagingData("openData", { openDataDataset: { keywords: ["biology", "Imaging"] } })).toBe(true);
    expect(isImagingData("sparc", { portalDataset: { keywords: ["mouse", "microscopy"] } })).toBe(true);
    expect(isImagingData("epilepsyScience", { portalDataset: { keywords: ["ieeg"] } })).toBe(false);
    expect(isImagingData("public", {})).toBe(false);
  });
});
