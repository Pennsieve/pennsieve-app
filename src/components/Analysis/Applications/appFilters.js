// The Apps tab's filters (visibility, status, domain, field and the search):
// which apps a choice keeps, and the chips naming what's chosen. Pure, so the
// rules are easy to test; moved out of ApplicationsGrid unchanged.
import { appDomain, appFields } from "./appDomains";
import { matchesAppSearch } from "./appCards";
import { freeTags, matchesAny, selectedKeys } from "../Facets/facets";
import { versionManifest } from "../WorkflowBuilder/appManifestInfo";

export const VISIBILITY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];
// The panel's "Show archived" lists all (Active and Archived), as on the
// Workflows Library; archived alone isn't offered, but a chip names it.
const STATUS_CHIPS = { all: "Including archived", archived: "Archived only" };
// Nothing chosen: every visibility, active apps, any domain, field or tag.
export const APP_FILTER_DEFAULTS = Object.freeze({ visibility: "all", status: "active", domain: [], field: [], tag: [] });

// An app's tags that name no domain or field, from its app.yml (all of
// them, not only the few its card shows): the Tags section's.
export const appFreeTags = (app) => freeTags(versionManifest(app)?.tags);

// "Public" or "Private" (null for anything else).
export function visibilityLabel(app) {
  const visibility = app?.visibility;
  if (visibility !== "public" && visibility !== "private") return null;
  return visibility === "private" ? "Private" : "Public";
}

// The short README summary a card shows without a description (and search
// reads).
export const readmeSummary = (app) => app?.summary || "";

// The apps in a status: "active" (not archived), "archived", or "all". The
// panel's domain and field counts are over these.
export function appsInStatus(apps = [], status = "active") {
  if (status === "active") return apps.filter((app) => app.status !== "archived");
  if (status === "archived") return apps.filter((app) => app.status === "archived");
  return apps;
}

// The apps a choice keeps: in its status, matching the search, of its
// visibility, for any of its domains, serving any of its fields and with
// any of its tags (lists of keys: OR within each, AND between them; empty
// for all).
export function filterApps(apps = [], { status = "active", query = "", visibility = "all", domain = [], field = [], tag = [] } = {}) {
  let list = appsInStatus(apps, status);
  list = list.filter((app) => matchesAppSearch(app, query, readmeSummary(app)));
  if (visibility !== "all") list = list.filter((app) => (visibilityLabel(app) || "").toLowerCase() === visibility);
  list = list.filter((app) => matchesAny([appDomain(app)?.key].filter(Boolean), domain));
  list = list.filter((app) => matchesAny(appFields(app).map((f) => f.key), field));
  list = list.filter((app) => matchesAny(appFreeTags(app).map((t) => t.key), tag));
  return list;
}

// The filters set away from their defaults, as removable chips ({ key,
// value, label }; one per chosen domain, field and tag, value its key) in
// the panel's order: visibility, status, domain, field, tag. Labels come
// from the options shown (domainCounts, fieldCounts, tagFacetOptions); one
// no longer offered shows by its key.
export function appActiveFilters(state = {}, { domains = [], fields = [], tags = [] } = {}) {
  const set = (key) => state[key] !== undefined && state[key] !== APP_FILTER_DEFAULTS[key];
  const chips = [];
  if (set("visibility")) {
    chips.push({ key: "visibility", label: VISIBILITY_OPTIONS.find((o) => o.value === state.visibility)?.label || state.visibility });
  }
  if (set("status")) chips.push({ key: "status", label: STATUS_CHIPS[state.status] || `Status: ${state.status}` });
  for (const key of selectedKeys(state.domain)) {
    chips.push({ key: "domain", value: key, label: domains.find((o) => o.domain.key === key)?.domain.label || key });
  }
  for (const key of selectedKeys(state.field)) {
    chips.push({ key: "field", value: key, label: fields.find((o) => o.field.key === key)?.field.label || key });
  }
  for (const key of selectedKeys(state.tag)) {
    chips.push({ key: "tag", value: key, label: tags.find((o) => o.key === key)?.label || key });
  }
  return chips;
}
