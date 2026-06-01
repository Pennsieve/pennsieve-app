// @/composables/useChatQuota.js
//
// Glue between the ChatPanel and chatQuotaStore. The panel passes in two
// reactive refs — the active compute node id and the per-turn `pending` flag
// — and this composable handles the orchestration:
//
//   1. Initial fetch when the node id resolves.
//   2. Re-fetch every time `pending` transitions true → false (i.e. an
//      assistant turn just completed, so the daily / monthly aggregates
//      almost certainly changed in account-service's chat_user_usage table).
//   3. Re-fetch when the node id changes (user switched compute node mid-
//      session — likely a different cap applies).
//   4. Periodic safety-net refresh (60s) so the meter doesn't drift if the
//      user has the panel open without sending turns, e.g. while an owner
//      adjusts the cap in another tab.
//
// The store dedupes in-flight requests, so overlapping triggers are safe.

import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useChatQuotaStore } from '@/stores/chatQuotaStore'

// 60 seconds. Quota tables update on every chat turn (sub-second after the
// AssistantMessage lands) and on owner CRUD (rare). 60s is well within any
// "stale enough to matter" threshold and keeps the request rate trivial.
const POLL_INTERVAL_MS = 60 * 1000

export function useChatQuota(nodeIdRef, pendingRef) {
  const quotaStore = useChatQuotaStore()

  // Mirror the active node into the store so component slots that don't
  // have direct access to nodeIdRef can still read activeQuota.
  watch(
    nodeIdRef,
    (id) => {
      quotaStore.setActiveNode(id)
      if (id) quotaStore.fetch(id)
    },
    { immediate: true },
  )

  // Re-fetch when an assistant turn finishes. We don't bother refreshing on
  // turn START — the values haven't changed yet, and the store update would
  // race with the assistant frame arriving. The end-of-turn trigger gives us
  // the just-incremented totals on the next paint.
  watch(pendingRef, (now, prev) => {
    if (prev === true && now === false && nodeIdRef.value) {
      quotaStore.fetch(nodeIdRef.value)
    }
  })

  // Safety-net periodic refresh. setInterval is cleared on unmount; the
  // store's in-flight dedupe means overlapping with a turn-end refresh is
  // benign (the periodic call short-circuits onto the in-flight promise).
  let intervalId = null
  onMounted(() => {
    intervalId = window.setInterval(() => {
      if (nodeIdRef.value) quotaStore.fetch(nodeIdRef.value)
    }, POLL_INTERVAL_MS)
  })
  onBeforeUnmount(() => {
    if (intervalId !== null) window.clearInterval(intervalId)
  })

  // Wrap each accessor in computed so consumers receive reactive refs.
  // Destructuring `quotaStore.activeQuota` directly would capture the value
  // at call time and silently break reactivity — Pinia setup-style stores
  // auto-unwrap computeds on member access, so the consumer would never see
  // store updates and the UI would stay blank after the fetch completes.
  return {
    quota: computed(() => quotaStore.activeQuota),
    loading: computed(() => quotaStore.activeLoading),
    error: computed(() => quotaStore.activeError),
    refresh: () => nodeIdRef.value && quotaStore.fetch(nodeIdRef.value),
  }
}
