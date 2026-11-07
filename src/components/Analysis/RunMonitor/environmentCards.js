// Pure helpers for the Notebooks page's Environments section
// (EnvironmentsSection.vue), over environments-service's list: each
// environment with its latest version.
import { newestReady } from "@/utils/environmentsService";

// A card's status: its latest version's, except that a failed or building
// version over an older ready one leaves the environment usable.
export function cardStatus(env, versions) {
  const latest = env.latest?.status;
  if (latest === "ready") return "ready";
  if (latest === "building") return "building";
  if (latest === "failed") return "failed";
  return newestReady(versions) ? "ready" : "unknown";
}

// The version a card describes: the newest ready one if there is one, else
// the latest.
export function shownVersion(env, versions) {
  if (env.latest?.status === "ready") return env.latest;
  return newestReady(versions) || env.latest || null;
}

const ORDER = { building: 0, failed: 1, ready: 2, unknown: 3 };

// The user's own first (building, then failed, then ready), then the official
// ones, each by name.
export function sortEnvironments(list) {
  return [...list].sort(
    (a, b) =>
      !!a.env.official - !!b.env.official ||
      ORDER[a.status] - ORDER[b.status] ||
      a.env.name.localeCompare(b.env.name)
  );
}

export function formatBytes(b) {
  if (!b) return "";
  const gb = b / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`;
}

// "3 min ago" from an ISO time.
export function since(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
