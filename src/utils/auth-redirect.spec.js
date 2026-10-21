import { describe, it, expect } from 'vitest'
import { safeRedirectPath, loginQuery } from './auth-redirect'

describe('safeRedirectPath', () => {
  it('accepts same-origin paths with query strings', () => {
    expect(safeRedirectPath('/12/datasets?page=2')).toBe('/12/datasets?page=2')
  })

  it('rejects absolute and protocol-relative urls', () => {
    expect(safeRedirectPath('https://evil.example')).toBeNull()
    expect(safeRedirectPath('//evil.example')).toBeNull()
    expect(safeRedirectPath('/\\evil.example')).toBeNull()
    expect(safeRedirectPath('javascript:alert(1)')).toBeNull()
  })

  it('rejects the login page itself and non-strings', () => {
    expect(safeRedirectPath('/login')).toBeNull()
    expect(safeRedirectPath('/login?redirectTo=/x')).toBeNull()
    expect(safeRedirectPath(undefined)).toBeNull()
    expect(safeRedirectPath(['/a'])).toBeNull()
  })
})

describe('loginQuery', () => {
  it('carries a safe return path', () => {
    expect(loginQuery('/12/datasets')).toEqual({ redirectTo: '/12/datasets' })
  })

  it('omits the root and unsafe paths', () => {
    expect(loginQuery('/')).toEqual({})
    expect(loginQuery('//evil.example')).toEqual({})
  })
})
