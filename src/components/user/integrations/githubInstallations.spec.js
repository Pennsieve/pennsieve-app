import { describe, it, expect } from "vitest";
import { needsReview, isOrganization, reviewSummary } from "./githubInstallations";

const org = { id: 1, name: "Pennsieve", target_type: "Organization", needs_review: true, review_url: "https://github.com/organizations/Pennsieve/settings/installations/1" };
const user = { id: 2, name: "jdoe", target_type: "User", needs_review: false };
const old = { id: 3, name: "legacy" }; // an older github-service: no needs_review

describe("githubInstallations", () => {
  it("reads needs_review, and says nothing for an older backend", () => {
    expect(needsReview(org)).toBe(true);
    expect(needsReview(user)).toBe(false);
    expect(needsReview(old)).toBe(false);
  });
  it("knows organization installations", () => {
    expect(isOrganization(org)).toBe(true);
    expect(isOrganization(user)).toBe(false);
  });
  it("summarizes what needs review", () => {
    expect(reviewSummary([org, user, old])).toEqual({ count: 1, pending: [org], single: org });
    const two = reviewSummary([org, { ...org, id: 9 }]);
    expect(two.count).toBe(2);
    expect(two.single).toBeNull();
    expect(reviewSummary().count).toBe(0);
  });
});
