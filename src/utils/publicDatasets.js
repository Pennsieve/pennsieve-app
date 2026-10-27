import * as siteConfig from '@/site-config/site.json'
import { useSendXhr } from '@/mixins/request/request_composable'

// Published datasets as the app's pickers offer them: found through Discover,
// read anonymously as on the public dataset pages, and only openly published
// versions (views take no embargoed ones).

// The first two contributors, then "et al.": enough to tell datasets apart.
export const authorsLine = (contributors = []) => {
  const names = (contributors || [])
    .map((c) => [c.firstName, c.lastName].filter(Boolean).join(' '))
    .filter(Boolean)
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')}, et al.`
}

export const toPublicDataset = (d) => ({
  id: d.id,
  name: d.name,
  version: d.version,
  doi: d.doi,
  fileCount: d.fileCount || 0,
  size: d.size || 0,
  description: d.description || '',
  banner: d.banner || '',
  organizationName: d.organizationName || '',
  authors: authorsLine(d.contributors),
  embargo: !!d.embargo,
})

// Up to 25 datasets matching query, or the latest research datasets without
// one.
export async function searchPublicDatasets(query = '', { sendXhr = useSendXhr, config = siteConfig } = {}) {
  const base = config.discoverUrl
  const url = query
    ? `${base}/search/datasets?limit=25&offset=0&query=${encodeURIComponent(query)}`
    : `${base}/datasets?limit=25&offset=0&datasetType=research&embargo=false`
  const response = await sendXhr(url, { method: 'GET' })
  return (response?.datasets || []).map(toPublicDataset).filter((d) => !d.embargo)
}

// A folder of a published version, a page at a time: { files, totalCount },
// each file { name, path, type ("Directory" for a folder), size, fileType }.
export async function browsePublicFiles({ id, version, path = '', limit = 500, offset = 0 }, { sendXhr = useSendXhr, config = siteConfig } = {}) {
  const params = new URLSearchParams({ limit, offset })
  if (path) params.set('path', path)
  const response = await sendXhr(
    `${config.discoverUrl}/datasets/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}/files/browse?${params.toString()}`,
    { method: 'GET' }
  )
  return { files: response?.files || [], totalCount: response?.totalCount || 0 }
}
