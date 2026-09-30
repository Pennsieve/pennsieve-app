import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/downloadService', () => ({
  downloadServiceUrl: vi.fn(),
  getFileUrl: vi.fn(),
}))
vi.mock('vue3-clipboard', () => ({ copyText: vi.fn((text, container, done) => done()) }))

import BfDatasetFiles from './BfDatasetFiles.vue'
import { downloadServiceUrl, getFileUrl } from '@/utils/downloadService'
import { copyText } from 'vue3-clipboard'
import EventBus from '../../../utils/event-bus'

const { getPresignedUrl, copyLinkViaService } = BfDatasetFiles.methods

const file = { content: { id: 'N:package:1', nodeId: 'N:package:1', datasetNodeId: 'N:dataset:1' } }

function component() {
  return { $route: { params: { datasetId: 'N:dataset:1' } }, copyLinkViaService }
}

class ServiceError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

describe('BfDatasetFiles copy link', () => {
  let emit

  beforeEach(() => {
    vi.clearAllMocks()
    emit = vi.spyOn(EventBus, '$emit')
    downloadServiceUrl.mockReturnValue('https://api2.pennsieve.net/downloads')
  })

  it('copies a download-service link, not a Bitly one', async () => {
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString()
    getFileUrl.mockResolvedValue({ url: 'https://s3/signed', expiresAt })
    await getPresignedUrl.call(component(), file)
    await vi.waitFor(() => expect(copyText).toHaveBeenCalled())
    expect(getFileUrl).toHaveBeenCalledWith({ datasetId: 'N:dataset:1', packageId: 'N:package:1' })
    expect(copyText.mock.calls[0][0]).toBe('https://s3/signed')
    expect(emit).toHaveBeenCalledWith('toast', {
      detail: { type: 'success', msg: 'Link to file copied to clipboard. It works for 15 minutes.' },
    })
  })

  it('explains a package with several files', async () => {
    getFileUrl.mockRejectedValue(new ServiceError(400, 'this package has several files'))
    await copyLinkViaService.call(component(), file)
    expect(copyText).not.toHaveBeenCalled()
    expect(emit.mock.calls[0][1].detail.type).toBe('info')
  })

  it('reports other failures', async () => {
    getFileUrl.mockRejectedValue(new ServiceError(500, 'could not create a link'))
    await copyLinkViaService.call(component(), file)
    expect(emit.mock.calls[0][1].detail).toEqual({ type: 'error', msg: 'Unable to create a link to this file' })
  })
})
