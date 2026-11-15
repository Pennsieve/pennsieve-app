// The notebook's code assistant (the session sidecar's /pennsieve/assist):
// what the browser sends it, and how its streamed reply is read. The sidecar
// makes the prompt; the browser only gathers the notebook's context.
import { sourceBase } from "./useSessionInputs";
import { stackFormat } from "./inputsHelpers";
import { stackCode } from "./pathCode";
export { sseEvents, deltaText } from "./assistStream";

// The first line of an accepted cell: what wrote it.
export const ASSIST_NOTE = "# Written by the AI assistant: check it before relying on it";

// How many cells above the cell go with a request (the sidecar keeps the
// nearest of them too).
const BEFORE = 8;
// How many of the session's files are listed.
const FILES = 200;

// The reply as a cell's code: without the Markdown fences a model may put
// around it anyway.
export function cellCode(text) {
  let t = String(text || "").trim();
  const m = t.match(/^```[\w+-]*\n([\s\S]*?)\n?```$/);
  if (m) t = m[1];
  else if (t.startsWith("```")) t = t.replace(/^```[\w+-]*\n?/, ""); // still arriving
  return t.trimEnd();
}

// The code an accepted reply puts in the cell: its note first, once.
export function acceptedCode(text) {
  const code = cellCode(text);
  return code.startsWith(ASSIST_NOTE) ? code : `${ASSIST_NOTE}\n${code}`;
}

// A cell's error, as the kernel reported it, in plain text; "" when it has
// none.
const ANSI = /\x1b\[[0-9;]*m/g;
export function cellError(cell) {
  const e = (cell?.outputs || []).find((o) => o.output_type === "error");
  if (!e) return "";
  return `${e.ename}: ${e.evalue}\n${(e.traceback || []).join("\n")}`.replace(ANSI, "");
}

// The code of the code cells above a cell, nearest last.
export function cellsBefore(cells, id) {
  const i = cells.findIndex((c) => c.id === id);
  return cells
    .slice(0, Math.max(0, i))
    .filter((c) => c.cell_type === "code" && c.source.trim())
    .slice(-BEFORE)
    .map((c) => c.source);
}

// The session's files, as its views list them: [{ path, size, note }].
// A stack is read in place, not from the disk, so its note says so and
// gives the code that opens it.
export function sessionFiles(sources, kernelName = "") {
  const files = [];
  for (const s of sources || []) {
    const base = sourceBase(s);
    for (const e of s.stacks || []) {
      const path = `${base}/${String(e.cratePath).replace(/\/$/, "")}`;
      files.push({
        path,
        size: e.size || undefined,
        note: `${stackFormat(e)}, read in place from cloud storage (not on the session's disk). Open it with:\n${stackCode(e, kernelName)}`,
      });
    }
    for (const e of s.entries || []) files.push({ path: `${base}/${e.cratePath}`, size: e.size || undefined });
  }
  return files.slice(0, FILES);
}

// A request: what the user asked (or the cell's error, to fix), with the
// notebook's context.
export function assistRequest({ mode = "write", prompt = "", cell, cells, kernelName, file = "", files = [], packages = [] }) {
  // The file asked about first: the list may be cut short, and its note
  // (how to open a stack) must go.
  const trim = (p) => String(p).replace(/^\/+|\/+$/g, "");
  const asked = file ? files.filter((f) => trim(f.path) === trim(file)) : [];
  const body = {
    mode,
    prompt,
    kernel: kernelName || "",
    cell: cell?.source || "",
    before: cellsBefore(cells || [], cell?.id),
    files: [...asked, ...files.filter((f) => !asked.includes(f))],
    packages,
  };
  if (file) body.file = file;
  if (mode === "fix") body.error = cellError(cell);
  return body;
}

// An agent's step, in words: what it looked at or ran.
const STEP_VERBS = { read_file: "Read", list_files: "Listed", inspect: "Looked at", run_code: "Ran" };
export function stepLabel(step) {
  const verb = STEP_VERBS[step?.tool] || "Used";
  return step?.tool === "run_code" ? `${verb} the fix` : `${verb} ${step?.summary || step?.tool || ""}`.trim();
}

const tokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const dollars = (n) => (n < 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);

// What a request used, for the line under its result: its tokens (as the
// governor counted them), its cost (the run's spend before and after it, so
// an estimate) and the run's spend of its budget.
export function usageLine(usage, budget) {
  const parts = [];
  if (usage) {
    // Cached input is read back at about a tenth of the price of new input,
    // so the two are told apart.
    const fresh = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    const cached = usage.cache_read_input_tokens || 0;
    parts.push(`${tokens(fresh)} new${cached ? ` + ${tokens(cached)} cached` : ""} tokens in, ${tokens(usage.output_tokens || 0)} out`);
  }
  if (budget?.requestUsd != null) parts.push(`about ${dollars(budget.requestUsd)}`);
  if (budget?.runUsedUsd != null && budget?.runBudgetUsd) parts.push(`${dollars(budget.runUsedUsd)} of this run's ${dollars(budget.runBudgetUsd)}`);
  return parts.join(" · ");
}

// The AI spend for the notebook's toolbar: the run's of its budget, or, for
// a run without a budget of its own (the governor then reports only the
// node's), the node's for the period ("$1.10 of $5.00 today"); how full
// (0..1); or null when the governor gave no figures.
const PERIODS = { daily: "today", weekly: "this week", monthly: "this month" };
export function runSpend(budget) {
  const clamp = (x) => Math.min(1, Math.max(0, x));
  if (budget?.runUsedUsd != null && budget?.runBudgetUsd) {
    const { runUsedUsd: used, runBudgetUsd: total } = budget;
    return { used, total, scope: "run", fraction: clamp(used / total), text: `${dollars(used)} of ${dollars(total)}` };
  }
  if (budget?.periodUsedUsd != null && budget?.periodBudgetUsd) {
    const { periodUsedUsd: used, periodBudgetUsd: total } = budget;
    const when = PERIODS[budget.period] || "this period";
    return { used, total, scope: "node", fraction: clamp(used / total), text: `${dollars(used)} of ${dollars(total)} ${when}` };
  }
  return null;
}

// A request's cost: the governor's for the run, or, without a run budget,
// the change in the node's spend across it (other runs on the node may add
// to it: an estimate).
export function requestCost(before, after) {
  if (after?.requestUsd != null) return after.requestUsd;
  if (before?.periodUsedUsd != null && after?.periodUsedUsd != null) return Math.max(0, after.periodUsedUsd - before.periodUsedUsd);
  return null;
}

// A cell's AI spend, kept with the notebook (cell metadata pennsieve.ai):
// its requests, their tokens, and their cost where the governor gave one.
export function addCellSpend(spend, usage, usd) {
  const t = usage ? (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0) : 0;
  const prev = spend || { requests: 0, tokens: 0, usd: 0 };
  return {
    requests: (prev.requests || 0) + 1,
    tokens: (prev.tokens || 0) + t,
    usd: Math.round(((prev.usd || 0) + (usd || 0)) * 1e6) / 1e6,
  };
}

// The cell's spend in its gutter: its cost, or its tokens without one.
export function cellSpendLabel(spend) {
  if (!spend?.requests) return "";
  return spend.usd > 0 ? dollars(spend.usd) : `${tokens(spend.tokens || 0)} tok`;
}

export function cellSpendTitle(spend) {
  if (!spend?.requests) return "";
  const n = spend.requests === 1 ? "1 request" : `${spend.requests} requests`;
  const cost = spend.usd > 0 ? `, about ${dollars(spend.usd)}` : "";
  return `AI assistant on this cell: ${n}, ${tokens(spend.tokens || 0)} tokens${cost}`;
}
