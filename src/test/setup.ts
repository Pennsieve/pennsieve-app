import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '../test/mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())