<template>
  <div class="graph-explorer">
    <!-- Query Builder Section -->
    <div class="query-section">
      <div class="query-builder">
        <h3>Select Model Records</h3>
        
        <!-- Multiple Query Rows -->
        <div v-for="(query, index) in queryFilters" :key="query.id" class="query-row">
          <MultiModelFilter
            :models="models"
            :filter="query"
            :index="index"
            :can-remove="queryFilters.length > 1"
            @update-filter="updateFilter"
            @remove-filter="removeFilter"
            @model-change="onModelChange"
          />
        </div>
        
        <!-- Action Buttons -->
        <div class="query-actions">


          <!-- Search Button -->
          <bf-button
            class="primary"
            :disabled="!canExecuteQuery"
            @click="executeQuery"
          >
            <template v-if="loading">
              <i class="el-icon-loading"></i> Searching...
            </template>
            <template v-else>
              <i class="el-icon-search"></i> Search
            </template>
          </bf-button>

          <!-- Add Filter Button -->
          <bf-button
            class="secondary"
            @click="addFilter"
          >
            <i class="el-icon-plus"></i> Add Row
          </bf-button>

          <!-- Clear All Button -->
          <bf-button
            class="secondary"
            @click="clearAllQueries"
          >
            Clear All
          </bf-button>
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
      
      <!-- Legend -->
      <div class="control-group legend">
        <span class="legend-title">Legend:</span>
        
        <!-- Model Colors (if any models are displayed) -->
        <div v-if="displayedModels.length > 0" class="legend-models">
          <div
            v-for="modelId in displayedModels.slice(0, 5)"
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
          <span v-if="displayedModels.length > 5" class="legend-more">
            +{{ displayedModels.length - 5 }} more
          </span>
        </div>
        
        <!-- Relationship Legend -->
        <div class="legend-relationships">
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
      
      <div class="control-group">
        <span class="node-count">{{ nodeCount }} nodes, {{ edgeCount }} relationships</span>
      </div>
    </div>

    <!-- Graph Visualization -->
    <div class="graph-container">
      <div ref="sigmaContainer" class="sigma-container"></div>
      
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
          <button class="view-details-btn" @click="viewSelectedNodeDetails">
            View Details
          </button>
          <button class="close-btn" @click="selectedNodeProperties = null">×</button>
        </div>
      </div>
    </div>

    <!-- Record Details Panel -->
    <el-drawer
      v-model="showDetailsPanel"
      :title="selectedRecord?.label || 'Record Details'"
      direction="rtl"
      size="60%"
    >
      <div v-if="selectedRecord" class="record-details-container">
        <RecordSpecViewer
          :datasetId="props.datasetId"
          :modelId="selectedRecord.model"
          :recordId="selectedRecord.id"
        />
      </div>
    </el-drawer>
  </div>
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
import { ElSelect, ElOption, ElInput, ElDrawer, ElMessage } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import { useMetadataStore } from '@/stores/metadataStore.js'
import { useGraphExplorerStore } from '@/stores/graphExplorerStore.js'
import { getModelColor, createModelColorAssignment, packageColor } from '@/utils/modelColors.js'
import MultiModelFilter from './MultiModelFilter.vue'
import IconSizeToFit from '@/components/icons/IconSizeToFit.vue'
import IconCenter from '@/components/icons/IconCenter.vue'
import RecordSpecViewer from '@/components/datasets/metadata/models/RecordSpecViewer.vue'

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
const models = computed(() => {
  // Models in store have structure: [{ model: { id, name, display_name, ... } }]
  return (metadataStore.models || [])
    .map(item => item.model)
    .filter(model => model && model.id && model.name) // Filter out invalid models
})
const showDetailsPanel = ref(false)
const selectedRecord = ref(null)
const selectedNodeProperties = ref(null)
const expandedNodes = ref(new Set())
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

const executeQuery = async () => {
  if (!canExecuteQuery.value) return
  
  loading.value = true
  try {
    console.log('🔍 Executing queries with filters:', queryFilters.value)
    
    // Prepare all query promises
    const queryPromises = queryFilters.value
      .filter(filter => filter.model) // Only process filters with a model selected
      .map(async (filter) => {
        // Build filter predicate only if property, operator and value are provided
        let options = { limit: 50 }
        
        if (filter.property && filter.operator && filter.value) {
          // Use the metadata store's fetchRecords method with proper filter structure
          const filterPredicate = {
            property: `/${filter.property}`, // JSON Pointer format
            operator: filter.operator,
            value: parseValue(filter.value, filter.operator, filter.property, filter.modelProperties)
          }
          options.filter = filterPredicate
          console.log('🔍 Query with filter:', filter.model, filterPredicate)
        } else {
          console.log('🔍 Query without filter (first 50 records):', filter.model)
        }
        
        try {
          const response = await metadataStore.fetchRecords(props.datasetId, filter.model, options)
          return {
            modelId: filter.model,
            records: response.records || [],
            filter: filter
          }
        } catch (error) {
          console.error(`Query error for model ${filter.model}:`, error)
          return {
            modelId: filter.model,
            records: [],
            filter: filter,
            error: error
          }
        }
      })
    
    // Execute all queries in parallel
    const results = await Promise.all(queryPromises)
    
    // Combine and display results
    const allRecords = []
    let errorCount = 0
    
    results.forEach(result => {
      if (result.error) {
        errorCount++
      } else {
        allRecords.push(...result.records)
      }
    })
    
    console.log(`📊 Query complete: ${allRecords.length} total records from ${results.length} queries`)
    
    if (errorCount > 0) {
      ElMessage.warning(`${errorCount} queries failed, showing results from successful queries`)
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
const parseValue = (value, operator, propertyName, modelProperties) => {
  if (!value) return value
  
  // Get property type for better value parsing
  const property = modelProperties?.find(p => p.name === propertyName)
  const propertyType = property?.type || 'string'
  
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
    return value === 'true' || value === true
  }
  
  return value
}

const displayQueryResults = (records) => {
  console.log('📊 Displaying query results:', records)
  
  // Clear existing data
  nodes.value = []
  edges.value = []
  expandedNodes.value.clear()
  nodeExpansionMap.value.clear()
  
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
  console.log('🎨 Created color assignment for', uniqueModelIds.length, 'unique models')
  
  // Create nodes for each record in a grid layout
  const gridSize = Math.ceil(Math.sqrt(records.length))
  const spacing = 150 // Space between grid positions
  
  records.forEach((record, index) => {
    console.log(`📊 Creating node for record ${index}:`, record)
    
    const nodeId = `record-${record.id}`
    const row = Math.floor(index / gridSize)
    const col = index % gridSize
    
    // The actual properties are in the 'value' field from the API response
    const properties = record.value || record.properties || record.values || {}
    
    console.log(`📊 Extracted properties from record.value:`, properties, 'Keys:', Object.keys(properties))
    
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
    
    console.log(`📊 Created node:`, node)
    console.log(`📊 Node data properties:`, node.data.properties)
    nodes.value.push(node)
  })
  
  console.log(`📊 Total nodes created: ${nodes.value.length}`)
  
  // Update the graph
  updateGraph()
  
  // Save state after successful query
  saveStateToStore()
  
  ElMessage.success(`Found ${records.length} records`)
}

// These are now handled by Sigma event listeners in initializeGraph()

const expandNode = async (nodeId) => {
  try {
    console.log('🔄 Expanding node:', nodeId)
    
    if (expandedNodes.value.has(nodeId)) {
      console.log('🔄 Node already expanded, collapsing instead')
      collapseNode(nodeId)
      return
    }
    
    const node = nodes.value.find(n => n.id === nodeId)
    if (!node) {
      console.error('❌ Node not found for expansion:', nodeId)
      ElMessage.error('Node not found')
      return
    }
    
    console.log('🔄 Found node for expansion:', node)
    
    loading.value = true
    
    // Fetch relationships for this record
    console.log('🔗 Fetching relationships for record:', node.data.id)
    const relationships = await fetchRecordRelationships(node.data.id)
    console.log('🔗 Fetched relationships:', relationships)
    
    // Fetch packages for this record
    console.log('📦 Fetching packages for record:', node.data.id)
    const packages = await fetchRecordPackages(node.data.id)
    console.log('📦 Fetched packages:', packages)
    
    // Add new nodes and edges
    console.log('➕ Adding related nodes and edges')
    const { limitedRelationships, limitedPackages, addedChildren, addedEdges } = addRelatedNodes(node, relationships, packages)
    
    // Track expansion for proper collapse behavior
    nodeExpansionMap.value.set(nodeId, {
      children: addedChildren,
      edges: addedEdges
    })
    
    // Mark as expanded
    expandedNodes.value.add(nodeId)
    node.data.expanded = true
    
    console.log('✅ Node expansion complete, updating graph')
    
    // Update the graph display
    updateGraph()
    
    // Save state after node expansion
    saveStateToStore()
    
    // Start animated force simulation after node expansion
    await startBackgroundForceSimulation()
    
    ElMessage.success(`Expanded node: added ${limitedRelationships.length} relationships and ${limitedPackages.length} files`)
    
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
    console.log('🔗 Raw relationships response:', relationships)
    
    // Handle different response structures
    if (Array.isArray(relationships)) {
      return relationships
    } else if (relationships && Array.isArray(relationships.relationships)) {
      return relationships.relationships
    } else if (relationships && Array.isArray(relationships.data)) {
      return relationships.data
    } else if (relationships && (relationships.inbound || relationships.outbound)) {
      // Handle {inbound: [...], outbound: [...]} structure with direction tracking
      // Either inbound or outbound can be null/undefined
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
      console.log('🔗 Combined inbound + outbound relationships:', allRelationships)
      // Debug the structure of individual relationships
      if (allRelationships.length > 0) {
        console.log('🔗 Sample relationship object:', allRelationships[0])
        console.log('🔗 Relationship keys:', Object.keys(allRelationships[0]))
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
    // Use the metadata store method
    const packages = await metadataStore.fetchRecordPackages(props.datasetId, recordId)
    console.log('📦 Raw packages response:', packages)
    
    // Handle different response structures
    if (Array.isArray(packages)) {
      return packages
    } else if (packages && Array.isArray(packages.packages)) {
      return packages.packages
    } else if (packages && Array.isArray(packages.data)) {
      return packages.data
    } else {
      console.warn('Unexpected packages structure:', packages)
      return []
    }
  } catch (error) {
    console.error('Error fetching packages:', error)
    return []
  }
}

const addRelatedNodes = (parentNode, relationships, packages) => {
  try {
    const parentId = parentNode.id
    console.log(`➕ Adding related nodes for parent: ${parentId}`)
    console.log(`➕ Processing ${relationships.length} relationships and ${packages.length} packages`)
    
    // Get current position of parent node from Sigma graph
    const currentParentAttrs = graph.value.getNodeAttributes(parentId)
    const currentParentPosition = {
      x: currentParentAttrs.x || parentNode.position.x,
      y: currentParentAttrs.y || parentNode.position.y
    }
    console.log(`📍 Parent current position:`, currentParentPosition)
    
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
      
      console.log(`⚠️ Node expansion capped at ${maxAdditionalNodes} nodes. Using ${limitedRelationships.length} relationships and ${limitedPackages.length} packages`)
    }
    
    // Add relationship nodes with direction-aware edges
    limitedRelationships.forEach((rel, index) => {
      try {
        console.log(`🔗 Processing relationship ${index + 1}:`, rel)
        
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
          console.log(`✅ Added new relationship node: ${targetId}`)
          
          // Track new model for color assignment and legend
          if (relatedRecord.model_id && !modelColorAssignment.value.has(relatedRecord.model_id)) {
            newModelIds.add(relatedRecord.model_id)
          }
          
          // Only track nodes that were actually created during this expansion
          addedChildren.add(targetId)
        } else {
          nodeExists = true
          console.log(`ℹ️ Relationship node already exists: ${targetId}, creating edge to existing node`)
        }
        
        // Create edge with direction-based coloring (always create edge, even to existing nodes)
        const edgeId = `${parentId}-${targetId}-${rel.direction || 'unknown'}`
        if (!edges.value.find(e => e.id === edgeId)) {
          // Color coding: 
          // - Green for outbound (this record points to another)
          // - Blue for inbound (another record points to this)
          const isOutbound = rel.direction === 'outbound'
          const edgeColor = isOutbound ? '#22C55E' : '#3B82F6' // green : blue
          const edgeLabel = `${rel.relationship_type || 'related'} ${isOutbound ? '→' : '←'}`
          
          edges.value.push({
            id: edgeId,
            source: isOutbound ? parentId : targetId,  // Correct direction
            target: isOutbound ? targetId : parentId,  // Correct direction
            label: edgeLabel,
            type: 'default',
            style: { 
              stroke: edgeColor,
              strokeWidth: 2
            },
            data: {
              direction: rel.direction,
              relationshipType: rel.relationship_type
            }
          })
          
          // Track edge for collapse functionality
          addedEdges.add(edgeId)
          
          console.log(`✅ Added relationship edge: ${edgeId} ${nodeExists ? '(to existing node)' : '(to new node)'}`)
        } else {
          console.log(`ℹ️ Relationship edge already exists: ${edgeId}`)
        }
      } catch (relError) {
        console.error('❌ Error processing relationship:', relError, rel)
      }
    })
    
    // Update color assignments for new models
    if (newModelIds.size > 0) {
      console.log(`🎨 Found ${newModelIds.size} new models during expansion:`, [...newModelIds])
      
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
      
      console.log(`🎨 Updated color assignments for ${allModelIds.length} total models`)
    }
    
    // Add package nodes
    limitedPackages.forEach((pkg, index) => {
      try {
        console.log(`📦 Processing package ${index + 1}:`, pkg)
        
        // Validate package has ID
        if (!pkg.id) {
          console.warn('⚠️ Skipping package with no ID:', pkg)
          return
        }
        
        const packageId = `package-${pkg.id}`
        
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
              id: pkg.id,
              label: pkg.name || pkg.id,
              type: pkg.type,
              size: pkg.size,
              expanded: false
            }
          }
          nodes.value.push(newNode)
          console.log(`✅ Added new package node: ${packageId}`)
          
          // Only track nodes that were actually created during this expansion
          addedChildren.add(packageId)
        } else {
          console.log(`ℹ️ Package node already exists: ${packageId}`)
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
          
          console.log(`✅ Added package edge: ${edgeId}`)
        } else {
          console.log(`ℹ️ Package edge already exists: ${edgeId}`)
        }
      } catch (pkgError) {
        console.error('❌ Error processing package:', pkgError, pkg)
      }
    })
    
    console.log(`✅ Finished adding related nodes. Total nodes: ${nodes.value.length}, Total edges: ${edges.value.length}`)
    
    return { limitedRelationships, limitedPackages, addedChildren, addedEdges }
    
  } catch (error) {
    console.error('❌ Error in addRelatedNodes:', error)
    throw error
  }
}

const collapseNode = (nodeId) => {
  try {
    console.log('🔄 Collapsing node:', nodeId)
    
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
    console.log(`🔄 Collapsing ${children.size} children and ${trackedEdges.size} edges`)
    
    // Remove only the tracked child nodes
    const childrenArray = Array.from(children)
    const removedNodeIds = new Set(childrenArray)
    nodes.value = nodes.value.filter(n => !removedNodeIds.has(n.id))
    console.log(`✅ Removed ${childrenArray.length} child nodes`)
    
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
        console.log(`🗑️ Removing edge: ${edgeId} (tracked: ${isTrackedEdge}, connects to removed: ${connectsToRemovedNode})`)
      }
      
      return !shouldRemove
    })
    
    // Clean up expansion tracking
    nodeExpansionMap.value.delete(nodeId)
    
    // Mark as collapsed
    expandedNodes.value.delete(nodeId)
    node.data.expanded = false
    
    console.log('✅ Node collapsed successfully, updating graph')
    
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
  console.log('Edge clicked:', event)
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
      selectedRecord.value = matchingNode.data
      showDetailsPanel.value = true
      // Close the properties bar
      selectedNodeProperties.value = null
    }
  }
}

const viewPackageDetails = (packageId) => {
  // Navigate to package/file details view
  console.log('View package details:', packageId)
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
        
        console.log(`🏷️ Model ${modelId} key property:`, keyProperty)
        
        if (keyProperty) {
          // Check for the key property value in record data
          const recordData = record.value || record.properties || record.values || {}
          
          if (recordData[keyProperty] !== undefined && recordData[keyProperty] !== null) {
            const keyValue = String(recordData[keyProperty])
            console.log(`🏷️ Using key property "${keyProperty}" = "${keyValue}" for record ${record.id}`)
            label = keyValue
          }
        }
      }
      
      // Final fallback to record ID or generic label
      if (!label) {
        label = record.id || 'Record'
      }
    }
    
    // Truncate label if it's too long
    if (label && label.length > maxLength) {
      return label.substring(0, maxLength - 3) + '...'
    }
    
    return label || 'Record'
  } catch (error) {
    console.warn('Error getting record label:', error)
    const fallback = record.display_name || record.name || record.id || 'Record'
    return fallback.length > maxLength ? fallback.substring(0, maxLength - 3) + '...' : fallback
  }
}

// State for drag functionality
const draggedNode = ref(null)
const isDragging = ref(false)

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
    minCameraRatio: 0.1,
    maxCameraRatio: 10,
    enableEdgeClickEvents: true,
    enableEdgeWheelEvents: true,
    enableEdgeHoverEvents: true,
    // Zoom sensitivity settings for smoother scroll
    zoomingRatio: 1.3, // Reduced from default ~1.5 for smaller zoom steps
    mouseZoomDuration: 200, // Smooth zoom animation duration in ms
    nodeReducer: (node, data) => {
      const res = { ...data }
      
      // Color nodes based on type and model
      if (node.startsWith('package-')) {
        res.color = packageColor.border
        res.borderColor = packageColor.border
        res.backgroundColor = packageColor.background
        // Limit package label length too
        const originalLabel = data.label || 'Package'
        res.label = originalLabel.length > 20 ? originalLabel.substring(0, 17) + '...' : originalLabel
        res.size = 25 // Larger for packages
      } else {
        // Color by model using consistent assignment or fallback to hash
        const modelColor = modelColorAssignment.value.has(data.model) 
          ? modelColorAssignment.value.get(data.model)
          : getModelColor(data.model)
        res.color = modelColor.border
        res.borderColor = modelColor.border  
        res.backgroundColor = modelColor.background
        // Limit record label length
        const originalLabel = data.label || 'Record'
        res.label = originalLabel.length > 20 ? originalLabel.substring(0, 17) + '...' : originalLabel
        res.size = 15 // Smaller for records
      }
      
      res.borderSize = 3
      return res
    },
    edgeReducer: (edge, data) => {
      const res = { ...data }
      
      // Color edges based on direction
      if (data.direction === 'outbound') {
        res.color = '#22c55e' // green
      } else if (data.direction === 'inbound') {
        res.color = '#3b82f6' // blue
      } else if (data.type === 'package') {
        res.color = '#6b7280' // gray
      } else {
        res.color = '#d1d5db' // default gray
      }
      
      res.size = data.size || 2
      return res
    }
  })
  
  // Add click handlers
  sigmaInstance.value.on('clickNode', (event) => {
    if (!isDragging.value) {
      // Check for modifier key (Ctrl on Windows/Linux, Cmd on Mac)
      // The modifier keys are in event.event.original (PointerEvent)
      const originalEvent = event.event?.original
      const hasModifier = originalEvent?.ctrlKey || originalEvent?.metaKey
      
      if (hasModifier) {
        // Modifier + click = open sidebar
        const nodeId = event.node
        const nodeData = graph.value.getNodeAttributes(nodeId)
        selectedRecord.value = nodeData
        showDetailsPanel.value = true
      } else {
        // Regular click = show banner with node properties
        const nodeId = event.node
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
          label: nodeData.label || 'Node Properties',
          properties: properties
        }
        
        console.log('🔍 Set selectedNodeProperties:', selectedNodeProperties.value)
      }
    }
  })
  
  sigmaInstance.value.on('doubleClickNode', (event) => {
    // Prevent default camera zoom behavior
    event.preventSigmaDefault()
    event.event.original.preventDefault()
    event.event.original.stopPropagation()
    
    expandNode(event.node)
  })
  
  // Add drag functionality  
  setupDragBehavior()
  
  // Add canvas drag detection
  setupCanvasDragBehavior()
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
    draggedNodeId = event.node
    isDraggingNode = true
    hasDraggedDistance = false
    startPosition = { x: event.event?.clientX || 0, y: event.event?.clientY || 0 }
    
    console.log('🖱️ Started dragging node:', draggedNodeId)
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
          // No force simulation during node drag - just move the node
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

      // Refresh display
      sigmaInstance.value.refresh()
    }
  })
  
  // Mouse up - end drag and re-evaluate forces
  const endDrag = () => {
    if (draggedNodeId && isDraggingNode) {
      console.log('🖱️ Ended dragging node:', draggedNodeId, 'hasDraggedDistance:', hasDraggedDistance)
      
      // Re-enable camera
      sigmaInstance.value.getCamera().enable()
      
      // No force simulation cleanup needed for node drag
      
      // Only run force adjustment if we actually dragged
      if (hasDraggedDistance) {
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
      console.log('🖱️ Mouse left container, ending drag')
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
      console.log('🖱️ Started potential canvas drag')
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
        console.log('🎯 Canvas drag detected, starting continuous aggressive force simulation')
        isCanvasDragging = false // Prevent multiple triggers
        startCanvasForceSimulation()
      }
    }
  })
  
  // Mouse up - stop canvas force simulation
  sigmaInstance.value.getMouseCaptor().on('mouseup', () => {
    if (canvasForceRunning.value) {
      console.log('🖱️ Canvas drag ended, stopping force simulation')
      stopCanvasForceSimulation()
    }
    isCanvasDragging = false
    dragStartPosition = null
  })
  
  // Mouse leave - also stop canvas force simulation
  sigmaInstance.value.getMouseCaptor().on('mouseleave', () => {
    if (canvasForceRunning.value) {
      console.log('🖱️ Mouse left canvas, stopping force simulation')
      stopCanvasForceSimulation()
    }
    isCanvasDragging = false
    dragStartPosition = null
  })
}

// Shared canvas force simulation settings for consistency
const canvasForceSettings = {
  gravity: 0.02, // Reduced gravity for smoother movement
  scalingRatio: 120, // Increased repulsion for less aggressive movement
  strongGravityMode: false,
  barnesHutOptimize: true, // Enable optimization for smoother performance
  barnesHutTheta: 1.2, // Slightly less accurate but smoother
  linLogMode: false,
  outboundAttractionDistribution: false,
  adjustSizes: true,
  edgeWeightInfluence: 0.3 // Reduced edge influence for gentler movement
}

// Start continuous aggressive force simulation when canvas is dragged
const startCanvasForceSimulation = () => {
  if (!graph.value || graph.value.order === 0 || canvasForceRunning.value) return
  
  // Don't run force simulation for non-Force layouts (Circle, Random)
  if (currentLayout.value !== 'Force') {
    console.log('🚫 Skipping force simulation - current layout is not Force:', currentLayout.value)
    return
  }
  
  console.log('🎬 Starting continuous aggressive canvas force simulation')
  canvasForceRunning.value = true
  
  let frameCount = 0
  
  // Animation loop for continuous aggressive canvas force simulation
  const canvasAnimationLoop = () => {
    if (!canvasForceRunning.value || !graph.value) return
    
    frameCount++
    
    try {
      // Run calculations with reduced frequency for smoother movement
      if (frameCount % 2 === 0) { // Every other frame for smoother animation
        forceAtlas2.assign(graph.value, {
          iterations: 2, // Reduced iterations for smoother movement
          settings: canvasForceSettings
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
    console.log('⏹️ Stopping continuous canvas force simulation')
    canvasForceRunning.value = false
  }
}

// Apply light force adjustment after dragging
const applyDragAdjustment = () => {
  if (!graph.value || graph.value.order === 0) return
  
  try {
    console.log('🔄 Applying drag adjustment with light ForceAtlas2')
    
    // Very light simulation to adjust connected nodes
    const positions = forceAtlas2(graph.value, {
      iterations: 10, // Very few iterations
      settings: {
        gravity: 0.001, // Very low gravity
        scalingRatio: 300, // High repulsion to push nodes apart
        strongGravityMode: false,
        barnesHutOptimize: true,
        barnesHutTheta: 2.0, // Fast approximation
        linLogMode: false,
        outboundAttractionDistribution: false,
        adjustSizes: true,
        edgeWeightInfluence: 0.3 // Let edges pull connected nodes a bit
      }
    })
    
    // Apply positions safely
    Object.entries(positions).forEach(([nodeId, position]) => {
      if (graph.value.hasNode(nodeId) && position && typeof position.x === 'number' && typeof position.y === 'number') {
        graph.value.setNodeAttribute(nodeId, 'x', position.x)
        graph.value.setNodeAttribute(nodeId, 'y', position.y)
        
        // Update our internal nodes array
        const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
        if (nodeIndex !== -1) {
          nodes.value[nodeIndex].position = { x: position.x, y: position.y }
        }
      }
    })
    
    sigmaInstance.value.refresh()
    console.log('✅ Drag adjustment completed')
  } catch (error) {
    console.warn('⚠️ Drag adjustment failed:', error)
  }
}

// Start animated background force simulation after node expansion
const startBackgroundForceSimulation = async () => {
  if (!graph.value || graph.value.order === 0 || forceLayoutRunning.value) return
  
  console.log('🎬 Starting background force simulation for 1+ seconds')
  forceLayoutRunning.value = true
  
  try {
    // Use more responsive settings for expanded graphs  
    const settings = {
      gravity: 0.012, // Increased gravity for more visible movement
      scalingRatio: 180, // Balanced repulsion for fluid movement
      strongGravityMode: false,
      barnesHutOptimize: true, // Critical for performance
      barnesHutTheta: 1, // Good approximation speed vs quality
      linLogMode: false,
      outboundAttractionDistribution: false,
      adjustSizes: true,
      edgeWeightInfluence: 0.12 // Increased edge influence for better connections
    }
    
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
        console.log(`⏹️ Force simulation stopped after ${elapsed}ms (max duration reached)`)
        forceLayoutRunning.value = false
        return
      }
      
      try {
        // Only run layout calculations every few frames for smoother animation
        if (frameCount % 3 === 0) { // Run calculations every 3rd frame (~20fps instead of 60fps)
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
          
          // Run noverlap less frequently and with gentler settings
          if (iterationCount % 12 === 0) { // Only every 12 iterations instead of 6
            noverlap.assign(graph.value, {
              maxIterations: 3, // Very few iterations for smooth animation
              settings: {
                margin: 35, // Slightly smaller margin for smoother convergence
                speed: 1.5, // Slower speed for smoother animation  
                maxMove: 50 // Much smaller moves for smoother animation
              }
            })
          }
          
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
            console.log(`✅ Force simulation completed after ${elapsed}ms with ${iterationCount} iterations`)
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
    console.log('⏹️ Stopping background force simulation')
    forceLayoutRunning.value = false
  }
}

// Start continuous force animation during drag
const startDragForceAnimation = () => {
  if (!graph.value || graph.value.order === 0 || dragForceRunning.value) return
  
  console.log('🎯 Starting continuous drag force animation')
  dragForceRunning.value = true
  
  // Very aggressive settings for immediate visible dragging response
  const dragSettings = {
    gravity: 0.05, // Much higher gravity for immediate visible movement
    scalingRatio: 80, // Much lower repulsion for very fluid movement
    strongGravityMode: false,
    barnesHutOptimize: false, // Disable optimization for immediate response
    barnesHutTheta: 1.0, // More accurate calculations
    linLogMode: false,
    outboundAttractionDistribution: false,
    adjustSizes: true,
    edgeWeightInfluence: 0.4 // Very high edge influence for dramatic connected movement
  }
  
  let frameCount = 0
  
  // Animation loop for continuous force simulation during drag
  const dragAnimationLoop = () => {
    if (!dragForceRunning.value || !isDragging.value || !graph.value) return
    
    frameCount++
    
    try {
      // Run calculations EVERY frame for immediate response
      // Run multiple iterations for more dramatic movement
      forceAtlas2.assign(graph.value, {
        iterations: 3, // Multiple iterations for more dramatic movement
        settings: dragSettings
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
    console.log('⏹️ Stopping continuous drag force animation')
    dragForceRunning.value = false
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
      
      console.log('📊 Adding node to graph:', node.id, 'with data:', node.data)
      console.log('📊 Node properties:', node.data?.properties)
      
      graph.value.addNode(node.id, {
        x: node.position?.x || Math.random(),
        y: node.position?.y || Math.random(),
        label: node.data?.label || node.id,
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
    console.log('🎯 Applying layout:', layoutName, 'to', graph.value.order, 'nodes')
    
    // Skip ForceAtlas2 if we have any expanded nodes to preserve their positioning
    const hasExpandedNodes = expandedNodes.value.size > 0
    
    if (layoutName === 'forceAtlas2') {
      if (graph.value.order > 0) {
        try {
          // Use different settings based on whether we have expanded nodes
          const settings = hasExpandedNodes ? {
            // Lighter simulation for expanded graphs - allows movement but prevents major restructuring
            gravity: 0.003, // Reduced gravity
            scalingRatio: 1600, // Increased repulsion to prevent overlap
            strongGravityMode: false,
            barnesHutOptimize: true,
            barnesHutTheta: 1.5,
            linLogMode: false,
            outboundAttractionDistribution: false,
            adjustSizes: true,
            edgeWeightInfluence: 0.5 // Reduced edge influence
          } : {
            // Full simulation for initial layouts with strong repulsion
            gravity: 0.006, // Reduced gravity to allow spreading
            scalingRatio: 250, // Much higher repulsion for better spacing
            strongGravityMode: false,
            barnesHutOptimize: true,
            barnesHutTheta: 1.2,
            linLogMode: false,
            outboundAttractionDistribution: false,
            adjustSizes: true,
            edgeWeightInfluence: 0.08 // Moderate edge influence
          }
          
          const iterations = hasExpandedNodes ? 20 : 50 // Fewer iterations for expanded graphs
          
          // Step 1: Apply ForceAtlas2 for force-directed positioning
          forceAtlas2.assign(graph.value, {
            iterations,
            settings
          })
          
          console.log(`✅ ForceAtlas2 layout applied successfully (${hasExpandedNodes ? 'gentle' : 'full'} mode)`)
          
          // Step 2: Apply noverlap to prevent node overlaps
          noverlap.assign(graph.value, {
            maxIterations: 50, // Sufficient for most graphs
            settings: {
              margin: 40, // Space between nodes (increased from default for better spacing)
              speed: 3, // Balanced speed for convergence
              maxMove: 200 // Maximum distance a node can move per iteration
            }
          })
          
          console.log(`✅ Noverlap anti-collision applied successfully`)
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
        
        nodeIndex++
      })
      
      console.log('✅ Circular layout applied with', nodeCount, 'nodes, radius:', radius)
      
      // Ensure camera shows the circular layout
      if (sigmaInstance.value) {
        const camera = sigmaInstance.value.getCamera()
        console.log('📷 Resetting camera to show circular layout')
        camera.animatedReset({ duration: 300 })
      }
    } else if (layoutName === 'random') {
      random.assign(graph.value)
      console.log('✅ Random layout applied')
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
  // Debug props
  console.log('🔧 GraphExplorer props:', props)
  console.log('🔧 DatasetId:', props.datasetId)
  console.log('🔧 OrgId:', props.orgId)
  console.log('🔧 Route params:', route.params)
  
  // Initialize store for this dataset
  graphStore.setCurrentDataset(props.datasetId)
  
  // Check if we have existing state to restore
  if (graphStore.hasGraphData) {
    console.log('🔄 Restoring state from store')
    restoreStateFromStore()
  }
  
  // Initialize Sigma.js
  await nextTick()
  initializeGraph()
  
  // Load models for this dataset
  try {
    await metadataStore.fetchModels(props.datasetId)
    console.log('Models loaded:', models.value)
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
    
    console.log('✅ State restored from store', {
      nodes: nodes.value.length,
      edges: edges.value.length,
      queryFilters: queryFilters.value.length,
      expandedNodes: expandedNodes.value.size
    })
    
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
    graphStore.updateGraphData(nodes.value, edges.value, {
      nodeCount: nodeCount.value,
      edgeCount: edgeCount.value
    })
    graphStore.updateLayout(currentLayout.value)
    graphStore.updateExpandedNodes(expandedNodes.value, nodeExpansionMap.value)
    graphStore.updateModelData(displayedModels.value, modelColorAssignment.value)
    graphStore.updateSelection(selectedRecord.value, selectedNodeProperties.value, showDetailsPanel.value)
    
    console.log('💾 State saved to store')
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

.graph-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: calc(100vh - 85px);
  background: theme.$gray_1;
  
  .query-section {
    background: theme.$white;
    border-bottom: 1px solid theme.$gray_2;
    padding: 20px;
    
    .query-builder {
      h3 {
        font-size: 18px;
        font-weight: 600;
        color: theme.$gray_6;
        margin: 0 0 16px 0;
      }
      
      .query-row {
        margin-bottom: 12px;
        
        &:last-of-type {
          margin-bottom: 0;
        }
      }
      
      .query-actions {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-top: 16px;
        padding-top: 0px;
        //border-top: 2px solid theme.$gray_2;
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
    background: theme.$gray_1;
    display: flex;
    flex-direction: column;
    min-height: 400px; // Ensure minimum height for sigma
    
    .sigma-container {
      flex: 1;
      width: 100%;
      min-height: 400px; // Ensure sigma container has minimum height
    }
    
    .properties-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: theme.$purple_tint;
      border-top: 1px solid theme.$purple_0_7;
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
  
  .record-details-container {
    // Remove default drawer padding and let RecordSpecViewer handle its own layout
    margin: -24px;
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