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
  return true
}
