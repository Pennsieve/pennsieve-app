import { describe, it, expect, vi } from 'vitest'
import {
  clientHeader,
  downloadServiceUrl,
  downloadServiceRequest,
  getFileUrl,
  createArchive,
  getArchive,
  listArchives,
  getArchiveUrl,
  deleteArchive,
  DownloadServiceError,
} from './downloadService'
import dev from '../site-config/dev.json'
import prod from '../site-config/prod.json'

const config = { downloadServiceUrl: 'https://api2.pennsieve.net/downloads/' }
const getToken = () => Promise.resolve('tok')

function respond(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('downloadServiceUrl', () => {
  it('is set where the platform has download-service', () => {
    expect(downloadServiceUrl(dev)).toBe('https://api2.pennsieve.net/downloads')
  })

  it('is empty where it has none yet, so callers keep their old path', () => {
    expect(downloadServiceUrl(prod)).toBe('')
  })

  it('drops a trailing slash', () => {
    expect(downloadServiceUrl(config)).toBe('https://api2.pennsieve.net/downloads')
  })
})

describe('downloadServiceRequest', () => {
  it('sends the token in a header, never in the URL', async () => {
    const fetchFn = respond(200, {})
    await downloadServiceRequest('/archives', { config, getToken, fetchFn })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api2.pennsieve.net/downloads/archives')
    expect(url).not.toContain('tok')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.headers['X-Pennsieve-Client']).toBe(clientHeader)
    expect(clientHeader).toMatch(/^pennsieve-app\/\S+$/)
  })

  it('names the dataset in the query, as the dataset authorizer requires', async () => {
    const fetchFn = respond(200, {})
    await downloadServiceRequest('/files/url', { method: 'POST', datasetId: 'N:dataset:1', body: {}, config, getToken, fetchFn })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api2.pennsieve.net/downloads/files/url?dataset_id=N%3Adataset%3A1')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('turns an error response into a DownloadServiceError with its status and message', async () => {
    const fetchFn = respond(403, { message: 'this file can\'t be opened: it did not pass the malware scan' })
    const err = await downloadServiceRequest('/files/url', { method: 'POST', body: {}, config, getToken, fetchFn }).catch((e) => e)
    expect(err).toBeInstanceOf(DownloadServiceError)
    expect(err.status).toBe(403)
    expect(err.message).toContain('malware scan')
  })

  it('refuses to run where the service is not configured', async () => {
    const fetchFn = respond(200, {})
    await expect(downloadServiceRequest('/archives', { config: {}, getToken, fetchFn })).rejects.toThrow('not configured')
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('getFileUrl', () => {
  it('asks for a download link by default', async () => {
    const fetchFn = respond(200, { url: 'https://s3/x', expiresAt: 'later', fileName: 'a.csv', size: 3 })
    const link = await getFileUrl({ datasetId: 'N:dataset:1', packageId: 'N:package:1' }, { config, getToken, fetchFn })
    expect(link.url).toBe('https://s3/x')
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ packageId: 'N:package:1', purpose: 'download' })
  })

  it('passes a file id and a view purpose through', async () => {
    const fetchFn = respond(200, {})
    await getFileUrl({ datasetId: 'N:dataset:1', packageId: 'N:package:1', fileId: 7, purpose: 'view' }, { config, getToken, fetchFn })
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ packageId: 'N:package:1', fileId: 7, purpose: 'view' })
  })
})

describe('archives', () => {
  it('creates an archive of a selection', async () => {
    const fetchFn = respond(202, { id: 'd1', status: 'QUEUED' })
    const d = await createArchive(
      { datasetId: 'N:dataset:1', nodeIds: ['N:collection:1'], fileIds: [], archiveName: 'study' },
      { config, getToken, fetchFn },
    )
    expect(d.id).toBe('d1')
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api2.pennsieve.net/downloads/archives?dataset_id=N%3Adataset%3A1')
    expect(JSON.parse(init.body)).toEqual({ nodeIds: ['N:collection:1'], notify: 'auto', archiveName: 'study' })
  })

  it('reaches an archive through its dataset, and lists by workspace, never the preferred workspace', async () => {
    const fetchFn = respond(200, { downloads: [{ id: 'd1' }], url: 'https://s3/zip' })
    await getArchive({ id: 'd1', datasetId: 'N:dataset:1' }, { config, getToken, fetchFn })
    expect(await listArchives({ organizationId: 'N:organization:1' }, { config, getToken, fetchFn })).toEqual([{ id: 'd1' }])
    await getArchiveUrl({ id: 'd1', datasetId: 'N:dataset:1' }, { config, getToken, fetchFn })
    await deleteArchive({ id: 'd1', datasetId: 'N:dataset:1' }, { config, getToken, fetchFn })
    expect(fetchFn.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'GET https://api2.pennsieve.net/downloads/archives/d1?dataset_id=N%3Adataset%3A1',
      'GET https://api2.pennsieve.net/downloads/archives?organization_id=N%3Aorganization%3A1',
      'GET https://api2.pennsieve.net/downloads/archives/d1/url?dataset_id=N%3Adataset%3A1',
      'DELETE https://api2.pennsieve.net/downloads/archives/d1?dataset_id=N%3Adataset%3A1',
    ])
  })

  it('treats an empty response (204) as done', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 204, json: () => Promise.reject(new Error('no body')) })
    expect(await deleteArchive({ id: 'd1', datasetId: 'N:dataset:1' }, { config, getToken, fetchFn })).toEqual({})
  })
})
