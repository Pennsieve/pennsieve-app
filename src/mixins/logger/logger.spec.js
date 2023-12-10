import log from './'
import { beforeEach, afterEach,describe, expect, it, vi } from 'vitest'


describe('logger Mixin', () => {
  beforeEach(() => {
    const noop = () => {}
    global.console = {
      log: vi.fn(noop),
      apply: noop
    }
    global.location = {
      href: 'https://app.blackfynn.net'
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logger fires console function', () => {
    log.methods.logger(['test', 'msg'])
    expect(console.log.mock.calls.length).toBe(1)
  })

  it('logger fires console function', () => {
    log.methods.logger('test')
    expect(console.log.mock.calls.length).toBe(1)
  })

  it('logger does NOT fire non-existant console function', () => {
    log.methods.logger('test', 'rando')
    expect(console.log.mock.calls.length).toBe(0)
  })

  it('logger does NOT fire console function if disabled', () => {
    log.methods.logger('test', 'log', true)
    expect(console.log.mock.calls.length).toBe(0)
  })
})
