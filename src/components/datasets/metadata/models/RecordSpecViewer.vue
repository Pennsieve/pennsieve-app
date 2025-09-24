<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElCard, ElTag, ElTooltip, ElMessage, ElButton } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'

// Import components
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import ViewToggle from '@/components/shared/ViewToggle/ViewToggle.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconCopyDocument from '@/components/icons/IconCopyDocument.vue'

const props = defineProps({
  datasetId: {
    type: String,
    required: true
  },
  modelId: {
    type: String,
    required: true
  },
  recordId: {
    type: String,
    required: true
  }
})

const metadataStore = useMetadataStore()
const router = useRouter()

// Reactive data
const record = ref(null)
const model = ref(null)
const loading = ref(false)
const error = ref('')
const viewMode = ref('ui') // 'ui' or 'json'

// Computed properties
const recordData = computed(() => {
  if (!record.value) return null
  return record.value.value || {}
})

const modelSchema = computed(() => {
  if (!model.value?.latest_version?.schema) return null
  return model.value.latest_version.schema
})

const recordProperties = computed(() => {
  if (!modelSchema.value?.properties || !recordData.value) return []
  
  return Object.entries(modelSchema.value.properties).map(([key, property]) => ({
    key,
    label: property.title || key,
    type: property.type,
    format: property.format,
    description: property.description,
    value: recordData.value[key],
    property: property
  }))
})

const recordMetadata = computed(() => {
  if (!record.value) return null
  
  return {
    id: record.value.id,
    created_at: record.value.created_at,
    updated_at: record.value.updated_at,
    model_version: record.value.model_version,
    created_by: record.value.created_by,
    updated_by: record.value.updated_by
  }
})

// Methods
const fetchRecord = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await metadataStore.fetchRecord(props.datasetId, props.modelId, props.recordId)
    record.value = response
  } catch (err) {
    console.error('Error fetching record:', err)
    error.value = err.message || 'Failed to load record'
  } finally {
    loading.value = false
  }
}

const fetchModel = async () => {
  try {
    await metadataStore.fetchModels(props.datasetId)
    model.value = metadataStore.modelById(props.modelId)
  } catch (err) {
    console.error('Error fetching model:', err)
    error.value = err.message || 'Failed to load model information'
  }
}

const goBackToRecords = () => {
  router.push({
    name: 'model-records',
    params: {
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  })
}


const formatPropertyValue = (value, property) => {
  if (value === null || value === undefined) {
    return { display: 'N/A', isNull: true }
  }
  
  // Handle different property types
  if (property.type === 'boolean') {
    return { display: value ? 'Yes' : 'No', isNull: false }
  }
  
  if (property.type === 'number' || property.type === 'integer') {
    return { display: Number(value).toLocaleString(), isNull: false }
  }
  
  if (property.format === 'date') {
    try {
      return { display: new Date(value).toLocaleDateString(), isNull: false }
    } catch {
      return { display: String(value), isNull: false }
    }
  }
  
  if (property.format === 'date-time') {
    try {
      return { display: new Date(value).toLocaleString(), isNull: false }
    } catch {
      return { display: String(value), isNull: false }
    }
  }
  
  if (Array.isArray(value)) {
    return { display: value.join(', '), isNull: false }
  }
  
  if (typeof value === 'object') {
    return { display: JSON.stringify(value, null, 2), isNull: false }
  }
  
  return { display: String(value), isNull: false }
}

const getPropertyTypeDisplay = (property) => {
  let type = property.type || 'string'
  if (property.format) {
    type += ` (${property.format})`
  }
  return type
}

// Copy Record ID to clipboard
const copyRecordId = async () => {
  try {
    await navigator.clipboard.writeText(record.value.id)
    ElMessage.success('Record ID copied to clipboard')
  } catch (error) {
    console.error('Failed to copy record ID:', error)
    ElMessage.error('Failed to copy record ID to clipboard')
  }
}

const goToModelDetails = () => {
  router.push({
    name: 'model-details',
    params: {
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  })
}

// Initialize
onMounted(async () => {
  await Promise.all([fetchModel(), fetchRecord()])
})
</script>

<template>
  <bf-stage class="record-spec-viewer" no-padding>
    <template #actions>
      <stage-actions>
        <template #left>
<!--          <bf-button @click="goBackToRecords" size="small">-->
<!--            <template #prefix>-->
<!--              <IconArrowLeft class="mr-8" :height="16" :width="16" />-->
<!--            </template>-->
<!--            Back to Records-->
<!--          </bf-button>-->
        </template>
      </stage-actions>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state" v-loading="true">
      <p>Loading record...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <el-card shadow="never">
        <div class="error-content">
          <h3>Error Loading Record</h3>
          <p>{{ error }}</p>
          <bf-button @click="goBackToRecords" type="primary">
            Back to Records
          </bf-button>
        </div>
      </el-card>
    </div>

    <!-- Record Content -->
    <div v-else-if="record && model" class="record-content">
      <!-- Record Header -->
      <div class="record-header">
        <div class="record-info">
          <h2>{{ model.display_name || model.name }} Record</h2>
          <div class="record-meta">
            <el-tag type="info" size="small" class="record-id-tag">
              Record ID: {{ record.id }}
              <el-button 
                @click="copyRecordId" 
                type="text" 
                size="small" 
                class="copy-btn" 
                title="Copy Record ID"
              >
                <IconCopyDocument :width="12" :height="12" />
              </el-button>
            </el-tag>
            <el-tag type="success" size="small" class="version-tag">
              Version {{ recordMetadata.model_version }}
              <el-button 
                @click="goToModelDetails" 
                type="text" 
                size="small" 
                class="copy-btn" 
                title="Go to Model Details"
              >
                <IconArrowRight :width="12" :height="12" />
              </el-button>
            </el-tag>
            <el-tag size="small">Created {{ new Date(recordMetadata.created_at).toLocaleDateString() }}</el-tag>
          </div>
        </div>
      </div>

      <!-- View Mode Toggle -->
      <div class="view-controls">
        <ViewToggle v-model:viewMode="viewMode" size="small" />
      </div>

      <!-- Enhanced View -->
      <div v-if="viewMode === 'ui'" class="enhanced-view">
        <!-- Record Properties -->
        <div class="section">
          <div class="section-header">
            <h3>Record Data</h3>
            <el-tag type="info" size="small">
              {{ recordProperties.length }} properties
            </el-tag>
          </div>

          <div class="record-attributes">
            <div
              v-for="prop in recordProperties"
              :key="prop.key"
              class="attribute-item"
            >
              <span class="attribute-name">{{ prop.label }}:</span>
              <span class="attribute-value" :class="{ 'is-null': formatPropertyValue(prop.value, prop.property).isNull }">
                {{ formatPropertyValue(prop.value, prop.property).display }}
              </span>
            </div>
          </div>
        </div>

      </div>

      <!-- JSON View -->
      <div v-if="viewMode === 'json'" class="json-view">
        <el-card shadow="never" class="json-card">
          <template #header>
            <h3>Raw Record Data</h3>
          </template>
          
          <pre class="json-content">{{ JSON.stringify(record, null, 2) }}</pre>
        </el-card>
      </div>
    </div>
  </bf-stage>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/tag';
@use '../../../../styles/element/button';


.record-spec-viewer {
  .loading-state,
  .error-state {
    padding: 48px 24px;
    text-align: center;

    p {
      margin: 0;
      color: theme.$gray_5;
      font-size: 16px;
    }

    h3 {
      margin: 0 0 16px 0;
      color: theme.$gray_6;
      font-size: 20px;
      font-weight: 500;
    }
  }

  .error-state {
    .error-content {
      padding: 24px;
      
      p {
        color: theme.$red_2;
        margin-bottom: 24px;
      }
    }
  }

  .record-content {
    padding: 24px;

    .record-header {
      margin-bottom: 24px;

      .record-info {
        h2 {
          margin: 0 0 12px 0;
          font-size: 24px;
          font-weight: 600;
          color: theme.$gray_6;
        }

        .record-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          
          .record-id-tag,
          .version-tag {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            
            .copy-btn {
              opacity: 0.7;
              transition: all 0.2s ease;
              padding: 2px !important;
              min-height: unset !important;
              height: 16px !important;
              width: 16px !important;
              color: theme.$green_1 !important;
              margin-left: 4px;
              
              :deep(.el-button__icon) {
                margin: 0 !important;
              }
              
              &:hover {
                opacity: 1;
                color: theme.$purple_2 !important;
              }
            }
          }
          
          .version-tag {
            background-color: theme.$green_tint !important;
            border-color: theme.$green_tint !important;
            color: theme.$green_1 !important;
            
            .copy-btn {
              color: theme.$green_1 !important;
              
              &:hover {
                color: theme.$green_2 !important;
              }
            }
          }
        }
      }
    }

    .view-controls {
      margin-bottom: 20px;
      display: flex;
      justify-content: flex-end;
    }

    .enhanced-view {
      display: flex;
      flex-direction: column;
      gap: 32px;

      .section {
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid theme.$gray_2;

          h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 500;
            color: theme.$gray_6;
          }
        }

        .record-attributes {
          .attribute-item {
            display: flex;
            margin-bottom: 16px;
            
            &:last-child {
              margin-bottom: 0;
            }

            .attribute-name {
              font-weight: 600;
              color: theme.$gray_6;
              margin-right: 8px;
              min-width: 150px;
            }

            .attribute-value {
              color: theme.$gray_6;
              
              &.is-null {
                color: theme.$gray_4;
                font-style: italic;
              }
            }
          }
        }

        // Minimal metadata section
        &:last-child {
          margin-top: 8px;
          
          .section-header {
            margin-bottom: 12px;
            padding-bottom: 4px;
            border-bottom: 1px solid theme.$gray_1;

            h3 {
              font-size: 14px;
              font-weight: 500;
              color: theme.$gray_5;
            }
          }
        }

        .metadata-list {
          .metadata-item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 13px;

            &:last-child {
              border-bottom: none;
            }

            .metadata-label {
              font-weight: 400;
              color: theme.$gray_4;
            }

            .metadata-value {
              color: theme.$gray_5;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 12px;
            }
          }
        }
      }
    }

    .json-view {
      .json-card {
        border: 1px solid theme.$gray_2;

        :deep(.el-card__header) {
          background: theme.$gray_1;
          border-bottom: 1px solid theme.$gray_2;
          padding: 16px 24px;

          h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: theme.$gray_6;
          }
        }

        :deep(.el-card__body) {
          padding: 0;
        }

        .json-content {
          padding: 24px;
          margin: 0;
          background: theme.$gray_1;
          color: theme.$gray_6;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          line-height: 1.5;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
      }
    }
  }
}
</style>