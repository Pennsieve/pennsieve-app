// The notebook calls whose answer depends on whose notebooks they are: a
// workspace's (scope { kind: "workspace", organizationId }) or the signed-in
// user's own outside any workspace (scope { kind: "user", userId }). Every
// site uses this one; they differ only in the scope they pass.
//
// scope is a function, read on every call: in the Pennsieve app it follows
// the workspace being viewed.

// workflow-service takes who a run is for as its tenant: the workspace
// (ORG#<uuid>) or the user (USER#<uuid>). Without it a run is put in the
// compute node's workspace, which fails on a node of another workspace.
const uuidOf = (nodeId) => String(nodeId || "").split(":").pop();
export function runTenant(scope) {
  if (scope?.kind === "workspace" && scope.organizationId) return `ORG#${uuidOf(scope.organizationId)}`;
  if (scope?.kind === "user" && scope.userId) return `USER#${uuidOf(scope.userId)}`;
  return undefined;
}

const orgIdOf = (scope) => (scope?.kind === "workspace" ? scope.organizationId : "");

export class BackendError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "BackendError";
    this.status = status;
  }
}

// Node layers are retired: the persistent-layer target type is never
// offered, even from a registry that still lists it.
export function normalizeTargetTypes(raw) {
  return (raw || [])
    .filter((tt) => tt.targetType !== "persistent-layer")
    .map((tt) => {
      const rc = tt.runtimeConfig || {};
      return {
        ...tt,
        runtimeConfig: {
          cpu: rc.cpu || null,
          memory: rc.memory || null,
          computeTypes: (rc.computeTypes && rc.computeTypes.length ? rc.computeTypes : ["standard", "lambda"]).map((t) =>
            t === "ecs" ? "standard" : t
          ),
        },
      };
    });
}

export function createPennsieveBackend({
  endpoints,
  scope,
  getToken,
  getTokens,
  subscribeRunStatus,
  fetchFn = (...args) => globalThis.fetch(...args),
}) {
  const api2 = () => endpoints.api2Url;

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const h = { Authorization: `Bearer ${await getToken()}`, ...headers };
    if (body !== undefined) h["Content-Type"] = "application/json";
    return fetchFn(`${api2()}${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function json(path, opts) {
    const resp = await request(path, opts);
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new BackendError(resp.status, data.message || data.error || `${path} responded ${resp.status}`);
    }
    return resp.json();
  }

  // ?organization_id= in a workspace; nothing for the user's own.
  const scoped = (params = new URLSearchParams()) => {
    const orgId = orgIdOf(scope());
    if (orgId) params.set("organization_id", orgId);
    return params;
  };

  const runPath = (runId) => `/compute/workflows/runs/${encodeURIComponent(runId)}`;

  // Every page of the definitions a query matches (the service returns
  // them newest first, 100 at a time at most).
  async function listDefinitions(query) {
    const list = [];
    let cursor = "";
    let pages = 50;
    do {
      const params = new URLSearchParams(query);
      params.set("limit", "100");
      if (cursor) params.set("cursor", cursor);
      const result = await json(`/compute/workflows/definitions?${params}`);
      list.push(...(Array.isArray(result) ? result : result.workflows || []));
      cursor = Array.isArray(result) ? "" : result.nextCursor || "";
    } while (cursor && pages-- > 0);
    return list;
  }

  // GPU tiers and target types change rarely: read once per scope.
  const once = new Map();
  const memo = (key, load) => {
    if (!once.has(key)) once.set(key, load().catch((err) => { once.delete(key); throw err; }));
    return once.get(key);
  };

  return {
    scope,

    getRun: (runId) => json(runPath(runId)),
    listDefinitions,

    // One attempt: { status } while the session isn't up (404 no task yet,
    // 202 starting, 5xx transient), { status: 200, connection } once it is.
    // A network error throws; the caller decides whether to keep waiting.
    async connectSession(runId) {
      const resp = await request(`${runPath(runId)}/session/connect`);
      if (resp.status !== 200) return { status: resp.status };
      return { status: 200, connection: await resp.json() };
    },

    // Records a view added to a running session on its run, so the run's
    // callback token may read it.
    async addRunSource(runId, { name, viewId, version }) {
      const resp = await request(`${runPath(runId)}/sources`, {
        method: "POST",
        body: { name, viewId, viewVersion: version },
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const err = new Error(data.message || data.error || `The view couldn't be added to the session (${resp.status}).`);
        err.status = resp.status;
        err.source = "run";
        throw err;
      }
      return resp.json();
    },

    // One page of runs: { runs, cursor } (cursor null on the last page).
    async listRuns({ status, workflowId, limit, startDate, endDate, cursor } = {}) {
      const params = cursor ? new URLSearchParams({ cursor }) : new URLSearchParams();
      scoped(params);
      if (status) params.set("status", status);
      if (workflowId) params.set("workflow_id", workflowId);
      if (limit) params.set("limit", limit);
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);
      const result = await json(`/compute/workflows/runs?${params}`);
      return { runs: result.runs || result, cursor: result.nextCursor || null };
    },

    // The notebook kernels on offer: the official public ones, and the
    // workspace's own in a workspace. Each once, by uuid.
    async listNotebookDefinitions() {
      const orgId = orgIdOf(scope());
      const queries = ["visibility=public&official=true"];
      if (orgId) queries.push(`organization_id=${encodeURIComponent(orgId)}`);
      const results = await Promise.allSettled(queries.map((q) => listDefinitions(q)));
      const byId = new Map();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const wf of r.value) if (wf?.uuid && !byId.has(wf.uuid)) byId.set(wf.uuid, wf);
      }
      return [...byId.values()];
    },

    getDefinition: (uuid) => json(`/compute/workflows/definitions/${uuid}`),

    // The compute nodes the scope may run on: the workspace's, or the user's
    // own outside any workspace.
    async listComputeNodes() {
      const params = scoped();
      const result = await json(`/compute/resources/compute-nodes${params.size ? `?${params}` : ""}`);
      return Array.isArray(result) ? result : result?.nodes || [];
    },

    listGpuTiers() {
      const params = scoped();
      return memo(`gpu-tiers?${params}`, () => json(`/compute/resources/gpu-tiers${params.size ? `?${params}` : ""}`));
    },

    listTargetTypes() {
      return memo("target-types", async () => normalizeTargetTypes(await json("/compute/workflows/target-types")));
    },

    // Starts a run for the scope. The refresh token lets the run's callbacks
    // act for the user while it runs.
    async createRun(payload) {
      const tenant = payload?.tenant || runTenant(scope());
      if (tenant) payload = { ...payload, tenant };
      const tokens = await getTokens();
      const resp = await fetchFn(`${api2()}/compute/workflows/runs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
          "X-Refresh-Token": tokens.refreshToken,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        let message = "Failed to create run";
        try {
          const body = await resp.json();
          if (body.message) message = body.message;
          else if (body.error) message = body.error;
        } catch {}
        throw new Error(message);
      }
      return resp.json();
    },

    // The scope's run counters in a range (lastMonth, lastYear, allTime): the
    // workspace's, or the user's own outside one.
    async getUsageCounters({ range } = {}) {
      const params = scoped();
      if (!params.has("organization_id")) params.set("scope", "user");
      if (range) params.set("range", range);
      return json(`/compute/workflows/metrics/counters?${params}`);
    },

    // Live run status: handler({ runId, status }) for each run of the scope.
    // Returns the unsubscribe. Without the site's realtime, a no-op.
    subscribeRunStatus: subscribeRunStatus || (() => () => {}),
  };
}
