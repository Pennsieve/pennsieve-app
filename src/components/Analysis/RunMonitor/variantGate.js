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

const parse = (tag) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag || "").trim());
  return m ? m.slice(1).map(Number) : null;
};
const before = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

// Why a node can't run a non-default variant, or "": its provisioner is
// older than the minimum, or has no version to compare. gate: { min,
// allowUnversioned }; without a minimum (the gate off, or not known here)
// nothing is refused.
export function provisionerGateReason(node, gate = {}) {
  const min = parse(gate?.min);
  if (!min) return "";
  const tag = String(node?.provisionerImageTag || "").trim();
  const running = parse(tag);
  if (!running) {
    if (gate.allowUnversioned) return "";
    return `Provisioner ${tag || "version unknown"}; app variants need ${gate.min} or later, update the node`;
  }
  return before(running, min) ? `Provisioner ${tag}; app variants need ${gate.min} or later, update the node` : "";
}

// Whether a workflow step runs a variant other than its version's default:
// one it names that isn't the default (an app not known here counts, as the
// server would decide).
export function runsNonDefaultVariant(step, app) {
  if (!step?.variant) return false;
  if (!app) return true;
  return step.variant !== defaultVariant(app, step.tag);
}

/*
  The gate's settings, from workflow-service's config: GET
  {api2}/compute/workflows/config, expected as
  { variants: { minProvisionerVersion, allowUnversionedProvisioner } }.
  Read once per page load; where it isn't served (yet), the gate is off here
  and the server's 422 says why instead.
*/
let pending = null;
export function fetchVariantGate(api2Url, getToken, fetchFn = globalThis.fetch) {
  if (pending) return pending;
  pending = (async () => {
    try {
      const resp = await fetchFn(`${api2Url}/compute/workflows/config`, {
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!resp.ok) return { min: "", allowUnversioned: false };
      const body = await resp.json();
      const v = body?.variants || {};
      return { min: v.minProvisionerVersion || "", allowUnversioned: v.allowUnversionedProvisioner === true };
    } catch {
      return { min: "", allowUnversioned: false };
    }
  })();
  return pending;
}

// For tests: forget the config read.
export const resetVariantGate = () => {
  pending = null;
};
