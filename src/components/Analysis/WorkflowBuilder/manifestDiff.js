// What changes between two versions of an app, from their app.yml
// manifests (appManifestInfo versionManifest): parameters, inputs and
// outputs, and resources. Pure; null when either has no manifest.

const byName = (list) => new Map((list || []).filter((x) => x?.name).map((x) => [x.name, x]));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diffNamed(from, to, compare) {
  const a = byName(from);
  const b = byName(to);
  return {
    added: [...b.keys()].filter((k) => !a.has(k)),
    removed: [...a.keys()].filter((k) => !b.has(k)),
    changed: [...b.keys()].filter((k) => a.has(k) && !compare(a.get(k), b.get(k))),
  };
}

const sameParam = (a, b) =>
  a.type === b.type && same(a.defaultValue, b.defaultValue) && same(a.validValues || [], b.validValues || []);
const samePort = (a, b) => same([...(a.mediaTypes || [])].sort(), [...(b.mediaTypes || [])].sort());

export function manifestDiff(from, to) {
  if (!from || !to) return null;
  const runtime = ["cpu", "memory", "computeTypes", "timeoutSeconds"].filter(
    (k) => !same(from.runtime?.[k], to.runtime?.[k])
  );
  const d = {
    parameters: diffNamed(from.parameters, to.parameters, sameParam),
    inputs: diffNamed(from.inputs, to.inputs, samePort),
    outputs: diffNamed(from.outputs, to.outputs, samePort),
    runtime,
  };
  d.empty =
    !runtime.length &&
    ["parameters", "inputs", "outputs"].every((k) => !d[k].added.length && !d[k].removed.length && !d[k].changed.length);
  return d;
}

// The diff as short lines: "Parameter added: threshold", ...
export function diffLines(d) {
  if (!d) return [];
  const lines = [];
  const label = { parameters: "Parameter", inputs: "Input", outputs: "Output" };
  for (const k of ["parameters", "inputs", "outputs"]) {
    if (d[k].added.length) lines.push(`${label[k]}${d[k].added.length > 1 ? "s" : ""} added: ${d[k].added.join(", ")}`);
    if (d[k].removed.length) lines.push(`${label[k]}${d[k].removed.length > 1 ? "s" : ""} removed: ${d[k].removed.join(", ")}`);
    if (d[k].changed.length) lines.push(`${label[k]}${d[k].changed.length > 1 ? "s" : ""} changed: ${d[k].changed.join(", ")}`);
  }
  if (d.runtime.length) {
    const names = { cpu: "CPU", memory: "memory", computeTypes: "compute types", timeoutSeconds: "timeout" };
    lines.push(`Resources changed: ${d.runtime.map((k) => names[k]).join(", ")}`);
  }
  return lines;
}

// What switching versions would break in this workflow: parameters it sets
// that the new version drops, and ports that changed (connections to check).
export function versionWarnings(d, setParams = {}) {
  if (!d) return [];
  const w = [];
  const dropped = d.parameters.removed.filter((p) => setParams[p] != null && setParams[p] !== "");
  if (dropped.length) w.push(`This workflow sets ${dropped.map((p) => `"${p}"`).join(", ")}, which the new version doesn't have`);
  if (d.inputs.removed.length || d.inputs.changed.length || d.outputs.removed.length || d.outputs.changed.length) {
    w.push("Its inputs or outputs changed: check the connections");
  }
  return w;
}
