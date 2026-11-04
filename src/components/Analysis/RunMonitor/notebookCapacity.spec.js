import { describe, it, expect, vi } from "vitest";
import { fetchNodeSessions, fetchNodesSessions, capacityLabel, capacityReason } from "./notebookCapacity";

const token = async () => "tok";
const ok = (body) => vi.fn(async () => ({ ok: true, json: async () => body }));

describe("notebook capacity", () => {
  it("reads a node's capacity", async () => {
    const fetchFn = ok({ max: 10, active: 3, mine: 1, maxPerUser: 2 });
    await expect(fetchNodeSessions("https://api2", "node-1", token, fetchFn)).resolves.toEqual({
      max: 10,
      active: 3,
      mine: 1,
      maxPerUser: 2,
    });
    expect(fetchFn).toHaveBeenCalledWith("https://api2/compute/workflows/compute-nodes/node-1/sessions", {
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("reads no capacity when the request fails, without throwing", async () => {
    await expect(fetchNodeSessions("x", "n", token, vi.fn(async () => ({ ok: false })))).resolves.toBeNull();
    await expect(fetchNodeSessions("x", "n", token, vi.fn(async () => { throw new Error("offline"); }))).resolves.toBeNull();
    await expect(fetchNodeSessions("x", "n", token, ok({ message: "not found" }))).resolves.toBeNull();
    await expect(fetchNodeSessions("x", "n", async () => { throw new Error("no session"); }, ok({ max: 1 }))).resolves.toBeNull();
  });

  it("reads every node's, a failed one as null", async () => {
    const fetchFn = vi.fn(async (url) =>
      url.includes("/a/") ? { ok: true, json: async () => ({ max: 4, active: 4, mine: 0, maxPerUser: 0 }) } : { ok: false }
    );
    await expect(fetchNodesSessions("x", [{ uuid: "a" }, { uuid: "b" }], token, fetchFn)).resolves.toEqual({
      a: { max: 4, active: 4, mine: 0, maxPerUser: 0 },
      b: null,
    });
    await expect(fetchNodesSessions("x", [], token, fetchFn)).resolves.toEqual({});
  });

  it("says how many are in use, and the caller's when there are any", () => {
    expect(capacityLabel({ max: 10, active: 3, mine: 0, maxPerUser: 0 })).toBe("3 of 10 notebooks in use");
    expect(capacityLabel({ max: 10, active: 3, mine: 2, maxPerUser: 0 })).toBe("3 of 10 notebooks in use · you have 2 open");
    expect(capacityLabel({ max: 1, active: 0, mine: 0, maxPerUser: 0 })).toBe("0 of 1 notebook in use");
    expect(capacityLabel(null)).toBe("");
    expect(capacityLabel({ max: 0, active: 0, mine: 0, maxPerUser: 0 })).toBe("");
  });

  it("says why a full node can't take another", () => {
    expect(capacityReason({ max: 4, active: 3, mine: 1, maxPerUser: 0 })).toBe("");
    expect(capacityReason({ max: 4, active: 4, mine: 0, maxPerUser: 0 })).toBe("Full — try again later");
    expect(capacityReason({ max: 4, active: 4, mine: 2, maxPerUser: 0 })).toBe("Full — try again later");
    expect(capacityReason({ max: 10, active: 2, mine: 1, maxPerUser: 1 })).toBe("You have the maximum open here");
    expect(capacityReason({ max: 2, active: 2, mine: 2, maxPerUser: 2 })).toBe("You have the maximum open here");
    expect(capacityReason({ max: 10, active: 2, mine: 1, maxPerUser: 2 })).toBe("");
    expect(capacityReason(null)).toBe("");
  });
});
