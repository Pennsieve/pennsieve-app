// Data portals built on Pennsieve Discover whose published datasets are also
// in the Registry of Open Data on AWS: SPARC (with RE-JOIN, PRECISION and
// the other datasets it publishes) and Epilepsy.Science. Their bucket holds
// one folder per dataset (704/), at its latest version: its files/, a
// banner and a manifest.json that describes it. The bucket's folders are
// the portal's datasets; their manifests name them, and Discover's search
// finds them by words. A notebook takes one as a view of its folder, like
// any Open Data dataset.
import { useSendXhr } from '@/mixins/request/request_composable'
import { listOpenDataFolder } from '@/utils/viewsService'

// registry: the Open Data catalog's entry (registry.opendata.aws/<name>);
// bucket: its public bucket, read for the manifests and banners.
export const OPEN_DATA_PORTALS = {
  sparc: {
    registry: 'sparc',
    bucket: 'sparc-prod-aod-discover-publish50-use1',
    url: 'https://sparc.science',
  },
  epilepsyScience: {
    registry: 'epilepsy-science',
    bucket: 'edots-prod-aod-discover-publish50-use1',
    url: 'https://epilepsy.science',
  },
}

// The buckets hold production's datasets, so Discover's production search
// finds them, whichever environment the app runs in.
export const PORTAL_DISCOVER_URL = 'https://api.pennsieve.io/discover'

const bucketUrl = (portal, path) => `https://${OPEN_DATA_PORTALS[portal].bucket}.s3.amazonaws.com/${path}`
export const portalBannerUrl = (portal, id) => bucketUrl(portal, `${id}/banner.jpg`)

// The portal's dataset ids, newest first: its bucket's numbered folders.
export async function portalDatasetIds(portal, { listFolder = listOpenDataFolder } = {}) {
  const { folders = [] } = await listFolder({ dataset: OPEN_DATA_PORTALS[portal].registry })
  return folders
    .map((f) => Number(String(f).replace(/\/$/, '')))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => b - a)
}

// The ids of the portal's datasets that match query, best first: Discover's
// search, kept to those in the bucket (ids).
export async function searchPortal(query, ids, { sendXhr = useSendXhr } = {}) {
  const words = query.trim()
  if (!words) return ids
  const inBucket = new Set(ids)
  // A dataset's id finds it too.
  const byId = /^\d+$/.test(words) && inBucket.has(Number(words)) ? [Number(words)] : []
  const response = await sendXhr(`${PORTAL_DISCOVER_URL}/search/datasets?limit=500&offset=0&query=${encodeURIComponent(words)}`, {
    method: 'GET',
  })
  const found = (response?.datasets || []).map((d) => d.id).filter((id) => inBucket.has(id) && !byId.includes(id))
  return [...byId, ...found]
}

// The start of a manifest, enough for its description: everything before
// its file list, which can run to megabytes. Its fields come in a fixed
// order with "files" after the ones a card shows.
const MANIFEST_HEAD_BYTES = 16384

// A manifest's text up to its file list, closed as JSON; null when the
// file list doesn't start in it.
export function manifestHead(text) {
  const at = text.search(/[,\s]*"files"\s*:/)
  if (at < 0) return null
  return JSON.parse(`${text.slice(0, at)}}`)
}

// A dataset as the picker shows it, from its manifest.
export const toPortalDataset = (portal, m = {}) => ({
  id: m.pennsieveDatasetId,
  version: m.version,
  name: m.name || `Dataset ${m.pennsieveDatasetId}`,
  description: m.description || '',
  authors: authorsOf(m.contributors),
  organization: m.sourceOrganization || '',
  keywords: m.keywords || [],
  published: m.datePublished || '',
  doi: String(m['@id'] || '').replace(/^https?:\/\/doi\.org\//, ''),
  banner: portalBannerUrl(portal, m.pennsieveDatasetId),
})

// The first two contributors, then "et al.".
function authorsOf(contributors = []) {
  const names = (contributors || [])
    .map((c) => [c.first_name, c.last_name].filter(Boolean).join(' '))
    .filter(Boolean)
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')}, et al.`
}

// One dataset's description, from the start of its manifest (the whole of
// it when the start doesn't reach its file list).
export async function portalDataset(portal, id, { fetchFn = globalThis.fetch } = {}) {
  const url = bucketUrl(portal, `${id}/manifest.json`)
  const resp = await fetchFn(url, { headers: { Range: `bytes=0-${MANIFEST_HEAD_BYTES - 1}` } })
  if (!resp.ok) throw new Error(`No manifest for dataset ${id} (${resp.status})`)
  const text = await resp.text()
  let manifest = resp.status === 206 ? manifestHead(text) : JSON.parse(text)
  if (!manifest) {
    const full = await fetchFn(url)
    if (!full.ok) throw new Error(`No manifest for dataset ${id} (${full.status})`)
    manifest = await full.json()
  }
  return toPortalDataset(portal, manifest)
}
