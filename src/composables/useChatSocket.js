// @/composables/useChatSocket.js
//
// One WebSocket per active conversation context. Sockets live in a module-
// private map keyed by `contextKey` so the Pinia store stays free of
// non-reactive WS instances.

import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'
import { useChatStore, contextKey } from '@/stores/chatStore'

const sockets = new Map() // contextKey -> WebSocket

const buildUrl = ({ token, orgId, computeNodeId, datasetId, sessionId }) => {
  const params = new URLSearchParams()
  params.set('token', token)
  params.set('orgId', orgId)
  params.set('computeNodeId', computeNodeId)
  if (datasetId) params.set('datasetId', datasetId)
  if (sessionId) params.set('sessionId', sessionId)
  return `${siteConfig.chatWsUrl}?${params.toString()}`
}

export function useChatSocket() {
  const store = useChatStore()

  const connect = async ({ mode, orgId, datasetId, computeNodeId }) => {
    const key = contextKey({ mode, orgId, datasetId })
    const convo = store.ensureConversation({ mode, orgId, datasetId, computeNodeId })

    // Already open or connecting — reuse.
    const existing = sockets.get(key)
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing
    }

    store.setConnectionState(key, 'connecting')

    let token
    try {
      token = await useGetToken()
    } catch (e) {
      store.setConnectionState(key, 'error', { code: 'AUTH', message: 'Could not retrieve session token' })
      throw e
    }

    if (!token) {
      store.setConnectionState(key, 'error', { code: 'AUTH', message: 'No session token available' })
      throw new Error('No session token')
    }

    const url = buildUrl({
      token,
      orgId,
      computeNodeId,
      datasetId,
      sessionId: convo.sessionId,
    })

    const ws = new WebSocket(url)
    sockets.set(key, ws)

    ws.onopen = () => {
      store.setConnectionState(key, 'open')
    }
    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data)
        store.handleIncomingFrame(key, frame)
      } catch (e) {
        console.error('chat: failed to parse incoming frame', e, event.data)
      }
    }
    ws.onerror = () => {
      // Don't surface raw error events — onclose runs next with diagnostic info.
    }
    ws.onclose = (event) => {
      sockets.delete(key)
      // 1000 / 1001 are clean closes; anything else suggests a problem.
      const wasClean = event.code === 1000 || event.code === 1001
      if (!wasClean) {
        store.setConnectionState(key, 'error', {
          code: `WS_CLOSE_${event.code}`,
          message: event.reason || 'Chat connection closed unexpectedly',
        })
      } else {
        store.setConnectionState(key, 'idle')
      }
    }

    return ws
  }

  const sendUserMessage = async ({ mode, orgId, datasetId, computeNodeId, content, attachments }) => {
    const key = contextKey({ mode, orgId, datasetId })
    const trimmed = (content || '').trim()
    if (!trimmed) return

    // Create the conversation entry before appending — without this,
    // appendUserMessage no-ops on the first send (the convo doesn't
    // exist until connect() runs below), and we end up sending an
    // empty messages array (server rejects with EMPTY_REQUEST).
    //
    // `attachments` (optional, from Spotlight's current-page auto-attach)
    // is stored on the message as structured metadata so the UI can
    // render chips. The LLM-visible prefix is re-derived when we build
    // the wire payload below — keeping the rendered + serialized forms
    // separate.
    store.ensureConversation({ mode, orgId, datasetId, computeNodeId })
    store.appendUserMessage(key, trimmed, attachments)

    let ws = sockets.get(key)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      try {
        ws = await connect({ mode, orgId, datasetId, computeNodeId })
      } catch (e) {
        store.markFailedTurn(key, 'Could not connect to chat service')
        return
      }
      if (ws.readyState !== WebSocket.OPEN) {
        await new Promise((resolve, reject) => {
          const onOpen = () => {
            ws.removeEventListener('open', onOpen)
            ws.removeEventListener('close', onClose)
            resolve()
          }
          const onClose = () => {
            ws.removeEventListener('open', onOpen)
            ws.removeEventListener('close', onClose)
            reject(new Error('socket closed before open'))
          }
          ws.addEventListener('open', onOpen)
          ws.addEventListener('close', onClose)
        }).catch(() => {})
      }
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      store.markFailedTurn(key, 'Chat connection is not ready')
      return
    }

    const convo = store.getConversation(key)
    // Walk the conversation and serialize each turn for the wire.
    // For user messages that carry structured attachments (Spotlight
    // auto-attach today; @-mentions etc. later), prepend the
    // `[Attached file: …]` / `[Attached dataset: …]` prefix so the
    // model has the structured node IDs to work with. The store keeps
    // the chip + body separate; this is the only place the two forms
    // merge.
    const messages = (convo?.messages || []).map((m) => ({
      role: m.role,
      content: m.role === 'user' ? serializeUserContent(m) : m.content,
    }))
    // Defensive: never send an empty messages array. The server rejects
    // it with EMPTY_REQUEST and that error has historically leaked into
    // the next turn in confusing ways.
    if (!messages.length) {
      store.markFailedTurn(key, 'Nothing to send')
      return
    }
    ws.send(JSON.stringify({ action: 'chat', messages }))
  }

  // serializeUserContent — fold structured attachments into the LLM-
  // visible content string. Kept here (vs. inside the store) so the
  // store's user messages stay clean and rendering doesn't have to
  // worry about parsing back out.
  const serializeUserContent = (m) => {
    const attachments = m.attachments || []
    if (!attachments.length) return m.content
    const prefix = attachments
      .map((a) => formatAttachment(a))
      .filter(Boolean)
      .join(' ')
    if (!prefix) return m.content
    return `${prefix}\n\n${m.content}`
  }

  const formatAttachment = (a) => {
    if (a.type === 'file') {
      const name = a.name ? `${a.name} ` : ''
      const ds = a.datasetId ? ` in dataset ${a.datasetId}` : ''
      return `[Attached file: ${name}(${a.packageId})${ds}]`
    }
    if (a.type === 'dataset') {
      const name = a.name ? `${a.name} ` : ''
      return `[Attached dataset: ${name}(${a.datasetId})]`
    }
    return ''
  }

  const disconnect = ({ mode, orgId, datasetId }) => {
    const key = contextKey({ mode, orgId, datasetId })
    const ws = sockets.get(key)
    if (ws) {
      ws.close(1000, 'client closing')
      sockets.delete(key)
    }
  }

  return { connect, sendUserMessage, disconnect }
}
