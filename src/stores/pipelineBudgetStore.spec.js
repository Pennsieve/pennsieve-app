import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/composables/useGetToken', () => ({
  useGetToken: () => Promise.resolve('test-token'),
}))
vi.mock('@/site-config/site.json', () => ({ api2Url: 'https://api.test' }))

import { usePipelineBudgetStore } from './pipelineBudgetStore'

// Shapes mirror workflow-service's budget endpoint. The two allowance families
// differ: spend axes carry limitUsd/spentUsd/remainingUsd, concurrency axes
// carry limit/active/remaining.
const unlimited = { unlimited: true, spentUsd: 0, source: 'unlimited' }
const unlimitedRuns = { unlimited: true, active: 0, source: 'unlimited' }

const spend = (limitUsd, spentUsd, source = 'node-default') => ({
  unlimited: false,
  limitUsd,
  spentUsd,
  remainingUsd: Math.max(0, limitUsd - spentUsd),
  source,
})

const runs = (limit, active, source = 'node') => ({
  unlimited: false,
  limit,
  active,
  remaining: Math.max(0, limit - active),
  source,
})

const budget = (over = {}) => ({
  computeNodeId: 'node-1',
  userId: 'user-1',
  enforced: true,
  allowed: true,
  nodeDaily: unlimited,
  nodeMonthly: unlimited,
  userDaily: unlimited,
  userMonthly: unlimited,
  nodeConcurrency: unlimitedRuns,
  userConcurrency: unlimitedRuns,
  dailyResetsAt: '2026-09-06T00:00:00Z',
  monthlyResetsAt: '2026-10-01T00:00:00Z',
  ...over,
})

describe('pipelineBudgetStore', () => {
  let store
  beforeEach(() => {
    setActivePinia(createPinia())
    store = usePipelineBudgetStore()
  })

  const seed = (b) => store.budgetByNodeId.set('node-1', b)

  // The most consequential case. Every customer-owned node is unconfigured,
  // because pipeline compute runs in the owner's own cloud account and capping
  // is opt-in — so this is the common path, not an edge case.
  it('reports unenforced nodes as having no axes to render', () => {
    seed(budget({ enforced: false }))

    expect(store.isEnforced('node-1')).toBe(false)
    expect(store.warningLevel('node-1')).toBe('unenforced')
    expect(store.spendAxes('node-1')).toEqual([])
    expect(store.concurrencyAxes('node-1')).toEqual([])
  })

  // 'unenforced' must be distinguishable from 'ok'. One means "no limits
  // here", the other "limits, plenty left" — they should not look the same.
  it('distinguishes unenforced from ok', () => {
    seed(budget({ enforced: false }))
    expect(store.warningLevel('node-1')).toBe('unenforced')

    seed(budget({ userDaily: spend(10, 1) }))
    expect(store.warningLevel('node-1')).toBe('ok')
  })

  it('omits unlimited axes rather than returning them with nulls', () => {
    seed(budget({ userDaily: spend(5, 1) }))

    const axes = store.spendAxes('node-1')
    expect(axes).toHaveLength(1)
    expect(axes[0].key).toBe('userDaily')
    expect(axes[0].source).toBe('node-default')
    expect(axes[0].remainingUsd).toBe(4)
  })

  it('orders spend axes node-first, matching how the backend reports a block', () => {
    seed(budget({ nodeDaily: spend(20, 1), userDaily: spend(5, 1) }))

    expect(store.spendAxes('node-1').map((a) => a.key)).toEqual(['nodeDaily', 'userDaily'])
  })

  it('surfaces concurrency axes separately from spend', () => {
    seed(budget({ userDaily: spend(5, 1), nodeConcurrency: runs(3, 2) }))

    expect(store.spendAxes('node-1').map((a) => a.key)).toEqual(['userDaily'])
    const conc = store.concurrencyAxes('node-1')
    expect(conc).toHaveLength(1)
    expect(conc[0]).toMatchObject({ key: 'nodeConcurrency', limit: 3, active: 2, remaining: 1 })
  })

  // An explicit zero is a real limit meaning "switched off here", not an
  // exhausted allowance. Copy has to differ, so the store flags it.
  it('flags an explicit zero cap as disabled rather than exhausted', () => {
    seed(budget({ userDaily: spend(0, 0) }))

    const axis = store.spendAxes('node-1')[0]
    expect(axis.disabled).toBe(true)
    expect(axis.utilization).toBe(1)
    expect(store.warningLevel('node-1')).toBe('over')
  })

  it('flags a zero concurrency limit as disabled', () => {
    seed(budget({ nodeConcurrency: runs(0, 0) }))
    expect(store.concurrencyAxes('node-1')[0].disabled).toBe(true)
  })

  it('takes the worst utilization across spend and concurrency together', () => {
    seed(budget({ userDaily: spend(10, 1), nodeConcurrency: runs(4, 3) }))

    // 0.1 spend vs 0.75 concurrency — concurrency is what a submission hits
    // first, so it has to be the one that drives the meter even though the
    // units differ.
    expect(store.worstUtilization('node-1')).toBeCloseTo(0.75)
    expect(store.warningLevel('node-1')).toBe('ok')
  })

  // Pin the warning threshold, since 'near' is what makes a user notice before
  // they are blocked rather than after.
  it('warns at 80% of the tightest axis', () => {
    seed(budget({ nodeConcurrency: runs(5, 3) })) // 0.6
    expect(store.warningLevel('node-1')).toBe('ok')

    seed(budget({ nodeConcurrency: runs(5, 4) })) // 0.8
    expect(store.warningLevel('node-1')).toBe('near')

    seed(budget({ userDaily: spend(10, 8) })) // 0.8 on a spend axis too
    expect(store.warningLevel('node-1')).toBe('near')
  })

  it('reports over when any single axis is at its ceiling', () => {
    seed(budget({ userDaily: spend(5, 1), userConcurrency: runs(2, 2) }))
    expect(store.warningLevel('node-1')).toBe('over')
  })

  // An unloaded meter must not block the UI: the backend is authoritative and
  // will reject if needed, so defaulting to blocked would stop legitimate work
  // whenever a fetch is slow.
  it('treats unknown state as allowed', () => {
    expect(store.getBudget('node-1')).toBeNull()
    expect(store.isAllowed('node-1')).toBe(true)
    expect(store.warningLevel('node-1')).toBe('unknown')
  })

  it('reports the blocked axis and reason when disallowed', () => {
    seed(budget({
      allowed: false,
      blockedAxis: 'user-daily',
      reason: 'your daily pipeline spend of $5.00 ... cap of $5.00',
      userDaily: spend(5, 5),
    }))

    expect(store.isAllowed('node-1')).toBe(false)
    expect(store.blockedAxis('node-1')).toBe('user-daily')
    expect(store.blockedReason('node-1')).toContain('daily pipeline spend')
  })

  it('exposes a per-run ceiling when configured, null otherwise', () => {
    seed(budget({ perRunUsd: 0.25 }))
    expect(store.perRunUsd('node-1')).toBe(0.25)

    seed(budget())
    expect(store.perRunUsd('node-1')).toBeNull()
  })

  // POST /runs returns the post-admission allowance, so the meter can update
  // without a second round trip.
  it('folds a run response into state and clears any prior block', () => {
    seed(budget({ allowed: false, blockedAxis: 'user-daily', reason: 'spent' }))

    store.applyRunResponse('node-1', {
      executionRunId: 'r1',
      budget: { enforced: true, userDaily: spend(5, 2) },
    })

    expect(store.isAllowed('node-1')).toBe(true)
    expect(store.blockedAxis('node-1')).toBeNull()
    expect(store.spendAxes('node-1')[0].remainingUsd).toBe(3)
  })

  // An unconfigured node omits `budget` from the response entirely — that is
  // absence of data, not a state change, so it must not blank the store.
  it('ignores a run response with no budget object', () => {
    seed(budget({ userDaily: spend(5, 2) }))
    store.applyRunResponse('node-1', { executionRunId: 'r1' })
    expect(store.spendAxes('node-1')).toHaveLength(1)
  })

  // 402 and 409 share one body shape by design, so one handler covers both.
  it('folds a rejection body into state', () => {
    seed(budget({ userConcurrency: runs(2, 1) }))

    store.applyRejection('node-1', {
      error: 'concurrency_limit_reached',
      blockedAxis: 'user-concurrency',
      reason: 'you already have 2 runs in flight',
      userConcurrency: runs(2, 2),
    })

    expect(store.isAllowed('node-1')).toBe(false)
    expect(store.blockedAxis('node-1')).toBe('user-concurrency')
    expect(store.concurrencyAxes('node-1')[0].remaining).toBe(0)
  })

  it('keeps previous figures when a fetch fails', async () => {
    seed(budget({ userDaily: spend(5, 2) }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve('down') }))

    await store.fetch('node-1')

    expect(store.getError('node-1')).toBeTruthy()
    expect(store.spendAxes('node-1')[0].spentUsd).toBe(2)
    expect(store.isLoading('node-1')).toBe(false)
  })

  it('dedupes concurrent fetches for the same node', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(budget()) })
    vi.stubGlobal('fetch', f)

    await Promise.all([store.fetch('node-1'), store.fetch('node-1')])

    expect(f).toHaveBeenCalledTimes(1)
  })

  it('calls workflow-service, not account-service', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(budget()) })
    vi.stubGlobal('fetch', f)

    await store.fetch('node-1')

    const url = f.mock.calls[0][0]
    expect(url).toContain('/compute/workflows/compute-nodes/node-1/budget')
    // account-service resolves limits but cannot report spend — reading it here
    // would give figures that drift from what the gate enforces.
    expect(url).not.toContain('/compute/resources/')
  })
})
