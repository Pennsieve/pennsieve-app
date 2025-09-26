<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElCard, ElButton, ElMessage } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'

const router = useRouter()
const metadataStore = useMetadataStore()

// Local state
const selectedPackage = ref(null) // { id, name, type, path }
const loading = ref(false)

// Computed properties
const isActive = computed(() => !!metadataStore.activePackageAttachment)

const activeAttachment = computed(() => metadataStore.activePackageAttachment)

const sourceModel = computed(() => {
  if (!activeAttachment.value) return null
  return metadataStore.modelById(activeAttachment.value.modelId)
})

// Check if we're already on the files page
const isOnFilesPage = computed(() => {
  const currentRoute = router.currentRoute.value
  return currentRoute.name === 'dataset-files' || 
         currentRoute.path.includes('/files')
})

// Methods
const navigateToFiles = () => {
  if (!activeAttachment.value) return

  router.push({
    name: 'dataset-files',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: activeAttachment.value.datasetId
    }
  })
}

const previewSelectedPackage = (packageData) => {
  // Store the selected package for preview
  selectedPackage.value = packageData
}

const confirmAttachment = async () => {
  if (!selectedPackage.value) {
    return
  }

  loading.value = true
  try {
    await metadataStore.completePackageAttachment(selectedPackage.value.id)
    ElMessage.success('File attached to record successfully')
    
    // Navigate back to the source record
    router.push({
      name: 'record-details',
      params: {
        orgId: router.currentRoute.value.params.orgId,
        datasetId: activeAttachment.value.datasetId,
        modelId: activeAttachment.value.modelId,
        recordId: activeAttachment.value.recordId
      }
    })
  } catch (error) {
    console.error('Error attaching package to record:', error)
    ElMessage.error(`Failed to attach file: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const clearSelectedPackage = () => {
  selectedPackage.value = null
}

const cancelPackageAttachment = () => {
  const shouldNavigateBack = activeAttachment.value !== null
  const recordId = activeAttachment.value?.recordId
  const modelId = activeAttachment.value?.modelId
  const datasetId = activeAttachment.value?.datasetId
  
  // Cancel the package attachment
  metadataStore.cancelPackageAttachment()
  selectedPackage.value = null
  
  // Only navigate back if user clicked cancel (not if navigating away)
  // Check if we're still in metadata routes
  if (shouldNavigateBack && router.currentRoute.value.path.includes('/metadata')) {
    router.push({
      name: 'record-details',
      params: {
        orgId: router.currentRoute.value.params.orgId,
        datasetId: datasetId,
        modelId: modelId,
        recordId: recordId
      }
    })
  }
}

// Event listener for package selection from BfDatasetFiles
const handlePackageSelected = (event) => {
  if (isActive.value && event.detail) {
    previewSelectedPackage(event.detail)
  }
}

// Set up event listeners
onMounted(() => {
  window.addEventListener('package-selected', handlePackageSelected)
})

onUnmounted(() => {
  window.removeEventListener('package-selected', handlePackageSelected)
})

// Expose method for parent components to trigger package selection
const handlePackageSelection = (packageData) => {
  previewSelectedPackage(packageData)
}

defineExpose({
  handlePackageSelection
})
</script>

<template>
  <div v-if="isActive" class="package-attachment-widget">
    <el-card class="widget-card" shadow="always">
      <template #header>
        <div class="widget-header">
          <h4 class="widget-title">Attach File to Record</h4>
          <el-button 
            @click="cancelPackageAttachment" 
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
            <strong>Record:</strong> {{ activeAttachment.recordName }}
          </p>
          <p class="source-model">
            <span class="model-tag">{{ sourceModel?.display_name || sourceModel?.name }}</span>
          </p>
        </div>

        <!-- Selected Package Info (when selected) -->
        <div v-if="selectedPackage" class="package-info">
          <label class="section-label">Selected File:</label>
          <div class="package-card">
            <div class="package-details">
              <p class="package-text">{{ selectedPackage.name }}</p>
              <p class="package-meta">
                <span class="package-type-tag">{{ selectedPackage.type || 'File' }}</span>
                <span v-if="selectedPackage.path" class="package-path">{{ selectedPackage.path }}</span>
              </p>
            </div>
            <el-button
              @click="clearSelectedPackage"
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
            <span v-if="!isOnFilesPage">
              Click on "Browse Files" to go to the Files page and select a file or folder
            </span>
            <span v-else>
              Select a file or folder from the list below
            </span>
          </p>
        </div>

        <!-- Actions -->
        <div class="widget-actions">
          <el-button
            v-if="!selectedPackage && !isOnFilesPage"
            @click="navigateToFiles" 
            size="small"
            type="primary"
            :disabled="loading"
          >
            Browse Files
          </el-button>
          <el-button
            v-if="selectedPackage"
            @click="confirmAttachment" 
            size="small"
            type="primary"
            :disabled="loading"
            :loading="loading"
          >
            Attach File
          </el-button>
          <el-button
            @click="cancelPackageAttachment" 
            size="small"
            :disabled="loading"
          >
            Cancel
          </el-button>
          <el-button
            v-if="selectedPackage"
            @click="clearSelectedPackage" 
            size="small"
            :disabled="loading"
          >
            Change File
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/button';

.package-attachment-widget {
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

    .package-info {
      .section-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: theme.$gray_6;
        margin-bottom: 6px;
      }

      .package-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid theme.$gray_2;
        border-radius: 3px;
        padding: 10px;

        .package-details {
          flex: 1;

          .package-text {
            margin: 0 0 4px 0;
            font-size: 13px;
            font-weight: 500;
            color: theme.$gray_6;
          }

          .package-meta {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;

            .package-type-tag {
              display: inline-block;
              background: theme.$green_tint;
              color: theme.$teal_2;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 500;
            }

            .package-path {
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
.package-attachment-widget {
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