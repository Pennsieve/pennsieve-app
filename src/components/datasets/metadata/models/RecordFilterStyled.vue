<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElPopover, ElTag } from 'element-plus'
import IconFilterFilled from '@/components/icons/IconFilterFilled.vue'
import IconTrash from '@/components/icons/IconTrash.vue'
import IconArrowUp from '@/components/icons/IconArrowUp.vue'
import IconRemove from '@/components/icons/IconRemove.vue'

const props = defineProps({
  modelSchema: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['filter-change'])

// Filter state
const filters = ref([])
const logicalOperator = ref('and')

// Popover states
const activePopover = ref(null)
const searchTerm = ref('')
const operatorSearchTerm = ref('')
const highlightedIndex = ref(-1)

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

// Get filtered properties based on search term
const filteredProperties = computed(() => {
  return availableProperties.value.filter(p => 
    !searchTerm.value || p.label.toLowerCase().includes(searchTerm.value.toLowerCase())
  )
})

// Get filtered operators based on search term for current property type
const getFilteredOperators = (propertyType) => {
  const operators = getOperatorsForProperty(propertyType)
  return operators.filter(op => 
    !operatorSearchTerm.value || op.label.toLowerCase().includes(operatorSearchTerm.value.toLowerCase())
  )
}

// Add a new filter
const addFilter = () => {
  filters.value.push({
    id: Date.now() + Math.random(),
    property: '',
    propertyLabel: '',
    operator: '',
    operatorLabel: '',
    value: '',
    propertyType: ''
  })
}

// Remove a filter
const removeFilter = (index) => {
  filters.value.splice(index, 1)
  
  // If no filters remain, add a new empty filter to maintain the initial state
  if (filters.value.length === 0) {
    addFilter()
  }
  
  buildPredicate()
}

// Clear a filter segment
const clearSegment = (filter, segment) => {
  if (segment === 'property') {
    filter.property = ''
    filter.propertyLabel = ''
    filter.operator = ''
    filter.operatorLabel = ''
    filter.value = ''
    filter.propertyType = ''
  } else if (segment === 'operator') {
    filter.operator = ''
    filter.operatorLabel = ''
    filter.value = ''
  } else if (segment === 'value') {
    filter.value = ''
  }
  buildPredicate()
}

// Select property
const selectProperty = (filter, property) => {
  filter.property = property.value
  filter.propertyLabel = property.label
  filter.propertyType = property.type
  filter.operator = ''
  filter.operatorLabel = ''
  filter.value = ''
  activePopover.value = null
  searchTerm.value = ''
  
  // Automatically open the operator dropdown and focus the input
  setTimeout(() => {
    activePopover.value = `operator-${filter.id}`
    // Focus the operator input field after it becomes visible
    setTimeout(() => {
      const operatorInput = document.querySelector(`input[data-operator-filter-id="${filter.id}"]`)
      if (operatorInput) {
        operatorInput.focus()
      }
    }, 50)
  }, 100)
}

// Select operator
const selectOperator = (filter, operator) => {
  filter.operator = operator.value
  filter.operatorLabel = operator.label
  filter.value = ''
  activePopover.value = null
  operatorSearchTerm.value = ''
  
  // Automatically focus the value input field
  setTimeout(() => {
    const valueInput = document.querySelector(`input.value-input[data-filter-id="${filter.id}"]`)
    if (valueInput) {
      valueInput.focus()
    }
  }, 100)
}

// Get operators for a specific property type
const getOperatorsForProperty = (propertyType) => {
  return operatorsByType[propertyType] || []
}

// Parse value based on operator and type
const parseValue = (value, operator, propertyType) => {
  if (!value) return null
  
  // Handle special cases
  if (operator === 'in' || operator === 'overlap' || operator === 'containedIn') {
    return value.split(',').map(v => {
      const trimmed = v.trim()
      if (propertyType === 'number' || propertyType === 'integer') {
        return Number(trimmed)
      }
      return trimmed
    })
  }
  
  if (operator === 'between') {
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
      property: `/${filter.property}`,
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

// Get placeholder text for value input
const getValuePlaceholder = (operator, propertyType) => {
  if (operator === 'in' || operator === 'overlap' || operator === 'containedIn') {
    return 'Enter comma-separated values'
  }
  if (operator === 'between') {
    return 'Enter two comma-separated values (e.g., 10,20)'
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

// Handle value input
const onValueInput = (filter) => {
  buildPredicate()
}

// Handle keyboard navigation in property dropdown
const onPropertyKeydown = (event, filter) => {
  if (event.key === 'Enter' && filteredProperties.value.length > 0) {
    // Select the first matching property
    selectProperty(filter, filteredProperties.value[0])
    event.preventDefault()
  }
  if (event.key === 'Escape') {
    activePopover.value = null
    searchTerm.value = ''
    event.preventDefault()
  }
}

// Handle keyboard navigation in operator dropdown
const onOperatorKeydown = (event, filter) => {
  const filteredOps = getFilteredOperators(filter.propertyType)
  if (event.key === 'Enter' && filteredOps.length > 0) {
    // Select the first matching operator
    selectOperator(filter, filteredOps[0])
    event.preventDefault()
  }
  if (event.key === 'Escape') {
    activePopover.value = null
    operatorSearchTerm.value = ''
    event.preventDefault()
  }
}

// Check if filter is complete
const isFilterComplete = (filter) => {
  return filter.property && filter.operator && filter.value
}

// Initialize with one empty filter
onMounted(() => {
  if (filters.value.length === 0) {
    addFilter()
  }
})
</script>

<template>
  <div class="record-filters">
    <!-- Filter rows -->
    <div 
      v-for="(filter, index) in filters"
      :key="filter.id"
      class="filter-row"
      :class="{ 'is-invalid': filter.property && filter.operator && !filter.value }"
    >
      <div class="filter-content">
        <div class="filter-wrap">
          <IconFilterFilled
            class="filter-icon"
            :height="16"
            :width="16"
          />
          
          <div class="filter-criteria-wrap">
            
            <!-- Property segment -->
            <div 
              v-if="!filter.property"
              class="filter-segment"
            >
              <el-popover
                :visible="activePopover === `property-${filter.id}`"
                placement="bottom-start"
                :width="300"
                trigger="manual"
                :show-arrow="false"
                @update:visible="(val) => !val && (activePopover = null)"
              >
                <template #reference>
                  <input
                    v-model="searchTerm"
                    type="text"
                    class="segment-input"
                    placeholder="Select property..."
                    @focus="activePopover = `property-${filter.id}`"
                    @click.stop="activePopover = `property-${filter.id}`"
                    @keydown="onPropertyKeydown($event, filter)"
                  />
                </template>
                <div class="popover-content">
                  <div class="popover-list">
                    <div
                      v-for="prop in availableProperties.filter(p => 
                        !searchTerm || p.label.toLowerCase().includes(searchTerm.toLowerCase())
                      )"
                      :key="prop.value"
                      class="popover-item"
                      @click="selectProperty(filter, prop)"
                    >
                      <span class="item-label">{{ prop.label }}</span>
                      <span class="item-type">{{ prop.type }}</span>
                    </div>
                    <div 
                      v-if="searchTerm && !availableProperties.filter(p => 
                        p.label.toLowerCase().includes(searchTerm.toLowerCase())
                      ).length"
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
              @click="activePopover = `property-${filter.id}`"
            >
              <span class="segment-label">{{ filter.propertyLabel }}</span>
              <IconRemove
                class="segment-clear"
                :height="10"
                :width="10"
                @click.stop="clearSegment(filter, 'property')"
              />
            </div>
            
            <!-- Operator segment -->
            <template v-if="filter.property">
              <div 
                v-if="!filter.operator"
                class="filter-segment"
              >
                <el-popover
                  :visible="activePopover === `operator-${filter.id}`"
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
                      :data-operator-filter-id="filter.id"
                      placeholder="Select operator..."
                      @focus="activePopover = `operator-${filter.id}`"
                      @click.stop="activePopover = `operator-${filter.id}`"
                      @keydown="onOperatorKeydown($event, filter)"
                    />
                  </template>
                  <div class="popover-content">
                    <div class="popover-list">
                      <div
                        v-for="op in getFilteredOperators(filter.propertyType)"
                        :key="op.value"
                        class="popover-item"
                        @click="selectOperator(filter, op)"
                      >
                        {{ op.label }}
                      </div>
                      <div 
                        v-if="operatorSearchTerm && !getFilteredOperators(filter.propertyType).length"
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
                <span class="segment-label">{{ filter.operatorLabel }}</span>
                <IconRemove
                  class="segment-clear"
                  :height="10"
                  :width="10"
                  @click.stop="clearSegment(filter, 'operator')"
                />
              </div>
            </template>
            
            <!-- Value segment -->
            <template v-if="filter.operator">
              <div class="filter-segment value-segment">
                <input
                  v-model="filter.value"
                  type="text"
                  class="segment-input value-input"
                  :data-filter-id="filter.id"
                  :placeholder="getValuePlaceholder(filter.operator, filter.propertyType)"
                  @input="onValueInput(filter)"
                  @keyup.enter="buildPredicate"
                />
                <IconRemove
                  v-if="filter.value"
                  class="segment-clear"
                  :height="10"
                  :width="10"
                  @click.stop="clearSegment(filter, 'value')"
                />
              </div>
            </template>
          </div>
        </div>
        
        <button
          class="btn-delete"
          @click="removeFilter(index)"
        >
          <IconTrash
            :height="16"
            :width="16"
          />
        </button>
      </div>
      
    </div>
    
    <!-- Add filter button and logical operator -->
    <div v-if="filters.length > 0" class="filter-actions">
      <div class="filter-actions-left">
        <button
          class="btn-add-filter"
          @click="addFilter"
        >
          + Add Filter
        </button>
      </div>
      
      <div v-if="filters.length > 1" class="logical-operator">
        <span>Combine with:</span>
        <select 
          v-model="logicalOperator"
          @change="buildPredicate"
        >
          <option value="and">AND</option>
          <option value="or">OR</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;

.record-filters {
  margin-bottom: 20px;
  
  .filter-row {
    margin-bottom: 12px;
    
    &.is-invalid {
      .filter-wrap {
        border-color: theme.$red_2;
      }
    }
  }
  
  .filter-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .filter-wrap {
    flex: 1;
    display: flex;
    align-items: center;
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
    flex-shrink: 0;
  }
  
  .filter-criteria-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    
    .placeholder {
      color: theme.$gray_4;
      font-size: 14px;
      font-style: italic;
    }
  }
  
  .filter-segment {
    display: flex;
    align-items: center;
    position: relative;
    border-radius: 16px;

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
  
  .btn-delete {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: theme.$purple_2;
    display: flex;
    align-items: center;
    justify-content: center;
    
    &:hover {
      color: theme.$red_2;
    }
  }
  
  .msg-invalid {
    color: theme.$red_2;
    font-size: 12px;
    margin: 4px 0 0 44px;
  }
  
  .filter-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    
    .filter-actions-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
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
    
    .filter-hint {
      color: theme.$gray_4;
      font-size: 13px;
      font-style: italic;
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
}

// Popover styles
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
  }
}

:deep(.el-popover) {
  padding: 0 !important;
  border: 1px solid theme.$gray_2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>