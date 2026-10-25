// The Pennsieve GitHub App's installations as the GitHub card shows them:
// which ones still have to accept Pennsieve's updated permissions on GitHub.
// github-service says so per installation (needs_review, review_url); an older
// github-service doesn't, and then nothing is shown.

export const needsReview = (installation) => installation?.needs_review === true;

export const isOrganization = (installation) => /^organization$/i.test(installation?.target_type || "");

// The installations to review, and the one link to show when there's only one.
export function reviewSummary(installations = []) {
  const pending = installations.filter(needsReview);
  return {
    count: pending.length,
    pending,
    single: pending.length === 1 ? pending[0] : null,
  };
}
