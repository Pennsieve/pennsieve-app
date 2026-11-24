// How runs read on the notebook pages: status dots and labels, names,
// times, durations, costs and sizes. The app's runHelpers re-exports them.

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

// A run that's running or on its way, as Live's "Active" cards count it:
// queued (NOT_STARTED), running (STARTED), or ending (FINALIZING).
export const RUNNING_STATUSES = ["NOT_STARTED", "STARTED", "FINALIZING"];

export const isRunningStatus = (status) => RUNNING_STATUSES.includes(status);

// Which empty state a run list shows (Notebooks and Workflows Live):
// - "empty": nothing at all (none loaded, no more pages, no history
//   counted elsewhere: hasHistory);
// - "idle": a history, but none running;
// - null: still loading the first page (no flash), filtered (the list's own
//   "no results" applies), or some are running.
export function runsEmptyState({ loading = false, runs = [], hasMore = false, hasHistory = false, filtered = false } = {}) {
  if (loading && !runs.length) return null;
  if (filtered) return null;
  if (runs.some((r) => isRunningStatus(r.status))) return null;
  return runs.length || hasMore || hasHistory ? "idle" : "empty";
}

export const isTerminalStatus = (status) => {
  return ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
};

export const runDisplayName = (run) => {
  if (!run) return "";
  const name = typeof run.name === "string" ? run.name.trim() : "";
  if (name) return name;
  return run.workflowName || "";
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
  // Not "$0.0000": a cost too small for four decimals isn't none.
  if (cost < 0.0001) return "< $0.0001";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
};

export const formatBytes = (bytes) => {
  if (bytes == null) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
