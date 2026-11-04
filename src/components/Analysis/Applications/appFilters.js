// The Apps tab's filters (visibility, status, domain, field and the search):
// which apps a choice keeps, and the chips naming what's chosen. Pure, so the
// rules are easy to test; moved out of ApplicationsGrid unchanged.
import { appDomain, appFields } from "./appDomains";
import { matchesAppSearch } from "./appCards";

export const VISIBILITY_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
];
export const APP_STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "All", value: "all" },
];
// Nothing chosen: every visibility, active apps, any domain or field.
export const APP_FILTER_DEFAULTS = { visibility: "all", status: "active", domain: null, field: null };

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
// visibility, for its domain (a key) and serving its field (a key); a
// domain and a field must both hold.
export function filterApps(apps = [], { status = "active", query = "", visibility = "all", domain = null, field = null } = {}) {
  let list = appsInStatus(apps, status);
  list = list.filter((app) => matchesAppSearch(app, query, readmeSummary(app)));
  if (visibility !== "all") list = list.filter((app) => (visibilityLabel(app) || "").toLowerCase() === visibility);
  if (domain) list = list.filter((app) => appDomain(app)?.key === domain);
  if (field) list = list.filter((app) => appFields(app).some((f) => f.key === field));
  return list;
}

// The filters set away from their defaults, as removable chips ({ key,
// label }) in the panel's order: visibility, domain, field, status. Labels
// come from the options shown (domainCounts, fieldCounts); one no longer
// offered shows by its key.
export function appActiveFilters(state = {}, { domains = [], fields = [] } = {}) {
  const set = (key) => state[key] !== undefined && state[key] !== APP_FILTER_DEFAULTS[key];
  const chips = [];
  if (set("visibility")) {
    chips.push({ key: "visibility", label: VISIBILITY_OPTIONS.find((o) => o.value === state.visibility)?.label || state.visibility });
  }
  if (set("domain")) chips.push({ key: "domain", label: domains.find((o) => o.domain.key === state.domain)?.domain.label || state.domain });
  if (set("field")) chips.push({ key: "field", label: fields.find((o) => o.field.key === state.field)?.field.label || state.field });
  if (set("status")) {
    chips.push({ key: "status", label: `Status: ${APP_STATUS_OPTIONS.find((o) => o.value === state.status)?.label || state.status}` });
  }
  return chips;
}
