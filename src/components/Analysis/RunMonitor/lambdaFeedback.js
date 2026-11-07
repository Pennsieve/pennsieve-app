/*
  After a run: what a step's measured use says about Lambda. A step that ran
  on Lambda through an override (lambdaOverride) and succeeded gets the
  app.yml limits that would let it run there without one; one that failed
  there, a note to run it on standard. A step that ran on standard although
  its version misses Lambda only on declared limits (overridable), and used
  well within Lambda's, gets the same suggestion. Pure.
*/
import { LAMBDA_MAX_MEMORY } from "../Applications/lambdaEligibility";

// The most an app.yml's timeoutSeconds may declare and still fit Lambda.
export const LAMBDA_MAX_TIMEOUT = 900;

const known = (n) => typeof n === "number" && Number.isFinite(n);
const num = (v) => (v == null || v === "" ? null : Number(v));

/*
  The app.yml limits to suggest: { memory, timeoutSeconds }, each left out
  when its measure is unknown, or when its declared value is known and fits
  Lambda already. memory: 1.5x the peak in 512 MB steps (512 to 10240);
  timeoutSeconds: 3x the duration in whole minutes (300 to 900).
*/
export function suggestLambdaLimits({ peakMiB, durationSec, declaredMemory, declaredTimeout } = {}) {
  const out = {};
  const mem = num(declaredMemory);
  const timeout = num(declaredTimeout);
  if (known(peakMiB) && !(known(mem) && mem <= LAMBDA_MAX_MEMORY)) {
    out.memory = Math.min(LAMBDA_MAX_MEMORY, Math.max(512, Math.ceil((peakMiB * 1.5) / 512) * 512));
  }
  if (known(durationSec) && !(known(timeout) && timeout <= LAMBDA_MAX_TIMEOUT)) {
    out.timeoutSeconds = Math.min(LAMBDA_MAX_TIMEOUT, Math.max(300, Math.ceil((durationSec * 3) / 60) * 60));
  }
  return out;
}

// Whether measured use fits Lambda with room to spare: 1.5x the peak memory
// and 3x the duration within its limits, both known.
export function fitsLambdaWithHeadroom(peakMiB, durationSec) {
  return known(peakMiB) && known(durationSec) && peakMiB * 1.5 <= LAMBDA_MAX_MEMORY && durationSec * 3 <= LAMBDA_MAX_TIMEOUT;
}

const gb = (mib) => `${(mib / 1024).toFixed(1)} GB`;
const secs = (s) => `${Math.round(s)} s`;
const and = (parts) => parts.join(" and ");

// What the app declares that keeps it off Lambda: the record's reasons, else
// its declared values over Lambda's limits.
function declaresText(eligibility, mem, timeout) {
  if (eligibility?.reasons?.length) return eligibility.reasons.join("; ");
  const over = [];
  if (known(mem) && mem > LAMBDA_MAX_MEMORY) over.push(`memory: ${mem}`);
  if (known(timeout) && timeout > LAMBDA_MAX_TIMEOUT) over.push(`timeoutSeconds: ${timeout}`);
  return over.length ? and(over) : "limits over Lambda's";
}

// The suggestion as text and code segments (`memory: 2048`).
function suggestionSegments(s) {
  const codes = [];
  if (s.memory != null) codes.push({ code: `memory: ${s.memory}` });
  if (s.timeoutSeconds != null) codes.push({ code: `timeoutSeconds: ${s.timeoutSeconds}` });
  return codes.flatMap((c, i) => (i ? [" and ", c] : [c]));
}

/*
  The notice for a run's step, or null: { kind, segments }, segments being
  strings and { code } for what goes in app.yml. kind: "override-succeeded",
  "override-failed" or "standard-fits".
    status: the step's (SUCCEEDED, FAILED, ...)
    executionTarget, lambdaOverride: the run's processorConfigs entry
    eligibility: the pinned version's lambdaEligibility
    metrics: the step's nodeMetrics entry (maxMemoryUsedMiB, durationSec)
    declaredMemory, declaredTimeout: its app.yml's (or runtime config's)
*/
export function stepLambdaFeedback({ status, executionTarget, lambdaOverride, eligibility, metrics, declaredMemory, declaredTimeout } = {}) {
  const peak = metrics?.maxMemoryUsedMiB;
  const duration = metrics?.durationSec;
  const mem = num(declaredMemory);
  const timeout = num(declaredTimeout);
  const declares = declaresText(eligibility, mem, timeout);
  const suggestion = suggestLambdaLimits({ peakMiB: peak, durationSec: duration, declaredMemory: mem, declaredTimeout: timeout });
  const codes = suggestionSegments(suggestion);

  if (executionTarget === "lambda" && lambdaOverride === true) {
    if (status === "FAILED") {
      return {
        kind: "override-failed",
        segments: ["This step ran on Lambda by choice and failed; it may need more than Lambda gives. Run it on standard."],
      };
    }
    if (status !== "SUCCEEDED") return null;
    const used = [known(peak) && gb(peak), known(duration) && secs(duration)].filter(Boolean);
    return {
      kind: "override-succeeded",
      segments: [
        `This step ran on Lambda although its app.yml declares ${declares}.`,
        used.length ? ` It used ${and(used)}.` : "",
        codes.length
          ? " To run it on Lambda without an override, lower its limits in app.yml, for example "
          : " To run it on Lambda without an override, lower its limits in app.yml.",
        ...codes,
        codes.length ? "." : "",
      ].filter((s) => s !== ""),
    };
  }

  if (
    executionTarget === "standard" &&
    status === "SUCCEEDED" &&
    eligibility &&
    !eligibility.available &&
    eligibility.overridable === true &&
    fitsLambdaWithHeadroom(peak, duration) &&
    codes.length
  ) {
    return {
      kind: "standard-fits",
      segments: [
        `It looks like this app's app.yml limits are generous: this step used ${gb(peak)} and ${secs(duration)}, but the app declares ${declares}, which keeps it off Lambda. Lowering them to `,
        ...codes,
        " would let Pennsieve run it on a faster runtime automatically.",
      ],
    };
  }
  return null;
}

// The notice as plain text (backticks around code), for tests and titles.
export const feedbackText = (f) => (f ? f.segments.map((s) => (typeof s === "string" ? s : `\`${s.code}\``)).join("") : "");
