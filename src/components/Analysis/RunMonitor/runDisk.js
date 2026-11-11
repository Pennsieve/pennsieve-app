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

// What a disk costs an hour, for one step: "under 1¢", "about 3¢", "about $0.22".
export function diskHourCost(gib) {
  const cents = gib * DISK_GB_HOUR_USD * 100;
  if (cents < 1) return "under 1¢";
  if (cents < 100) return `about ${Math.round(cents)}¢`;
  return `about $${(cents / 100).toFixed(2)}`;
}

// The Disk field's hint: what the disk applies to, and what the chosen
// size costs.
export function runDiskHint(gib, stepCount) {
  const steps = stepCount === 1 ? "the step that runs on Fargate" : `each of the ${stepCount} steps that run on Fargate`;
  const base =
    `At least this much disk for ${steps}: the compute node plans a step's disk from its inputs and raises it to this. ` +
    "Over 200 GB a step gets a volume of its own. Steps on Lambda or a GPU and notebooks keep their own disk.";
  return gib ? `${base} ${diskHourCost(gib)} an hour per step while it runs.` : base;
}

// The run's disk of a run being run again: the disk all of its batch steps
// asked for, when they asked for the same; "" when they differ or none
// did (each step then keeps its own).
export function runDiskOf(configs, stepIds) {
  const values = stepIds.map((id) => (configs || []).find((c) => c.nodeId === id)?.diskGiB || 0);
  if (!values.length || values.some((v) => !v || v !== values[0])) return "";
  return values[0];
}
