// Short facts for a detailed workflow graph node: how long it ran, its
// resources, its cost. Each is a string, or "" when there's nothing to say.

// Seconds a node ran: from start to completion, or to now while it runs.
export function nodeDurationSec({ startedAt, completedAt, status } = {}, now = Date.now()) {
  const start = Date.parse(startedAt || "");
  if (!Number.isFinite(start)) return null;
  const end = completedAt ? Date.parse(completedAt) : status === "STARTED" ? now : NaN;
  if (!Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

export function formatRunTime(sec) {
  if (sec == null) return "";
  if (sec < 60) return `${Math.round(sec)}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${Math.round(sec % 60)}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ECS CPU units and MiB, as "1 vCPU · 2 GB".
export function formatResources(cpu, memory) {
  const parts = [];
  const units = Number(cpu);
  if (units > 0) parts.push(`${+(units / 1024).toFixed(2)} vCPU`);
  const mib = Number(memory);
  if (mib > 0) parts.push(mib >= 1024 ? `${+(mib / 1024).toFixed(1)} GB` : `${mib} MB`);
  return parts.join(" · ");
}
