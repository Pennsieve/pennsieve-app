import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRunCost, clearRunCosts, costParts } from "./runDetails";

const getToken = () => Promise.resolve("tok");
const ok = (body) => ({ ok: true, json: () => Promise.resolve(body) });

beforeEach(clearRunCosts);

describe("fetchRunCost", () => {
  it("reads the run's estimated cost once", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ metrics: { totalEstimatedCost: 0.42 } }));
    expect(await fetchRunCost("https://api2", "r1", { getToken, fetchFn })).toBe(0.42);
    expect(await fetchRunCost("https://api2", "r1", { getToken, fetchFn })).toBe(0.42);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toBe("https://api2/compute/workflows/runs/r1");
  });

  it("tries again when the metrics aren't in yet", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(ok({})).mockResolvedValueOnce(ok({ metrics: { totalEstimatedCost: 1 } }));
    expect(await fetchRunCost("https://api2", "r2", { getToken, fetchFn })).toBeNull();
    expect(await fetchRunCost("https://api2", "r2", { getToken, fetchFn })).toBe(1);
  });
});

describe("costParts", () => {
  it("lists the non-zero parts", () => {
    const run = { metrics: { costEstimate: { ecs: { estimatedCost: 0.3 }, lambda: { estimatedCost: 0 }, data: { estimatedCost: 0.01 } } } };
    expect(costParts(run)).toEqual([
      { label: "Compute (ECS)", cost: 0.3 },
      { label: "Data transfer", cost: 0.01 },
    ]);
    expect(costParts({})).toEqual([]);
  });

  it("adds up to the total, storage and GPU included", () => {
    // Run 7e355b88's estimate, as the finalizer sends it.
    const costEstimate = {
      ecs: { estimatedCost: 0.122045 },
      gpu: { estimatedCost: 0 },
      lambda: { estimatedCost: 0.002513 },
      data: { estimatedCost: 0 },
      stepFunctions: { estimatedCost: 0.0013 },
      cloudWatchLogs: { estimatedCost: 0.000054 },
      efsStorage: { estimatedCost: 0.000636 },
      llm: { estimatedCost: 0 },
      totalEstimatedCost: 0.126548,
    };
    const sum = costParts({ metrics: { costEstimate } }).reduce((t, p) => t + p.cost, 0);
    expect(sum).toBeCloseTo(costEstimate.totalEstimatedCost, 6);
    expect(costParts({ metrics: { costEstimate: { gpu: { estimatedCost: 1.2 } } } })).toEqual([{ label: "GPU", cost: 1.2 }]);
  });
});
