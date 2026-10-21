/**
 * GA4 page-view tracking.
 *
 * The measurement id comes from the per-environment site config
 * (src/site-config/{local,dev,prod,clin}.json -> site.json at build time),
 * so each environment reports to its own property and no environment can
 * silently report into another's. An empty id disables analytics entirely —
 * that is how clin is configured, because it has no property of its own and
 * must not report into production's.
 *
 * Two things this deliberately does NOT do:
 *
 *  - `send_page_view: false`. gtag's automatic page_view fires once on load;
 *    in an SPA every subsequent navigation would be invisible. Views are
 *    sent from the router hook instead, which is also the only place we can
 *    sanitise the path.
 *
 *  - report raw URLs. Pennsieve paths carry dataset, package, org and user
 *    identifiers (/datasets/N:dataset:<uuid>/files, /workspace/<id>/...).
 *    Those are customer identifiers and, on HIPAA-tier workspaces, they
 *    point at protected data — they must not leave the platform. Ids are
 *    replaced with :id so the page path stays useful as a route while
 *    carrying no record-level information.
 */

// A path SEGMENT is an identifier if it is a Pennsieve node id
// (N:dataset:<uuid>), a bare uuid, or purely numeric. Numeric ids are
// matched at any length, not >=4 digits: org ids are small (the
// pennsieve-admin org is 50) and a length threshold silently leaked them.
const NODE_ID = /^N:[a-z]+:/i
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const NUMERIC = /^\d+$/

export function sanitizePath(path) {
  const clean = String(path || '/').split('?')[0].split('#')[0]
  const out = clean
    .split('/')
    .map((seg) => (NODE_ID.test(seg) || UUID.test(seg) || NUMERIC.test(seg) ? ':id' : seg))
    .join('/')
  return out === '' ? '/' : out
}


// ---- events ---------------------------------------------------------------

let enabled = false

/**
 * Bucket a count. Exact counts are needlessly identifying in aggregate
 * ("the workspace that uploaded exactly 1,247 files") and nobody makes a
 * decision on the difference between 11 and 12.
 */
export function bucket(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return 'unknown'
  if (v === 0) return '0'
  if (v === 1) return '1'
  if (v <= 10) return '2-10'
  if (v <= 100) return '11-100'
  if (v <= 1000) return '101-1000'
  return '1000+'
}

// Parameter values must be enumerable, not free text: a label that can carry
// a dataset name or a search query is one refactor away from sending PHI to
// Google. Strings are accepted only if they look like an identifier-free
// token; anything else is dropped.
const SAFE_TOKEN = /^[a-z0-9_-]{1,40}$/i

function safeParams(params) {
  const out = {}
  for (const [k, v] of Object.entries(params || {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string' && SAFE_TOKEN.test(v)) out[k] = v
    // everything else (free text, ids, objects) is intentionally dropped
  }
  return out
}

/**
 * Send a product event. No-ops when analytics is disabled (clin, local
 * without an id) so call sites never need to check.
 */
export function trackEvent(name, params = {}) {
  if (!enabled || typeof window === 'undefined' || !window.gtag) return false
  if (!SAFE_TOKEN.test(name)) return false
  window.gtag('event', name, safeParams(params))
  return true
}

export function initAnalytics(router, measurementId) {
  if (!measurementId) return false          // unconfigured env: stay silent
  if (typeof window === 'undefined' || typeof document === 'undefined') return false

  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
  document.head.appendChild(s)

  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', measurementId, {
    send_page_view: false,
    anonymize_ip: true,
  })

  const send = (to) => {
    const page_path = sanitizePath(to.fullPath ?? to.path)
    gtag('event', 'page_view', {
      page_path,
      page_location: window.location.origin + page_path,   // never the real URL
      page_title: document.title,
    })
  }

  router.afterEach((to) => send(to))
  router.isReady().then(() => send(router.currentRoute.value)).catch(() => {})
  enabled = true
  return true
}
