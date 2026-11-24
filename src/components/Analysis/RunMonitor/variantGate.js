/*
  The provisioner version gate for app variants (docs/app-variants.md in
  workflow-service, section 5a). A step that runs a variant other than its
  version's default needs a compute node whose provisioner passes the variant
  on to the registry; an older one would quietly run the default image.
  workflow-service refuses such runs (422) when the node's
  provisionerImageTag is older than VARIANTS_MIN_PROVISIONER_VERSION, or isn't
  a version at all ("latest", none) unless
  VARIANTS_ALLOW_UNVERSIONED_PROVISIONER is set. The run dialog and the
  notebook wizard apply the same rule ahead of time; the server stays the
  authority.
*/
import { defaultVariant } from "../WorkflowBuilder/appManifestInfo";

// The gate itself (the provisioner version rule and workflow-service's
// settings) is @pennsieve/notebooks'; this adds whether a step needs it.
export { provisionerGateReason, fetchVariantGate, resetVariantGate } from "@pennsieve/notebooks/components/Analysis/RunMonitor/variantGate";

// Whether a workflow step runs a variant other than its version's default:
// one it names that isn't the default (an app not known here counts, as the
// server would decide).
export function runsNonDefaultVariant(step, app) {
  if (!step?.variant) return false;
  if (!app) return true;
  return step.variant !== defaultVariant(app, step.tag);
}
