// What a compute node's page says about it, in plain words: its status, where
// it runs, its deployment mode, what it can do, and which tab a link lands on.

// The page's tabs, in order; the tab is in the URL (?tab=).
export const NODE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "access", label: "Access" },
  { key: "settings", label: "Settings" },
  { key: "reference-data", label: "Reference data" },
  { key: "advanced", label: "Advanced" },
];

// Older links point at a section (#quotas from the chat panel); each section
// now lives on a tab.
const HASH_TABS = {
  "#llm-budget": "settings",
  "#quotas": "settings",
  "#pipeline-budget": "settings",
  "#reference-data": "reference-data",
};

// The tab to show: the one in the URL, else the one a section link is on,
// else Overview.
export function nodeTab(query = {}, hash = "") {
  const asked = query?.tab;
  if (NODE_TABS.some((t) => t.key === asked)) return asked;
  return HASH_TABS[hash] || "overview";
}

// A node's status as the page shows it.
export function nodeStatus(node) {
  switch ((node?.status || "").toLowerCase()) {
    case "enabled":
    case "active":
    case "running":
    case "ready":
      return "Enabled";
    case "paused":
    case "stopped":
    case "disabled":
      return "Paused";
    case "destroying":
      return "Destroying";
    case "failed":
      return "Failed";
    case "updating":
      return "Updating";
    default:
      return "Pending";
  }
}

// Whether the owner can pause or resume it now (not while it's being set up
// or taken down).
export const canToggleStatus = (node) => ["Enabled", "Paused"].includes(nodeStatus(node));

export function cloudLabel(type) {
  switch (type) {
    case "AWS": return "AWS";
    case "GCP": return "Google Cloud";
    case "AZURE": return "Azure";
    default: return type || "Cloud";
  }
}

export function formatAccountId(accountId) {
  if (!accountId) return "";
  if (accountId.length === 12) {
    return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`;
  }
  return accountId;
}

const MODES = {
  basic: {
    label: "Basic",
    summary: "For development and testing: apps reach the internet directly.",
    details:
      "A cost-effective setup for development, testing and proofs of concept. Apps have direct internet access and use standard encryption.",
  },
  secure: {
    label: "Secure",
    summary: "For production: an isolated network with controlled internet access.",
    details:
      "Apps run in an isolated network with controlled internet access. All data is encrypted with dedicated keys, and network activity is logged for auditing.",
  },
  compliant: {
    label: "Compliant",
    summary: "For regulated data: no internet access, private network only.",
    details:
      "Designed for regulated environments such as healthcare and government. Apps have no internet access; all traffic stays within the cloud provider's private network. Includes dedicated encryption keys and full network audit logging, suitable for HIPAA and NIST 800-171.",
  },
};

export const deploymentMode = (node) =>
  MODES[(node?.deploymentMode || "basic").toLowerCase()] || MODES.basic;

/*
  A node's GPU, as the wizard, the run page and the session header describe
  it. A node has GPUs when maxGpuInstances > 0; its gpuTier names one of the
  GPU tiers (GET /compute/resources/gpu-tiers: [{ tier, instanceType, gpu,
  gpuMemoryGB, vcpus, memoryGB, pricePerHour, taskCpu?, taskMemoryMiB? }]).
  A GPU task gets the tier's whole instance less the ECS agent's headroom:
  taskCpu (CPU units) and taskMemoryMiB where the tiers list them; else
  derived from vcpus and memoryGB (15/16 of the memory, as the provisioner
  sets it), only for display and marked approximate.
*/
// { tier, model, vramGB, instanceType, vcpu, memoryGB, approx,
// maxInstances }, or null for a node without GPUs. Before the tiers load
// (or for an unknown tier), model is "" and vcpu/memoryGB 0.
export function nodeGpu(node, gpuTiers = []) {
  const maxInstances = node?.maxGpuInstances || 0;
  if (!(maxInstances > 0)) return null;
  const tier = node.gpuTier || "small";
  const t = (gpuTiers || []).find((x) => x?.tier === tier);
  if (!t) return { tier, model: "", vramGB: 0, instanceType: "", vcpu: 0, memoryGB: 0, approx: false, maxInstances };
  const exact = (t.taskCpu || 0) > 0 && (t.taskMemoryMiB || 0) > 0;
  return {
    tier,
    model: t.gpu || "",
    vramGB: t.gpuMemoryGB || 0,
    instanceType: t.instanceType || "",
    vcpu: exact ? t.taskCpu / 1024 : t.vcpus || 0,
    memoryGB: exact ? t.taskMemoryMiB / 1024 : Math.floor(((t.memoryGB || 0) * 15) / 16),
    approx: !exact,
    maxInstances,
  };
}

// The GPU and its memory ("NVIDIA L4 · 24 GB"), else the tier ("medium
// tier"); "" for none.
export const gpuName = (g) => (!g ? "" : g.model ? [g.model, g.vramGB ? `${g.vramGB} GB` : ""].filter(Boolean).join(" · ") : `${g.tier} tier`);

// What a node offers, in a line: "GPU: NVIDIA L4 · 24 GB · up to 2
// instances", or "CPU only".
export const gpuOffer = (g) =>
  g ? `GPU: ${gpuName(g)} · up to ${g.maxInstances} instance${g.maxInstances === 1 ? "" : "s"}` : "CPU only";

const num = (n) => String(+Number(n).toFixed(1));
// What a GPU task gets ("8 vCPU / 30 GB"; "≈ 8 vCPU / 30 GB" when derived),
// "" when unknown. sep goes between CPU and memory.
export const gpuTaskResources = (g, sep = " / ") =>
  g && g.vcpu > 0 && g.memoryGB > 0 ? `${g.approx ? "≈ " : ""}${num(g.vcpu)} vCPU${sep}${num(g.memoryGB)} GB` : "";

// What the node can do, one entry each, on or off.
export function nodeCapabilities(node, gpuTiers = []) {
  if (!node) return [];
  const gpu = nodeGpu(node, gpuTiers);
  const sessions = node.maxInteractiveSessions || 0;
  return [
    {
      key: "notebooks",
      label: "Notebooks",
      on: sessions > 0,
      detail: sessions > 0 ? `Up to ${sessions} at a time` : "Not enabled",
    },
    {
      key: "gpu",
      label: "GPUs",
      on: !!gpu,
      detail: gpu
        ? [gpu.model ? `${gpu.model}, ${gpu.vramGB} GB` : gpu.tier, `up to ${gpu.maxInstances}`].join(" · ")
        : "Not enabled",
    },
    {
      key: "ai",
      label: "AI models",
      on: !!node.enableLLMAccess,
      detail: node.enableLLMAccess ? "Apps and chat can use them" : "Not enabled",
    },
  ];
}

// The node's latest runs, newest first.
export function recentNodeRuns(runs = [], nodeId, limit = 5) {
  return runs
    .filter((r) => r?.computeNodeUuid === nodeId)
    .sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
    .slice(0, limit);
}

export function relativeTime(dateString, now = Date.now()) {
  if (!dateString) return "";
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.round((now - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(then).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// A budget row's limits in one line ("$5.00 a day · 3 runs at once"), from
// the axes it sets; "" when it sets none.
const LIMIT_PHRASES = {
  dailyCostUsd: (v) => `${usd(v)} a day`,
  monthlyCostUsd: (v) => `${usd(v)} a month`,
  perRunCostUsd: (v) => `${usd(v)} per run`,
  perWorkflowUsd: (v) => `${usd(v)} per workflow`,
  maxConcurrentRuns: (v) => `${v} ${Number(v) === 1 ? "run" : "runs"} at once`,
};
const usd = (v) => `$${Number(v).toFixed(2)}`;
export function limitSummary(row, keys = Object.keys(LIMIT_PHRASES)) {
  if (!row) return "";
  return keys
    .filter((k) => row[k] !== null && row[k] !== undefined && LIMIT_PHRASES[k])
    .map((k) => LIMIT_PHRASES[k](row[k]))
    .join(" · ");
}
