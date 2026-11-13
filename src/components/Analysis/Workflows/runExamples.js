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
  - appSteps / appChanges / reportNote / loadReportNote: the muted
    "Apps updated since this report" note, the apps changed in its tooltip.
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

/*
  The report's version note. A workflow shows the newest sample output any
  of its versions has (workflow-service sets fromVersion when that isn't the
  latest version). Where the report's apps differ from the version shown's,
  a muted line says "Apps updated since this report", with the apps changed
  ("eeg-spikes v0.1.0 → v0.1.1") in its tooltip.
  An example may carry apps (the app steps its run used, e.g. a report copied
  to another environment and attached to that environment's version): then
  those are compared, even when the version is the same.
*/

const STEP_NODE_TYPES_SKIPPED = ["data-source", "data-target"];
const repoKey = (url) =>
  String(url || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "")
    .toLowerCase();
const repoName = (url) => repoKey(url).split("/").pop() || "app";

// The app steps of a workflow (or a version shaped as one: { dag }), named
// by their repository: [{ name, sourceUrl, tag, variant }].
export const appSteps = (wf) =>
  (wf?.dag || [])
    .filter((n) => n?.sourceUrl && !STEP_NODE_TYPES_SKIPPED.includes(n.type))
    .map((n) => ({
      name: repoName(n.sourceUrl),
      sourceUrl: n.sourceUrl,
      tag: n.tag || "",
      variant: n.variant || "",
    }));

const stepLabel = (s) => `${s.tag || "untagged"}${s.variant ? ` (${s.variant})` : ""}`;

// What changed between two lists of app steps, one entry per app (matched by
// repository): { name, from, to } with from "" for an app added and to ""
// for one removed. Unchanged apps are left out.
export const appChanges = (before = [], after = []) => {
  const group = (steps) => {
    const out = new Map();
    for (const s of steps || []) {
      const key = repoKey(s.sourceUrl);
      if (!key) continue;
      if (!out.has(key)) out.set(key, { name: s.name || repoName(s.sourceUrl), labels: [] });
      out.get(key).labels.push(stepLabel(s));
    }
    return out;
  };
  const a = group(before);
  const b = group(after);
  const changes = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const from = [...new Set(a.get(key)?.labels || [])].sort().join(", ");
    const to = [...new Set(b.get(key)?.labels || [])].sort().join(", ");
    if (from !== to) changes.push({ name: (b.get(key) || a.get(key)).name, from, to });
  }
  return changes;
};

export const changeText = ({ name, from, to }) =>
  !from ? `${name} added` : !to ? `${name} removed` : `${name} ${from} → ${to}`;

// The changes as a short list: the first few, then "and N more".
export const changesText = (changes, max = 3) => {
  if (!changes?.length) return "";
  const shown = changes.slice(0, max).map(changeText);
  const rest = changes.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", ");
};

export const REPORT_NOTE_TEXT = "Apps updated since this report";
const NO_NOTE = Object.freeze({ text: "", detail: "" });

// The note under a report: { text, detail }. text is the short line, shown
// only when the report's apps differ from the version shown's; detail is the
// apps changed ("bulk-report v0.1.0 → v0.1.1"), for its tooltip. The
// version is in the subtitle already, so the note never repeats it, and
// there's no note when only the version differs or the steps aren't known.
// reportSteps: the app steps of the report's version (used when the example
// has no apps of its own); currentSteps: the version shown's.
export const reportNote = (example, { reportSteps = null, currentSteps = null } = {}) => {
  if (!example) return NO_NOTE;
  const before = example.apps?.length ? example.apps : reportSteps;
  const changes = before && currentSteps?.length ? appChanges(before, currentSteps) : [];
  if (!changes.length) return NO_NOTE;
  return { text: REPORT_NOTE_TEXT, detail: changesText(changes) };
};

// reportNote for a workflow's example, loading the report's version's steps
// when it needs them. loadVersion: version -> that version shaped as a
// workflow ({ dag }); where that fails, there's no note.
export const loadReportNote = async (example, currentWorkflow, loadVersion) => {
  if (!example) return NO_NOTE;
  const currentSteps = appSteps(currentWorkflow);
  let reportSteps = null;
  if (!example.apps?.length && example.fromVersion && currentSteps.length && loadVersion) {
    try {
      reportSteps = appSteps(await loadVersion(example.fromVersion));
    } catch {
      reportSteps = null;
    }
  }
  return reportNote(example, { reportSteps, currentSteps });
};

// A workflow version (shaped as a workflow) per uuid and version, fetched
// once: a version doesn't change. fetch: (uuid, version) -> the version.
export const createVersionCache = (fetch) => {
  const entries = new Map();
  return (uuid, version) => {
    const key = `${uuid}@${version}`;
    if (!entries.has(key)) {
      const p = Promise.resolve()
        .then(() => fetch(uuid, version))
        .catch((err) => {
          entries.delete(key);
          throw err;
        });
      entries.set(key, p);
    }
    return entries.get(key);
  };
};
