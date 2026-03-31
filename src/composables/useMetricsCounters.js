import { ref, watch, computed, toValue } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'

const SCOPE_MAP = {
  workflowUuid: 'workflow',
  sourceUrl: 'application',
}

/**
 * Composable for fetching instant aggregate counters from the metrics API.
 *
 * @param {Object} options
 * @param {string} [options.scope] - 'workflow' | 'application' (or filterColumn name). Omit for org-level.
 * @param {import('vue').Ref<string>} [options.id] - the scoped entity identifier. Omit for org-level.
 */
export function useMetricsCounters({ scope, id, range: timeRange } = {}) {
  const store = useStore()

  const counters = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  // Resolve filterColumn names to API scope values
  const resolvedScope = computed(() => {
    const s = toValue(scope)
    return s ? (SCOPE_MAP[s] || s) : null
  })

  const fetchCounters = async () => {
    const scopeVal = resolvedScope.value
    const idVal = toValue(id)
    // For scoped calls, require an id
    if (scopeVal && !idVal) return

    isLoading.value = true
    error.value = null

    try {
      const token = await useGetToken()
      const api2Url = store.state.config.api2Url
      const orgId = store.state.activeOrganization?.organization?.id

      const params = new URLSearchParams({ organization_id: orgId })
      if (scopeVal) {
        params.set('scope', scopeVal)
        params.set('id', idVal)
      }
      const rangeVal = toValue(timeRange)
      if (rangeVal) params.set('range', rangeVal)

      const resp = await fetch(
        `${api2Url}/compute/workflows/metrics/counters?${params}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!resp.ok) {
        throw new Error(`Failed to fetch metrics counters (${resp.status})`)
      }
      counters.value = await resp.json()
    } catch (err) {
      console.error('Metrics counters error:', err)
      error.value = err.message || 'Failed to load counters'
    } finally {
      isLoading.value = false
    }
  }

  // For scoped calls, watch the id and refetch
  if (scope || id) {
    watch(
      () => toValue(id),
      (val) => {
        if (val || !resolvedScope.value) fetchCounters()
      },
      { immediate: true }
    )
  }

  return {
    counters,
    isLoading,
    error,
    fetchCounters,
  }
}
