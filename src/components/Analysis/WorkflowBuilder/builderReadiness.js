// Whether a workflow in the builder can be saved, and what to fix: pure, from
// the builder's nodes and edges (Vue Flow shape: node.type "data-source",
// "data-target" or "default" for an app; edge.source/target).
//
// Blocking items stop Save; warnings don't (an incompatible connection may be
// fine, and a required parameter can be given when the workflow is run).
// Each item names the node it's about, so clicking it selects the node (and
// a link's, its link). nameOf names steps as the panel does (numbered when
// two share a name).

export function builderReadiness({ name = "", nodes = [], edges = [], edgeIssues = [], nameOf } = {}) {
  const items = [];
  const label = (n) => (nameOf && nameOf(n)) || n?.data?.label || "A step";

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
    // A step fed by several steps that still lacks a required input.
    if (issue.reason === "missing-required") {
      const types = (issue.mediaTypes || []).join(", ");
      items.push({
        id: issue.id,
        level: "warn",
        nodeId: issue.targetId,
        text: `${issue.target} needs ${types || "a required input"}, which none of the steps before it produce`,
      });
      continue;
    }
    // A link to a named input: which output and input, and what it needs;
    // the two steps underneath.
    const needs = issue.needs ? `needs ${issue.needs}` : "the types don't match";
    items.push({
      id: `edge:${issue.id}`,
      level: "warn",
      edgeId: issue.id,
      nodeId: issue.targetId,
      ...(issue.input
        ? { text: `${issue.output || "all outputs"} → ${issue.input}: ${needs}`, detail: `${issue.source} → ${issue.target}` }
        : { text: `${issue.source} → ${issue.target}: ${needs}` }),
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

// An app step's parameters with no default and no value set: required, by
// app.yml's convention that a parameter without a default is.
export function requiredUnset(node) {
  const schema = node?.data?.paramSchema || [];
  const set = node?.data?.defaultParams || {};
  return schema
    .filter((p) => p.defaultValue == null || p.defaultValue === "")
    .map((p) => p.name)
    .filter((name) => name && (set[name] == null || set[name] === ""));
}

// "Ready to save", "1 thing to fix", "3 things to fix".
export function readinessLabel(r) {
  const n = r.blocking.length;
  if (!n) return r.warnings.length ? `Ready · ${r.warnings.length} to check` : "Ready to save";
  return `${n} ${n === 1 ? "thing" : "things"} to fix`;
}
