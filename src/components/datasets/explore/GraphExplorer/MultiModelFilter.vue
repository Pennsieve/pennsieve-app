<script setup>
import { ref, computed, watch } from 'vue'
import { ElPopover } from 'element-plus'
import IconFilterFilled from '@/components/icons/IconFilterFilled.vue'
import IconTrash from '@/components/icons/IconTrash.vue'
import IconRemove from '@/components/icons/IconRemove.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import { useMetadataStore } from '@/stores/metadataStore'
import { createThrottle } from '@/utils/throttle'

const props = defineProps({
  models: {
    type: Array,
    required: true
  },
  filter: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  },
  canRemove: {
    type: Boolean,
    default: false
  },
  datasetId: {
    type: String,
    required: true
  },
  enableAutocomplete: {
    type: Boolean,
    default: true
  },
  hideEmptyModelSelector: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update-filter', 'remove-filter', 'model-change'])

// Store
const metadataStore = useMetadataStore()

// Multiple filters state - Initialize with primary filter structure
const filters = ref([])
const logicalOperator = ref('and')

// Popover states
const activePopover = ref(null)
const modelSearchTerm = ref('')
const propertySearchTerm = ref('')
const operatorSearchTerm = ref('')

// Autocomplete state
const autocompleteState = ref({
  suggestions: [],
  loading: false,
  error: null
})

// Available operators by property type - optimized for PostgreSQL JSON querying
const operatorsByType = {
  string: [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'contains', label: 'contains' },
    { value: 'ilike', label: 'contains (case insensitive)' },
    { value: 'in', label: 'in list' }
  ],
  number: [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '<', label: 'less than' },
    { value: '<=', label: 'less than or equal' },
    { value: '>', label: 'greater than' },
    { value: '>=', label: 'greater than or equal' },
    { value: 'between', label: 'between' },
    { value: 'in', label: 'in list' }
  ],
  integer: [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: '<', label: 'less than' },
    { value: '<=', label: 'less than or equal' },
    { value: '>', label: 'greater than' },
    { value: '>=', label: 'greater than or equal' },
    { value: 'between', label: 'between' },
    { value: 'in', label: 'in list' }
  ],
  boolean: [
    { value: '=', label: 'is' },
    { value: '!=', label: 'is not' }
  ],
  array: [
    { value: 'contains', label: 'contains' },
    { value: 'overlap', label: 'overlaps with' },
    { value: 'containedIn', label: 'contained in' },
    { value: 'length=', label: 'length equals' },
    { value: 'length<', label: 'length less than' },
    { value: 'length>', label: 'length greater than' }
  ],
  // Date/datetime specific operators - more semantic for temporal queries
  date: [
    { value: '=', label: 'on' },
    { value: '!=', label: 'not on' },
    { value: '<', label: 'before' },
    { value: '<=', label: 'on or before' },
    { value: '>', label: 'after' },
    { value: '>=', label: 'on or after' },
    // { value: 'between', label: 'between dates' },
    // { value: 'in', label: 'on dates' }
  ],
  datetime: [
    { value: '=', label: 'at' },
    { value: '!=', label: 'not at' },
    { value: '<', label: 'before' },
    { value: '<=', label: 'at or before' },
    { value: '>', label: 'after' },
    { value: '>=', label: 'at or after' },
    { value: 'between', label: 'between times' },
    { value: 'in', label: 'at times' }
  ]
}

// Initialize filters from props
const initializeFilters = () => {
  if (props.filter.subFilters && props.filter.subFilters.length > 0) {
    // Load existing multiple filters
    filters.value = props.filter.subFilters.map(f => ({
      id: f.id || Date.now() + Math.random(),
      property: f.property || '',
      operator: f.operator || '',
      value: f.value || ''
    }))
    logicalOperator.value = props.filter.logicalOperator || 'and'
  } else {
    // Convert single filter to array format
    filters.value = [{
      id: Date.now(),
      property: props.filter.property || '',
      operator: props.filter.operator || '',
      value: props.filter.value || ''
    }]
  }
}

// Initialize on component setup
initializeFilters()

// Watch for changes to props.filter to reinitialize if needed
watch(() => [props.filter.property, props.filter.operator, props.filter.value], () => {
  if (filters.value.length === 1) {
    // Update the first filter to match props
    filters.value[0].property = props.filter.property || ''
    filters.value[0].operator = props.filter.operator || ''
    filters.value[0].value = props.filter.value || ''
  }
}, { deep: true })

// Get filtered models based on search term
const filteredModels = computed(() => {
  if (!modelSearchTerm.value) return props.models
  return props.models.filter(model => 
    (model.display_name || model.name).toLowerCase().includes(modelSearchTerm.value.toLowerCase())
  )
})

// Extract nested properties from JSON schema using dot notation
const extractNestedProperties = (schema, prefix = '', maxDepth = 5, currentDepth = 0) => {
  const properties = []
  
  if (!schema || !schema.properties || currentDepth >= maxDepth) {
    if (currentDepth >= maxDepth) {
      console.log('🔄 Max depth reached at level', currentDepth, 'for prefix:', prefix)
    }
    return properties
  }
  
  console.log('🔍 Extracting properties at depth', currentDepth, 'prefix:', prefix, 'properties:', Object.keys(schema.properties))
  
  Object.entries(schema.properties).forEach(([key, propertySchema]) => {
    const fullPath = prefix ? `${prefix}.${key}` : key
    const displayName = propertySchema.title || key
    const fullDisplayName = prefix ? `${prefix.replace(/\./g, ' → ')} → ${displayName}` : displayName
    
    // Add the current property
    properties.push({
      name: fullPath,
      display_name: fullDisplayName,
      type: Array.isArray(propertySchema.type) ? propertySchema.type[0] : propertySchema.type || 'string',
      format: propertySchema.format || '',
      description: propertySchema.description || '',
      // Include full schema for enhanced validation
      schema: propertySchema,
      isNested: prefix !== ''
    })
    
    // Recursively extract nested object properties
    if (propertySchema.type === 'object' && propertySchema.properties) {
      properties.push(...extractNestedProperties(propertySchema, fullPath, maxDepth, currentDepth + 1))
    }
    
    // Handle array items that are objects
    if (propertySchema.type === 'array' && propertySchema.items?.type === 'object' && propertySchema.items.properties) {
      properties.push(...extractNestedProperties(propertySchema.items, `${fullPath}[]`, maxDepth, currentDepth + 1))
    }
  })
  
  return properties
}

// Get all properties (including nested) from the current model
const getAllModelProperties = computed(() => {
  // First try to get the full model from metadataStore using the modelId
  const modelId = props.filter.model
  if (!modelId) return []
  
  console.log('🔍 Getting model properties for modelId:', modelId)
  
  try {
    // Find the model in the store
    const model = metadataStore.models.find(m => m.model?.id === modelId)?.model
    console.log('🔍 Found model:', model?.name, 'has schema:', !!model?.latest_version?.schema)
    
    if (!model?.latest_version?.schema) {
      // Fallback to the simple properties if full schema isn't available
      console.log('🔄 Falling back to simple properties:', props.filter.modelProperties?.length)
      return props.filter.modelProperties || []
    }
    
    // Log the schema structure
    console.log('🔍 Schema properties:', Object.keys(model.latest_version.schema.properties || {}))
    
    // Extract nested properties from the full schema
    const extracted = extractNestedProperties(model.latest_version.schema)
    console.log('🔍 Total extracted properties:', extracted.length, extracted.map(p => p.name))
    return extracted
  } catch (error) {
    console.warn('Failed to extract nested properties, falling back to simple properties:', error)
    return props.filter.modelProperties || []
  }
})

// Get filtered properties based on search term for a specific filter
const getFilteredProperties = () => {
  const allProperties = getAllModelProperties.value
  if (!propertySearchTerm.value) return allProperties
  return allProperties.filter(prop => 
    prop.display_name.toLowerCase().includes(propertySearchTerm.value.toLowerCase()) ||
    prop.name.toLowerCase().includes(propertySearchTerm.value.toLowerCase())
  )
}

// Get filtered operators based on search term for current property type and format
const getFilteredOperators = (filter) => {
  const property = getAllModelProperties.value.find(p => p.name === filter.property)
  const propertyType = property?.type || 'string'
  const propertyFormat = property?.format || ''
  
  // Use format-specific operators for dates/times
  let operatorKey = propertyType
  if (propertyType === 'string' && propertyFormat) {
    if (propertyFormat === 'date') {
      operatorKey = 'date'
    } else if (propertyFormat === 'date-time') {
      operatorKey = 'datetime'
    }
  }
  
  const operators = operatorsByType[operatorKey] || operatorsByType.string
  
  if (!operatorSearchTerm.value) return operators
  return operators.filter(op => 
    op.label.toLowerCase().includes(operatorSearchTerm.value.toLowerCase())
  )
}

// Get current model name
const currentModelName = computed(() => {
  const model = props.models.find(m => m.id === props.filter.model)
  return model?.display_name || model?.name || ''
})

// Get current property name for a filter
const getCurrentPropertyName = (filter) => {
  const property = getAllModelProperties.value.find(p => p.name === filter.property)
  return property?.display_name || ''
}

// Get current operator name for a filter
const getCurrentOperatorName = (filter) => {
  const property = getAllModelProperties.value.find(p => p.name === filter.property)
  const propertyType = property?.type || 'string'
  const propertyFormat = property?.format || ''
  
  // Use format-specific operators for dates/times
  let operatorKey = propertyType
  if (propertyType === 'string' && propertyFormat) {
    if (propertyFormat === 'date') {
      operatorKey = 'date'
    } else if (propertyFormat === 'date-time') {
      operatorKey = 'datetime'
    }
  }
  
  const operators = operatorsByType[operatorKey] || operatorsByType.string
  const operator = operators.find(op => op.value === filter.operator)
  return operator?.label || ''
}

// Select model (only affects the main filter)
const selectModel = (model) => {
  emit('model-change', props.index, model.id)
  activePopover.value = null
  modelSearchTerm.value = ''
}

// Add a new sub-filter
const addSubFilter = () => {
  filters.value.push({
    id: Date.now() + Math.random(),
    property: '',
    operator: '',
    value: ''
  })
  emitFilterUpdate()
}

// Remove a sub-filter
const removeSubFilter = (filterIndex) => {
  if (filters.value.length > 1) {
    filters.value.splice(filterIndex, 1)
    emitFilterUpdate()
  }
}

// Select property for a specific filter
const selectProperty = (filterIndex, property) => {
  const filter = filters.value[filterIndex]
  filter.property = property.name
  filter.operator = ''
  filter.value = ''
  
  // Update the main filter if this is the first one
  if (filterIndex === 0) {
    const updatedFilter = {
      ...props.filter,
      property: property.name,
      operator: '',
      value: ''
    }
    emit('update-filter', props.index, updatedFilter)
  }
  
  activePopover.value = null
  propertySearchTerm.value = ''
  
  // Auto-open operator dropdown
  setTimeout(() => {
    activePopover.value = `operator-${filter.id}`
  }, 100)
  
  emitFilterUpdate()
}

// Select operator for a specific filter
const selectOperator = (filterIndex, operator) => {
  const filter = filters.value[filterIndex]
  filter.operator = operator.value
  filter.value = ''
  
  // Update the main filter if this is the first one
  if (filterIndex === 0) {
    const updatedFilter = {
      ...props.filter,
      operator: operator.value,
      value: ''
    }
    emit('update-filter', props.index, updatedFilter)
  }
  
  activePopover.value = null
  operatorSearchTerm.value = ''
  
  // Auto-focus value input
  setTimeout(() => {
    const valueInput = document.querySelector(`input.value-input[data-filter-id="${filter.id}"]`)
    if (valueInput) {
      valueInput.focus()
    }
  }, 100)
  
  emitFilterUpdate()
}

// Clear segment for a specific filter
const clearSegment = (filterIndex, segment) => {
  const filter = filters.value[filterIndex]
  
  if (segment === 'property') {
    filter.property = ''
    filter.operator = ''
    filter.value = ''
  } else if (segment === 'operator') {
    filter.operator = ''
    filter.value = ''
  } else if (segment === 'value') {
    filter.value = ''
  }
  
  // Update the main filter if this is the first one
  if (filterIndex === 0) {
    let updatedFilter = { ...props.filter }
    
    updatedFilter = {
      ...updatedFilter,
      property: filter.property,
      operator: filter.operator,
      value: filter.value
    }
    
    emit('update-filter', props.index, updatedFilter)
  }
  
  emitFilterUpdate()
}

// Clear model (special case)
const clearModel = () => {
  let updatedFilter = { ...props.filter }
  updatedFilter = {
    ...updatedFilter,
    model: '',
    property: '',
    operator: '',
    value: '',
    modelProperties: []
  }
  // Clear all sub-filters when model is cleared
  filters.value = [{
    id: Date.now(),
    property: '',
    operator: '',
    value: ''
  }]
  emit('update-filter', props.index, updatedFilter)
  emitFilterUpdate()
}

// Handle value input for a specific filter
const onValueInput = (event, filterIndex) => {
  const value = event.target.value
  const filter = filters.value[filterIndex]
  filter.value = value
  
  // Update the main filter if this is the first one
  if (filterIndex === 0) {
    const updatedFilter = {
      ...props.filter,
      value: value
    }
    emit('update-filter', props.index, updatedFilter)
  }
  
  // Trigger autocomplete if enabled and we have enough context
  // Only enable autocomplete for string properties
  const property = getAllModelProperties.value.find(p => p.name === filter.property)
  const propertyType = property?.type || 'string'
  const propertyFormat = property?.format || ''
  const isStringProperty = propertyType === 'string' && !propertyFormat // Exclude formatted strings like dates
  
  if (props.enableAutocomplete && value && value.length >= 2 && filter.property && filter.operator && props.filter.model && isStringProperty) {
    debouncedFetchAutocomplete(value, filter.property, filter.operator, filter.id)
  } else {
    // Clear autocomplete state
    autocompleteState.value.suggestions = []
    if (activePopover.value === `autocomplete-${filter.id}`) {
      activePopover.value = null
    }
  }
  
  emitFilterUpdate()
}

// Fetch autocomplete suggestions
const fetchAutocomplete = async (value, property, operator, filterId) => {
  try {
    autocompleteState.value.loading = true
    autocompleteState.value.error = null
    
    // For 'equals' operator (=), use 'contains' for autocomplete to enable partial matching
    // Other operators like 'startsWith', '>', '<', etc. should keep their original operator
    const autocompleteOperator = operator === '=' ? 'contains' : operator
    
    // Convert dot notation to JSON path format
    const jsonPathProperty = property.includes('.') ? 
      `/${property.replace(/\./g, '/')}` : 
      `/${property}`
    
    const results = await metadataStore.getAutocompleteValues(
      props.datasetId,
      props.filter.model,
      jsonPathProperty, // API expects JSON path format
      autocompleteOperator,
      value
    )
    
    autocompleteState.value.suggestions = results
    autocompleteState.value.loading = false
    
    // Show autocomplete popover if we have suggestions
    if (results.length > 0) {
      activePopover.value = `autocomplete-${filterId}`
    }
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error)
    autocompleteState.value.error = error.message
    autocompleteState.value.suggestions = []
    autocompleteState.value.loading = false
  }
}

// Debounced autocomplete fetch
const debouncedFetchAutocomplete = createThrottle(fetchAutocomplete, 300)

// Select autocomplete suggestion
const selectAutocompleteSuggestion = (suggestion, filterIndex) => {
  const filter = filters.value[filterIndex]
  filter.value = suggestion
  
  // Update the main filter if this is the first one
  if (filterIndex === 0) {
    const updatedFilter = {
      ...props.filter,
      value: suggestion
    }
    emit('update-filter', props.index, updatedFilter)
  }
  
  activePopover.value = null
  
  // Clear autocomplete state
  autocompleteState.value.suggestions = []
  
  emitFilterUpdate()
}

// Handle value input focus
const handleValueFocus = (filter) => {
  if (props.enableAutocomplete && autocompleteState.value.suggestions.length > 0 && filter.value && filter.value.length >= 2) {
    activePopover.value = `autocomplete-${filter.id}`
  }
}

// Emit filter update with multiple filters structure
const emitFilterUpdate = () => {
  if (filters.value.length <= 1) {
    // Single filter - revert to single filter structure and update parent
    const singleFilter = filters.value[0] || { property: '', operator: '', value: '' }
    const updatedFilter = {
      ...props.filter,
      property: singleFilter.property,
      operator: singleFilter.operator,
      value: singleFilter.value,
      hasMultipleFilters: false,
      subFilters: null,
      logicalOperator: null
    }
    emit('update-filter', props.index, updatedFilter)
    return
  }
  
  // Multiple filters - emit structured data
  const validFilters = filters.value.filter(f => 
    f.property && f.operator && f.value !== ''
  )
  
  if (validFilters.length === 0) {
    // No valid filters - emit empty filter state
    const updatedFilter = {
      ...props.filter,
      property: '',
      operator: '',
      value: '',
      hasMultipleFilters: false,
      subFilters: null,
      logicalOperator: null
    }
    emit('update-filter', props.index, updatedFilter)
    return
  }
  
  const multiFilterData = {
    ...props.filter,
    subFilters: filters.value,
    logicalOperator: logicalOperator.value,
    hasMultipleFilters: true
  }
  
  // Update the main props.filter to maintain backward compatibility
  if (validFilters.length > 0) {
    multiFilterData.property = validFilters[0].property
    multiFilterData.operator = validFilters[0].operator
    multiFilterData.value = validFilters[0].value
  }
  
  emit('update-filter', props.index, multiFilterData)
}

// Handle logical operator change
const onLogicalOperatorChange = () => {
  emitFilterUpdate()
}

// Get placeholder text for value input
const getValuePlaceholder = (filter) => {
  const property = getAllModelProperties.value.find(p => p.name === filter.property)
  const propertyType = property?.type || 'string'
  const operator = filter.operator
  
  if (operator === 'in' || operator === 'overlap' || operator === 'containedIn') {
    return 'Enter comma-separated values'
  }
  if (operator === 'between') {
    return 'Enter two comma-separated values (e.g., 10,20)'
  }
  if (operator && operator.startsWith('length')) {
    return 'Enter a number'
  }
  if (propertyType === 'boolean') {
    return 'true or false'
  }
  if (propertyType === 'number' || propertyType === 'integer') {
    return 'Enter a number'
  }
  return 'Enter a value'
}

// Get input type based on property type and format
const getInputType = (filter) => {
  const property = getAllModelProperties.value.find(p => p.name === filter.property)
  const propertyType = property?.type || 'string'
  const propertyFormat = property?.format || ''
  const operator = filter.operator
  
  // Array-based operators and length operators always use text input for comma-separated values
  if (operator === 'in' || operator === 'overlap' || operator === 'containedIn' || operator === 'between' || 
      (operator && operator.startsWith('length'))) {
    return 'text'
  }
  
  // Handle specific string formats that need special input types
  if (propertyType === 'string' && propertyFormat) {
    switch (propertyFormat) {
      case 'date':
        return 'date'
      case 'date-time':
        return 'datetime-local'
      case 'time':
        return 'time'
      case 'email':
        return 'email'
      case 'uri':
        return 'url'
      default:
        return 'text'
    }
  }
  
  // Map property types to input types
  if (propertyType === 'number' || propertyType === 'integer') {
    return 'number'
  }
  
  return 'text'
}

// Enhanced validation using full schema constraints
const validateValue = (value, filter) => {
  if (!value || value.trim() === '') return true // Empty values are handled elsewhere
  
  const property = getAllModelProperties.value.find(p => p.name === filter.property)
  const propertyType = property?.type || 'string'
  const propertySchema = property?.schema || {}
  const operator = filter.operator
  
  // Skip validation for array-based operators as they're handled by comma separation
  if (operator === 'in' || operator === 'overlap' || operator === 'containedIn') {
    return true
  }
  
  // Handle between operator - should have two values
  if (operator === 'between') {
    const parts = value.split(',').map(v => v.trim())
    if (parts.length !== 2) return false
    
    if (propertyType === 'number' || propertyType === 'integer') {
      return parts.every(part => !isNaN(Number(part)) && part !== '')
    }
    return true
  }
  
  // Handle length operators - should be numeric
  if (operator && operator.startsWith('length')) {
    return !isNaN(Number(value)) && value.trim() !== ''
  }
  
  // Enhanced type-specific validation with schema constraints
  if (propertyType === 'integer') {
    const numValue = Number(value)
    if (!Number.isInteger(numValue) || isNaN(numValue)) return false
    
    // Check min/max constraints from schema
    if (propertySchema.minimum !== undefined && numValue < propertySchema.minimum) return false
    if (propertySchema.maximum !== undefined && numValue > propertySchema.maximum) return false
    
    return true
  }
  
  if (propertyType === 'number') {
    const numValue = Number(value)
    if (isNaN(numValue) || value.trim() === '') return false
    
    // Check min/max constraints from schema
    if (propertySchema.minimum !== undefined && numValue < propertySchema.minimum) return false
    if (propertySchema.maximum !== undefined && numValue > propertySchema.maximum) return false
    if (propertySchema.multipleOf !== undefined && numValue % propertySchema.multipleOf !== 0) return false
    
    return true
  }
  
  if (propertyType === 'string') {
    // Check string length constraints from schema
    if (propertySchema.minLength !== undefined && value.length < propertySchema.minLength) return false
    if (propertySchema.maxLength !== undefined && value.length > propertySchema.maxLength) return false
    
    // Check pattern constraint from schema
    if (propertySchema.pattern) {
      try {
        const regex = new RegExp(propertySchema.pattern)
        if (!regex.test(value)) return false
      } catch (error) {
        console.warn('Invalid regex pattern in schema:', propertySchema.pattern, error)
      }
    }
    
    return true
  }
  
  if (propertyType === 'boolean') {
    const lowerValue = value.toLowerCase().trim()
    return lowerValue === 'true' || lowerValue === 'false'
  }
  
  return true // Default to valid for unknown types
}

// Handle value input with validation
const onValidatedValueInput = (event, filterIndex) => {
  const value = event.target.value
  const filter = filters.value[filterIndex]
  
  // Update the value regardless of validation for better UX
  filter.value = value
  
  // Visual feedback for validation (optional - could add error styling)
  const isValid = validateValue(value, filter)
  
  // Only emit updates for valid values or empty values
  if (isValid || value.trim() === '') {
    // Call original value input handler
    onValueInput(event, filterIndex)
  }
}

// Handle keyboard navigation
const onKeydown = (event, type, filterIndex = 0) => {
  if (event.key === 'Escape') {
    activePopover.value = null
    modelSearchTerm.value = ''
    propertySearchTerm.value = ''
    operatorSearchTerm.value = ''
    event.preventDefault()
  }
  
  if (event.key === 'Enter') {
    const filter = filters.value[filterIndex]
    if (type === 'model' && filteredModels.value.length > 0) {
      selectModel(filteredModels.value[0])
    } else if (type === 'property' && getFilteredProperties().length > 0) {
      selectProperty(filterIndex, getFilteredProperties()[0])
    } else if (type === 'operator' && getFilteredOperators(filter).length > 0) {
      selectOperator(filterIndex, getFilteredOperators(filter)[0])
    }
    event.preventDefault()
  }
}
</script>

<template>
  <div class="multi-model-filter">
    <!-- Primary Filter Row -->
    <div class="filter-content">
      <div class="filter-wrap">
        <IconFilterFilled
          class="filter-icon"
          :height="16"
          :width="16"
        />
        
        <div class="filter-criteria-wrap">
          <!-- Primary filter row (model + first filter inline) -->
          <div class="primary-filter-row">
            <!-- Model segment -->
            <div 
              v-if="!filter.model && !hideEmptyModelSelector"
              class="filter-segment model"
            >
              <el-popover
                :visible="activePopover === `model-${filter.id}`"
                placement="bottom-start"
                :width="300"
                trigger="manual"
                :show-arrow="false"
                @update:visible="(val) => !val && (activePopover = null)"
              >
                <template #reference>
                  <input
                    v-model="modelSearchTerm"
                    type="text"
                    class="segment-input"
                    placeholder="Select model..."
                    @focus="activePopover = `model-${filter.id}`"
                    @click.stop="activePopover = `model-${filter.id}`"
                    @keydown="onKeydown($event, 'model')"
                  />
                </template>
                <div class="popover-content">
                  <div class="popover-list">
                    <div
                      v-for="model in filteredModels"
                      :key="model.id"
                      class="popover-item"
                      @click="selectModel(model)"
                    >
                      <span class="item-label">{{ model.display_name || model.name }}</span>
                    </div>
                    <div 
                      v-if="modelSearchTerm && !filteredModels.length"
                      class="popover-empty"
                    >
                      No models found
                    </div>
                  </div>
                </div>
              </el-popover>
            </div>
            <div 
              v-else-if="!hideEmptyModelSelector"
              class="filter-segment selected model"
              @click="activePopover = `model-${filter.id}`"
            >
              <span class="segment-label">{{ currentModelName }}</span>
              <IconRemove
                class="segment-clear"
                :height="10"
                :width="10"
                @click.stop="clearModel"
              />
            </div>
            
            <!-- First filter (inline with model) -->
            <template v-if="filter.model && filters.length > 0">
              <div class="filter-segments-inline">
                <!-- Property segment -->
                <div 
                  v-if="!filters[0].property"
                  class="filter-segment optional-segment"
                >
                  <el-popover
                    :visible="activePopover === `property-${filters[0].id}`"
                    placement="bottom-start"
                    :width="300"
                    trigger="manual"
                    :show-arrow="false"
                    @update:visible="(val) => !val && (activePopover = null)"
                  >
                    <template #reference>
                      <input
                        v-model="propertySearchTerm"
                        type="text"
                        class="segment-input"
                        placeholder="Filter (optional)..."
                        @focus="activePopover = `property-${filters[0].id}`"
                        @click.stop="activePopover = `property-${filters[0].id}`"
                        @keydown="onKeydown($event, 'property', 0)"
                      />
                    </template>
                    <div class="popover-content">
                      <div class="popover-list">
                        <div
                          v-for="prop in getFilteredProperties()"
                          :key="prop.name"
                          class="popover-item"
                          @click="selectProperty(0, prop)"
                        >
                          <span class="item-label">{{ prop.display_name }}</span>
                          <span class="item-type">{{ prop.type }}</span>
                        </div>
                        <div 
                          v-if="propertySearchTerm && !getFilteredProperties().length"
                          class="popover-empty"
                        >
                          No properties found
                        </div>
                      </div>
                    </div>
                  </el-popover>
                </div>
                <div 
                  v-else
                  class="filter-segment selected"
                >
                  <span class="segment-label">{{ getCurrentPropertyName(filters[0]) }}</span>
                  <IconRemove
                    class="segment-clear"
                    :height="10"
                    :width="10"
                    @click.stop="clearSegment(0, 'property')"
                  />
                </div>
                
                <!-- Operator segment -->
                <template v-if="filters[0].property">
                  <div 
                    v-if="!filters[0].operator"
                    class="filter-segment"
                  >
                    <el-popover
                      :visible="activePopover === `operator-${filters[0].id}`"
                      placement="bottom-start"
                      :width="250"
                      trigger="manual"
                      :show-arrow="false"
                      @update:visible="(val) => !val && (activePopover = null)"
                    >
                      <template #reference>
                        <input
                          v-model="operatorSearchTerm"
                          type="text"
                          class="segment-input"
                          placeholder="Select operator..."
                          @focus="activePopover = `operator-${filters[0].id}`"
                          @click.stop="activePopover = `operator-${filters[0].id}`"
                          @keydown="onKeydown($event, 'operator', 0)"
                        />
                      </template>
                      <div class="popover-content">
                        <div class="popover-list">
                          <div
                            v-for="op in getFilteredOperators(filters[0])"
                            :key="op.value"
                            class="popover-item"
                            @click="selectOperator(0, op)"
                          >
                            {{ op.label }}
                          </div>
                          <div 
                            v-if="operatorSearchTerm && !getFilteredOperators(filters[0]).length"
                            class="popover-empty"
                          >
                            No operators found
                          </div>
                        </div>
                      </div>
                    </el-popover>
                  </div>
                  <div 
                    v-else
                    class="filter-segment selected"
                  >
                    <span class="segment-label">{{ getCurrentOperatorName(filters[0]) }}</span>
                    <IconRemove
                      class="segment-clear"
                      :height="10"
                      :width="10"
                      @click.stop="clearSegment(0, 'operator')"
                    />
                  </div>
                </template>
                
                <!-- Value segment -->
                <template v-if="filters[0].operator">
                  <div class="filter-segment value-segment">
                    <el-popover
                      :visible="activePopover === `autocomplete-${filters[0].id}`"
                      placement="bottom-start"
                      :width="300"
                      trigger="manual"
                      :show-arrow="false"
                      @update:visible="(val) => !val && (activePopover = null)"
                    >
                      <template #reference>
                        <input
                          :value="filters[0].value"
                          :type="getInputType(filters[0])"
                          class="segment-input value-input"
                          :data-filter-id="filters[0].id"
                          :placeholder="getValuePlaceholder(filters[0])"
                          @input="onValidatedValueInput($event, 0)"
                          @focus="handleValueFocus(filters[0])"
                        />
                      </template>
                      <div class="popover-content">
                        <div class="popover-list">
                          <div 
                            v-if="autocompleteState.loading"
                            class="popover-empty"
                          >
                            Loading suggestions...
                          </div>
                          <div 
                            v-else-if="autocompleteState.error"
                            class="popover-empty error"
                          >
                            Error loading suggestions
                          </div>
                          <div
                            v-for="suggestion in autocompleteState.suggestions"
                            :key="suggestion"
                            class="popover-item"
                            @click="selectAutocompleteSuggestion(suggestion, 0)"
                          >
                            <span class="item-label">{{ suggestion }}</span>
                          </div>
                          <div 
                            v-if="!autocompleteState.loading && !autocompleteState.error && autocompleteState.suggestions.length === 0 && filters[0].value && filters[0].value.length >= 2"
                            class="popover-empty"
                          >
                            No suggestions found
                          </div>
                        </div>
                      </div>
                    </el-popover>
                    <IconRemove
                      v-if="filters[0].value"
                      class="segment-clear"
                      :height="10"
                      :width="10"
                      @click.stop="clearSegment(0, 'value')"
                    />
                  </div>
                </template>
                
                <!-- Add filter and logical operator controls -->
                <div v-if="filters[0].property && filters[0].operator && filters[0].value" class="filter-actions-inline">
                  <button
                    class="btn-add-sub-filter"
                    @click="addSubFilter"
                    title="Add another filter"
                  >
                    <IconPlus
                      :height="12"
                      :width="12"
                    />
                  </button>
                  
                  <!-- OR/AND toggle (inline, only show when there are multiple filters) -->
                  <div v-if="filters.length > 1" class="logical-operator-inline">
                    <select 
                      v-model="logicalOperator"
                      @change="onLogicalOperatorChange"
                      class="logical-operator-select"
                    >
                      <option value="and">AND</option>
                      <option value="or">OR</option>
                    </select>
                  </div>
                </div>
              </div>
            </template>
          </div>
          
          <!-- Additional Filter Rows (indented) -->
          <div 
            v-if="filter.model"
            v-for="(subFilter, subIndex) in filters.slice(1)"
            :key="subFilter.id"
            class="sub-filter-row indented"
          >
            <!-- Property segment -->
            <div 
              v-if="!subFilter.property"
              class="filter-segment"
            >
              <el-popover
                :visible="activePopover === `property-${subFilter.id}`"
                placement="bottom-start"
                :width="300"
                trigger="manual"
                :show-arrow="false"
                @update:visible="(val) => !val && (activePopover = null)"
              >
                <template #reference>
                  <input
                    v-model="propertySearchTerm"
                    type="text"
                    class="segment-input"
                    placeholder="Property..."
                    @focus="activePopover = `property-${subFilter.id}`"
                    @click.stop="activePopover = `property-${subFilter.id}`"
                    @keydown="onKeydown($event, 'property', subIndex + 1)"
                  />
                </template>
                <div class="popover-content">
                  <div class="popover-list">
                    <div
                      v-for="prop in getFilteredProperties()"
                      :key="prop.name"
                      class="popover-item"
                      @click="selectProperty(subIndex + 1, prop)"
                    >
                      <span class="item-label">{{ prop.display_name }}</span>
                      <span class="item-type">{{ prop.type }}</span>
                    </div>
                    <div 
                      v-if="propertySearchTerm && !getFilteredProperties().length"
                      class="popover-empty"
                    >
                      No properties found
                    </div>
                  </div>
                </div>
              </el-popover>
            </div>
            <div 
              v-else
              class="filter-segment selected"
            >
              <span class="segment-label">{{ getCurrentPropertyName(subFilter) }}</span>
              <IconRemove
                class="segment-clear"
                :height="10"
                :width="10"
                @click.stop="clearSegment(subIndex + 1, 'property')"
              />
            </div>
            
            <!-- Operator segment -->
            <template v-if="subFilter.property">
              <div 
                v-if="!subFilter.operator"
                class="filter-segment"
              >
                <el-popover
                  :visible="activePopover === `operator-${subFilter.id}`"
                  placement="bottom-start"
                  :width="250"
                  trigger="manual"
                  :show-arrow="false"
                  @update:visible="(val) => !val && (activePopover = null)"
                >
                  <template #reference>
                    <input
                      v-model="operatorSearchTerm"
                      type="text"
                      class="segment-input"
                      placeholder="Select operator..."
                      @focus="activePopover = `operator-${subFilter.id}`"
                      @click.stop="activePopover = `operator-${subFilter.id}`"
                      @keydown="onKeydown($event, 'operator', subIndex + 1)"
                    />
                  </template>
                  <div class="popover-content">
                    <div class="popover-list">
                      <div
                        v-for="op in getFilteredOperators(subFilter)"
                        :key="op.value"
                        class="popover-item"
                        @click="selectOperator(subIndex + 1, op)"
                      >
                        {{ op.label }}
                      </div>
                      <div 
                        v-if="operatorSearchTerm && !getFilteredOperators(subFilter).length"
                        class="popover-empty"
                      >
                        No operators found
                      </div>
                    </div>
                  </div>
                </el-popover>
              </div>
              <div 
                v-else
                class="filter-segment selected"
              >
                <span class="segment-label">{{ getCurrentOperatorName(subFilter) }}</span>
                <IconRemove
                  class="segment-clear"
                  :height="10"
                  :width="10"
                  @click.stop="clearSegment(subIndex + 1, 'operator')"
                />
              </div>
            </template>
            
            <!-- Value segment -->
            <template v-if="subFilter.operator">
              <div class="filter-segment value-segment">
                <el-popover
                  :visible="activePopover === `autocomplete-${subFilter.id}`"
                  placement="bottom-start"
                  :width="300"
                  trigger="manual"
                  :show-arrow="false"
                  @update:visible="(val) => !val && (activePopover = null)"
                >
                  <template #reference>
                    <input
                      :value="subFilter.value"
                      :type="getInputType(subFilter)"
                      class="segment-input value-input"
                      :data-filter-id="subFilter.id"
                      :placeholder="getValuePlaceholder(subFilter)"
                      @input="onValidatedValueInput($event, subIndex + 1)"
                      @focus="handleValueFocus(subFilter)"
                    />
                  </template>
                  <div class="popover-content">
                    <div class="popover-list">
                      <div 
                        v-if="autocompleteState.loading"
                        class="popover-empty"
                      >
                        Loading suggestions...
                      </div>
                      <div 
                        v-else-if="autocompleteState.error"
                        class="popover-empty error"
                      >
                        Error loading suggestions
                      </div>
                      <div
                        v-for="suggestion in autocompleteState.suggestions"
                        :key="suggestion"
                        class="popover-item"
                        @click="selectAutocompleteSuggestion(suggestion, subIndex + 1)"
                      >
                        <span class="item-label">{{ suggestion }}</span>
                      </div>
                      <div 
                        v-if="!autocompleteState.loading && !autocompleteState.error && autocompleteState.suggestions.length === 0 && subFilter.value && subFilter.value.length >= 2"
                        class="popover-empty"
                      >
                        No suggestions found
                      </div>
                    </div>
                  </div>
                </el-popover>
                <IconRemove
                  v-if="subFilter.value"
                  class="segment-clear"
                  :height="10"
                  :width="10"
                  @click.stop="clearSegment(subIndex + 1, 'value')"
                />
              </div>
            </template>

            <!-- Sub-filter actions: Remove -->
            <div class="sub-filter-actions">
              <button
                class="btn-remove-sub-filter"
                @click="removeSubFilter(subIndex + 1)"
                title="Remove filter"
              >
                <IconTrash
                  :height="14"
                  :width="14"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Main delete button -->
      <button
        v-if="canRemove"
        class="btn-delete"
        @click="$emit('remove-filter', index)"
      >
        <IconTrash
          :height="16"
          :width="16"
        />
      </button>
    </div>

  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/theme' as theme;

.multi-model-filter {
  margin-bottom: 12px;
  
  .filter-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  
  .filter-wrap {
    flex: 1;
    display: flex;
    align-items: flex-start;
    padding: 0px 12px;
    border: 1px solid theme.$gray_2;
    background: white;
    min-height: 40px;
    
    &:focus-within {
      border-color: theme.$purple_1;
    }
  }
  
  .filter-icon {
    color: theme.$purple_3;
    margin-right: 12px;
    align-self: anchor-center;
    flex-shrink: 0;
  }
  
  .filter-criteria-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    padding: 8px 0;
  }
  
  .primary-filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
  }
  
  .filter-segments-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  
  .filter-actions-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 8px;
  }
  
  .logical-operator-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .logical-operator-select {
      border: 1px solid theme.$gray_3;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 12px;
      background: white;
      cursor: pointer;
      min-width: 50px;
      
      &:focus {
        outline: none;
        border-color: theme.$purple_3;
      }
    }
  }
  
  .sub-filter-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    
    &.indented {
      margin-left: 20px;
      padding-left: 8px;
      border-left: 2px solid theme.$gray_2;
      background: theme.$gray_1;
      border-radius: 0 4px 4px 0;
    }
  }
  
  .filter-segment {
    display: flex;
    align-items: center;
    position: relative;
    border-radius: 16px;

    &.model {
      font-weight: 500;
    }

    &.selected {
      background: theme.$purple_tint;
      padding: 4px 4px 4px 16px;
      cursor: pointer;
      
      &:hover {
        background: darken(theme.$gray_1, 5%);
        
        .segment-clear {
          opacity: 1;
        }
      }
    }
    
    &.optional-segment {
      .segment-input::placeholder {
        color: theme.$gray_3;
        font-style: italic;
      }
    }
    
    &.value-segment {
      flex: 1;
    }
    
    .segment-label {
      font-size: 14px;
      color: theme.$gray_6;
      margin-right: 4px;
      white-space: nowrap;
    }
    
    .segment-input {
      border: none;
      outline: none;
      font-size: 14px;
      padding: 4px;
      background: transparent;
      min-width: 120px;
      
      &.value-input {
        flex: 1;
        min-width: 150px;
      }
      
      &::placeholder {
        color: theme.$gray_4;
        font-style: italic;
      }
    }
    
    .segment-clear {
      color: theme.$gray_4;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      margin-left: 4px;
      
      &:hover {
        color: theme.$gray_6;
      }
    }
  }
  
  .sub-filter-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto; // Push to the right
    margin-right: 8px;
    flex-shrink: 0;
  }
  
  .btn-remove-sub-filter {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    
    &:hover {
      color: theme.$red_2;
      opacity: 1;
    }
  }
  
  .add-filter-inline {
    margin-left: 8px;
  }
  
  .btn-add-sub-filter {
    background: theme.$white;
    border: 1px solid theme.$gray_3;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    color: theme.$gray_5;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &:hover {
      border-color: theme.$purple_3;
      color: theme.$purple_3;
      background: theme.$purple_tint;
    }
  }
  
  .btn-delete {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: theme.$purple_2;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    margin-top: 8px; // Align with first row
    align-self: flex-start;
    flex-shrink: 0;
    
    &:hover {
      color: theme.$red_2;
    }
  }
  
  .logical-operator-section {
    margin-top: 8px;
    padding-left: 44px; // Align with filter content
  }
  
  .logical-operator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: theme.$gray_5;
    
    select {
      border: 1px solid theme.$gray_3;
      border-radius: 3px;
      padding: 4px 8px;
      font-size: 14px;
      background: white;
      cursor: pointer;
      
      &:focus {
        outline: none;
        border-color: theme.$purple_3;
      }
    }
  }
}

// Popover styles (copied from RecordFilterStyled)
.popover-content {
  max-height: 300px;
  overflow-y: auto;
  
  .popover-list {
    padding: 4px;
  }
  
  .popover-item {
    padding: 8px 12px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 3px;
    
    &:hover {
      background: theme.$gray_1;
    }
    
    .item-label {
      font-size: 14px;
      color: theme.$gray_6;
    }
    
    .item-type {
      font-size: 12px;
      color: theme.$gray_4;
      font-style: italic;
      margin-left: 8px;
    }
  }
  
  .popover-empty {
    padding: 12px;
    text-align: center;
    color: theme.$gray_4;
    font-size: 14px;
    
    &.error {
      color: theme.$red_2;
    }
  }
}

:deep(.el-popover) {
  padding: 0 !important;
  border: 1px solid theme.$gray_2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>