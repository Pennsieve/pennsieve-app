import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import FileDetails from './FileDetails.vue'

const { scanInProgress, holdDownloadForScan } = FileDetails.computed
const { scheduleScanPoll, pollScanStatus, onDownloadScanPending, resetScanWait } = FileDetails.methods

const source = (scanStatus) => ({ content: { scanStatus } })

function component(overrides = {}) {
  const cmp = {
    fileId: 'N:package:1',
    proxyRecord: { content: { id: 'N:package:1' } },
    packageSourceFiles: [source('pending')],
    scanWaitConfirmed: false,
    scanPollTimer: null,
    scanPollCount: 0,
    packageFilesUrl: Promise.resolve('https://api/packages/N:package:1/sources-paged'),
    sendXhr: vi.fn(),
    scheduleScanPoll,
    pollScanStatus,
    ...overrides,
  }
  // Computed properties, evaluated against the current state.
  Object.defineProperty(cmp, 'scanInProgress', { get: () => scanInProgress.call(cmp) })
  return cmp
}

describe('FileDetails while a scan is in progress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds Download only once download-service has held the file', () => {
    const cmp = component()
    expect(holdDownloadForScan.call(cmp)).toBe(false)

    onDownloadScanPending.call(cmp, { packageId: 'N:package:other' })
    expect(cmp.scanWaitConfirmed).toBe(false)

    onDownloadScanPending.call(cmp, { packageId: 'N:package:1' })
    expect(holdDownloadForScan.call(cmp)).toBe(true)

    cmp.packageSourceFiles = [source('clean')]
    expect(holdDownloadForScan.call(cmp), 'released once the scan settles').toBe(false)

    cmp.packageSourceFiles = [source('scanning')]
    cmp.scanPollCount = 40
    expect(holdDownloadForScan.call(cmp), 'released once the re-checks give up').toBe(false)
  })

  it('re-checks the verdict every 15 seconds until it settles', async () => {
    const cmp = component()
    cmp.sendXhr.mockResolvedValue({ results: [source('clean')] })
    scheduleScanPoll.call(cmp)
    expect(cmp.sendXhr).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(15000)
    expect(cmp.sendXhr).toHaveBeenCalledWith('https://api/packages/N:package:1/sources-paged')
    expect(cmp.packageSourceFiles).toEqual([source('clean')])

    // The packageSourceFiles watcher schedules again; settled, nothing is due.
    scheduleScanPoll.call(cmp)
    expect(cmp.scanPollTimer).toBeNull()
  })

  it('does not poll when nothing is being scanned', () => {
    const cmp = component({ packageSourceFiles: [source('unscanned'), source('clean')] })
    scheduleScanPoll.call(cmp)
    expect(cmp.scanPollTimer).toBeNull()
  })

  it('gives up after ten minutes, and starts over for another file', () => {
    const cmp = component({ scanPollCount: 40 })
    scheduleScanPoll.call(cmp)
    expect(cmp.scanPollTimer).toBeNull()

    resetScanWait.call(cmp)
    expect(cmp.scanPollCount).toBe(0)
    scheduleScanPoll.call(cmp)
    expect(cmp.scanPollTimer).not.toBeNull()
  })

  it('ignores an answer for a file the user has since left', async () => {
    const cmp = component()
    let answer
    cmp.sendXhr.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    pollScanStatus.call(cmp)
    await vi.waitFor(() => expect(cmp.sendXhr).toHaveBeenCalled())
    cmp.fileId = 'N:package:2'
    answer({ results: [source('clean')] })
    await vi.runAllTimersAsync()
    expect(cmp.packageSourceFiles).toEqual([source('pending')])
  })
})
