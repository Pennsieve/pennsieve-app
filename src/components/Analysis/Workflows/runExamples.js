/*
  Run examples: a workflow version's example is a PDF summary of one
  successful run of it, made when someone who can edit the workflow sets the
  run as its example (workflow-service POST /runs/{id}/example). Pure
  helpers for the run page's "Use as workflow sample output" action (the API's run example) and the workflow page's
  and library's Example links:

  - canEditWorkflow: whether the user may set or remove a workflow's example.
  - exampleLabel / exampleVersion: how an example is named ("Example from
    version 3" when it's an older version's).
  - jobActive / jobStatusText: a generation job's state.
  - limitRows / exhaustedLimit: what's left of today's limits.
  - setExampleError: a refused request, said plainly.
  - openPdf: opens a (fresh) signed PDF link in a new tab (the viewer's "Open in a new tab").
  - samplePdfFilename, downloadPdf: the viewer's Download.
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

// "Sample output", or "Sample output from version N" when it's of an older version than
// the one shown.
export const exampleLabel = (example) =>
  example?.fromVersion ? `Sample output from version ${example.fromVersion}` : "Sample output";

export const jobStatusText = (job) => {
  switch (job?.status) {
    case "QUEUED":
      return "Sample output queued…";
    case "GENERATING":
      return "Generating the sample output PDF…";
    case "READY":
      return "Sample output PDF ready.";
    case "FAILED":
      return job.error ? job.errorCode === "budget_blocked"
        ? "Pennsieve's daily budget for generating sample outputs has been used. Try again after midnight UTC."
        : `The sample output could not be generated: ${job.error}` : "The sample output could not be generated.";
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

// How many more examples can be generated today, as one sentence about the
// tightest limit (the one with the fewest left), or "" when there are no
// limits or one is used up (exhaustedLimit and limitMessage cover that).
const LIMIT_SCOPES = { workflow: "for this workflow", user: "by you", workspace: "in this workspace" };
// subject: "workflow", or "app" for an app run (the per-workflow limit counts per app).
export const limitSentence = (limits, subject = "workflow") => {
  const rows = limitRows(limits);
  if (!rows.length) return "";
  const tightest = rows.reduce((a, b) => (b.left < a.left ? b : a));
  if (tightest.left <= 0) return "";
  const n = tightest.left;
  const scope = tightest.key === "workflow" && subject === "app" ? "for this app" : LIMIT_SCOPES[tightest.key] || "";
  return `${n} more sample ${n === 1 ? "output" : "outputs"} can be generated ${scope} today.`;
};

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
  workflow: "This workflow has had all the sample outputs it can have generated today.",
  user: "You've generated all the sample outputs you can today.",
  workspace: "This workspace has generated all the sample outputs it can today.",
  platform: "Pennsieve's daily budget for generating sample outputs has been used.",
};

// A rate limit (429 body { limit, resetAt }) said plainly.
export const limitMessage = (limit, resetAt, now) => {
  const what = LIMIT_REACHED[limit] || "A daily limit on generating sample outputs has been reached.";
  const when = formatResetAt(resetAt, now);
  return when ? `${what} You can try again ${when}.` : `${what} Limits reset at midnight UTC.`;
};

// A refused POST /runs/{id}/example (workflowRequest's error: status, body).
export const setExampleError = (err, now, subject = "workflow") => {
  const body = err?.body || {};
  const app = subject === "app";
  switch (err?.status) {
    case 403:
      return app
        ? "You can't use this run as the app's sample output: that takes owning the app, having run it yourself, and being able to read its input files."
        : "You can't use this run as the workflow sample output: that takes being able to edit the workflow and read every dataset the run wrote to.";
    case 404:
      return "This run wasn't found.";
    case 409: {
      const other = body.job?.runId || body.runId;
      if (app && !other && body.message) return body.message; // e.g. the results are still being packaged
      return other
        ? `A sample output is already being generated for this ${subject} (from run ${other}). Try again when it's done.`
        : `A sample output is already being generated for this ${subject}. Try again when it's done.`;
    }
    case 422:
      return body.message
        ? `This run can't be the sample output: ${body.message}`
        : "This run can't be the sample output: only a run that succeeded and wrote its outputs to a dataset can be.";
    case 429:
      return limitMessage(body.limit, body.resetAt, now);
    default:
      return err?.message ? `Could not set the sample output: ${err.message}` : "Could not set the sample output.";
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

// The file name a downloaded sample output PDF is saved as, e.g.
// "Single-cell Spatial Profiling - sample output v3.pdf". Characters file
// systems refuse are dropped.
export const samplePdfFilename = (workflowName, version) => {
  const name = String(workflowName || "Workflow")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${name || "Workflow"} - sample output${version ? ` v${version}` : ""}.pdf`;
};

// Saves the PDF at url as filename. The signed link is on another origin, so
// an <a download> would be ignored; the PDF is fetched (CORS) and saved from a
// blob. Where that fails, it opens in a new tab instead. Returns "saved" or
// "opened".
export const downloadPdf = async (url, filename, env = typeof window !== "undefined" ? window : null) => {
  if (!env || !url) return null;
  try {
    const res = await env.fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const href = env.URL.createObjectURL(blob);
    const a = env.document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    env.document.body.appendChild(a);
    a.click();
    a.remove();
    env.setTimeout(() => env.URL.revokeObjectURL(href), 10_000);
    return "saved";
  } catch {
    env.open(url, "_blank", "noopener");
    return "opened";
  }
};
