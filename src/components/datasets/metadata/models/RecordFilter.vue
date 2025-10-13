<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElSelect, ElOption, ElInput, ElButton, ElTag, ElCard } from 'element-plus'
import IconPlus from '@/components/icons/IconPlus.vue'
import IconDelete from '@/components/icons/IconDelete.vue'

const props = defineProps({
  modelSchema: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['filter-change'])

// Filter state
const filters = ref([])
const logicalOperator = ref('and') // 'and' or 'or'

// Available operators by property type
const operatorsByType = {
  string: [
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'contains', label: 'contains' },
    { value: 'ilike', label: 'contains (case insensitive)' },
    { value: 'notIlike', label: 'not contains (case insensitive)' },
    { value: 'in', label: 'in list' },
    { value: 'regex', label: 'matches regex' }
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
    { value: '=', label: 'equals' },
    { value: '!=', label: 'not equals' }
  ],
  array: [
    { value: 'contains', label: 'contains' },
    { value: 'overlap', label: 'overlaps with' },
    { value: 'containedIn', label: 'contained in' },
    { value: 'length=', label: 'length equals' },
    { value: 'length<', label: 'length less than' },
    { value: 'length>', label: 'length greater than' }
  ]
}

// Get available properties from schema
const availableProperties = computed(() => {
  if (!props.modelSchema?.properties) return []
  
  return Object.entries(props.modelSchema.properties).map(([key, property]) => ({
    value: key,
    label: property.title || key,
    type: property.type,
    format: property.format
  }))
})

// Add a new filter
const addFilter = () => {
  filters.value.push({
    id: Date.now() + Math.random(),
    property: '',
    operator: '',
    value: '',
    propertyType: ''
  })
}

// Remove a filter
const removeFilter = (index) => {
  filters.value.splice(index, 1)
  buildPredicate()
}

// Update operators when property changes
const onPropertyChange = (index) => {
  const filter = filters.value[index]
  const property = availableProperties.value.find(p => p.value === filter.property)
  
  if (property) {
    filter.propertyType = property.type
    filter.operator = '' // Reset operator
    filter.value = '' // Reset value
  }
  
  // Don't trigger buildPredicate here since the filter is incomplete
  // It will be triggered when the user completes the filter
}

// Get operators for a specific property type
const getOperatorsForProperty = (propertyType) => {
  return operatorsByType[propertyType] || []
}

// Parse value based on operator and type
const parseValue = (value, operator, propertyType) => {
  // Handle special cases
  if (operator === 'in' || operator === 'overlap' || operator === 'containedIn') {
    // Split comma-separated values into array
    return value.split(',').map(v => {
      const trimmed = v.trim()
      if (propertyType === 'number' || propertyType === 'integer') {
        return Number(trimmed)
      }
      return trimmed
    })
  }
  
  if (operator === 'between') {
    // Expect two comma-separated values for between
    const values = value.split(',').map(v => v.trim())
    if (values.length !== 2) {
      return null
    }
    return values.map(v => {
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

// Build the predicate object for the API
const buildPredicate = () => {
  const validFilters = filters.value.filter(f => 
    f.property && f.operator && f.value !== ''
  )
  
  if (validFilters.length === 0) {
    emit('filter-change', null)
    return
  }
  
  // Build individual predicates with JSON Pointer format
  const predicates = validFilters.map(filter => {
    const parsedValue = parseValue(filter.value, filter.operator, filter.propertyType)
    
    return {
      property: `/${filter.property}`, // Convert to JSON Pointer format
      operator: filter.operator,
      value: parsedValue
    }
  })
  
  // If only one filter, return it directly
  if (predicates.length === 1) {
    emit('filter-change', predicates[0])
    return
  }
  
  // Combine multiple filters with logical operator
  const combinedPredicate = {
    [logicalOperator.value]: predicates
  }
  
  emit('filter-change', combinedPredicate)
}

// Watch for changes to emit filter updates
// Removed automatic watch to prevent infinite loops
// buildPredicate is now only called on explicit user actions

// Get placeholder text for value input
const getValuePlaceholder = (operator, propertyType) => {
  if (operator === 'in' || operator === 'overlap' || operator === 'containedIn') {
    return 'Enter comma-separated values'
  }
  if (operator === 'between') {
    return 'Enter two comma-separated values'
  }
  if (operator.startsWith('length')) {
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

// Initialize with one empty filter
onMounted(() => {
  if (filters.value.length === 0) {
    addFilter()
  }
})
</script>

<template>
  <div class="record-filter">
    <el-card shadow="never" class="filter-card">
      <div class="filter-header">
        <h4>Filter Records</h4>
        <div class="filter-controls">
          <el-select 
            v-if="filters.length > 1"
            v-model="logicalOperator"
            size="small"
            style="width: 100px; margin-right: 12px"
            @change="buildPredicate"
          >
            <el-option value="and" label="AND" />
            <el-option value="or" label="OR" />
          </el-select>
          <el-button
            size="small"
            type="primary"
            @click="addFilter"
          >
            <IconPlus :height="14" :width="14" />
            Add Filter
          </el-button>
        </div>
      </div>
      
      <div class="filter-list">
        <div
          v-for="(filter, index) in filters"
          :key="filter.id"
          class="filter-row"
        >
          <div class="filter-inputs">
            <!-- Property selector -->
            <el-select
              v-model="filter.property"
              placeholder="Select property"
              size="small"
              class="filter-select"
              @change="() => onPropertyChange(index)"
            >
              <el-option
                v-for="prop in availableProperties"
                :key="prop.value"
                :label="prop.label"
                :value="prop.value"
              >
                <span>{{ prop.label }}</span>
                <span class="property-type">{{ prop.type }}</span>
              </el-option>
            </el-select>
            
            <!-- Operator selector -->
            <el-select
              v-model="filter.operator"
              placeholder="Select operator"
              size="small"
              class="filter-select"
              :disabled="!filter.property"
            >
              <el-option
                v-for="op in getOperatorsForProperty(filter.propertyType)"
                :key="op.value"
                :label="op.label"
                :value="op.value"
              />
            </el-select>
            
            <!-- Value input -->
            <el-input
              v-model="filter.value"
              :placeholder="getValuePlaceholder(filter.operator, filter.propertyType)"
              size="small"
              class="filter-input"
              :disabled="!filter.operator"
              @input="buildPredicate"
            />
          </div>
          
          <!-- Remove button -->
          <el-button
            v-if="filters.length > 1"
            size="small"
            type="danger"
            :icon="IconDelete"
            circle
            @click="removeFilter(index)"
          />
        </div>
        
        <!-- Logical operator indicator between filters -->
        <div 
          v-if="index < filters.length - 1 && filters.length > 1"
          class="logical-operator"
        >
          <el-tag size="small">{{ logicalOperator.toUpperCase() }}</el-tag>
        </div>
      </div>
      
      <!-- Help text -->
      <div v-if="filters.length > 0" class="filter-help">
        <p class="help-text">
          <strong>Tips:</strong>
          <span v-if="filters.some(f => f.operator === 'between')">
            For "between", enter two comma-separated values (e.g., "10,20")
          </span>
          <span v-else-if="filters.some(f => ['in', 'overlap', 'containedIn'].includes(f.operator))">
            For list operators, enter comma-separated values (e.g., "value1,value2,value3")
          </span>
          <span v-else-if="filters.some(f => f.propertyType === 'boolean')">
            For boolean properties, enter "true" or "false"
          </span>
          <span v-else>
            Select a property, operator, and enter a value to filter records. Use "Add Filter" to combine multiple conditions.
          </span>
        </p>
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;

.record-filter {
  margin-bottom: 20px;
  
  .filter-card {
    border: 1px solid theme.$gray_2;
    
    :deep(.el-card__body) {
      padding: 16px;
    }
  }
  
  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: theme.$gray_6;
    }
    
    .filter-controls {
      display: flex;
      align-items: center;
    }
  }
  
  .filter-list {
    .filter-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      
      .filter-inputs {
        display: flex;
        gap: 12px;
        flex: 1;
        
        .filter-select {
          width: 200px;
        }
        
        .filter-input {
          flex: 1;
          min-width: 200px;
        }
      }
      
      .property-type {
        margin-left: 8px;
        color: theme.$gray_4;
        font-size: 12px;
        font-style: italic;
      }
    }
    
    .logical-operator {
      text-align: center;
      margin: 8px 0;
    }
  }
  
  .filter-help {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid theme.$gray_2;
    
    .help-text {
      margin: 0;
      font-size: 13px;
      color: theme.$gray_5;
      
      strong {
        margin-right: 4px;
      }
    }
  }
}
</style>