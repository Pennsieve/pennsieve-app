import { describe, it, expect, vi, beforeEach } from 'vitest'

let state
vi.mock('vuex', () => ({ useStore: () => ({ state }) }))
vi.mock('@/composables/useGetToken', () => ({ useGetToken: async () => 'tok' }))

import { useMetricsCounters } from './useMetricsCounters'

const ok = (body) => ({ ok: true, status: 200, json: async () => body })

describe('useMetricsCounters outside a workspace', () => {
  beforeEach(() => {
    state = { config: { api2Url: 'https://api2' }, activeOrganization: null }
    global.fetch = vi.fn()
  })

  it("asks for an app's counters with no organization", async () => {
    global.fetch.mockResolvedValue(ok({ allTime: { totalRuns: 7 } }))
    const { counters, fetchCounters } = useMetricsCounters({ scope: 'sourceUrl', id: 'https://github.com/o/r' })
    await fetchCounters()
    const url = global.fetch.mock.calls.at(-1)[0]
    expect(url).toContain('scope=application')
    expect(url).toContain('id=https%3A%2F%2Fgithub.com%2Fo%2Fr')
    expect(url).not.toContain('organization_id')
    expect(counters.value.allTime.totalRuns).toBe(7)
  })

  it("shows none, quietly, for an app that isn't the caller's to see", async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    const { counters, error, fetchCounters } = useMetricsCounters({ scope: 'sourceUrl', id: 'https://github.com/o/p' })
    await fetchCounters()
    expect(counters.value).toBeNull()
    expect(error.value).toBeNull()
  })

  it('still asks for no workflow counters', async () => {
    const { counters, fetchCounters } = useMetricsCounters({ scope: 'workflowUuid', id: 'w' })
    global.fetch.mockClear()
    await fetchCounters()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(counters.value).toBeNull()
  })
})
