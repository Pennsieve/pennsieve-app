import { describe, it, expect } from 'vitest'
import {
  getScanStatusDisplay,
  aggregateScanStatus,
  scanStatusBlocksDownload,
  scanStatusInProgress,
  isScanPendingError,
  scanPendingMessage,
  scanPendingCountText,
  SCAN_PENDING_MESSAGE,
} from './index'

const file = (scanStatus, extra = {}) => ({ content: { scanStatus, ...extra } })

describe('getScanStatusDisplay', () => {
  it('shows pending and scanning as Scanning, without claiming the download is blocked', () => {
    for (const status of ['pending', 'scanning']) {
      const display = getScanStatusDisplay(status)
      expect(display).toMatchObject({ status, label: 'Scanning', severity: 'muted' })
      expect(display.secondary).toBe('Downloads may wait until the scan finishes.')
      expect(scanStatusBlocksDownload(status)).toBe(false)
    }
  })

  it('keeps unscanned as not scanned, with the size reason, and downloadable', () => {
    expect(getScanStatusDisplay('unscanned', { skipReason: 'size' })).toMatchObject({
      label: 'Not scanned',
      secondary: 'File is above the automatic scan size limit.',
    })
    expect(scanStatusBlocksDownload('unscanned')).toBe(false)
  })

  it('blocks infected and failed', () => {
    expect(getScanStatusDisplay('infected').secondary).toMatch(/^Download blocked/)
    expect(getScanStatusDisplay('failed').secondary).toMatch(/^Download blocked/)
    expect(scanStatusBlocksDownload('infected')).toBe(true)
    expect(scanStatusBlocksDownload('failed')).toBe(true)
  })

  it('omits an absent or unknown status', () => {
    expect(getScanStatusDisplay(undefined)).toBeNull()
    expect(getScanStatusDisplay('quarantined')).toBeNull()
  })
})

describe('aggregateScanStatus', () => {
  it('ranks unscanned above a scan in progress, and a scan in progress above clean', () => {
    expect(aggregateScanStatus([file('pending'), file('unscanned')]).status).toBe('unscanned')
    expect(aggregateScanStatus([file('clean'), file('scanning')]).status).toBe('scanning')
  })
})

describe('scan in progress', () => {
  it('is pending or scanning only', () => {
    expect(['pending', 'scanning'].every(scanStatusInProgress)).toBe(true)
    expect(['clean', 'format_validated', 'unscanned', 'not_required', 'infected', 'failed', undefined]
      .some(scanStatusInProgress)).toBe(false)
  })

  it("recognises download-service's 409 scan_pending, and nothing else", () => {
    const held = Object.assign(new Error('The selected files are still being scanned for malware.'), {
      status: 409, code: 'scan_pending', scanStatus: 'pending',
    })
    expect(isScanPendingError(held)).toBe(true)
    expect(scanPendingMessage(held)).toBe('The selected files are still being scanned for malware.')
    expect(isScanPendingError(Object.assign(new Error('conflict'), { status: 409 }))).toBe(false)
    expect(isScanPendingError(Object.assign(new Error('blocked'), { status: 403 }))).toBe(false)
    expect(isScanPendingError(undefined)).toBe(false)
    expect(scanPendingMessage(new Error(''))).toBe(SCAN_PENDING_MESSAGE)
  })

  it('counts the files an archive left out', () => {
    expect(scanPendingCountText(undefined)).toBe('')
    expect(scanPendingCountText(0)).toBe('')
    expect(scanPendingCountText(1)).toBe('1 file was left out because it is still being scanned')
    expect(scanPendingCountText(3)).toBe('3 files were left out because they are still being scanned')
  })
})
