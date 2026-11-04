import { describe, it, expect } from "vitest";
import { feedbackText, fitsLambdaWithHeadroom, stepLambdaFeedback, suggestLambdaLimits } from "./lambdaFeedback";

const over = { available: false, overridable: true, known: true, reasons: ["memory 16384 MB is over 10240"] };

describe("suggestLambdaLimits", () => {
  it("suggests 1.5x the peak in 512 MB steps and 3x the duration in minutes", () => {
    expect(suggestLambdaLimits({ peakMiB: 1000, durationSec: 130 })).toEqual({ memory: 1536, timeoutSeconds: 420 });
  });
  it("keeps to the bounds", () => {
    expect(suggestLambdaLimits({ peakMiB: 10, durationSec: 5 })).toEqual({ memory: 512, timeoutSeconds: 300 });
    expect(suggestLambdaLimits({ peakMiB: 9000, durationSec: 600 })).toEqual({ memory: 10240, timeoutSeconds: 900 });
  });
  it("leaves out what isn't measured", () => {
    expect(suggestLambdaLimits({ durationSec: 100 })).toEqual({ timeoutSeconds: 300 });
    expect(suggestLambdaLimits({ peakMiB: 100 })).toEqual({ memory: 512 });
    expect(suggestLambdaLimits({})).toEqual({});
  });
  it("suggests only what's declared over Lambda's limits, when that's known", () => {
    expect(suggestLambdaLimits({ peakMiB: 1000, durationSec: 100, declaredMemory: 16384, declaredTimeout: 600 })).toEqual({ memory: 1536 });
    expect(suggestLambdaLimits({ peakMiB: 1000, durationSec: 100, declaredMemory: "4096", declaredTimeout: 3600 })).toEqual({ timeoutSeconds: 300 });
    expect(suggestLambdaLimits({ peakMiB: 1000, durationSec: 100, declaredMemory: 16384 })).toEqual({ memory: 1536, timeoutSeconds: 300 });
  });
});

describe("fitsLambdaWithHeadroom", () => {
  it("needs both measures, with room", () => {
    expect(fitsLambdaWithHeadroom(6826, 300)).toBe(true);
    expect(fitsLambdaWithHeadroom(7000, 100)).toBe(false);
    expect(fitsLambdaWithHeadroom(1000, 301)).toBe(false);
    expect(fitsLambdaWithHeadroom(null, 100)).toBe(false);
    expect(fitsLambdaWithHeadroom(1000, undefined)).toBe(false);
  });
});

describe("stepLambdaFeedback", () => {
  const metrics = { maxMemoryUsedMiB: 2048, durationSec: 95 };

  it("tells an overridden step that succeeded what limits would fit", () => {
    const f = stepLambdaFeedback({ status: "SUCCEEDED", executionTarget: "lambda", lambdaOverride: true, eligibility: over, metrics, declaredMemory: 16384 });
    expect(f.kind).toBe("override-succeeded");
    expect(feedbackText(f)).toBe(
      "This step ran on Lambda although its app.yml declares memory 16384 MB is over 10240. It used 2.0 GB and 95 s. To run it on Lambda without an override, lower its limits in app.yml, for example `memory: 3072` and `timeoutSeconds: 300`."
    );
  });

  it("falls back to the declared values, and to no example without metrics", () => {
    const f = stepLambdaFeedback({ status: "SUCCEEDED", executionTarget: "lambda", lambdaOverride: true, declaredMemory: 16384, declaredTimeout: 3600 });
    expect(feedbackText(f)).toBe(
      "This step ran on Lambda although its app.yml declares memory: 16384 and timeoutSeconds: 3600. To run it on Lambda without an override, lower its limits in app.yml."
    );
  });

  it("tells an overridden step that failed to run on standard", () => {
    const f = stepLambdaFeedback({ status: "FAILED", executionTarget: "lambda", lambdaOverride: true, eligibility: over, metrics });
    expect(f.kind).toBe("override-failed");
    expect(feedbackText(f)).toContain("Run it on standard.");
  });

  it("says nothing for a Lambda step without an override, or one still running", () => {
    expect(stepLambdaFeedback({ status: "SUCCEEDED", executionTarget: "lambda", eligibility: over, metrics })).toBeNull();
    expect(stepLambdaFeedback({ status: "STARTED", executionTarget: "lambda", lambdaOverride: true, metrics })).toBeNull();
  });

  describe("a step on standard that would fit Lambda", () => {
    const standard = (overrides = {}) =>
      stepLambdaFeedback({ status: "SUCCEEDED", executionTarget: "standard", eligibility: over, metrics, declaredMemory: 16384, ...overrides });

    it("suggests limits when its use fits with room", () => {
      const f = standard();
      expect(f.kind).toBe("standard-fits");
      expect(feedbackText(f)).toBe(
        "It looks like this app's app.yml limits are generous: this step used 2.0 GB and 95 s, but the app declares memory 16384 MB is over 10240, which keeps it off Lambda. Lowering them to `memory: 3072` and `timeoutSeconds: 300` would let Pennsieve run it on a faster runtime automatically."
      );
    });
    it("not when its use is too big or unknown", () => {
      expect(standard({ metrics: { maxMemoryUsedMiB: 8000, durationSec: 95 } })).toBeNull();
      expect(standard({ metrics: { maxMemoryUsedMiB: 2048, durationSec: 400 } })).toBeNull();
      expect(standard({ metrics: { durationSec: 95 } })).toBeNull();
      expect(standard({ metrics: null })).toBeNull();
    });
    it("not when the version fits Lambda already, or can't be overridden", () => {
      expect(standard({ eligibility: { available: true, overridable: false, reasons: [] } })).toBeNull();
      expect(standard({ eligibility: { available: false, overridable: false, reasons: ["image is 12 GB"] } })).toBeNull();
      expect(standard({ eligibility: null })).toBeNull();
    });
    it("not when it failed", () => {
      expect(standard({ status: "FAILED" })).toBeNull();
    });
  });
});
