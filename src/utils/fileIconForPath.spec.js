import { describe, it, expect } from 'vitest'
import { fileIconForPath } from './fileIconForPath'

describe('fileIconForPath', () => {
  it('is the folder icon for a folder', () => {
    expect(fileIconForPath('files', { folder: true })).toBe('/file-icons/icon-folder.svg')
  })

  it('reads the icon off the extension', () => {
    expect(fileIconForPath('files/manifest.xlsx')).toBe('/file-icons/icon-excel.svg')
    expect(fileIconForPath('ro-crate-metadata.json')).toBe('/file-icons/icon-code.svg')
    expect(fileIconForPath('a/B.TIF')).toBe('/file-icons/icon-microscope.svg')
    expect(fileIconForPath('notebook.ipynb')).toBe('/file-icons/icon-notebook.svg')
  })

  it('is the generic icon otherwise', () => {
    expect(fileIconForPath('README')).toBe('/file-icons/icon-generic.svg')
    expect(fileIconForPath('.hidden')).toBe('/file-icons/icon-generic.svg')
  })
})
