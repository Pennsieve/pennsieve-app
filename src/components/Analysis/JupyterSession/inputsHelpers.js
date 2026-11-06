// Browsing a dataset view's entries (each { cratePath, size, ... }) as
// folders, for the notebook's Inputs panel.

// Identifies a file (or folder, its path ending in "/") of a data source.
export const inputKey = (source, path) => `${source}\0${path}`;

// The folders and files directly in folder ("" or "a/b/"): folders first,
// each with the count and size of every file below it.
// A view's stacks (a Zarr: one entry, read in place, its cratePath ending in
// /) show in their folders too, as rows of their own; folders count files
// only.
export function folderContents(entries, folder = "", stacks = []) {
  const folders = new Map();
  const files = [];
  for (const e of stacks) {
    if (!e.cratePath.startsWith(folder)) continue;
    const rest = e.cratePath.slice(folder.length).replace(/\/$/, "");
    const slash = rest.indexOf("/");
    if (slash < 0) {
      files.push({ type: "stack", name: rest, path: e.cratePath, size: e.size || 0, entry: e });
      continue;
    }
    const name = rest.slice(0, slash);
    if (!folders.has(name)) folders.set(name, { type: "folder", name, path: `${folder}${name}/`, count: 0, size: 0 });
  }
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

// A view's entries apart: its files, and its stacks (read in place).
export function splitStacks(entries = []) {
  const files = [];
  const stacks = [];
  for (const e of entries) (e.kind === "stack" ? stacks : files).push(e);
  return { files, stacks };
}

// A stack's format for people: "OME-Zarr", "Zarr".
export const stackFormat = (e) => (e?.format === "ome-zarr" ? "OME-Zarr" : e?.format === "zarr" ? "Zarr" : "Folder");
// Its icon: an image (OME-Zarr) or data.
export const stackIcon = (e) => (e?.format === "ome-zarr" ? "/file-icons/icon-microscope.svg" : "/file-icons/icon-data.svg");

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

// A long name shortened in the middle, so names that differ only at the end
// (sub-01_run-1.nii, sub-01_run-2.nii) stay apart.
export function middleTruncate(name, max = 30) {
  if (!name || name.length <= max) return name;
  const tail = Math.ceil((max - 1) / 2);
  return `${name.slice(0, max - 1 - tail)}…${name.slice(-tail)}`;
}

// The input folder an added view goes in: the dataset's name and the last
// folder of its prefix, as a session source's name allows (letters, digits,
// '.', '_', '-', starting with a letter or digit). n > 1 for the next free one.
export function addedSourceName(dataset, prefix = "", n = 1) {
  const last = prefix.split("/").filter(Boolean).pop() || "";
  const clean = (s) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "").replace(/-+$/, "");
  const base = [clean(dataset), clean(last)].filter(Boolean).join("-").slice(0, 80) || "added";
  return n > 1 ? `${base}-${n}` : base;
}

// An input's second line: where it came from, and its folder of input/ as
// the session's files show it ("OpenNeuro · openneuro-ds008968",
// "SPARC · sparc-704"). folder is
// "" when the session can't say (an older sidecar).
// The Open Data entries a data platform of its own reads from.
const OPEN_DATA_PLATFORMS = { openneuro: "OpenNeuro", sparc: "SPARC", "epilepsy-science": "Epilepsy.Science", dandiarchive: "DANDI" };
export function inputSubtitle({ openDataset = "", sourceVersion = null, folder = "" } = {}) {
  const platform =
    OPEN_DATA_PLATFORMS[openDataset]
      ? OPEN_DATA_PLATFORMS[openDataset]
      : openDataset
      ? "AWS Open Data"
      : sourceVersion
      ? `Pennsieve Discover v${sourceVersion}`
      : "Pennsieve Discover";
  return folder ? `${platform} · ${folder}` : platform;
}

// How much of the session's disk the downloaded inputs take: { text, share,
// full } with share 0 to 1 and full past 80%. diskGiB is the disk the user
// chose; a session without one (GPU: its instance's disk) shows only the
// bytes.
const GB = 1e9;
export function inputsDiskUse(bytes, diskGiB) {
  const used = `${(bytes / GB).toFixed(1)} GB`;
  if (!diskGiB) return { text: `${used} of inputs in the session`, share: null, full: false };
  const share = Math.min(1, bytes / (diskGiB * 2 ** 30));
  return { text: `${used} of inputs on the session's ${diskGiB} GB disk`, share, full: share > 0.8 };
}
