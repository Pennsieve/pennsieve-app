/*
  The newest provisioner release this environment's services support
  (site config maxProvisionerVersion). account-service offers the newest
  release on Docker Hub, which every environment shares, so a release that
  needs services not yet deployed here would otherwise be offered as an
  update, and used for new nodes. Without a cap, the offered version is used.
*/
import * as siteConfig from '@/site-config/site.json'

const parse = (tag) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(tag || '').trim())
  return m ? m.slice(1).map(Number) : null
}

// a < b, for vX.Y.Z tags; false when either isn't one.
export const versionBefore = (a, b) => {
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return false
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i]
  }
  return false
}

// The version to offer: the newest release, at most the cap. With a cap and
// no known release, the cap (so a new node isn't given the newest release).
export const cappedVersion = (latest, cap = siteConfig.maxProvisionerVersion) => {
  if (!cap) return latest || null
  if (!latest || versionBefore(cap, latest) || !parse(latest)) return cap
  return latest
}

// A node as listed, with its offered version capped: an update is offered
// only when the node runs an older release than that, or no release
// ("latest" or none).
export const capNodeVersion = (node, cap = siteConfig.maxProvisionerVersion) => {
  if (!cap || !node || typeof node !== 'object') return node
  const latestVersion = cappedVersion(node.latestVersion, cap)
  const running = node.provisionerImageTag
  const updateAvailable = node.updateAvailable === true && (!parse(running) || versionBefore(running, latestVersion))
  return { ...node, latestVersion, updateAvailable }
}
