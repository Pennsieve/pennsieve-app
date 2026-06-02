// @/composables/useChatSessions.js
//
// Thin client for the compute-node-chat "chat-sessions" REST API
// (api2.pennsieve.{net,io}/chat). Backs the chat panel's session-history
// dropdown: list recent sessions, load a session's message history on
// resume, and rename / pin / delete.
//
// Auth mirrors the other api2 callers (see useMetricsCounters): a Cognito
// bearer token from useGetToken plus the workspace `organization_id` query
// param the shared pennsieve-go-api authorizer requires on every request.
//
// All methods throw on a non-2xx response; callers surface the error in the
// dropdown. This is intentionally NOT a Pinia store — it's stateless request
// plumbing. Resumed history is written into the chat store via
// hydrateConversation.

import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

export function useChatSessions() {
  const store = useStore()

  // Base URL + the two things every request needs: bearer token and the
  // org identity source. Resolved per-call so a workspace switch is picked
  // up without re-instantiating the composable.
  const authParts = async () => {
    const token = await useGetToken()
    const orgId = store.state.activeOrganization?.organization?.id
    // Prefer runtime config (vuex), fall back to the bundled site.json.
    const base = store.state.config?.chatRestUrl || siteConfig.chatRestUrl
    if (!base) throw new Error('chatRestUrl is not configured')
    if (!orgId) throw new Error('No active organization')
    return { token, orgId, base }
  }

  const request = async (path, { method = 'GET', query = {}, body } = {}) => {
    const { token, orgId, base } = await authParts()
    const params = new URLSearchParams({ organization_id: orgId, ...query })
    const resp = await fetch(`${base}${path}?${params}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!resp.ok) {
      throw new Error(`chat-sessions ${method} ${path} failed (${resp.status})`)
    }
    // 204 No Content (delete) has no body to parse.
    if (resp.status === 204) return null
    return resp.json()
  }

  // GET /chat-sessions?cursor=&limit= → { sessions, nextCursor }
  const listSessions = ({ cursor, limit = 20 } = {}) =>
    request('/chat-sessions', { query: { limit, ...(cursor ? { cursor } : {}) } })

  // GET /chat-sessions/{id} → session
  const getSession = (id) => request(`/chat-sessions/${id}`)

  // GET /chat-sessions/{id}/messages?cursor=&limit=&direction=
  //   → { messages, nextCursor }
  const listMessages = (id, { cursor, limit = 50, direction } = {}) =>
    request(`/chat-sessions/${id}/messages`, {
      query: {
        limit,
        ...(cursor ? { cursor } : {}),
        ...(direction ? { direction } : {}),
      },
    })

  // PATCH /chat-sessions/{id} {title} → session
  const renameSession = (id, title) =>
    request(`/chat-sessions/${id}`, { method: 'PATCH', body: { title } })

  // PATCH /chat-sessions/{id} {pinned} → session
  const setPinned = (id, pinned) =>
    request(`/chat-sessions/${id}`, { method: 'PATCH', body: { pinned } })

  // DELETE /chat-sessions/{id} → 204
  const deleteSession = (id) =>
    request(`/chat-sessions/${id}`, { method: 'DELETE' })

  return {
    listSessions,
    getSession,
    listMessages,
    renameSession,
    setPinned,
    deleteSession,
  }
}
