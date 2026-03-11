/**
 * Shared pure utility functions for RunsOverview and RunDetail.
 */

export const runStatusOptions = [
  { label: "All Statuses", value: "all" },
  { label: "Not Started", value: "NOT_STARTED" },
  { label: "Started", value: "STARTED" },
  { label: "Finalizing", value: "FINALIZING" },
  { label: "Succeeded", value: "SUCCEEDED" },
  { label: "Failed", value: "FAILED" },
  { label: "Canceling", value: "CANCELING" },
  { label: "Canceled", value: "CANCELED" },
];

// Status helpers
export const statusClass = (status) => {
  switch (status) {
    case "NOT_STARTED": return "gray-node";
    case "STARTED": return "blue-node animate";
    case "SUCCEEDED": return "green-node";
    case "FAILED": return "red-node";
    default: return "gray-node";
  }
};

export const statusBorderColor = (status) => {
  switch (status) {
    case "NOT_STARTED": return "#999999";
    case "STARTED": return "#06b6d4";
    case "SUCCEEDED": return "#17BB62";
    case "FAILED": return "#E94B4B";
    default: return "#999999";
  }
};

export const nodeBorderColor = (type, status) => {
  if (status) return statusBorderColor(status);
  if (type === "data-source") return "#6366f1";
  if (type === "data-target") return "#64748b";
  return "#cccccc";
};

export const statusDotClass = (status) => {
  switch (status) {
    case "NOT_STARTED": return "dot-gray";
    case "STARTED": return "dot-blue";
    case "FINALIZING": return "dot-amber";
    case "SUCCEEDED": return "dot-green";
    case "FAILED": return "dot-red";
    case "CANCELLED": return "dot-amber";
    default: return "dot-gray";
  }
};

export const statusLabel = (status) => {
  switch (status) {
    case "NOT_STARTED": return "Pending";
    case "STARTED": return "Running";
    case "FINALIZING": return "Finalizing";
    case "SUCCEEDED": return "Complete";
    case "FAILED": return "Failed";
    case "CANCELLED": return "Cancelled";
    default: return status || "Unknown";
  }
};

export const isTerminalStatus = (status) => {
  return ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
};

// Label helpers
export const extractRepoName = (gitUrl) => {
  if (!gitUrl) return "";
  const parts = gitUrl.split("/");
  const name = parts[parts.length - 1] || gitUrl;
  return name.replace(/\.git$/, "");
};

export const normalizeUrl = (url) => {
  if (!url) return "";
  return url.replace(/\.git$/, "").replace(/\/$/, "");
};

export const findAppByUrl = (sourceUrl, applications) => {
  if (!sourceUrl) return null;
  const normalized = normalizeUrl(sourceUrl);
  return (
    applications.find(
      (app) => normalizeUrl(app.source?.url) === normalized
    ) || null
  );
};

export const labelForDagNode = (d, applications) => {
  if (d.type === "data-source") return "Data Source";
  if (d.type === "data-target") return d.targetType || "Data Target";
  const matchedApp = findAppByUrl(d.sourceUrl, applications);
  return matchedApp ? matchedApp.name : extractRepoName(d.sourceUrl) || d.type || d.id;
};

// Time formatting
export const formatTime = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString();
};

export const formatDuration = (start, end) => {
  if (!start || !end) return "N/A";
  const ms = new Date(end) - new Date(start);
  if (isNaN(ms) || ms < 0) return "N/A";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
};

export const formatCost = (cost) => {
  if (cost == null) return "N/A";
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

export const formatModelName = (model) => {
  if (!model) return "N/A";
  return model.replace(/^(us|eu|ap)\./, "").replace(/^arn:.*\//, "");
};

export const formatBytes = (bytes) => {
  if (bytes == null) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const formatDurationSec = (sec) => {
  if (sec == null) return "N/A";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(0);
  return `${m}m ${s}s`;
};

export const formatMetricKey = (key) => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/Sec$/, "(s)")
    .replace(/Ms$/, "(ms)")
    .replace(/Mi B$/, "(MiB)")
    .replace(/ G B/, " GB")
    .trim();
};

export const formatMetricValue = (key, value) => {
  if (value == null) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key === "nodeId") return String(value);
    if (key.toLowerCase().includes("cost")) return formatCost(value);
    if (key.toLowerCase().includes("bytes")) return formatBytes(value);
    if (key.toLowerCase().endsWith("sec")) return formatDurationSec(value);
    if (key.toLowerCase().endsWith("ms")) return `${value.toLocaleString()} ms`;
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(3);
  }
  return String(value);
};

// Fargate resources
export const FARGATE_CPU_OPTIONS = ["256", "512", "1024", "2048", "4096"];
export const FARGATE_MEMORY_MAP = {
  "256": ["512", "1024", "2048"],
  "512": ["1024", "2048", "3072", "4096"],
  "1024": ["2048", "3072", "4096", "5120", "6144", "7168", "8192"],
  "2048": ["4096", "5120", "6144", "7168", "8192", "9216", "10240", "11264", "12288", "13312", "14336", "15360", "16384"],
  "4096": ["8192", "9216", "10240", "11264", "12288", "13312", "14336", "15360", "16384", "17408", "18432", "19456", "20480", "21504", "22528", "23552", "24576", "25600", "26624", "27648", "28672", "29696", "30720"],
};
export const getMemoryOptionsForCpu = (cpu) => FARGATE_MEMORY_MAP[cpu] || [];

export const formatResourceLabel = (val) => {
  const n = parseInt(val, 10);
  if (n >= 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} GB`;
  return `${n} MB`;
};

// DAG constants
export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 80;

// Compute node / user name lookup
export const computeNodeName = (uuid, computeNodes) => {
  if (!uuid) return "N/A";
  const node = computeNodes.find((n) => n.uuid === uuid);
  return node ? node.name : uuid;
};

export const getUserName = (userId, profile, orgMembers) => {
  if (!userId) return "Unknown";
  if (profile && (profile.id === userId || profile.intId === userId)) {
    return `${profile.firstName} ${profile.lastName}`.trim() || "You";
  }
  const member = orgMembers.find((m) => m.id === userId || m.intId === userId);
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || "Unknown User";
  }
  return String(userId).includes(":") ? String(userId).split(":").pop() : String(userId);
};
