import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/utils/viewFileUrl', () => ({ viewFileUrl: vi.fn() }))
vi.mock('../../utils/event-bus', () => ({ default: { $emit: vi.fn() } }))

import StaticViewer from './index'
import { viewFileUrl } from '@/utils/viewFileUrl'
import EventBus from '../../utils/event-bus'
import { DownloadServiceError } from '@/utils/downloadService'
import { SCAN_POLL_MS, SCAN_POLL_LIMIT } from '@/utils/scan-status'

const { getFileUrl, onScanPending, handleGetViewerData } = StaticViewer.methods

// A viewer's `this`, with the mixin's data and methods.
function viewer() {
  const vm = {
    ...StaticViewer.data(),
    config: { apiUrl: 'https://api.pennsieve.net' },
    pkg: { content: { id: 'N:package:2', datasetNodeId: 'N:dataset:1' } },
  }
  vm.getFileUrl = getFileUrl.bind(vm)
  vm.onScanPending = onScanPending.bind(vm)
  return vm
}

const held = () => new DownloadServiceError(409, 'still being scanned', { code: 'scan_pending', scanStatus: 'scanning' })

describe('static-viewer mixin', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(viewFileUrl).mockReset()
    vi.mocked(EventBus.$emit).mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it("asks for a view link to /view's first file", async () => {
    vi.mocked(viewFileUrl).mockResolvedValue('https://s3/view')
    const vm = viewer()
    const file = { content: { id: 11, objectType: 'source' } }
    handleGetViewerData.call(vm, [file])
    await vi.waitFor(() => expect(vm.fileUrl).toBe('https://s3/view'))
    expect(vm.viewerDataId).toBe(11)
    expect(viewFileUrl).toHaveBeenCalledWith(
      { datasetId: 'N:dataset:1', packageId: 'N:package:2', file },
      { config: vm.config },
    )
  })

  it('says the file is being scanned, then retries until it is released', async () => {
    vi.mocked(viewFileUrl).mockRejectedValueOnce(held()).mockResolvedValueOnce('https://s3/view')
    const vm = viewer()
    await vm.getFileUrl()
    expect(vm.scanPending).toBe(true)
    expect(vm.fileUrl).toBe('')
    expect(EventBus.$emit).toHaveBeenCalledWith('download-scan-pending', { packageId: 'N:package:2' })

    await vi.advanceTimersByTimeAsync(SCAN_POLL_MS)
    expect(vm.fileUrl).toBe('https://s3/view')
    expect(vm.scanPending).toBe(false)
  })

  it('stops retrying after the poll limit', async () => {
    vi.mocked(viewFileUrl).mockRejectedValue(held())
    const vm = viewer()
    await vm.getFileUrl()
    for (let i = 0; i < SCAN_POLL_LIMIT + 5; i++) await vi.advanceTimersByTimeAsync(SCAN_POLL_MS)
    expect(viewFileUrl).toHaveBeenCalledTimes(SCAN_POLL_LIMIT + 1)
  })

  it('does not retry other errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(viewFileUrl).mockRejectedValue(new Error('403'))
    const vm = viewer()
    await vm.getFileUrl()
    await vi.advanceTimersByTimeAsync(SCAN_POLL_MS * 2)
    expect(viewFileUrl).toHaveBeenCalledTimes(1)
    expect(vm.scanPending).toBe(false)
  })
})
