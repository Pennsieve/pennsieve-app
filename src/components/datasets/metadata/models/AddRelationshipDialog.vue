<script setup>
import { ref, computed, watch } from 'vue'
import { ElDialog, ElButton, ElInput, ElSelect, ElOption, ElMessage, ElLoading } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  sourceRecordId: {
    type: String,
    required: true
  },
  sourceModelId: {
    type: String,
    required: true
  },
  datasetId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:visible', 'relationship-added'])

const metadataStore = useMetadataStore()

// State
const loading = ref(false)
const selectedModelId = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const selectedRecord = ref(null)
const selectedRelationshipType = ref('')
const isSearching = ref(false)

// Relationship types (common ones - can be expanded)
const relationshipTypes = [
  { value: 'part of', label: 'Part of' },
  { value: 'contains', label: 'Contains' },
  { value: 'related to', label: 'Related to' },
  { value: 'depends on', label: 'Depends on' },
  { value: 'precedes', label: 'Precedes' },
  { value: 'follows', label: 'Follows' },
  { value: 'associated with', label: 'Associated with' }
]

// Computed
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Computed
const availableModels = computed(() => {
  return metadataStore.models.filter(model => model.id !== props.sourceModelId)
})

const canSubmit = computed(() => {
  return selectedRecord.value && selectedRelationshipType.value && !loading.value
})

const selectedModel = computed(() => {
  if (!selectedModelId.value) return null
  return metadataStore.models.find(model => model.id === selectedModelId.value)
})

const canSearch = computed(() => {
  return selectedModelId.value && searchQuery.value && searchQuery.value.length >= 1
})

// Methods
const searchRecords = async () => {
  if (!canSearch.value) {
    searchResults.value = []
    return
  }

  if (!selectedModel.value) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    // Use the existing fetchRecords method with search filters
    const response = await metadataStore.fetchRecords(
      props.datasetId, 
      selectedModel.value.id, 
      {
        limit: 20,
        offset: 0,
        orderBy: 'updatedAt',
        orderDirection: 'desc',
        // Use search query as a filter - this will depend on the model's searchable fields
        filter: searchQuery.value
      }
    )
    
    // Transform results to match our expected format
    searchResults.value = response.records.map(record => ({
      id: record.id,
      model_id: selectedModel.value.id,
      model_name: selectedModel.value.display_name || selectedModel.value.name,
      display_value: getRecordDisplayValue(record),
      created_at: record.created_at,
      record_data: record
    }))
  } catch (error) {
    console.error('Error searching records:', error)
    ElMessage.error('Failed to search records')
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const handleModelChange = () => {
  // Clear previous search when model changes
  searchResults.value = []
  selectedRecord.value = null
  // Trigger search if there's already a query
  if (searchQuery.value && searchQuery.value.length >= 1) {
    searchRecords()
  }
}

// Helper function to get model display name
const getModelDisplayName = (modelId) => {
  const model = metadataStore.modelById(modelId)
  return model?.display_name || model?.name || 'Unknown Model'
}

// Helper function to get readable display value for a record
const getRecordDisplayValue = (record) => {
  if (!record || !record.value) return 'Unknown Record'
  
  const data = record.value
  
  // Try common fields that might be meaningful for display
  const displayFields = ['name', 'title', 'description', 'code', 'outcome', 'manufacturer_name']
  
  for (const field of displayFields) {
    if (data[field] && typeof data[field] === 'string') {
      return data[field]
    }
  }
  
  // Fall back to first string value
  const firstStringValue = Object.values(data).find(val => typeof val === 'string' && val.length > 0)
  if (firstStringValue) return firstStringValue
  
  // Fall back to record ID
  return `Record ${record.id.slice(0, 8)}...`
}

const selectRecord = (record) => {
  selectedRecord.value = record
}

const handleSubmit = async () => {
  if (!canSubmit.value) return

  loading.value = true
  try {
    await metadataStore.createRelationship(
      props.datasetId,
      props.sourceRecordId,
      selectedRecord.value.id,
      selectedRelationshipType.value
    )
    
    ElMessage.success('Relationship created successfully')
    emit('relationship-added')
    closeDialog()
  } catch (error) {
    console.error('Error creating relationship:', error)
    ElMessage.error('Failed to create relationship')
  } finally {
    loading.value = false
  }
}

const closeDialog = () => {
  dialogVisible.value = false
  resetForm()
}

const resetForm = () => {
  selectedModelId.value = null
  searchQuery.value = ''
  searchResults.value = []
  selectedRecord.value = null
  selectedRelationshipType.value = ''
}

// Watch for search query changes
watch(searchQuery, () => {
  searchRecords()
}, { debounce: 300 })

// Reset form when dialog closes
watch(() => props.visible, (visible) => {
  if (!visible) {
    resetForm()
  }
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="Add Relationship"
    width="600px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
  >
    <div class="add-relationship-form">
      <!-- Model Selection Section -->
      <div class="form-section">
        <label class="form-label">Target Model</label>
        <el-select
          v-model="selectedModelId"
          placeholder="Select a model to search within"
          class="model-select"
          @change="handleModelChange"
        >
          <el-option
            v-for="model in availableModels"
            :key="model.id"
            :label="model.display_name || model.name"
            :value="model.id"
          />
        </el-select>
      </div>

      <!-- Search Section -->
      <div class="form-section">
        <label class="form-label">Target Record</label>
        <el-input
          v-model="searchQuery"
          :placeholder="selectedModel ? `Search records in ${selectedModel.display_name || selectedModel.name}...` : 'Select a model first'"
          clearable
          :loading="isSearching"
          :disabled="!selectedModelId"
          class="search-input"
        >
          <template #prefix>
            <i class="el-icon-search" />
          </template>
        </el-input>
        
        <!-- Search Results -->
        <div v-if="searchResults.length > 0" class="search-results">
          <div
            v-for="record in searchResults"
            :key="record.id"
            class="search-result-item"
            :class="{ selected: selectedRecord?.id === record.id }"
            @click="selectRecord(record)"
          >
            <div class="record-info">
              <div class="record-title">{{ record.display_value }}</div>
              <div class="record-meta">
                <span class="model-name">{{ record.model_name }}</span>
                <span class="record-id">ID: {{ record.id.slice(0, 8) }}...</span>
              </div>
            </div>
            <div v-if="selectedRecord?.id === record.id" class="selected-indicator">
              ✓
            </div>
          </div>
        </div>
        
        <div v-else-if="searchQuery && !isSearching" class="no-results">
          No records found matching "{{ searchQuery }}"
        </div>
      </div>

      <!-- Relationship Type Section -->
      <div class="form-section">
        <label class="form-label">Relationship Type</label>
        <el-select
          v-model="selectedRelationshipType"
          placeholder="Select relationship type"
          class="relationship-select"
          :disabled="!selectedRecord"
        >
          <el-option
            v-for="type in relationshipTypes"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </div>

      <!-- Selected Record Preview -->
      <div v-if="selectedRecord" class="selected-record-preview">
        <h4>Creating Relationship:</h4>
        <div class="relationship-preview">
          <div class="source-record">Current Record</div>
          <div class="relationship-arrow">
            → <span v-if="selectedRelationshipType">{{ selectedRelationshipType }}</span> →
          </div>
          <div class="target-record">
            {{ selectedRecord.display_value }} ({{ selectedRecord.model_name }})
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="closeDialog">Cancel</el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit"
          :loading="loading"
          :disabled="!canSubmit"
        >
          Add Relationship
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;

.add-relationship-form {
  .form-section {
    margin-bottom: 24px;

    .form-label {
      display: block;
      font-weight: 500;
      color: theme.$gray_6;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .model-select,
    .search-input {
      width: 100%;
    }
    
    // Fix dropdown text visibility
    .model-select {
      :deep(.el-input__inner) {
        color: theme.$gray_6;
      }
      
      :deep(.el-select-dropdown__item) {
        color: theme.$gray_6 !important;
        
        &:hover {
          background-color: theme.$purple_tint !important;
          color: theme.$gray_6 !important;
        }
        
        &.selected {
          color: theme.$purple_1 !important;
          background-color: theme.$purple_tint !important;
        }
      }
    }

    .search-results {
      margin-top: 12px;
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid theme.$gray_2;
      border-radius: 4px;

      .search-result-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid theme.$gray_2;
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background-color: theme.$gray_1;
        }

        &.selected {
          background-color: theme.$purple_tint;
          border-left: 3px solid theme.$purple_1;
        }

        .record-info {
          flex: 1;

          .record-title {
            font-weight: 500;
            color: theme.$gray_6;
            margin-bottom: 4px;
          }

          .record-meta {
            display: flex;
            gap: 12px;
            font-size: 12px;
            color: theme.$gray_4;

            .model-name {
              background: theme.$gray_1;
              padding: 2px 6px;
              border-radius: 3px;
              font-weight: 500;
            }
          }
        }

        .selected-indicator {
          color: theme.$purple_1;
          font-weight: bold;
          font-size: 16px;
        }
      }
    }

    .no-results {
      text-align: center;
      padding: 20px;
      color: theme.$gray_4;
      font-style: italic;
    }

    .relationship-select {
      width: 100%;
      
      :deep(.el-input__inner) {
        color: theme.$gray_6;
      }
      
      :deep(.el-select-dropdown__item) {
        color: theme.$gray_6 !important;
        
        &:hover {
          background-color: theme.$purple_tint !important;
          color: theme.$gray_6 !important;
        }
        
        &.selected {
          color: theme.$purple_1 !important;
          background-color: theme.$purple_tint !important;
        }
      }
    }
  }

  .selected-record-preview {
    background: theme.$gray_1;
    padding: 16px;
    border-radius: 6px;
    border-left: 3px solid theme.$purple_1;

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: theme.$gray_6;
    }

    .relationship-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;

      .source-record,
      .target-record {
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid theme.$gray_2;
        font-weight: 500;
      }

      .relationship-arrow {
        color: theme.$purple_1;
        font-weight: 500;
        white-space: nowrap;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

<style lang="scss">
// Global styles for Element Plus dropdown - not scoped to ensure they work with teleported elements
@use '../../../../styles/theme' as theme;

.el-select-dropdown {
  .el-select-dropdown__item {
    color: theme.$gray_6 !important;
    
    &:hover {
      background-color: theme.$purple_tint !important;
      color: theme.$gray_6 !important;
    }
    
    &.selected {
      color: theme.$purple_1 !important;
      background-color: theme.$purple_tint !important;
    }
  }
}
</style>