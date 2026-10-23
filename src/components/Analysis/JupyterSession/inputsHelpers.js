// Browsing a dataset view's entries (each { cratePath, size, ... }) as
// folders, for the notebook's Inputs panel.

// Identifies a file (or folder, its path ending in "/") of a data source.
export const inputKey = (source, path) => `${source}\0${path}`;

// The folders and files directly in folder ("" or "a/b/"): folders first,
// each with the count and size of every file below it.
export function folderContents(entries, folder = "") {
  const folders = new Map();
  const files = [];
  for (const e of entries) {
    if (!e.cratePath.startsWith(folder)) continue;
    const rest = e.cratePath.slice(folder.length);
    const slash = rest.indexOf("/");
    if (slash < 0) {
      files.push({ type: "file", name: rest, path: e.cratePath, size: e.size || 0, entry: e });
      continue;
    }
    const name = rest.slice(0, slash);
    const f = folders.get(name) || { type: "folder", name, path: `${folder}${name}/`, count: 0, size: 0 };
    f.count++;
    f.size += e.size || 0;
    folders.set(name, f);
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  return [...[...folders.values()].sort(byName), ...files.sort(byName)];
}

// Every entry below a folder path ("a/b/"), or the one entry at a file path.
export function filesUnder(entries, path) {
  return path.endsWith("/")
    ? entries.filter((e) => e.cratePath.startsWith(path))
    : entries.filter((e) => e.cratePath === path);
}

// How far the downloads of files have got. stateOf(entry) is the sidecar's
// state of a file, or undefined if it wasn't asked for.
export function summarize(files, stateOf) {
  const s = { total: files.length, done: 0, failed: 0, active: 0, bytes: 0, size: 0 };
  for (const e of files) {
    const st = stateOf(e);
    if (!st) continue;
    if (st.state === "done") s.done++;
    else if (st.state === "failed") s.failed++;
    else {
      s.active++;
      s.bytes += st.bytes || 0;
      s.size += st.size || e.size || 0;
    }
  }
  return s;
}

// A row's badge: failures first, then progress, then how much is done.
export function rowStatus(s) {
  if (s.failed) return { cls: "failed", text: `${s.failed} failed` };
  if (s.active) return { cls: "active", text: `${Math.floor((100 * s.bytes) / (s.size || 1))}%` };
  if (s.total && s.done === s.total) return { cls: "done", text: "✓" };
  if (s.done) return { cls: "partial", text: `${s.done}/${s.total}` };
  return null;
}

// The files a selection of keys stands for, less those already queued,
// downloading or done (a failed one is asked for again).
export function pendingFiles(sources, selected, states) {
  const out = new Map();
  for (const source of sources) {
    for (const key of selected) {
      const [nodeId, path] = key.split("\0");
      if (nodeId !== source.nodeId) continue;
      for (const e of filesUnder(source.entries, path)) {
        const k = inputKey(source.nodeId, e.cratePath);
        const st = states[k]?.state;
        if (st && st !== "failed") continue;
        out.set(k, { source: source.nodeId, path: e.cratePath, size: e.size || 0 });
      }
    }
  }
  return [...out.values()];
}
