import * as siteConfig from '@/site-config/site.json'

// A user's token belongs to this platform's API. Discover can be another
// platform's: clin publishes nothing and browses the prod catalogue at
// api.pennsieve.io. Then Discover is called anonymously — its public
// endpoints need no token, prod would reject this platform's token, and a
// credential should never leave the environment that issued it.
export function discoverSharesApi(config = siteConfig) {
  try {
    return new URL(config.discoverUrl).origin === new URL(config.apiUrl).origin
  } catch {
    return false
  }
}

// `url` with the user's token attached, only when Discover is this platform's.
export function withDiscoverAuth(url, token, config = siteConfig) {
  if (!token || !discoverSharesApi(config)) return url
  return `${url}${url.includes('?') ? '&' : '?'}api_key=${token}`
}

// zipit's Discover download endpoint (POST /discover), on the platform that
// hosts that Discover: `discoverZipitUrl` when a config points Discover
// elsewhere, otherwise this platform's zipit.
export function discoverZipitUrl(config = siteConfig) {
  return config.discoverZipitUrl || `${config.zipitUrl}/discover`
}
