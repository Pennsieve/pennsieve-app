// Publishing a release of an app's repository from Pennsieve (github-service
// POST /repository/{owner}/{repo}/release, as the user). The release webhook
// then adds the version to the app store, as for a release made on GitHub.
// Pure, apart from the request, so the version rules are easy to test.

// A version tag, as github-service accepts it: v1.2.3 or 1.2.3, with an
// optional pre-release (v1.2.3-rc.1).
const VERSION = /^(v?)(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;

export const isVersionTag = (tag) => VERSION.test(String(tag || "").trim());

/** { prefix, major, minor, patch, pre } or null. */
export function parseVersion(tag) {
  const m = VERSION.exec(String(tag || "").trim());
  return m ? { prefix: m[1], major: +m[2], minor: +m[3], patch: +m[4], pre: m[5] || "" } : null;
}

// a < b: negative. A pre-release sorts before its release (1.0.0-rc < 1.0.0).
function compare(a, b) {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    (a.pre === b.pre ? 0 : !a.pre ? 1 : !b.pre ? -1 : a.pre < b.pre ? -1 : 1)
  );
}

/** The highest version among tags, or "" when none is a version. */
export function latestVersion(tags) {
  let best = null;
  for (const tag of tags || []) {
    const v = parseVersion(tag);
    if (v && (!best || compare(v, best.v) > 0)) best = { tag: String(tag).trim(), v };
  }
  return best ? best.tag : "";
}

/**
 * The next patch, minor and major versions after latest, keeping its "v" (or
 * its absence). With no release yet, the first: v0.0.1, v0.1.0 or v1.0.0.
 */
export function nextVersions(latest) {
  const v = parseVersion(latest);
  if (!v) return { patch: "v0.0.1", minor: "v0.1.0", major: "v1.0.0" };
  const p = v.prefix;
  // A pre-release's next patch is the release itself (v1.2.0-rc.1 -> v1.2.0).
  const patch = v.pre ? `${p}${v.major}.${v.minor}.${v.patch}` : `${p}${v.major}.${v.minor}.${v.patch + 1}`;
  return { patch, minor: `${p}${v.major}.${v.minor + 1}.0`, major: `${p}${v.major + 1}.0.0` };
}

/**
 * Why a tag can't be released, before asking GitHub: "" when it can. Known
 * tags are the repository's releases and the app store's versions; GitHub
 * also refuses a tag that exists without a release (the server checks).
 */
export function tagProblem(tag, knownTags, latest) {
  const t = String(tag || "").trim();
  if (!t) return "Enter a version.";
  if (!isVersionTag(t)) return "Use a version like v1.2.3.";
  const bare = (s) => String(s || "").trim().replace(/^v/, "");
  if ((knownTags || []).some((k) => bare(k) === bare(t))) return `${t} is already released. Pick a new version.`;
  const v = parseVersion(t);
  const l = parseVersion(latest);
  if (v && l && compare(v, l) <= 0) return `${t} isn't newer than ${latest}.`;
  return "";
}

// What a response means: released, or why not.
//   released       { url, tag, target }
//   needsApproval  the owner's installation hasn't accepted the permissions: { reviewUrl }
//   noPush         the user can't push to the repository
//   notLinked      no GitHub account linked
//   tagExists      the tag already exists on GitHub
//   invalid        { message } (a bad tag, or app.yml that doesn't parse)
//   unavailable    this Pennsieve can't publish releases yet (no route)
//   error          anything else: { message }
export function releaseOutcome(status, body = {}) {
  const code = body?.code;
  if (status === 201 || status === 200) {
    return { kind: "released", url: body?.releaseUrl || "", tag: body?.tag || "", target: body?.target || "" };
  }
  if (code === "permissions_not_accepted") return { kind: "needsApproval", reviewUrl: body?.reviewUrl || "" };
  if (code === "no_push_access") return { kind: "noPush" };
  if (code === "github_not_linked") return { kind: "notLinked" };
  if (code === "tag_exists") return { kind: "tagExists", message: body?.message || "" };
  if (code === "nothing_to_release") return { kind: "nothingNew", message: body?.message || "" };
  if (code === "invalid_tag" || code === "invalid_app_yml") return { kind: "invalid", message: body?.message || "" };
  if (status === 404 && !code) return { kind: "unavailable" };
  return { kind: "error", message: body?.message || `The request failed (${status}).` };
}

// POST the release; resolves to the outcome, never throws.
export async function publishRelease(api2Url, repo, release, token, fetchImpl = fetch) {
  try {
    const resp = await fetchImpl(
      `${api2Url}/repository/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/release`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tag: String(release.tag || "").trim(),
          ...(release.target && { target: String(release.target).trim() }),
          ...(release.notes && String(release.notes).trim() && { notes: String(release.notes).trim() }),
        }),
      }
    );
    let body = {};
    try {
      body = await resp.json();
    } catch {
      body = {};
    }
    return releaseOutcome(resp.status, body);
  } catch (err) {
    return { kind: "error", message: err?.message || "The request failed." };
  }
}

/**
 * Where the default branch stands against the latest release (github-service
 * GET /repository/{owner}/{repo}/release): { latestTag, latestUrl, target,
 * commitsSince, canRelease }, or null when it can't be told (then Release
 * stays offered and the server still refuses a release with nothing new).
 */
export async function fetchReleaseStatus(api2Url, repo, token, fetchImpl = fetch) {
  try {
    const resp = await fetchImpl(
      `${api2Url}/repository/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/release`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return null;
    const body = await resp.json();
    return typeof body?.canRelease === "boolean" ? body : null;
  } catch {
    return null;
  }
}

// The nudge next to Release: "3 new commits since v1.3.6", or "".
export function releaseNudge(status) {
  if (!status?.latestTag || !status.commitsSince) return "";
  const n = status.commitsSince;
  return `${n} new commit${n === 1 ? "" : "s"} since ${status.latestTag}`;
}

// Building a release GitHub already has (github-service POST
// /repository/{owner}/{repo}/publish): the publisher fetches the release,
// stores it, and sends it to the destinations the repository has on, narrowed
// to `destinations` when given. 202 means it's under way.
//   accepted     { label }
//   noDestinations  the repository has nothing turned on (422)
//   notLinked    no GitHub account linked
//   unavailable  no route here yet
//   error        anything else: { message }
export function storedReleaseOutcome(status, body = {}, label = "") {
  if (status === 202 || status === 200) return { kind: "accepted", label: body?.label || label };
  if (status === 422) return { kind: "noDestinations", message: body?.message || "" };
  if (status === 404 && /profile/i.test(body?.message || "")) return { kind: "notLinked" };
  if (status === 404 && !body?.message) return { kind: "unavailable" };
  return { kind: "error", message: body?.message || `The request failed (${status}).` };
}

export async function publishStoredRelease(api2Url, repo, { label, destinations = [] }, token, fetchImpl = fetch) {
  try {
    const resp = await fetchImpl(
      `${api2Url}/repository/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/publish`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ label: String(label || "").trim(), ...(destinations.length && { destinations }) }),
      }
    );
    let body = {};
    try {
      body = await resp.json();
    } catch {
      body = {};
    }
    return storedReleaseOutcome(resp.status, body, label);
  } catch (err) {
    return { kind: "error", message: err?.message || "The request failed." };
  }
}
