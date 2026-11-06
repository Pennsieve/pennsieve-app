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

// A stack's format for people: "OME-Zarr", "Zarr", "Precomputed volume"
// (Neuroglancer's, as BossDB's), "Whole-slide image" (DICOM, as IDC's).
const STACK_FORMATS = {
  "ome-zarr": "OME-Zarr",
  zarr: "Zarr",
  "neuroglancer-precomputed": "Precomputed volume",
  "dicom-wsi": "Whole-slide image",
};
export const stackFormat = (e) => STACK_FORMATS[e?.format] || "Folder";
// Its icon: an image (OME-Zarr, a precomputed volume, a slide) or data.
const IMAGE_STACKS = new Set(["ome-zarr", "neuroglancer-precomputed", "dicom-wsi"]);
export const stackIcon = (e) => (IMAGE_STACKS.has(e?.format) ? "/file-icons/icon-microscope.svg" : "/file-icons/icon-data.svg");

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
// "SPARC · sparc-704"). platform is the name of the data platform whose own
// Open Data entry openDataset is (platforms platformReading), if any; folder
// is "" when the session can't say (an older sidecar).
export function inputSubtitle({ platform: own = "", openDataset = "", sourceVersion = null, folder = "" } = {}) {
  const platform =
    own || (openDataset ? "AWS Open Data" : sourceVersion ? `Pennsieve Discover v${sourceVersion}` : "Pennsieve Discover");
  return folder ? `${platform} · ${folder}` : platform;
}

// What downloading files ({ size, region }) costs the session's node's
// account, when it costs anything: { bytes, usd, regions, nodeRegion }, or
// null. A secure node's tasks are in private subnets: S3 in its own region
// is reached through its gateway endpoint, free, but another region's goes
// through its NAT gateway, charged per GB processed (AWS's US price; the
// bucket's owner pays the transfer itself). A basic node reaches it
// directly, and a compliant node can't at all.
export const NAT_COST_PER_GB = 0.045;
export function transferCost(files = [], node = null) {
  if (!node?.region || (node.deploymentMode || "").toLowerCase() !== "secure") return null;
  const cross = files.filter((f) => f.region && f.region !== node.region);
  const bytes = cross.reduce((n, f) => n + (f.size || 0), 0);
  if (!bytes) return null;
  return { bytes, usd: (bytes / 1e9) * NAT_COST_PER_GB, regions: [...new Set(cross.map((f) => f.region))].sort(), nodeRegion: node.region };
}

// A cost in a sentence: "about $0.55", "less than $0.01".
export const costText = (usd) => (usd < 0.01 ? "less than $0.01" : `about $${usd < 10 ? usd.toFixed(2) : Math.round(usd).toLocaleString("en-US")}`);

// A transferCost in a sentence, for the download's prompt.
export const costLine = (c) =>
  `${c.regions.join(" and ")} to this ${c.nodeRegion} node: ${costText(c.usd)} for the node's network to carry ${
    c.bytes >= 1e9 ? `${(c.bytes / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(c.bytes / 1e6))} MB`
  }.`;

// Whether the user said not to be told of transfer costs again in this
// session (a run): kept for the browser tab, so a reload doesn't ask again.
// Storage can be unavailable: then it's asked again.
const costKey = (runId) => `pennsieve.sessionFiles.costNoted.${runId}`;
export function readCostNoted(runId, storage = globalThis.sessionStorage) {
  try {
    return !!runId && storage?.getItem(costKey(runId)) === "true";
  } catch {
    return false;
  }
}
export function writeCostNoted(runId, storage = globalThis.sessionStorage) {
  try {
    if (runId) storage?.setItem(costKey(runId), "true");
  } catch {
    // not kept
  }
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
