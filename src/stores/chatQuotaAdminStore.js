// @/stores/chatQuotaAdminStore.js
//
// Owner-side state for the compute-node quota management UI.
//
// Distinct from chatQuotaStore (per-user effective view shown in the chat
// header) — this one owns the *list* of explicit quota rows on a node, plus
// the create / update / delete actions an owner uses to set caps. The chat
// header reads /effective and never mutates; this store reads /user-quotas
// (list) and PUT/DELETE per row.
//
// Account-service endpoints (owner-only on list/PUT/DELETE):
//   GET    /compute/resources/compute-nodes/{id}/user-quotas
//   PUT    /compute/resources/compute-nodes/{id}/user-quotas/{userId}
//   DELETE /compute/resources/compute-nodes/{id}/user-quotas/{userId}
//
// Rows are keyed by userId. The "__default__" sentinel is a normal row to the
// API; consumers split it out for display (pinned default card vs. per-user
// table).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

export const DEFAULT_USER_SENTINEL = '__default__'

const baseUrl = (nodeId) =>
  `${siteConfig.api2Url}/compute/resources/compute-nodes/${encodeURIComponent(nodeId)}/user-quotas`

async function authedFetch(url, init = {}) {
  const token = await useGetToken()
  if (!token) throw new Error('no session token')
  return window.fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

export const useChatQuotaAdminStore = defineStore('chatQuotaAdmin', () => {
  // Map<nodeId, Map<userId, QuotaRow>>. QuotaRow shape matches what
  // account-service returns from list/get — see effectiveQuotaResponse in the
  // handler, minus the resolved-limits envelope (those are computed lazily by
  // the GET .../effective endpoint, not stored as rows).
  const rowsByNodeId = ref(new Map())
  const loadingByNodeId = ref(new Map())
  const errorByNodeId = ref(new Map())

  const getRows = (nodeId) => {
    const m = nodeId && rowsByNodeId.value.get(nodeId)
    return m ? Array.from(m.values()) : []
  }

  const getRow = (nodeId, userId) => {
    const m = nodeId && rowsByNodeId.value.get(nodeId)
    return (m && m.get(userId)) || null
  }

  const getDefaultRow = (nodeId) => getRow(nodeId, DEFAULT_USER_SENTINEL)

  // Per-user rows (excludes the default sentinel) — what the table renders.
  const getUserRows = (nodeId) =>
    getRows(nodeId).filter((r) => r.userId !== DEFAULT_USER_SENTINEL)

  const isLoading = (nodeId) =>
    (nodeId && loadingByNodeId.value.get(nodeId)) || false

  const getError = (nodeId) =>
    (nodeId && errorByNodeId.value.get(nodeId)) || null

  // In-flight dedupe per node — the section may mount multiple times in dev
  // hot-reload, and we don't want stacked list requests.
  const inflightList = new Map()

  const fetchAll = async (nodeId) => {
    if (!nodeId) return []
    const existing = inflightList.get(nodeId)
    if (existing) return existing

    loadingByNodeId.value.set(nodeId, true)
    errorByNodeId.value.delete(nodeId)

    const p = (async () => {
      try {
        const resp = await authedFetch(baseUrl(nodeId), { method: 'GET' })
        if (!resp.ok) {
          const body = await resp.text().catch(() => '')
          throw new Error(`HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
        }
        const data = await resp.json()
        const rows = Array.isArray(data?.quotas) ? data.quotas : []
        const m = new Map()
        for (const r of rows) {
          if (r?.userId) m.set(r.userId, r)
        }
        rowsByNodeId.value.set(nodeId, m)
        return rows
      } catch (e) {
        errorByNodeId.value.set(nodeId, { message: e?.message || 'fetch failed' })
        return []
      } finally {
        loadingByNodeId.value.set(nodeId, false)
        inflightList.delete(nodeId)
      }
    })()
    inflightList.set(nodeId, p)
    return p
  }

  // putRow creates-or-replaces a quota row. `payload` should contain the
  // editable fields only; the API fills in updatedBy / updatedAt server-side.
  // Pass `null` (not undefined) for an axis to explicitly clear the cap.
  const putRow = async (nodeId, userId, payload) => {
    if (!nodeId || !userId) throw new Error('nodeId and userId are required')
    const resp = await authedFetch(
      `${baseUrl(nodeId)}/${encodeURIComponent(userId)}`,
      { method: 'PUT', body: JSON.stringify(payload || {}) },
    )
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
    }
    const row = await resp.json()
    const m = rowsByNodeId.value.get(nodeId) || new Map()
    m.set(row.userId, row)
    rowsByNodeId.value.set(nodeId, new Map(m))
    return row
  }

  const deleteRow = async (nodeId, userId) => {
    if (!nodeId || !userId) throw new Error('nodeId and userId are required')
    const resp = await authedFetch(
      `${baseUrl(nodeId)}/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    )
    if (!resp.ok && resp.status !== 404) {
      const body = await resp.text().catch(() => '')
      throw new Error(`HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
    }
    const m = rowsByNodeId.value.get(nodeId)
    if (m) {
      m.delete(userId)
      rowsByNodeId.value.set(nodeId, new Map(m))
    }
  }

  return {
    DEFAULT_USER_SENTINEL,
    // state
    rowsByNodeId,
    loadingByNodeId,
    errorByNodeId,
    // actions
    fetchAll,
    putRow,
    deleteRow,
    // getters
    getRows,
    getRow,
    getDefaultRow,
    getUserRows,
    isLoading,
    getError,
  }
})
