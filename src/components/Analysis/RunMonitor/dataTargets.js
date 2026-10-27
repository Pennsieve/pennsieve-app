/*
  A run's data targets: which dataset each writes to and which part of its
  input it takes. A target writes to its own dataset (dataTargets[nodeId].
  datasetId) or, when it names none, to the run's; the built-in download and
  persistent-layer targets write no dataset. Every target can take only the
  files below a path prefix (PATH_PREFIX on a container target, pathPrefix on
  a built-in one), without it. See compute-node-aws-provisioner-v2's api
  contract §3.2.
*/

export const BUILTIN_TARGET_TYPES = ["download", "persistent-layer"];

// Whether a target of this type writes to a dataset (and so may name one).
export const targetWritesToDataset = (targetType) =>
  !!targetType && !BUILTIN_TARGET_TYPES.includes(targetType);

// Whether a dataset role (the API's dataset "role": viewer, editor, manager,
// owner) can take a target's files: workflow-service refuses a run whose
// creator is below Editor on any dataset its targets write to.
const WRITE_ROLES = ["editor", "manager", "owner"];
export const canWriteDataset = (role) => WRITE_ROLES.includes((role || "").toLowerCase());

// The name of the target type's path-prefix param.
export const prefixParamName = (targetType) =>
  BUILTIN_TARGET_TYPES.includes(targetType) ? "pathPrefix" : "PATH_PREFIX";

/*
  A target's params for the run-configure form, from the registry's param
  definitions. Values come from, in order, the run being rerun, the workflow
  definition's defaultParams on the node, and the registry default, which is
  the order workflow-service applies them.
*/
export const targetParamFields = (paramDefs, { sourceParams = {}, definitionDefaults = {} } = {}) =>
  (paramDefs || []).map((pd) => {
    const fromSource = sourceParams[pd.name];
    const fromDefinition = definitionDefaults[pd.name];
    const value =
      fromSource != null ? String(fromSource)
      : fromDefinition != null && fromDefinition !== "" ? String(fromDefinition)
      : pd.defaultValue != null ? String(pd.defaultValue)
      : "";
    return {
      name: pd.name,
      type: pd.type || "string",
      description: pd.description || "",
      required: pd.defaultValue == null || pd.defaultValue === undefined,
      value,
    };
  });

/*
  The run request's dataTargets, from the configure form: each target's
  non-empty params, and its dataset when it names one other than the run's
  (the run's is the default, so it isn't sent). A target with neither is
  left out.
*/
export const buildDataTargets = (dag, nodeConfigs, runDatasetId = "") => {
  const dataTargets = {};
  for (const d of dag || []) {
    if (d.type !== "data-target") continue;
    const cfg = nodeConfigs?.[d.id];
    if (!cfg) continue;
    const params = {};
    for (const p of cfg.params || []) {
      if (p.name && p.value) params[p.name] = p.value;
    }
    const entry = {};
    // A workflow output names the destination this run binds it to; with
    // none it takes nothing else.
    const targetType = d.output ? cfg.targetType || "" : d.targetType;
    if (d.output) {
      if (!targetType) continue;
      entry.targetType = targetType;
      if (targetType === "none") {
        dataTargets[d.id] = entry;
        continue;
      }
    }
    const datasetId = targetWritesToDataset(targetType) ? cfg.datasetId || "" : "";
    if (datasetId && datasetId !== runDatasetId) entry.datasetId = datasetId;
    if (Object.keys(params).length > 0) entry.params = params;
    if (Object.keys(entry).length > 0) dataTargets[d.id] = entry;
  }
  return dataTargets;
};

// What a run's target wrote to, for display: its own dataset or the run's.
export const targetDatasetId = (target, runDatasetId = "") => target?.datasetId || runDatasetId || "";

// A dataset's name from a list of dataset records, else its id.
export const datasetName = (datasetId, datasets = []) =>
  datasets.find((d) => d?.content?.id === datasetId)?.content?.name || datasetId;

// Search the workspace's datasets by name (the run wizard's search).
export const searchDatasets = async (apiUrl, query, { getToken, sendXhr, toQueryParams, limit = 25 }) => {
  const token = await getToken();
  const params = toQueryParams({
    limit, offset: 0, query, orderBy: "IntId", orderDirection: "Desc", type: "research", api_key: token,
  });
  const response = await sendXhr(`${apiUrl}/datasets/paginated?${params}&includeBannerUrl=true`);
  return sortDatasets(response?.datasets || response || []);
};

// How many files a dataset record says it has (its package counts).
const fileCount = (ds) => Object.values(ds?.packageTypeCounts || {}).reduce((n, c) => n + (Number(c) || 0), 0);

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
};

const formatUpdated = (iso, now = new Date()) => {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d)) return "";
  const opts = d.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" };
  return `updated ${d.toLocaleDateString("en-US", opts)}`;
};

// What a dataset picker shows for a dataset record (GET /datasets/paginated):
// its name, description and banner, and a line of facts that tell datasets
// apart. empty is a dataset with no files.
export const datasetSummary = (ds, now = new Date()) => {
  const files = fileCount(ds);
  const role = ds?.role ? ds.role.charAt(0).toUpperCase() + ds.role.slice(1) : "";
  const meta = [
    files ? `${files.toLocaleString("en-US")} file${files === 1 ? "" : "s"}` : "No files",
    files ? formatBytes(ds?.storage) : "",
    formatUpdated(ds?.content?.updatedAt, now),
    role,
  ].filter(Boolean).join(" · ");
  return {
    id: ds?.content?.id || "",
    name: ds?.content?.name || "",
    description: (ds?.content?.description || "").trim(),
    banner: ds?.bannerPresignedUrl || "",
    meta,
    empty: files === 0,
  };
};

// Datasets with files first, keeping the search's order otherwise.
export const sortDatasets = (datasets) =>
  [...(datasets || [])].sort((a, b) => (fileCount(a) === 0) - (fileCount(b) === 0));

// The notebook launcher's view of a target's params. A path prefix splits a
// run's input between targets; a notebook hands over its whole output folder,
// so the launcher leaves it out (empty: everything).
export const isPathPrefixParam = (name) => /^(pathPrefix|PATH_PREFIX)$/.test(name || "");

// What the launcher calls a download target's params.
const PARAM_LABELS = { name: "Archive name" };
export const targetParamLabel = (name) => PARAM_LABELS[name] || name;

// A download's archive is named after the notebook unless the user names it,
// so the step can be clicked through.
export const defaultsToRunName = (targetType, paramName) => targetType === "download" && paramName === "name";

// A target's params as its card on a run's graph lists them: without those
// the canvas already shows (the path prefix, when a line leaves the output
// it names) and those left at their default. params: [{ key, value }];
// paramDefs: the target type's ({ name, defaultValue }).
export const shownTargetParams = (params, paramDefs = [], prefixShown = false) => {
  const defaults = new Map((paramDefs || []).map((pd) => [pd.name, pd.defaultValue]));
  return (params || []).filter(({ key, value }) => {
    if (prefixShown && isPathPrefixParam(key)) return false;
    const d = defaults.get(key);
    return d == null || String(d) !== String(value);
  });
};
