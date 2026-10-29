import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'

// environments-service (api2.<domain>/environments) keeps a user's
// environments: named, versioned Python package sets, each version built once
// into an archive. A notebook session switches to one while it runs: the app
// names the version and the session's sidecar fetches it
// (useJupyterSession switchEnvironment). Official environments (owner
// "pennsieve") are everyone's.

// The service's base URL, or '' where the platform has none yet: the app
// then offers no environments.
export function environmentsServiceUrl(config = siteConfig) {
  return (config.environmentsServiceUrl || '').replace(/\/+$/, '')
}

export class EnvironmentsServiceError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'EnvironmentsServiceError'
    this.status = status
  }
}

export async function environmentsRequest(path, {
  method = 'GET',
  body,
  config = siteConfig,
  getToken = useGetToken,
  fetchFn = globalThis.fetch,
} = {}) {
  const base = environmentsServiceUrl(config)
  if (!base) throw new Error('environments-service is not configured for this site')
  const headers = { Authorization: `Bearer ${await getToken()}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const resp = await fetchFn(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    throw new EnvironmentsServiceError(resp.status, data.message || `environments-service responded ${resp.status}`)
  }
  return data
}

// The user's environments and the official ones, each with its latest
// version: { id, owner, name, language, latestVersion, official,
// latest: { version, status: building|ready|failed, packages, runtime, archive, error } }.
export async function listEnvironments(options = {}) {
  const { environments } = await environmentsRequest('/me', options)
  return environments || []
}

// An environment and all its versions, newest first.
export async function getEnvironment(id, options = {}) {
  const data = await environmentsRequest(`/${encodeURIComponent(id)}`, options)
  const versions = [...(data.versions || [])].sort((a, b) => b.version - a.version)
  return { environment: data.environment, versions }
}

// Builds requirements into an environment: a new one with a new name, or a
// new version of the caller's environment of that name. With the same
// requirements as a ready version, that version comes back (reused) and
// nothing is built. { environment, version, reused }.
export function createEnvironment({ name, requirements, language = 'python' }, options = {}) {
  return environmentsRequest('/me', { ...options, method: 'POST', body: { name, language, requirements } })
}

// Deletes an environment, its versions and archives. The owner's only.
export async function deleteEnvironment(id, options = {}) {
  await environmentsRequest(`/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' })
}

// A version's build status and the last lines of its build log:
// { status, lines }.
export function buildLog(id, version, options = {}) {
  return environmentsRequest(`/${encodeURIComponent(id)}/versions/${version}/log`, options)
}

// Environment names: lowercase letters, digits and dashes, at most 63.
export const ENVIRONMENT_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/

// Why requirements can't be built, or '': one pip spec per line, no pip
// options, at most 500 lines and 32 KB (as environments-service checks).
export function requirementsProblem(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  if (!lines.length) return 'List at least one package.'
  const option = lines.find((l) => l.startsWith('-'))
  if (option) return `Pip options like "${option.split(/\s/)[0]}" aren't allowed; list one package per line.`
  if (lines.length > 500) return 'At most 500 packages.'
  if (new Blob([text]).size > 32 * 1024) return 'The list must be under 32 KB.'
  return ''
}

// The newest ready version among versions, or null.
export function newestReady(versions) {
  return [...(versions || [])]
    .filter((v) => v.status === 'ready')
    .sort((a, b) => b.version - a.version)[0] || null
}

// Whether an environment's version runs on a kernel: the same language,
// and for Python the same minor version ("3.12" against "Python 3.12.3").
export function fitsKernel(version, kernelName) {
  const runtime = version?.runtime
  if (!runtime) return false
  const name = (kernelName || '').toLowerCase()
  if (runtime.language === 'python') {
    if (name && !name.startsWith('python')) return false
    const m = name.match(/(\d+\.\d+)/)
    return !m || !runtime.version || m[1] === runtime.version
  }
  return name.startsWith(runtime.language)
}
