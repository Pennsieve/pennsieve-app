// The Notebooks tab's usage strip: what notebook sessions have taken, from
// the notebook share of the workspace's (or My Workspace's) counters.

// { sessions, seconds, cost } from a counters response's interactive share,
// or null when it has no sessions.
export function notebookUsage(counters) {
  const nb = counters?.interactive?.allTime;
  if (!nb?.totalRuns) return null;
  return { sessions: nb.totalRuns, seconds: nb.totalDurationSec || 0, cost: nb.totalCost || 0 };
}

// "40 s", "12 min", "3 h 5 min", "41 h": time in sessions, to the minute.
export function sessionTime(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h >= 10 || !m ? `${h} h` : `${h} h ${m} min`;
}

// "$0.04", "<$0.01", "$0": what sessions cost.
export function sessionCost(cost) {
  const c = Number(cost) || 0;
  if (c === 0) return "$0";
  if (c < 0.01) return "<$0.01";
  return `$${c.toFixed(2)}`;
}
