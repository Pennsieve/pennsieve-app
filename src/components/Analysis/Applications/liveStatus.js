/*
  Live build status of App Store versions (app-deploy-service #209). A
  release's builds publish on the channel of the version they build
  (/applications/<version uuid>; application_id is the version's uuid):
  - application_status_event: the version's own status. For an app with
    variants it is the default variant's build, and names it (variant).
  - application_variant_status_event: a build of another variant. It
    updates that variant only, never the version: a failed GPU build leaves
    the version deployed.
  Payload (snake_case): { application_id, deployment_id, status, is_error,
  time, source, variant }. A failure's reason comes in the status ("error:
  <reason>"), or as failureReason / failure_reason where given.

  - application_fixtures_status_event, application_sample_run_status_event,
    application_sample_status_event: the release pipeline's stages after
    the build (releaseSample.js), laid over the version's records.

  Pure: events go into a map of live statuses by version uuid
  (recordStatusEvent), laid over the app as listed (withLiveStatus).
*/

import { pipelineBusy } from "./releaseSample";

export const STATUS_EVENT = "application_status_event";
export const VARIANT_STATUS_EVENT = "application_variant_status_event";
// The release pipeline after the build (releaseSample.js): the version's
// fixture bundle, sample run and sample document. Payload (snake_case):
// { application_id, status, error_code?, error_message?, time, source },
// the sample's with document_key, preview_key, pages.
export const FIXTURES_STATUS_EVENT = "application_fixtures_status_event";
export const SAMPLE_RUN_STATUS_EVENT = "application_sample_run_status_event";
export const SAMPLE_STATUS_EVENT = "application_sample_status_event";
export const STAGE_EVENTS = {
  [FIXTURES_STATUS_EVENT]: "fixtures",
  [SAMPLE_RUN_STATUS_EVENT]: "sampleRun",
  [SAMPLE_STATUS_EVENT]: "sample",
};
export const LIVE_EVENTS = [STATUS_EVENT, VARIANT_STATUS_EVENT, ...Object.keys(STAGE_EVENTS)];

// A status and its reason from an event: "error: no such target" ->
// { status: "error", failureReason: "no such target" }.
export function parseStatus(data) {
  const raw = String(data?.status || "");
  const given = data?.failureReason || data?.failure_reason || "";
  const m = /^error:\s*(.*)$/is.exec(raw);
  if (m) return { status: "error", failureReason: given || m[1] };
  if (data?.is_error && raw) return { status: raw, failureReason: given };
  return { status: raw, failureReason: given };
}

/*
  The live statuses with one event recorded: { [versionUuid]: { status?,
  failureReason?, variants: { [id]: { status, failureReason } } } }. A new
  object (for reactivity); the same one for an event that isn't a status.
*/
export function recordStatusEvent(live, name, data) {
  const id = data?.application_id;
  if (!id) return live;
  if (STAGE_EVENTS[name]) return recordStageEvent(live, STAGE_EVENTS[name], id, data);
  if (name !== STATUS_EVENT && name !== VARIANT_STATUS_EVENT) return live;
  const entry = live?.[id] || { variants: {} };
  const parsed = parseStatus(data);
  const next = { ...entry, variants: { ...entry.variants } };
  if (name === STATUS_EVENT) {
    next.status = parsed.status;
    next.failureReason = parsed.failureReason;
    // The default variant's build is the version's.
    if (data.variant) next.variants[data.variant] = { status: parsed.status, failureReason: parsed.failureReason };
  } else {
    if (!data.variant) return live;
    next.variants[data.variant] = { status: parsed.status, failureReason: parsed.failureReason };
  }
  return { ...live, [id]: next };
}

// A pipeline stage's event, as the stage's record on the version (what
// withLiveStatus lays over it): { status, error?, documentKey?, ... }.
function recordStageEvent(live, stage, id, data) {
  const status = String(data.status || "");
  if (!status) return live;
  const rec = { status, updatedAt: data.time || new Date().toISOString() };
  if (data.error_code || data.error_message) rec.error = { code: data.error_code || "", message: data.error_message || "" };
  if (stage === "sample") {
    if (data.document_key) rec.documentKey = data.document_key;
    if (data.preview_key) rec.previewKey = data.preview_key;
    if (data.pages) rec.pages = data.pages;
  }
  const entry = live?.[id] || { variants: {} };
  return { ...live, [id]: { ...entry, stages: { ...(entry.stages || {}), [stage]: rec } } };
}

// A version's variants with live statuses over them, in the shape they
// came in (a list, or a map by id).
const overlayVariants = (variants, live) => {
  if (!variants || !live || !Object.keys(live).length) return variants;
  const over = (id, v) => (live[id] ? { ...v, status: live[id].status, failureReason: live[id].failureReason || "" } : v);
  if (Array.isArray(variants)) return variants.map((v) => over(v?.id, v));
  return Object.fromEntries(Object.entries(variants).map(([id, v]) => [id, over(id, v)]));
};

// An app with the live statuses over its versions; the app itself when
// none of its versions has one.
export function withLiveStatus(app, live) {
  if (!app || !live || !(app.versions || []).some((v) => live[v.uuid])) return app;
  return {
    ...app,
    versions: app.versions.map((v) => {
      const l = live[v.uuid];
      if (!l) return v;
      const stages = Object.fromEntries(
        Object.entries(l.stages || {}).map(([k, rec]) => [k, { ...(v[k] || {}), ...rec }])
      );
      return {
        ...v,
        ...(l.status !== undefined && { status: l.status }),
        variants: overlayVariants(v.variants, l.variants),
        ...stages,
      };
    }),
  };
}

// Still building: a status without one ("") is no build recorded, not one
// under way.
const BUILDING = ["registering", "building", "deploying", "re-deploying", "pending"];
const building = (status) => BUILDING.includes(String(status || "").toLowerCase());
const variantStatuses = (variants) =>
  Array.isArray(variants) ? variants.map((v) => v?.status) : Object.values(variants || {}).map((v) => v?.status);

// Whether a version's builds are still going: its own, or (an app with
// variants) any variant's.
export function versionBuilding(version) {
  if (!version) return false;
  if (building(version.status)) return true;
  return variantStatuses(version.variants).some(building);
}

// Whether to keep listening to a version: its builds, or the release
// pipeline after them (releaseSample.js), still at work.
export function versionActive(version, now = Date.now()) {
  return versionBuilding(version) || pipelineBusy(version, now);
}

// The versions whose channels to listen on: those still building. latest:
// only the newest (what an app card shows).
export function versionsToWatch(app, { latest = false } = {}) {
  const versions = [...(app?.versions || [])].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return (latest ? versions.slice(0, 1) : versions).filter((v) => v.uuid && versionActive(v)).map((v) => v.uuid);
}
