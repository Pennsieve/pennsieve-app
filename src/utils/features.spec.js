import { describe, it, expect } from 'vitest'
import { FEATURE_DEFAULTS, resolveFeatures } from './features'
import local from '../site-config/local.json'
import localClin from '../site-config/local-clin.json'
import dev from '../site-config/dev.json'
import prod from '../site-config/prod.json'
import clin from '../site-config/clin.json'

const configs = { local, localClin, dev, prod, clin }

describe('resolveFeatures', () => {
  it('falls back to defaults when a config has no features block', () => {
    expect(resolveFeatures(undefined)).toEqual(FEATURE_DEFAULTS)
  })

  it('lets a config override individual flags', () => {
    expect(resolveFeatures({ publishing: false })).toEqual({ ...FEATURE_DEFAULTS, publishing: false })
  })
})

describe('site configs', () => {
  it.each(Object.entries(configs))('%s declares every flag, as a boolean, and no unknown ones', (_, config) => {
    expect(Object.keys(config.features).sort()).toEqual(Object.keys(FEATURE_DEFAULTS).sort())
    Object.values(config.features).forEach((v) => expect(typeof v).toBe('boolean'))
  })

  it('clin logs in on the app and has publishing off', () => {
    expect(clin.features).toEqual({ inAppLogin: true, publishing: false })
  })

  it('local-clin mirrors clin features and environment name', () => {
    expect(localClin.features).toEqual(clin.features)
    expect(localClin.environmentName).toBe(clin.environmentName)
  })
})
