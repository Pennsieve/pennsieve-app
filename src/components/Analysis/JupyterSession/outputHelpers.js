// Kernel output handling for the notebook, kept free of Vue and the kernel
// connection so it can be tested: stream coalescing, and Jupyter's display ids
// (display(obj, display_id=...) then handle.update(...)).

// Apply carriage returns: within each line, a \r resets to the start, so keep
// only the text after the last \r (collapses tqdm-style progress bars to their
// final state instead of concatenating every update).
export function applyCarriageReturns(text) {
  if (text.indexOf("\r") === -1) return text;
  return text
    .split("\n")
    .map((line) => {
      const i = line.lastIndexOf("\r");
      return i === -1 ? line : line.slice(i + 1);
    })
    .join("\n");
}

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
