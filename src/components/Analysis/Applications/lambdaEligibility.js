/*
  Whether a version (or one of its variants) may run on Lambda. Every image
  CodeBuild builds carries the Lambda step runtime; app-deploy-service checks
  per version (and per variant) whether it fits Lambda (image size, memory,
  timeout, the author's opt-out) and records it on the version as
  lambda: { eligible, reasons, imageBytes, checkedAt }, absent until checked.
  A variant's record wins over its version's. Without a record, the old rule
  holds: the app.yml lists lambda in runtime.computeTypes. Either way an
  author's runtime.optimize: false keeps it off Lambda. Pure.
*/
import { versionOf } from "../WorkflowBuilder/appManifestInfo";

export const LAMBDA_OPT_OUT_REASON = "The app's author keeps it off Lambda";
export const LAMBDA_UNCHECKED_REASON = "Not checked for Lambda yet, and its app.yml doesn't list lambda";

// A version's variant entry by id, whether the version stores its variants
// as a map by id or as a list; null when it has none or not that one.
function variantEntry(version, id) {
  const raw = version?.variants;
  if (!id || !raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) return raw.find((v) => v && v.id === id) || null;
  return raw[id] ? { ...raw[id], id } : null;
}

const isRecord = (r) => !!r && typeof r === "object" && typeof r.eligible === "boolean";

/*
  { available, reasons, known } for a version entry (an app's versions[]) and
  optionally a variant (its id, or the variant entry itself). known: there is
  a lambda record to go by; reasons: why not, [] when available (and, without
  a record, the one fallback reason).
*/
export function lambdaEligibility(version, variant) {
  if (!version) return { available: false, reasons: [], known: false };
  const v = typeof variant === "string" ? variantEntry(version, variant) : variant || null;
  // No variant asked for: the version's record, else its default variant's
  // (the version's manifest is the default's).
  const fallbackVariant = !v ? variantEntry(version, version.defaultVariant) : null;
  const record = [v?.lambda, version.lambda, fallbackVariant?.lambda].find(isRecord) || null;
  const manifest = v?.manifest || version.manifest || null;
  const runtime = manifest?.runtime || {};
  const optedOut = runtime.optimize === false;
  if (record) {
    const reasons = record.eligible ? [] : (record.reasons || []).filter(Boolean);
    if (optedOut && !reasons.includes(LAMBDA_OPT_OUT_REASON)) reasons.push(LAMBDA_OPT_OUT_REASON);
    return { available: record.eligible && !optedOut, reasons, known: true };
  }
  if (optedOut) return { available: false, reasons: [LAMBDA_OPT_OUT_REASON], known: false };
  const listed = (runtime.computeTypes || []).includes("lambda");
  return { available: listed, reasons: listed ? [] : [LAMBDA_UNCHECKED_REASON], known: false };
}

const newest = (app) =>
  [...(app?.versions || [])].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0] || null;

// The same for an app (the app store's entry, with its versions): the version
// a tag names, else the newest with a manifest (as versionManifest), else the
// newest.
export function appLambdaEligibility(app, tag, variant) {
  return lambdaEligibility(versionOf(app, tag) || newest(app), variant);
}

// Why Lambda can't be chosen, for a disabled option's tooltip; "" when it can.
export function lambdaUnavailableHint(e) {
  if (!e || e.available) return "";
  const why = e.reasons?.length ? e.reasons.join("; ") : "it doesn't fit Lambda";
  return `Lambda isn't available for this version: ${why}.`;
}

// What the app's page shows: "available", "not available: <reasons>", or,
// without a record, "not checked yet" (noting when its app.yml lists lambda,
// which is what lets it run there meanwhile).
export function lambdaStatusLabel(e) {
  if (!e) return "";
  const why = e.reasons?.length ? `not available: ${e.reasons.join("; ")}` : "not available";
  if (e.known) return e.available ? "available" : why;
  if ((e.reasons || []).includes(LAMBDA_OPT_OUT_REASON)) return why;
  return e.available ? "not checked yet (its app.yml lists lambda)" : "not checked yet";
}

// A step's compute choices, in order: standard, lambda (always listed, so it
// can be shown disabled with why), then gpu, then anything else given.
export function withLambdaChoice(types) {
  const set = new Set(["standard", "lambda", ...(types || [])]);
  const order = ["standard", "lambda", "gpu"];
  return [...order.filter((t) => set.has(t)), ...[...set].filter((t) => !order.includes(t))];
}
