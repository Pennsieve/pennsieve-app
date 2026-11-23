// Kernel output handling for the notebook, kept free of Vue and the kernel
// connection so it can be tested: stream coalescing, and Jupyter's display ids
// (display(obj, display_id=...) then handle.update(...)).

// Apply carriage returns: within each line, a \r resets to the start, so keep
// only the text after the last \r (collapses tqdm-style progress bars to their
// final state instead of concatenating every update). \r\n is a line end
// (pip writes them), even split across two writes: a \r at the very end is
// kept, so the next write decides what it was.
export function applyCarriageReturns(text) {
  if (text.indexOf("\r") === -1) return text;
  const t = text.replace(/\r\n/g, "\n");
  const tail = t.endsWith("\r") ? "\r" : "";
  return (
    t
      .replace(/\r+$/, "")
      .split("\n")
      .map((line) => {
        const i = line.lastIndexOf("\r");
        return i === -1 ? line : line.slice(i + 1);
      })
      .join("\n") + tail
  );
}

// Terminal colours (ANSI SGR codes) as runs of text with classes, as Jupyter
// shows them; other escape sequences (cursor moves, erasing, titles) are
// dropped. 256-colour and RGB codes are read past and left uncoloured.
const ANSI_COLORS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
const ANSI_ESCAPE = /\x1b\[([0-9;?]*)([A-Za-z])|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g;
export function ansiRuns(text) {
  const s = String(text ?? "");
  const runs = [];
  let fg = null;
  let bg = null;
  let bold = false;
  const push = (part) => {
    if (!part) return;
    const cls = [fg && `ansi-${fg}-fg`, bg && `ansi-${bg}-bg`, bold && "ansi-bold"].filter(Boolean).join(" ");
    const prev = runs[runs.length - 1];
    if (prev && prev.cls === cls) prev.text += part;
    else runs.push({ text: part, cls });
  };
  let last = 0;
  ANSI_ESCAPE.lastIndex = 0;
  for (let m; (m = ANSI_ESCAPE.exec(s)); ) {
    push(s.slice(last, m.index));
    last = ANSI_ESCAPE.lastIndex;
    if (m[2] !== "m") continue;
    const codes = (m[1] || "0").split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) [fg, bg, bold] = [null, null, false];
      else if (c === 1) bold = true;
      else if (c === 22) bold = false;
      else if (c >= 30 && c <= 37) fg = ANSI_COLORS[c - 30];
      else if (c >= 90 && c <= 97) fg = `bright-${ANSI_COLORS[c - 90]}`;
      else if (c === 39) fg = null;
      else if (c >= 40 && c <= 47) bg = ANSI_COLORS[c - 40];
      else if (c >= 100 && c <= 107) bg = `bright-${ANSI_COLORS[c - 100]}`;
      else if (c === 49) bg = null;
      else if (c === 38 || c === 48) i += codes[i + 1] === 5 ? 2 : codes[i + 1] === 2 ? 4 : 0;
    }
  }
  push(s.slice(last));
  return runs;
}

// A stream output's text as shown: a trailing \r (kept for the next write) hidden.
export const streamText = (o) => (Array.isArray(o.text) ? o.text.join("") : o.text || "").replace(/\r+$/, "");

// Coalesce consecutive stream outputs of the same name (matches Jupyter), and
// collapse carriage returns so progress bars render cleanly.
export function pushOutput(cell, out) {
  if (out.output_type === "stream") {
    const last = cell.outputs[cell.outputs.length - 1];
    if (last && last.output_type === "stream" && last.name === out.name) {
      last.text = applyCarriageReturns(last.text + out.text);
      return;
    }
    out.text = applyCarriageReturns(out.text);
  }
  cell.outputs.push(out);
}

// The display id a display_data message carries (content.transient.display_id),
// or null. Transient data is never part of the saved notebook.
export function displayIdOf(content) {
  const id = content?.transient?.display_id;
  return typeof id === "string" && id ? id : null;
}

// update_display_data: replace the data and metadata of every output shown
// with this display id, in any cell of the notebook (as Jupyter does). Returns
// how many it updated; an id nothing shows is ignored.
export function updateDisplay(cells, displayId, content) {
  if (!displayId) return 0;
  let n = 0;
  for (const cell of cells || []) {
    for (const o of cell.outputs || []) {
      if (o._displayId !== displayId) continue;
      o.data = content?.data || {};
      o.metadata = content?.metadata || {};
      n++;
    }
  }
  return n;
}

// Outputs as nbformat has them: without our own fields (those starting with
// "_", like _displayId), which aren't valid in a saved notebook.
export function toNbOutputs(outputs) {
  return (outputs || []).map((o) => {
    if (!Object.keys(o).some((k) => k.startsWith("_"))) return o;
    return Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
  });
}
