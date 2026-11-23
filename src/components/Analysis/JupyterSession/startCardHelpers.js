// The notebook's start card (StartCard.vue): how much of a layout's files is
// in the session. Kept free of Vue so it can be tested.

// { total, done, under, failed, all, percent, left, leftBytes } for the files
// (crate paths) of a source: left are those neither downloaded nor under way.
export function starterState(inputs, source, files) {
  const paths = new Set(files);
  const entries = (source?.entries || []).filter((e) => paths.has(e.cratePath));
  let done = 0, under = 0, failed = 0, bytes = 0, size = 0;
  const left = [];
  for (const e of entries) {
    const st = inputs.stateOf(source, e.cratePath);
    if (st?.state === "done") done++;
    else if (st?.state === "queued" || st?.state === "downloading") {
      under++;
      bytes += st.bytes || 0;
      size += st.size || e.size || 0;
    } else {
      if (st?.state === "failed") failed++;
      left.push(e);
    }
  }
  return {
    total: entries.length,
    done,
    under: under > 0,
    failed: failed > 0 && under === 0,
    all: entries.length > 0 && done === entries.length,
    percent: size ? Math.floor((100 * bytes) / size) : 0,
    left,
    leftBytes: left.reduce((n, e) => n + (e.size || 0), 0),
  };
}

// Whether a notebook has no code yet (the start card's time): a title or
// notes in Markdown don't count.
export const notebookEmpty = (cells) => (cells || []).every((c) => c.cell_type !== "code" || !String(c.source || "").trim());
