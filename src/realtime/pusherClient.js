import { Subscription } from './subscription'
import { pusherChannelName } from './channels'

// For environments without an Event API yet (prod until subtask 8): the same
// subscribe/bind interface over Pusher. Remove with Pusher.
export class PusherRealtimeClient {
  constructor(pusher) {
    this.pusher = pusher
    this.refs = new Map()
  }

  subscribe(path) {
    const name = pusherChannelName(path)
    const channel = this.pusher.subscribe(name)
    this.refs.set(name, (this.refs.get(name) || 0) + 1)

    // Pusher shares one channel object per name, so each subscription binds
    // one forwarder per event and only ever unbinds its own.
    const forwarders = new Map()
    const sub = new Subscription(path, () => {
      forwarders.forEach((fn, event) => channel.unbind(event, fn))
      forwarders.clear()
      const left = (this.refs.get(name) || 1) - 1
      if (left > 0) this.refs.set(name, left)
      else {
        this.refs.delete(name)
        this.pusher.unsubscribe(name)
      }
    })
    const bind = sub.bind.bind(sub)
    sub.bind = (event, handler) => {
      if (!forwarders.has(event)) {
        const fn = (data) => sub.dispatch(event, data)
        forwarders.set(event, fn)
        channel.bind(event, fn)
      }
      return bind(event, handler)
    }
    return sub
  }
}
