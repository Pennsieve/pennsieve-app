import { Subscription } from './subscription'

// Client for the AppSync Event API WebSocket protocol:
// https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
//
// One connection carries every subscription. The user's Cognito access token
// authorizes the connection (subprotocol header) and each subscribe message;
// the events authorizer in pennsieve-go-api decides per channel. A token is
// fetched for every connect and subscribe, so reconnects never reuse an
// expired one.
//
// Events arrive as {"event": <name>, "data": <payload>} and are dispatched to
// handlers bound to that name.

const SUBPROTOCOL = 'aws-appsync-event-ws'
const DEFAULT_KA_TIMEOUT_MS = 300000
const MAX_FAILED_CONNECTS = 5

function base64UrlJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let idCounter = 0
function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  idCounter += 1
  return `sub-${Date.now().toString(36)}-${idCounter}`
}

export class AppSyncRealtimeClient {
  constructor({
    httpHost,
    realtimeHost,
    getToken,
    WebSocketImpl = globalThis.WebSocket,
    timers = { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) },
    random = Math.random,
    idleCloseMs = 30000,
    baseBackoffMs = 1000,
    maxBackoffMs = 60000,
    logger = console,
  }) {
    this.httpHost = httpHost
    this.url = `wss://${realtimeHost}/event/realtime`
    this.getToken = getToken
    this.WebSocketImpl = WebSocketImpl
    this.timers = timers
    this.random = random
    this.idleCloseMs = idleCloseMs
    this.baseBackoffMs = baseBackoffMs
    this.maxBackoffMs = maxBackoffMs
    this.logger = logger

    this.subscriptions = new Set()
    this.byId = new Map()
    this.ws = null
    this.acked = false
    this.connecting = false
    this.failedConnects = 0
    this.kaTimer = null
    this.reconnectTimer = null
    this.idleTimer = null
  }

  subscribe(path) {
    const sub = new Subscription(path, (s) => this._remove(s))
    this.subscriptions.add(sub)
    this._cancelIdleClose()
    if (this.ws && this.acked) this._sendSubscribe(sub)
    else this._connect()
    return sub
  }

  // --- connection ---------------------------------------------------------

  async _connect() {
    if (this.ws || this.connecting || this.reconnectTimer || this.subscriptions.size === 0) return
    this.connecting = true
    let token
    try {
      token = await this.getToken()
    } finally {
      this.connecting = false
    }
    if (!token) return // Signed out; the next subscribe tries again.
    if (this.ws || this.subscriptions.size === 0) return

    const header = `header-${base64UrlJson({ host: this.httpHost, Authorization: token })}`
    const ws = new this.WebSocketImpl(this.url, [SUBPROTOCOL, header])
    this.ws = ws
    this.acked = false
    ws.onopen = () => this._send(ws, { type: 'connection_init' })
    ws.onmessage = (message) => this._onMessage(ws, message)
    ws.onerror = () => {}
    ws.onclose = () => this._onClose(ws)
  }

  _onClose(ws) {
    if (ws !== this.ws) return
    const wasAcked = this.acked
    this.ws = null
    this.acked = false
    this._clearKa()
    for (const sub of this.subscriptions) sub._id = null
    this.byId.clear()
    if (!wasAcked) this.failedConnects += 1
    if (this.subscriptions.size > 0) this._scheduleReconnect()
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return
    if (this.failedConnects >= MAX_FAILED_CONNECTS) {
      // Stop retrying (e.g. access denied) until something subscribes again.
      this.logger.warn(`realtime: giving up after ${this.failedConnects} failed connections`)
      this.failedConnects = 0
      return
    }
    const exp = Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** this.failedConnects)
    const delay = Math.round(exp * (0.5 + this.random() / 2))
    this.reconnectTimer = this.timers.setTimeout(() => {
      this.reconnectTimer = null
      this._connect()
    }, delay)
  }

  _resetKa(timeoutMs) {
    this._clearKa()
    this.kaTimeoutMs = timeoutMs ?? this.kaTimeoutMs ?? DEFAULT_KA_TIMEOUT_MS
    const ws = this.ws
    this.kaTimer = this.timers.setTimeout(() => ws?.close(), this.kaTimeoutMs)
  }

  _clearKa() {
    if (this.kaTimer) this.timers.clearTimeout(this.kaTimer)
    this.kaTimer = null
  }

  _cancelIdleClose() {
    if (this.idleTimer) this.timers.clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  // Close shortly after the last subscription goes, so navigating between
  // pages doesn't reconnect every time.
  _scheduleIdleClose() {
    this._cancelIdleClose()
    this.idleTimer = this.timers.setTimeout(() => {
      this.idleTimer = null
      if (this.subscriptions.size === 0 && this.ws) {
        const ws = this.ws
        this.ws = null
        this.acked = false
        this._clearKa()
        ws.close()
      }
    }, this.idleCloseMs)
  }

  // --- messages -----------------------------------------------------------

  _send(ws, message) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(message))
  }

  _onMessage(ws, message) {
    if (ws !== this.ws) return
    let msg
    try {
      msg = JSON.parse(message.data)
    } catch {
      return
    }
    switch (msg.type) {
      case 'connection_ack':
        this.acked = true
        this.failedConnects = 0
        this._resetKa(msg.connectionTimeoutMs)
        for (const sub of this.subscriptions) this._sendSubscribe(sub)
        break
      case 'ka':
        this._resetKa()
        break
      case 'data':
        this._onData(msg)
        break
      case 'subscribe_error': {
        const sub = this.byId.get(msg.id)
        this.logger.warn(`realtime: subscribe to ${sub?.path} refused`, msg.errors?.[0]?.errorType)
        break
      }
      case 'connection_error':
      case 'error':
        this.logger.warn('realtime: connection error', msg.errors?.[0]?.errorType || msg.errors?.[0]?.message)
        ws.close()
        break
      case 'broadcast_error':
        this.logger.warn('realtime: broadcast error', msg.errors?.[0]?.errorType)
        break
    }
  }

  _onData(msg) {
    const sub = this.byId.get(msg.id)
    if (!sub) return
    const events = Array.isArray(msg.event) ? msg.event : [msg.event]
    for (const raw of events) {
      let envelope
      try {
        envelope = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch {
        continue
      }
      if (envelope && typeof envelope.event === 'string') sub.dispatch(envelope.event, envelope.data)
    }
  }

  async _sendSubscribe(sub) {
    const ws = this.ws
    const token = await this.getToken()
    // The connection or the subscription may have gone while fetching the token.
    if (!token || ws !== this.ws || !this.acked || !this.subscriptions.has(sub) || sub._id) return
    const id = newId()
    sub._id = id
    this.byId.set(id, sub)
    this._send(ws, {
      type: 'subscribe',
      id,
      channel: sub.path,
      authorization: { Authorization: token, host: this.httpHost },
    })
  }

  _remove(sub) {
    this.subscriptions.delete(sub)
    if (sub._id) {
      this._send(this.ws, { type: 'unsubscribe', id: sub._id })
      this.byId.delete(sub._id)
      sub._id = null
    }
    if (this.subscriptions.size === 0) {
      if (this.reconnectTimer) {
        this.timers.clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      this._scheduleIdleClose()
    }
  }
}
