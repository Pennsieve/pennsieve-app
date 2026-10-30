import { describe, it, expect, beforeEach } from "vitest";
import { fetchVariantGate, provisionerGateReason, resetVariantGate, runsNonDefaultVariant } from "./variantGate";
import { nodeUnfit } from "./runSetup";

const gate = { min: "v1.26.0", allowUnversioned: false };

describe("provisioner gate", () => {
  it("passes nodes on the minimum or later", () => {
    expect(provisionerGateReason({ provisionerImageTag: "v1.26.0" }, gate)).toBe("");
    expect(provisionerGateReason({ provisionerImageTag: "v1.30.2" }, gate)).toBe("");
    expect(provisionerGateReason({ provisionerImageTag: "1.27.0" }, gate)).toBe("");
  });

  it("refuses older and unversioned nodes, with why", () => {
    expect(provisionerGateReason({ provisionerImageTag: "v1.24.0" }, gate)).toBe(
      "Provisioner v1.24.0; app variants need v1.26.0 or later, update the node"
    );
    expect(provisionerGateReason({ provisionerImageTag: "latest" }, gate)).toMatch(/^Provisioner latest;/);
    expect(provisionerGateReason({}, gate)).toMatch(/^Provisioner version unknown;/);
  });

  it("admits unversioned nodes where allowed, and refuses nothing without a minimum", () => {
    expect(provisionerGateReason({ provisionerImageTag: "latest" }, { ...gate, allowUnversioned: true })).toBe("");
    expect(provisionerGateReason({ provisionerImageTag: "v1.24.0" }, { ...gate, allowUnversioned: true })).not.toBe("");
    expect(provisionerGateReason({ provisionerImageTag: "v1.0.0" }, { min: "" })).toBe("");
    expect(provisionerGateReason({ provisionerImageTag: "v1.0.0" }, null)).toBe("");
  });

  it("refuses every versioned node while the minimum is a placeholder, as the server does", () => {
    const placeholder = { min: "TBD-PROV-1", allowUnversioned: false };
    expect(provisionerGateReason({ provisionerImageTag: "v9.0.0" }, placeholder)).toBe(
      "App variants aren't enabled on compute nodes yet"
    );
    expect(provisionerGateReason({ provisionerImageTag: "latest" }, placeholder)).toMatch(/^Provisioner latest;/);
    expect(provisionerGateReason({ provisionerImageTag: "latest" }, { ...placeholder, allowUnversioned: true })).toBe("");
  });
});

describe("non-default variants", () => {
  const app = {
    versions: [{ version: "v0.3.0", createdAt: "x", manifest: {}, defaultVariant: "cpu", variants: [{ id: "cpu", default: true }, { id: "gpu" }] }],
  };
  it("are steps naming a variant other than the version's default", () => {
    expect(runsNonDefaultVariant({ tag: "v0.3.0", variant: "gpu" }, app)).toBe(true);
    expect(runsNonDefaultVariant({ tag: "v0.3.0", variant: "cpu" }, app)).toBe(false);
    expect(runsNonDefaultVariant({ tag: "v0.3.0" }, app)).toBe(false);
    // An app not known here: as the server would decide.
    expect(runsNonDefaultVariant({ tag: "v0.3.0", variant: "gpu" }, null)).toBe(true);
  });

  it("make the run dialog grey out nodes that fail the gate", () => {
    const steps = [{ id: "a", type: "processor" }, { id: "b", type: "processor" }];
    const old = { status: "Enabled", provisionerImageTag: "v1.24.0" };
    expect(nodeUnfit(old, steps, () => null, () => "", { nonDefaultVariant: (id) => id === "b", gate })).toEqual([
      "Provisioner v1.24.0; app variants need v1.26.0 or later, update the node",
    ]);
    // The default variant everywhere: any provisioner.
    expect(nodeUnfit(old, steps, () => null, () => "", { nonDefaultVariant: () => false, gate })).toEqual([]);
    // The gate not known: nothing refused here.
    expect(nodeUnfit(old, steps, () => null, () => "", { nonDefaultVariant: () => true, gate: null })).toEqual([]);
  });
});

describe("the gate's settings", () => {
  beforeEach(resetVariantGate);
  const token = async () => "t";

  it("come from workflow-service's config, read once", async () => {
    let calls = 0;
    const fetchFn = async (url) => {
      calls += 1;
      expect(url).toBe("https://api2/compute/workflows/config");
      return { ok: true, json: async () => ({ variants: { minProvisionerVersion: "v1.26.0", allowUnversionedProvisioner: true } }) };
    };
    expect(await fetchVariantGate("https://api2", token, fetchFn)).toEqual({ min: "v1.26.0", allowUnversioned: true });
    await fetchVariantGate("https://api2", token, fetchFn);
    expect(calls).toBe(1);
  });

  it("are off where the config isn't served", async () => {
    expect(await fetchVariantGate("https://api2", token, async () => ({ ok: false }))).toEqual({ min: "", allowUnversioned: false });
    resetVariantGate();
    expect(
      await fetchVariantGate("https://api2", token, async () => {
        throw new Error("offline");
      })
    ).toEqual({ min: "", allowUnversioned: false });
  });
});
