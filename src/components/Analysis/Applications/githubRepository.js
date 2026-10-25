// What github-service knows about an app's GitHub repository
// (GET {api2}/repository/{owner}/{repo}): its description, and whether the
// signed-in user can push to it (viewerCanPush), so the app page and the
// manifest builder can treat a maintainer like the app's owner.
import { useGetToken } from "@/composables/useGetToken";

export const repositoryUrl = (api2Url, repo) =>
  repo ? `${api2Url}/repository/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}` : "";

/** The repository's record, or null when it can't be read. */
export async function fetchRepository(api2Url, repo, getToken = useGetToken) {
  const url = repositoryUrl(api2Url, repo);
  if (!api2Url || !url) return null;
  try {
    const token = await getToken();
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return resp.ok ? await resp.json() : null;
  } catch {
    return null;
  }
}

/**
 * Whether the viewer may update the app's app.yml: its owner, or anyone who
 * can push to the repository. Without the field (an older github-service, or
 * no access), only the owner.
 */
export const canUpdateManifest = (isOwner, repository) => Boolean(isOwner) || repository?.viewerCanPush === true;
