import { describe, it, expect, vi } from 'vitest'
import {
  environmentsServiceUrl,
  listEnvironments,
  getEnvironment,
  newestReady,
  fitsKernel,
  createEnvironment,
  deleteEnvironment,
  buildLog,
  requirementsProblem,
  ENVIRONMENT_NAME,
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

describe('createEnvironment', () => {
  it('posts the name and requirements', async () => {
    const fetchFn = respond(202, { environment: { id: 'e1' }, version: { version: 1, status: 'building' } })
    const out = await createEnvironment({ name: 'np', requirements: 'numpy\n' }, { config, getToken, fetchFn })
    expect(out.version.status).toBe('building')
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api2.pennsieve.net/environments/me')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ name: 'np', language: 'python', requirements: 'numpy\n' })
  })
})

describe('deleteEnvironment and buildLog', () => {
  it('call the environment and version routes', async () => {
    const del = respond(204, {})
    await deleteEnvironment('e1', { config, getToken, fetchFn: del })
    expect(del.mock.calls[0][0]).toBe('https://api2.pennsieve.net/environments/e1')
    expect(del.mock.calls[0][1].method).toBe('DELETE')
    const log = respond(200, { status: 'failed', lines: ['ERROR: x'] })
    expect((await buildLog('e1', 2, { config, getToken, fetchFn: log })).lines).toEqual(['ERROR: x'])
    expect(log.mock.calls[0][0]).toBe('https://api2.pennsieve.net/environments/e1/versions/2/log')
  })
})

describe('names and requirements', () => {
  it('checks what environments-service checks', () => {
    expect(ENVIRONMENT_NAME.test('numpy-pandas')).toBe(true)
    expect(ENVIRONMENT_NAME.test('NumPy')).toBe(false)
    expect(ENVIRONMENT_NAME.test('-x')).toBe(false)
    expect(requirementsProblem('numpy\n# a comment\npandas==3.1')).toBe('')
    expect(requirementsProblem('  \n')).toBe('List at least one package.')
    expect(requirementsProblem('--index-url https://x\nnumpy')).toMatch('"--index-url"')
    expect(requirementsProblem(Array.from({ length: 501 }, (_, i) => `p${i}`).join('\n'))).toBe('At most 500 packages.')
  })
})
