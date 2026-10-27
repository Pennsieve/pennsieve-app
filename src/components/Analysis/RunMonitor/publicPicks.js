// An input's picks from published datasets (PublicFilesPicker): files and
// folders, each { datasetId, version, datasetName, path, name, isFolder,
// size }. A pick is one path of one dataset version.

const keyOf = (p) => `${p.datasetId}:${p.version}:${p.path}`;
const sameVersion = (a, b) => a.datasetId === b.datasetId && a.version === b.version;

// Whether path in a dataset version is inside a chosen folder (not the
// folder itself): it's taken in already.
export const inChosenFolder = (picks, datasetId, version, path) =>
  picks.some((k) => k.isFolder && k.datasetId === datasetId && k.version === version && path.startsWith(`${k.path}/`));

export const isPicked = (picks, datasetId, version, path) =>
  picks.some((k) => k.datasetId === datasetId && k.version === version && k.path === path) ||
  inChosenFolder(picks, datasetId, version, path);

// The picks with pick added (on) or taken out. A folder added takes in the
// picks inside it.
export const togglePick = (picks, pick, on) => {
  let next = picks.filter((p) => keyOf(p) !== keyOf(pick));
  if (on) {
    if (pick.isFolder) next = next.filter((p) => !(sameVersion(p, pick) && p.path.startsWith(`${pick.path}/`)));
    next.push(pick);
  }
  return next;
};

// The picks by dataset version, in the order first picked.
export const groupPicks = (picks) => {
  const by = new Map();
  for (const p of picks) {
    const k = `${p.datasetId}:${p.version}`;
    if (!by.has(k)) by.set(k, { key: k, name: p.datasetName, version: p.version, picks: [] });
    by.get(k).picks.push(p);
  }
  return [...by.values()];
};

// Identifies a set of picks, whatever their order: a view made for them can
// be used again while it's the same.
export const picksKey = (picks) => picks.map(keyOf).sort().join("\n");
