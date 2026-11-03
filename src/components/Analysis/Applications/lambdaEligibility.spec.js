import { describe, it, expect } from "vitest";
import {
  appLambdaEligibility,
  lambdaEligibility,
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
    });
    expect(lambdaEligibility({ version: "v1", lambda: rec(false, ["image is 12 GB"]), manifest: man({ computeTypes: ["standard", "lambda"] }) })).toEqual({
      available: false,
      reasons: ["image is 12 GB"],
      known: true,
    });
  });

  it("falls back to the app.yml's computeTypes without a record", () => {
    expect(lambdaEligibility({ manifest: man({ computeTypes: ["standard", "lambda"] }) })).toEqual({ available: true, reasons: [], known: false });
    expect(lambdaEligibility({ manifest: man({ computeTypes: ["standard"] }) })).toEqual({
      available: false,
      reasons: [LAMBDA_UNCHECKED_REASON],
      known: false,
    });
    expect(lambdaEligibility({})).toMatchObject({ available: false, known: false });
    expect(lambdaEligibility(null)).toEqual({ available: false, reasons: [], known: false });
  });

  it("honours the author's opt-out", () => {
    expect(lambdaEligibility({ manifest: man({ computeTypes: ["lambda"], optimize: false }) })).toEqual({
      available: false,
      reasons: [LAMBDA_OPT_OUT_REASON],
      known: false,
    });
    expect(lambdaEligibility({ lambda: rec(true), manifest: man({ optimize: false }) })).toEqual({
      available: false,
      reasons: [LAMBDA_OPT_OUT_REASON],
      known: true,
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
