/*
  A compute node's room for notebooks, for the notebook wizard's node step:
  GET {api2}/compute/workflows/compute-nodes/{nodeId}/sessions returns
  { max, active, mine, maxPerUser } — the node's ceiling on open notebooks
  (everyone together), how many are open, how many are the caller's, and the
  cap on one user's (0 = none). workflow-service decides a new notebook on the
  same numbers; it stays the authority (its 409 says why), this only greys a
  full node out ahead of time.
*/

// The node's capacity, or null when it can't be read: a failure never
// blocks the dialog, the node just shows no capacity.
export async function fetchNodeSessions(api2Url, nodeId, getToken, fetchFn = globalThis.fetch) {
  try {
    const resp = await fetchFn(`${api2Url}/compute/workflows/compute-nodes/${encodeURIComponent(nodeId)}/sessions`, {
      headers: { Authorization: `Bearer ${await getToken()}` },
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    if (typeof body?.max !== "number") return null;
    return {
      max: body.max,
      active: Number(body.active) || 0,
      mine: Number(body.mine) || 0,
      maxPerUser: Number(body.maxPerUser) || 0,
    };
  } catch {
    return null;
  }
}

// Every node's capacity, read in parallel: { [uuid]: capacity | null }.
export async function fetchNodesSessions(api2Url, nodes, getToken, fetchFn = globalThis.fetch) {
  const entries = await Promise.all(
    (nodes || []).map(async (n) => [n.uuid, await fetchNodeSessions(api2Url, n.uuid, getToken, fetchFn)])
  );
  return Object.fromEntries(entries);
}

// "3 of 10 notebooks in use · you have 1 open", or "" without a capacity.
export function capacityLabel(cap) {
  if (!cap || !(cap.max > 0)) return "";
  const word = cap.max === 1 ? "notebook" : "notebooks";
  const label = `${cap.active} of ${cap.max} ${word} in use`;
  return cap.mine > 0 ? `${label} · you have ${cap.mine} open` : label;
}

// Why a new notebook doesn't fit on the node, or "": the caller is at the
// node's per-user cap, or every notebook the node allows is open.
export function capacityReason(cap) {
  if (!cap || !(cap.max > 0)) return "";
  if (cap.maxPerUser > 0 && cap.mine >= cap.maxPerUser) return "You have the maximum open here";
  if (cap.active >= cap.max) return "Full — try again later";
  return "";
}
