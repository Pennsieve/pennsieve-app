import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/downloadService', () => ({
  downloadServiceUrl: vi.fn(),
  getFileUrl: vi.fn(),
}))
vi.mock('@/utils/triggerBrowserDownload', () => ({ triggerBrowserDownload: vi.fn() }))
vi.mock('@/composables/useGetToken', () => ({ useGetToken: vi.fn(() => Promise.resolve('tok')) }))
const start = vi.fn()
vi.mock('@/stores/downloadsStore', () => ({ useDownloadsStore: () => ({ start }) }))

import BfDownloadFile from './BfDownloadFile.vue'
import { downloadServiceUrl, getFileUrl } from '@/utils/downloadService'
import { triggerBrowserDownload } from '@/utils/triggerBrowserDownload'
import EventBus from '@/utils/event-bus'

const { tryDirectDownload, downloadViaService, downloadPackages, archiveViaService } = BfDownloadFile.methods

const pkg = {
  content: {
    id: 'N:package:1', nodeId: 'N:package:1', packageType: 'CSV', state: 'READY',
    datasetId: 'N:dataset:1', datasetNodeId: 'N:dataset:1',
  },
}

function component(overrides = {}) {
  return {
    packageDTOs: [pkg],
    fileDTOs: undefined,
    config: { apiUrl: 'https://api.pennsieve.net' },
    $route: { params: { datasetId: 'N:dataset:route' } },
    sendXhr: vi.fn(() => Promise.reject(new Error('pennsieve-api'))),
    downloadViaService,
    ...overrides,
  }
}

class ServiceError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

describe('BfDownloadFile single-file downloads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    downloadServiceUrl.mockReturnValue('https://api2.pennsieve.net/downloads')
  })

  it('gets the link from download-service, not pennsieve-api', async () => {
    getFileUrl.mockResolvedValue({ url: 'https://s3/signed' })
    const cmp = component()
    expect(await tryDirectDownload.call(cmp)).toBe(true)
    expect(getFileUrl).toHaveBeenCalledWith({ datasetId: 'N:dataset:1', packageId: 'N:package:1', fileId: undefined })
    expect(triggerBrowserDownload).toHaveBeenCalledWith('https://s3/signed')
    expect(cmp.sendXhr).not.toHaveBeenCalled()
  })

  it('passes the one file picked from a package', async () => {
    getFileUrl.mockResolvedValue({ url: 'https://s3/signed' })
    expect(await tryDirectDownload.call(component({ fileDTOs: [{ id: 42 }] }))).toBe(true)
    expect(getFileUrl.mock.calls[0][0].fileId).toBe(42)
  })

  it('leaves several picked files to the multi-file path', async () => {
    expect(await tryDirectDownload.call(component({ fileDTOs: [{ id: 1 }, { id: 2 }] }))).toBe(false)
    expect(getFileUrl).not.toHaveBeenCalled()
  })

  it('leaves a package with several files to the multi-file path', async () => {
    getFileUrl.mockRejectedValue(new ServiceError(400, 'this package has several files; pass fileId, or download it as an archive'))
    expect(await tryDirectDownload.call(component())).toBe(false)
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })

  it('shows a refusal instead of zipping the file', async () => {
    const emit = vi.spyOn(EventBus, '$emit')
    getFileUrl.mockRejectedValue(new ServiceError(403, "this file can't be opened: it did not pass the malware scan"))
    expect(await tryDirectDownload.call(component())).toBe(true)
    expect(emit).toHaveBeenCalledWith('toast', {
      detail: { type: 'error', msg: "This file can't be opened: it did not pass the malware scan" },
    })
    expect(triggerBrowserDownload).not.toHaveBeenCalled()
  })

  it('falls back to the route for the dataset id', async () => {
    getFileUrl.mockResolvedValue({ url: 'https://s3/signed' })
    const bare = { content: { id: 'N:package:1', packageType: 'CSV', state: 'READY' } }
    await tryDirectDownload.call(component({ packageDTOs: [bare] }))
    expect(getFileUrl.mock.calls[0][0].datasetId).toBe('N:dataset:route')
  })

  it('keeps the pennsieve-api path where download-service is not configured', async () => {
    downloadServiceUrl.mockReturnValue('')
    const cmp = component()
    expect(await tryDirectDownload.call(cmp)).toBe(false)
    expect(getFileUrl).not.toHaveBeenCalled()
    expect(cmp.sendXhr).toHaveBeenCalled()
  })
})

describe('BfDownloadFile archives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    downloadServiceUrl.mockReturnValue('https://api2.pennsieve.net/downloads')
  })

  function archiving(overrides = {}) {
    return component({ archiveName: 'my-study', archiveViaService, ...overrides })
  }

  it('asks download-service for an archive instead of posting to zipit', async () => {
    start.mockResolvedValue({ id: 'd1' })
    const cmp = archiving({ packageDTOs: [pkg, pkg] })
    downloadPackages.call(cmp, ['N:package:1', 'N:package:2'])
    await vi.waitFor(() => expect(start).toHaveBeenCalled())
    expect(start).toHaveBeenCalledWith({
      datasetId: 'N:dataset:1', nodeIds: ['N:package:1', 'N:package:2'], fileIds: undefined, archiveName: 'my-study',
    })
  })

  it('names a single folder or package after itself, and passes picked files', async () => {
    start.mockResolvedValue({ id: 'd1' })
    const folder = { content: { ...pkg.content, name: 'study', packageType: 'Collection' } }
    await archiveViaService.call(archiving({ packageDTOs: [folder] }), ['N:collection:1'], [4, 5])
    expect(start.mock.calls[0][0]).toMatchObject({ nodeIds: ['N:collection:1'], fileIds: [4, 5], archiveName: 'study' })
  })

  it("shows the service's reason when it refuses, such as a selection that's too large", async () => {
    const emit = vi.spyOn(EventBus, '$emit')
    start.mockRejectedValue(new ServiceError(413, 'this selection is too large to download as one archive; select fewer files or use the Pennsieve agent'))
    await archiveViaService.call(archiving(), ['N:collection:1'])
    expect(emit.mock.calls[0][1].detail).toEqual({
      type: 'error',
      msg: 'This selection is too large to download as one archive; select fewer files or use the Pennsieve agent',
    })
  })

  it('keeps a server error generic', async () => {
    const emit = vi.spyOn(EventBus, '$emit')
    start.mockRejectedValue(new ServiceError(500, 'could not prepare the download'))
    await archiveViaService.call(archiving(), ['N:collection:1'])
    expect(emit.mock.calls[0][1].detail.msg).toBe("The download couldn't be started. Try again.")
  })
})
