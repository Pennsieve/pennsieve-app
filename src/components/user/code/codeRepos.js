// My Code's repositories as the Apps tab shows its apps: the filters on the
// left (where releases go, an app or not, public or private), the search and
// Sort over the cards, and what a card's foot says. Pure, so it's easy to
// test.
import { matchesAny, selectedKeys } from "@/components/Analysis/Facets/facets";

// owner/name, from the full name or the repository's URL.
export const repoFullName = (repo = {}) =>
  repo.full_name ||
  String(repo.html_url || repo.url || "")
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "") ||
  repo.name ||
  "";

const normalizeUrl = (u) => String(u || "").replace(/\/+$/, "").replace(/\.git$/, "").toLowerCase();

// The app a repository's releases became, by its source URL.
export function repoApp(repo = {}, applications = []) {
  const targets = new Set([repo.html_url, repo.url].filter(Boolean).map(normalizeUrl));
  if (!targets.size) return null;
  return applications.find((a) => targets.has(normalizeUrl(a.sourceUrl))) || null;
}

// Where a repository's releases go: "appstore", "discover", or "none"
// (not set up: the ones to look at).
export const DESTINATION_OPTIONS = [
  { key: "appstore", label: "App Store" },
  { key: "discover", label: "Discover" },
  { key: "none", label: "Not set up" },
];
export function repoDestinations(repo = {}) {
  const keys = [];
  if (repo.publishing_to_appstore) keys.push("appstore");
  if (repo.publishing_to_discover) keys.push("discover");
  return keys.length ? keys : ["none"];
}

export const APP_OPTIONS = [
  { value: "all", label: "All" },
  { value: "with", label: "Has an app" },
  { value: "without", label: "No app yet" },
];

export const VISIBILITY_OPTIONS = [
  { value: "all", label: "All" },
  { value: "public", label: "Public" },
  { value: "private", label: "Private" },
];

export const REPO_FILTER_DEFAULTS = { destination: [], app: "all", visibility: "all" };

// Its latest release ({ label, release_date, … }), from the list (latest_release)
// or the single endpoint (releases).
export const latestRelease = (repo = {}) => repo.latest_release || repo.content?.releases?.[0] || repo.releases?.[0] || null;

// A section's options with their counts, in the panel's order.
export function destinationFacets(repos = []) {
  return DESTINATION_OPTIONS.map((o) => ({
    key: o.key,
    label: o.label,
    count: repos.filter((r) => repoDestinations(r).includes(o.key)).length,
  })).filter((o) => o.count > 0);
}
// The repositories the search and filters leave. hasApp(repo) says whether
// it has an app.
export function filterRepos(repos = [], { query = "", destination, app = "all", visibility = "all" } = {}, hasApp = () => false) {
  const q = query.trim().toLowerCase();
  return repos.filter((r) => {
    if (q && ![repoFullName(r), r.description].some((s) => String(s || "").toLowerCase().includes(q))) return false;
    if (!matchesAny(repoDestinations(r), destination)) return false;
    if (app === "with" && !hasApp(r)) return false;
    if (app === "without" && hasApp(r)) return false;
    if (visibility === "public" && r.private) return false;
    return !(visibility === "private" && !r.private);
  });
}

export const REPO_SORTS = [
  { value: "apps", label: "Apps first" },
  { value: "name", label: "Name" },
  { value: "released", label: "Latest release" },
];

export function sortRepos(repos = [], sort = "apps", hasApp = () => false) {
  const byName = (a, b) => repoFullName(a).toLowerCase().localeCompare(repoFullName(b).toLowerCase());
  const time = (r) => Date.parse(latestRelease(r)?.release_date || "") || 0;
  const cmp = {
    apps: (a, b) => Number(hasApp(b)) - Number(hasApp(a)) || byName(a, b),
    name: byName,
    released: (a, b) => time(b) - time(a) || byName(a, b),
  }[sort] || byName;
  return repos.slice().sort(cmp);
}

// The filters set, as removable chips over the cards.
export function repoActiveFilters(state = {}) {
  const chips = [];
  for (const key of selectedKeys(state.destination)) {
    chips.push({ key: "destination", value: key, label: DESTINATION_OPTIONS.find((o) => o.key === key)?.label || key });
  }
  if (state.app && state.app !== REPO_FILTER_DEFAULTS.app) {
    chips.push({ key: "app", label: APP_OPTIONS.find((o) => o.value === state.app)?.label || state.app });
  }
  if (state.visibility && state.visibility !== REPO_FILTER_DEFAULTS.visibility) {
    chips.push({ key: "visibility", label: VISIBILITY_OPTIONS.find((o) => o.value === state.visibility)?.label || state.visibility });
  }
  return chips;
}

// A card's foot: where releases go, and its dot (ok: going somewhere;
// pending: the App Store, waiting on a first release; off: not set up).
export function repoStatus(repo = {}, { hasApp = false } = {}) {
  const labels = DESTINATION_OPTIONS.filter((o) => o.key !== "none" && repoDestinations(repo).includes(o.key)).map((o) => o.label);
  if (!labels.length) return { state: "off", text: "Not set up" };
  const waiting = repo.publishing_to_appstore && !hasApp && !latestRelease(repo);
  return {
    state: waiting ? "pending" : "ok",
    text: `Releases go to ${labels.join(" and ")}`,
    title: waiting ? "Release a version to add it to the App Store" : "",
  };
}

// Its latest release, for the card: "v1.2.0 · 3 days ago", or none yet.
export function releaseLabel(repo = {}, now = Date.now()) {
  const r = latestRelease(repo);
  if (!r?.label) return "No release yet";
  const when = agoLabel(r.release_date, now);
  return when ? `${r.label} · ${when}` : r.label;
}

// "today", "3 days ago", "2 months ago".
export function agoLabel(dateString, now = Date.now()) {
  const t = Date.parse(dateString || "");
  if (!t) return "";
  const days = Math.floor(Math.max(0, now - t) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} month${m === 1 ? "" : "s"} ago`;
  }
  const y = Math.floor(days / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}
