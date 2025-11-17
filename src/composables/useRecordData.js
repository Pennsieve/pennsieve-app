import { ref } from 'vue'
import { useMetadataStore } from '@/stores/metadataStore.js'

/**
 * Composable for managing record data fetching operations
 * Handles fetching records, relationships, packages, history, and preview data
 */
export function useRecordData() {
  const metadataStore = useMetadataStore()
  
  // Loading states
  const loading = ref(false)
  const historyLoading = ref(false)
  const previewLoading = ref(false)
  
  // Error state
  const error = ref('')
  
  // History pagination state
  const historyHasMore = ref(false)
  const historyCursor = ref(null)

  /**
   * Fetch a single record with optional timestamp
   */
  const fetchRecord = async (datasetId, modelId, recordId, options = {}) => {
    loading.value = true
    error.value = ''
    
    try {
      const response = await metadataStore.fetchRecord(datasetId, modelId, recordId, options)
      return response
    } catch (err) {
      console.error('Error fetching record:', err)
      error.value = err.message || 'Failed to load record'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch model information for schema and metadata
   */
  const fetchModel = async (datasetId, modelId) => {
    try {
      await metadataStore.fetchModels(datasetId)
      return metadataStore.modelById(modelId)
    } catch (err) {
      console.error('Error fetching model:', err)
      error.value = err.message || 'Failed to load model information'
      throw err
    }
  }

  /**
   * Fetch all packages/files attached to a record
   */
  const fetchPackages = async (datasetId, recordId, options = {}) => {
    try {
      const response = await metadataStore.fetchAllRecordPackages(datasetId, recordId, options)
      return response || []
    } catch (err) {
      console.error('Error fetching packages:', err)
      // Don't throw for packages as it's not critical - return empty array
      return []
    }
  }

  /**
   * Fetch all relationships for a record (inbound and outbound)
   */
  const fetchRelationships = async (datasetId, recordId, options = {}) => {
    try {
      const response = await metadataStore.fetchAllRecordRelationships(datasetId, recordId, options)
      return response || { inbound: [], outbound: [] }
    } catch (err) {
      console.error('Error fetching relationships:', err)
      // Don't throw for relationships - return empty structure
      return { inbound: [], outbound: [] }
    }
  }

  /**
   * Fetch record history with pagination support
   */
  const fetchRecordHistory = async (datasetId, recordId, options = {}) => {
    try {
      historyLoading.value = true
      const response = await metadataStore.fetchRecordHistory(datasetId, recordId, options)
      
      // Update pagination state
      historyHasMore.value = response.hasMore || false
      historyCursor.value = response.cursor || null
      
      return {
        records: response.records || [],
        hasMore: response.hasMore || false,
        cursor: response.cursor || null
      }
    } catch (err) {
      console.error('Error fetching record history:', err)
      historyHasMore.value = false
      historyCursor.value = null
      // Don't throw for history - return empty structure
      return {
        records: [],
        hasMore: false,
        cursor: null
      }
    } finally {
      historyLoading.value = false
    }
  }

  /**
   * Load more history records (pagination)
   */
  const loadMoreHistory = async (datasetId, recordId, options = {}) => {
    if (!historyHasMore.value || historyLoading.value) return []
    
    try {
      historyLoading.value = true
      const paginationOptions = { ...options, cursor: historyCursor.value }
      
      const response = await metadataStore.fetchRecordHistory(datasetId, recordId, paginationOptions)
      
      historyHasMore.value = response.hasMore || false
      historyCursor.value = response.cursor || null
      
      return response.records || []
    } catch (err) {
      console.error('Error loading more history:', err)
      historyHasMore.value = false
      historyCursor.value = null
      return []
    } finally {
      historyLoading.value = false
    }
  }

  /**
   * Fetch preview data for a specific timestamp (used by timeline)
   */
  const fetchPreviewRecord = async (datasetId, modelId, recordId, timestamp) => {
    try {
      const response = await metadataStore.fetchRecord(datasetId, modelId, recordId, { as_of: timestamp })
      return response
    } catch (err) {
      console.error('Error fetching preview record:', err)
      return null
    }
  }

  /**
   * Fetch preview relationships for a specific timestamp
   */
  const fetchPreviewRelationships = async (datasetId, recordId, timestamp) => {
    try {
      const response = await metadataStore.fetchAllRecordRelationships(datasetId, recordId, { as_of: timestamp })
      return response || { inbound: [], outbound: [] }
    } catch (err) {
      console.error('Error fetching preview relationships:', err)
      return { inbound: [], outbound: [] }
    }
  }

  /**
   * Fetch preview packages for a specific timestamp
   */
  const fetchPreviewPackages = async (datasetId, recordId, timestamp) => {
    try {
      const response = await metadataStore.fetchAllRecordPackages(datasetId, recordId, { as_of: timestamp })
      return response || []
    } catch (err) {
      console.error('Error fetching preview packages:', err)
      return []
    }
  }

  /**
   * Fetch all initial data for a record (parallel loading)
   */
  const fetchAllInitialData = async (datasetId, modelId, recordId, options = {}) => {
    try {
      const [recordData, modelData, packagesData, relationshipsData, historyData] = await Promise.all([
        fetchRecord(datasetId, modelId, recordId, options),
        fetchModel(datasetId, modelId),
        fetchPackages(datasetId, recordId, options),
        fetchRelationships(datasetId, recordId, options),
        fetchRecordHistory(datasetId, recordId)
      ])

      return {
        record: recordData,
        model: modelData,
        packages: packagesData,
        relationships: relationshipsData,
        history: historyData.records
      }
    } catch (err) {
      console.error('Error fetching initial data:', err)
      throw err
    }
  }

  /**
   * Fetch all preview data for a timestamp (parallel loading)
   */
  const fetchAllPreviewData = async (datasetId, modelId, recordId, timestamp) => {
    try {
      previewLoading.value = true
      
      const [recordData, relationshipsData, packagesData] = await Promise.all([
        fetchPreviewRecord(datasetId, modelId, recordId, timestamp),
        fetchPreviewRelationships(datasetId, recordId, timestamp),
        fetchPreviewPackages(datasetId, recordId, timestamp)
      ])

      return {
        record: recordData,
        relationships: relationshipsData,
        packages: packagesData
      }
    } catch (err) {
      console.error('Error fetching preview data:', err)
      throw err
    } finally {
      previewLoading.value = false
    }
  }

  /**
   * Reset all state (useful when navigating between records)
   */
  const resetState = () => {
    loading.value = false
    historyLoading.value = false
    previewLoading.value = false
    error.value = ''
    historyHasMore.value = false
    historyCursor.value = null
  }

  return {
    // State
    loading,
    historyLoading,
    previewLoading,
    error,
    historyHasMore,
    historyCursor,
    
    // Methods
    fetchRecord,
    fetchModel,
    fetchPackages,
    fetchRelationships,
    fetchRecordHistory,
    loadMoreHistory,
    fetchPreviewRecord,
    fetchPreviewRelationships,
    fetchPreviewPackages,
    fetchAllInitialData,
    fetchAllPreviewData,
    resetState
  }
}