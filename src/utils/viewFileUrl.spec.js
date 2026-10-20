import { describe, it, expect, vi } from 'vitest'
import { viewFileUrl, isSourceFile } from './viewFileUrl'
import { DownloadServiceError } from './downloadService'

const config = {
  apiUrl: 'https://api.pennsieve.net',
  downloadServiceUrl: 'https://api2.pennsieve.net/downloads',
}
const getToken = () => Promise.resolve('tok')
const source = { content: { id: 11, objectType: 'source', name: 'a.pdf' } }
const view = { content: { id: 12, objectType: 'view', name: 'a.pdf' } }

function respond(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('isSourceFile', () => {
  it('reads objectType in any case', () => {
    expect(isSourceFile(source)).toBe(true)
    expect(isSourceFile({ content: { objectType: 'Source' } })).toBe(true)
    expect(isSourceFile(view)).toBe(false)
    expect(isSourceFile(undefined)).toBe(false)
  })
})

describe('viewFileUrl', () => {
  it('links a source file through download-service as a view', async () => {
    const fetchFn = respond(200, { url: 'https://s3/view', expiresAt: 'x', fileName: 'a.pdf', size: 1 })
    const url = await viewFileUrl({ datasetId: 'N:dataset:1', packageId: 'N:package:2', file: source }, { config, getToken, fetchFn })
    expect(url).toBe('https://s3/view')
    const [reqUrl, init] = fetchFn.mock.calls[0]
    expect(reqUrl).toBe('https://api2.pennsieve.net/downloads/files/url?dataset_id=N%3Adataset%3A1')
    expect(JSON.parse(init.body)).toEqual({ packageId: 'N:package:2', purpose: 'view' })
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('rejects with scan_pending while the file is being scanned', async () => {
    const fetchFn = respond(409, { code: 'scan_pending', scanStatus: 'scanning', message: 'still being scanned' })
    const p = viewFileUrl({ datasetId: 'N:dataset:1', packageId: 'N:package:2', file: source }, { config, getToken, fetchFn })
    await expect(p).rejects.toBeInstanceOf(DownloadServiceError)
    await expect(p).rejects.toMatchObject({ status: 409, code: 'scan_pending' })
  })

  it("keeps pennsieve-api's link for a derived view file", async () => {
    const fetchFn = respond(200, { url: 'https://s3/legacy' })
    const url = await viewFileUrl({ datasetId: 'N:dataset:1', packageId: 'N:package:2', file: view }, { config, getToken, fetchFn })
    expect(url).toBe('https://s3/legacy')
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.pennsieve.net/packages/N:package:2/files/12?api_key=tok')
  })

  it("keeps pennsieve-api's link where the site has no download-service", async () => {
    const fetchFn = respond(200, { url: 'https://s3/legacy' })
    await viewFileUrl({ datasetId: 'N:dataset:1', packageId: 'N:package:2', file: source }, { config: { apiUrl: config.apiUrl }, getToken, fetchFn })
    expect(fetchFn.mock.calls[0][0]).toContain('/packages/N:package:2/files/11')
  })

  it("keeps pennsieve-api's link without a dataset id", async () => {
    const fetchFn = respond(200, { url: 'https://s3/legacy' })
    await viewFileUrl({ packageId: 'N:package:2', file: source }, { config, getToken, fetchFn })
    expect(fetchFn.mock.calls[0][0]).toContain('/packages/N:package:2/files/11')
  })

  it("throws when pennsieve-api refuses", async () => {
    const fetchFn = respond(403, {})
    await expect(viewFileUrl({ packageId: 'N:package:2', file: view }, { config, getToken, fetchFn })).rejects.toThrow('403')
  })
})
