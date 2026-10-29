import { ref, watch, toValue } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'

/**
 * An app's usage across runs (workflow-service GET /metrics/usage): by
 * version, what its steps were given and what they used, for the app's
 * page. Outside a workspace the service allows it for a public app or its
 * owner; otherwise there is simply no usage to show.
 *
 * @param {import('vue').Ref<string>|string} sourceUrl - the app's source URL
 */
export function useAppUsage(sourceUrl) {
  const store = useStore()
  const usage = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  const fetchUsage = async () => {
    const url = toValue(sourceUrl)
    if (!url) {
      usage.value = null
      return
    }
    isLoading.value = true
    error.value = null
    try {
      const token = await useGetToken()
      const api2Url = store.state.config.api2Url
      const orgId = store.state.activeOrganization?.organization?.id
      const params = new URLSearchParams({ scope: 'application', id: url })
      if (orgId) params.set('organization_id', orgId)
      const resp = await fetch(`${api2Url}/compute/workflows/metrics/usage?${params}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.status === 400 || resp.status === 403 || resp.status === 404) {
        usage.value = null
        return
      }
      if (!resp.ok) throw new Error(`Failed to fetch app usage (${resp.status})`)
      usage.value = await resp.json()
    } catch (err) {
      console.error('App usage error:', err)
      error.value = err.message || 'Failed to load usage'
      usage.value = null
    } finally {
      isLoading.value = false
    }
  }

  watch(() => toValue(sourceUrl), fetchUsage, { immediate: true })

  return { usage, isLoading, error, refresh: fetchUsage }
}
