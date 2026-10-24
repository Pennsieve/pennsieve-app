import { describe, it, expect, vi } from 'vitest'
import {
  environmentsServiceUrl,
  listEnvironments,
  getEnvironment,
  newestReady,
  fitsKernel,
  EnvironmentsServiceError,
} from './environmentsService'
import dev from '../site-config/dev.json'
import prod from '../site-config/prod.json'

const config = { environmentsServiceUrl: 'https://api2.pennsieve.net/environments/' }
const getToken = () => Promise.resolve('tok')

function respond(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('environmentsServiceUrl', () => {
  it('is set only where environments-service is deployed', () => {
    expect(environmentsServiceUrl(dev)).toBe('https://api2.pennsieve.net/environments')
    expect(environmentsServiceUrl(prod)).toBe('')
    expect(environmentsServiceUrl(config)).toBe('https://api2.pennsieve.net/environments')
  })
})

describe('listEnvironments', () => {
  it("reads the user's environments with their token", async () => {
    const fetchFn = respond(200, { environments: [{ id: 'e1' }] })
    expect(await listEnvironments({ config, getToken, fetchFn })).toEqual([{ id: 'e1' }])
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api2.pennsieve.net/environments/me')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it("rejects with the service's message", async () => {
    const err = await listEnvironments({ config, getToken, fetchFn: respond(401, { message: 'no' }) }).catch((e) => e)
    expect(err).toBeInstanceOf(EnvironmentsServiceError)
    expect(err.status).toBe(401)
    expect(err.message).toBe('no')
  })
})

describe('getEnvironment', () => {
  it('sorts versions newest first', async () => {
    const fetchFn = respond(200, { environment: { id: 'e1' }, versions: [{ version: 1 }, { version: 3 }, { version: 2 }] })
    const { versions } = await getEnvironment('e1', { config, getToken, fetchFn })
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1])
    expect(fetchFn.mock.calls[0][0]).toBe('https://api2.pennsieve.net/environments/e1')
  })
})

describe('newestReady', () => {
  it('skips building and failed versions', () => {
    const versions = [{ version: 3, status: 'building' }, { version: 1, status: 'ready' }, { version: 2, status: 'failed' }]
    expect(newestReady(versions).version).toBe(1)
    expect(newestReady([{ version: 1, status: 'failed' }])).toBeNull()
  })
})

describe('fitsKernel', () => {
  const py312 = { runtime: { language: 'python', version: '3.12' } }
  it('matches the language and Python minor version', () => {
    expect(fitsKernel(py312, 'Python 3.12.3')).toBe(true)
    expect(fitsKernel(py312, 'Python 3.11.9')).toBe(false)
    expect(fitsKernel(py312, 'R 4.4.1')).toBe(false)
    expect(fitsKernel(py312, '')).toBe(true)
    expect(fitsKernel({}, 'Python 3.12.3')).toBe(false)
  })
})
