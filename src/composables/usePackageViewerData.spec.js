import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/composables/useGetToken', () => ({
  useGetToken: vi.fn(() => Promise.resolve('tok')),
}))
vi.mock('@/site-config/site.json', () => ({
  apiUrl: 'https://api.test',
  api2Url: 'https://api2.test',
}))

import {
  usePackageViewerData,
  hasTimeseriesChannels,
  viewerNeedsData,
  _resetViewerDataCache,
} from './usePackageViewerData'

const ok = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

function routes(map) {
  return vi.fn((url) => {
    const key = Object.keys(map).find((k) => url.includes(k))
    return key ? ok(map[key]) : Promise.resolve({ ok: false })
  })
}

describe('usePackageViewerData', () => {
  beforeEach(() => _resetViewerDataCache())
  afterEach(() => vi.unstubAllGlobals())

  it('only probes types whose viewer needs derived data', async () => {
    const fetch = routes({})
    vi.stubGlobal('fetch', fetch)
    const { probeViewerData } = usePackageViewerData()
    expect(await probeViewerData({ datasetId: 'd', packageId: 'p', packageType: 'PDF' })).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect(viewerNeedsData('TimeSeries')).toBe(true)
    expect(viewerNeedsData('Slide')).toBe(true)
    expect(viewerNeedsData('Image')).toBe(false)
  })

  it('opens a timeseries with a ready Zarr bundle without asking for channels', async () => {
    const fetch = routes({
      '/packages/assets': { assets: [{ asset_type: 'timeseries-zarr', status: 'ready' }] },
    })
    vi.stubGlobal('fetch', fetch)
    const { probeViewerData, hasViewerData } = usePackageViewerData()
    expect(await probeViewerData({ datasetId: 'd', packageId: 'N:package:1', packageType: 'TimeSeries' })).toBe(true)
    expect(hasViewerData('N:package:1')).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('opens a timeseries that has channels', async () => {
    vi.stubGlobal('fetch', routes({
      '/packages/assets': { assets: [{ asset_type: 'timeseries-zarr', status: 'processing' }] },
      '/timeseries/N:package:2/channels': [{ content: { id: 'c1' } }],
    }))
    const { probeViewerData } = usePackageViewerData()
    expect(await probeViewerData({ datasetId: 'd', packageId: 'N:package:2', packageType: 'TimeSeries' })).toBe(true)
  })

  it('gives a timeseries with neither channels nor a bundle no viewer', async () => {
    vi.stubGlobal('fetch', routes({
      '/packages/assets': { assets: [] },
      '/timeseries/N:package:3/channels': [],
    }))
    const { probeViewerData, hasViewerData } = usePackageViewerData()
    expect(await probeViewerData({ datasetId: 'd', packageId: 'N:package:3', packageType: 'TimeSeries' })).toBe(false)
    expect(hasViewerData('N:package:3')).toBe(false)
  })

  it('opens a slide only when its tiles exist', async () => {
    vi.stubGlobal('fetch', routes({
      '/packages/N:package:4/view': [{ content: { id: 9 } }],
      '/packages/N:package:5/view': [],
    }))
    const { probeViewerData } = usePackageViewerData()
    expect(await probeViewerData({ packageId: 'N:package:4', packageType: 'Slide' })).toBe(true)
    expect(await probeViewerData({ packageId: 'N:package:5', packageType: 'Slide' })).toBe(false)
  })

  it('asks once per package, sharing a request in flight', async () => {
    const fetch = routes({ '/packages/N:package:6/view': [{}] })
    vi.stubGlobal('fetch', fetch)
    const { probeViewerData } = usePackageViewerData()
    const args = { packageId: 'N:package:6', packageType: 'Slide' }
    await Promise.all([probeViewerData(args), probeViewerData(args)])
    await probeViewerData(args)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('treats a failed probe as no viewer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))))
    const { probeViewerData } = usePackageViewerData()
    expect(await probeViewerData({ packageId: 'N:package:7', packageType: 'Slide' })).toBe(false)
  })
})

describe('hasTimeseriesChannels', () => {
  it('reads the channels on a package GET', () => {
    expect(hasTimeseriesChannels({ channels: [{}] })).toBe(true)
    expect(hasTimeseriesChannels({ channels: [] })).toBe(false)
    expect(hasTimeseriesChannels({})).toBe(false)
  })
})
