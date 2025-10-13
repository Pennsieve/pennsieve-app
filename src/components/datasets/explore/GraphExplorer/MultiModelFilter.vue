<script setup>
import { ref, computed } from 'vue'
import { ElPopover } from 'element-plus'
import IconFilterFilled from '@/components/icons/IconFilterFilled.vue'
import IconTrash from '@/components/icons/IconTrash.vue'
import IconRemove from '@/components/icons/IconRemove.vue'

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
  }
})

const emit = defineEmits(['update-filter', 'remove-filter', 'model-change'])

// Popover states
const activePopover = ref(null)
const modelSearchTerm = ref('')
const propertySearchTerm = ref('')
const operatorSearchTerm = ref('')

// Available operators by property type (same as RecordFilterStyled)
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

// Get filtered models based on search term
const filteredModels = computed(() => {
  if (!modelSearchTerm.value) return props.models
  return props.models.filter(model => 
    (model.display_name || model.name).toLowerCase().includes(modelSearchTerm.value.toLowerCase())
  )
})

// Get filtered properties based on search term
const filteredProperties = computed(() => {
  if (!propertySearchTerm.value) return props.filter.modelProperties || []
  return (props.filter.modelProperties || []).filter(prop => 
    prop.display_name.toLowerCase().includes(propertySearchTerm.value.toLowerCase())
  )
})

// Get filtered operators based on search term for current property type
const getFilteredOperators = () => {
  const property = props.filter.modelProperties?.find(p => p.name === props.filter.property)
  const propertyType = property?.type || 'string'
  const operators = operatorsByType[propertyType] || operatorsByType.string
  
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

// Get current property name
const currentPropertyName = computed(() => {
  const property = props.filter.modelProperties?.find(p => p.name === props.filter.property)
  return property?.display_name || ''
})

// Get current operator name
const currentOperatorName = computed(() => {
  const property = props.filter.modelProperties?.find(p => p.name === props.filter.property)
  const propertyType = property?.type || 'string'
  const operators = operatorsByType[propertyType] || operatorsByType.string
  const operator = operators.find(op => op.value === props.filter.operator)
  return operator?.label || ''
})

// Select model
const selectModel = (model) => {
  emit('model-change', props.index, model.id)
  activePopover.value = null
  modelSearchTerm.value = ''
}

// Select property
const selectProperty = (property) => {
  const updatedFilter = {
    ...props.filter,
    property: property.name,
    operator: '',
    value: ''
  }
  emit('update-filter', props.index, updatedFilter)
  activePopover.value = null
  propertySearchTerm.value = ''
  
  // Auto-open operator dropdown
  setTimeout(() => {
    activePopover.value = `operator-${props.filter.id}`
  }, 100)
}

// Select operator
const selectOperator = (operator) => {
  const updatedFilter = {
    ...props.filter,
    operator: operator.value,
    value: ''
  }
  emit('update-filter', props.index, updatedFilter)
  activePopover.value = null
  operatorSearchTerm.value = ''
  
  // Auto-focus value input
  setTimeout(() => {
    const valueInput = document.querySelector(`input.value-input[data-filter-id="${props.filter.id}"]`)
    if (valueInput) {
      valueInput.focus()
    }
  }, 100)
}

// Clear segment
const clearSegment = (segment) => {
  let updatedFilter = { ...props.filter }
  
  if (segment === 'model') {
    updatedFilter = {
      ...updatedFilter,
      model: '',
      property: '',
      operator: '',
      value: '',
      modelProperties: []
    }
    emit('update-filter', props.index, updatedFilter)
  } else if (segment === 'property') {
    updatedFilter = {
      ...updatedFilter,
      property: '',
      operator: '',
      value: ''
    }
    emit('update-filter', props.index, updatedFilter)
  } else if (segment === 'operator') {
    updatedFilter = {
      ...updatedFilter,
      operator: '',
      value: ''
    }
    emit('update-filter', props.index, updatedFilter)
  } else if (segment === 'value') {
    updatedFilter = {
      ...updatedFilter,
      value: ''
    }
    emit('update-filter', props.index, updatedFilter)
  }
}

// Handle value input
const onValueInput = (event) => {
  const updatedFilter = {
    ...props.filter,
    value: event.target.value
  }
  emit('update-filter', props.index, updatedFilter)
}

// Get placeholder text for value input
const getValuePlaceholder = () => {
  const property = props.filter.modelProperties?.find(p => p.name === props.filter.property)
  const propertyType = property?.type || 'string'
  const operator = props.filter.operator
  
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

// Handle keyboard navigation
const onKeydown = (event, type) => {
  if (event.key === 'Escape') {
    activePopover.value = null
    modelSearchTerm.value = ''
    propertySearchTerm.value = ''
    operatorSearchTerm.value = ''
    event.preventDefault()
  }
  
  if (event.key === 'Enter') {
    if (type === 'model' && filteredModels.value.length > 0) {
      selectModel(filteredModels.value[0])
    } else if (type === 'property' && filteredProperties.value.length > 0) {
      selectProperty(filteredProperties.value[0])
    } else if (type === 'operator' && getFilteredOperators().length > 0) {
      selectOperator(getFilteredOperators()[0])
    }
    event.preventDefault()
  }
}
</script>

<template>
  <div class="multi-model-filter">
    <div class="filter-content">
      <div class="filter-wrap">
        <IconFilterFilled
          class="filter-icon"
          :height="16"
          :width="16"
        />
        
        <div class="filter-criteria-wrap">
          <!-- Model segment -->
          <div 
            v-if="!filter.model"
            class="filter-segment"
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
            v-else
            class="filter-segment selected"
            @click="activePopover = `model-${filter.id}`"
          >
            <span class="segment-label">{{ currentModelName }}</span>
            <IconRemove
              class="segment-clear"
              :height="10"
              :width="10"
              @click.stop="clearSegment('model')"
            />
          </div>
          
          <!-- Property segment (optional) -->
          <template v-if="filter.model">
            <div 
              v-if="!filter.property"
              class="filter-segment optional-segment"
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
                    v-model="propertySearchTerm"
                    type="text"
                    class="segment-input"
                    placeholder="Property (optional)..."
                    @focus="activePopover = `property-${filter.id}`"
                    @click.stop="activePopover = `property-${filter.id}`"
                    @keydown="onKeydown($event, 'property')"
                  />
                </template>
                <div class="popover-content">
                  <div class="popover-list">
                    <div
                      v-for="prop in filteredProperties"
                      :key="prop.name"
                      class="popover-item"
                      @click="selectProperty(prop)"
                    >
                      <span class="item-label">{{ prop.display_name }}</span>
                      <span class="item-type">{{ prop.type }}</span>
                    </div>
                    <div 
                      v-if="propertySearchTerm && !filteredProperties.length"
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
              <span class="segment-label">{{ currentPropertyName }}</span>
              <IconRemove
                class="segment-clear"
                :height="10"
                :width="10"
                @click.stop="clearSegment('property')"
              />
            </div>
          </template>
          
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
                    placeholder="Select operator..."
                    @focus="activePopover = `operator-${filter.id}`"
                    @click.stop="activePopover = `operator-${filter.id}`"
                    @keydown="onKeydown($event, 'operator')"
                  />
                </template>
                <div class="popover-content">
                  <div class="popover-list">
                    <div
                      v-for="op in getFilteredOperators()"
                      :key="op.value"
                      class="popover-item"
                      @click="selectOperator(op)"
                    >
                      {{ op.label }}
                    </div>
                    <div 
                      v-if="operatorSearchTerm && !getFilteredOperators().length"
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
              <span class="segment-label">{{ currentOperatorName }}</span>
              <IconRemove
                class="segment-clear"
                :height="10"
                :width="10"
                @click.stop="clearSegment('operator')"
              />
            </div>
          </template>
          
          <!-- Value segment -->
          <template v-if="filter.operator">
            <div class="filter-segment value-segment">
              <input
                :value="filter.value"
                type="text"
                class="segment-input value-input"
                :data-filter-id="filter.id"
                :placeholder="getValuePlaceholder()"
                @input="onValueInput"
              />
              <IconRemove
                v-if="filter.value"
                class="segment-clear"
                :height="10"
                :width="10"
                @click.stop="clearSegment('value')"
              />
            </div>
          </template>
        </div>
      </div>
      
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
// Import styles directly from RecordFilterStyled
@use '@/styles/theme' as theme;

.multi-model-filter {
  margin-bottom: 12px;
  
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
  }
}

:deep(.el-popover) {
  padding: 0 !important;
  border: 1px solid theme.$gray_2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>