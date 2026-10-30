// Run costs for lists: the runs list doesn't carry them, so a run is read
// (GET {api2}/compute/workflows/runs/{id}, metrics.totalEstimatedCost) when
// it's opened, and kept for the page's life. A run that's
// still going, or whose metrics aren't in, is read again next time.
import { useGetToken } from "@/composables/useGetToken";

const runs = new Map(); // run id -> the run, once its metrics are in
const pending = new Map(); // run id -> promise

// The run as GET returns it (with metrics), or null.
export async function fetchRun(api2Url, runId, { getToken = useGetToken, fetchFn = globalThis.fetch } = {}) {
  if (runs.has(runId)) return runs.get(runId);
  if (pending.has(runId)) return pending.get(runId);
  const p = (async () => {
    try {
      const resp = await fetchFn(`${api2Url}/compute/workflows/runs/${encodeURIComponent(runId)}`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!resp.ok) return null;
      const run = await resp.json();
      if (costOf(run) != null) runs.set(runId, run);
      return run;
    } catch {
      return null;
    } finally {
      pending.delete(runId);
    }
  })();
  pending.set(runId, p);
  return p;
}

// A run's estimated cost, or null while its metrics aren't in.
export function costOf(run) {
  const cost = Number(run?.metrics?.totalEstimatedCost);
  return run?.metrics && Number.isFinite(cost) ? cost : null;
}

export async function fetchRunCost(api2Url, runId, options) {
  return costOf(await fetchRun(api2Url, runId, options));
}

// The parts of a run's cost that aren't zero: [{ label, cost }]. Every
// part the finalizer's costEstimate carries, so the parts add up to the total.
const PARTS = {
  ecs: "Compute (ECS)",
  gpu: "GPU",
  lambda: "Lambda",
  data: "Data transfer",
  efsStorage: "Storage",
  cloudWatchLogs: "Logs",
  stepFunctions: "Orchestration",
  llm: "LLM",
};
export function costParts(run) {
  const est = run?.metrics?.costEstimate || {};
  return Object.entries(PARTS)
    .map(([key, label]) => ({ label, cost: Number(est[key]?.estimatedCost) }))
    .filter((p) => Number.isFinite(p.cost) && p.cost > 0);
}

// For tests.
export function clearRunCosts() {
  runs.clear();
  pending.clear();
}
