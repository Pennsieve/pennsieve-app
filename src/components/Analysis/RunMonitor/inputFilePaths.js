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
