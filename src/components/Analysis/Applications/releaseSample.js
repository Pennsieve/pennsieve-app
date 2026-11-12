/*
  What the release pipeline makes of an App Store version after its image
  is built (app-deploy-service docs/builds.md): a bundle of the app's test
  inputs (version.fixtures), a run of the image on them (version.sampleRun)
  and, from that run's results, the sample document curation-service
  renders (version.sample). Each is a record with a status and, when it
  stopped short, an error { code, message }.

  Pure helpers: the stages of a version as chips (releaseStages), and the
  app's sample document as the page shows it (releaseSample): the newest
  version's, when it is ready and public (a public app's copies are served
  unsigned from the package assets host, assetsUrl).
*/

export const STAGES = [
  { key: "fixtures", label: "Fixtures", what: "the app's test inputs, bundled at release" },
  { key: "sampleRun", label: "Sample run", what: "the release run on its test inputs" },
  { key: "sample", label: "Report", what: "the release report rendered from that run" },
];

const TONES = {
  ready: "green",
  building: "blue",
  running: "blue",
  queued: "blue",
  failed: "red",
  skipped: "gray",
};

// Why a stage stopped short, for people.
const REASONS = {
  no_review_block: "the app.yml has no review block (no test inputs declared)",
  private_repository: "the repository is private",
  platform_app: "a platform app",
  manifest_missing: "no app.yml",
  build_failed: "the build failed",
  needs_hardware: "needs a GPU, or more memory than the sample runner has",
  no_bundle: "no test inputs to run on",
  bundle_unavailable: "the test inputs could not be fetched",
  bundle_too_large: "the test inputs are too large",
  results_unavailable: "the run's results could not be read",
};

const text = (status) => (status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "");

export function stageReason(rec) {
  const err = rec?.error;
  if (!err) return "";
  return REASONS[err.code] || err.message || err.code || "";
}

/*
  A version's pipeline stages, in order, for those it has: { key, label,
  status, text, tone, title, href? }. A version from before the pipeline
  has none. The sample document's chip links the document when it has a
  public copy.
*/
export function releaseStages(version, assetsUrl = "") {
  if (!version) return [];
  return STAGES.filter((s) => version[s.key]?.status).map((s) => {
    const rec = version[s.key];
    const status = String(rec.status).toLowerCase();
    const why = stageReason(rec);
    const where = s.key === "sampleRun" && rec.source === "node" ? "on a compute node of the owner's" : "";
    const title = [s.what, where, why && `${text(status)}: ${why}`].filter(Boolean).join(". ");
    const href = s.key === "sample" && status === "ready" ? publicUrl(assetsUrl, rec.public?.document) : "";
    return { key: s.key, label: s.label, status, text: text(status), tone: TONES[status] || "gray", title, ...(href && { href }) };
  });
}

export function publicUrl(assetsUrl, key) {
  if (!assetsUrl || !key) return "";
  return `${String(assetsUrl).replace(/\/+$/, "")}/${String(key).replace(/^\/+/, "")}`;
}

/*
  The sample document to show for the app: from the newest version whose
  document is ready with public copies (versions as listed, any order).
  Shaped like the owner-set sample output (useAppSample) with pipeline:
  true, so the same card and viewer take it.
*/
export function releaseSample(versions, assetsUrl) {
  const sorted = [...(versions || [])].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  for (const v of sorted) {
    const s = v?.sample;
    if (!s || String(s.status).toLowerCase() !== "ready") continue;
    const pdfUrl = publicUrl(assetsUrl, s.public?.document);
    if (!pdfUrl) continue;
    return {
      pipeline: true,
      versionId: v.uuid,
      app: { tag: v.version },
      pages: s.pages || 0,
      figures: s.figures || 0,
      createdAt: s.generatedAt || s.updatedAt || v.createdAt,
      pdfUrl,
      previewUrl: publicUrl(assetsUrl, s.public?.preview),
      crateUrl: publicUrl(assetsUrl, s.public?.crate),
    };
  }
  return null;
}

// Whether a version's pipeline is still at work: a stage under way, or one
// done and the next not yet recorded (within `window` ms of the version's
// release; after that a missing stage is one that was never started, as on
// a site without the sample runner).
export function pipelineBusy(version, now = Date.now(), window = 2 * 60 * 60 * 1000) {
  if (!version) return false;
  const st = (k) => String(version[k]?.status || "").toLowerCase();
  if (["building", "running", "queued"].includes(st("fixtures")) || ["building", "running", "queued"].includes(st("sampleRun"))) return true;
  const recent = now - (Date.parse(version.createdAt) || 0) < window;
  if (!recent) return false;
  if (st("fixtures") === "ready" && !st("sampleRun")) return true;
  if (st("sampleRun") === "ready" && !st("sample")) return true;
  return false;
}
