// Names for a workflow's steps that tell them apart: a step's own name
// (baseName), numbered top to bottom when others share it ("Test Ports
// Processor (1)", "(2)"). Pure: nodes in display order.

export function stepNames(nodes, baseName) {
  const base = new Map((nodes || []).map((n) => [n.id, baseName(n) || "Step"]));
  const total = new Map();
  for (const name of base.values()) total.set(name, (total.get(name) || 0) + 1);
  const seen = new Map();
  const names = new Map();
  for (const n of nodes || []) {
    const name = base.get(n.id);
    if (total.get(name) > 1) {
      const k = (seen.get(name) || 0) + 1;
      seen.set(name, k);
      names.set(n.id, `${name} (${k})`);
    } else {
      names.set(n.id, name);
    }
  }
  return names;
}
