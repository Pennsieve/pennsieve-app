import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import clin from '../clin.json'

const doc = yaml.load(fs.readFileSync(path.join(__dirname, 'customHttp_clin.yml'), 'utf8'))
const headers = doc.customHeaders.flatMap((c) => c.headers)
const csp = headers.find((h) => /^content-security-policy$/i.test(h.key)).value
const reportOnly = headers.find((h) => /^content-security-policy-report-only$/i.test(h.key)).value

const directives = (policy) =>
  Object.fromEntries(
    policy.split(';').map((p) => p.trim().split(/\s+/)).filter((a) => a[0]).map((a) => [a[0], a.slice(1)])
  )
const directive = (name) => directives(csp)[name] || []

// A CSP source like https://*.s3.amazonaws.com or https://api.pennsieve.ai.
const allows = (sources, url) => {
  const { protocol, host } = new URL(url)
  return sources.some((s) => {
    const m = s.match(/^([a-z]+:)\/\/([^/]+)/)
    if (!m || m[1] !== protocol) return false
    const pattern = m[2]
    return pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern
  })
}

describe('clin custom headers', () => {
  // Amplify drops a header whose value has a line break; the previous file's
  // CSP was folded with newlines and was never served.
  it('keeps every header value on one line', () => {
    headers.forEach((h) => expect(h.value, h.key).not.toMatch(/\n/))
  })

  it('carries no stale pennsieve.org platform hosts', () => {
    expect(csp).not.toMatch(/pennsieve\.org/)
  })

  it('lets the app reach every endpoint in its site config', () => {
    const connect = directive('connect-src')
    const endpoints = [
      clin.apiUrl, clin.api2Url, clin.downloadServiceUrl, clin.discoverUrl, clin.discoverDownloadsUrl,
      clin.timeSeriesUrl, clin.timeSeriesApi, clin.conceptsUrl, clin.bucket,
      `https://${clin.awsConfig.oauth.domain}`,
    ].filter(Boolean)
    endpoints.forEach((url) => expect(allows(connect, url), url).toBe(true))
  })

  it('lets the app open the live-update WebSocket, and nothing of Pusher', () => {
    expect(allows(directive('connect-src'), `wss://${clin.realtime.realtimeHost}/event/realtime`)).toBe(true)
    expect(csp).not.toMatch(/pusher/i)
  })

  it('posts forms to nothing of prod: public-dataset downloads no longer go through zipit', () => {
    expect(allows(directive('form-action'), 'https://api.pennsieve.io/zipit/discover')).toBe(false)
  })

  // The viewer receives the open dataset's CloudFront signing params.
  it('frames the clin orthogonal viewer and nothing of dev', () => {
    expect(allows(directive('frame-src'), clin.neuroglancerUrl)).toBe(true)
    expect(clin.neuroglancerUrl).not.toMatch(/pennsieve\.net/)
    expect(directive('frame-src').join(' ')).not.toMatch(/pennsieve\.net/)
  })

  it('allows presigned S3 links for downloads, images and media', () => {
    const link = 'https://sparc-prod-aod-discover-publish50-use1.s3.amazonaws.com/x'
    ;['connect-src', 'img-src', 'media-src'].forEach((d) => expect(allows(directive(d), link), d).toBe(true))
  })

  // POAM-006: only the third parties clin actually loads.
  it('carries no analytics, telemetry or retired third parties', () => {
    ;[
      /polyfill\.io/, /googletagmanager/, /google-analytics/, /doubleclick/, /getsentry/, /prodpad/,
      /newrelic|nr-data/, /mapbox|maptiler|tilehosting|maps\.g/, /jquery|cdnjs|bootstrapcdn|fontawesome/,
      /youtube|vimeo|wistia/, /gravatar/,
    ].forEach((re) => {
      expect(csp, String(re)).not.toMatch(re)
      expect(reportOnly, String(re)).not.toMatch(re)
    })
    expect(clin.googleAnalytics).toBeFalsy()
  })

  it('limits Google to reCAPTCHA paths', () => {
    const google = Object.values(directives(csp)).flat().filter((s) => /google\.com|gstatic\.com/.test(s))
    google.filter((s) => !/fonts\./.test(s)).forEach((s) => expect(s).toMatch(/\/recaptcha\/$/))
  })

  // The Report-Only policy is the next step: the same, without inline or data: scripts.
  it('report-only policy is the enforced one minus inline and data: scripts', () => {
    const enforced = directives(csp)
    const next = directives(reportOnly)
    expect(Object.keys(next)).toEqual(Object.keys(enforced))
    Object.keys(enforced).forEach((name) => {
      const want = name === 'script-src'
        ? enforced[name].filter((s) => s !== "'unsafe-inline'" && s !== 'data:')
        : enforced[name]
      expect(next[name], name).toEqual(want)
    })
  })

  it('index.html has no inline scripts', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../../index.html'), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
    const scripts = html.match(/<script\b[^>]*>/g) || []
    scripts.forEach((tag) => expect(tag, tag).toMatch(/\ssrc=/))
  })
})
