// Where an input's files land in a step's input folder: the data source's
// filePaths (workflow-service). "selection" puts each selected file at the
// top, and a selected folder with what's in it; "source" keeps the paths the
// files have where they come from. Selection is the default: a request that
// leaves filePaths out gets it.

export const FILE_PATHS_SELECTION = "selection";
export const FILE_PATHS_SOURCE = "source";

// An input's choice, from a run's data source (absent means selection).
export const filePathsOf = (dataSource) =>
  dataSource?.filePaths === FILE_PATHS_SOURCE ? FILE_PATHS_SOURCE : FILE_PATHS_SELECTION;

// The fields a data source in the run request gets for the choice: none for
// the default.
export const filePathsField = (choice) => (choice === FILE_PATHS_SOURCE ? { filePaths: FILE_PATHS_SOURCE } : {});

// The names more than one selected item has (files are { content: { id,
// name } }): as selected they'd land on the same path, and the run would stop
// before it starts. Items inside selected folders aren't known here.
export const sharedNames = (files) => {
  const ids = new Map();
  for (const f of files || []) {
    const name = f?.content?.name;
    if (!name) continue;
    if (!ids.has(name)) ids.set(name, new Set());
    ids.get(name).add(f.content.id);
  }
  return [...ids].filter(([, s]) => s.size > 1).map(([name]) => name);
};

// The rows of a picture of the input folder a choice gives: { depth, folder,
// label, item }, the folder first, item marking the chosen ones. items are the input's chosen files and folders,
// { name, folder, path }, path being the folders it's in at the source (null
// when not known). At most max rows: past that, a last row ({ more }) says
// how many items aren't shown.
export const placementRows = (choice, items, max = 5) => {
  const rows = [{ depth: 0, folder: true, label: "input" }];
  if (choice === FILE_PATHS_SOURCE) {
    // The items' folders as a tree, in the order first chosen.
    const root = { children: new Map() };
    for (const it of items) {
      let at = root;
      for (const seg of it.path ?? ["…"]) {
        if (!at.children.has(`d:${seg}`)) at.children.set(`d:${seg}`, { label: seg, folder: true, children: new Map() });
        at = at.children.get(`d:${seg}`);
      }
      const key = `${it.folder ? "d" : "f"}:${it.name}`;
      if (!at.children.has(key)) at.children.set(key, { label: it.name, folder: !!it.folder, children: new Map() });
      at.children.get(key).item = true;
    }
    const walk = (node, depth) => {
      for (const c of node.children.values()) {
        rows.push({ depth, folder: c.folder, label: c.label, item: !!c.item });
        walk(c, depth + 1);
      }
    };
    walk(root, 1);
  } else {
    for (const it of items) rows.push({ depth: 1, folder: !!it.folder, label: it.name, item: true });
  }
  if (rows.length <= max) return rows;
  const shown = rows.slice(0, max - 1);
  const hidden = rows.slice(max - 1).filter((r) => r.item).length;
  return [...shown, { depth: 1, more: true, label: `+${hidden} more` }];
};
