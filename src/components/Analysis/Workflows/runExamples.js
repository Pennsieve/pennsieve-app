/*
  Run examples: a workflow version's example is a PDF summary of one
  successful run of it, made when someone who can edit the workflow sets the
  run as its example (workflow-service POST /runs/{id}/example). Pure
  helpers for the run page's Set as example action and the workflow page's
  and library's Example links:

  - canEditWorkflow: whether the user may set or remove a workflow's example.
  - exampleLabel / exampleVersion: how an example is named ("Example from
    version 3" when it's an older version's).
  - jobActive / jobStatusText: a generation job's state.
  - limitRows / exhaustedLimit: what's left of today's limits.
  - setExampleError: a refused request, said plainly.
  - openPdf: opens a (fresh) signed PDF link in a new tab.
  - createExampleCache: the examples the library's cards show, fetched once
    per workflow for a while, and not at all where the feature isn't served.
*/

// A job still being made: polled until it's READY or FAILED.
export const ACTIVE_JOB_STATUSES = ["QUEUED", "GENERATING"];
export const jobActive = (job) => !!job && ACTIVE_JOB_STATUSES.includes(job.status);

// How often a job in progress is checked, and how long a signed PDF link (15
// minutes) is used before a fresh one is asked for.
export const POLL_MS = 5000;
export const PDF_URL_FRESH_MS = 10 * 60 * 1000;

// Who may set or remove a workflow's example: who may edit it. The workflow
// says (permissions.canEdit, the rule workflow-service checks: its creator,
// or a workspace admin/owner for a workspace's workflow, or a super-admin
// for a public one); where it doesn't, its creator.
export const canEditWorkflow = (workflow, profile) => {
  if (!workflow) return false;
  if (workflow.permissions && typeof workflow.permissions.canEdit === "boolean") {
    return workflow.permissions.canEdit;
  }
  if (!profile || !workflow.createdBy) return false;
  return profile.id === workflow.createdBy || profile.intId === workflow.createdBy;
};

// The version an example is of.
export const exampleVersion = (example) => example?.fromVersion || example?.version || null;

// "Example", or "Example from version N" when it's of an older version than
// the one shown.
export const exampleLabel = (example) =>
  example?.fromVersion ? `Example from version ${example.fromVersion}` : "Example";

export const jobStatusText = (job) => {
  switch (job?.status) {
    case "QUEUED":
      return "Example PDF queued…";
    case "GENERATING":
      return "Generating the example PDF…";
    case "READY":
      return "Example PDF ready.";
    case "FAILED":
      return job.error ? `The example PDF could not be made: ${job.error}` : "The example PDF could not be made.";
    default:
      return "";
  }
};

const LIMIT_NAMES = {
  workflow: "this workflow",
  user: "you",
  workspace: "this workspace",
};

// limits ({ workflow: { used, limit }, user, workspace }) -> rows in that
// order: { key, label, used, limit, left }.
export const limitRows = (limits) =>
  Object.keys(LIMIT_NAMES)
    .filter((key) => limits?.[key] && Number.isFinite(limits[key].limit))
    .map((key) => {
      const { used = 0, limit } = limits[key];
      return { key, label: LIMIT_NAMES[key], used, limit, left: Math.max(0, limit - used) };
    });

// The first limit with nothing left today, or null.
export const exhaustedLimit = (limits) => limitRows(limits).find((r) => r.left <= 0) || null;

// resetAt (ISO time or epoch seconds/ms) -> a local time, or "".
export const formatResetAt = (resetAt, now = new Date()) => {
  if (resetAt === undefined || resetAt === null || resetAt === "") return "";
  let d;
  if (typeof resetAt === "number") d = new Date(resetAt < 1e12 ? resetAt * 1000 : resetAt);
  else d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === now.toDateString() ? `today at ${time}` : `${d.toLocaleDateString()} at ${time}`;
};

const LIMIT_REACHED = {
  workflow: "This workflow has had all the examples it can have made today.",
  user: "You've made all the examples you can today.",
  workspace: "This workspace has made all the examples it can today.",
  platform: "Pennsieve's daily budget for making examples has been used.",
};

// A rate limit (429 body { limit, resetAt }) said plainly.
export const limitMessage = (limit, resetAt, now) => {
  const what = LIMIT_REACHED[limit] || "A daily limit on making examples has been reached.";
  const when = formatResetAt(resetAt, now);
  return when ? `${what} You can try again ${when}.` : `${what} Limits reset at midnight UTC.`;
};

// A refused POST /runs/{id}/example (workflowRequest's error: status, body).
export const setExampleError = (err, now) => {
  const body = err?.body || {};
  switch (err?.status) {
    case 403:
      return "You can't set this run as the example: that takes being able to edit the workflow and read every dataset the run wrote to.";
    case 404:
      return "This run wasn't found.";
    case 409: {
      const other = body.job?.runId || body.runId;
      return other
        ? `An example is already being made for this workflow (from run ${other}). Try again when it's done.`
        : "An example is already being made for this workflow. Try again when it's done.";
    }
    case 422:
      return body.message
        ? `This run can't be an example: ${body.message}`
        : "This run can't be an example: only a run that succeeded and wrote its outputs to a dataset can be.";
    case 429:
      return limitMessage(body.limit, body.resetAt, now);
    default:
      return err?.message ? `Could not set the example: ${err.message}` : "Could not set the example.";
  }
};

// Opens a PDF in a new tab. url: a signed link, or a function resolving one
// (fresh); the tab opens right away, so the browser counts it as the click's,
// and goes to the PDF once the link is there (or closes if there's none).
export const openPdf = async (url, win = typeof window !== "undefined" ? window : null) => {
  if (!win) return;
  if (typeof url === "string") {
    win.open(url, "_blank", "noopener");
    return;
  }
  const tab = win.open("", "_blank");
  try {
    const href = await url();
    if (!tab) {
      if (href) win.open(href, "_blank", "noopener");
      return;
    }
    if (!href) {
      tab.close();
      return;
    }
    tab.opener = null;
    tab.location.href = href;
  } catch (err) {
    tab?.close();
    throw err;
  }
};

// The examples shown on many workflows (the library's cards), kept a while
// per workflow. fetch: uuid -> example or null, rejecting with { status }
// where it fails. Where it fails as if the feature isn't there (404/503/no
// response) nothing more is asked for until reload.
export const createExampleCache = (unavailable, ttlMs = PDF_URL_FRESH_MS) => {
  const entries = new Map(); // uuid -> { at, promise }
  let off = false;
  return {
    get(uuid, fetch, now = Date.now()) {
      if (off || !uuid) return Promise.resolve(null);
      const hit = entries.get(uuid);
      if (hit && now - hit.at < ttlMs) return hit.promise;
      const promise = fetch(uuid).catch((err) => {
        if (unavailable(err)) off = true;
        entries.delete(uuid);
        return null;
      });
      entries.set(uuid, { at: now, promise });
      return promise;
    },
    forget(uuid) {
      entries.delete(uuid);
    },
    get off() {
      return off;
    },
  };
};
