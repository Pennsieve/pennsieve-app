// The Shared Workspaces page: which of your workspaces it shows, in what
// order, and what each card says. Most people are in one or two. Pure, so
// it's easy to test. A workspace is an entry of the organizations list
// ({ organization: { id, name, ... }, isOwner, isAdmin, isGuest }).

// Your workspaces as members: not those you're a guest in, nor Welcome (the
// onboarding workspace everyone is in; the switcher leaves it out too).
export const memberWorkspaces = (organizations = []) =>
  (organizations || []).filter(
    (w) => w?.organization?.id && !(w.isGuest || w.organization.isGuest) && w.organization.name !== "Welcome"
  );

// Your role there, as a card's badge.
export const workspaceRole = (w) => (w?.isOwner ? "Owner" : w?.isAdmin ? "Admin" : "Member");

// The one you last opened first, then by name.
export const sortWorkspaces = (workspaces = [], lastOpenedId = "") =>
  [...workspaces].sort(
    (a, b) =>
      (b.organization.id === lastOpenedId) - (a.organization.id === lastOpenedId) ||
      a.organization.name.localeCompare(b.organization.name, undefined, { sensitivity: "base" })
  );

// Where a card's links land in a workspace (useSwitchWorkspace's `to`).
export const WORKSPACE_PAGES = ["datasets", "analysis"];
export const landingPath = (orgId, to) => `/${orgId}/${WORKSPACE_PAGES.includes(to) ? to : "datasets"}`;
