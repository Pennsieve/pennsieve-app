// @/stores/chatStore.js
//
// Pinia store for chat conversations. The store owns a `conversations` Map
// keyed by a context string ("workspace:<orgId>" or "dataset:<datasetId>"),
// so the same store backs the workspace-overview chat and the per-dataset
// chat without state collisions.
//
// The WebSocket instance itself does NOT live in the store — see
// useChatSocket.js. Pinia reactive proxies of a WebSocket would be wasted
// overhead and cause noise about un-proxyable types.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const newSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // RFC4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const newConversation = ({ mode, orgId, datasetId, computeNodeId }) => ({
  mode,
  orgId,
  datasetId: datasetId || null,
  computeNodeId,
  sessionId: newSessionId(),
  messages: [],
  pending: false,
  activeTools: [],
  connectionState: 'idle', // 'idle' | 'connecting' | 'open' | 'reconnecting' | 'error'
  lastError: null,
})

export const contextKey = ({ mode, orgId, datasetId }) => {
  if (mode === 'dataset') return `dataset:${datasetId}`
  return `workspace:${orgId}`
}

export const useChatStore = defineStore('chat', () => {
  // Map<contextKey, Conversation>
  const conversations = ref(new Map())

  const getConversation = computed(() => (key) => conversations.value.get(key) || null)

  const ensureConversation = ({ mode, orgId, datasetId, computeNodeId }) => {
    const key = contextKey({ mode, orgId, datasetId })
    let convo = conversations.value.get(key)
    if (!convo) {
      convo = newConversation({ mode, orgId, datasetId, computeNodeId })
      conversations.value.set(key, convo)
    } else if (computeNodeId && convo.computeNodeId !== computeNodeId) {
      // User changed compute node — reset the conversation so the next
      // turn goes to the new node with a clean slate.
      convo = newConversation({ mode, orgId, datasetId, computeNodeId })
      conversations.value.set(key, convo)
    }
    return convo
  }

  const resetConversation = (key) => {
    const existing = conversations.value.get(key)
    if (!existing) return
    conversations.value.set(key, newConversation({
      mode: existing.mode,
      orgId: existing.orgId,
      datasetId: existing.datasetId,
      computeNodeId: existing.computeNodeId,
    }))
  }

  const appendUserMessage = (key, content) => {
    const convo = conversations.value.get(key)
    if (!convo) return
    convo.messages.push({ role: 'user', content })
    convo.pending = true
    convo.activeTools = []
    convo.lastError = null
  }

  // Apply a single inbound frame from the WebSocket.
  const handleIncomingFrame = (key, frame) => {
    const convo = conversations.value.get(key)
    if (!convo) return

    switch (frame.type) {
      case 'tool_progress': {
        const idx = convo.activeTools.findIndex((t) => t.name === frame.name && t.status === 'running')
        if (frame.status === 'running') {
          if (idx === -1) {
            convo.activeTools.push({ name: frame.name, status: 'running' })
          }
        } else if (frame.status === 'done') {
          if (idx !== -1) convo.activeTools[idx] = { ...convo.activeTools[idx], status: 'done' }
          else convo.activeTools.push({ name: frame.name, status: 'done' })
        } else if (frame.status === 'error') {
          const tool = { name: frame.name, status: 'error', message: frame.message }
          if (idx !== -1) convo.activeTools[idx] = tool
          else convo.activeTools.push(tool)
        }
        return
      }
      case 'message': {
        convo.messages.push({
          role: 'assistant',
          content: frame.content || '',
          usage: frame.usage,
          // Backend-supplied list of dataset node IDs the assistant
          // acted on during this turn (per chat-integration.md §3.2.2).
          // Used to render "currently discussing" pills in the panel.
          referencedDatasets: Array.isArray(frame.referencedDatasets)
            ? frame.referencedDatasets
            : [],
        })
        convo.pending = false
        convo.activeTools = []
        return
      }
      case 'blocked': {
        convo.messages.push({
          role: 'assistant',
          content: frame.message || "I can't help with that request.",
          blocked: true,
        })
        convo.pending = false
        convo.activeTools = []
        return
      }
      case 'error': {
        console.warn('[chat] backend error frame', frame)
        convo.lastError = { code: frame.code || 'INTERNAL', message: frame.message || 'Something went wrong' }
        convo.pending = false
        return
      }
      default:
        // Forward-compatible: ignore unknown frame types (spec §13).
        return
    }
  }

  const setConnectionState = (key, state, error = null) => {
    const convo = conversations.value.get(key)
    if (!convo) return
    convo.connectionState = state
    if (error) convo.lastError = error
  }

  const clearError = (key) => {
    const convo = conversations.value.get(key)
    if (!convo) return
    convo.lastError = null
  }

  const markFailedTurn = (key, message) => {
    const convo = conversations.value.get(key)
    if (!convo) return
    convo.pending = false
    convo.activeTools = []
    // Don't overwrite a more specific error (e.g. WS close code) that
    // already landed from the socket's onclose/onerror handlers.
    if (!convo.lastError) {
      convo.lastError = { code: 'CLIENT', message }
    }
  }

  return {
    conversations,
    getConversation,
    ensureConversation,
    resetConversation,
    appendUserMessage,
    handleIncomingFrame,
    setConnectionState,
    clearError,
    markFailedTurn,
  }
})

// Persisted compute-node choice per workspace (orgId).
// Lives in localStorage so it survives page reloads but stays per-browser.
const COMPUTE_NODE_KEY = (orgId) => `pennsieve.chat.computeNode.${orgId}`

export const getRememberedComputeNode = (orgId) => {
  try {
    return window.localStorage.getItem(COMPUTE_NODE_KEY(orgId)) || null
  } catch {
    return null
  }
}

export const rememberComputeNode = (orgId, nodeId) => {
  try {
    window.localStorage.setItem(COMPUTE_NODE_KEY(orgId), nodeId)
  } catch {
    // ignore (private mode, full disk, etc.)
  }
}

export const forgetComputeNode = (orgId) => {
  try {
    window.localStorage.removeItem(COMPUTE_NODE_KEY(orgId))
  } catch {
    // ignore
  }
}
