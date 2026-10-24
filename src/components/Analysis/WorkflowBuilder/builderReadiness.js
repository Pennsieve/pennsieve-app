// Whether a workflow in the builder can be saved, and what to fix: pure, from
// the builder's nodes and edges (Vue Flow shape: node.type "data-source",
// "data-target" or "default" for an app; edge.source/target).
//
// Blocking items stop Save; warnings don't (an incompatible connection may be
// fine, and a required parameter can be given when the workflow is run).
// Each item names the node it's about, so clicking it selects the node.

export function builderReadiness({ name = "", nodes = [], edges = [], edgeIssues = [] } = {}) {
  const items = [];
  const label = (n) => n?.data?.label || "A step";

  if (!name.trim()) items.push({ id: "name", level: "block", text: "Give the workflow a name" });

  const sources = nodes.filter((n) => n.type === "data-source");
  const targets = nodes.filter((n) => n.type === "data-target");
  const apps = nodes.filter((n) => n.type === "default");
  if (!apps.length) items.push({ id: "apps", level: "block", text: "Add at least one app" });
  if (!sources.length) items.push({ id: "source", level: "block", text: "Add input data" });
  if (!targets.length) items.push({ id: "target", level: "block", text: "Add an output" });

  const hasIn = new Set(edges.map((e) => e.target));
  const hasOut = new Set(edges.map((e) => e.source));
  for (const n of nodes) {
    const needsIn = n.type !== "data-source";
    const needsOut = n.type !== "data-target";
    if ((needsIn && !hasIn.has(n.id)) || (needsOut && !hasOut.has(n.id))) {
      items.push({
        id: `unconnected:${n.id}`,
        level: "block",
        nodeId: n.id,
        text: `Connect ${label(n)}`,
      });
    }
  }
  for (const t of targets) {
    if (!t.data?.targetType) {
      items.push({ id: `target-type:${t.id}`, level: "block", nodeId: t.id, text: "Choose what the output is" });
    }
  }

  for (const issue of edgeIssues) {
    items.push({
      id: `edge:${issue.id}`,
      level: "warn",
      edgeId: issue.id,
      nodeId: issue.targetId,
      text: `${issue.source} → ${issue.target}: the types don't match`,
    });
  }

  for (const n of apps) {
    for (const p of requiredUnset(n)) {
      items.push({
        id: `param:${n.id}:${p}`,
        level: "warn",
        nodeId: n.id,
        text: `${label(n)}: "${p}" has no value (it can be given when the workflow runs)`,
      });
    }
  }

  const blocking = items.filter((i) => i.level === "block");
  return { ready: blocking.length === 0, blocking, warnings: items.filter((i) => i.level === "warn"), items };
}

// An app step's parameters with no default and no value set: app.yml's
// required ones (or, as workflow-service reads it, ones without a default).
export function requiredUnset(node) {
  const schema = node?.data?.paramSchema || [];
  const set = node?.data?.defaultParams || {};
  return schema
    .filter((p) => (p.required === true || (p.required == null && !p.defaultValue)) && !p.defaultValue)
    .map((p) => p.name)
    .filter((name) => name && (set[name] == null || set[name] === ""));
}

// "Ready to save", "1 thing to fix", "3 things to fix".
export function readinessLabel(r) {
  const n = r.blocking.length;
  if (!n) return r.warnings.length ? `Ready · ${r.warnings.length} to check` : "Ready to save";
  return `${n} ${n === 1 ? "thing" : "things"} to fix`;
}
