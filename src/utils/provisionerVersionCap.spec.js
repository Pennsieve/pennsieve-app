import { describe, it, expect } from 'vitest'
import { versionBefore, cappedVersion, capNodeVersion } from './provisionerVersionCap'

describe('provisioner version cap', () => {
  it('compares release tags', () => {
    expect(versionBefore('v1.9.0', 'v1.10.0')).toBe(true)
    expect(versionBefore('v1.10.0', 'v1.10.0')).toBe(false)
    expect(versionBefore('v1.18.0', 'v1.10.0')).toBe(false)
    expect(versionBefore('latest', 'v1.10.0')).toBe(false)
  })

  it('offers the newest release up to the cap', () => {
    expect(cappedVersion('v1.18.0', 'v1.10.0')).toBe('v1.10.0')
    expect(cappedVersion('v1.9.0', 'v1.10.0')).toBe('v1.9.0')
    expect(cappedVersion(null, 'v1.10.0')).toBe('v1.10.0')
    expect(cappedVersion('v1.18.0', '')).toBe('v1.18.0')
    expect(cappedVersion(null, '')).toBe(null)
  })

  it('offers an update only to an older node', () => {
    const cap = 'v1.10.0'
    expect(capNodeVersion({ provisionerImageTag: 'v1.8.11', latestVersion: 'v1.18.0', updateAvailable: true }, cap))
      .toMatchObject({ latestVersion: 'v1.10.0', updateAvailable: true })
    expect(capNodeVersion({ provisionerImageTag: 'v1.10.0', latestVersion: 'v1.18.0', updateAvailable: true }, cap))
      .toMatchObject({ latestVersion: 'v1.10.0', updateAvailable: false })
    expect(capNodeVersion({ provisionerImageTag: 'v1.18.0', latestVersion: 'v1.18.0', updateAvailable: false }, cap))
      .toMatchObject({ updateAvailable: false })
    expect(capNodeVersion({ provisionerImageTag: 'latest', latestVersion: 'v1.18.0', updateAvailable: true }, cap))
      .toMatchObject({ latestVersion: 'v1.10.0', updateAvailable: true })
    const node = { latestVersion: 'v1.18.0', updateAvailable: true }
    expect(capNodeVersion(node, '')).toBe(node)
  })
})
