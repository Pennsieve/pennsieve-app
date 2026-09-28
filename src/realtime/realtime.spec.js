import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import {
  applicationChannel,
  datasetChannel,
  pusherChannelName,
  runChannel,
  runScopeChannel,
  stripNodePrefix,
} from './channels'
import { PusherRealtimeClient } from './pusherClient'
import { AppSyncRealtimeClient } from './appsyncClient'
import { NoopRealtimeClient } from './subscription'
import { createRealtime } from './index'

const U = '12345678-1234-1234-1234-123456789abc'
const O = '11111111-2222-3333-4444-555555555555'

describe('channels', () => {
  it('builds the same paths as pennsieve-go-core pkg/realtime', () => {
    expect(stripNodePrefix(`N:dataset:${U}`)).toBe(U)
    expect(stripNodePrefix(U)).toBe(U)
    expect(datasetChannel(`N:dataset:${U}`)).toBe(`/datasets/${U}`)
    expect(applicationChannel(U)).toBe(`/applications/${U}`)
    expect(runScopeChannel(`N:organization:${O}`, `N:user:${U}`)).toBe(`/runs/org-${O}/*`)
    expect(runScopeChannel('', `N:user:${U}`)).toBe(`/runs/user-${U}/*`)
    expect(runChannel(O, '', U)).toBe(`/runs/org-${O}/${U}`)
  })

  it('maps paths to the Pusher channels of today', () => {
    expect(pusherChannelName(`/datasets/${U}`)).toBe(`dataset-${U}`)
    expect(pusherChannelName(`/applications/${U}`)).toBe(`application-${U}`)
    expect(pusherChannelName(`/runs/org-${O}/*`)).toBe(`organization-${O}-analytics`)
    expect(pusherChannelName(`/runs/user-${U}/*`)).toBe(`user-${U}-analytics`)
    expect(() => pusherChannelName('/orgs/x')).toThrow()
  })
})

class FakeChannel {
  constructor() {
    this.handlers = new Map()
  }
  bind(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event).push(fn)
  }
  unbind(event, fn) {
    this.handlers.set(event, (this.handlers.get(event) || []).filter((h) => h !== fn))
  }
  emit(event, data) {
    ;(this.handlers.get(event) || []).forEach((h) => h(data))
  }
}

class FakePusher {
  constructor() {
    this.channels = new Map()
    this.unsubscribed = []
  }
  subscribe(name) {
    if (!this.channels.has(name)) this.channels.set(name, new FakeChannel())
    return this.channels.get(name)
  }
  unsubscribe(name) {
    this.unsubscribed.push(name)
  }
}

describe('PusherRealtimeClient', () => {
  it('forwards events and only drops its own handlers on a shared channel', () => {
    const pusher = new FakePusher()
    const client = new PusherRealtimeClient(pusher)
    const a = vi.fn()
    const b = vi.fn()
    const subA = client.subscribe(`/runs/org-${O}/*`).bind('workflow-run-status', a)
    client.subscribe(`/runs/org-${O}/*`).bind('workflow-run-status', b)
    const channel = pusher.channels.get(`organization-${O}-analytics`)

    channel.emit('workflow-run-status', { runId: 'r1' })
    expect(a).toHaveBeenCalledWith({ runId: 'r1' })
    expect(b).toHaveBeenCalledTimes(1)

    subA.unsubscribe()
    expect(pusher.unsubscribed).toEqual([]) // the other subscription still uses it
    channel.emit('workflow-run-status', { runId: 'r2' })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(2)
  })

  it('unsubscribes from Pusher when the last subscription goes', () => {
    const pusher = new FakePusher()
    new PusherRealtimeClient(pusher).subscribe(`/datasets/${U}`).bind('upload-event', () => {}).unsubscribe()
    expect(pusher.unsubscribed).toEqual([`dataset-${U}`])
  })
})

describe('createRealtime', () => {
  it('prefers the Event API, then Pusher, else no live updates', () => {
    expect(createRealtime({ realtime: { httpHost: 'h', realtimeHost: 'r' }, pusherConfig: { appId: 'x' } })).toBeInstanceOf(AppSyncRealtimeClient)
    expect(createRealtime({})).toBeInstanceOf(NoopRealtimeClient)
    expect(createRealtime({ realtime: { httpHost: 'h' } })).toBeInstanceOf(NoopRealtimeClient)
  })

  it('a no-op subscription accepts the same calls', () => {
    const sub = new NoopRealtimeClient().subscribe('/datasets/x')
    expect(() => sub.bind('e', () => {}).unbind('e').unsubscribe()).not.toThrow()
  })
})

describe('Subscription', () => {
  it('stays the same object inside reactive state (Vuex), so unsubscribe still works', () => {
    const client = new PusherRealtimeClient(new FakePusher())
    const sub = client.subscribe(`/datasets/${U}`)
    const state = reactive({ channel: sub })
    expect(state.channel).toBe(sub)
  })
})
