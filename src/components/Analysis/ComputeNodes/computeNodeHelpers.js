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

// What the node can do, one entry each, on or off.
export function nodeCapabilities(node, gpuTiers = []) {
  if (!node) return [];
  const gpus = node.maxGpuInstances || 0;
  const sessions = node.maxInteractiveSessions || 0;
  const tier = gpus > 0 ? gpuTiers.find((t) => t.tier === (node.gpuTier || "small")) : null;
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
      on: gpus > 0,
      detail:
        gpus > 0
          ? [tier ? `${tier.gpu}, ${tier.gpuMemoryGB} GB` : node.gpuTier || "small", `up to ${gpus}`].join(" · ")
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
