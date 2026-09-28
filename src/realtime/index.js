import { fetchAuthSession } from 'aws-amplify/auth'
import Pusher from 'pusher-js'
import { AppSyncRealtimeClient } from './appsyncClient'
import { PusherRealtimeClient } from './pusherClient'
import { NoopRealtimeClient } from './subscription'

export * from './channels'

async function accessToken() {
  try {
    const session = await fetchAuthSession()
    return session?.tokens?.accessToken?.toString() || null
  } catch {
    return null
  }
}

// Picks the transport from the site config:
//   realtime: { httpHost, realtimeHost }  → AppSync Event API
//   pusherConfig: { appId, region }        → Pusher (environments not moved yet)
//   neither                                → no live updates
export function createRealtime(siteConfig, { getToken = accessToken } = {}) {
  const realtime = siteConfig?.realtime
  if (realtime?.httpHost && realtime?.realtimeHost) {
    return new AppSyncRealtimeClient({ httpHost: realtime.httpHost, realtimeHost: realtime.realtimeHost, getToken })
  }
  const pusher = siteConfig?.pusherConfig
  if (pusher?.appId) {
    return new PusherRealtimeClient(new Pusher(pusher.appId, { cluster: pusher.region }))
  }
  return new NoopRealtimeClient()
}
