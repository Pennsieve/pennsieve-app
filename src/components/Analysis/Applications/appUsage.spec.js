import { describe, it, expect } from "vitest";
import { sizingHint, usageRows, usageSummary } from "./appUsage";

const v = {
  version: "v0.1.0", runs: 11, steps: 12, succeeded: 11, failed: 1, lastRunAt: "2026-10-28T22:04:41Z",
  memoryGivenMiB: 12288, cpuGivenUnits: 2048,
  memoryUsedMiB: { p50: 3835, p95: 4900, max: 4900, samples: 11 },
  cpuUsedUnits: { p50: 1947, p95: 2010, max: 2040, samples: 11 },
  durationSec: { p50: 177, p95: 190, max: 195, samples: 11 },
};

describe("usageRows", () => {
  it("shows used as median · 95th beside what was given, in the units of the receipt", () => {
    const [row] = usageRows({ versions: [v] });
    expect(row.version).toBe("v0.1.0");
    expect(row.memoryGiven).toBe("12,288 MiB");
    expect(row.memoryUsed).toBe("3,835 MiB · 4,900 MiB");
    expect(row.cpuGiven).toBe("2.0 vCPU");
    expect(row.cpuUsed).toBe("1.9 vCPU · 2.0 vCPU");
    expect(row.duration).toBe("2m 57s · 3m 10s");
    expect(row.runs).toBe(11);
  });
  it("leaves usage blank for a version without a sampled step", () => {
    const [row] = usageRows({ versions: [{ version: "v0.2.0", runs: 1, steps: 1, memoryGivenMiB: 512, memoryUsedMiB: { samples: 0 }, cpuUsedUnits: { samples: 0 }, durationSec: { p50: 40, p95: 40, samples: 1 } }] });
    expect(row.memoryUsed).toBe("");
    expect(row.duration).toBe("40s · 40s");
  });
});

describe("sizingHint", () => {
  it("suggests a smaller size when the 95th percentile is under half of what is given", () => {
    expect(sizingHint(v)).toBe("v0.1.0 is given 12,288 MiB and 95% of its 11 steps peaked under 4,900 MiB: 7,168 MiB would do.");
  });
  it("warns when a version runs close to its memory, and says nothing on a fit or too few samples", () => {
    expect(sizingHint({ ...v, memoryUsedMiB: { p95: 11500, samples: 5 } })).toMatch(/Give it more/);
    expect(sizingHint({ ...v, memoryUsedMiB: { p95: 8000, samples: 5 } })).toBe("");
    expect(sizingHint({ ...v, memoryUsedMiB: { p95: 1000, samples: 2 } })).toBe("");
    expect(sizingHint({ ...v, memoryGivenMiB: 512, memoryUsedMiB: { p95: 42, samples: 5 } })).toBe("", "already at the smallest size");
  });
});

describe("usageSummary", () => {
  it("counts runs and steps, and is empty without runs", () => {
    expect(usageSummary({ runs: 11, steps: 12 })).toMatch(/^Across 11 runs \(12 steps\)/);
    expect(usageSummary({ runs: 1, steps: 1 })).toMatch(/^Across 1 run:/);
    expect(usageSummary({ runs: 0 })).toBe("");
  });
});
