// Where the Gallery's old links go now that it's gone: its Workflows view
// (the default) is the Workflows tab's Library, its Apps view the Apps tab.
// `prefix` is "my-" in My Workspace, where route names carry it.
export const galleryRedirect = (prefix = "") => (to) => {
  const { view, ...query } = to.query;
  return view === "apps"
    ? { name: `${prefix}apps`, params: to.params, query }
    : { name: `${prefix}workflows`, params: to.params, query: { ...query, view: "library" } };
};
