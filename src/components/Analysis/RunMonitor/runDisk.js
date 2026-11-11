// The disk a run asks for its batch steps (POST /runs
// workflowInstanceConfiguration.diskGiB): a floor, in GB, on the disk the
// compute node plans for every step that runs on Fargate as a batch step.
// The node plans a step's disk from its inputs (and what it writes, taken
// as twice that) and raises it to this; over 200 GB a step gets a volume
// of its own. A step on Lambda (10 GB of /tmp), on a GPU (its instance's
// disk), a notebook (its own choice in the New notebook dialog), an input
// and an output keep their disk. A step may ask for its own instead
// (processorConfigs[].diskGiB, runHelpers.processorConfigEntry).
export const RUN_DISK_OPTIONS = [50, 100, 200, 300, 500, 1000, 2000];

// Fargate task storage above 20 GB and a gp3 volume, per GB-hour (us-east-1).
const DISK_GB_HOUR_USD = 0.000111;

// Whether the run's disk applies to a step: a processor on Fargate that
// isn't an interactive session. node is the step's definition; cfg its
// run config (nodeConfigs), whose target and interactive switch win.
export function takesRunDisk(node, cfg = {}) {
  if (!node || node.type !== "processor") return false;
  const target = cfg.executionTarget || node.computeType || "standard";
  return target === "standard" && !cfg.interactive && !node.runtimeConfig?.interactive;
}

// The steps of a run the run's disk applies to.
export const diskStepIds = (dag, nodeConfigs = {}) =>
  (dag || []).filter((d) => takesRunDisk(d, nodeConfigs[d.id])).map((d) => d.id);

// How many of a run's steps keep their own disk, by why: on Lambda, on a
// GPU, or a notebook (as configured).
export function keptDiskSteps(dag, nodeConfigs = {}) {
  const kept = { lambda: 0, gpu: 0, notebook: 0 };
  (dag || []).forEach((d) => {
    if (d.type !== "processor" || takesRunDisk(d, nodeConfigs[d.id])) return;
    const cfg = nodeConfigs[d.id] || {};
    const target = cfg.executionTarget || d.computeType || "standard";
    if (cfg.interactive || d.runtimeConfig?.interactive) kept.notebook += 1;
    else if (target === "lambda") kept.lambda += 1;
    else if (target === "gpu") kept.gpu += 1;
  });
  return kept;
}

// What a disk costs an hour, for one step: "under 1¢", "about 3¢", "about $0.22".
export function diskHourCost(gib) {
  const cents = gib * DISK_GB_HOUR_USD * 100;
  if (cents < 1) return "under 1¢";
  if (cents < 100) return `about ${Math.round(cents)}¢`;
  return `about $${(cents / 100).toFixed(2)}`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The Disk field's hint: what the disk applies to, and what the chosen
// size costs.
export function runDiskHint(gib, stepCount) {
  const steps = stepCount === 1 ? "the step that runs on Fargate" : `each of the ${stepCount} steps that run on Fargate`;
  const base =
    `A floor for ${steps}. The compute node plans a step's disk from its inputs, about three times their size, ` +
    "and raises it to this when the plan is smaller; a step with large inputs already gets more than a small size here. " +
    "Over 200 GB a step gets a volume of its own.";
  return gib ? `${base} ${diskHourCost(gib)} an hour per step while it runs.` : base;
}

// The note under the hint on the run's Lambda steps, which the disk can't
// reach; "" without any. Shown as a warning once a disk is chosen.
export function lambdaDiskNote(count) {
  if (!count) return "";
  return `${plural(count, "step")} on Lambda ${count === 1 ? "keeps" : "keep"} Lambda's 10 GB whatever is chosen here: to give ${count === 1 ? "it" : "one"} more, run it on Fargate in its step settings.`;
}

// The note on the run's GPU steps and notebooks, which have their own
// disk; "" without any.
export function keptDiskNote(kept = {}) {
  const parts = [];
  if (kept.gpu) parts.push(`${plural(kept.gpu, "GPU step")} ${kept.gpu === 1 ? "uses its" : "use their"} instance's disk.`);
  if (kept.notebook) parts.push(`${plural(kept.notebook, "notebook")} ${kept.notebook === 1 ? "has" : "have"} the disk chosen when it starts.`);
  return parts.join(" ");
}

// The run's disk of a run being run again: the disk all of its batch steps
// asked for, when they asked for the same; "" when they differ or none
// did (each step then keeps its own).
export function runDiskOf(configs, stepIds) {
  const values = stepIds.map((id) => (configs || []).find((c) => c.nodeId === id)?.diskGiB || 0);
  if (!values.length || values.some((v) => !v || v !== values[0])) return "";
  return values[0];
}
