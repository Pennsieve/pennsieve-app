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
  tags: d.tags || [],
  license: d.license || '',
  datasetType: d.datasetType || '',
  publishedAt: d.versionPublishedAt || d.updatedAt || '',
})

// Up to 25 datasets matching query, or the latest research datasets without
// one.
// A page of published datasets: Discover's search for a query, else its
// newest research datasets. { datasets, totalCount }: how many the query
// matches in all, for paging through them (offset).
export async function pagePublicDatasets({ query = '', offset = 0, limit = 25 } = {}, { sendXhr = useSendXhr, config = siteConfig } = {}) {
  const base = config.discoverUrl
  const url = query
    ? `${base}/search/datasets?limit=${limit}&offset=${offset}&query=${encodeURIComponent(query)}`
    : `${base}/datasets?limit=${limit}&offset=${offset}&datasetType=research&embargo=false`
  const response = await sendXhr(url, { method: 'GET' })
  return {
    datasets: (response?.datasets || []).map(toPublicDataset).filter((d) => !d.embargo),
    totalCount: response?.totalCount ?? 0,
  }
}

// The first page of published datasets for a query, embargoed ones left out.
export async function searchPublicDatasets(query = '', options = {}) {
  return (await pagePublicDatasets({ query }, options)).datasets
}

// One published dataset version (the latest without one), as the pickers
// offer it.
export async function fetchPublicDataset(id, version = null, { sendXhr = useSendXhr, config = siteConfig } = {}) {
  const base = `${config.discoverUrl}/datasets/${encodeURIComponent(id)}`
  const url = version != null ? `${base}/versions/${encodeURIComponent(version)}` : base
  return toPublicDataset(await sendXhr(url, { method: 'GET' }))
}

// Every openly published dataset matching query (all without one), in
// Discover's order (orderBy: relevance, date, name or size): the public
// datasets page filters and pages them itself. Code releases are left out.
export async function listPublicDatasets(
  { query = '', orderBy = 'date', orderDirection = 'desc' } = {},
  { sendXhr = useSendXhr, config = siteConfig } = {}
) {
  const params = new URLSearchParams({ limit: 1000, offset: 0, embargo: false, orderBy, orderDirection })
  if (query) params.set('query', query)
  const response = await sendXhr(`${config.discoverUrl}/search/datasets?${params.toString()}`, { method: 'GET' })
  return (response?.datasets || [])
    .map(toPublicDataset)
    .filter((d) => !d.embargo && d.datasetType !== 'release')
}

// Where a published dataset version opens in a notebook: My Workspace's
// notebook launcher, its data already chosen (NotebooksOverview's
// ?publicDataset).
export const notebookRoute = (d) => ({
  name: 'my-notebooks',
  query: { publicDataset: d.id, ...(d.version != null && { version: d.version }) },
})

// How many openly published research datasets Discover has.
export async function countPublicDatasets({ sendXhr = useSendXhr, config = siteConfig } = {}) {
  const response = await sendXhr(`${config.discoverUrl}/datasets?limit=1&offset=0&datasetType=research&embargo=false`, { method: 'GET' })
  return response?.totalCount ?? null
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

// The metadata models a published version carries records of: the folder
// names under metadata/models, sorted; none for a version without a
// metadata export (its folder doesn't exist).
export async function listPublicModels({ id, version }, options = {}) {
  try {
    const { files } = await browsePublicFiles({ id, version, path: 'metadata/models', limit: 1000 }, options)
    return files
      .filter((f) => f.type === 'Directory')
      .map((f) => f.name)
      .sort()
  } catch (err) {
    // A version without a metadata export has no such folder (404); anything
    // else is worth seeing.
    if (err?.status !== 404 && err?.response?.status !== 404) console.warn('[public datasets] models:', err?.message || err)
    return []
  }
}
