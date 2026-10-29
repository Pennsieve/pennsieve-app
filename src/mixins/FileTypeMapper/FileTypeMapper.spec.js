import { describe, it, expect } from 'vitest'
import FileTypeMapper from './index'
import GetFileProperty from '../get-file-property'

const cmp = {
  ...FileTypeMapper.data(),
  ...FileTypeMapper.methods,
  ...GetFileProperty.methods,
}
const check = (pkg) => FileTypeMapper.methods.checkViewerType.call(cmp, pkg)
const pkg = (packageType, state = 'READY', extra = {}) => ({
  content: { packageType, state, name: extra.name || 'file' },
  properties: [],
  ...extra,
})

describe('checkViewerType', () => {
  it('gives anything not yet cleared by the scan no viewer', () => {
    for (const state of ['UPLOADED', 'ERROR', 'UNAVAILABLE', 'PROCESSING']) {
      expect(check(pkg('PDF', state)), state).toEqual(['UnknownViewer'])
    }
  })

  it('opens a READY source-file viewer as before', () => {
    expect(check(pkg('PDF'))).toEqual(['PDFViewer'])
    expect(check(pkg('Image'))).toEqual(['ImageViewer'])
  })

  it('streams a timeseries only when it has channels', () => {
    expect(check(pkg('TimeSeries', 'READY', { channels: [{}] }))).toEqual(['TimeseriesViewer'])
    expect(check(pkg('TimeSeries'))).toEqual(['UnknownViewer'])
  })

  it('opens a .lay header in the LayViewer unless it has channels', () => {
    expect(check(pkg('TimeSeries', 'READY', { name: 'rec.lay' }))).toEqual(['LayViewer', 'TextViewer'])
    expect(check(pkg('TimeSeries', 'READY', { name: 'rec.lay', channels: [{}] }))).toEqual(['TimeseriesViewer'])
  })
})
