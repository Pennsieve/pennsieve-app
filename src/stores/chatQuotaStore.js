// @/stores/chatQuotaStore.js
//
// Per-(node) LLM cost quota state shown in the chat panel header.
//
// State is keyed by computeNodeId because users can have different limits on
// different nodes (per-node quotas are how the platform models LLM cost
// governance — see account-service docs). The store fetches via HTTP rather
// than over the chat WebSocket so the meter:
//
//   1. paints before the user sends their first turn (no chat traffic yet),
//   2. stays in sync after an owner CRUD action (a single `refresh()` is
//      enough — no need to wait for the next assistant turn),
//   3. doesn't couple chat-service to the meter UX (chat-service ships
//      AssistantMessages, account-service owns quota — clean separation).
//
// The endpoint is GET /compute-nodes/{id}/user-quotas/me/effective on
// account-service, which already returns the axis-by-axis resolved limits
// plus current daily / monthly spend plus per-axis source attribution.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

// Utilization thresholds for the "warning level" getter. Values are
// fractions of cap consumed (0.8 = 80%). Color-coding lives in the
// component; the store just classifies.
const NEAR_THRESHOLD = 0.8
const OVER_THRESHOLD = 1.0

export const useChatQuotaStore = defineStore('chatQuota', () => {
  // Map<computeNodeId, EffectiveQuota>. EffectiveQuota is the shape returned
  // by the account-service /effective endpoint — see the chatUserEffectiveQuota
  // schema in account-service's OpenAPI spec.
  const quotaByNodeId = ref(new Map())
  // Map<computeNodeId, Date> — last successful fetch. Used for staleness UI
  // and to avoid hammering the endpoint on rapid prop changes.
  const fetchedAtByNodeId = ref(new Map())
  // Map<computeNodeId, boolean> — true while a fetch is in flight. Lets the
  // header render a skeleton bar instead of $0/$0 (which would look like a
  // real cap of zero).
  const loadingByNodeId = ref(new Map())
  // Map<computeNodeId, { code, message }> — last fetch error. Surfaced as a
  // subtle "couldn't load quota" pill rather than blocking the chat — users
  // can still send turns; the backend still enforces.
  const errorByNodeId = ref(new Map())

  const getQuota = (nodeId) =>
    (nodeId && quotaByNodeId.value.get(nodeId)) || null

  const isLoading = (nodeId) =>
    (nodeId && loadingByNodeId.value.get(nodeId)) || false

  const getError = (nodeId) =>
    (nodeId && errorByNodeId.value.get(nodeId)) || null

  // utilization returns a fraction of the daily (or monthly) cap consumed.
  // Returns 0 when the quota hasn't loaded yet. Can exceed 1 if the user
  // somehow blew past the cap (race between turn dispatch + cap lookup).
  const utilization = (nodeId, axis /* 'daily' | 'monthly' */) => {
    const q = getQuota(nodeId)
    if (!q) return 0
    const spent = axis === 'daily' ? q.dailySpentUsd : q.monthlySpentUsd
    const cap = axis === 'daily' ? q.dailyCostUsd : q.monthlyCostUsd
    if (!cap || cap <= 0) return 0
    return spent / cap
  }

  // warningLevel returns "ok" / "near" / "over" based on the worse of daily
  // and monthly. Drives header tint + auto-expand decisions.
  const warningLevel = (nodeId) => {
    const u = Math.max(utilization(nodeId, 'daily'), utilization(nodeId, 'monthly'))
    if (u >= OVER_THRESHOLD) return 'over'
    if (u >= NEAR_THRESHOLD) return 'near'
    return 'ok'
  }

  // fetch hits account-service for one node. Idempotent — safe to call on
  // mount + after each assistant turn + on manual refresh.
  //
  // Implementation choices:
  //   - One in-flight request per node at a time. If a fetch is already
  //     running for `nodeId`, return the existing promise instead of stacking
  //     duplicate requests (e.g. mount + first assistant message firing close
  //     together).
  //   - On HTTP error, keep any previous quota state — better to show
  //     slightly-stale numbers than blank the meter mid-conversation.
  const inflight = new Map() // nodeId -> Promise

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
        const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${encodeURIComponent(nodeId)}/user-quotas/me/effective`
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
        quotaByNodeId.value.set(nodeId, data)
        fetchedAtByNodeId.value.set(nodeId, new Date())
        return data
      } catch (e) {
        errorByNodeId.value.set(nodeId, { message: e?.message || 'fetch failed' })
        // Don't rethrow — callers don't want to deal with this; the error
        // surfaces through getError().
        return null
      } finally {
        loadingByNodeId.value.set(nodeId, false)
        inflight.delete(nodeId)
      }
    })()
    inflight.set(nodeId, p)
    return p
  }

  // Convenience refs for components that bind to a single "active node".
  // Use the action-style API (getQuota / utilization / etc.) when looping
  // over multiple nodes.
  const activeNodeId = ref(null)
  const setActiveNode = (nodeId) => {
    activeNodeId.value = nodeId || null
  }
  const activeQuota = computed(() => getQuota(activeNodeId.value))
  const activeLoading = computed(() => isLoading(activeNodeId.value))
  const activeError = computed(() => getError(activeNodeId.value))

  return {
    // state
    quotaByNodeId,
    fetchedAtByNodeId,
    loadingByNodeId,
    errorByNodeId,
    // actions
    fetch: fetch_,
    setActiveNode,
    // getters
    getQuota,
    isLoading,
    getError,
    utilization,
    warningLevel,
    activeNodeId,
    activeQuota,
    activeLoading,
    activeError,
  }
})
