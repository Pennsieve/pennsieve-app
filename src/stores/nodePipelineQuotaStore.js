// @/stores/nodePipelineQuotaStore.js
//
// Owner-side CRUD for a compute node's *pipeline* spend policy — the caps the
// run-creation gate in workflow-service enforces before a workflow starts.
//
// Three sibling stores exist and they are easy to confuse, so:
//
//   nodeLlmBudgetStore      node-wide LLM cost cap (SSM, enforced by the
//                           governor on every Bedrock invocation).
//   chatQuotaAdminStore     per-user LLM chat quotas.
//   this one                per-node and per-user *pipeline* caps: dollars per
//                           UTC day/month, dollars per single run, and
//                           simultaneous in-flight runs.
//
// Account-service endpoints (writes are owner-only for every scope — a user
// raising their own cap would defeat the point):
//
//   GET    /compute/resources/compute-nodes/{id}/pipeline-quotas
//   PUT    /compute/resources/compute-nodes/{id}/pipeline-quotas/{scope}
//   DELETE /compute/resources/compute-nodes/{id}/pipeline-quotas/{scope}
//
// `scope` is `node`, `default`, or a user node id.
//
// Two things about the wire shape drive the design here:
//
//   1. Every limit is nullable, and null is NOT zero. null means "this row sets
//      no limit on this axis", so resolution falls through to the next tier and
//      ultimately to unlimited. An explicit 0 is a real cap meaning "block
//      everything". The two must survive the round trip distinctly, which is
//      why payloads send explicit nulls rather than omitting keys.
//
//   2. Unlimited is the default, unlike the LLM axes which fall back to a small
//      platform safety cap. Pipeline compute runs in the node owner's own AWS
//      account, so defaulting a customer-owned node to a few dollars a day
//      would throttle work the customer is already paying for.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

// Scope path segments. `node` caps all users combined; `default` is the
// per-user fallback; anything else is a user node id.
export const SCOPE_NODE = 'node'
export const SCOPE_DEFAULT = 'default'

// The four axes a policy row can set, in the order they're rendered. Kept here
// so the store, the panel and the modal cannot drift apart on field names.
//
// `perRunCostUsd` is absent from the node scope on purpose: a per-run ceiling
// is a property of a single run, not a node-wide aggregate, and account-service
// rejects it there with a 400 rather than silently storing a value the resolver
// would ignore.
export const AXES = [
  { key: 'dailyCostUsd', label: 'Daily', unit: 'usd', step: 1 },
  { key: 'monthlyCostUsd', label: 'Monthly', unit: 'usd', step: 10 },
  { key: 'perRunCostUsd', label: 'Per run', unit: 'usd', step: 0.5, nodeScope: false },
  { key: 'maxConcurrentRuns', label: 'Concurrent runs', unit: 'count', step: 1 },
]

export const axesForScope = (scope) =>
  AXES.filter((a) => a.nodeScope !== false || scope !== SCOPE_NODE)

const base = (nodeId) =>
  `${siteConfig.api2Url}/compute/resources/compute-nodes/${encodeURIComponent(nodeId)}/pipeline-quotas`

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

async function assertOk(resp) {
  if (resp.ok) return resp
  const body = await resp.text().catch(() => '')
  throw new Error(`HTTP ${resp.status}${body ? `: ${body.slice(0, 200)}` : ''}`)
}

export const useNodePipelineQuotaStore = defineStore('nodePipelineQuota', () => {
  // Map<nodeId, NodeQuota[]> — every policy row on the node, all three tiers.
  const rowsByNodeId = ref(new Map())
  const loadingByNodeId = ref(new Map())
  const errorByNodeId = ref(new Map())

  const getRows = (nodeId) => (nodeId && rowsByNodeId.value.get(nodeId)) || []
  const isLoading = (nodeId) => (nodeId && loadingByNodeId.value.get(nodeId)) || false
  const getError = (nodeId) => (nodeId && errorByNodeId.value.get(nodeId)) || null

  const getNodeRow = (nodeId) => getRows(nodeId).find((r) => r.scope === 'node') || null
  const getDefaultRow = (nodeId) => getRows(nodeId).find((r) => r.scope === 'default') || null
  const getUserRows = (nodeId) => getRows(nodeId).filter((r) => r.scope === 'user')

  // True when the node imposes no pipeline ceilings at all — the normal state
  // for a customer-owned node, and the state in which the meter renders
  // nothing.
  const isConfigured = (nodeId) => getRows(nodeId).length > 0

  const inflight = new Map()

  const fetchAll = async (nodeId) => {
    if (!nodeId) return []
    const existing = inflight.get(nodeId)
    if (existing) return existing

    loadingByNodeId.value.set(nodeId, true)
    errorByNodeId.value.delete(nodeId)

    const p = (async () => {
      try {
        const resp = await assertOk(await authedFetch(base(nodeId), { method: 'GET' }))
        const data = await resp.json()
        const rows = Array.isArray(data?.quotas) ? data.quotas : []
        rowsByNodeId.value.set(nodeId, rows)
        return rows
      } catch (e) {
        errorByNodeId.value.set(nodeId, { message: e?.message || 'fetch failed' })
        return []
      } finally {
        loadingByNodeId.value.set(nodeId, false)
        inflight.delete(nodeId)
      }
    })()
    inflight.set(nodeId, p)
    return p
  }

  // putRow replaces one policy row. PUT is a full replace, not a merge, so the
  // payload must carry every axis — an omitted key clears that axis rather than
  // leaving it alone. normalizePayload below makes that explicit.
  const putRow = async (nodeId, scope, payload) => {
    if (!nodeId) throw new Error('nodeId is required')
    if (!scope) throw new Error('scope is required')
    const resp = await assertOk(
      await authedFetch(`${base(nodeId)}/${encodeURIComponent(scope)}`, {
        method: 'PUT',
        body: JSON.stringify(normalizePayload(scope, payload)),
      }),
    )
    const row = await resp.json()
    upsertRow(nodeId, row)
    return row
  }

  const deleteRow = async (nodeId, scope) => {
    if (!nodeId) throw new Error('nodeId is required')
    if (!scope) throw new Error('scope is required')
    await assertOk(
      await authedFetch(`${base(nodeId)}/${encodeURIComponent(scope)}`, { method: 'DELETE' }),
    )
    // 204 has no body, so drop the row locally rather than refetching.
    const key = scope === SCOPE_NODE ? 'node' : scope === SCOPE_DEFAULT ? 'default' : scope
    rowsByNodeId.value.set(
      nodeId,
      getRows(nodeId).filter((r) =>
        key === 'node' || key === 'default' ? r.scope !== key : r.userId !== key,
      ),
    )
  }

  // Replace in place if the row already exists, so the panel updates without a
  // refetch and without reordering the overrides table under the user's cursor.
  const upsertRow = (nodeId, row) => {
    const rows = [...getRows(nodeId)]
    const i = rows.findIndex((r) =>
      row.scope === 'user' ? r.scope === 'user' && r.userId === row.userId : r.scope === row.scope,
    )
    if (i >= 0) rows[i] = row
    else rows.push(row)
    rowsByNodeId.value.set(nodeId, rows)
  }

  return {
    rowsByNodeId,
    loadingByNodeId,
    errorByNodeId,
    fetchAll,
    putRow,
    deleteRow,
    getRows,
    getNodeRow,
    getDefaultRow,
    getUserRows,
    isConfigured,
    isLoading,
    getError,
  }
})

// normalizePayload sends every axis valid for the scope, explicitly null when
// unset, and drops the rest.
//
// The explicit nulls matter: PUT replaces the row, so an omitted key would clear
// the axis anyway — but sending null says so at the call site instead of relying
// on that. And `perRunCostUsd` is stripped on the node scope because
// account-service 400s on it rather than storing a value the resolver ignores;
// a blank field would otherwise turn a valid save into an error the user can't
// act on.
export function normalizePayload(scope, form) {
  const out = { notes: form?.notes || '' }
  for (const axis of axesForScope(scope)) {
    const v = form?.[axis.key]
    out[axis.key] = v === '' || v === undefined ? null : v
  }
  return out
}
