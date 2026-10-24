// An environment is a python-env / r-env layer on a compute node, filled by
// a run of an official build workflow ("build-<layer name>"). The layer
// alone says only READY or not; its build run says whether it's still
// building or failed.
import * as siteConfig from "@/site-config/site.json";
import { useGetToken } from "@/composables/useGetToken";

export const ENV_LAYER_TYPES = ["python-env", "r-env"];
export const isEnvironment = (layer) => ENV_LAYER_TYPES.includes(layer?.layerType);

export const buildRunName = (layerName) => `build-${layerName}`;

// The newest build run of a layer on its node, among build workflows' runs.
export function buildRunFor(layer, nodeId, runs) {
  const name = buildRunName(layer.layerName);
  const newest = (a, b) => (Date.parse(b.startedAt || "") || 0) - (Date.parse(a.startedAt || "") || 0);
  return (
    (runs || [])
      .filter((r) => r.name === name && (!r.computeNodeUuid || r.computeNodeUuid === nodeId))
      .sort(newest)[0] || null
  );
}

// ready | building | failed | not-built
export function environmentStatus(layer, run) {
  if (layer?.status === "READY") return "ready";
  if (!run) return "not-built";
  switch (run.status) {
    case "FAILED":
    case "CANCELLED":
    case "CANCELED":
      return "failed";
    default:
      // NOT_STARTED, STARTED, FINALIZING, and SUCCEEDED before the layer's
      // record says READY.
      return "building";
  }
}

// The requirements a build was given, from the run's details (the list of
// runs doesn't carry parameters).
export function requirementsOf(runDetail) {
  for (const params of Object.values(runDetail?.processorParams || {})) {
    if (params && typeof params.REQUIREMENTS === "string") return params.REQUIREMENTS;
  }
  return "";
}

// "rnaseq" -> "rnaseq-2", "rnaseq-2" -> "rnaseq-3", avoiding names taken.
export function nextName(name, taken = []) {
  const m = /^(.*?)-(\d+)$/.exec(name);
  const base = m ? m[1] : name;
  let n = m ? Number(m[2]) + 1 : 2;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

const authHeaders = async () => ({ Authorization: `Bearer ${await useGetToken()}` });

// Runs of the given build workflows, in a workspace or (no orgId) the
// user's own. Kept apart from the store's run list, which pages show.
export async function fetchBuildRuns(workflowIds, orgId, { fetchFn = globalThis.fetch } = {}) {
  const lists = await Promise.all(
    workflowIds.filter(Boolean).map(async (id) => {
      const params = new URLSearchParams({ workflow_id: id, limit: "100" });
      if (orgId) params.set("organization_id", orgId);
      const resp = await fetchFn(`${siteConfig.api2Url}/compute/workflows/runs?${params}`, {
        headers: await authHeaders(),
      });
      if (!resp.ok) throw new Error(`Could not list build runs (${resp.status}).`);
      const body = await resp.json();
      return body.runs || body || [];
    })
  );
  return lists.flat();
}

export async function fetchRunDetail(runId, { fetchFn = globalThis.fetch } = {}) {
  const resp = await fetchFn(`${siteConfig.api2Url}/compute/workflows/runs/${encodeURIComponent(runId)}`, {
    headers: await authHeaders(),
  });
  if (!resp.ok) throw new Error(`Could not read the build run (${resp.status}).`);
  return resp.json();
}
