// Opening a pull request with the builder's app.yml (github-service
// POST /repository/{owner}/{repo}/app-yml), and what its answer means for the
// builder. Pure, so the mapping is easy to test.

// What a response means: opened, or why not.
//   opened         { url, number, branch }
//   needsApproval  the owner's installation hasn't accepted the app's updated
//                  permissions: { reviewUrl, organization }
//   noPush         the user can't push to the repository
//   notLinked      no GitHub account linked
//   unavailable    this Pennsieve can't open pull requests yet (no route)
//   error          anything else: { message }
export function pullRequestOutcome(status, body = {}) {
  const code = body?.code;
  if (status === 201 || status === 200) {
    return { kind: "opened", url: body?.pullRequestUrl || "", number: body?.number, branch: body?.branch };
  }
  if (code === "permissions_not_accepted") {
    const reviewUrl = body?.reviewUrl || "";
    return { kind: "needsApproval", reviewUrl, organization: /\/organizations\//.test(reviewUrl) };
  }
  if (code === "no_push_access") return { kind: "noPush" };
  if (code === "github_not_linked") return { kind: "notLinked" };
  if (status === 404 && !code) return { kind: "unavailable" };
  return { kind: "error", message: body?.message || `The request failed (${status}).` };
}

// POST the app.yml; resolves to the outcome, never throws.
export async function openAppYmlPullRequest(api2Url, repo, content, token, fetchImpl = fetch) {
  try {
    const resp = await fetchImpl(
      `${api2Url}/repository/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/app-yml`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
    let body = {};
    try {
      body = await resp.json();
    } catch {
      body = {};
    }
    return pullRequestOutcome(resp.status, body);
  } catch (err) {
    return { kind: "error", message: err?.message || "The request failed." };
  }
}
