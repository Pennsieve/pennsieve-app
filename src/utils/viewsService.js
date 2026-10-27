import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'

// views-service (api2.<domain>/views) keeps a user's dataset views: an
// RO-Crate of a published dataset version's files. A notebook run takes a
// view as its input; the session downloads the files the user picks.
//
// In v0 a view is always a whole published version, and the app keeps views
// out of sight: picking a public dataset reuses the user's view of that
// version, or creates one.

// The service's base URL, or '' where the platform has none yet: the app
// then offers no public dataset inputs.
export function viewsServiceUrl(config = siteConfig) {
  return (config.viewsServiceUrl || '').replace(/\/+$/, '')
}

export class ViewsServiceError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ViewsServiceError'
    this.status = status
  }
}

export async function viewsRequest(path, {
  method = 'GET',
  body,
  config = siteConfig,
  getToken = useGetToken,
  fetchFn = globalThis.fetch,
} = {}) {
  const base = viewsServiceUrl(config)
  if (!base) throw new Error('views-service is not configured for this site')
  const headers = { Authorization: `Bearer ${await getToken()}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const resp = await fetchFn(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new ViewsServiceError(resp.status, data.message || `views-service responded ${resp.status}`)
  }
  return data
}

// The user's views at their latest versions, newest first. Each is
// { id, version, name, createdAt, entryCount, totalSize, sources: [{ datasetId, version, name, doi }] }.
export async function listMyViews(options = {}) {
  const { views } = await viewsRequest('/me', options)
  return views || []
}

// The user's view of exactly one published dataset version, or a new one.
// Matching on the source alone is right while the app only makes views of
// whole versions; once views can select folders it no longer is.
export async function viewForDataset({ datasetId, version, name }, options = {}) {
  const existing = (await listMyViews(options)).find(
    (v) =>
      v.sources?.length === 1 &&
      v.sources[0].datasetId === datasetId &&
      v.sources[0].version === version
  )
  if (existing) return existing
  return viewsRequest('/me', {
    ...options,
    method: 'POST',
    body: { name: `${name} (version ${version})`, datasetId, version },
  })
}

// A view as a run's data source.
export function viewDataSource(view) {
  return { kind: 'viewVersion', viewId: view.id, viewVersion: view.version }
}

// A view at its latest version (the summary listMyViews gives).
export async function getView(viewId, options = {}) {
  const { view } = await viewsRequest(`/${encodeURIComponent(viewId)}`, options)
  return view
}

// Every entry of a view version, read a page at a time. Each entry has
// cratePath (where the file goes, below the run's input folder) and size.
const ENTRIES_PAGE = 1000

export async function listEntries(viewId, version, options = {}) {
  const entries = []
  for (let offset = 0; ; offset += ENTRIES_PAGE) {
    const page = await viewsRequest(
      `/${encodeURIComponent(viewId)}/versions/${version}/entries?offset=${offset}&limit=${ENTRIES_PAGE}`,
      options
    )
    entries.push(...(page.entries || []))
    if (!page.entries?.length || entries.length >= page.totalCount) return entries
  }
}

// A run's input from public files: the files and folders picked from one or
// more published dataset versions, as one view kept only for the run
// (lifecycle "run": hidden from the user's views, and removed after 30
// days; the run keeps its crate with its provenance). Each pick is
// { datasetId, version, path }; picks of one version become one source.
export function runViewSources(picks) {
  const byVersion = new Map()
  for (const p of picks || []) {
    const key = `${p.datasetId}:${p.version}`
    if (!byVersion.has(key)) byVersion.set(key, { datasetId: p.datasetId, version: p.version, paths: [] })
    const paths = byVersion.get(key).paths
    if (!paths.includes(p.path)) paths.push(p.path)
  }
  return [...byVersion.values()]
}

export async function createRunView({ name, picks }, options = {}) {
  return viewsRequest('/me', {
    ...options,
    method: 'POST',
    body: { name, sources: runViewSources(picks), lifecycle: 'run' },
  })
}
