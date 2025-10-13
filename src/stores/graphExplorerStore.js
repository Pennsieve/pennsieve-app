// @/stores/graphExplorerStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v1 as uuidv1 } from 'uuid'

export const useGraphExplorerStore = defineStore('graphExplorer', () => {
  
  // State storage per dataset - keyed by datasetId
  const datasetStates = ref(new Map())
  
  // Current active dataset
  const currentDatasetId = ref(null)
  
  // Create initial filter structure
  const createFilter = () => ({
    id: Date.now() + Math.random(), // Ensure uniqueness
    model: '',
    property: '',
    operator: '',
    value: '',
    modelProperties: []
  })
  
  // Create initial graph state
  const createInitialState = () => ({
    // Query and search state
    queryFilters: [createFilter()],
    recordLimit: 50, // Default record limit per model
    
    // Graph visualization data
    nodes: [],
    edges: [],
    nodeCount: 0,
    edgeCount: 0,
    
    // Graph display state
    currentLayout: 'Force',
    expandedNodes: [],
    nodeExpansionMap: [], // Will be converted to/from Map
    
    // Model and color management
    displayedModels: [],
    modelColorAssignment: [], // Will be converted to/from Map
    
    // Selection state
    selectedRecord: null,
    selectedNodeProperties: null,
    showDetailsPanel: false,
    
    // Metadata
    timestamp: Date.now(),
    version: '1.0'
  })
  
  // Get current dataset state
  const getCurrentState = () => {
    if (!currentDatasetId.value) return null
    return datasetStates.value.get(currentDatasetId.value)
  }
  
  // Set current dataset and initialize if needed
  const setCurrentDataset = (datasetId) => {
    currentDatasetId.value = datasetId
    
    if (!datasetStates.value.has(datasetId)) {
      // Try to load from localStorage first
      const saved = loadStateFromStorage(datasetId)
      if (saved) {
        datasetStates.value.set(datasetId, saved)
      } else {
        // Create new initial state
        datasetStates.value.set(datasetId, createInitialState())
      }
    }
  }
  
  // Save state to localStorage
  const saveStateToStorage = (datasetId, state) => {
    try {
      const stateToSave = {
        ...state,
        timestamp: Date.now()
      }
      
      const key = `graphExplorer_${datasetId}`
      localStorage.setItem(key, JSON.stringify(stateToSave))
    } catch (error) {
      console.warn('Failed to save graph state to localStorage:', error)
    }
  }
  
  // Load state from localStorage
  const loadStateFromStorage = (datasetId) => {
    try {
      const key = `graphExplorer_${datasetId}`
      const saved = localStorage.getItem(key)
      
      if (!saved) return null
      
      const state = JSON.parse(saved)
      
      // Check if state is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000
      if (Date.now() - state.timestamp > maxAge) {
        localStorage.removeItem(key)
        return null
      }
      
      return state
    } catch (error) {
      console.warn('Failed to load graph state from localStorage:', error)
      const key = `graphExplorer_${datasetId}`
      localStorage.removeItem(key)
      return null
    }
  }
  
  // Clear state from localStorage
  const clearStateFromStorage = (datasetId) => {
    const key = `graphExplorer_${datasetId}`
    localStorage.removeItem(key)
  }
  
  // Update current dataset state
  const updateState = (updates) => {
    if (!currentDatasetId.value) return
    
    const currentState = datasetStates.value.get(currentDatasetId.value)
    if (!currentState) return
    
    const newState = { ...currentState, ...updates, timestamp: Date.now() }
    datasetStates.value.set(currentDatasetId.value, newState)
    
    // Auto-save to localStorage
    saveStateToStorage(currentDatasetId.value, newState)
  }
  
  // Specific state update methods
  const updateQueryFilters = (filters) => {
    updateState({ queryFilters: filters })
  }
  
  const updateRecordLimit = (limit) => {
    updateState({ recordLimit: limit })
  }
  
  const updateGraphData = (nodes, edges, counts = {}) => {
    updateState({
      nodes,
      edges,
      nodeCount: counts.nodeCount || nodes.length,
      edgeCount: counts.edgeCount || edges.length
    })
  }
  
  const updateLayout = (layout) => {
    updateState({ currentLayout: layout })
  }
  
  const updateExpandedNodes = (expandedNodes, expansionMap) => {
    updateState({
      expandedNodes: Array.from(expandedNodes),
      nodeExpansionMap: Array.from(expansionMap.entries()).map(([key, value]) => [
        key,
        {
          children: Array.from(value.children),
          edges: Array.from(value.edges)
        }
      ])
    })
  }
  
  const updateModelData = (displayedModels, colorAssignment) => {
    updateState({
      displayedModels,
      modelColorAssignment: Array.from(colorAssignment.entries())
    })
  }
  
  const updateSelection = (selectedRecord, selectedNodeProperties, showDetailsPanel) => {
    updateState({
      selectedRecord,
      selectedNodeProperties,
      showDetailsPanel
    })
  }
  
  // Clear current dataset state
  const clearCurrentState = () => {
    if (!currentDatasetId.value) return
    
    datasetStates.value.set(currentDatasetId.value, createInitialState())
    clearStateFromStorage(currentDatasetId.value)
  }
  
  // Clear all states
  const clearAllStates = () => {
    // Clear from memory
    datasetStates.value.clear()
    
    // Clear from localStorage - remove all graphExplorer keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith('graphExplorer_')) {
        localStorage.removeItem(key)
      }
    }
  }
  
  // Computed getters for current state
  const currentQueryFilters = computed(() => {
    const state = getCurrentState()
    return state?.queryFilters || [createFilter()]
  })
  
  const currentRecordLimit = computed(() => {
    const state = getCurrentState()
    return state?.recordLimit || 50
  })
  
  const currentNodes = computed(() => {
    const state = getCurrentState()
    return state?.nodes || []
  })
  
  const currentEdges = computed(() => {
    const state = getCurrentState()
    return state?.edges || []
  })
  
  const currentLayout = computed(() => {
    const state = getCurrentState()
    return state?.currentLayout || 'Force'
  })
  
  const currentExpandedNodes = computed(() => {
    const state = getCurrentState()
    return new Set(state?.expandedNodes || [])
  })
  
  const currentNodeExpansionMap = computed(() => {
    const state = getCurrentState()
    if (!state?.nodeExpansionMap) return new Map()
    
    return new Map(
      state.nodeExpansionMap.map(([key, value]) => [
        key,
        {
          children: new Set(value.children),
          edges: new Set(value.edges)
        }
      ])
    )
  })
  
  const currentDisplayedModels = computed(() => {
    const state = getCurrentState()
    return state?.displayedModels || []
  })
  
  const currentModelColorAssignment = computed(() => {
    const state = getCurrentState()
    if (!state?.modelColorAssignment) return new Map()
    
    return new Map(state.modelColorAssignment)
  })
  
  const currentSelectedRecord = computed(() => {
    const state = getCurrentState()
    return state?.selectedRecord || null
  })
  
  const currentSelectedNodeProperties = computed(() => {
    const state = getCurrentState()
    return state?.selectedNodeProperties || null
  })
  
  const currentShowDetailsPanel = computed(() => {
    const state = getCurrentState()
    return state?.showDetailsPanel || false
  })
  
  const currentNodeCount = computed(() => {
    const state = getCurrentState()
    return state?.nodeCount || 0
  })
  
  const currentEdgeCount = computed(() => {
    const state = getCurrentState()
    return state?.edgeCount || 0
  })
  
  // Check if current state has data
  const hasGraphData = computed(() => {
    const state = getCurrentState()
    return state && (state.nodes.length > 0 || state.queryFilters.some(f => f.model))
  })
  
  // Export store interface
  return {
    // State
    currentDatasetId,
    
    // Core actions
    setCurrentDataset,
    updateState,
    clearCurrentState,
    clearAllStates,
    
    // Specific update methods
    updateQueryFilters,
    updateRecordLimit,
    updateGraphData,
    updateLayout,
    updateExpandedNodes,
    updateModelData,
    updateSelection,
    
    // Storage management
    saveStateToStorage,
    loadStateFromStorage,
    clearStateFromStorage,
    
    // Computed getters
    currentQueryFilters,
    currentRecordLimit,
    currentNodes,
    currentEdges,
    currentLayout,
    currentExpandedNodes,
    currentNodeExpansionMap,
    currentDisplayedModels,
    currentModelColorAssignment,
    currentSelectedRecord,
    currentSelectedNodeProperties,
    currentShowDetailsPanel,
    currentNodeCount,
    currentEdgeCount,
    hasGraphData,
    
    // Utilities
    createFilter,
    getCurrentState
  }
})