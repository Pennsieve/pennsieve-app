import { getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import { applicationChannel } from '@/realtime/channels'
import { STATUS_EVENT, VARIANT_STATUS_EVENT, recordStatusEvent } from '@/components/Analysis/Applications/liveStatus'

/**
 * Live build status of App Store versions (liveStatus.js): listens on the
 * channel of each version uuid that `uuidsOf` gives (those still building),
 * for the version's status and its variants'. Returns `live`, the statuses
 * by version uuid, to lay over the apps (withLiveStatus). Without live
 * updates on the site, `live` stays empty and the page's polling applies.
 *
 * @param {(live: object) => string[]} uuidsOf - the versions to listen to,
 *   given the live statuses so far (a version that finished is let go)
 */
export function useAppStatusEvents(uuidsOf) {
  const realtime = getCurrentInstance()?.appContext.config.globalProperties.$realtime
  const live = ref({})
  const channels = new Map() // version uuid -> channel

  const onEvent = (name) => (data) => {
    live.value = recordStatusEvent(live.value, name, data)
  }

  const sync = (wanted) => {
    if (!realtime) return
    const want = new Set(wanted || [])
    for (const [id, channel] of channels) {
      if (!want.has(id)) {
        channel.unsubscribe()
        channels.delete(id)
      }
    }
    for (const id of want) {
      if (channels.has(id)) continue
      const channel = realtime.subscribe(applicationChannel(id))
      channel.bind(STATUS_EVENT, onEvent(STATUS_EVENT))
      channel.bind(VARIANT_STATUS_EVENT, onEvent(VARIANT_STATUS_EVENT))
      channels.set(id, channel)
    }
  }

  watch(
    () => [...(uuidsOf(live.value) || [])].sort().join(','),
    (ids) => sync(ids ? ids.split(',') : []),
    { immediate: true }
  )
  onBeforeUnmount(() => sync([]))

  return { live }
}
