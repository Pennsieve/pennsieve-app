import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '../test/mocks/server'

// Browsers tag a MutationObserver as such, so Vue never wraps one in a
// reactive proxy (Element Plus keeps its table's in a ref). happy-dom's has no
// tag, so Vue proxies it and happy-dom's private fields reject the proxy.
Object.defineProperty(MutationObserver.prototype, Symbol.toStringTag, {
  value: 'MutationObserver',
  configurable: true,
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())