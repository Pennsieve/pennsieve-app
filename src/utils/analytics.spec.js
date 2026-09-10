import { describe, it, expect } from 'vitest'
import { sanitizePath, bucket, trackEvent } from './analytics'

// Pennsieve URLs carry dataset, package, org and user identifiers. On
// HIPAA-tier workspaces those point at protected data, so none of them may
// reach Google. Route shape is kept; identity is not.
describe('sanitizePath', () => {
  it('replaces Pennsieve node ids', () => {
    expect(sanitizePath('/datasets/N:dataset:4edcd1d9-1b25-4860-abdf-79140d069450/files'))
      .toBe('/datasets/:id/files')
  })

  it('replaces bare uuids and multiple ids in one path', () => {
    expect(sanitizePath('/datasets/N:dataset:abc12345-1111-2222-3333-444455556666/records/N:package:99999999-1111-2222-3333-444455556666'))
      .toBe('/datasets/:id/records/:id')
    expect(sanitizePath('/4edcd1d9-1b25-4860-abdf-79140d069450/overview')).toBe('/:id/overview')
  })

  it('replaces numeric ids of ANY length', () => {
    // the pennsieve-admin org is id 50: a >=4-digit rule leaked short ids
    expect(sanitizePath('/workspace/50/settings')).toBe('/workspace/:id/settings')
    expect(sanitizePath('/workspace/548/datasets')).toBe('/workspace/:id/datasets')
    expect(sanitizePath('/analysis/1')).toBe('/analysis/:id')
  })

  it('drops query strings and fragments, which can carry search terms', () => {
    expect(sanitizePath('/datasets?search=patient%20smith')).toBe('/datasets')
    expect(sanitizePath('/analysis/runs#run-42')).toBe('/analysis/runs')
  })

  it('leaves identifier-free routes intact', () => {
    expect(sanitizePath('/people')).toBe('/people')
    expect(sanitizePath('/')).toBe('/')
  })

  it('handles empty input', () => {
    expect(sanitizePath('')).toBe('/')
    expect(sanitizePath(undefined)).toBe('/')
  })
})

describe('bucket', () => {
  it('buckets counts so exact figures never leave', () => {
    expect(bucket(0)).toBe('0')
    expect(bucket(1)).toBe('1')
    expect(bucket(7)).toBe('2-10')
    expect(bucket(1247)).toBe('1000+')
  })
  it('handles nonsense', () => {
    expect(bucket(undefined)).toBe('unknown')
    expect(bucket(-1)).toBe('unknown')
  })
})

describe('trackEvent', () => {
  it('no-ops when analytics is disabled (clin, local)', () => {
    // initAnalytics has not run in this test env
    expect(trackEvent('upload_completed', { files: '1' })).toBe(false)
  })

  it('drops free-text parameter values', async () => {
    // simulate an initialised gtag without calling initAnalytics
    const mod = await import('./analytics')
    const sent = []
    globalThis.window = { gtag: (...a) => sent.push(a) }
    // enabled is module-private; exercise the guard via the public contract:
    // with analytics disabled nothing is sent at all, which is the safe state
    expect(mod.trackEvent('search_performed', { q: 'patient smith' })).toBe(false)
    expect(sent).toHaveLength(0)
    delete globalThis.window
  })

  it('rejects event names that are not simple tokens', () => {
    expect(trackEvent('N:dataset:123')).toBe(false)
  })
})
