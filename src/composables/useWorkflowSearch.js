import { ref, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import { useGetToken } from '@/composables/useGetToken'

const PAGE_SIZE = 25

/**
 * Composable backing the run wizard's workflow picker (restored from #825).
 *
 * Keeps its own option list — separate from the store's shared workflows
 * state, which also feeds the run filter dropdowns — and delegates search
 * and cursor pagination to the workflow-service definitions endpoint, so
 * workflows past the first page can be found and picked.
 *
 * `sources` returns the lists to search, each a set of query params: a
 * workspace's ({ organization_id }), or in My Workspace the user's own ({})
 * and the public ones ({ visibility: 'public' }). Each keeps its own cursor;
 * Load more pages every list that has more.
 */
export function useWorkflowSearch(sources = () => [{}]) {
  const store = useStore()

  const workflowOptions = ref([])
  const cursors = ref([])
  const nextCursor = ref('')
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const searchQuery = ref('')
  let searchTimer = null
  let requestSeq = 0

  const definitionsUrl = () => `${store.state.config.api2Url}/compute/workflows/definitions`

  const fetchSource = async (source, cursor) => {
    const token = await useGetToken()
    const params = new URLSearchParams({ ...source, limit: PAGE_SIZE })
    const query = searchQuery.value.trim()
    if (query) params.set('search', query)
    if (cursor) params.set('cursor', cursor)
    const resp = await fetch(`${definitionsUrl()}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) throw new Error(`Failed to fetch workflows (${resp.status})`)
    const result = await resp.json()
    // Handle both paginated { workflows, nextCursor } and legacy array response
    return {
      workflows: Array.isArray(result) ? result : result.workflows || [],
      cursor: Array.isArray(result) ? '' : result.nextCursor || '',
    }
  }

  const fetchPage = async ({ append = false } = {}) => {
    const seq = ++requestSeq
    if (append) isLoadingMore.value = true
    else isLoading.value = true

    try {
      const list = sources()
      const pages = await Promise.all(
        list.map((source, i) => {
          if (append && !cursors.value[i]) return { workflows: [], cursor: '' }
          return fetchSource(source, append ? cursors.value[i] : '')
        })
      )
      if (seq !== requestSeq) return
      const byId = new Map((append ? workflowOptions.value : []).map((w) => [w.uuid, w]))
      for (const page of pages) {
        for (const w of page.workflows) if (w?.uuid && !byId.has(w.uuid)) byId.set(w.uuid, w)
      }
      workflowOptions.value = [...byId.values()]
      cursors.value = pages.map((p) => p.cursor)
      nextCursor.value = cursors.value.find(Boolean) || ''
    } catch (err) {
      console.error('Workflow search error:', err)
      if (seq !== requestSeq) return
      if (!append) {
        workflowOptions.value = []
        cursors.value = []
        nextCursor.value = ''
      }
    } finally {
      if (seq === requestSeq) {
        isLoading.value = false
        isLoadingMore.value = false
      }
    }
  }

  // One workflow by id, for a preselected one (a Library card's Run, a rerun)
  // that isn't among the pages loaded.
  const fetchWorkflow = async (id) => {
    try {
      const token = await useGetToken()
      const resp = await fetch(`${definitionsUrl()}/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return resp.ok ? await resp.json() : null
    } catch (err) {
      console.error('Workflow fetch error:', err)
      return null
    }
  }

  const onSearchInput = () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => fetchPage(), 300)
  }

  const loadMore = () => {
    if (!nextCursor.value || isLoadingMore.value) return
    return fetchPage({ append: true })
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
    fetchWorkflow,
  }
}
