// Giving the Pennsieve GitHub App access to a repository from Pennsieve
// (github-service POST /repository/{owner}/{repo}/access, as the user). GitHub
// lets a user token add a repository the user administers; a private
// repository the installation can't see yet has to be added on GitHub. Pure,
// apart from the request, so the outcomes are easy to test.

// What a response means.
//   accessible      the installation already had access (or covers all repositories)
//   added           added to the installation just now
//   noInstallation  the Pennsieve app isn't installed for the owner: { owner }
//   notVisible      the token can't see it (private, outside the installation): { installation }
//   notAdmin        the user isn't an admin of the repository: { installation }
//   notLinked       no GitHub account linked
//   unavailable     this Pennsieve can't add repositories yet (no route)
//   error           anything else: { message }
export function accessOutcome(status, body = {}) {
  const s = body?.status;
  const installation = body?.installation || null;
  if (status === 200 && (s === "accessible" || s === "added")) {
    return { kind: s, installation, repository: body?.repository || null };
  }
  if (s === "no_installation") return { kind: "noInstallation", owner: body?.owner || "", installation };
  if (s === "not_visible") return { kind: "notVisible", installation, message: body?.message || "" };
  if (s === "not_admin") return { kind: "notAdmin", installation, message: body?.message || "" };
  if (status === 404 && !s) {
    // github-service 404s "GitHub profile not found" with a plain error; a
    // route that doesn't exist answers 404 without a message.
    return /profile/i.test(body?.message || "") ? { kind: "notLinked" } : { kind: "unavailable" };
  }
  return { kind: "error", message: body?.message || `The request failed (${status}).` };
}

// Whether an outcome means Pennsieve can read the repository.
export const hasAccess = (outcome) => outcome?.kind === "accessible" || outcome?.kind === "added";

// POST the access request; resolves to the outcome, never throws.
export async function requestRepositoryAccess(api2Url, repo, token, fetchImpl = fetch) {
  try {
    const resp = await fetchImpl(
      `${api2Url}/repository/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/access`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } }
    );
    let body = {};
    try {
      body = await resp.json();
    } catch {
      body = {};
    }
    return accessOutcome(resp.status, body);
  } catch (err) {
    return { kind: "error", message: err?.message || "The request failed." };
  }
}

// Where the user adds the repository by hand: the installation's settings
// page on GitHub when one is known, else the app's install page (GitHub asks
// which account to install it on).
export function manualAccessUrl(outcome, githubAppUrl) {
  const configUrl = outcome?.installation?.config_url || outcome?.installation?.configUrl;
  if (configUrl) return configUrl;
  return `${String(githubAppUrl || "").replace(/\/$/, "")}/installations/new`;
}
