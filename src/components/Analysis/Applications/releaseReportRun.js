/*
  A release report for a version the platform's sample runner could not run
  (a GPU app, or more memory than the runner has): the owner runs the sample
  on a compute node of theirs. app-deploy-service plans it (the fixture
  bundle, the app-fixtures app, the parameters), workflow-service runs it as
  an app run with `sample`, and app-deploy-service registers the results as
  the version's sample run, after which curation-service makes the report
  (app-deploy-service docs/builds.md, "Sample runs on a compute node").

  Pure helpers here, and the three calls, each with the person's own token.
*/
import { useGetToken } from "@/composables/useGetToken";

const SKIPPED_FOR_HARDWARE = "needs_hardware";

/*
  Whether the version's row offers "Generate release report": the fixtures
  are ready and the platform's runner skipped for hardware or failed, or a
  run on a node is on record (then the offer is to follow it / register it).
*/
export function nodeRunOffer(version) {
  const fixtures = version?.fixtures;
  const run = version?.sampleRun;
  if (!fixtures || String(fixtures.status).toLowerCase() !== "ready") return null;
  const status = String(run?.status || "").toLowerCase();
  if (status === "running" && run?.runId) return { kind: "running", runId: run.runId, computeNodeId: run.computeNodeId || "" };
  if (status === "skipped" && run?.error?.code === SKIPPED_FOR_HARDWARE) return { kind: "needs_hardware" };
  if (status === "failed" && run?.source === "node") return { kind: "retry" };
  if (status === "failed") return { kind: "failed" };
  return null;
}

// The person's compute nodes that can run it: enabled, with a GPU when the
// app needs one; by name.
export function nodesFor(nodes, { gpu = true } = {}) {
  return (nodes || [])
    .filter((n) => String(n?.status || "").toLowerCase() === "enabled")
    .filter((n) => !gpu || (n.maxGpuInstances || 0) > 0)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

// The POST /runs body of the sample run (workflow-service docs/app-runs.md,
// "Sample runs"), from the plan and the node.
export function sampleRunPayload(plan, computeNodeId) {
  return {
    app: { sourceUrl: plan.app.sourceUrl, tag: plan.app.tag, sample: { bundleUrl: plan.sample.bundleUrl, fixtures: plan.sample.fixtures } },
    workflowInstanceConfiguration: { computeNodeId },
    processorParams: plan.processorParams || {},
    name: `Release report sample · ${plan.app.tag}`,
  };
}

// A run's state in a word for the dialog: running | succeeded | failed.
export function runOutcome(status) {
  const s = String(status || "").toUpperCase();
  if (s === "SUCCEEDED") return "succeeded";
  if (["FAILED", "CANCELED", "CANCELLED", "TIMED_OUT"].includes(s)) return "failed";
  return "running";
}

const json = async (resp) => {
  let body = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  return body;
};

// An error from app-deploy-service, with its code ("archive_not_ready") for
// the dialog to act on.
export class SampleRunError extends Error {
  constructor(status, body) {
    super(body?.message || `request failed (${status})`);
    this.status = status;
    this.code = body?.code || "";
  }
}

const request = async (url, { method = "GET", body } = {}) => {
  const token = await useGetToken();
  const resp = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await json(resp);
  if (!resp.ok) throw new SampleRunError(resp.status, data);
  return data;
};

const versionUrl = (api2Url, appId, versionId) => `${api2Url}/applications/store/${appId}/versions/${versionId}/sample-run`;

export const fetchSamplePlan = (api2Url, appId, versionId) => request(`${versionUrl(api2Url, appId, versionId)}/plan`);

export const recordSampleRun = (api2Url, appId, versionId, runId, computeNodeId) =>
  request(versionUrl(api2Url, appId, versionId), { method: "POST", body: { runId, computeNodeId } });

export const registerSampleResults = (api2Url, appId, versionId, runId) =>
  request(`${versionUrl(api2Url, appId, versionId)}/results`, { method: "POST", body: { runId } });

export const fetchRun = (api2Url, runId) => request(`${api2Url}/compute/workflows/runs/${encodeURIComponent(runId)}`);

// Whether registering should be tried again later: the archive is still
// being made.
export const retryLater = (err) => err instanceof SampleRunError && err.status === 409 && ["archive_not_ready", "archive_missing"].includes(err.code);
