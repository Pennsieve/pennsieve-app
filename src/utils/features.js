import * as siteConfig from '@/site-config/site.json'

// Defaults match the standard (app.pennsieve.io) deployment, so a site config
// without a `features` block keeps today's behavior.
export const FEATURE_DEFAULTS = Object.freeze({
  // Log in on the app's own /login page instead of redirecting to Discover.
  inAppLogin: false,
  // Dataset publishing to Discover.
  publishing: true,
  // "Open with Office 365": Microsoft's public Office viewer fetches the file
  // from a signed link. Off where files may hold ePHI (POAM-074).
  office365Viewer: true,
  // The workflow builder saves inputs and outputs (a workflow's interface)
  // instead of data-source and data-target nodes. On only where
  // workflow-service supports them (Pennsieve/workflow-service#103).
  workflowInterface: false,
})

export function resolveFeatures(features = {}) {
  return Object.freeze({ ...FEATURE_DEFAULTS, ...features })
}

const features = resolveFeatures(siteConfig.features)

export function isFeatureEnabled(name) {
  if (!(name in FEATURE_DEFAULTS)) {
    throw new Error(`Unknown feature flag: ${name}`)
  }
  return features[name] === true
}
