import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/composables/useGetToken', () => ({
  useGetToken: () => Promise.resolve('test-token'),
}))
vi.mock('@/site-config/site.json', () => ({ api2Url: 'https://api.test' }))

import {
  useNodePipelineQuotaStore,
  normalizePayload,
  axesForScope,
  SCOPE_NODE,
  SCOPE_DEFAULT,
} from './nodePipelineQuotaStore'

const row = (over = {}) => ({
  nodeUuid: 'node-1',
  scope: 'user',
  userId: 'u1',
  dailyCostUsd: null,
  monthlyCostUsd: null,
  perRunCostUsd: null,
  maxConcurrentRuns: null,
  ...over,
})

const okJson = (body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) })

describe('nodePipelineQuotaStore', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useNodePipelineQuotaStore()
  })

  describe('normalizePayload', () => {
    // The whole point of the pointer-typed backend fields. A blank field means
    // "no limit on this axis, fall through"; 0 means "block everything". If
    // these collapsed into each other, clearing a cap would silently switch the
    // node off, or vice versa.
    it('keeps an explicit 0 distinct from an unset axis', () => {
      const p = normalizePayload(SCOPE_DEFAULT, { dailyCostUsd: 0, monthlyCostUsd: null })

      expect(p.dailyCostUsd).toBe(0)
      expect(p.monthlyCostUsd).toBeNull()
    })

    // PUT replaces the row rather than merging, so every axis has to be present
    // — an axis the caller forgot would be cleared without them asking.
    it('sends every axis for the scope, explicitly null when unset', () => {
      const p = normalizePayload(SCOPE_DEFAULT, {})

      for (const axis of axesForScope(SCOPE_DEFAULT)) {
        expect(p).toHaveProperty(axis.key, null)
      }
    })

    // account-service 400s on perRunCostUsd at node scope rather than storing a
    // value its resolver would ignore. Sending a blank one would turn a valid
    // save into an error the user cannot act on.
    it('omits perRunCostUsd on the node scope', () => {
      const p = normalizePayload(SCOPE_NODE, { dailyCostUsd: 5, perRunCostUsd: null })

      expect(p).not.toHaveProperty('perRunCostUsd')
      expect(p.dailyCostUsd).toBe(5)
    })

    it('keeps perRunCostUsd on the per-user scopes', () => {
      expect(normalizePayload(SCOPE_DEFAULT, { perRunCostUsd: 0.25 }).perRunCostUsd).toBe(0.25)
      expect(normalizePayload('u1', { perRunCostUsd: 0.25 }).perRunCostUsd).toBe(0.25)
    })

    it('always sends notes as a string', () => {
      expect(normalizePayload(SCOPE_DEFAULT, {}).notes).toBe('')
      expect(normalizePayload(SCOPE_DEFAULT, { notes: 'why' }).notes).toBe('why')
    })
  })

  describe('tier splitting', () => {
    it('separates the three tiers by scope', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          okJson({
            nodeUuid: 'node-1',
            quotas: [
              row({ scope: 'node', userId: undefined, dailyCostUsd: 20 }),
              row({ scope: 'default', userId: undefined, dailyCostUsd: 5 }),
              row({ scope: 'user', userId: 'u1', dailyCostUsd: 50 }),
              row({ scope: 'user', userId: 'u2' }),
            ],
          }),
        ),
      )

      await store.fetchAll('node-1')

      expect(store.getNodeRow('node-1').dailyCostUsd).toBe(20)
      expect(store.getDefaultRow('node-1').dailyCostUsd).toBe(5)
      expect(store.getUserRows('node-1').map((r) => r.userId)).toEqual(['u1', 'u2'])
    })

    // An unconfigured node is the common case, not an error — every
    // customer-owned node starts here.
    it('reports an empty policy set as unconfigured, not as an error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ nodeUuid: 'node-1', quotas: [] })))

      await store.fetchAll('node-1')

      expect(store.isConfigured('node-1')).toBe(false)
      expect(store.getError('node-1')).toBeNull()
      expect(store.getNodeRow('node-1')).toBeNull()
    })
  })

  describe('writes', () => {
    it('puts to the scope path and folds the returned row into state', async () => {
      const f = vi.fn().mockResolvedValue(okJson(row({ scope: 'default', userId: undefined, dailyCostUsd: 5 })))
      vi.stubGlobal('fetch', f)

      await store.putRow('node-1', SCOPE_DEFAULT, { dailyCostUsd: 5 })

      const [url, init] = f.mock.calls[0]
      expect(url).toBe('https://api.test/compute/resources/compute-nodes/node-1/pipeline-quotas/default')
      expect(init.method).toBe('PUT')
      expect(JSON.parse(init.body).dailyCostUsd).toBe(5)
      expect(store.getDefaultRow('node-1').dailyCostUsd).toBe(5)
    })

    // Editing an existing override must not append a second row for the same
    // user — the table is keyed on userId and would render a duplicate.
    it('replaces an existing row in place rather than appending', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson({ nodeUuid: 'node-1', quotas: [row({ dailyCostUsd: 1 })] })))
      await store.fetchAll('node-1')

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(row({ dailyCostUsd: 9 }))))
      await store.putRow('node-1', 'u1', { dailyCostUsd: 9 })

      expect(store.getUserRows('node-1')).toHaveLength(1)
      expect(store.getUserRows('node-1')[0].dailyCostUsd).toBe(9)
    })

    // DELETE returns 204 with no body, so the row has to be dropped locally.
    it('drops the row locally after a delete', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          okJson({
            nodeUuid: 'node-1',
            quotas: [row({ scope: 'node', userId: undefined }), row({ userId: 'u1' })],
          }),
        ),
      )
      await store.fetchAll('node-1')

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))
      await store.deleteRow('node-1', 'u1')

      expect(store.getUserRows('node-1')).toHaveLength(0)
      expect(store.getNodeRow('node-1')).not.toBeNull()
    })

    it('drops the node row without touching user rows', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          okJson({
            nodeUuid: 'node-1',
            quotas: [row({ scope: 'node', userId: undefined }), row({ userId: 'u1' })],
          }),
        ),
      )
      await store.fetchAll('node-1')

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }))
      await store.deleteRow('node-1', SCOPE_NODE)

      expect(store.getNodeRow('node-1')).toBeNull()
      expect(store.getUserRows('node-1')).toHaveLength(1)
    })

    // A failed save must surface, not be swallowed — the caller shows a toast.
    it('throws on a non-2xx write', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad scope') }),
      )

      await expect(store.putRow('node-1', SCOPE_NODE, {})).rejects.toThrow(/400.*bad scope/)
    })
  })

  it('records a load failure without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('forbidden') }),
    )

    await store.fetchAll('node-1')

    expect(store.getError('node-1').message).toContain('403')
    expect(store.isLoading('node-1')).toBe(false)
  })
})
