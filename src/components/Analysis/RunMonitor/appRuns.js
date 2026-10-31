/*
  App runs ("Try this app"): a one-off run of one App Store app version on
  files someone picks, with no stored workflow (workflow-service
  docs/app-runs.md). The run page configures it like a workflow's run, from
  the one-step workflow GET /apps/run-definition returns, and sends it with
  app instead of a workflow. Every file the app writes comes back as one
  download (the run's Results).
*/

// The app a pending run config or run names, as the API takes it, or null.
export const appOf = (x) => {
  const app = x?.app;
  if (!app?.sourceUrl || !app?.tag) return null;
  return { sourceUrl: app.sourceUrl, tag: app.tag, ...(app.variant && { variant: app.variant }) };
};

// The step an app run's one-step workflow runs the app in.
export const appStepId = (definition) =>
  (definition?.dag || []).find((n) => n.type !== "data-source" && n.type !== "data-target")?.id || "";

// The POST /runs body of an app run, from the one a workflow's run would
// send: app instead of workflowId, with the version and variant the run
// page chose for the step (so the run records what ran).
export const appRunPayload = (payload, app, stepId) => {
  const cfg = payload.workflowInstanceConfiguration || {};
  const step = (cfg.processorConfigs || []).find((c) => c.nodeId === stepId);
  const tag = step?.version || app.tag;
  const variant = step?.variant ?? app.variant ?? "";
  const processorConfigs = (cfg.processorConfigs || []).map((c) => {
    if (c.nodeId !== stepId) return c;
    const { version, variant: _v, ...rest } = c;
    return rest;
  });
  const { workflowId, ...instance } = cfg;
  return {
    ...payload,
    workflowInstanceConfiguration: {
      ...instance,
      ...(processorConfigs.length ? { processorConfigs } : {}),
    },
    app: { sourceUrl: app.sourceUrl, tag, ...(variant && { variant }) },
  };
};

// "st-niches v0.1.0", "st-niches v0.2.0 · gpu".
export const appRunLabel = (app) => {
  if (!app) return "";
  const name = app.name || String(app.sourceUrl || "").replace(/\.git$/, "").split("/").filter(Boolean).pop() || "App";
  const version = [app.tag, app.variant].filter(Boolean).join(" · ");
  return version ? `${name} ${version}` : name;
};

// The key a run's setup (compute node, dataset) is remembered under.
export const setupKey = ({ workflowId, app } = {}) => (app?.sourceUrl ? `app:${app.sourceUrl}` : workflowId || "");

// The version "Try this app" runs: the newest deployed one, unless it's an
// interactive app (a notebook or other session), which isn't run this way.
export const tryableVersion = (versions = []) => {
  const newest = [...versions]
    .filter((v) => v?.version && String(v.status || "").toLowerCase() === "deployed")
    .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))[0];
  if (!newest) return null;
  const runtime = newest.manifest?.runtime || {};
  if (runtime.interactive || runtime.sessionType) return null;
  return newest;
};
