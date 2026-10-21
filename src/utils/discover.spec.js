import { describe, it, expect } from 'vitest'
import { discoverSharesApi, withDiscoverAuth } from './discover'
import dev from '../site-config/dev.json'
import prod from '../site-config/prod.json'
import clin from '../site-config/clin.json'

describe('discoverSharesApi', () => {
  it('is true where Discover is the platform\'s own', () => {
    expect(discoverSharesApi(prod)).toBe(true)
    expect(discoverSharesApi(dev)).toBe(true)
  })

  it('is false where clin browses prod\'s catalogue', () => {
    expect(discoverSharesApi(clin)).toBe(false)
  })

  it('is false for a config it cannot parse', () => {
    expect(discoverSharesApi({ discoverUrl: 'not a url', apiUrl: prod.apiUrl })).toBe(false)
  })
})

describe('withDiscoverAuth', () => {
  it('attaches the token for the platform\'s own Discover', () => {
    expect(withDiscoverAuth(`${prod.discoverUrl}/datasets/1/collections`, 'tok', prod))
      .toBe(`${prod.discoverUrl}/datasets/1/collections?api_key=tok`)
    expect(withDiscoverAuth(`${prod.discoverUrl}/search/datasets?limit=5`, 'tok', prod))
      .toBe(`${prod.discoverUrl}/search/datasets?limit=5&api_key=tok`)
  })

  it('never sends a clin token to another platform\'s Discover', () => {
    const url = `${clin.discoverUrl}/search/datasets?limit=5`
    expect(withDiscoverAuth(url, 'clin-token', clin)).toBe(url)
  })

  it('leaves the url alone without a token', () => {
    expect(withDiscoverAuth(`${prod.discoverUrl}/datasets`, undefined, prod)).toBe(`${prod.discoverUrl}/datasets`)
  })
})

describe('clin site config', () => {
  it('browses the prod Discover catalogue and links to the prod Discover app', () => {
    expect(clin.discoverUrl).toBe('https://api.pennsieve.io/discover')
    expect(clin.discoverAppUrl).toBe('https://discover.pennsieve.io')
  })
})
