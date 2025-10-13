<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElCard, ElButton, ElSelect, ElOption, ElMessage } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'

const router = useRouter()
const metadataStore = useMetadataStore()

// Local state
const selectedRelationshipType = ref('')
const selectedTargetRecord = ref(null) // { id, name, modelId, modelName }
const loading = ref(false)

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

// Computed properties
const isActive = computed(() => !!metadataStore.activeRelationshipCreation)

const activeCreation = computed(() => metadataStore.activeRelationshipCreation)

const sourceModel = computed(() => {
  if (!activeCreation.value) return null
  return metadataStore.modelById(activeCreation.value.sourceModelId)
})

// Check if we're already on the records list page
const isOnRecordsPage = computed(() => {
  const currentRoute = router.currentRoute.value
  return currentRoute.name === 'model-records-search' || 
         currentRoute.path.includes('/records/search')
})

// Methods
const navigateToRecords = () => {
  if (!activeCreation.value) return

  router.push({
    name: 'model-records-search',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: activeCreation.value.datasetId,
      modelId: activeCreation.value.sourceModelId
    }
  })
}

const previewTargetRecord = (targetRecordData) => {
  // Store the selected target record for preview
  selectedTargetRecord.value = targetRecordData
}

const confirmRelationship = async () => {
  if (!selectedRelationshipType.value) {
    ElMessage.error('Please select a relationship type')
    return
  }
  
  if (!selectedTargetRecord.value) {
    ElMessage.error('Please select a target record')
    return
  }

  loading.value = true
  try {
    // Store navigation parameters before they get cleared
    const navigationParams = {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: activeCreation.value.datasetId,
      modelId: activeCreation.value.sourceModelId,
      recordId: activeCreation.value.sourceRecordId
    }

    await metadataStore.completeRelationshipCreation(
      selectedTargetRecord.value.id, 
      selectedRelationshipType.value
    )
    ElMessage.success('Relationship created successfully')
    
    // Navigate back to the source record using stored parameters
    router.push({
      name: 'record-details',
      params: navigationParams
    })
  } catch (error) {
    console.error('Error creating relationship:', error)
    ElMessage.error(`Failed to create relationship: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const clearTargetRecord = () => {
  selectedTargetRecord.value = null
}

const cancelRelationshipCreation = () => {
  const shouldNavigateBack = activeCreation.value !== null
  const sourceRecordId = activeCreation.value?.sourceRecordId
  const sourceModelId = activeCreation.value?.sourceModelId
  const datasetId = activeCreation.value?.datasetId
  
  // Cancel the relationship creation
  metadataStore.cancelRelationshipCreation()
  selectedRelationshipType.value = ''
  selectedTargetRecord.value = null
  
  // Only navigate back if user clicked cancel (not if navigating away)
  // Check if we're still in metadata routes
  if (shouldNavigateBack && router.currentRoute.value.path.includes('/metadata')) {
    router.push({
      name: 'record-details',
      params: {
        orgId: router.currentRoute.value.params.orgId,
        datasetId: datasetId,
        modelId: sourceModelId,
        recordId: sourceRecordId
      }
    })
  }
}

// Event listener for record selection from ListRecords
const handleRecordSelected = (event) => {
  if (isActive.value && event.detail) {
    previewTargetRecord(event.detail)
  }
}

// Expose method for parent components to trigger target selection
const handleTargetSelection = (targetRecordData) => {
  previewTargetRecord(targetRecordData)
}

// Set up event listeners
onMounted(() => {
  window.addEventListener('record-selected', handleRecordSelected)
})

onUnmounted(() => {
  window.removeEventListener('record-selected', handleRecordSelected)
})

defineExpose({
  handleTargetSelection
})
</script>

<template>
  <div v-if="isActive" class="relationship-widget">
    <el-card class="widget-card" shadow="always">
      <template #header>
        <div class="widget-header">
          <h4 class="widget-title">Creating Relationship</h4>
          <el-button 
            @click="cancelRelationshipCreation" 
            size="small"
            type="text"
            class="close-btn"
          >
            ✕
          </el-button>
        </div>
      </template>

      <div class="widget-content">
        <!-- Source Record Info -->
        <div class="source-info">
          <p class="source-text">
            <strong>From:</strong> {{ activeCreation.sourceRecordName }}
          </p>
          <p class="source-model">
            <span class="model-tag">{{ sourceModel?.display_name || sourceModel?.name }}</span>
          </p>
        </div>

        <!-- Relationship Type Selection -->
        <div class="relationship-section">
          <label class="section-label">Relationship Type:</label>
          <el-select
            v-model="selectedRelationshipType"
            placeholder="Select or type relationship type"
            class="relationship-select"
            size="small"
            filterable
            allow-create
            default-first-option
          >
            <el-option
              v-for="type in relationshipTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </div>

        <!-- Target Record Info (when selected) -->
        <div v-if="selectedTargetRecord" class="target-info">
          <label class="section-label">To:</label>
          <div class="target-record-card">
            <div class="target-details">
              <p class="target-text">{{ selectedTargetRecord.name }}</p>
              <p class="target-model">
                <span class="model-tag">{{ selectedTargetRecord.modelName }}</span>
              </p>
            </div>
            <el-button
              @click="clearTargetRecord"
              size="small"
              type="text"
              class="clear-btn"
            >
              ✕
            </el-button>
          </div>
        </div>

        <!-- Instructions -->
        <div v-else class="instructions">
          <p class="instruction-text">
            <span v-if="!isOnRecordsPage">
              Click on "Browse Records" to go to the Records List and select a target record
            </span>
            <span v-else>
              Select a target record from the list below
            </span>
          </p>
        </div>

        <!-- Actions -->
        <div class="widget-actions">
          <el-button
            v-if="!selectedTargetRecord && !isOnRecordsPage"
            @click="navigateToRecords" 
            size="small"
            type="primary"
            :disabled="loading"
          >
            Browse Records
          </el-button>
          <el-button
            v-if="selectedTargetRecord"
            @click="confirmRelationship" 
            size="small"
            type="primary"
            :disabled="loading || !selectedRelationshipType"
            :loading="loading"
          >
            Create Relationship
          </el-button>
          <el-button
            @click="cancelRelationshipCreation" 
            size="small"
            :disabled="loading"
          >
            Cancel
          </el-button>

        </div>
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/button';

.relationship-widget {
  position: fixed;
  top: 110px;
  right: 24px;
  width: 320px;
  z-index: 1000;
  
  .widget-card {
    border: 2px solid theme.$purple_1;
    
    :deep(.el-card__header) {
      background: theme.$purple_tint;
      border-bottom: 1px solid theme.$purple_1;
      padding: 12px 16px;
    }
    
    :deep(.el-card__body) {
      padding: 16px;
    }
  }

  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .widget-title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: theme.$purple_2;
    }

    .close-btn {
      padding: 4px;
      font-size: 14px;
      color: theme.$gray_4;
      
      &:hover {
        color: theme.$gray_6;
      }
    }
  }

  .widget-content {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .source-info {
      .source-text {
        margin: 0 0 4px 0;
        font-size: 13px;
        color: theme.$gray_6;
      }

      .source-model {
        margin: 0;

        .model-tag {
          display: inline-block;
          background: theme.$gray_1;
          color: theme.$gray_5;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
      }
    }

    .relationship-section {
      .section-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: theme.$gray_6;
        margin-bottom: 6px;
      }

      .relationship-select {
        width: 100%;
      }
    }

    .instructions {
      .instruction-text {
        margin: 0;
        font-size: 12px;
        color: theme.$gray_4;
        font-style: italic;
        line-height: 1.4;
      }
    }

    .target-info {
      .section-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: theme.$gray_6;
        margin-bottom: 6px;
      }

      .target-record-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid theme.$gray_2;
        border-radius: 3px;
        padding: 10px;

        .target-details {
          flex: 1;

          .target-text {
            margin: 0 0 4px 0;
            font-size: 13px;
            font-weight: 500;
            color: theme.$gray_6;
          }

          .target-model {
            margin: 0;

            .model-tag {
              display: inline-block;
              background: theme.$purple_tint;
              color: theme.$purple_2;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 500;
            }
          }
        }

        .clear-btn {
          padding: 2px;
          font-size: 12px;
          color: theme.$gray_4;
          
          &:hover {
            color: theme.$gray_6;
          }
        }
      }
    }

    .widget-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      
      // Style the primary button disabled state
      :deep(.el-button--primary) {
        &:disabled,
        &.is-disabled {
          background-color: theme.$gray_2;
          border-color: theme.$gray_2;
          color: theme.$gray_4;
          opacity: 0.6;
          
          &:hover {
            background-color: theme.$gray_2;
            border-color: theme.$gray_2;
            color: theme.$gray_4;
          }
        }
      }
      
      // Ensure other buttons maintain their styling
      :deep(.el-button--default) {
        &:disabled,
        &.is-disabled {
          background-color: theme.$white;
          border-color: theme.$gray_2;
          color: theme.$gray_3;
          opacity: 0.6;
          
          &:hover {
            background-color: theme.$white;
            border-color: theme.$gray_2;
            color: theme.$gray_3;
          }
        }
      }
    }
  }
}

// Animation for entering/leaving
.relationship-widget {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>