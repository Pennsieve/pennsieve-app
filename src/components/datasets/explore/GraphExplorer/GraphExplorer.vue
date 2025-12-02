<template>
  <bf-stage class="graph-explorer" :no-padding="true">
    <template #actions>
      <stage-actions>
        <template #left>
          <div>
            <h3 class="stage-title">Explorer</h3>
            <div>Select one or more models to generate a view over the dataset</div>
          </div>

        </template>
        <template #right>
          <template v-if="quickActionsVisible">
            <!-- Search Button -->
            <bf-button
              class="mr-8 flex"
              :disabled="!canExecuteQuery"
              @click="executeQuery"
            >
              <template v-if="loading">
                <i class="el-icon-loading"></i> Searching...
              </template>
              <template v-else>
                <i class="el-icon-search"></i> Create View
              </template>
            </bf-button>

            <!-- Clear All Button -->
            <bf-button
              class="secondary mr-8 flex"
              @click="clearAllQueries"
            >
              Clear All
            </bf-button>
            
            <!-- Collapse Button -->
            <bf-button
              class="collapse-btn"
              @click="isQuerySectionCollapsed = !isQuerySectionCollapsed"
            >
              <span v-if="isQuerySectionCollapsed">Show Query Builder</span>
              <span v-else>Hide Query Builder</span>
            </bf-button>
          </template>
        </template>
      </stage-actions>
    </template>
    
    <!-- Query Builder Section -->
    <div class="query-section" :class="{ 'collapsed': isQuerySectionCollapsed }">
      <div class="query-builder" v-if="!isQuerySectionCollapsed">
        
        <!-- Multiple Query Rows -->
        <div v-for="(query, index) in queryFilters" :key="query.id" class="query-row">
          <MultiModelFilter
            :models="models"
            :filter="query"
            :index="index"
            :can-remove="queryFilters.length > 1"
            :dataset-id="props.datasetId"
            @update-filter="updateFilter"
            @remove-filter="removeFilter"
            @model-change="onModelChange"
          />
        </div>
        
        <!-- Filter Management Actions -->
        <div class="filter-actions">
          <!-- Add Filter Button -->
          <button
            class="btn-add-filter"
            @click="addFilter"
          >
            + Add Query
          </button>

          <!-- Record Limit Dropdown -->
          <div class="limit-selector">
            <label class="limit-label">Records per query:</label>
            <select 
              v-model="recordLimit"
              class="limit-select"
            >
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
              <option :value="500">500</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Graph Controls -->
    <div class="graph-controls">
      <div class="control-group">
        <!-- Graph View Controls -->
        <div class="view-controls">
          <button
            class="control-btn"
            title="Fit graph to view"
            @click="fitView"
          >
            <IconSizeToFit :width="16" :height="16" />
          </button>
          <button
            class="control-btn"
            title="Center graph"
            @click="centerGraph"
          >
            <IconCenter :width="16" :height="16" />
          </button>
        </div>
        
        <!-- Layout Selector -->
        <div class="layout-selector">
          <label class="layout-label">Layout:</label>
          <select 
            v-model="currentLayout"
            class="layout-select"
            @change="applyLayoutToGraph"
          >
            <option value="Force">Force</option>
            <option value="Circle">Circle</option>
            <option value="Random">Random</option>
          </select>
        </div>
      </div>
      

      <div class="control-group">
        <span class="node-count">{{ nodeCount }} nodes, {{ edgeCount }} relationships</span>
      </div>
    </div>

    <!-- Graph Visualization -->
    <div class="graph-container">
      <div ref="sigmaContainer" class="sigma-container"></div>

      <!-- Graph Legend - Bottom of graph container -->
      <div class="graph-legend" :class="{ 'expanded': legendExpanded }">
        <div class="legend-header" @click="legendExpanded = !legendExpanded">
          <span class="legend-title">Legend</span>
          <button class="legend-toggle" :class="{ 'expanded': legendExpanded }">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 9l-4-4h8l-4 4z" />
            </svg>
          </button>
        </div>

        <div class="legend-content">
          <!-- Compact view - single line -->
          <div v-if="!legendExpanded" class="legend-compact">
            <!-- Show first few models only -->
            <div v-if="displayedModels.length > 0" class="legend-models-compact">
              <div
                v-for="modelId in displayedModels.slice(0, 3)"
                :key="modelId"
                class="legend-item model-legend"
              >
                <div
                  class="legend-dot"
                  :style="{
                    backgroundColor: getModelColorForLegend(modelId).background,
                    borderColor: getModelColorForLegend(modelId).border
                  }"
                ></div>
                <span class="model-name">{{ getModelName(modelId) }}</span>
              </div>
              <span v-if="displayedModels.length > 3" class="legend-more">
                +{{ displayedModels.length - 3 }} more
              </span>
            </div>

            <!-- Essential relationship types -->
            <div class="legend-relationships-compact">
              <div class="legend-item">
                <div class="legend-line outbound"></div>
                <span>Relations</span>
              </div>
              <div class="legend-item">
                <div class="legend-line package"></div>
                <span>Files</span>
              </div>
            </div>
          </div>

          <!-- Expanded view - full legend -->
          <div v-else class="legend-expanded">
            <!-- All model colors -->
            <div v-if="displayedModels.length > 0" class="legend-section">
              <div class="legend-section-title">Models</div>
              <div class="legend-models-grid">
                <div
                  v-for="modelId in displayedModels"
                  :key="modelId"
                  class="legend-item model-legend"
                >
                  <div
                    class="legend-dot"
                    :style="{
                      backgroundColor: getModelColorForLegend(modelId).background,
                      borderColor: getModelColorForLegend(modelId).border
                    }"
                  ></div>
                  <span class="model-name">{{ getModelName(modelId) }}</span>
                </div>
              </div>
            </div>

            <!-- All relationship types -->
            <div class="legend-section">
              <div class="legend-section-title">Relationships</div>
              <div class="legend-relationships-grid">
                <div class="legend-item">
                  <div class="legend-line outbound"></div>
                  <span>Outbound →</span>
                </div>
                <div class="legend-item">
                  <div class="legend-line inbound"></div>
                  <span>Inbound ←</span>
                </div>
                <div class="legend-item">
                  <div class="legend-line package"></div>
                  <span>Files</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Minimal Properties Bar - Bottom of graph container -->
      <div v-if="selectedNodeProperties" class="properties-bar">
        <div class="properties-content">
          <span class="node-title">{{ selectedNodeProperties.label || 'Node Properties' }}</span>
          <div class="properties-inline">
            <span 
              v-for="(value, key, index) in selectedNodeProperties.properties" 
              :key="key"
              class="property-item"
            >
              <strong>{{ key }}:</strong> {{ formatPropertyValue(value) }}<template v-if="index < Object.keys(selectedNodeProperties.properties).length - 1">, </template>
            </span>
          </div>
        </div>
        <div class="properties-actions">
          <!-- Unlock button - only show for locked nodes in Force mode -->
          <button 
            v-if="currentLayout === 'Force' && getSelectedNodeId() && isNodeLocked(getSelectedNodeId())"
            class="unlock-btn" 
            @click="unlockSelectedNode"
            title="Unlock node from current position"
          >
            Unlock
          </button>
          <button class="view-details-btn" @click="viewSelectedNodeDetails">
            View Details
          </button>
          <button class="close-btn" @click="selectedNodeProperties = null; sigmaInstance?.refresh()">×</button>
        </div>
      </div>
    </div>

    <!-- Details Panel - Records or Packages -->
    <el-drawer
      v-model="showDetailsPanel"
      :title="isSelectedNodePackage ? 'File Details' : 'Record Details'"
      direction="rtl"
      size="50%"
    >
      <div v-if="selectedRecord" class="details-container">
        <!-- Show FileDetails for package nodes -->
        <FileDetails
          v-if="isSelectedNodePackage"
          :datasetId="props.datasetId"
          :fileId="selectedRecord.package?.node_id || selectedRecord.id"
          :no-padding="true"
          :key="selectedRecord.package?.node_id || selectedRecord.id"
        />
        <!-- Show RecordSpecViewer for record nodes -->
        <RecordSpecViewer
          v-else-if="!isSelectedNodePackage && selectedRecord.model && selectedRecord.id"
          :datasetId="props.datasetId"
          :modelId="selectedRecord.model"
          :recordId="selectedRecord.id"
          :no-padding="true"
        />
      </div>
    </el-drawer>
  </bf-stage>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Sigma from 'sigma'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import noverlap from 'graphology-layout-noverlap'
import { circular } from 'graphology-layout'
import { random } from 'graphology-layout'
import { NodeBorderProgram } from '@sigma/node-border'
import { ElSelect, ElOption, ElInput, ElDrawer, ElMessage } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import { useMetadataStore } from '@/stores/metadataStore.js'
import { useGraphExplorerStore } from '@/stores/graphExplorerStore.js'
import { getModelColor, createModelColorAssignment, packageColor } from '@/utils/modelColors.js'
import MultiModelFilter from './MultiModelFilter.vue'
import IconSizeToFit from '@/components/icons/IconSizeToFit.vue'
import IconCenter from '@/components/icons/IconCenter.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import RecordSpecViewer from '@/components/datasets/metadata/records/RecordSpecViewer.vue'
import FileDetails from '@/components/datasets/files/FileDetails/FileDetails.vue'
import PsButtonDropdown from '@/components/shared/ps-button-dropdown/PsButtonDropdown.vue'

// Props
const props = defineProps({
  datasetId: {
    type: String,
    required: true
  },
  orgId: {
    type: String,
    required: true
  }
})

// Stores
const metadataStore = useMetadataStore()
const graphStore = useGraphExplorerStore()
const route = useRoute()

// Sigma.js
const sigmaContainer = ref(null)
const sigmaInstance = ref(null)
const graph = ref(null)

// State
const loading = ref(false)
const nodes = ref([])
const edges = ref([])
const nodeCount = ref(0)
const edgeCount = ref(0)
const recordLimit = ref(50) // Default to 50 records per model
const isQuerySectionCollapsed = ref(false) // Track query section collapse state
const quickActionsVisible = ref(true) // Track if actions are shown inline or in dropdown
const legendExpanded = ref(false) // Track legend expansion state
const models = computed(() => {
  // Models are now flattened in store: [{ id, name, display_name, ... }]
  return (metadataStore.models || [])
    .filter(model => model && model.id && model.name) // Filter out invalid models
})
const showDetailsPanel = ref(false)
const selectedRecord = ref(null)
const selectedNodeProperties = ref(null)
const expandedNodes = ref(new Set())
const lockedNodes = ref(new Set()) // Nodes locked in place during Force mode
const currentLayout = ref('Force')

// Layout options for Sigma.js
const layoutOptions = {
  'Force': 'forceAtlas2',
  'Circle': 'circular', 
  'Random': 'random'
}

// Query filters - support multiple filters
const queryFilters = ref([
  {
    id: Date.now(),
    model: '',
    property: '',
    operator: '',
    value: '',
    modelProperties: []
  }
])

// Computed
const canExecuteQuery = computed(() => {
  // At least one filter must have a model selected
  // Filters can be executed with just model (no property/operator/value required)
  return queryFilters.value.some(filter => filter.model)
})

const isSelectedNodePackage = computed(() => {
  if (!selectedRecord.value) return false
  
  console.log('🔍 Checking if selected node is package:', selectedRecord.value)
  
  // First check the nodeType which is now preserved from our node structure
  console.log('📦 Node nodeType:', selectedRecord.value.nodeType)
  if (selectedRecord.value.nodeType === 'package') {
    console.log('✅ Detected package by nodeType field')
    return true
  }
  
  // Fallback: Node ID starts with 'package-'
  const nodeId = selectedRecord.value.nodeId || selectedRecord.value.id
  console.log('📦 Node ID:', nodeId)
  if (typeof nodeId === 'string' && nodeId.startsWith('package-')) {
    console.log('✅ Detected package by ID pattern')
    return true
  }
  
  // Fallback: Node has type field set to 'package' (from the data)
  console.log('📦 Node type:', selectedRecord.value.type)
  if (selectedRecord.value.type === 'package') {
    console.log('✅ Detected package by type field')
    return true
  }
  
  // Fallback: Node lacks model field (packages don't have models, records do)
  // AND has properties typical of packages
  console.log('📦 Node model:', selectedRecord.value.model)
  console.log('📦 Node size:', selectedRecord.value.size)
  console.log('📦 Node name:', selectedRecord.value.name)
  if (!selectedRecord.value.model && (
    selectedRecord.value.size !== undefined || 
    selectedRecord.value.name !== undefined ||
    selectedRecord.value.type !== undefined
  )) {
    console.log('✅ Detected package by missing model + package properties')
    return true
  }
  
  console.log('❌ Not detected as package')
  return false
})

// Methods
const onModelChange = async (filterIndex, modelId) => {
  const filter = queryFilters.value[filterIndex]
  if (!filter) return
  
  filter.model = modelId
  filter.modelProperties = []
  filter.property = ''
  filter.operator = ''
  filter.value = ''
  
  if (modelId) {
    await fetchModelProperties(modelId, filterIndex)
  }
}

// Update filter helper
const updateFilter = (filterIndex, updatedFilter) => {
  if (queryFilters.value[filterIndex]) {
    queryFilters.value[filterIndex] = updatedFilter
  }
}

const fetchModelProperties = async (modelId, filterIndex) => {
  try {
    const model = models.value.find(m => m.id === modelId)
    if (model && model.latest_version && model.latest_version.schema) {
      // Extract properties from the model's schema
      const schema = model.latest_version.schema
      if (schema.properties) {
        // Convert schema properties to array format for the dropdown
        const properties = Object.keys(schema.properties).map(key => ({
          name: key,
          display_name: schema.properties[key].title || key,
          type: schema.properties[key].type || 'string',
          description: schema.properties[key].description || ''
        }))
        
        // Update the specific filter's model properties
        if (queryFilters.value[filterIndex]) {
          queryFilters.value[filterIndex].modelProperties = properties
        }
      } else {
        if (queryFilters.value[filterIndex]) {
          queryFilters.value[filterIndex].modelProperties = []
        }
      }
    } else {
      console.warn('Model not found or missing schema:', modelId)
      if (queryFilters.value[filterIndex]) {
        queryFilters.value[filterIndex].modelProperties = []
      }
    }
  } catch (error) {
    console.error('Error extracting model properties:', error)
    ElMessage.error('Failed to load model properties')
    if (queryFilters.value[filterIndex]) {
      queryFilters.value[filterIndex].modelProperties = []
    }
  }
}

// Add a new filter row
const addFilter = () => {
  queryFilters.value.push({
    id: Date.now(),
    model: '',
    property: '',
    operator: '',
    value: '',
    modelProperties: []
  })
}

// Remove a filter row
const removeFilter = (index) => {
  if (queryFilters.value.length > 1) {
    queryFilters.value.splice(index, 1)
  }
}

// Helper function to convert dot notation to JSON path format
const convertToJsonPath = (property, modelId) => {
  if (!property) return ''

  // Convert dot notation to JSON path format: availability.quantity -> /availability/quantity
  let jsonPath = property.includes('.') ?
    `/${property.replace(/\./g, '/')}` :
    `/${property}`

  // Check if this property is an array and append /* if needed
  if (modelId) {
    const model = models.value.find(m => m.id === modelId)
    if (model && model.latest_version && model.latest_version.schema) {
      const schema = model.latest_version.schema

      // Navigate to the property in the schema to check its type
      const pathParts = property.split('.')
      let currentSchema = schema.properties

      for (let i = 0; i < pathParts.length && currentSchema; i++) {
        const part = pathParts[i]
        if (currentSchema[part]) {
          if (i === pathParts.length - 1) {
            // This is the final property - check if it's an array
            if (currentSchema[part].type === 'array') {
              jsonPath += '/*'
            }
          } else {
            // Navigate deeper into the schema
            if (currentSchema[part].type === 'object' && currentSchema[part].properties) {
              currentSchema = currentSchema[part].properties
            } else {
              break // Can't navigate deeper
            }
          }
        } else {
          break // Property not found
        }
      }
    }
  }

  return jsonPath
}

const executeQuery = async () => {
  if (!canExecuteQuery.value) return
  
  loading.value = true
  try {
    // Create one API call per MultiModelFilter instance
    const queryPromises = queryFilters.value
      .filter(filter => filter.model) // Only process filters with a model selected
      .map(async (multiModelFilter, index) => {
        try {
          let options = { limit: recordLimit.value }

          // Handle multiple filters within each MultiModelFilter
          if (multiModelFilter.hasMultipleFilters && multiModelFilter.subFilters) {
            // MultiModelFilter has multiple sub-filters
            const validSubFilters = multiModelFilter.subFilters.filter(subFilter =>
              subFilter.property && subFilter.operator && subFilter.value
            )

            if (validSubFilters.length === 0) {
              // No valid filters - fetch all records for the model (don't set options.filter)
              console.log(`No valid sub-filters for model ${multiModelFilter.model}, fetching all records`)
            } else if (validSubFilters.length === 1) {
              // Single sub-filter - use it directly
              const subFilter = validSubFilters[0]
              options.filter = {
                property: convertToJsonPath(subFilter.property, multiModelFilter.model),
                operator: subFilter.operator,
                value: parseValue(subFilter.value, subFilter.operator, subFilter.property, multiModelFilter.modelProperties, multiModelFilter.model)
              }
            } else {
              // Multiple sub-filters - combine with the logical operator using the correct API format
              const subFilterPredicates = validSubFilters.map(subFilter => {
                console.log('🔍 Processing subFilter:', {
                  property: subFilter.property,
                  operator: subFilter.operator,
                  originalValue: subFilter.value,
                  valueType: typeof subFilter.value,
                  modelProperties: multiModelFilter.modelProperties?.map(p => ({ name: p.name, type: p.type, description: p.description }))
                })
                const parsedValue = parseValue(subFilter.value, subFilter.operator, subFilter.property, multiModelFilter.modelProperties, multiModelFilter.model)
                console.log('🔍 After parseValue:', {
                  property: subFilter.property,
                  parsedValue,
                  parsedValueType: typeof parsedValue
                })
                const predicate = {
                  property: convertToJsonPath(subFilter.property, multiModelFilter.model),
                  operator: subFilter.operator,
                  value: parsedValue
                }
                console.log('🔍 Final predicate:', predicate)
                return predicate
              }).filter(predicate => predicate.value !== null) // Filter out null values


              // Use the logical operator as the key (and/or)
              const logicalOp = multiModelFilter.logicalOperator || 'and'
              options.filter = {
                [logicalOp]: subFilterPredicates
              }

            }
          } else {
            // Single filter (legacy format or single filter in new format)
            if (multiModelFilter.property && multiModelFilter.operator && multiModelFilter.value) {
              options.filter = {
                property: convertToJsonPath(multiModelFilter.property),
                operator: multiModelFilter.operator,
                value: parseValue(multiModelFilter.value, multiModelFilter.operator, multiModelFilter.property, multiModelFilter.modelProperties, multiModelFilter.model)
              }
            } else {
              // No valid single filter - fetch all records for the model (don't set options.filter)
              console.log(`No valid single filter for model ${multiModelFilter.model}, fetching all records`)
            }
          }

          const response = await metadataStore.fetchRecords(props.datasetId, multiModelFilter.model, options)
          return {
            multiModelFilterIndex: index,
            modelId: multiModelFilter.model,
            records: response.records || [],
            multiModelFilter: multiModelFilter
          }
        } catch (error) {
          console.error(`Query error for MultiModelFilter ${index} (model ${multiModelFilter.model}):`, error)
          return {
            multiModelFilterIndex: index,
            modelId: multiModelFilter.model,
            records: [],
            multiModelFilter: multiModelFilter,
            error: error
          }
        }
      })
    
    // Execute all queries in parallel
    const results = await Promise.all(queryPromises)
    
    // Combine and display results
    const allRecords = []
    let errorCount = 0
    let successfulCalls = 0
    
    results.forEach(result => {
      if (result.error) {
        errorCount++
        console.warn(`MultiModelFilter ${result.multiModelFilterIndex} failed:`, result.error)
      } else {
        allRecords.push(...result.records)
        successfulCalls++
      }
    })
    
    if (errorCount > 0) {
      ElMessage.warning(`${errorCount} queries failed, showing results from ${successfulCalls} successful queries`)
    }
    
    displayQueryResults(allRecords)
    
  } catch (error) {
    console.error('Query execution error:', error)
    ElMessage.error('Failed to execute queries')
  } finally {
    loading.value = false
  }
}

// Parse value based on operator type (similar to RecordFilter)
// Helper function to get nested property type from schema
const getNestedPropertyType = (propertyPath, modelId) => {
  if (!propertyPath || !modelId) return 'string'

  const model = models.value.find(m => m.id === modelId)
  if (!model || !model.latest_version || !model.latest_version.schema) return 'string'

  const schema = model.latest_version.schema
  if (!schema.properties) return 'string'

  // Handle dot notation for nested properties
  const pathParts = propertyPath.split('.')
  let currentSchema = schema.properties

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i]
    if (currentSchema[part]) {
      if (i === pathParts.length - 1) {
        // Last part - return the type
        return currentSchema[part].type || 'string'
      } else {
        // Navigate deeper
        if (currentSchema[part].type === 'object' && currentSchema[part].properties) {
          currentSchema = currentSchema[part].properties
        } else {
          return 'string' // Can't navigate deeper
        }
      }
    } else {
      return 'string' // Property not found
    }
  }

  return 'string'
}

const parseValue = (value, operator, propertyName, modelProperties, modelId) => {
  if (!value) return value
  
  // Get property type for better value parsing
  // First try to find the property directly (for simple properties from GraphExplorer)
  let property = modelProperties?.find(p => p.name === propertyName)
  let propertyType = property?.type

  // If not found, try nested property lookup using the schema
  if (!property && propertyName && propertyName.includes('.') && modelId) {
    propertyType = getNestedPropertyType(propertyName, modelId)
    console.log('🔍 Nested property lookup:', {
      propertyName,
      modelId,
      resolvedType: propertyType,
      originalValue: value
    })
  }

  // Fallback to simple property name lookup
  if (!propertyType && propertyName && propertyName.includes('.')) {
    const simplePropertyName = propertyName.split('.').pop()
    property = modelProperties?.find(p => p.name === simplePropertyName)
    propertyType = property?.type
  }

  propertyType = propertyType || 'string'
  
  // Handle operators that expect arrays
  if (['in', 'overlap', 'containedIn'].includes(operator)) {
    return value.split(',').map(v => {
      const trimmed = v.trim()
      if (propertyType === 'number' || propertyType === 'integer') {
        return Number(trimmed)
      }
      return trimmed
    })
  }
  
  // Handle between operator
  if (operator === 'between') {
    const parts = value.split(',').map(v => v.trim())
    if (parts.length !== 2) return null
    return parts.map(v => {
      if (propertyType === 'number' || propertyType === 'integer') {
        return Number(v)
      }
      return v
    })
  }
  
  // Handle length operators for arrays
  if (operator.startsWith('length')) {
    return Number(value)
  }
  
  // Convert to appropriate type
  if (propertyType === 'number' || propertyType === 'integer') {
    return Number(value)
  }
  
  if (propertyType === 'boolean') {
    console.log('🔍 Boolean conversion debug:', {
      propertyName,
      originalValue: value,
      valueType: typeof value,
      property,
      propertyType,
      modelProperties: modelProperties?.map(p => ({ name: p.name, type: p.type })),
      convertedValue: value === 'true' || value === true
    })
    return value === 'true' || value === true
  }
  

  return value
}

const displayQueryResults = (records) => {
  
  // Clear existing data
  nodes.value = []
  edges.value = []
  expandedNodes.value.clear()
  nodeExpansionMap.value.clear()
  
  // Clear selected nodes
  selectedNodeProperties.value = null
  selectedRecord.value = null
  showDetailsPanel.value = false
  
  if (!records || records.length === 0) {
    ElMessage.info('No records found matching your query')
    if (graph.value) {
      graph.value.clear()
      sigmaInstance.value?.refresh()
    }
    return
  }
  
  // Create color assignment for all unique models in the results
  const uniqueModelIds = [...new Set(records.map(r => r.model_id).filter(id => id))]
  modelColorAssignment.value = createModelColorAssignment(uniqueModelIds)
  displayedModels.value = uniqueModelIds
  
  // Create nodes for each record in a grid layout
  const gridSize = Math.ceil(Math.sqrt(records.length))
  const spacing = 150 // Space between grid positions
  
  records.forEach((record, index) => {
    
    const nodeId = `record-${record.id}`
    const row = Math.floor(index / gridSize)
    const col = index % gridSize
    
    // The actual properties are in the 'value' field from the API response
    const properties = record.value || record.properties || record.values || {}
    
    
    const node = {
      id: nodeId,
      type: 'record',
      position: { 
        x: (col - gridSize / 2) * spacing,
        y: (row - gridSize / 2) * spacing
      },
      data: {
        id: record.id,
        label: getRecordLabel(record, record.model_id),
        model: record.model_id,
        properties: properties,
        relationships: [],
        expanded: false
      }
    }
    
    nodes.value.push(node)
  })
  
  
  // Update the graph
  updateGraph()
  
  // Save state after successful query
  saveStateToStore()
  
  ElMessage.success(`Found ${records.length} records`)
}

// These are now handled by Sigma event listeners in initializeGraph()

const expandNode = async (nodeId) => {
  try {
    
    if (expandedNodes.value.has(nodeId)) {
      collapseNode(nodeId)
      return
    }
    
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) {
      console.error('❌ Node not found for expansion:', nodeId)
      ElMessage.error('Node not found')
      return
    }
    
    
    loading.value = true
    
    // Fetch relationships for this record
    const relationships = await fetchRecordRelationships(node.data.id)
    
    // Fetch packages for this record
    const packages = await fetchRecordPackages(node.data.id)
    
    // Add new nodes and edges
    const { limitedRelationships, limitedPackages, addedChildren, addedEdges } = addRelatedNodes(node, relationships, packages)
    
    // Track expansion for proper collapse behavior
    nodeExpansionMap.value.set(nodeId, {
      children: addedChildren,
      edges: addedEdges
    })
    
    // Mark as expanded
    expandedNodes.value.add(nodeId)
    node.data.expanded = true
    
    
    // Update the graph display
    updateGraph()
    
    // Save state after node expansion
    saveStateToStore()
    
    // Start animated force simulation after node expansion (only in Force mode)
    if (currentLayout.value === 'Force') {
      await startBackgroundForceSimulation()
    }
    
    // Debug: Log locked nodes after expansion
    console.log('🔒 Locked nodes after expansion:', Array.from(lockedNodes.value))

  } catch (error) {
    console.error('❌ Error expanding node:', error)
    ElMessage.error(`Failed to expand node: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const fetchRecordRelationships = async (recordId) => {
  try {
    // Use the metadata store method
    const relationships = await metadataStore.fetchRecordRelationships(props.datasetId, recordId)
    
    // Handle different response structures
    if (Array.isArray(relationships)) {
      return relationships
    } else if (relationships && Array.isArray(relationships.relationships)) {
      return relationships.relationships
    } else if (relationships && Array.isArray(relationships.data)) {
      return relationships.data
    } else if (relationships && relationships.relationships && (relationships.relationships.inbound || relationships.relationships.outbound)) {
      // Handle new API structure: {relationships: {inbound: [...], outbound: [...]}}
      const relationshipData = relationships.relationships
      const allRelationships = [
        ...(Array.isArray(relationshipData.inbound) ? relationshipData.inbound.map(rel => ({
          ...rel,
          direction: 'inbound'
        })) : []),
        ...(Array.isArray(relationshipData.outbound) ? relationshipData.outbound.map(rel => ({
          ...rel,
          direction: 'outbound'
        })) : [])
      ]
      // Debug the structure of individual relationships
      if (allRelationships.length > 0) {
        console.log('🔍 Found relationships with new API structure:', allRelationships.length)
      }
      return allRelationships
    } else if (relationships && (relationships.inbound || relationships.outbound)) {
      // Handle legacy {inbound: [...], outbound: [...]} structure (fallback)
      const allRelationships = [
        ...(Array.isArray(relationships.inbound) ? relationships.inbound.map(rel => ({
          ...rel,
          direction: 'inbound'
        })) : []),
        ...(Array.isArray(relationships.outbound) ? relationships.outbound.map(rel => ({
          ...rel,
          direction: 'outbound'
        })) : [])
      ]
      // Debug the structure of individual relationships
      if (allRelationships.length > 0) {
      }
      return allRelationships
    } else {
      console.warn('Unexpected relationships structure:', relationships)
      return []
    }
  } catch (error) {
    console.error('Error fetching relationships:', error)
    return []
  }
}

const fetchRecordPackages = async (recordId) => {
  try {
    console.log('🔍 Fetching packages for record:', recordId)
    // Use the metadata store method
    const packages = await metadataStore.fetchRecordPackages(props.datasetId, recordId)
    
    console.log('📦 Raw packages response:', packages)
    
    // Handle different response structures
    if (Array.isArray(packages)) {
      console.log('✅ Found packages (array):', packages.length)
      return packages
    } else if (packages && Array.isArray(packages.packages)) {
      console.log('✅ Found packages (nested):', packages.packages.length)
      return packages.packages
    } else if (packages && Array.isArray(packages.data)) {
      console.log('✅ Found packages (data):', packages.data.length)
      return packages.data
    } else {
      console.warn('⚠️ Unexpected packages structure:', packages)
      return []
    }
  } catch (error) {
    console.error('❌ Error fetching packages:', error)
    return []
  }
}

const addRelatedNodes = (parentNode, relationships, packages) => {
  try {
    const parentId = parentNode.id
    
    // Get current position of parent node from Sigma graph
    const currentParentAttrs = graph.value.getNodeAttributes(parentId)
    const currentParentPosition = {
      x: currentParentAttrs.x || parentNode.position.x,
      y: currentParentAttrs.y || parentNode.position.y
    }
    
    // Track new models found during expansion for legend updates
    const newModelIds = new Set()
    
    // Track added children and edges for collapse functionality
    const addedChildren = new Set()
    const addedEdges = new Set()
    
    // Cap the total number of additional nodes at 100
    const maxAdditionalNodes = 100
    const totalNodes = relationships.length + packages.length
    
    let limitedRelationships = relationships
    let limitedPackages = packages
    
    if (totalNodes > maxAdditionalNodes) {
      // Prioritize relationships over packages
      if (relationships.length >= maxAdditionalNodes) {
        limitedRelationships = relationships.slice(0, maxAdditionalNodes)
        limitedPackages = []
      } else {
        limitedRelationships = relationships
        limitedPackages = packages.slice(0, maxAdditionalNodes - relationships.length)
      }
      
    }
    
    // Add relationship nodes with direction-aware edges
    limitedRelationships.forEach((rel, index) => {
      try {
        
        // Extract the related record information
        const relatedRecord = rel.record || {}
        
        // Validate that we have a valid record ID
        if (!relatedRecord.id) {
          console.warn('⚠️ Skipping relationship with no record ID:', rel)
          return
        }
        
        const targetId = `record-${relatedRecord.id}`
        let nodeExists = false
        
        // Check if node already exists
        const existingNode = nodes.value.find(n => n.id === targetId)
        if (!existingNode) {
          // Position new nodes closer to parent using current position
          const baseDistance = Math.min(120, Math.max(80, limitedRelationships.length * 20)) // Reduced distance
          const randomOffset = (Math.random() - 0.5) * 60 // Reduced random offset ±30px
          const angle = (Math.random() * 2 * Math.PI) // Random angle
          
          const newNode = {
            id: targetId,
            type: 'record',
            position: {
              x: currentParentPosition.x + Math.cos(angle) * (baseDistance + randomOffset),
              y: currentParentPosition.y + Math.sin(angle) * (baseDistance + randomOffset)
            },
            data: {
              id: relatedRecord.id,
              label: getRecordLabel(relatedRecord, relatedRecord.model_id),
              model: relatedRecord.model_id,
              properties: relatedRecord.value || relatedRecord.properties || relatedRecord.values || {},
              relationships: [],
              expanded: false
            }
          }
          nodes.value.push(newNode)
          
          // Track new model for color assignment and legend
          if (relatedRecord.model_id && !modelColorAssignment.value.has(relatedRecord.model_id)) {
            newModelIds.add(relatedRecord.model_id)
          }
          
          // Only track nodes that were actually created during this expansion
          addedChildren.add(targetId)
        } else {
          nodeExists = true
        }
        
        // Create edge with direction-based coloring (always create edge, even to existing nodes)
        const edgeId = `${parentId}-${targetId}-${rel.direction || 'unknown'}`
        if (!edges.value.find(e => e.id === edgeId)) {
          // Store direction information but use grey color by default
          // Colors will be applied dynamically in edgeReducer based on selection
          const isOutbound = rel.direction === 'outbound'
          const edgeLabel = `${rel.relationship_type || 'related'} ${isOutbound ? '→' : '←'}`
          
          edges.value.push({
            id: edgeId,
            source: isOutbound ? parentId : targetId,  // Correct direction
            target: isOutbound ? targetId : parentId,  // Correct direction
            label: edgeLabel,
            type: 'default',
            style: { 
              stroke: '#d1d5db', // Default grey color
              strokeWidth: 2
            },
            data: {
              direction: rel.direction,
              relationshipType: rel.relationship_type,
              parentNodeId: parentId // Store which node this edge was expanded from
            }
          })
          
          // Track edge for collapse functionality
          addedEdges.add(edgeId)
          
        } else {
        }
      } catch (relError) {
        console.error('❌ Error processing relationship:', relError, rel)
      }
    })
    
    // Update color assignments for new models
    if (newModelIds.size > 0) {
      
      // Get all current model IDs including new ones
      const allModelIds = [...new Set([...displayedModels.value, ...newModelIds])]
      
      // Create new color assignment that preserves existing colors
      const newColorAssignment = createModelColorAssignment(allModelIds)
      
      // Preserve existing color assignments
      modelColorAssignment.value.forEach((color, modelId) => {
        if (newColorAssignment.has(modelId)) {
          newColorAssignment.set(modelId, color)
        }
      })
      
      modelColorAssignment.value = newColorAssignment
      displayedModels.value = allModelIds
      
    }
    
    // Add package nodes
    limitedPackages.forEach((pkg, index) => {
      try {
        
        // Handle nested package structure from API response
        const packageData = pkg.package || pkg
        
        // Validate package has ID
        if (!packageData.id) {
          console.warn('⚠️ Skipping package with no ID:', pkg)
          return
        }
        
        const packageId = `package-${packageData.id}`
        
        if (!nodes.value.find(n => n.id === packageId)) {
          // Position packages closer to parent using current position
          const packageAngle = (index / limitedPackages.length) * 2 * Math.PI + Math.PI // Offset by PI to separate from relationships
          const packageRadius = Math.min(140, Math.max(100, limitedPackages.length * 25)) // Reduced radius
          
          const newNode = {
            id: packageId,
            type: 'package',
            position: {
              x: currentParentPosition.x + Math.cos(packageAngle) * packageRadius,
              y: currentParentPosition.y + Math.sin(packageAngle) * packageRadius
            },
            data: {
              id: packageData.id,
              label: packageData.name || '',
              type: packageData.type,
              size: packageData.size,
              expanded: false,
              // Store the complete package data for API calls
              package: packageData
            }
          }
          console.log('📦 Creating package node:', packageId)
          console.log('📦 Package data being stored:', packageData)
          console.log('📦 newNode.data.package:', newNode.data.package)
          console.log('📦 newNode.data.package.node_id:', newNode.data.package?.node_id)
          nodes.value.push(newNode)
          
          // Only track nodes that were actually created during this expansion
          addedChildren.add(packageId)
        } else {
        }
        
        // Add edge to package
        const edgeId = `${parentId}-${packageId}`
        if (!edges.value.find(e => e.id === edgeId)) {
          edges.value.push({
            id: edgeId,
            source: parentId,
            target: packageId,
            label: 'has file',
            type: 'smoothstep',
            style: { 
              stroke: '#6B7280', // gray for packages
              strokeWidth: 1,
              strokeDasharray: '5,5' // dashed line for packages
            }
          })
          
          // Track edge for collapse functionality
          addedEdges.add(edgeId)
          
        } else {
        }
      } catch (pkgError) {
        console.error('❌ Error processing package:', pkgError, pkg)
      }
    })
    
    
    return { limitedRelationships, limitedPackages, addedChildren, addedEdges }
    
  } catch (error) {
    console.error('❌ Error in addRelatedNodes:', error)
    throw error
  }
}

const collapseNode = (nodeId) => {
  try {
    
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) {
      console.warn('⚠️ Node not found for collapse:', nodeId)
      return
    }
    
    // Get expansion tracking data
    const expansionData = nodeExpansionMap.value.get(nodeId)
    if (!expansionData) {
      console.warn('⚠️ No expansion data found for node:', nodeId)
      return
    }
    
    const { children, edges: trackedEdges } = expansionData
    
    // Remove only the tracked child nodes
    const childrenArray = Array.from(children)
    const removedNodeIds = new Set(childrenArray)
    nodes.value = nodes.value.filter(n => !removedNodeIds.has(n.id))
    
    // Only remove edges that connect to nodes being removed OR are specifically tracked
    // This prevents removing edges between nodes that should remain connected
    edges.value = edges.value.filter(edge => {
      const edgeId = edge.id
      const isTrackedEdge = trackedEdges.has(edgeId)
      const connectsToRemovedNode = removedNodeIds.has(edge.source) || removedNodeIds.has(edge.target)
      
      // Remove edge if:
      // 1. It's specifically tracked from this expansion AND connects to a removed node, OR
      // 2. It connects to a node being removed (cleanup orphaned edges)
      const shouldRemove = (isTrackedEdge && connectsToRemovedNode) || 
                          (connectsToRemovedNode && !isEdgeBetweenRemainingNodes(edge, removedNodeIds))
      
      if (shouldRemove) {
      }
      
      return !shouldRemove
    })
    
    // Clean up expansion tracking
    nodeExpansionMap.value.delete(nodeId)
    
    // Mark as collapsed
    expandedNodes.value.delete(nodeId)
    node.data.expanded = false
    
    
    // Update graph
    updateGraph()
    
  } catch (error) {
    console.error('❌ Error collapsing node:', error)
  }
}

// Helper function to check if an edge connects two nodes that should remain
const isEdgeBetweenRemainingNodes = (edge, removedNodeIds) => {
  const sourceRemaining = !removedNodeIds.has(edge.source)
  const targetRemaining = !removedNodeIds.has(edge.target)
  return sourceRemaining && targetRemaining
}

const removeNode = (nodeId) => {
  // Remove node and all connected edges
  nodes.value = nodes.value.filter(n => n.id !== nodeId)
  edges.value = edges.value.filter(e => e.source !== nodeId && e.target !== nodeId)
  expandedNodes.value.delete(nodeId)
  
  if (selectedRecord.value?.id === nodeId) {
    selectedRecord.value = null
    showDetailsPanel.value = false
  }
  
  // Update graph
  updateGraph()
}

const clearAllQueries = () => {
  // Reset to single empty filter
  queryFilters.value = [
    {
      id: Date.now(),
      model: '',
      property: '',
      operator: '',
      value: '',
      modelProperties: []
    }
  ]
  
  nodes.value = []
  edges.value = []
  expandedNodes.value.clear()
  nodeExpansionMap.value.clear()
  selectedRecord.value = null
  showDetailsPanel.value = false
  
  // Clear the graph
  if (graph.value) {
    graph.value.clear()
    nodeCount.value = 0
    edgeCount.value = 0
    sigmaInstance.value?.refresh()
  }
}

const toggleActionDropdown = () => {
  quickActionsVisible.value = !quickActionsVisible.value
}

const fitView = () => {
  if (sigmaInstance.value && graph.value.order > 0) {
    const camera = sigmaInstance.value.getCamera()
    camera.animatedReset({ duration: 300 })
  }
}

const centerGraph = () => {
  if (sigmaInstance.value && graph.value.order > 0) {
    const camera = sigmaInstance.value.getCamera()
    camera.animatedReset({ duration: 300 })
  }
}

const toggleLayout = () => {
  const layouts = Object.keys(layoutOptions)
  const currentIndex = layouts.indexOf(currentLayout.value)
  currentLayout.value = layouts[(currentIndex + 1) % layouts.length]
  applyLayoutToGraph()
}

const onEdgeClick = (event) => {
  // Handle edge click if needed
}

const expandSelectedNode = () => {
  if (selectedRecord.value) {
    const node = nodes.value.find(n => n.data.id === selectedRecord.value.id)
    if (node) {
      expandNode(node.id)
      showDetailsPanel.value = false
    }
  }
}

const removeSelectedNode = () => {
  if (selectedRecord.value) {
    const node = nodes.value.find(n => n.data.id === selectedRecord.value.id)
    if (node) {
      removeNode(node.id)
      showDetailsPanel.value = false
    }
  }
}

const viewRecordDetails = (recordId) => {
  // Navigate to record details view or show in panel
  const node = nodes.value.find(n => n.data.id === recordId)
  if (node) {
    selectedRecord.value = node.data
    showDetailsPanel.value = true
  }
}

const viewSelectedNodeDetails = () => {
  // Find the node that corresponds to the selected properties
  if (selectedNodeProperties.value) {
    // Extract the node ID from the label or find the matching node
    const matchingNode = nodes.value.find(node => {
      return node.data.label === selectedNodeProperties.value.label ||
             JSON.stringify(node.data.properties) === JSON.stringify(selectedNodeProperties.value.properties)
    })
    
    if (matchingNode) {
      // Preserve node type information just like in the Ctrl+Click handler
      selectedRecord.value = {
        ...matchingNode.data,
        nodeType: matchingNode.type // Preserve the node type
      }
      showDetailsPanel.value = true
      // Close the properties bar
      selectedNodeProperties.value = null
    }
  }
}

const viewPackageDetails = (packageId) => {
  // Navigate to package/file details view
}

// Node locking functions
const lockNode = (nodeId) => {
  if (currentLayout.value === 'Force') {
    lockedNodes.value.add(nodeId)
  }
}

const unlockNode = (nodeId) => {
  lockedNodes.value.delete(nodeId)
}

const isNodeLocked = (nodeId) => {
  return lockedNodes.value.has(nodeId)
}

const getSelectedNodeId = () => {
  if (!selectedNodeProperties.value) return null
  
  // Use the nodeId stored directly in selectedNodeProperties
  return selectedNodeProperties.value.nodeId || null
}

const unlockSelectedNode = () => {
  const nodeId = getSelectedNodeId()
  if (nodeId && isNodeLocked(nodeId)) {
    unlockNode(nodeId)
    // Refresh to update any visual indicators
    sigmaInstance.value?.refresh()
  }
}

// Format property value for display
const formatPropertyValue = (value) => {
  if (value === null || value === undefined) {
    return 'N/A'
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...'
  }
  
  return String(value)
}

// Model color assignment for consistent colors across the session
const modelColorAssignment = ref(new Map())
const displayedModels = ref([])

// Track which nodes are expanded and their children for proper collapse behavior
const nodeExpansionMap = ref(new Map()) // nodeId -> { children: Set<nodeId>, edges: Set<edgeId> }

// Get model name for legend
const getModelName = (modelId) => {
  const model = models.value.find(m => m.id === modelId)
  return model?.display_name || model?.name || 'Unknown Model'
}

// Get model color for legend
const getModelColorForLegend = (modelId) => {
  return modelColorAssignment.value.get(modelId) || getModelColor(modelId)
}

// Get record label using model's key property (with character limit)
const getRecordLabel = (record, modelId, maxLength = 20) => {
  try {
    let label = null
    
    // First try standard display fields
    if (record.display_name) {
      label = record.display_name
    } else if (record.name) {
      label = record.name
    } else {
      // Try to get the key property from the model definition
      const model = models.value.find(m => m.id === modelId)
      if (model && model.latest_version && model.latest_version.schema) {
        const schema = model.latest_version.schema
        let keyProperty = null
        
        // Look for key property in multiple possible locations
        if (schema.key) {
          keyProperty = schema.key
        } else if (schema['x-pennsieve-key']) {
          keyProperty = schema['x-pennsieve-key']
        } else if (schema.properties) {
          // Find property with x-pennsieve-key extension
          for (const [propName, propDef] of Object.entries(schema.properties)) {
            if (propDef && propDef['x-pennsieve-key'] === true) {
              keyProperty = propName
              break
            }
          }
        }
        
        
        if (keyProperty) {
          // Check for the key property value in record data
          const recordData = record.value || record.properties || record.values || {}
          
          if (recordData[keyProperty] !== undefined && recordData[keyProperty] !== null) {
            const keyValue = String(recordData[keyProperty])
            label = keyValue
          }
        }
      }
      
      // Final fallback to 'name' property, then no label
      if (!label) {
        const recordData = record.value || record.properties || record.values || {}
        label = recordData.name || '' // Use 'name' property as fallback, or empty string
      }
    }
    
    // Truncate label if it's too long
    if (label && label.length > maxLength) {
      return label.substring(0, maxLength - 3) + '...'
    }
    
    return label || 'record'
  } catch (error) {
    console.warn('Error getting record label:', error)
    const fallback = record.display_name || record.name || ''
    return fallback.length > maxLength ? fallback.substring(0, maxLength - 3) + '...' : fallback
  }
}

// State for drag functionality
const draggedNode = ref(null)
const isDragging = ref(false)
const connectedNodeOffsets = ref(new Map()) // Store relative positions of connected nodes

// State for force layout animation
const forceLayoutRunning = ref(false)
const forceLayoutWorker = ref(null)
const dragForceRunning = ref(false)
const canvasForceRunning = ref(false)

// Initialize Sigma.js
const initializeGraph = () => {
  if (!sigmaContainer.value) return
  
  // Create new graph instance
  graph.value = new Graph()
  
  // Initialize Sigma renderer
  sigmaInstance.value = new Sigma(graph.value, sigmaContainer.value, {
    renderEdgeLabels: true,
    defaultNodeColor: '#7c3aed',
    defaultEdgeColor: '#d1d5db',
    defaultNodeType: 'bordered',
    nodeProgramClasses: {
      bordered: NodeBorderProgram,
    },
    minCameraRatio: 0.1,
    maxCameraRatio: 10,
    enableEdgeClickEvents: true,
    enableEdgeWheelEvents: true,
    enableEdgeHoverEvents: true,
    enableNodeHoverEvents: false, // Disable hover events completely to prevent override of our nodeReducer styling
    // Zoom sensitivity settings for smoother scroll
    zoomingRatio: 1.3, // Reduced from default ~1.5 for smaller zoom steps
    mouseZoomDuration: 200, // Smooth zoom animation duration in ms
    nodeReducer: (node, data) => {
      const res = { ...data }
      
      // Get camera zoom ratio for dynamic sizing
      const camera = sigmaInstance.value?.getCamera()
      const zoomRatio = camera ? camera.ratio : 1
      
      // Calculate size scaling factor based on zoom
      // When zoomed out (ratio > 1), make nodes smaller
      // When zoomed in (ratio < 1), allow nodes to grow but cap at max size
      const sizeFactor = Math.max(0.3, Math.min(2.0, 1 / Math.sqrt(zoomRatio)))
      
      // Check if this node is selected or expanded
      const isSelected = selectedNodeProperties.value && 
        selectedNodeProperties.value.nodeId === node
      const isExpanded = expandedNodes.value.has(node)

      // Base size calculation
      let baseSize = 8
      if (isExpanded) {
        baseSize = 9 // Slightly larger for expanded nodes
      }
      
      // Color nodes based on type and model
      if (node.startsWith('package-')) {
        res.color = packageColor.border
        res.borderColor = packageColor.border
        res.backgroundColor = packageColor.background
        // Limit package label length too
        const originalLabel = data.label || 'Package'
        res.label = originalLabel.length > 20 ? originalLabel.substring(0, 17) + '...' : originalLabel
        res.size = baseSize * sizeFactor // Scale size based on zoom
      } else {
        // Color by model using consistent assignment or fallback to hash
        const modelColor = modelColorAssignment.value.has(data.model) 
          ? modelColorAssignment.value.get(data.model)
          : getModelColor(data.model)

        res.color = modelColor.border
        res.borderColor = modelColor.border  
        res.backgroundColor = modelColor.background
        res.size = baseSize * sizeFactor // Scale size based on zoom

        // Limit record label length
        const originalLabel = data.label || 'record'
        res.label = originalLabel.length > 20 ? originalLabel.substring(0, 17) + '...' : originalLabel
      }
      
      // Handle visual indicators for selection and expansion states
      if (isSelected) {
        // Selected nodes get a different color and are larger
        res.color = '#FFD700' // Gold color for selection
      } else if (isExpanded) {
        // Expanded nodes get a green border while keeping their model color
        res.borderColor = '#ffffff' // Green border for expanded nodes
      }
      
      return res
    },
    edgeReducer: (edgeKey, data) => {
      const res = { ...data }
      
      // Default color for all relationships is grey
      let baseColor = '#b3bcce' // default gray

      // Only show colored relationships if there's a selected node
      if (selectedNodeProperties.value) {
        const selectedNodeId = selectedNodeProperties.value.nodeId

        // Get the edge from the graph to access source and target
        let edgeSource, edgeTarget
        if (graph.value && graph.value.hasEdge(edgeKey)) {
          edgeSource = graph.value.source(edgeKey)
          edgeTarget = graph.value.target(edgeKey)
        }

        // Check if this edge connects to the selected node
        const connectsToSelected = edgeSource === selectedNodeId || edgeTarget === selectedNodeId

        console.log('🔍 Edge coloring debug:', {
          edgeKey,
          edgeSource,
          edgeTarget,
          selectedNodeId,
          connectsToSelected,
          direction: data.direction,
          dataType: data.type
        })

        if (connectsToSelected && edgeSource && edgeTarget) {
          // Determine direction relative to the selected node
          // If the edge source is the selected node, it's outbound from selected
          // If the edge target is the selected node, it's inbound to selected
          const isOutboundFromSelected = edgeSource === selectedNodeId
          const isInboundToSelected = edgeTarget === selectedNodeId

          if (isOutboundFromSelected) {
            baseColor = '#22c55e' // green for outbound from selected node
            console.log('✅ Coloring edge green (outbound from selected)')
          } else if (isInboundToSelected) {
            baseColor = '#3b82f6' // blue for inbound to selected node
            console.log('✅ Coloring edge blue (inbound to selected)')
          }
        }
      }
      
      // Package edges stay grey regardless of selection
      if (data.type === 'package') {
        baseColor = '#6b7280' // gray for package edges
      }

      res.color = baseColor
      res.size = data.size || 2

      return res
    }
  })
  
  // Add click handlers
  sigmaInstance.value.on('clickNode', (event) => {
    console.log('🖱️ Node clicked! isDragging:', isDragging.value)
    if (!isDragging.value) {
      const nodeId = event.node
      const nodeAttributes = graph.value.getNodeAttributes(nodeId)


      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      // The modifier keys are in event.event.original (PointerEvent)
      const originalEvent = event.event?.original
      const hasModifier = originalEvent?.ctrlKey || originalEvent?.metaKey
      console.log('🔑 Modifier key check - hasModifier:', hasModifier, 'ctrlKey:', originalEvent?.ctrlKey, 'metaKey:', originalEvent?.metaKey)
      
      if (hasModifier) {
        // Modifier + click = open sidebar
        console.log('🔍 Node click debug:')
        console.log('   - Clicked nodeId:', nodeId, typeof nodeId)
        console.log('   - Available node IDs:', nodes.value.map(n => n.id))
        console.log('   - Node attributes:', nodeAttributes)
        
        // Find the full node data from our nodes array
        // Try exact match first, then try package ID pattern match
        let fullNodeData = nodes.value.find(n => n.id === nodeId)
        
        if (!fullNodeData && typeof nodeId === 'number') {
          // Try to find package node by numeric ID
          fullNodeData = nodes.value.find(n => n.id === `package-${nodeId}`)
          console.log('   - Tried package pattern match for nodeId:', nodeId, 'found:', fullNodeData)
        }
        
        if (!fullNodeData && typeof nodeId === 'string') {
          // Try to extract numeric ID and find package
          const numericId = nodeId.replace('package-', '')
          if (numericId !== nodeId) {
            fullNodeData = nodes.value.find(n => n.id === `package-${numericId}`)
            console.log('   - Tried reverse package pattern match for nodeId:', nodeId, 'found:', fullNodeData)
          }
        }
        
        console.log('   - Final fullNodeData:', fullNodeData)
        console.log('   - fullNodeData.data:', fullNodeData?.data)
        console.log('   - fullNodeData.data.package:', fullNodeData?.data?.package)
        
        // Use the full node data if available, otherwise fall back to attributes
        selectedRecord.value = fullNodeData ? { 
          ...nodeAttributes, 
          ...fullNodeData.data,
          nodeType: fullNodeData.type // Preserve the node type
        } : nodeAttributes
        
        console.log('   - Final selectedRecord:', selectedRecord.value)
        console.log('   - selectedRecord.package:', selectedRecord.value?.package)
        
        showDetailsPanel.value = true
      } else {
        // Regular click = show banner with node properties
        const nodeData = graph.value.getNodeAttributes(nodeId)
        
        
        // If properties are empty, show other meaningful data from the node
        const properties = nodeData.properties && Object.keys(nodeData.properties).length > 0 
          ? nodeData.properties 
          : {
              // Fallback to showing available node data (excluding technical fields)
              ...Object.fromEntries(
                Object.entries(nodeData).filter(([key, value]) => 
                  !['x', 'y', 'size', 'mass', 'color', 'borderSize', 'borderColor', 'backgroundColor'].includes(key) &&
                  value !== undefined && 
                  value !== null &&
                  value !== ''
                )
              )
            }
        
        selectedNodeProperties.value = {
          nodeId: nodeId,
          label: nodeData.label || 'Node Properties',
          properties: properties
        }
        
        // Refresh to show selection visual indicator
        sigmaInstance.value.refresh()
        
      }
    }
  })
  
  // Add click handler for canvas (empty space)
  sigmaInstance.value.on('clickStage', (event) => {
    // Clear selected node when clicking on empty canvas
    if (selectedNodeProperties.value) {
      selectedNodeProperties.value = null
      sigmaInstance.value.refresh()
    }
  })
  
  sigmaInstance.value.on('doubleClickNode', (event) => {
    // Prevent default camera zoom behavior
    event.preventSigmaDefault()
    event.event.original.preventDefault()
    event.event.original.stopPropagation()
    
    const nodeId = event.node
    const nodeAttributes = graph.value.getNodeAttributes(nodeId)


    expandNode(event.node)
  })
  
  // Note: Node hover events are disabled at the Sigma configuration level
  // (enableNodeHoverEvents: false) to completely prevent hover styling on hidden nodes

  // Add drag functionality
  setupDragBehavior()
  
  // Add canvas drag detection
  setupCanvasDragBehavior()
  
  // Add camera update listener to refresh node sizes on zoom
  sigmaInstance.value.getCamera().on('updated', () => {
    // Trigger a refresh to recalculate node sizes based on new zoom
    sigmaInstance.value.refresh()
  })
}

// Setup drag behavior for nodes
const setupDragBehavior = () => {
  if (!sigmaInstance.value) return
  
  let draggedNodeId = null
  let isDraggingNode = false
  let hasDraggedDistance = false
  let startPosition = null
  const dragThreshold = 5 // pixels
  
  // Mouse down on node - start drag
  sigmaInstance.value.on('downNode', (event) => {
    // Disable dragging in Circle mode
    if (currentLayout.value === 'Circle') {
      return
    }
    
    const nodeId = event.node
    const nodeAttributes = graph.value.getNodeAttributes(nodeId)


    draggedNodeId = event.node
    isDraggingNode = true
    hasDraggedDistance = false
    startPosition = { x: event.event?.clientX || 0, y: event.event?.clientY || 0 }
    
  })
  
  // Mouse move - update node position during drag
  // Use mousemovebody which is the correct event for dragging
  sigmaInstance.value.getMouseCaptor().on('mousemovebody', (event) => {
    if (draggedNodeId && isDraggingNode) {
      // Always prevent camera panning when we're dragging a node
      event.preventSigmaDefault()
      if (event.original) {
        event.original.preventDefault()
        event.original.stopPropagation()
      }

      // Check if we've moved far enough to consider this a real drag
      if (!hasDraggedDistance && startPosition) {
        const clientX = event.original?.clientX || event.x || 0
        const clientY = event.original?.clientY || event.y || 0
        const deltaX = Math.abs(clientX - startPosition.x)
        const deltaY = Math.abs(clientY - startPosition.y)
        if (deltaX > dragThreshold || deltaY > dragThreshold) {
          hasDraggedDistance = true
          // Now we know it's a real drag, update global state
          draggedNode.value = draggedNodeId
          isDragging.value = true
          
          // Disable camera zoom/pan during drag
          sigmaInstance.value.getCamera().disable()
          
          // Store initial positions of connected nodes for dragging
          if (currentLayout.value === 'Force') {
            initializeConnectedNodeDragging(draggedNodeId)
          }
        }
      }

      // Always move the node when we have a dragged node, regardless of threshold
      // Convert current mouse position to graph coordinates
      const currentGraphPos = sigmaInstance.value.viewportToGraph(event)

      // Update node position directly to the cursor position
      graph.value.setNodeAttribute(draggedNodeId, 'x', currentGraphPos.x)
      graph.value.setNodeAttribute(draggedNodeId, 'y', currentGraphPos.y)

      // Update our internal nodes array
      const nodeIndex = nodes.value.findIndex(n => n.id === draggedNodeId)
      if (nodeIndex !== -1) {
        nodes.value[nodeIndex].position = { x: currentGraphPos.x, y: currentGraphPos.y }
      }

      // Move connected nodes if we have dragged distance and are in Force mode
      if (hasDraggedDistance && currentLayout.value === 'Force') {
        moveConnectedNodes(draggedNodeId, currentGraphPos)
      }

      // Refresh display
      sigmaInstance.value.refresh()
    }
  })
  
  // Mouse up - end drag and re-evaluate forces
  const endDrag = () => {
    if (draggedNodeId && isDraggingNode) {
      
      // Re-enable camera
      sigmaInstance.value.getCamera().enable()
      
      // No force simulation cleanup needed for node drag
      
      // Only run force adjustment if we actually dragged
      if (hasDraggedDistance) {
        // Lock the node if we're in Force mode and it was moved
        if (currentLayout.value === 'Force') {
          lockNode(draggedNodeId)
        }
        
        // Run a light ForceAtlas2 simulation to adjust connected nodes
        setTimeout(() => {
          applyDragAdjustment()
        }, 50)
      }
      
      // Reset drag state with a small delay to prevent immediate click events
      setTimeout(() => {
        draggedNode.value = null
        isDragging.value = false
      }, 100)
      
      draggedNodeId = null
      isDraggingNode = false
      hasDraggedDistance = false
      startPosition = null
    }
  }
  
  // Listen for mouse up on MouseCaptor
  sigmaInstance.value.getMouseCaptor().on('mouseup', endDrag)
  
  // Also handle mouse leave to end drag
  sigmaInstance.value.getMouseCaptor().on('mouseleave', () => {
    if (draggedNodeId && isDraggingNode) {
      endDrag()
    }
  })
}

// Setup canvas drag behavior for running continuous aggressive force simulation
const setupCanvasDragBehavior = () => {
  if (!sigmaInstance.value) return
  
  let isCanvasDragging = false
  let dragStartPosition = null
  const canvasDragThreshold = 5 // Reduced threshold for more sensitivity
  
  // Mouse down on canvas (not on node) - start potential canvas drag
  sigmaInstance.value.getMouseCaptor().on('mousedown', (event) => {
    // Only start canvas drag if we're not already dragging a node
    if (!isDragging.value) {
      isCanvasDragging = true
      dragStartPosition = { x: event.x || 0, y: event.y || 0 }
    }
  })
  
  // Mouse move - detect canvas drag and continue simulation
  sigmaInstance.value.getMouseCaptor().on('mousemovebody', (event) => {
    if (isCanvasDragging && !isDragging.value && dragStartPosition) {
      const currentX = event.x || 0
      const currentY = event.y || 0
      const deltaX = Math.abs(currentX - dragStartPosition.x)
      const deltaY = Math.abs(currentY - dragStartPosition.y)
      
      // If we've moved far enough, start continuous canvas simulation
      if (deltaX > canvasDragThreshold || deltaY > canvasDragThreshold) {
        isCanvasDragging = false // Prevent multiple triggers
        startCanvasForceSimulation()
      }
    }
  })
  
  // Mouse up - stop canvas force simulation
  sigmaInstance.value.getMouseCaptor().on('mouseup', () => {
    if (canvasForceRunning.value) {
      stopCanvasForceSimulation()
    }
    isCanvasDragging = false
    dragStartPosition = null
  })
  
  // Mouse leave - also stop canvas force simulation
  sigmaInstance.value.getMouseCaptor().on('mouseleave', () => {
    if (canvasForceRunning.value) {
      stopCanvasForceSimulation()
    }
    isCanvasDragging = false
    dragStartPosition = null
  })
}

// Centralized force simulation settings - simplified into 3 main categories
const forceSettings = {
  // Standard settings - used for most interactions (canvas drag, light adjustments)
  standard: {
    gravity: 0.02,
    scalingRatio: 150,
    strongGravityMode: false,
    barnesHutOptimize: true,
    barnesHutTheta: 1.2,
    linLogMode: false,
    outboundAttractionDistribution: false,
    adjustSizes: true,
    edgeWeightInfluence: 0.3
  },
  
  // Responsive settings - used for node expansion and background simulations
  responsive: {
    gravity: 0.012,
    scalingRatio: 180,
    strongGravityMode: false,
    barnesHutOptimize: true,
    barnesHutTheta: 1,
    linLogMode: true,
    outboundAttractionDistribution: false,
    adjustSizes: true,
    edgeWeightInfluence: 0.12
  },
  
  // Layout settings - used for initial positioning
  layout: {
    expanded: {
      gravity: 0.003,
      scalingRatio: 1600,
      strongGravityMode: false,
      barnesHutOptimize: true,
      barnesHutTheta: 1.5,
      linLogMode: false,
      outboundAttractionDistribution: false,
      adjustSizes: true,
      edgeWeightInfluence: 0.5
    },
    fresh: {
      gravity: 0.006,
      scalingRatio: 250,
      strongGravityMode: false,
      barnesHutOptimize: true,
      barnesHutTheta: 1.2,
      linLogMode: false,
      outboundAttractionDistribution: false,
      adjustSizes: true,
      edgeWeightInfluence: 0.08
    }
  }
}

// Start continuous aggressive force simulation when canvas is dragged
const startCanvasForceSimulation = () => {
  if (!graph.value || graph.value.order === 0 || canvasForceRunning.value) return
  
  // Don't run force simulation for non-Force layouts (Circle, Random)
  if (currentLayout.value !== 'Force') {
    return
  }
  
  canvasForceRunning.value = true
  
  let frameCount = 0
  
  // Animation loop for continuous aggressive canvas force simulation
  const canvasAnimationLoop = () => {
    if (!canvasForceRunning.value || !graph.value) return
    
    frameCount++
    
    try {
      // Run calculations with reduced frequency for smoother movement
      if (frameCount % 2 === 0) { // Every other frame for smoother animation
        // Store locked node positions before force simulation
        const lockedPositions = new Map()
        lockedNodes.value.forEach(nodeId => {
          if (graph.value.hasNode(nodeId)) {
            lockedPositions.set(nodeId, {
              x: graph.value.getNodeAttribute(nodeId, 'x'),
              y: graph.value.getNodeAttribute(nodeId, 'y')
            })
          }
        })
        
        forceAtlas2.assign(graph.value, {
          iterations: 2, // Reduced iterations for smoother movement
          settings: forceSettings.standard
        })
        
        // Restore locked node positions after force simulation
        lockedPositions.forEach((position, nodeId) => {
          if (graph.value.hasNode(nodeId)) {
            graph.value.setNodeAttribute(nodeId, 'x', position.x)
            graph.value.setNodeAttribute(nodeId, 'y', position.y)
          }
        })
      }
      
      // Run noverlap less frequently with gentler settings
      if (frameCount % 4 === 0) { // Every 4th frame for smoother anti-collision
        noverlap.assign(graph.value, {
          maxIterations: 3, // Reduced iterations for smoother movement
          settings: {
            margin: 25, // Slightly larger margin for gentler separation
            speed: 2, // Reduced speed for smoother movement
            maxMove: 60 // Smaller moves for less jumpy animation
          }
        })
      }
      
      // Always refresh display for smooth visuals
      sigmaInstance.value.refresh()
      
      // Continue indefinitely while canvas dragging
      if (canvasForceRunning.value) {
        requestAnimationFrame(canvasAnimationLoop)
      }
      
    } catch (error) {
      console.warn('⚠️ Canvas force animation failed:', error)
      canvasForceRunning.value = false
    }
  }
  
  // Start the continuous animation
  requestAnimationFrame(canvasAnimationLoop)
}

// Stop continuous canvas force simulation
const stopCanvasForceSimulation = () => {
  if (canvasForceRunning.value) {
    canvasForceRunning.value = false
  }
}

// Apply light force adjustment after dragging
const applyDragAdjustment = () => {
  if (!graph.value || graph.value.order === 0) return
  
  try {
    
    // Very light simulation to adjust connected nodes
    const positions = forceAtlas2(graph.value, {
      iterations: 10, // Very few iterations
      settings: {
        ...forceSettings.standard,
        gravity: 0.001, // Very low gravity for adjustment
        scalingRatio: 300 // High repulsion to push nodes apart
      }
    })
    
    // Apply positions safely, but skip locked nodes
    Object.entries(positions).forEach(([nodeId, position]) => {
      if (graph.value.hasNode(nodeId) && position && typeof position.x === 'number' && typeof position.y === 'number') {
        // Skip position updates for locked nodes
        if (!isNodeLocked(nodeId)) {
          graph.value.setNodeAttribute(nodeId, 'x', position.x)
          graph.value.setNodeAttribute(nodeId, 'y', position.y)
          
          // Update our internal nodes array
          const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
          if (nodeIndex !== -1) {
            nodes.value[nodeIndex].position = { x: position.x, y: position.y }
          }
        }
      }
    })
    
    sigmaInstance.value.refresh()
  } catch (error) {
    console.warn('⚠️ Drag adjustment failed:', error)
  }
}

// Start animated background force simulation after node expansion
const startBackgroundForceSimulation = async () => {
  if (!graph.value || graph.value.order === 0 || forceLayoutRunning.value) return
  
  forceLayoutRunning.value = true
  
  try {
    // Use responsive settings for expanded graphs
    const settings = forceSettings.responsive
    
    const startTime = Date.now()
    const minDuration = 800 // Shorter duration for smoother feel
    const maxDuration = 1500 // Reduced max duration
    let iterationCount = 0
    let frameCount = 0
    
    // Create an animation loop that runs the simulation
    const animationLoop = () => {
      if (!forceLayoutRunning.value || !graph.value) return
      
      const elapsed = Date.now() - startTime
      frameCount++
      
      // Stop if we've run long enough
      if (elapsed >= maxDuration) {
        forceLayoutRunning.value = false
        return
      }
      
      try {
        // Only run layout calculations every few frames for smoother animation
        if (frameCount % 3 === 0) { // Run calculations every 3rd frame (~20fps instead of 60fps)
          // Store locked node positions before force simulation
          const lockedPositions = new Map()
          lockedNodes.value.forEach(nodeId => {
            if (graph.value.hasNode(nodeId)) {
              lockedPositions.set(nodeId, {
                x: graph.value.getNodeAttribute(nodeId, 'x'),
                y: graph.value.getNodeAttribute(nodeId, 'y')
              })
            }
          })
          
          // Run very small ForceAtlas2 iterations
          forceAtlas2.assign(graph.value, {
            iterations: 1, // Single iteration per calculation for smoothness
            settings: {
              ...settings,
              // Smoother settings for animation
              gravity: settings.gravity * 0.5, // Gentler gravity during animation
              scalingRatio: settings.scalingRatio * 0.8, // Reduced repulsion for smoother movement
              edgeWeightInfluence: settings.edgeWeightInfluence * 0.7 // Less aggressive edge influence
            }
          })
          
          // Restore locked node positions after force simulation
          lockedPositions.forEach((position, nodeId) => {
            if (graph.value.hasNode(nodeId)) {
              graph.value.setNodeAttribute(nodeId, 'x', position.x)
              graph.value.setNodeAttribute(nodeId, 'y', position.y)
            }
          })
          
          // // Run noverlap less frequently and with gentler settings
          // if (iterationCount % 12 === 0) { // Only every 12 iterations instead of 6
          //   noverlap.assign(graph.value, {
          //     maxIterations: 3, // Very few iterations for smooth animation
          //     settings: {
          //       margin: 35, // Slightly smaller margin for smoother convergence
          //       speed: 1.5, // Slower speed for smoother animation
          //       maxMove: 50 // Much smaller moves for smoother animation
          //     }
          //   })
          // }
          
          iterationCount++
        }
        
        // Always refresh display for smooth visual updates
        sigmaInstance.value.refresh()
        
        // Continue animation if minimum duration hasn't passed
        if (elapsed < minDuration) {
          requestAnimationFrame(animationLoop)
        } else {
          // After minimum duration, check for stability or continue
          const shouldContinue = iterationCount < 30 && elapsed < maxDuration // Reduced max iterations
          if (shouldContinue) {
            requestAnimationFrame(animationLoop)
          } else {
            forceLayoutRunning.value = false
          }
        }
        
      } catch (error) {
        console.warn('⚠️ Force simulation iteration failed:', error)
        forceLayoutRunning.value = false
      }
    }
    
    // Start the animation loop
    requestAnimationFrame(animationLoop)
    
    // Return a promise that resolves when the simulation is done
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (!forceLayoutRunning.value) {
          resolve()
        } else {
          setTimeout(checkCompletion, 100)
        }
      }
      setTimeout(checkCompletion, 100)
    })
    
  } catch (error) {
    console.error('❌ Failed to start background force simulation:', error)
    forceLayoutRunning.value = false
  }
}

// Stop any running force simulation
const stopBackgroundForceSimulation = () => {
  if (forceLayoutRunning.value) {
    forceLayoutRunning.value = false
  }
}

// Start continuous force animation during drag
const startDragForceAnimation = () => {
  if (!graph.value || graph.value.order === 0 || dragForceRunning.value) return
  
  dragForceRunning.value = true
  
  // Very aggressive settings for immediate visible dragging response
  const dragSettings = {
    ...forceSettings.standard,
    gravity: 0.05, // Much higher gravity for immediate visible movement
    scalingRatio: 80, // Much lower repulsion for very fluid movement
    barnesHutOptimize: false, // Disable optimization for immediate response
    edgeWeightInfluence: 0.4 // Very high edge influence for dramatic connected movement
  }
  
  let frameCount = 0
  
  // Animation loop for continuous force simulation during drag
  const dragAnimationLoop = () => {
    if (!dragForceRunning.value || !isDragging.value || !graph.value) return
    
    frameCount++
    
    try {
      // Store locked node positions before force simulation
      const lockedPositions = new Map()
      lockedNodes.value.forEach(nodeId => {
        if (graph.value.hasNode(nodeId)) {
          lockedPositions.set(nodeId, {
            x: graph.value.getNodeAttribute(nodeId, 'x'),
            y: graph.value.getNodeAttribute(nodeId, 'y')
          })
        }
      })
      
      // Run calculations EVERY frame for immediate response
      // Run multiple iterations for more dramatic movement
      forceAtlas2.assign(graph.value, {
        iterations: 3, // Multiple iterations for more dramatic movement
        settings: dragSettings
      })
      
      // Restore locked node positions after force simulation
      lockedPositions.forEach((position, nodeId) => {
        if (graph.value.hasNode(nodeId)) {
          graph.value.setNodeAttribute(nodeId, 'x', position.x)
          graph.value.setNodeAttribute(nodeId, 'y', position.y)
        }
      })
      
      // Run noverlap frequently with aggressive settings
      if (frameCount % 3 === 0) { // Every 3rd frame instead of 16th
        noverlap.assign(graph.value, {
          maxIterations: 5, // More iterations for faster separation
          settings: {
            margin: 25, // Smaller margin for tighter layout during drag
            speed: 3, // Much faster speed for immediate movement
            maxMove: 80 // Larger moves for visible animation
          }
        })
      }
      
      // Always refresh display for smooth visuals
      sigmaInstance.value.refresh()
      
      // Continue if still dragging
      if (dragForceRunning.value && isDragging.value) {
        requestAnimationFrame(dragAnimationLoop)
      } else {
        dragForceRunning.value = false
      }
      
    } catch (error) {
      console.warn('⚠️ Drag force animation failed:', error)
      dragForceRunning.value = false
    }
  }
  
  // Start the animation
  requestAnimationFrame(dragAnimationLoop)
}

// Stop continuous force animation during drag
const stopDragForceAnimation = () => {
  if (dragForceRunning.value) {
    dragForceRunning.value = false
  }
}

// Initialize connected node dragging by storing initial positions
const initializeConnectedNodeDragging = (draggedNodeId) => {
  if (!graph.value || !draggedNodeId) return

  // Clear previous offsets
  connectedNodeOffsets.value.clear()

  try {
    // Get the current position of the dragged node
    const draggedNodePos = {
      x: graph.value.getNodeAttribute(draggedNodeId, 'x'),
      y: graph.value.getNodeAttribute(draggedNodeId, 'y')
    }

    // Find all directly connected nodes
    const connectedNodeIds = new Set()

    // Check all edges to find connected nodes
    edges.value.forEach(edge => {
      if (edge.source === draggedNodeId) {
        connectedNodeIds.add(edge.target)
      } else if (edge.target === draggedNodeId) {
        connectedNodeIds.add(edge.source)
      }
    })

    // Store the relative offset of each connected node to the dragged node
    connectedNodeIds.forEach(connectedNodeId => {
      if (graph.value.hasNode(connectedNodeId)) {
        const connectedNodePos = {
          x: graph.value.getNodeAttribute(connectedNodeId, 'x'),
          y: graph.value.getNodeAttribute(connectedNodeId, 'y')
        }

        // Calculate and store the offset
        const offset = {
          x: connectedNodePos.x - draggedNodePos.x,
          y: connectedNodePos.y - draggedNodePos.y
        }

        connectedNodeOffsets.value.set(connectedNodeId, offset)
      }
    })

    console.log(`🔗 Initialized dragging for ${connectedNodeOffsets.value.size} connected nodes`)
  } catch (error) {
    console.warn('⚠️ Error initializing connected node dragging:', error)
    connectedNodeOffsets.value.clear()
  }
}

// Move connected nodes based on the dragged node's new position
const moveConnectedNodes = (draggedNodeId, newDraggedNodePos) => {
  if (!connectedNodeOffsets.value.size || !graph.value) return

  try {
    // Move each connected node with asymmetric behavior
    connectedNodeOffsets.value.forEach((offset, connectedNodeId) => {
      // Skip locked nodes - they should not move with the dragged node
      if (isNodeLocked(connectedNodeId)) {
        return
      }

      if (graph.value.hasNode(connectedNodeId)) {
        // Get current position of the connected node
        const currentPos = {
          x: graph.value.getNodeAttribute(connectedNodeId, 'x'),
          y: graph.value.getNodeAttribute(connectedNodeId, 'y')
        }

        // Calculate current distance between dragged node and connected node
        const currentDistance = Math.sqrt(
          Math.pow(currentPos.x - newDraggedNodePos.x, 2) +
          Math.pow(currentPos.y - newDraggedNodePos.y, 2)
        )

        // Use the original stored offset distance as the reference
        const originalDistance = Math.sqrt(
          Math.pow(offset.x, 2) + Math.pow(offset.y, 2)
        )

        let newConnectedPos

        // Add small tolerance to prevent jittering at the boundary
        const tolerance = 5 // pixels

        if (currentDistance <= originalDistance + tolerance) {
          // Moving closer or at original distance: don't push connected node away
          // Keep the connected node where it is (no resistance when shortening)
          newConnectedPos = {
            x: currentPos.x,
            y: currentPos.y
          }
        } else {
          // Moving away: connected node follows to maintain the original distance
          // Calculate the direction vector from dragged node to connected node
          const directionX = currentPos.x - newDraggedNodePos.x
          const directionY = currentPos.y - newDraggedNodePos.y

          // Normalize the direction vector
          const directionLength = Math.sqrt(directionX * directionX + directionY * directionY)
          const normalizedDirX = directionLength > 0 ? directionX / directionLength : 0
          const normalizedDirY = directionLength > 0 ? directionY / directionLength : 0

          // Calculate target position at original distance in the current direction
          const targetPos = {
            x: newDraggedNodePos.x + normalizedDirX * originalDistance,
            y: newDraggedNodePos.y + normalizedDirY * originalDistance
          }

          // Apply follow factor for elastic behavior
          const followFactor = 0.4 // How much the connected node follows (0 = doesn't follow, 1 = follows completely)

          newConnectedPos = {
            x: currentPos.x + (targetPos.x - currentPos.x) * followFactor,
            y: currentPos.y + (targetPos.y - currentPos.y) * followFactor
          }
        }

        // Update the connected node's position
        graph.value.setNodeAttribute(connectedNodeId, 'x', newConnectedPos.x)
        graph.value.setNodeAttribute(connectedNodeId, 'y', newConnectedPos.y)

        // Update internal nodes array
        const nodeIndex = nodes.value.findIndex(n => n.id === connectedNodeId)
        if (nodeIndex !== -1) {
          nodes.value[nodeIndex].position = { x: newConnectedPos.x, y: newConnectedPos.y }
        }
      }
    })
  } catch (error) {
    console.warn('⚠️ Error moving connected nodes:', error)
  }
}

// Update graph with new data
const updateGraph = () => {
  if (!graph.value || !sigmaInstance.value) return
  
  // Clear the graph
  graph.value.clear()
  
  // Add nodes from nodes array
  nodes.value.forEach(node => {
    try {
      // Assign different masses based on node type to influence layout
      const mass = node.type === 'package' ? 0.5 : 1.0 // Packages are lighter
      const nodeSize = node.type === 'package' ? 35 : 25 // Match the nodeReducer sizes

      graph.value.addNode(node.id, {
        x: node.position?.x || Math.random(),
        y: node.position?.y || Math.random(),
        label: node.data?.label || (node.type === 'package' ? 'package' : 'record'),
        size: nodeSize,
        mass: mass,
        color: node.type === 'package' ? '#6b7280' : '#7c3aed',
        ...node.data
      })
    } catch (err) {
      console.warn('Node already exists or error adding:', node.id, err)
    }
  })
  
  // Add edges from edges array
  edges.value.forEach(edge => {
    try {
      graph.value.addEdge(edge.source, edge.target, {
        label: edge.label,
        size: edge.style?.strokeWidth || 2,
        color: edge.style?.stroke || '#d1d5db',
        direction: edge.data?.direction
        // Note: removed 'type' as Sigma.js doesn't use edge types
      })
    } catch (err) {
      console.warn('Edge already exists or error adding:', edge.id, err)
    }
  })
  
  // Update counts
  nodeCount.value = graph.value.order
  edgeCount.value = graph.value.size
  
  // Refresh the display
  sigmaInstance.value.refresh()
  
  // Apply layout after a short delay
  setTimeout(() => applyLayoutToGraph(), 100)
}

// Apply layout to the graph
const applyLayoutToGraph = () => {
  if (!graph.value || graph.value.order === 0) return
  
  try {
    const layoutName = layoutOptions[currentLayout.value]
    
    // Skip ForceAtlas2 if we have any expanded nodes to preserve their positioning
    const hasExpandedNodes = expandedNodes.value.size > 0
    
    if (layoutName === 'forceAtlas2') {
      if (graph.value.order > 0) {
        try {
          // Use different settings based on whether we have expanded nodes
          const settings = hasExpandedNodes 
            ? forceSettings.layout.expanded 
            : forceSettings.layout.fresh
          
          const iterations = hasExpandedNodes ? 20 : 50 // Fewer iterations for expanded graphs
          
          // Store locked node positions before force simulation
          const lockedPositions = new Map()
          lockedNodes.value.forEach(nodeId => {
            if (graph.value.hasNode(nodeId)) {
              lockedPositions.set(nodeId, {
                x: graph.value.getNodeAttribute(nodeId, 'x'),
                y: graph.value.getNodeAttribute(nodeId, 'y')
              })
            }
          })
          
          // Step 1: Apply ForceAtlas2 for force-directed positioning
          forceAtlas2.assign(graph.value, {
            iterations,
            settings
          })
          
          // Restore locked node positions after force simulation
          lockedPositions.forEach((position, nodeId) => {
            if (graph.value.hasNode(nodeId)) {
              graph.value.setNodeAttribute(nodeId, 'x', position.x)
              graph.value.setNodeAttribute(nodeId, 'y', position.y)
            }
          })
          
          
          // Step 2: Apply noverlap to prevent node overlaps
          noverlap.assign(graph.value, {
            maxIterations: 50, // Sufficient for most graphs
            settings: {
              margin: 40, // Space between nodes (increased from default for better spacing)
              speed: 3, // Balanced speed for convergence
              maxMove: 200 // Maximum distance a node can move per iteration
            }
          })
          
        } catch (forceError) {
          console.warn('⚠️ ForceAtlas2 failed, falling back to circular:', forceError)
          circular.assign(graph.value)
        }
      }
    } else if (layoutName === 'circular') {
      // For circular layout, we want to maintain the circular arrangement even after expansions
      const nodeCount = graph.value.order
      const radius = Math.max(150, Math.min(400, nodeCount * 12)) // Dynamic radius with bounds
      
      // Manual circular positioning to avoid NaN issues with graphology circular layout
      let nodeIndex = 0
      graph.value.forEachNode((nodeId) => {
        // Skip position updates for locked nodes
        if (!isNodeLocked(nodeId)) {
          const angle = (nodeIndex / nodeCount) * 2 * Math.PI
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          
          graph.value.setNodeAttribute(nodeId, 'x', x)
          graph.value.setNodeAttribute(nodeId, 'y', y)
          
          // Update our internal nodes array
          const internalNodeIndex = nodes.value.findIndex(n => n.id === nodeId)
          if (internalNodeIndex !== -1) {
            nodes.value[internalNodeIndex].position = { x, y }
          }
        }
        
        nodeIndex++
      })
      
      
      // Ensure camera shows the circular layout
      if (sigmaInstance.value) {
        const camera = sigmaInstance.value.getCamera()
        camera.animatedReset({ duration: 300 })
      }
    } else if (layoutName === 'random') {
      // Store locked node positions before applying random layout
      const lockedPositions = new Map()
      lockedNodes.value.forEach(nodeId => {
        if (graph.value.hasNode(nodeId)) {
          lockedPositions.set(nodeId, {
            x: graph.value.getNodeAttribute(nodeId, 'x'),
            y: graph.value.getNodeAttribute(nodeId, 'y')
          })
        }
      })
      
      random.assign(graph.value)
      
      // Restore locked node positions after random layout
      lockedPositions.forEach((position, nodeId) => {
        if (graph.value.hasNode(nodeId)) {
          graph.value.setNodeAttribute(nodeId, 'x', position.x)
          graph.value.setNodeAttribute(nodeId, 'y', position.y)
        }
      })
      
    }
    
    if (sigmaInstance.value) {
      sigmaInstance.value.refresh()
    }
  } catch (error) {
    console.error('❌ Layout application failed:', error)
    // Fallback to basic positioning
    graph.value.forEachNode((node, attributes) => {
      if (!attributes.x || !attributes.y) {
        graph.value.setNodeAttribute(node, 'x', Math.random() * 400)
        graph.value.setNodeAttribute(node, 'y', Math.random() * 400)
      }
    })
    if (sigmaInstance.value) {
      sigmaInstance.value.refresh()
    }
  }
}

// Lifecycle
onMounted(async () => {
  
  // Initialize store for this dataset
  graphStore.setCurrentDataset(props.datasetId)
  
  // Check if we have existing state to restore
  if (graphStore.hasGraphData) {
    restoreStateFromStore()
  }
  
  // Initialize Sigma.js
  await nextTick()
  initializeGraph()
  
  // Load models for this dataset
  try {
    await metadataStore.fetchModels(props.datasetId)
  } catch (error) {
    console.error('Error loading models:', error)
    ElMessage.error('Failed to load models')
  }
})

// Restore state from store
const restoreStateFromStore = () => {
  try {
    // Restore query filters
    queryFilters.value = graphStore.currentQueryFilters
    recordLimit.value = graphStore.currentRecordLimit
    
    // Restore graph data
    nodes.value = graphStore.currentNodes
    edges.value = graphStore.currentEdges
    nodeCount.value = graphStore.currentNodeCount
    edgeCount.value = graphStore.currentEdgeCount
    
    // Restore layout and expansion state
    currentLayout.value = graphStore.currentLayout
    expandedNodes.value = graphStore.currentExpandedNodes
    nodeExpansionMap.value = graphStore.currentNodeExpansionMap
    
    // Restore model data
    displayedModels.value = graphStore.currentDisplayedModels
    modelColorAssignment.value = graphStore.currentModelColorAssignment
    
    // Restore selection state
    selectedRecord.value = graphStore.currentSelectedRecord
    selectedNodeProperties.value = graphStore.currentSelectedNodeProperties
    showDetailsPanel.value = graphStore.currentShowDetailsPanel
    
    
    // Update graph if we have data
    if (nodes.value.length > 0) {
      setTimeout(() => {
        updateGraph()
      }, 100)
    }
  } catch (error) {
    console.warn('Failed to restore state from store:', error)
  }
}

// Save current state to store
const saveStateToStore = () => {
  try {
    graphStore.updateQueryFilters(queryFilters.value)
    graphStore.updateRecordLimit(recordLimit.value)
    graphStore.updateGraphData(nodes.value, edges.value, {
      nodeCount: nodeCount.value,
      edgeCount: edgeCount.value
    })
    graphStore.updateLayout(currentLayout.value)
    graphStore.updateExpandedNodes(expandedNodes.value, nodeExpansionMap.value)
    graphStore.updateModelData(displayedModels.value, modelColorAssignment.value)
    graphStore.updateSelection(selectedRecord.value, selectedNodeProperties.value, showDetailsPanel.value)
    
  } catch (error) {
    console.warn('Failed to save state to store:', error)
  }
}

onUnmounted(() => {
  // Save state before unmounting
  saveStateToStore()
  
  // Stop any running force simulation
  stopBackgroundForceSimulation()
  
  // Clean up Sigma instance
  if (sigmaInstance.value) {
    sigmaInstance.value.kill()
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/theme' as theme;
@use "@/styles/spacing";

.btn-add-filter {
  background: none;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover {
    border-color: theme.$purple_3;
    color: theme.$purple_3;
  }
}

.graph-explorer {
  height: 100%;
  min-height: calc(100vh - 85px);

   //Stage actions styling
  .stage-actions {
    padding: 0 16px;
    .stage-title {
      font-size: 20px;
      font-weight: 600;
      color: theme.$gray_6;
      margin: 0 0 4px 0;
    }

    .stage-actions-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }
  
  .query-section {
    background: theme.$white;
    border-bottom: 1px solid theme.$gray_2;
    padding: 20px;
    transition: all 0.3s ease;
    
    &.collapsed {
      padding: 0;
      height: 0;
      overflow: hidden;
      border-bottom: none;
    }
    
    .query-builder {
      
      .query-row {
        margin-bottom: 12px;
        
        &:last-of-type {
          margin-bottom: 0;
        }
      }
      
      .filter-actions {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        margin-top: 16px;
        padding-top: 8px;
      }
    }
  }
  
  // Shared styles for buttons and selectors
  .collapse-btn {
    background: none;
    border: 1px solid theme.$gray_3;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    color: theme.$gray_5;
    font-size: 14px;
    transition: all 0.2s ease;
    white-space: nowrap;
    min-width: 120px;

    &:hover {
      background: theme.$gray_1;
      border-color: theme.$gray_3;
      color: theme.$purple_3;
    }

    &:focus {
      background: theme.$white;

    }
  }
  
  .limit-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .limit-label {
      font-size: 14px;
      color: theme.$gray_5;
      font-weight: 500;
    }
    
    .limit-select {
      border: 1px solid theme.$gray_3;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 14px;
      background: white;
      cursor: pointer;
      color: theme.$gray_6;
      min-width: 80px;
      
      &:focus {
        outline: none;
        border-color: theme.$purple_3;
      }
    }
  }
  
  .graph-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: theme.$white;
    border-bottom: 1px solid theme.$gray_2;
    
    .control-group {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .view-controls {
      display: flex;
      gap: 4px;
      align-items: center;
      margin-right: 16px;
      
      .control-btn {
        background: none;
        border: 1px solid theme.$gray_3;
        border-radius: 4px;
        padding: 6px 8px;
        cursor: pointer;
        color: theme.$gray_5;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        
        &:hover {
          border-color: theme.$purple_3;
          color: theme.$purple_3;
          background: theme.$purple_tint;
        }
        
        i {
          font-size: 14px;
        }
      }
    }
    
    .layout-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .layout-label {
        font-size: 14px;
        color: theme.$gray_5;
        font-weight: 500;
      }
      
      .layout-select {
        border: 1px solid theme.$gray_3;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 14px;
        background: white;
        cursor: pointer;
        color: theme.$gray_6;
        
        &:focus {
          outline: none;
          border-color: theme.$purple_3;
        }
      }
    }
    
    .node-count {
      font-size: 14px;
      color: theme.$gray_5;
    }
    
    .legend {
      flex-wrap: wrap;
      max-width: 60%;
      
      .legend-title {
        font-size: 13px;
        font-weight: 500;
        color: theme.$gray_6;
        margin-right: 12px;
      }
      
      .legend-models {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-right: 20px;
        padding-right: 20px;
        border-right: 1px solid theme.$gray_2;
      }
      
      .legend-relationships {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: theme.$gray_5;
        
        &.model-legend {
          .legend-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid;
          }
          
          .model-name {
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
          }
        }
        
        .legend-line {
          width: 20px;
          height: 2px;
          border-radius: 1px;
          
          &.outbound {
            background-color: #22C55E;
          }
          
          &.inbound {
            background-color: #3B82F6;
          }
          
          &.package {
            background-color: #6B7280;
            background-image: repeating-linear-gradient(
              to right,
              #6B7280,
              #6B7280 3px,
              transparent 3px,
              transparent 7px
            );
          }
        }
      }
      
      .legend-more {
        font-size: 11px;
        color: theme.$gray_4;
        font-style: italic;
      }
    }
  }
  
  .graph-container {
    flex: 1;
    position: relative;
    background: theme.$purple_tint;
    display: flex;
    flex-direction: column;
    min-height: 400px; // Ensure minimum height for sigma
    
    .sigma-container {
      flex: 1;
      width: 100%;
      min-height: 400px; // Ensure sigma container has minimum height
    }
    
    .graph-legend {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: theme.$white;
      border-top: 1px solid theme.$gray_2;
      z-index: 999; // Just below properties bar
      transition: all 0.3s ease;

      .legend-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 20px;
        cursor: pointer;
        background: theme.$gray_1;
        border-bottom: 1px solid theme.$gray_2;

        &:hover {
          background: theme.$gray_2;
        }

        .legend-title {
          font-size: 13px;
          font-weight: 500;
          color: theme.$gray_6;
        }

        .legend-toggle {
          background: none;
          border: none;
          color: theme.$gray_5;
          cursor: pointer;
          padding: 2px;
          border-radius: 2px;
          transition: all 0.2s ease;
          transform: rotate(0deg);

          &.expanded {
            transform: rotate(180deg);
          }

          &:hover {
            color: theme.$gray_6;
            background: theme.$gray_3;
          }

          svg {
            display: block;
          }
        }
      }

      .legend-content {
        overflow: hidden;
        transition: all 0.3s ease;

        .legend-compact {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 8px 20px;

          .legend-models-compact {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-right: 20px;
            padding-right: 20px;
            border-right: 1px solid theme.$gray_2;
          }

          .legend-relationships-compact {
            display: flex;
            align-items: center;
            gap: 12px;
          }
        }

        .legend-expanded {
          padding: 16px 20px;

          .legend-section {
            margin-bottom: 16px;

            &:last-child {
              margin-bottom: 0;
            }

            .legend-section-title {
              font-size: 12px;
              font-weight: 600;
              color: theme.$gray_6;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .legend-models-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
              gap: 8px 16px;
            }

            .legend-relationships-grid {
              display: flex;
              align-items: center;
              gap: 20px;
              flex-wrap: wrap;
            }
          }
        }

        // Shared legend item styles
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: theme.$gray_5;

          &.model-legend {
            .legend-dot {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 2px solid;
              flex-shrink: 0;
            }

            .model-name {
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-size: 11px;
              color: theme.$gray_6;
            }
          }

          .legend-line {
            width: 20px;
            height: 2px;
            border-radius: 1px;
            flex-shrink: 0;

            &.outbound {
              background-color: #22C55E;
            }

            &.inbound {
              background-color: #3B82F6;
            }

            &.package {
              background-color: #6B7280;
              background-image: repeating-linear-gradient(
                to right,
                #6B7280,
                #6B7280 3px,
                transparent 3px,
                transparent 7px
              );
            }
          }
        }

        .legend-more {
          font-size: 11px;
          color: theme.$gray_4;
          font-style: italic;
        }
      }

      // Compact mode (default)
      &:not(.expanded) .legend-content {
        max-height: 40px;
      }

      // Expanded mode
      &.expanded .legend-content {
        max-height: 300px; // Generous height for expanded content
      }
    }

    .properties-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: theme.$white;
      border-top: 1px solid theme.$gray_2;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      min-height: 40px;
      
      .properties-content {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 16px;
        min-width: 0; // Allow flex shrinking
        
        .node-title {
          font-weight: 600;
          color: theme.$gray_6;
          font-size: 14px;
          flex-shrink: 0;
        }
        
        .properties-inline {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          overflow: hidden;
          
          .property-item {
            font-size: 13px;
            color: theme.$gray_5;
            white-space: nowrap;
            
            strong {
              color: theme.$gray_6;
              font-weight: 500;
            }
          }
        }
      }
      
      .properties-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
        
        .unlock-btn {
          background: theme.$orange_2;
          color: theme.$white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-right: 8px;
          
          &:hover {
            background: theme.$orange_1;
          }
        }
        
        .view-details-btn {
          background: theme.$purple_2;
          color: theme.$white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          
          &:hover {
            background: theme.$purple_3;
          }
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 16px;
          color: theme.$gray_5;
          cursor: pointer;
          padding: 4px;
          border-radius: 3px;
          transition: all 0.2s ease;
          
          &:hover {
            background: theme.$gray_2;
            color: theme.$gray_6;
          }
        }
      }
    }
  }
  
  .details-container {
    height: calc(100vh - 120px); // Full height minus header space
    overflow: hidden;
    
    // Ensure RecordSpecViewer fills the entire drawer
    :deep(.record-spec-viewer) {
      height: 100%;
      
      .bf-stage {
        height: 100%;
        
        .bf-stage-content {
          height: 100%;
          padding: 0;
        }
      }
    }
    
    // Ensure FileDetails fills the entire drawer
    :deep(.file-details) {
      height: 100%;
      
      .bf-stage {
        height: 100%;
        
        .bf-stage-content {
          height: 100%;
          padding: 0;
        }
      }
    }
  }
}

:deep(.vue-flow) {
  background: theme.$gray_1;
  
  .vue-flow__node {
    cursor: pointer;
    
    &:hover {
      z-index: 10;
    }
  }
  
  .vue-flow__edge {
    cursor: pointer;
    
    &:hover {
      stroke-width: 3;
    }
  }
}
</style>