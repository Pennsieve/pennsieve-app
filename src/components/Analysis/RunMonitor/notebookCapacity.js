/*
  A compute node's room for notebooks, for the notebook wizard's node step:
  GET {api2}/compute/workflows/compute-nodes/{nodeId}/sessions returns
  { enabled, max, active, mine, maxPerUser }:
    - enabled: the node has notebooks on;
    - max: the effective limit on open notebooks, everyone together (the
      node's ceiling, or its "Limits & budget" node-wide limit when lower);
    - active / mine: open notebooks, everyone's and the caller's;
    - maxPerUser: the caller's limit (their override, else the per-user
      default), null for none.
  workflow-service decides a new notebook on the same limits; it stays the
  authority (its 409 says why), this only greys a full node out ahead of time.
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
    const perUser = body.maxPerUser;
    return {
      // Older responses had no `enabled`: a max above 0 meant on.
      enabled: typeof body.enabled === "boolean" ? body.enabled : body.max > 0,
      max: body.max,
      active: Number(body.active) || 0,
      mine: Number(body.mine) || 0,
      maxPerUser: typeof perUser === "number" ? perUser : null,
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
  if (!cap?.enabled || !(cap.max > 0)) return "";
  const word = cap.max === 1 ? "notebook" : "notebooks";
  const label = `${cap.active} of ${cap.max} ${word} in use`;
  return cap.mine > 0 ? `${label} · you have ${cap.mine} open` : label;
}

// Why a new notebook doesn't fit on the node, or "": the caller is at their
// limit, or every notebook the node allows is open (or it allows none).
export function capacityReason(cap) {
  if (!cap?.enabled) return "";
  if (cap.maxPerUser === 0) return "Notebooks not allowed for you here";
  if (cap.maxPerUser != null && cap.mine >= cap.maxPerUser) return "You have the maximum open here";
  if (cap.max === 0) return "No notebooks allowed here";
  if (cap.active >= cap.max) return "Full — try again later";
  return "";
}
