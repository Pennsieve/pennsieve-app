import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from '../test/mocks/server'

// Mock requestAnimationFrame and cancelAnimationFrame globally for all tests
// Element UI components use these for layout calculations
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16)
})
global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id)
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  // Clear all timers after each test to prevent them from running after test completion
  vi.clearAllTimers()
})