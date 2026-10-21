import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AppSyncRealtimeClient } from './appsyncClient'

const HTTP = 'abc.appsync-api.us-east-1.amazonaws.com'
const REALTIME = 'abc.appsync-realtime-api.us-east-1.amazonaws.com'

class FakeWebSocket {
  static instances = []
  constructor(url, protocols) {
    this.url = url
    this.protocols = protocols
    this.readyState = 0
    this.sent = []
    FakeWebSocket.instances.push(this)
  }
  send(data) {
    this.sent.push(JSON.parse(data))
  }
  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.()
  }
  // test helpers
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(msg) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
  ack() {
    this.open()
    this.receive({ type: 'connection_ack', connectionTimeoutMs: 300000 })
  }
  sentOf(type) {
    return this.sent.filter((m) => m.type === type)
  }
}

function manualTimers() {
  let next = 1
  const pending = new Map()
  return {
    setTimeout: (fn, ms) => {
      const id = next++
      pending.set(id, { fn, ms })
      return id
    },
    clearTimeout: (id) => pending.delete(id),
    pending,
    runAll(filter = () => true) {
      for (const [id, t] of [...pending]) {
        if (filter(t)) {
          pending.delete(id)
          t.fn()
        }
      }
    },
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function decodeHeader(protocol) {
  const b64 = protocol.slice('header-'.length).replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))
}

describe('AppSyncRealtimeClient', () => {
  let timers, tokens, client, logger

  beforeEach(() => {
    FakeWebSocket.instances = []
    timers = manualTimers()
    tokens = ['token-1', 'token-2', 'token-3', 'token-4', 'token-5', 'token-6']
    logger = { warn: vi.fn() }
    client = new AppSyncRealtimeClient({
      httpHost: HTTP,
      realtimeHost: REALTIME,
      getToken: vi.fn(async () => tokens.shift()),
      WebSocketImpl: FakeWebSocket,
      timers,
      random: () => 1,
      logger,
    })
  })

  it('connects with the token in the subprotocol header, never the URL', async () => {
    client.subscribe('/datasets/d1')
    await flush()
    const ws = FakeWebSocket.instances[0]
    expect(ws.url).toBe(`wss://${REALTIME}/event/realtime`)
    expect(ws.protocols[0]).toBe('aws-appsync-event-ws')
    expect(decodeHeader(ws.protocols[1])).toEqual({ host: HTTP, Authorization: 'token-1' })
    ws.open()
    expect(ws.sent).toEqual([{ type: 'connection_init' }])
  })

  it('subscribes after connection_ack with a fresh token, and dispatches events by name', async () => {
    const sub = client.subscribe('/datasets/d1')
    const onUpload = vi.fn()
    const onOther = vi.fn()
    sub.bind('upload-event', onUpload).bind('something-else', onOther)
    await flush()
    const ws = FakeWebSocket.instances[0]
    ws.ack()
    await flush()

    const [subscribe] = ws.sentOf('subscribe')
    expect(subscribe).toMatchObject({
      channel: '/datasets/d1',
      authorization: { Authorization: 'token-2', host: HTTP },
    })
    expect(subscribe.id).toMatch(/^[a-zA-Z0-9-_+]{1,128}$/)

    ws.receive({ type: 'data', id: subscribe.id, event: JSON.stringify({ event: 'upload-event', data: [{ name: 'a.csv' }] }) })
    ws.receive({ type: 'data', id: subscribe.id, event: [JSON.stringify({ event: 'upload-event', data: [] })] })
    ws.receive({ type: 'data', id: 'unknown', event: JSON.stringify({ event: 'upload-event', data: [] }) })
    ws.receive({ type: 'data', id: subscribe.id, event: 'not json' })

    expect(onUpload).toHaveBeenCalledTimes(2)
    expect(onUpload).toHaveBeenNthCalledWith(1, [{ name: 'a.csv' }])
    expect(onOther).not.toHaveBeenCalled()
  })

  it('shares one connection and subscribes later channels immediately', async () => {
    client.subscribe('/datasets/d1')
    await flush()
    const ws = FakeWebSocket.instances[0]
    ws.ack()
    await flush()
    client.subscribe('/runs/org-o1/*')
    await flush()
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(ws.sentOf('subscribe').map((m) => m.channel)).toEqual(['/datasets/d1', '/runs/org-o1/*'])
  })

  it('unsubscribes, then closes the idle connection', async () => {
    const sub = client.subscribe('/datasets/d1')
    await flush()
    const ws = FakeWebSocket.instances[0]
    ws.ack()
    await flush()
    const id = ws.sentOf('subscribe')[0].id

    const handler = vi.fn()
    sub.bind('upload-event', handler)
    sub.unsubscribe()
    expect(ws.sentOf('unsubscribe')).toEqual([{ type: 'unsubscribe', id }])
    ws.receive({ type: 'data', id, event: JSON.stringify({ event: 'upload-event', data: 1 }) })
    expect(handler).not.toHaveBeenCalled()

    expect(ws.readyState).toBe(1)
    timers.runAll((t) => t.ms === 30000)
    expect(ws.readyState).toBe(3)
    expect(FakeWebSocket.instances).toHaveLength(1) // no reconnect
  })

  it('keeps the connection when something subscribes before the idle close', async () => {
    client.subscribe('/datasets/d1').unsubscribe()
    await flush()
    client.subscribe('/datasets/d2')
    await flush()
    const ws = FakeWebSocket.instances[0]
    ws.ack()
    await flush()
    timers.runAll((t) => t.ms === 30000)
    expect(ws.readyState).toBe(1)
    expect(ws.sentOf('subscribe').map((m) => m.channel)).toEqual(['/datasets/d2'])
  })

  it('reconnects with backoff and re-subscribes with a new token after a drop', async () => {
    client.subscribe('/datasets/d1')
    await flush()
    const first = FakeWebSocket.instances[0]
    first.ack()
    await flush()
    first.close()

    expect([...timers.pending.values()].map((t) => t.ms)).toContain(1000)
    timers.runAll((t) => t.ms === 1000)
    await flush()
    const second = FakeWebSocket.instances[1]
    expect(decodeHeader(second.protocols[1]).Authorization).toBe('token-3')
    second.ack()
    await flush()
    expect(second.sentOf('subscribe')[0]).toMatchObject({ channel: '/datasets/d1', authorization: { Authorization: 'token-4' } })
  })

  it('closes when keep-alives stop, and resets the timer on each ka', async () => {
    client.subscribe('/datasets/d1')
    await flush()
    const ws = FakeWebSocket.instances[0]
    ws.ack()
    await flush()
    ws.receive({ type: 'ka' })
    expect([...timers.pending.values()].filter((t) => t.ms === 300000)).toHaveLength(1)
    timers.runAll((t) => t.ms === 300000)
    expect(ws.readyState).toBe(3)
  })

  it('backs off on refused connections and gives up after five', async () => {
    client.subscribe('/datasets/d1')
    const delays = []
    for (let i = 0; i < 5; i++) {
      await flush()
      const ws = FakeWebSocket.instances[i]
      tokens.push(`t${i}`)
      ws.open()
      ws.receive({ type: 'connection_error', errors: [{ errorType: 'UnauthorizedException' }] })
      const pending = [...timers.pending.values()]
      delays.push(pending[0]?.ms)
      timers.runAll()
    }
    expect(delays).toEqual([2000, 4000, 8000, 16000, undefined])
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('giving up'))
  })

  it('does not connect without a token', async () => {
    tokens = [null]
    client.subscribe('/datasets/d1')
    await flush()
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('logs refused subscriptions without dropping the connection', async () => {
    client.subscribe('/datasets/d1')
    await flush()
    const ws = FakeWebSocket.instances[0]
    ws.ack()
    await flush()
    ws.receive({ type: 'subscribe_error', id: ws.sentOf('subscribe')[0].id, errors: [{ errorType: 'UnauthorizedException' }] })
    expect(logger.warn).toHaveBeenCalledWith('realtime: subscribe to /datasets/d1 refused', 'UnauthorizedException')
    expect(ws.readyState).toBe(1)
  })
})
