// What the notebook code takes from the site that hosts it. The notebook
// components, the session and their helpers read the site's settings
// through here, never from the app's Vuex store, site config or token
// helpers, so they can move to @pennsieve/notebooks as they are.
//
// The site configures it once at start (configureNotebooks):
//   endpoints   Pennsieve's URLs: api2Url, apiUrl, viewsServiceUrl,
//               environmentsServiceUrl, ...
//   getToken    the signed-in user's Cognito access token
//   getTokens   { accessToken, refreshToken }, for starting a run
//   backend     the calls that depend on whose notebooks they are (a
//               workspace's or the user's own): see pennsieveBackend.js
//   user()      the signed-in user ({ id, intId, ... }), when known
//   members()   the workspace's members, to name who started a notebook
//   pennsieveAppUrl  the Pennsieve app, for links out (compute nodes)
//   locations   vue-router locations of the site's pages: run(runId), where
//               ending a session leads

let host = null;

export function configureNotebooks(options) {
  host = options;
}

function current() {
  if (!host) throw new Error("notebooks: configureNotebooks() was not called");
  return host;
}

export const notebookEndpoints = () => current().endpoints;
export const notebookToken = () => current().getToken();
export const notebookTokens = () => current().getTokens();
export const notebookBackend = () => current().backend;
export const notebookUser = () => current().user?.() ?? null;
export const notebookMembers = () => current().members?.() ?? [];
export const pennsieveAppUrl = () => current().pennsieveAppUrl || "";
export const notebookLocations = () => current().locations;
