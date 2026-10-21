import { markRaw } from 'vue'

// A subscription to one channel, with Pusher's channel API (bind / unbind) so
// components dispatch by event name the same way on either transport.
//
// Marked raw: components keep subscriptions in Vuex state, and a reactive
// proxy would no longer be the object the client tracks.
export class Subscription {
  constructor(path, onUnsubscribe) {
    this.path = path
    this._handlers = new Map()
    this._onUnsubscribe = onUnsubscribe
    markRaw(this)
  }

  bind(event, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    this._handlers.get(event).add(handler)
    return this
  }

  // unbind(event, handler) removes one handler, unbind(event) all handlers
  // for the event, unbind() everything.
  unbind(event, handler) {
    if (event === undefined) this._handlers.clear()
    else if (handler === undefined) this._handlers.delete(event)
    else this._handlers.get(event)?.delete(handler)
    return this
  }

  unsubscribe() {
    this._handlers.clear()
    const done = this._onUnsubscribe
    this._onUnsubscribe = null
    done?.(this)
  }

  dispatch(event, data) {
    for (const handler of [...(this._handlers.get(event) || [])]) {
      try {
        handler(data)
      } catch (err) {
        console.error(`realtime: handler for ${event} on ${this.path} failed`, err)
      }
    }
  }
}

// For environments with live updates off: subscriptions never fire.
export class NoopRealtimeClient {
  subscribe(path) {
    return new Subscription(path, () => {})
  }
}
