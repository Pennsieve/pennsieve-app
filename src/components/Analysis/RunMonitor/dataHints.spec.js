import { describe, it, expect } from "vitest";
import { acceptsInput, nodeDataReason, nodeDataNote, dataUnreachable, suggestedDisk } from "./dataHints";
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

  it("lets a compliant node read public data in its own region only", () => {
    const compliant = { deploymentMode: "Compliant", queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q" };
    expect(nodeDataReason(compliant, { publicBucket: true, regions: ["us-east-1"] })).toBe("");
    expect(nodeDataReason(compliant, { publicBucket: true, regions: ["us-west-2"] })).toBe(
      "Can't reach data in us-west-2 (no internet access: only public data in us-east-1)"
    );
    // Data in its region and another's, or where its region isn't known.
    expect(nodeDataReason(compliant, { publicBucket: true, regions: ["us-east-1", "us-west-2"] })).not.toBe("");
    expect(nodeDataReason(compliant, { publicBucket: true, regions: [] })).toMatch(/Can't reach this data/);
    expect(nodeDataReason({ deploymentMode: "compliant" }, { publicBucket: true, regions: ["us-east-1"] })).toMatch(/only public data in its region/);
    // Pennsieve's own data isn't in a public bucket.
    expect(nodeDataReason(compliant, { publicBucket: false, regions: [] })).toBe("");
  });

  it("says when none of the user's nodes can reach the data", () => {
    const east = { deploymentMode: "compliant", queueUrl: "https://sqs.us-east-1.amazonaws.com/1/q" };
    const basic = { deploymentMode: "basic" };
    const west = { publicBucket: true, regions: ["us-west-2"] };
    expect(dataUnreachable([east], west)).toBe("Not reachable from your compute nodes (us-west-2)");
    expect(dataUnreachable([east, basic], west)).toBe("");
    expect(dataUnreachable([], west)).toBe("");
  });

  it("tells which nodes can reach the data", () => {
    expect(nodeDataReason({ deploymentMode: "Compliant" }, { publicBucket: true })).toMatch(/Can't reach/);
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
