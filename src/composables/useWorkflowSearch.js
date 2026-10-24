import { ref, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'

const PAGE_SIZE = 25

/**
 * Composable backing the Initiate Workflow wizard's workflow picker.
 *
 * Keeps its own option list — separate from the store's shared workflows
 * state, which also feeds the run filter dropdowns — and delegates search
 * and cursor pagination to the workflow-service definitions endpoint.
 */
export function useWorkflowSearch() {
  const store = useStore()

  const workflowOptions = ref([])
  const nextCursor = ref('')
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const searchQuery = ref('')
  let searchTimer = null
  let requestSeq = 0

  const fetchPage = async ({ cursor = '', append = false } = {}) => {
    const seq = ++requestSeq
    if (append) isLoadingMore.value = true
    else isLoading.value = true

    try {
      const token = await useGetToken()
      const params = new URLSearchParams({
        organization_id: store.state.activeOrganization?.organization?.id,
        limit: PAGE_SIZE,
      })
      const query = searchQuery.value.trim()
      if (query) params.set('search', query)
      if (cursor) params.set('cursor', cursor)

      const resp = await fetch(
        `${store.state.config.api2Url}/compute/workflows/definitions?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!resp.ok) throw new Error(`Failed to fetch workflows (${resp.status})`)
      const result = await resp.json()
      // Handle both paginated { workflows, nextCursor } and legacy array response
      const workflows = Array.isArray(result) ? result : result.workflows || []
      if (seq !== requestSeq) return
      workflowOptions.value = append
        ? [...workflowOptions.value, ...workflows]
        : workflows
      nextCursor.value = Array.isArray(result) ? '' : result.nextCursor || ''
    } catch (err) {
      console.error('Workflow search error:', err)
      if (seq !== requestSeq) return
      if (!append) {
        workflowOptions.value = []
        nextCursor.value = ''
      }
    } finally {
      if (seq === requestSeq) {
        isLoading.value = false
        isLoadingMore.value = false
      }
    }
  }

  const onSearchInput = () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => fetchPage(), 300)
  }

  const loadMore = () => {
    if (!nextCursor.value || isLoadingMore.value) return
    return fetchPage({ cursor: nextCursor.value, append: true })
  }

  const reset = () => {
    clearTimeout(searchTimer)
    searchQuery.value = ''
    return fetchPage()
  }

  onBeforeUnmount(() => clearTimeout(searchTimer))

  return {
    workflowOptions,
    nextCursor,
    isLoading,
    isLoadingMore,
    searchQuery,
    onSearchInput,
    loadMore,
    reset,
  }
}
