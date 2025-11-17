<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElCard, ElButton, ElMessage } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'

const router = useRouter()
const metadataStore = useMetadataStore()

// Local state
const selectedRecord = ref(null) // { id, name, modelId, modelName }
const loading = ref(false)

// Computed properties
const isActive = computed(() => !!metadataStore.activeRecordAttachment)

const activeAttachment = computed(() => metadataStore.activeRecordAttachment)

// Check if we're already on the records search page
const isOnRecordsPage = computed(() => {
  const currentRoute = router.currentRoute.value
  return currentRoute.name === 'model-records-search' || 
         currentRoute.name === 'records-list' ||
         currentRoute.path.includes('/records')
})

// Methods
const navigateToRecords = () => {
  if (!activeAttachment.value) return

  // Navigate to records list which will auto-redirect to first model
  router.push({
    name: 'records-list',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: activeAttachment.value.datasetId
    }
  })
}

const previewSelectedRecord = (recordData) => {
  // Store the selected record for preview
  selectedRecord.value = recordData
}

const confirmAttachment = async () => {
  if (!selectedRecord.value || !activeAttachment.value) {
    return
  }

  // Store attachment info before it gets cleared
  const attachmentInfo = {
    datasetId: activeAttachment.value.datasetId,
    packageId: activeAttachment.value.packageId
  }

  loading.value = true
  try {
    await metadataStore.completeRecordAttachment(selectedRecord.value.id)
    ElMessage.success('Record attached to file successfully')
    
    // Clear selected record after successful attachment
    selectedRecord.value = null
    
    // Navigate back to the specific file details page
    router.push({
      name: 'file-record',
      params: {
        orgId: router.currentRoute.value.params.orgId,
        datasetId: attachmentInfo.datasetId,
        fileId: attachmentInfo.packageId
      }
    })
  } catch (error) {
    console.error('Error attaching record to package:', error)
    ElMessage.error(`Failed to attach record: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const clearSelectedRecord = () => {
  selectedRecord.value = null
}

const cancelRecordAttachment = () => {
  const shouldNavigateBack = activeAttachment.value !== null
  const packageId = activeAttachment.value?.packageId
  const datasetId = activeAttachment.value?.datasetId
  
  // Cancel the record attachment
  metadataStore.cancelRecordAttachment()
  selectedRecord.value = null
  
  // Only navigate back if user clicked cancel (not if navigating away)
  // Check if we're still in metadata/files routes
  if (shouldNavigateBack && router.currentRoute.value.path.includes('/datasets')) {
    router.push({
      name: 'file-record',
      params: {
        orgId: router.currentRoute.value.params.orgId,
        datasetId: datasetId,
        fileId: packageId
      }
    })
  }
}

// Event listener for record selection from records list
const handleRecordSelected = (event) => {
  if (isActive.value && event.detail) {
    previewSelectedRecord(event.detail)
  }
}

// Watch for new attachment processes and clear selected records
watch(activeAttachment, (newValue, oldValue) => {
  // Clear selected record when a new attachment process starts
  if (newValue && (!oldValue || newValue.packageId !== oldValue?.packageId)) {
    selectedRecord.value = null
  }
}, { immediate: true })

// Set up event listeners
onMounted(() => {
  window.addEventListener('record-selected', handleRecordSelected)
})

onUnmounted(() => {
  window.removeEventListener('record-selected', handleRecordSelected)
})

// Expose method for parent components to trigger record selection
const handleRecordSelection = (recordData) => {
  previewSelectedRecord(recordData)
}

defineExpose({
  handleRecordSelection
})
</script>

<template>
  <div v-if="isActive" class="record-attachment-widget">
    <el-card class="widget-card" shadow="always">
      <template #header>
        <div class="widget-header">
          <h4 class="widget-title">Attach Record to File</h4>
          <el-button 
            @click="cancelRecordAttachment" 
            size="small"
            type="text"
            class="close-btn"
          >
            ✕
          </el-button>
        </div>
      </template>

      <div class="widget-content">
        <!-- Source Package Info -->
        <div class="source-info">
          <p class="source-text">
            <strong>File:</strong> {{ activeAttachment.packageName }}
          </p>
        </div>

        <!-- Selected Record Info (when selected) -->
        <div v-if="selectedRecord" class="record-info">
          <label class="section-label">Selected Record:</label>
          <div class="record-card">
            <div class="record-details">
              <p class="record-text">{{ selectedRecord.name || selectedRecord.id }}</p>
              <p class="record-meta">
                <span class="model-type-tag">{{ selectedRecord.modelName || 'Record' }}</span>
                <span v-if="selectedRecord.id" class="record-id">{{ selectedRecord.id.substring(0, 8) }}...</span>
              </p>
            </div>
            <el-button
              @click="clearSelectedRecord"
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
              Click on "Browse Records" to go to the Metadata page and select a record
            </span>
            <span v-else>
              Select a record from the list to attach to this file
            </span>
          </p>
        </div>

        <!-- Actions -->
        <div class="widget-actions">
          <el-button
            v-if="!selectedRecord && !isOnRecordsPage"
            @click="navigateToRecords" 
            size="small"
            type="primary"
            :disabled="loading"
          >
            Browse Records
          </el-button>
          <el-button
            v-if="selectedRecord"
            @click="confirmAttachment" 
            size="small"
            type="primary"
            :disabled="loading"
            :loading="loading"
          >
            Attach Record
          </el-button>
          <el-button
            @click="cancelRecordAttachment" 
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

.record-attachment-widget {
  position: fixed;
  top: 110px;
  right: 24px;
  width: 320px;
  z-index: 1000;
  
  .widget-card {
    border: 2px solid theme.$teal_1;
    
    :deep(.el-card__header) {
      background: theme.$teal_tint;
      border-bottom: 1px solid theme.$teal_1;
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
      color: theme.$teal_2;
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

      .source-package {
        margin: 0;

        .package-tag {
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

    .record-info {
      .section-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: theme.$gray_6;
        margin-bottom: 6px;
      }

      .record-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid theme.$gray_2;
        border-radius: 3px;
        padding: 10px;

        .record-details {
          flex: 1;

          .record-text {
            margin: 0 0 4px 0;
            font-size: 13px;
            font-weight: 500;
            color: theme.$gray_6;
          }

          .record-meta {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;

            .model-type-tag {
              display: inline-block;
              background: theme.$teal_tint;
              color: theme.$teal_2;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 500;
            }

            .record-id {
              font-size: 10px;
              color: theme.$gray_4;
              font-style: italic;
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

    .instructions {
      .instruction-text {
        margin: 0;
        font-size: 12px;
        color: theme.$gray_4;
        font-style: italic;
        line-height: 1.4;
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
.record-attachment-widget {
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