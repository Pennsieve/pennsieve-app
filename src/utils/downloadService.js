import * as siteConfig from '@/site-config/site.json'
import { version } from '../../package.json'
import { useGetToken } from '@/composables/useGetToken'

// download-service (api2.<domain>/downloads) signs every link to save a
// dataset file. The token travels in the Authorization header, never in a
// URL, and every request is recorded in the download metrics.

// Labels this client in the download metrics. It never affects access.
export const clientHeader = `pennsieve-app/${version}`

// The service's base URL, or '' where the platform has none yet: callers
// then keep their previous path.
export function downloadServiceUrl(config = siteConfig) {
  return (config.downloadServiceUrl || '').replace(/\/+$/, '')
}

export class DownloadServiceError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'DownloadServiceError'
    this.status = status
  }
}

export async function downloadServiceRequest(path, {
  method = 'GET',
  datasetId,
  body,
  config = siteConfig,
  getToken = useGetToken,
  fetchFn = globalThis.fetch,
} = {}) {
  const base = downloadServiceUrl(config)
  if (!base) throw new Error('download-service is not configured for this site')
  const url = new URL(`${base}${path}`)
  if (datasetId) url.searchParams.set('dataset_id', datasetId)

  const headers = {
    Authorization: `Bearer ${await getToken()}`,
    'X-Pennsieve-Client': clientHeader,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const resp = await fetchFn(url.toString(), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new DownloadServiceError(resp.status, data.message || `download-service responded ${resp.status}`)
  }
  return data
}

// A signed link to one file: to save it (`download`), or to open it in a
// viewer (`view`, recorded apart from downloads). A package with several
// files needs fileId; without it the service answers 400.
//
// Resolves to { url, expiresAt, fileName, size }.
export function getFileUrl({ datasetId, packageId, fileId, purpose = 'download' }, options = {}) {
  const body = { packageId, purpose }
  if (fileId) body.fileId = fileId
  return downloadServiceRequest('/files/url', { ...options, method: 'POST', datasetId, body })
}

// Archives: a selection zipped by the service, fetched when ready. Records
// carry id, status (QUEUED, RUNNING, READY, FAILED, CANCELLED), archiveName,
// fileCount, totalBytes, filesDone, bytesDone, datasetNodeId, error and
// expiresAt.

// notify: 'auto' emails the requester only if they aren't watching when it
// finishes; 'email' always; 'none' never.
export function createArchive({ datasetId, nodeIds, fileIds, archiveName, notify = 'auto' }, options = {}) {
  const body = { nodeIds, notify }
  if (fileIds?.length) body.fileIds = fileIds
  if (archiveName) body.archiveName = archiveName
  return downloadServiceRequest('/archives', { ...options, method: 'POST', datasetId, body })
}

// Polling an active archive also tells the service the requester is
// watching, so it skips the email.
export function getArchive(id, options = {}) {
  return downloadServiceRequest(`/archives/${encodeURIComponent(id)}`, options)
}

export async function listArchives(options = {}) {
  const data = await downloadServiceRequest('/archives', options)
  return data.downloads || []
}

// A fresh signed link to a finished archive. The dataset lets the service
// check the requester can still see it.
export function getArchiveUrl({ id, datasetId }, options = {}) {
  return downloadServiceRequest(`/archives/${encodeURIComponent(id)}/url`, { ...options, datasetId })
}

// Cancels an active archive (resolving to its CANCELLED record), or deletes
// a finished one (resolving to {}).
export function deleteArchive(id, options = {}) {
  return downloadServiceRequest(`/archives/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' })
}
