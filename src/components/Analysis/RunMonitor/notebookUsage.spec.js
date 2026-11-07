import { describe, it, expect } from "vitest";
import { notebookUsage, sessionCost, sessionTime } from "./notebookUsage";

describe("notebook usage", () => {
  it("reads the notebook share of the counters", () => {
    expect(notebookUsage({ interactive: { allTime: { totalRuns: 14, totalDurationSec: 7200, totalCost: 0.05 } } })).toEqual({
      sessions: 14,
      seconds: 7200,
      cost: 0.05,
    });
    expect(notebookUsage({ allTime: { totalRuns: 3 } })).toBeNull();
    expect(notebookUsage(null)).toBeNull();
  });

  it("says time to the minute", () => {
    expect(sessionTime(40)).toBe("40 s");
    expect(sessionTime(720)).toBe("12 min");
    expect(sessionTime(3 * 3600 + 5 * 60)).toBe("3 h 5 min");
    expect(sessionTime(7200)).toBe("2 h");
    expect(sessionTime(41 * 3600 + 20 * 60)).toBe("41 h");
  });

  it("says cost to the cent", () => {
    expect(sessionCost(0)).toBe("$0");
    expect(sessionCost(0.0005)).toBe("<$0.01");
    expect(sessionCost(1.234)).toBe("$1.23");
  });
});
