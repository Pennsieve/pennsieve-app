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
