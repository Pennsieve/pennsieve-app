import { describe, it, expect } from "vitest";
import { workflowPermissions, isWorkflowCreatedBy } from "./workflowPermissions";

const me = { id: "N:user:me", intId: 7 };
const mine = { uuid: "a", createdBy: "N:user:me" };
const theirs = { uuid: "b", createdBy: "N:user:them" };

describe("workflowPermissions", () => {
  it("uses the server's permissions when it sends them", () => {
    // An org admin on someone else's workflow.
    expect(
      workflowPermissions(
        { ...theirs, permissions: { canEdit: true, canPublish: true, canUnpublish: true, canVerify: false } },
        { profile: me },
      ),
    ).toEqual({ canEdit: true, canPublish: true, canUnpublish: true, canVerify: false });
    // The creator, when the server says no (e.g. not theirs to change any more).
    expect(
      workflowPermissions(
        { ...mine, permissions: { canEdit: false, canPublish: false, canUnpublish: false, canVerify: false } },
        { profile: me },
      ).canEdit,
    ).toBe(false);
  });

  it("super-admin on a public workflow: edit, unpublish and verify, not publish", () => {
    const p = workflowPermissions(
      { ...theirs, visibility: "public", permissions: { canEdit: true, canPublish: false, canUnpublish: true, canVerify: true } },
      { profile: me, isSuperAdmin: true },
    );
    expect(p).toEqual({ canEdit: true, canPublish: false, canUnpublish: true, canVerify: true });
  });

  it("falls back to the creator check without permissions (older server)", () => {
    expect(workflowPermissions(mine, { profile: me })).toEqual({
      canEdit: true,
      canPublish: true,
      canUnpublish: true,
      canVerify: false,
    });
    expect(workflowPermissions(theirs, { profile: me })).toEqual({
      canEdit: false,
      canPublish: false,
      canUnpublish: false,
      canVerify: false,
    });
    expect(workflowPermissions(theirs, { profile: me, isSuperAdmin: true })).toEqual({
      canEdit: false,
      canPublish: false,
      canUnpublish: true,
      canVerify: true,
    });
  });

  it("without canUnpublish, publishing (or super-admin) implies it", () => {
    expect(workflowPermissions({ ...theirs, permissions: { canEdit: true, canPublish: true } }, { profile: me }).canUnpublish).toBe(true);
    expect(workflowPermissions({ ...theirs, permissions: { canEdit: false, canPublish: false } }, { profile: me }).canUnpublish).toBe(false);
    expect(
      workflowPermissions({ ...theirs, permissions: { canPublish: false } }, { profile: me, isSuperAdmin: true }).canUnpublish,
    ).toBe(true);
  });

  it("nothing for no workflow", () => {
    expect(workflowPermissions(null, { profile: me }).canEdit).toBe(false);
  });
});

describe("isWorkflowCreatedBy", () => {
  it("matches the node id or the int id", () => {
    expect(isWorkflowCreatedBy(mine, me)).toBe(true);
    expect(isWorkflowCreatedBy({ createdBy: 7 }, me)).toBe(true);
    expect(isWorkflowCreatedBy(theirs, me)).toBe(false);
    expect(isWorkflowCreatedBy({}, me)).toBe(false);
    expect(isWorkflowCreatedBy(mine, null)).toBe(false);
  });
});
