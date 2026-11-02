// Add a repository: the wizard's pure parts (AddRepositoryDialog.vue is the
// page). A repository the user already has on GitHub becomes a published
// app, a Discover release, or both: Pennsieve gets access to it, the
// destinations are chosen, the App Store sharing is set before the app
// exists, and a release is built or made. What the services can tell is
// told; the rest the user picks.
import { hasAccess } from "./repositoryAccess";

export const STEPS = Object.freeze(["repository", "destinations", "sharing", "release"]);

export const DESTINATIONS = Object.freeze([
  {
    key: "appstore",
    label: "App Store",
    hint: "Each release is built into an app that workflows can run. The repository needs an app.yml.",
  },
  {
    key: "discover",
    label: "Pennsieve Discover",
    hint: "Each release is archived with a DOI and a landing page, so the code can be cited.",
  },
]);

// A fresh draft.
export const newDraft = () => ({
  owner: "",
  repo: "",
  appstore: true,
  discover: false,
  // App Store sharing, chosen before the app exists.
  visibility: "private",
  // { type, id, name, organizationId }, as the Share dialog keeps them.
  entries: [],
  // The workspace the dialog was opened from has been offered as a share.
  sharingPrefilled: false,
  // The destinations (and sharing) are saved on Pennsieve.
  settingsSaved: false,
  // "existing" (build a release GitHub has), "new" (make one), "later".
  releaseChoice: "",
  // The user picked the choice themselves (else the dialog proposes one).
  releaseChoiceTouched: false,
  // The existing release to build, and the new version to make.
  buildTag: "",
  releaseTag: "",
  // The release built or made from here, once there is one.
  releasedTag: "",
  releaseUrl: "",
});

// parseRepoInput reads "owner/repo" out of what someone pastes: a GitHub URL
// (with or without .git, https or ssh), "github.com/owner/repo", or just
// "owner/repo". null when it isn't one.
export function parseRepoInput(text) {
  let s = String(text || "").trim();
  if (!s) return null;
  s = s.replace(/^git@github\.com:/i, "").replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  s = s.replace(/\.git$/i, "").replace(/\/+$/, "");
  const parts = s.split("/");
  if (parts.length < 2) return null;
  const [owner, repo] = parts;
  const ok = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner) && /^[A-Za-z0-9._-]+$/.test(repo);
  return ok ? { owner, repo } : null;
}

export const repoUrl = (draft) => (draft.owner && draft.repo ? `https://github.com/${draft.owner}/${draft.repo}` : "");
export const repoName = (draft) => (draft.owner && draft.repo ? `${draft.owner}/${draft.repo}` : "");

// The destinations chosen, as github-service names them.
export const destinationsOf = (draft) => [draft.appstore && "appstore", draft.discover && "discover"].filter(Boolean);

// Whether the sharing step applies: only an App Store app has sharing, and
// an app that exists already is shared from its own page.
export const sharingApplies = (draft, { appExists = false } = {}) => Boolean(draft.appstore) && !appExists;

// stepsFor is each step's state: done, the current one, or ahead; the
// sharing step is skipped when it doesn't apply.
// access is the access outcome (repositoryAccess), appExists whether the
// App Store already has an app for the repository.
export const stepsFor = (draft, { access = null, appExists = false } = {}) => {
  const accessible = hasAccess(access);
  const chosen = Boolean(draft.appstore || draft.discover);
  const sharing = sharingApplies(draft, { appExists });
  const done = {
    repository: accessible,
    destinations: accessible && chosen && draft.settingsSaved,
    sharing: sharing && accessible && chosen && draft.settingsSaved,
    release: Boolean(draft.releasedTag) || draft.releaseChoice === "later",
  };
  const skipped = { repository: false, destinations: false, sharing: !sharing, release: false };
  // What lets the next step open: done, or skipped.
  const passed = Object.fromEntries(STEPS.map((k) => [k, done[k] || skipped[k]]));
  let current = "";
  return STEPS.map((key, i) => {
    const isSkipped = skipped[key];
    const isCurrent = !passed[key] && !current && (i === 0 || passed[STEPS[i - 1]]);
    if (isCurrent) current = key;
    return { key, done: done[key] && !isSkipped, current: isCurrent, skipped: isSkipped };
  });
};

// The step to open on: the first still to do, or the last when all are done.
export const firstToDo = (steps) => {
  const i = steps.findIndex((s) => s.current);
  return i < 0 ? STEPS.length - 1 : i;
};

// The next step after i, skipping a skipped one.
export const nextStep = (steps, i) => {
  let j = i + 1;
  while (j < STEPS.length - 1 && steps[j]?.skipped) j += 1;
  return Math.min(j, STEPS.length - 1);
};
export const prevStep = (steps, i) => {
  let j = i - 1;
  while (j > 0 && steps[j]?.skipped) j -= 1;
  return Math.max(j, 0);
};

// sharingSummary is one phrase for the left column: "Public", or "Private ·
// 1 workspace, 2 people", or "Private · only you".
export function sharingSummary(draft) {
  if (draft.visibility === "public") return "Public";
  const n = (t) => (draft.entries || []).filter((e) => e.type === t).length;
  const plural = (c, one, many) => `${c} ${c === 1 ? one : many}`;
  const parts = [
    n("workspace") && plural(n("workspace"), "workspace", "workspaces"),
    n("team") && plural(n("team"), "team", "teams"),
    n("user") && plural(n("user"), "person", "people"),
  ].filter(Boolean);
  return parts.length ? `Private · ${parts.join(", ")}` : "Private · only you";
}

// The access request body for POST /repositories, from the draft's sharing;
// the current user is kept in users so an owner can't lock themselves out.
export function accessPayload(draft, meId, orgId) {
  const of = (type) => (draft.entries || []).filter((e) => e.type === type);
  const users = of("user").map((e) => ({ entityId: e.id, organizationId: e.organizationId || orgId || undefined }));
  if (meId && !users.some((u) => String(u.entityId) === String(meId))) {
    users.push({ entityId: meId, organizationId: orgId || undefined });
  }
  return {
    visibility: draft.visibility === "public" ? "public" : "private",
    users,
    teams: of("team").map((e) => ({ entityId: e.id, organizationId: e.organizationId || orgId || undefined })),
    workspaces: of("workspace").map((e) => ({ entityId: e.id, organizationId: e.organizationId || e.id })),
  };
}

// The repositories to offer in the picker: the ones Pennsieve can see, those
// with nothing turned on first (they are the ones to set up), by name.
export function pickerRepos(repos) {
  const full = (r) => r.full_name || String(r.html_url || r.url || "").replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
  return (repos || [])
    .map((r) => ({ fullName: full(r), enabled: Boolean(r.publishing_to_discover || r.publishing_to_appstore), repo: r }))
    .filter((r) => r.fullName.includes("/"))
    .sort((a, b) => Number(a.enabled) - Number(b.enabled) || a.fullName.localeCompare(b.fullName));
}

const DRAFT_KEY = "pennsieve.addRepository.draft";

export const loadDraft = (storage = globalThis.localStorage) => {
  try {
    const raw = storage?.getItem(DRAFT_KEY);
    return raw ? { ...newDraft(), ...JSON.parse(raw) } : newDraft();
  } catch {
    return newDraft();
  }
};

export const saveDraft = (draft, storage = globalThis.localStorage) => {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Nothing kept in this browser; the dialog still works.
  }
};

export const clearDraft = (storage = globalThis.localStorage) => {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
};
