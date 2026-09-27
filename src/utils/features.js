import * as siteConfig from '@/site-config/site.json'

// Defaults match the standard (app.pennsieve.io) deployment, so a site config
// without a `features` block keeps today's behavior.
export const FEATURE_DEFAULTS = Object.freeze({
  // Log in on the app's own /login page instead of redirecting to Discover.
  inAppLogin: false,
  // Dataset publishing to Discover.
  publishing: true,
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
