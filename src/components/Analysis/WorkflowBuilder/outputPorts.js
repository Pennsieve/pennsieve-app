// Output ports: an app with two or more declared outputs writes each to its
// own folder, OUTPUT_DIR/<name>/ (app.yml), and the canvas gives each output
// its own connection point. A link from an output port to a data target
// routes that output only: the target's PATH_PREFIX is the output's folder,
// the path prefix data targets already support. With one output (or none
// declared) the step keeps its single connection point and writes the whole
// of OUTPUT_DIR, as before.
//
// Pure: on Vue Flow nodes and edges and app.yml ports.

const HANDLE_PREFIX = "out:";

// The outputs a step can route one by one: two or more declared outputs.
export function routedOutputs(manifestPorts) {
  const outputs = (manifestPorts?.outputs || []).filter((p) => p?.name);
  return outputs.length >= 2 ? outputs : [];
}

export const portHandleId = (name) => `${HANDLE_PREFIX}${name}`;

// The output a link leaves from, or "" for the step's single connection point.
export const portOfHandle = (handle) =>
  typeof handle === "string" && handle.startsWith(HANDLE_PREFIX) ? handle.slice(HANDLE_PREFIX.length) : "";

// Whether a link may leave from this handle to tgt: an output port connects
// to a data target only. Links between apps by port come with input ports;
// until then a step's outputs reach the next app through its single point.
export function canConnectFromHandle(src, tgt, handle) {
  if (!portOfHandle(handle)) return true;
  if (tgt?.type !== "data-target") return false;
  return routedOutputs(src?.data?.manifestPorts).some((p) => p.name === portOfHandle(handle));
}

// The parameter a target type takes its path prefix in: container targets
// read PATH_PREFIX, built-in ones (download, persistent layer) pathPrefix,
// and the provisioner refuses the other spelling. "" when the type has
// neither, so it can't take a routed output.
export const PREFIX_PARAMS = ["PATH_PREFIX", "pathPrefix"];
export function prefixParamOf(targetParams) {
  const names = (targetParams || []).map((p) => p?.name);
  return PREFIX_PARAMS.find((n) => names.includes(n)) || "";
}

// A data target fed from an output port takes only that output: its prefix
// parameter is set to the output's folder. Returns the new defaultParams.
export function withPortPrefix(defaultParams, port, key = "PATH_PREFIX") {
  const params = { ...(defaultParams || {}) };
  if (port && key) params[key] = port;
  return params;
}

// Removing a port's link clears the prefix it set, and only that one: a
// prefix the author typed for another folder stays.
export function withoutPortPrefix(defaultParams, port) {
  const params = { ...(defaultParams || {}) };
  for (const key of PREFIX_PARAMS) if (port && params[key] === port) delete params[key];
  return params;
}

// On load, the port a saved link left from: the source's output whose name
// is the target's PATH_PREFIX. The definition stores the prefix, not the
// port, so this is how a reopened workflow draws its links from the ports.
export function portForLoadedLink(source, target) {
  if (target?.type !== "data-target") return "";
  const params = target?.data?.defaultParams || {};
  const prefix = String(params.PATH_PREFIX || params.pathPrefix || "").replace(/^\/+|\/+$/g, "");
  if (!prefix) return "";
  return routedOutputs(source?.data?.manifestPorts).some((p) => p.name === prefix) ? prefix : "";
}

// Edges with the source handle their ports call for, once manifests are in:
// a link into a data target whose prefix names one of the source's outputs
// leaves from that output's port. Unchanged edges are returned as they were.
export function attachPorts(edges, nodes) {
  const byId = new Map((nodes || []).map((n) => [n.id, n]));
  return (edges || []).map((e) => {
    if (e.sourceHandle && portOfHandle(e.sourceHandle)) return e;
    const port = portForLoadedLink(byId.get(e.source), byId.get(e.target));
    return port ? { ...e, sourceHandle: portHandleId(port) } : e;
  });
}
