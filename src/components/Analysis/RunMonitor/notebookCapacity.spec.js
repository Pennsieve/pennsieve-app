import { describe, it, expect, vi } from "vitest";
import { fetchNodeSessions, fetchNodesSessions, capacityLabel, capacityReason } from "./notebookCapacity";

const token = async () => "tok";
const ok = (body) => vi.fn(async () => ({ ok: true, json: async () => body }));
const cap = (over = {}) => ({ enabled: true, max: 10, active: 0, mine: 0, maxPerUser: null, ...over });

describe("notebook capacity", () => {
  it("reads a node's capacity", async () => {
    const fetchFn = ok({ enabled: true, max: 10, active: 3, mine: 1, maxPerUser: 2 });
    await expect(fetchNodeSessions("https://api2", "node-1", token, fetchFn)).resolves.toEqual({
      enabled: true,
      max: 10,
      active: 3,
      mine: 1,
      maxPerUser: 2,
    });
    expect(fetchFn).toHaveBeenCalledWith("https://api2/compute/workflows/compute-nodes/node-1/sessions", {
      headers: { Authorization: "Bearer tok" },
    });
  });

  it("reads a missing per-user limit as none, and keeps a 0", async () => {
    await expect(
      fetchNodeSessions("x", "n", token, ok({ enabled: true, max: 4, active: 0, mine: 0, maxPerUser: null }))
    ).resolves.toMatchObject({ maxPerUser: null });
    await expect(
      fetchNodeSessions("x", "n", token, ok({ enabled: true, max: 4, active: 0, mine: 0, maxPerUser: 0 }))
    ).resolves.toMatchObject({ maxPerUser: 0 });
  });

  it("reads enabled from max when an older response has no enabled", async () => {
    await expect(fetchNodeSessions("x", "n", token, ok({ max: 4, active: 1, mine: 0 }))).resolves.toMatchObject({
      enabled: true,
      maxPerUser: null,
    });
    await expect(fetchNodeSessions("x", "n", token, ok({ max: 0 }))).resolves.toMatchObject({ enabled: false });
  });

  it("reads no capacity when the request fails, without throwing", async () => {
    await expect(fetchNodeSessions("x", "n", token, vi.fn(async () => ({ ok: false })))).resolves.toBeNull();
    await expect(fetchNodeSessions("x", "n", token, vi.fn(async () => { throw new Error("offline"); }))).resolves.toBeNull();
    await expect(fetchNodeSessions("x", "n", token, ok({ message: "not found" }))).resolves.toBeNull();
    await expect(fetchNodeSessions("x", "n", async () => { throw new Error("no session"); }, ok({ max: 1 }))).resolves.toBeNull();
  });

  it("reads every node's, a failed one as null", async () => {
    const fetchFn = vi.fn(async (url) =>
      url.includes("/a/")
        ? { ok: true, json: async () => ({ enabled: true, max: 4, active: 4, mine: 0, maxPerUser: null }) }
        : { ok: false }
    );
    await expect(fetchNodesSessions("x", [{ uuid: "a" }, { uuid: "b" }], token, fetchFn)).resolves.toEqual({
      a: { enabled: true, max: 4, active: 4, mine: 0, maxPerUser: null },
      b: null,
    });
    await expect(fetchNodesSessions("x", [], token, fetchFn)).resolves.toEqual({});
  });

  it("says how many are in use, and the caller's when there are any", () => {
    expect(capacityLabel(cap({ active: 3 }))).toBe("3 of 10 notebooks in use");
    expect(capacityLabel(cap({ active: 3, mine: 2 }))).toBe("3 of 10 notebooks in use · you have 2 open");
    expect(capacityLabel(cap({ max: 1 }))).toBe("0 of 1 notebook in use");
    expect(capacityLabel(null)).toBe("");
    expect(capacityLabel(cap({ enabled: false, max: 0 }))).toBe("");
    expect(capacityLabel(cap({ max: 0 })), "a node-wide limit of 0 is a reason, not a count").toBe("");
  });

  it("says why a full node can't take another", () => {
    expect(capacityReason(cap({ max: 4, active: 3, mine: 1 }))).toBe("");
    expect(capacityReason(cap({ max: 4, active: 4 }))).toBe("Full — try again later");
    expect(capacityReason(cap({ max: 4, active: 4, mine: 2 }))).toBe("Full — try again later");
    expect(capacityReason(cap({ active: 2, mine: 1, maxPerUser: 1 }))).toBe("You have the maximum open here");
    expect(capacityReason(cap({ max: 2, active: 2, mine: 2, maxPerUser: 2 }))).toBe("You have the maximum open here");
    expect(capacityReason(cap({ active: 2, mine: 1, maxPerUser: 2 }))).toBe("");
    expect(capacityReason(cap({ maxPerUser: 0 }))).toBe("Notebooks not allowed for you here");
    expect(capacityReason(cap({ max: 0 }))).toBe("No notebooks allowed here");
    expect(capacityReason(cap({ enabled: false, max: 0 }))).toBe("");
    expect(capacityReason(null)).toBe("");
  });
});
