import { describe, it, expect } from "vitest";
import { runTenant } from "./analysisModule";

describe("runTenant", () => {
  it("is the workspace being viewed", () => {
    expect(runTenant({ activeOrganization: { organization: { id: "N:organization:050fae39-4412" } }, profile: { id: "N:user:abc" } }))
      .toBe("ORG#050fae39-4412");
  });
  it("is the user in My Workspace", () => {
    expect(runTenant({ activeOrganization: null, profile: { id: "N:user:446536b2" } })).toBe("USER#446536b2");
  });
  it("is nothing when neither is known", () => {
    expect(runTenant({})).toBeUndefined();
  });
});
