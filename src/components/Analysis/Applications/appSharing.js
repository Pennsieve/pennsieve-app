// Who can use an App Store app: its visibility, and the people, teams and
// workspaces a private app is shared with. Pure, on the permissions API's
// entries and the store's members, teams and organizations, so the app page's
// summary and the Share dialog agree and are easy to test.

// The permissions API names an entry's kind and id a few ways.
export function entryType(perm) {
  const t = perm?.entityType || perm?.granteeType;
  if (t === "organization") return "workspace";
  if (t) return t;
  if (perm?.userId) return "user";
  if (perm?.teamId) return "team";
  if (perm?.organizationId || perm?.workspaceId) return "workspace";
  return null;
}

export function entryId(perm) {
  return perm?.entityRawId || perm?.userId || perm?.teamId || perm?.organizationId || perm?.workspaceId || perm?.granteeId || null;
}

const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim();
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

// Name lookups over the store's lists; fall back to what the entry carries.
export function makeNamer({ profile, members = [], teams = [], organizations = [] } = {}) {
  return {
    user(id) {
      if (profile && (sameId(profile.id, id) || sameId(profile.intId, id))) return fullName(profile) || "You";
      const m = members.find((x) => sameId(x.id, id) || sameId(x.intId, id));
      if (m) return fullName(m) || "Unknown person";
      return String(id ?? "").includes(":") ? String(id).split(":").pop() : String(id ?? "Unknown");
    },
    team(id, fallback) {
      const t = teams.find((x) => sameId(x.team?.id, id) || sameId(x.team?.intId, id));
      return t?.team?.name || fallback || String(id ?? "");
    },
    workspace(id, fallback) {
      const o = organizations.find((x) => sameId(x.organization?.id, id) || sameId(x.organization?.intId, id));
      return o?.organization?.name || fallback || String(id ?? "");
    },
  };
}

/**
 * The permissions as one list: { type: "user"|"team"|"workspace", id, name,
 * organizationId }, people first, then teams, then workspaces.
 */
export function accessEntries(perms, namer, fallbackOrgId = null) {
  const order = { user: 0, team: 1, workspace: 2 };
  const out = [];
  for (const p of perms || []) {
    const type = entryType(p);
    const id = entryId(p);
    if (!id || !(type in order)) continue;
    const name =
      type === "user"
        ? namer.user(id)
        : type === "team"
          ? namer.team(id, p.teamName)
          : namer.workspace(id, p.organizationName || p.workspaceName);
    out.push({ type, id, name, organizationId: type === "workspace" ? id : p.organizationId || fallbackOrgId });
  }
  return out.sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name));
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * One line: "Shared with 2 workspaces, 1 team and 3 people". The owner (who
 * always has access) isn't counted. "" when shared with no one else.
 */
export function accessSummary(entries, ownerId) {
  const others = (entries || []).filter((e) => !(e.type === "user" && sameId(e.id, ownerId)));
  const n = (t) => others.filter((e) => e.type === t).length;
  const parts = [
    n("workspace") && plural(n("workspace"), "workspace", "workspaces"),
    n("team") && plural(n("team"), "team", "teams"),
    n("user") && plural(n("user"), "person", "people"),
  ].filter(Boolean);
  if (!parts.length) return "";
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  return `Shared with ${list}`;
}

/**
 * Who can be added, matching a search: people (by name or email), teams and
 * workspaces, minus those already in entries. Each { type, id, name, detail,
 * organizationId }. Workspaces skip the "Welcome" placeholder.
 */
export function shareCandidates(query, { members = [], teams = [], organizations = [] } = {}, entries = [], orgId = null) {
  const q = String(query || "").trim().toLowerCase();
  const taken = new Set((entries || []).map((e) => `${e.type}:${e.id}`));
  const hit = (...texts) => !q || texts.some((t) => String(t || "").toLowerCase().includes(q));
  const out = [];
  for (const m of members) {
    if (m?.id && !taken.has(`user:${m.id}`) && hit(fullName(m), m.email)) {
      out.push({ type: "user", id: m.id, name: fullName(m) || m.email || m.id, detail: m.email || "", organizationId: orgId });
    }
  }
  for (const t of teams) {
    const id = t?.team?.id;
    if (id && !taken.has(`team:${id}`) && hit(t.team.name)) {
      out.push({ type: "team", id, name: t.team.name, detail: "Team", organizationId: orgId });
    }
  }
  for (const o of organizations) {
    const id = o?.organization?.id;
    const name = o?.organization?.name;
    if (id && name?.toLowerCase() !== "welcome" && !taken.has(`workspace:${id}`) && hit(name)) {
      out.push({ type: "workspace", id, name, detail: "Workspace", organizationId: id });
    }
  }
  return out;
}

/**
 * The save request for updateApplicationPermissions: visibility, and the
 * users, teams and workspaces. The current user always stays in users, so
 * an owner can't lock themselves out.
 */
export function sharePayload(entries, visibility, meId, orgId) {
  const of = (type) => (entries || []).filter((e) => e.type === type);
  const users = of("user").map((e) => ({ entityId: e.id, organizationId: e.organizationId || orgId }));
  if (meId && !users.some((u) => sameId(u.entityId, meId))) users.push({ entityId: meId, organizationId: orgId });
  return {
    visibility: visibility === "public" ? "public" : "private",
    users,
    teams: of("team").map((e) => ({ entityId: e.id, organizationId: e.organizationId || orgId })),
    workspaces: of("workspace").map((e) => ({ entityId: e.id, organizationId: e.organizationId || e.id })),
  };
}
