// What an app's usage across runs says on its page (useAppUsage): the
// rows of the versions table and the sizing hint, from workflow-service's
// per-version aggregates (median, 95th percentile and max of each step's
// peak, against what the steps were given).

const MiB = (v) => `${Math.round(v).toLocaleString()} MiB`;
const vcpu = (units) => {
  const v = units / 1024;
  return `${v.toFixed(v < 1 ? 2 : v < 10 ? 1 : 0)} vCPU`;
};
const seconds = (s) => {
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
  return `${(s / 3600).toFixed(1)}h`;
};

// spread is "p50 · p95" of a distribution, or "" without samples.
const spread = (d, fmt) => (d && d.samples ? `${fmt(d.p50)} · ${fmt(d.p95)}` : "");

// usageRows are the versions table's rows.
export const usageRows = (usage) =>
  (usage?.versions || []).map((v) => ({
    version: v.version || "unpinned",
    runs: v.runs,
    steps: v.steps,
    failed: v.failed,
    memoryGiven: v.memoryGivenMiB ? MiB(v.memoryGivenMiB) : "",
    memoryUsed: spread(v.memoryUsedMiB, MiB),
    memorySamples: v.memoryUsedMiB?.samples || 0,
    cpuGiven: v.cpuGivenUnits ? vcpu(v.cpuGivenUnits) : "",
    cpuUsed: spread(v.cpuUsedUnits, vcpu),
    duration: spread(v.durationSec, seconds),
    lastRunAt: v.lastRunAt || "",
  }));

// The sizes a Fargate task can be given, to suggest one.
const FARGATE_MEMORY_MIB = [512, 1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192, 9216, 10240, 11264, 12288, 13312, 14336, 15360, 16384, 20480, 24576, 28672, 30720];

// sizingHint says, for a version with enough samples, whether its memory
// is generous or tight: the 95th percentile of its peaks against what it
// is given. Fewer than three samples say nothing; so does a fit.
export const sizingHint = (v) => {
  const d = v?.memoryUsedMiB;
  if (!d || d.samples < 3 || !v.memoryGivenMiB) return "";
  const share = d.p95 / v.memoryGivenMiB;
  const label = v.version || "unpinned";
  if (share < 0.5) {
    const target = FARGATE_MEMORY_MIB.find((m) => m >= d.p95 * 1.3) || Math.ceil((d.p95 * 1.3) / 1024) * 1024;
    // Nothing smaller to suggest (a Lambda step at its floor): no hint.
    if (target >= v.memoryGivenMiB) return "";
    return `${label} is given ${MiB(v.memoryGivenMiB)} and 95% of its ${d.samples} steps peaked under ${MiB(d.p95)}: ${MiB(target)} would do.`;
  }
  if (share > 0.9) {
    return `${label} runs close to its memory: 95% of its ${d.samples} steps peaked at ${MiB(d.p95)} of ${MiB(v.memoryGivenMiB)}. Give it more.`;
  }
  return "";
};

// usageSummary is the panel's one-line lead.
export const usageSummary = (usage) => {
  if (!usage?.runs) return "";
  const steps = usage.steps !== usage.runs ? ` (${usage.steps} steps)` : "";
  return `Across ${usage.runs} run${usage.runs === 1 ? "" : "s"}${steps}: what this app was given and what it used, the median and the 95th percentile of each step's peak. Usage depends on the inputs.`;
};

// usageSidebar is the side panel's two lines, for the version run last:
// the median and 95th percentile of the steps' peak memory and cpu, with
// the runs they rest on, plus the sizing hint when there is one. Null
// without a sampled step.
export const usageSidebar = (usage) => {
  const v = usage?.versions?.[0];
  if (!v) return null;
  const mem = v.memoryUsedMiB;
  const cpu = v.cpuUsedUnits;
  if (!mem?.samples && !cpu?.samples) return null;
  const runs = `${v.runs} run${v.runs === 1 ? "" : "s"}`;
  const version = v.version ? ` of ${v.version}` : "";
  return {
    // The caption that sets these apart from the settings above them.
    caption: `Measured over ${runs}${version}`,
    memory: mem?.samples ? `${MiB(mem.p50)} · ${MiB(mem.p95)}` : "—",
    cpu: cpu?.samples ? `${vcpu(cpu.p50)} · ${vcpu(cpu.p95)}` : "",
    title: `Median · 95th percentile of each step's peak, over ${runs}${version}. Usage depends on the inputs.`,
    hint: sizingHint(v),
  };
};
