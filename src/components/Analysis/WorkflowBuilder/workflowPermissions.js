/*
  What the signed-in user may do with a workflow. workflow-service sends it
  (workflow.permissions: canEdit, canPublish, canUnpublish, canVerify),
  computed by the same rules it enforces: the creator; for a workspace's
  workflow, its Admins and Owners too; super-admins edit public workflows,
  unpublish any and verify. A workflow from an older server, or a list
  that doesn't carry them (the public catalog), falls back to what older
  servers allowed: the creator manages it, a super-admin may unpublish.
*/

export const isWorkflowCreatedBy = (workflow, profile) =>
  !!workflow &&
  !!profile &&
  !!workflow.createdBy &&
  (profile.id === workflow.createdBy || profile.intId === workflow.createdBy);

export function workflowPermissions(workflow, { profile, isSuperAdmin = false } = {}) {
  if (!workflow) {
    return { canEdit: false, canPublish: false, canUnpublish: false, canVerify: false };
  }
  const p = workflow.permissions;
  if (p && typeof p === "object") {
    return {
      canEdit: p.canEdit === true,
      canPublish: p.canPublish === true,
      // canUnpublish came with the others; without it, publishing implies it.
      canUnpublish: p.canUnpublish === undefined ? p.canPublish === true || isSuperAdmin : p.canUnpublish === true,
      canVerify: p.canVerify === true,
    };
  }
  const creator = isWorkflowCreatedBy(workflow, profile);
  return {
    canEdit: creator,
    canPublish: creator,
    canUnpublish: creator || isSuperAdmin,
    canVerify: isSuperAdmin,
  };
}
