import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'

vi.mock('@pennsieve-viz/core', () => ({ CSVViewer: { name: 'CSVViewer', props: ['srcUrl', 'fileType'], template: '<div />' } }))
vi.mock('@/utils/viewFileUrl', () => ({ viewFileUrl: vi.fn() }))
vi.mock('@/utils/event-bus', () => ({ default: { $emit: vi.fn() } }))
vi.mock('@/composables/useGetToken', () => ({ useGetToken: vi.fn().mockResolvedValue('a.jwt.token') }))

import CSVViewerWrapper from './CSVViewerWrapper.vue'
import { viewFileUrl } from '@/utils/viewFileUrl'
import EventBus from '@/utils/event-bus'
import { DownloadServiceError } from '@/utils/downloadService'
import { SCAN_POLL_MS } from '@/utils/scan-status'

const pkg = { content: { id: 'N:package:2', datasetNodeId: 'N:dataset:1', packageType: 'CSV' } }
const file = { content: { id: 11, objectType: 'source' } }
const held = () => new DownloadServiceError(409, 'still being scanned', { code: 'scan_pending', scanStatus: 'scanning' })

describe('CSVViewerWrapper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(viewFileUrl).mockReset()
    vi.mocked(EventBus.$emit).mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([file]) }))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("hands the viewer a view link to /view's first file, not an apiUrl", async () => {
    vi.mocked(viewFileUrl).mockResolvedValue('https://s3/view')
    const wrapper = shallowMount(CSVViewerWrapper, { props: { pkg } })
    await flushPromises()

    expect(viewFileUrl).toHaveBeenCalledWith({ datasetId: 'N:dataset:1', packageId: 'N:package:2', file })
    const viewer = wrapper.findComponent({ name: 'CSVViewer' })
    expect(viewer.props()).toEqual({ srcUrl: 'https://s3/view', fileType: 'CSV' })
  })

  it('says the file is being scanned, then asks again until it is released', async () => {
    vi.mocked(viewFileUrl).mockRejectedValueOnce(held()).mockResolvedValueOnce('https://s3/view')
    const wrapper = shallowMount(CSVViewerWrapper, { props: { pkg } })
    await flushPromises()

    expect(EventBus.$emit).toHaveBeenCalledWith('download-scan-pending', { packageId: 'N:package:2' })
    expect(wrapper.findComponent({ name: 'CSVViewer' }).exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(SCAN_POLL_MS)
    expect(wrapper.findComponent({ name: 'CSVViewer' }).props('srcUrl')).toBe('https://s3/view')
  })
})
