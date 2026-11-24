import { describe, expect, it, vi } from "vitest";
import { createPennsieveBackend, normalizeTargetTypes, runTenant } from "./pennsieveBackend";

const API2 = "https://api2.test";
const ok = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

function backendWith(responses, scope = { kind: "workspace", organizationId: "N:organization:abc" }) {
  const calls = [];
  const fetchFn = vi.fn(async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error(`unexpected fetch ${url}`);
    return r;
  });
  const backend = createPennsieveBackend({
    endpoints: { api2Url: API2 },
    scope: () => scope,
    getToken: async () => "access",
    getTokens: async () => ({ accessToken: "access", refreshToken: "refresh" }),
    fetchFn,
  });
  return { backend, calls };
}

describe("runTenant", () => {
  it("names the workspace or the user by uuid", () => {
    expect(runTenant({ kind: "workspace", organizationId: "N:organization:abc" })).toBe("ORG#abc");
    expect(runTenant({ kind: "user", userId: "N:user:u1" })).toBe("USER#u1");
    expect(runTenant(null)).toBeUndefined();
  });
});

describe("pennsieve backend", () => {
  it("scopes compute nodes to the workspace, and not outside one", async () => {
    const ws = backendWith([ok({ nodes: [{ uuid: "n1" }] })]);
    expect(await ws.backend.listComputeNodes()).toEqual([{ uuid: "n1" }]);
    expect(ws.calls[0].url).toBe(`${API2}/compute/resources/compute-nodes?organization_id=N%3Aorganization%3Aabc`);
    expect(ws.calls[0].init.headers.Authorization).toBe("Bearer access");

    const me = backendWith([ok([{ uuid: "n2" }])], { kind: "user", userId: "N:user:u1" });
    expect(await me.backend.listComputeNodes()).toEqual([{ uuid: "n2" }]);
    expect(me.calls[0].url).toBe(`${API2}/compute/resources/compute-nodes`);
  });

  it("reports session/connect status without throwing until it's up", async () => {
    const { backend } = backendWith([ok({}, 404), ok({}, 202), ok({ kernelUrl: "https://k", token: "t" })]);
    expect(await backend.connectSession("r1")).toEqual({ status: 404 });
    expect(await backend.connectSession("r1")).toEqual({ status: 202 });
    expect(await backend.connectSession("r1")).toEqual({ status: 200, connection: { kernelUrl: "https://k", token: "t" } });
  });

  it("starts a run for the scope's tenant with the refresh token", async () => {
    const { backend, calls } = backendWith([ok({ executionRunId: "r1" })], { kind: "user", userId: "N:user:u1" });
    await backend.createRun({ workflowInstanceConfiguration: { workflowId: "w", computeNodeId: "n" }, dataSources: {} });
    expect(JSON.parse(calls[0].init.body).tenant).toBe("USER#u1");
    expect(calls[0].init.headers["X-Refresh-Token"]).toBe("refresh");
  });

  it("passes the service's message when a run can't start", async () => {
    const { backend } = backendWith([ok({ message: "node is full" }, 409)]);
    await expect(backend.createRun({})).rejects.toThrow("node is full");
  });

  it("reads every page of definitions and merges the public and workspace lists", async () => {
    const { backend, calls } = backendWith([
      ok({ workflows: [{ uuid: "a" }], nextCursor: "c2" }),
      ok({ workflows: [{ uuid: "b" }] }),
      ok({ workflows: [{ uuid: "b" }, { uuid: "c" }] }),
    ]);
    const defs = await backend.listNotebookDefinitions();
    expect(defs.map((d) => d.uuid).sort()).toEqual(["a", "b", "c"]);
    expect(calls.some((c) => c.url.includes("cursor=c2"))).toBe(true);
  });

  it("lists a page of runs with its cursor", async () => {
    const { backend, calls } = backendWith([ok({ runs: [{ uuid: "r1" }], nextCursor: "next" })]);
    expect(await backend.listRuns({ limit: 10, cursor: "c" })).toEqual({ runs: [{ uuid: "r1" }], cursor: "next" });
    expect(calls[0].url).toContain("cursor=c");
    expect(calls[0].url).toContain("organization_id=");
    expect(calls[0].url).toContain("limit=10");
  });

  it("reads target types once", async () => {
    const { backend, calls } = backendWith([ok([{ targetType: "persistent-layer" }, { targetType: "dataset" }])]);
    await backend.listTargetTypes();
    const types = await backend.listTargetTypes();
    expect(types.map((t) => t.targetType)).toEqual(["dataset"]);
    expect(calls).toHaveLength(1);
  });
});

describe("normalizeTargetTypes", () => {
  it("defaults compute types and calls ecs standard", () => {
    expect(normalizeTargetTypes([{ targetType: "x", runtimeConfig: { computeTypes: ["ecs"] } }])[0].runtimeConfig).toEqual({
      cpu: null,
      memory: null,
      computeTypes: ["standard"],
    });
  });
});
