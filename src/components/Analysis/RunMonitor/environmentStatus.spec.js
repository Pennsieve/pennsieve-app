import { describe, it, expect, vi } from "vitest";

vi.mock("@/composables/useGetToken", () => ({ useGetToken: () => Promise.resolve("tok") }));

import {
  buildRunFor,
  environmentStatus,
  requirementsOf,
  nextName,
  fetchBuildRuns,
  isEnvironment,
} from "./environmentStatus";

const layer = (status = "EMPTY") => ({ layerName: "neuro", layerType: "python-env", status });

describe("buildRunFor", () => {
  const runs = [
    { name: "build-neuro", computeNodeUuid: "n1", status: "FAILED", startedAt: "2026-10-23T10:00:00Z" },
    { name: "build-neuro", computeNodeUuid: "n1", status: "STARTED", startedAt: "2026-10-23T11:00:00Z" },
    { name: "build-neuro", computeNodeUuid: "n2", status: "SUCCEEDED", startedAt: "2026-10-23T12:00:00Z" },
    { name: "build-other", computeNodeUuid: "n1", status: "SUCCEEDED", startedAt: "2026-10-23T13:00:00Z" },
  ];
  it("is the newest build of that layer on that node", () => {
    expect(buildRunFor(layer(), "n1", runs).status).toBe("STARTED");
    expect(buildRunFor(layer(), "n2", runs).status).toBe("SUCCEEDED");
    expect(buildRunFor(layer(), "n3", runs)).toBeNull();
  });
});

describe("environmentStatus", () => {
  it("follows the layer, then its build run", () => {
    expect(environmentStatus(layer("READY"), { status: "FAILED" })).toBe("ready");
    expect(environmentStatus(layer(), null)).toBe("not-built");
    expect(environmentStatus(layer(), { status: "STARTED" })).toBe("building");
    expect(environmentStatus(layer(), { status: "NOT_STARTED" })).toBe("building");
    expect(environmentStatus(layer(), { status: "SUCCEEDED" })).toBe("building");
    expect(environmentStatus(layer(), { status: "FAILED" })).toBe("failed");
    expect(environmentStatus(layer(), { status: "CANCELLED" })).toBe("failed");
  });
});

describe("requirementsOf", () => {
  it("reads the build processor's REQUIREMENTS", () => {
    expect(requirementsOf({ processorParams: { node_b: { REQUIREMENTS: "numpy\nmne", PYTHON_VERSION: "3.12" } } })).toBe("numpy\nmne");
    expect(requirementsOf({})).toBe("");
  });
});

describe("nextName", () => {
  it("counts up, skipping names in use", () => {
    expect(nextName("neuro")).toBe("neuro-2");
    expect(nextName("neuro-2")).toBe("neuro-3");
    expect(nextName("neuro", ["neuro-2", "neuro-3"])).toBe("neuro-4");
  });
});

describe("isEnvironment", () => {
  it("is a python or R environment layer", () => {
    expect(isEnvironment({ layerType: "r-env" })).toBe(true);
    expect(isEnvironment({ layerType: "data" })).toBe(false);
    expect(isEnvironment({})).toBe(false);
  });
});

describe("fetchBuildRuns", () => {
  it("lists each build workflow's runs, in the workspace when there is one", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ runs: [{ uuid: "r1" }] }) });
    const runs = await fetchBuildRuns(["wf-py", "wf-r", ""], "N:organization:1", { fetchFn });
    expect(runs).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const url = new URL(fetchFn.mock.calls[0][0]);
    expect(url.searchParams.get("workflow_id")).toBe("wf-py");
    expect(url.searchParams.get("organization_id")).toBe("N:organization:1");
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  it("is the user's own runs outside a workspace", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ runs: [] }) });
    await fetchBuildRuns(["wf-py"], undefined, { fetchFn });
    expect(new URL(fetchFn.mock.calls[0][0]).searchParams.has("organization_id")).toBe(false);
  });
});
