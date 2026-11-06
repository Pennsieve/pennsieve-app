import { describe, it, expect } from "vitest";
import { acceptsInput, nodeDataReason, nodeDataNote, suggestedDisk } from "./dataHints";
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

  it("tells which nodes can reach the data", () => {
    expect(nodeDataReason({ deploymentMode: "Compliant" }, { publicBucket: true })).toMatch(/public data/);
    expect(nodeDataReason({ deploymentMode: "compliant" }, { publicBucket: false })).toBe("");
    expect(nodeDataReason({ deploymentMode: "secure" }, { publicBucket: true })).toBe("");
    expect(nodeDataNote({ region: "us-east-1" }, ["us-west-2"])).toMatch(/us-west-2.*us-east-1/);
    expect(nodeDataNote({ region: "us-west-2" }, ["us-west-2"])).toBe("");
    expect(nodeDataNote({}, ["us-west-2"])).toBe("");
    // Its region from its queue, as account-service sends it.
    expect(nodeDataNote({ queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q" }, ["us-west-2"])).toMatch(/node in us-east-1/);
  });

  it("suggests a disk for the data", () => {
    expect(suggestedDisk(2 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(64);
    expect(suggestedDisk(80 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(128);
    expect(suggestedDisk(150 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(200);
    expect(suggestedDisk(900 * GiB, NOTEBOOK_DISK_OPTIONS)).toBe(200);
    expect(suggestedDisk(null, NOTEBOOK_DISK_OPTIONS)).toBeNull();
  });
});
