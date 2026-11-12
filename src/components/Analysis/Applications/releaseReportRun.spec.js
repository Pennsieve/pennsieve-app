import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/composables/useGetToken", () => ({ useGetToken: vi.fn(async () => "tok") }));

import { nodeRunOffer, nodesFor, sampleRunPayload, runOutcome, fetchSamplePlan, registerSampleResults, retryLater, SampleRunError } from "./releaseReportRun";

const ready = { status: "ready", bytes: 1 };

describe("nodeRunOffer", () => {
  it("offers a run when the runner skipped for hardware", () => {
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "skipped", error: { code: "needs_hardware" } } })).toEqual({ kind: "needs_hardware" });
  });
  it("offers a run for a patch release the runner skipped", () => {
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "skipped", error: { code: "patch_release" } } })).toEqual({ kind: "patch_release" });
    expect(nodeRunOffer({ fixtures: { status: "building" }, sampleRun: { status: "skipped", error: { code: "patch_release" } } })).toBeNull();
  });
  it("follows a run on a node that is on record", () => {
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "running", runId: "run-7", computeNodeId: "node-1", source: "node" } })).toEqual({
      kind: "running",
      runId: "run-7",
      computeNodeId: "node-1",
    });
  });
  it("offers again after a failed node run, and after a failed runner run", () => {
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "failed", source: "node" } })).toEqual({ kind: "retry" });
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "failed" } })).toEqual({ kind: "failed" });
  });
  it("offers nothing without fixtures, for other skips, or once ready", () => {
    expect(nodeRunOffer({ fixtures: { status: "building" }, sampleRun: { status: "skipped", error: { code: "needs_hardware" } } })).toBeNull();
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "skipped", error: { code: "no_bundle" } } })).toBeNull();
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "ready" } })).toBeNull();
    expect(nodeRunOffer({ fixtures: ready, sampleRun: { status: "running" } })).toBeNull();
    expect(nodeRunOffer(null)).toBeNull();
  });
});

describe("nodesFor", () => {
  const nodes = [
    { uuid: "b", name: "Beta", status: "enabled", maxGpuInstances: 2 },
    { uuid: "a", name: "Alpha", status: "enabled", maxGpuInstances: 1 },
    { uuid: "c", name: "Cpu", status: "enabled", maxGpuInstances: 0 },
    { uuid: "p", name: "Paused", status: "paused", maxGpuInstances: 4 },
  ];
  it("keeps enabled GPU nodes, by name", () => {
    expect(nodesFor(nodes).map((n) => n.uuid)).toEqual(["a", "b"]);
  });
  it("keeps CPU nodes when no GPU is needed", () => {
    expect(nodesFor(nodes, { gpu: false }).map((n) => n.uuid)).toEqual(["a", "b", "c"]);
  });
});

describe("sampleRunPayload", () => {
  it("is an app run with sample, no data sources", () => {
    const plan = {
      app: { sourceUrl: "https://github.com/pennsieve-apps/spike-sort", tag: "v0.1.4" },
      sample: { bundleUrl: "https://b/x.tar.gz", fixtures: { sourceUrl: "https://github.com/pennsieve-apps/app-fixtures", tag: "v0.1.3" } },
      stepId: "spike-sort",
      processorParams: { "spike-sort": { N_JOBS: "2" } },
    };
    expect(sampleRunPayload(plan, "node-1")).toEqual({
      app: { sourceUrl: plan.app.sourceUrl, tag: "v0.1.4", sample: { bundleUrl: "https://b/x.tar.gz", fixtures: plan.sample.fixtures } },
      workflowInstanceConfiguration: { computeNodeId: "node-1" },
      processorParams: { "spike-sort": { N_JOBS: "2" } },
      name: "Release report sample · v0.1.4",
    });
  });
});

describe("runOutcome", () => {
  it("reads a run's status", () => {
    expect(runOutcome("SUCCEEDED")).toBe("succeeded");
    expect(runOutcome("FAILED")).toBe("failed");
    expect(runOutcome("CANCELED")).toBe("failed");
    expect(runOutcome("RUNNING")).toBe("running");
    expect(runOutcome("")).toBe("running");
  });
});

describe("the calls", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });
  it("reads the plan with the token", async () => {
    fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ stepId: "spike-sort" }) });
    const plan = await fetchSamplePlan("https://api2.x", "app-1", "ver-1");
    expect(plan).toEqual({ stepId: "spike-sort" });
    expect(fetch).toHaveBeenCalledWith("https://api2.x/applications/store/app-1/versions/ver-1/sample-run/plan", {
      method: "GET",
      headers: { Authorization: "Bearer tok" },
    });
  });
  it("registers results and surfaces the refusal's code", async () => {
    fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "archive_not_ready", message: "still zipping" }) });
    const err = await registerSampleResults("https://api2.x", "app-1", "ver-1", "run-7").catch((e) => e);
    expect(err).toBeInstanceOf(SampleRunError);
    expect(err.code).toBe("archive_not_ready");
    expect(err.message).toBe("still zipping");
    expect(retryLater(err)).toBe(true);
    expect(retryLater(new SampleRunError(409, { code: "run_failed" }))).toBe(false);
    expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify({ runId: "run-7" }));
  });
});
