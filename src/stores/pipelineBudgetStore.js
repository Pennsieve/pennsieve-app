// @/stores/pipelineBudgetStore.js
//
// Per-(node) pipeline spend + concurrency state, for the run-submission UI.
//
// Deliberately mirrors chatQuotaStore: same per-node keying, same in-flight
// dedupe, same keep-stale-numbers-on-error behaviour. Two things differ, and
// both matter for how components consume this:
//
//   1. This reads workflow-service, not account-service. account-service
//      resolves pipeline *limits* but has no access to the usage table, so it
//      can report ceilings and not spend. workflow-service owns both and runs
//      the same resolver the run-creation gate enforces — so the numbers here
//      cannot drift from what a submission will actually be judged against.
//      Note the path is `compute/workflows`, not `compute/resources`.
//
//   2. A node may have NO policy at all, and that is the common case — every
//      customer-owned node is unconfigured, because pipeline compute runs in
//      the owner's own cloud account and capping is opt-in. So `enforced:
//      false` is normal, not an error, and means *show no meter* rather than a
//      row of "unlimited" bars. Chat quotas always have a cap (they fall back
//      to a platform safety cap), so that state doesn't exist there.
//
// Endpoint: GET /compute-nodes/{nodeId}/budget on workflow-service.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

// Fractions of a cap consumed. Same thresholds as the chat meter so the two
// read consistently when both are on screen.
const NEAR_THRESHOLD = 0.8
const OVER_THRESHOLD = 1.0

// The spend axes, in the order the backend reports a block. Node axes come
// first because they outrank user axes: if the node's pot is exhausted,
// raising one user's cap achieves nothing.
const SPEND_AXES = [
  { key: 'nodeDaily', scope: 'node', period: 'daily', label: 'Node today' },
  { key: 'nodeMonthly', scope: 'node', period: 'monthly', label: 'Node this month' },
  { key: 'userDaily', scope: 'user', period: 'daily', label: 'You today' },
  { key: 'userMonthly', scope: 'user', period: 'monthly', label: 'You this month' },
]

const CONCURRENCY_AXES = [
  { key: 'nodeConcurrency', scope: 'node', label: 'Runs in flight (node)' },
  { key: 'userConcurrency', scope: 'user', label: 'Your runs in flight' },
]

export const usePipelineBudgetStore = defineStore('pipelineBudget', () => {
  // Map<computeNodeId, BudgetResponse> — see the budget endpoint's 200 schema
  // in workflow-service's OpenAPI spec.
  const budgetByNodeId = ref(new Map())
  const fetchedAtByNodeId = ref(new Map())
  // True while a fetch is in flight. Components should render a skeleton
  // rather than zeros, which would look like a real cap of $0 — a state that
  // genuinely exists (an explicit $0 cap blocks everything), so the two must
  // not be confusable.
  const loadingByNodeId = ref(new Map())
  const errorByNodeId = ref(new Map())

  const getBudget = (nodeId) => (nodeId && budgetByNodeId.value.get(nodeId)) || null
  const isLoading = (nodeId) => (nodeId && loadingByNodeId.value.get(nodeId)) || false
  const getError = (nodeId) => (nodeId && errorByNodeId.value.get(nodeId)) || null

  // isEnforced is the first thing a component should check. False means the
  // node imposes no ceilings — render nothing, not empty bars.
  const isEnforced = (nodeId) => Boolean(getBudget(nodeId)?.enforced)

  // allowed mirrors the backend's advisory verdict: would a run submitted right
  // now be admitted? Advisory only — run cost is known at finalize, so another
  // run completing or starting can change the answer between this call and a
  // submission. Fine for disabling a submit button with a real reason; not a
  // guarantee, so a 402/409 can still come back and must be handled.
  const isAllowed = (nodeId) => {
    const b = getBudget(nodeId)
    // Unknown state is not a block — the backend is authoritative and will
    // reject if needed. Blocking the UI on an unloaded meter would be worse.
    return b ? b.allowed !== false : true
  }

  const blockedAxis = (nodeId) => getBudget(nodeId)?.blockedAxis || null
  const blockedReason = (nodeId) => getBudget(nodeId)?.reason || null

  // spendAxes returns only the axes that actually impose a ceiling, ready to
  // render. Unlimited axes are omitted rather than returned with nulls, so a
  // component never has to decide whether to draw a bar for one.
  //
  // `spent` is still meaningful on an omitted axis, but without a ceiling there
  // is nothing to show it against, so it isn't surfaced here.
  const spendAxes = (nodeId) => {
    const b = getBudget(nodeId)
    if (!b) return []
    return SPEND_AXES.flatMap(({ key, scope, period, label }) => {
      const a = b[key]
      if (!a || a.unlimited) return []
      return [{
        key,
        scope,
        period,
        label,
        limitUsd: a.limitUsd,
        spentUsd: a.spentUsd,
        remainingUsd: a.remainingUsd,
        source: a.source,
        utilization: a.limitUsd > 0 ? a.spentUsd / a.limitUsd : 1,
        resetsAt: period === 'daily' ? b.dailyResetsAt : b.monthlyResetsAt,
        // An explicit $0 cap means "disabled here", not "exhausted". Copy
        // should say so — "you've spent $0.00 of $0.00" is nonsense.
        disabled: a.limitUsd === 0,
      }]
    })
  }

  // concurrencyAxes is the count-based equivalent. Kept separate from spend
  // because the unit differs (runs, not dollars) and so does the remedy: a
  // concurrency block clears when a run finishes, not on a clock, so there is
  // no reset time to show.
  const concurrencyAxes = (nodeId) => {
    const b = getBudget(nodeId)
    if (!b) return []
    return CONCURRENCY_AXES.flatMap(({ key, scope, label }) => {
      const a = b[key]
      if (!a || a.unlimited) return []
      return [{
        key,
        scope,
        label,
        limit: a.limit,
        active: a.active,
        remaining: a.remaining,
        source: a.source,
        utilization: a.limit > 0 ? a.active / a.limit : 1,
        disabled: a.limit === 0,
      }]
    })
  }

  // utilization across every capped axis, spend and concurrency alike — the
  // worst one, since that is what will block a submission.
  const worstUtilization = (nodeId) => {
    const all = [...spendAxes(nodeId), ...concurrencyAxes(nodeId)]
    return all.reduce((max, a) => Math.max(max, a.utilization), 0)
  }

  // warningLevel drives tinting. 'unenforced' is distinct from 'ok': one means
  // "no limits here", the other "limits, plenty left" — and they should not
  // look the same.
  const warningLevel = (nodeId) => {
    if (!getBudget(nodeId)) return 'unknown'
    if (!isEnforced(nodeId)) return 'unenforced'
    const u = worstUtilization(nodeId)
    if (u >= OVER_THRESHOLD) return 'over'
    if (u >= NEAR_THRESHOLD) return 'near'
    return 'ok'
  }

  // perRunUsd is the ceiling on a single run's cost, when one is configured.
  // Worth surfacing near a submit action: it is the one limit a user can hit
  // without having spent anything yet.
  const perRunUsd = (nodeId) => getBudget(nodeId)?.perRunUsd ?? null

  // One in-flight request per node. Mount plus a node-selection change can
  // fire close together; stacking duplicates would be wasteful and can land
  // out of order.
  const inflight = new Map()

  const fetch_ = async (nodeId) => {
    if (!nodeId) return null
    const existing = inflight.get(nodeId)
    if (existing) return existing

    loadingByNodeId.value.set(nodeId, true)
    errorByNodeId.value.delete(nodeId)

    const p = (async () => {
      try {
        const token = await useGetToken()
        if (!token) throw new Error('no session token')
        const url = `${siteConfig.api2Url}/compute/workflows/compute-nodes/${encodeURIComponent(nodeId)}/budget`
        const resp = await window.fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
        if (!resp.ok) {
          const body = await resp.text().catch(() => '')
          throw new Error(`HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
        }
        const data = await resp.json()
        budgetByNodeId.value.set(nodeId, data)
        fetchedAtByNodeId.value.set(nodeId, new Date())
        return data
      } catch (e) {
        errorByNodeId.value.set(nodeId, { message: e?.message || 'fetch failed' })
        // Keep any previous numbers: slightly stale is better than a blanked
        // meter, and the backend enforces regardless of what the UI shows.
        return null
      } finally {
        loadingByNodeId.value.set(nodeId, false)
        inflight.delete(nodeId)
      }
    })()
    inflight.set(nodeId, p)
    return p
  }

  // applyRunResponse folds the `budget` object returned by a successful
  // POST /runs into the store, so the meter updates without a second round
  // trip. Absent when the node is unconfigured — treated as no-op rather than
  // as a state change, since the response omits the key entirely.
  const applyRunResponse = (nodeId, runResponse) => {
    const b = runResponse?.budget
    if (!nodeId || !b) return
    const prev = budgetByNodeId.value.get(nodeId) || {}
    budgetByNodeId.value.set(nodeId, { ...prev, ...b, allowed: true, blockedAxis: null, reason: null })
    fetchedAtByNodeId.value.set(nodeId, new Date())
  }

  // applyRejection folds a 402/409 body into the store, so the meter reflects
  // the numbers that caused the rejection rather than the pre-submission ones.
  // Both statuses share this body shape by design.
  const applyRejection = (nodeId, body) => {
    if (!nodeId || !body) return
    const prev = budgetByNodeId.value.get(nodeId) || {}
    budgetByNodeId.value.set(nodeId, {
      ...prev,
      enforced: true,
      allowed: false,
      blockedAxis: body.blockedAxis ?? null,
      reason: body.reason ?? null,
      nodeDaily: body.nodeDaily ?? prev.nodeDaily,
      nodeMonthly: body.nodeMonthly ?? prev.nodeMonthly,
      userDaily: body.userDaily ?? prev.userDaily,
      userMonthly: body.userMonthly ?? prev.userMonthly,
      nodeConcurrency: body.nodeConcurrency ?? prev.nodeConcurrency,
      userConcurrency: body.userConcurrency ?? prev.userConcurrency,
    })
    fetchedAtByNodeId.value.set(nodeId, new Date())
  }

  const activeNodeId = ref(null)
  const setActiveNode = (nodeId) => {
    activeNodeId.value = nodeId || null
  }
  const activeBudget = computed(() => getBudget(activeNodeId.value))
  const activeLoading = computed(() => isLoading(activeNodeId.value))
  const activeError = computed(() => getError(activeNodeId.value))
  const activeEnforced = computed(() => isEnforced(activeNodeId.value))

  return {
    // state
    budgetByNodeId,
    fetchedAtByNodeId,
    loadingByNodeId,
    errorByNodeId,
    // actions
    fetch: fetch_,
    setActiveNode,
    applyRunResponse,
    applyRejection,
    // getters
    getBudget,
    isLoading,
    getError,
    isEnforced,
    isAllowed,
    blockedAxis,
    blockedReason,
    spendAxes,
    concurrencyAxes,
    worstUtilization,
    warningLevel,
    perRunUsd,
    activeNodeId,
    activeBudget,
    activeLoading,
    activeError,
    activeEnforced,
  }
})
