// Tab completion and Shift-Tab help in the cell editor, from the kernel
// (Jupyter's complete_request and inspect_request), turned into what
// CodeMirror wants. Kept free of the editor and the kernel so it can be tested.
import { ansiRuns } from "./outputHelpers";

// How long the editor waits for the kernel: a kernel running a cell answers
// only when it's done, and a late answer is no use to someone typing.
export const KERNEL_HELP_MS = 3000;

// The reply's content when the kernel answered "ok" in time, else null (no
// kernel, an error, or no answer within the time).
export async function kernelReply(request, timeoutMs = KERNEL_HELP_MS) {
  let timer;
  try {
    const reply = await Promise.race([
      request(),
      new Promise((resolve) => (timer = setTimeout(() => resolve(null), timeoutMs))),
    ]);
    return reply?.content?.status === "ok" ? reply.content : null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Jupyter counts cursor positions in code points, JavaScript strings in
// UTF-16 units: they differ after an emoji or another character outside the BMP.
const isPair = (text, i) => {
  const c = text.charCodeAt(i);
  if (c < 0xd800 || c > 0xdbff) return false;
  const d = text.charCodeAt(i + 1);
  return d >= 0xdc00 && d <= 0xdfff;
};
export function toCodePoints(text, offset) {
  let n = 0;
  for (let i = 0; i < offset; i++, n++) if (isPair(text, i) && i + 1 < offset) i++;
  return n;
}
export function fromCodePoints(text, points) {
  let i = 0;
  for (let n = 0; n < points && i < text.length; n++) i += isPair(text, i) ? 2 : 1;
  return i;
}

// The kernel's kinds of match (IPython's experimental types) as CodeMirror's
// completion icons.
const TYPES = {
  function: "function",
  class: "class",
  module: "namespace",
  keyword: "keyword",
  magic: "keyword",
  instance: "variable",
  statement: "variable",
  param: "variable",
  property: "property",
  path: "text",
};

// A complete_reply as a CodeMirror completion result (positions in the
// editor's units), or null when there's nothing to offer.
export function completionResult(text, reply) {
  if (!reply?.matches?.length) return null;
  const types = new Map();
  for (const t of reply.metadata?._jupyter_types_experimental || []) {
    if (t && typeof t.text === "string") types.set(t.text, t.type);
  }
  const options = [...new Set(reply.matches.filter((m) => typeof m === "string" && m))].map((label) => {
    const type = TYPES[types.get(label)];
    return type ? { label, type } : { label };
  });
  if (!options.length) return null;
  return {
    from: fromCodePoints(text, reply.cursor_start),
    to: fromCodePoints(text, reply.cursor_end),
    options,
    // Typing more of a name narrows the list here; anything else asks again.
    validFor: /^[\w$]*$/,
  };
}

// An inspect_reply as plain text (IPython colours its help), shortened, or ""
// when the kernel found nothing.
const HELP_CHARS = 4000;
export function inspectText(reply) {
  const raw = reply?.found ? reply.data?.["text/plain"] : "";
  if (!raw || typeof raw !== "string") return "";
  const text = ansiRuns(raw).map((r) => r.text).join("").trim();
  return text.length > HELP_CHARS ? text.slice(0, HELP_CHARS) + "\n…" : text;
}

// Tab completes after a character, as in JupyterLab, and indents at the start
// of a line or after a space.
export const completesHere = (lineBefore) => /\S$/.test(lineBefore);
// Shift-Tab shows help anywhere after code on the line (inside a call's
// parentheses too), and dedents on an empty or indented-only line.
export const helpsHere = (lineBefore) => /\S/.test(lineBefore);
