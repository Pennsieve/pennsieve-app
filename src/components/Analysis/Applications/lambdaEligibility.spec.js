import { describe, it, expect } from "vitest";
import {
  appLambdaEligibility,
  lambdaEligibility,
  lambdaOverrideWarning,
  lambdaStatusLabel,
  lambdaUnavailableHint,
  withLambdaChoice,
  LAMBDA_OPT_OUT_REASON,
  LAMBDA_UNCHECKED_REASON,
} from "./lambdaEligibility";

const rec = (eligible, reasons = []) => ({ eligible, reasons, imageBytes: 123, checkedAt: "2026-11-03T00:00:00Z" });
const man = (runtime) => ({ name: "x", runtime });

describe("lambdaEligibility", () => {
  it("goes by the version's record when there is one", () => {
    expect(lambdaEligibility({ version: "v1", lambda: rec(true), manifest: man({ computeTypes: ["standard"] }) })).toEqual({
      available: true,
      reasons: [],
      known: true,
      overridable: false,
    });
    expect(lambdaEligibility({ version: "v1", lambda: rec(false, ["image is 12 GB"]), manifest: man({ computeTypes: ["standard", "lambda"] }) })).toEqual({
      available: false,
      reasons: ["image is 12 GB"],
      known: true,
      overridable: false,
    });
  });

  it("falls back to the app.yml's computeTypes without a record", () => {
    expect(lambdaEligibility({ manifest: man({ computeTypes: ["standard", "lambda"] }) })).toEqual({ available: true, reasons: [], known: false, overridable: false });
    expect(lambdaEligibility({ manifest: man({ computeTypes: ["standard"] }) })).toEqual({
      available: false,
      reasons: [LAMBDA_UNCHECKED_REASON],
      known: false,
      overridable: false,
    });
    expect(lambdaEligibility({})).toMatchObject({ available: false, known: false });
    expect(lambdaEligibility(null)).toEqual({ available: false, reasons: [], known: false, overridable: false });
  });

  it("honours the author's opt-out", () => {
    expect(lambdaEligibility({ manifest: man({ computeTypes: ["lambda"], optimize: false }) })).toEqual({
      available: false,
      reasons: [LAMBDA_OPT_OUT_REASON],
      known: false,
      overridable: false,
    });
    expect(lambdaEligibility({ lambda: rec(true), manifest: man({ optimize: false }) })).toEqual({
      available: false,
      reasons: [LAMBDA_OPT_OUT_REASON],
      known: true,
      overridable: false,
    });
  });

  it("lets a variant's record win over the version's, stored as a map or a list", () => {
    const variants = {
      cpu: { lambda: rec(true), manifest: man({ computeTypes: ["standard"] }) },
      gpu: { lambda: rec(false, ["needs a GPU"]), manifest: man({ computeTypes: ["gpu"] }) },
    };
    const version = { lambda: rec(true), defaultVariant: "cpu", variants, manifest: man({}) };
    expect(lambdaEligibility(version, "gpu")).toMatchObject({ available: false, reasons: ["needs a GPU"], known: true });
    expect(lambdaEligibility(version, "cpu").available).toBe(true);
    const listed = { ...version, variants: Object.entries(variants).map(([id, v]) => ({ id, ...v })) };
    expect(lambdaEligibility(listed, "gpu").available).toBe(false);
    // The variant entry itself works too.
    expect(lambdaEligibility(listed, listed.variants[1]).available).toBe(false);
  });

  it("uses the version's record for a variant without one, else the default variant's", () => {
    const version = { lambda: rec(false, ["too big"]), variants: [{ id: "a", manifest: man({}) }] };
    expect(lambdaEligibility(version, "a")).toMatchObject({ available: false, reasons: ["too big"], known: true });
    const noOwn = { defaultVariant: "a", variants: [{ id: "a", lambda: rec(true) }], manifest: man({}) };
    expect(lambdaEligibility(noOwn).available).toBe(true);
  });

  it("says when a run may override a version that doesn't fit", () => {
    const over = { ...rec(false, ["memory 16384 MB is over 10240"]), overridable: true };
    expect(lambdaEligibility({ lambda: over, manifest: man({}) })).toEqual({
      available: false,
      reasons: ["memory 16384 MB is over 10240"],
      known: true,
      overridable: true,
    });
    // Not without the record's say-so, nor when it fits anyway.
    expect(lambdaEligibility({ lambda: rec(false, ["image is 12 GB"]), manifest: man({}) }).overridable).toBe(false);
    expect(lambdaEligibility({ lambda: { ...rec(true), overridable: true }, manifest: man({}) }).overridable).toBe(false);
    expect(lambdaEligibility({ lambda: { ...over, overridable: "yes" }, manifest: man({}) }).overridable).toBe(false);
    // The author's opt-out can't be overridden.
    expect(lambdaEligibility({ lambda: over, manifest: man({ optimize: false }) }).overridable).toBe(false);
    // Nor a version without a record.
    expect(lambdaEligibility({ manifest: man({ computeTypes: ["standard"] }) }).overridable).toBe(false);
    // A variant's record decides for it.
    const version = { lambda: rec(true), variants: [{ id: "big", lambda: over }], manifest: man({}) };
    expect(lambdaEligibility(version, "big")).toMatchObject({ available: false, overridable: true });
  });

  it("reads a variant's own manifest for the fallback", () => {
    const version = { manifest: man({ computeTypes: ["standard"] }), variants: [{ id: "l", manifest: man({ computeTypes: ["lambda"] }) }] };
    expect(lambdaEligibility(version, "l").available).toBe(true);
    expect(lambdaEligibility(version).available).toBe(false);
  });
});

describe("appLambdaEligibility", () => {
  const app = {
    versions: [
      { version: "v1", createdAt: "2026-01-01", lambda: rec(true), manifest: man({}) },
      { version: "v2", createdAt: "2026-02-01", lambda: rec(false, ["too slow"]), manifest: man({}) },
    ],
  };
  it("takes the tagged version, else the newest with a manifest", () => {
    expect(appLambdaEligibility(app, "v1").available).toBe(true);
    expect(appLambdaEligibility(app).available).toBe(false);
    expect(appLambdaEligibility(null)).toMatchObject({ available: false });
  });
});

describe("labels", () => {
  it("says why Lambda can't be chosen", () => {
    expect(lambdaUnavailableHint({ available: true, reasons: [] })).toBe("");
    expect(lambdaUnavailableHint({ available: false, reasons: ["a", "b"] })).toBe("Lambda isn't available for this version: a; b.");
    expect(lambdaUnavailableHint({ available: false, reasons: [] })).toContain("doesn't fit Lambda");
  });
  it("warns what an override risks", () => {
    expect(lambdaOverrideWarning({ available: false, overridable: true, reasons: ["memory 16 GB", "timeout 30 min"] })).toBe(
      "This app declares memory 16 GB; timeout 30 min. A Lambda step gets at most 10 GB and runs at most 14 minutes; a step past either fails."
    );
    expect(lambdaOverrideWarning({ available: false, overridable: false, reasons: ["x"] })).toBe("");
    expect(lambdaOverrideWarning({ available: true, overridable: false, reasons: [] })).toBe("");
    expect(lambdaOverrideWarning(null)).toBe("");
  });
  it("labels the app page's status", () => {
    expect(lambdaStatusLabel({ available: true, reasons: [], known: true })).toBe("available");
    expect(lambdaStatusLabel({ available: false, reasons: ["too big"], known: true })).toBe("not available: too big");
    expect(lambdaStatusLabel({ available: false, reasons: [LAMBDA_UNCHECKED_REASON], known: false })).toBe("not checked yet");
    expect(lambdaStatusLabel({ available: true, reasons: [], known: false })).toContain("not checked yet");
    expect(lambdaStatusLabel({ available: false, reasons: [LAMBDA_OPT_OUT_REASON], known: false })).toBe(`not available: ${LAMBDA_OPT_OUT_REASON}`);
  });
  it("always lists lambda among a step's choices", () => {
    expect(withLambdaChoice(["standard"])).toEqual(["standard", "lambda"]);
    expect(withLambdaChoice(["gpu", "standard"])).toEqual(["standard", "lambda", "gpu"]);
    expect(withLambdaChoice([])).toEqual(["standard", "lambda"]);
  });
});
