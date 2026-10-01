import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import clin from '../clin.json'

const doc = yaml.load(fs.readFileSync(path.join(__dirname, 'customHttp_clin.yml'), 'utf8'))
const headers = doc.customHeaders.flatMap((c) => c.headers)
const csp = headers.find((h) => /^content-security-policy(-report-only)?$/i.test(h.key)).value

const directive = (name) => {
  const part = csp.split(';').map((p) => p.trim()).find((p) => p.split(/\s+/)[0] === name)
  return part ? part.split(/\s+/).slice(1) : []
}

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
      clin.apiUrl, clin.api2Url, clin.downloadServiceUrl, clin.zipitUrl, clin.discoverUrl, clin.discoverZipitUrl,
      clin.timeSeriesUrl, clin.timeSeriesApi, clin.conceptsUrl, clin.bucket,
      `https://${clin.awsConfig.oauth.domain}`,
    ].filter(Boolean)
    endpoints.forEach((url) => expect(allows(connect, url), url).toBe(true))
  })

  it('lets the app open the live-update WebSocket, and nothing of Pusher', () => {
    expect(allows(directive('connect-src'), `wss://${clin.realtime.realtimeHost}/event/realtime`)).toBe(true)
    expect(csp).not.toMatch(/pusher/i)
  })

  it('lets public-dataset ZIP downloads post to zipit', () => {
    const formAction = directive('form-action')
    const zipit = clin.discoverZipitUrl || `${clin.zipitUrl}/discover`
    expect(allows(formAction, zipit), zipit).toBe(true)
  })

  it('allows presigned S3 links for downloads, images and media', () => {
    const link = 'https://sparc-prod-aod-discover-publish50-use1.s3.amazonaws.com/x'
    ;['connect-src', 'img-src', 'media-src'].forEach((d) => expect(allows(directive(d), link), d).toBe(true))
  })
})
