// @/stores/nodeLlmBudgetStore.js
//
// Owner-side state for the node-wide LLM cost budget — the SSM-backed cap
// the governor enforces on every Bedrock invocation. This is independent
// of the per-user chat quotas (chatQuotaAdminStore.js): the node budget
// caps total spend across all users *and* applies to workflow
// applications, while per-user quotas only gate chat-service turns.
//
// Account-service endpoints (owner-only):
//   GET  /compute/resources/compute-nodes/{id}/llm-config
//   PUT  /compute/resources/compute-nodes/{id}/llm-config
//
// Wire shape mirrors the SSM JSON the governor reads:
//   { budgetUsd: number, budgetPeriod: "daily" | "monthly" }

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

const url = (nodeId) =>
  `${siteConfig.api2Url}/compute/resources/compute-nodes/${encodeURIComponent(nodeId)}/llm-config`

async function authedFetch(u, init = {}) {
  const token = await useGetToken()
  if (!token) throw new Error('no session token')
  return window.fetch(u, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

export const useNodeLlmBudgetStore = defineStore('nodeLlmBudget', () => {
  // Map<nodeId, { budgetUsd, budgetPeriod }>
  const configByNodeId = ref(new Map())
  const loadingByNodeId = ref(new Map())
  const errorByNodeId = ref(new Map())

  const getConfig = (nodeId) =>
    (nodeId && configByNodeId.value.get(nodeId)) || null

  const isLoading = (nodeId) =>
    (nodeId && loadingByNodeId.value.get(nodeId)) || false

  const getError = (nodeId) =>
    (nodeId && errorByNodeId.value.get(nodeId)) || null

  const inflight = new Map()

  const fetch_ = async (nodeId) => {
    if (!nodeId) return null
    const existing = inflight.get(nodeId)
    if (existing) return existing

    loadingByNodeId.value.set(nodeId, true)
    errorByNodeId.value.delete(nodeId)

    const p = (async () => {
      try {
        const resp = await authedFetch(url(nodeId), { method: 'GET' })
        // 503 = "LLM not enabled on this node" — surface as null config
        // rather than an error; UI hides the section in that case.
        if (resp.status === 503) {
          configByNodeId.value.set(nodeId, null)
          return null
        }
        if (!resp.ok) {
          const body = await resp.text().catch(() => '')
          throw new Error(`HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
        }
        const data = await resp.json()
        configByNodeId.value.set(nodeId, data)
        return data
      } catch (e) {
        errorByNodeId.value.set(nodeId, { message: e?.message || 'fetch failed' })
        return null
      } finally {
        loadingByNodeId.value.set(nodeId, false)
        inflight.delete(nodeId)
      }
    })()
    inflight.set(nodeId, p)
    return p
  }

  const put = async (nodeId, payload) => {
    if (!nodeId) throw new Error('nodeId is required')
    const resp = await authedFetch(url(nodeId), {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
    }
    const data = await resp.json()
    configByNodeId.value.set(nodeId, data)
    return data
  }

  return {
    configByNodeId,
    loadingByNodeId,
    errorByNodeId,
    fetch: fetch_,
    put,
    getConfig,
    isLoading,
    getError,
  }
})
