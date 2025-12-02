<template>
  <div class="record-header">
    <div class="record-info">
      <div class="title-row">
        <div class="title-section">
          <h2>{{ model?.display_name || model?.name || 'Record' }} Record</h2>
          <el-tag 
            v-if="previewTimestamp" 
            size="small" 
            type="warning"
            class="preview-tag"
            @click="$emit('clear-preview')"
          >
            Preview: {{ formatTimestamp(previewTimestamp) }}
          </el-tag>
        </div>
        <div class="title-controls">
          <ViewToggle :viewMode="viewMode" @update:viewMode="$emit('update:view-mode', $event)" size="small" />
        </div>
      </div>
      
      <!-- Record Metadata (hidden in JSON mode) -->
      <div v-if="viewMode === 'ui'" class="record-metadata">
        <div class="metadata-item">
          <span class="metadata-label">Record ID:</span>
          <div class="metadata-value-container">
            <span class="metadata-value">{{ record?.id }}</span>
            <el-button
              @click="copyRecordId"
              link
              size="small"
              class="metadata-action-btn"
              title="Copy Record ID"
            >
              <IconCopyDocument :width="12" :height="12" />
            </el-button>
          </div>
        </div>

        <div class="metadata-item">
          <span class="metadata-label">Model ID:</span>
          <div class="metadata-value-container">
            <span class="metadata-value">{{ modelId }}</span>
            <el-button
              @click="copyModelId"
              link
              size="small"
              class="metadata-action-btn"
              title="Copy Model ID"
            >
              <IconCopyDocument :width="12" :height="12" />
            </el-button>
          </div>
        </div>

        <div class="metadata-item">
          <span class="metadata-label">Model Version:</span>
          <div class="metadata-value-container">
            <span class="metadata-value">{{ recordMetadata?.model_version }}</span>
            <el-button
              @click="$emit('go-to-model')"
              link
              size="small"
              class="metadata-action-btn"
              title="Go to Model Details"
            >
              <IconArrowRight :width="12" :height="12" />
            </el-button>
          </div>
        </div>

        <div class="metadata-item">
          <span class="metadata-label">Created At:</span>
          <span class="metadata-value">{{ formatTimestamp(recordMetadata?.created_at) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElTag, ElButton, ElMessage } from 'element-plus'
import ViewToggle from '@/components/shared/ViewToggle/ViewToggle.vue'
import IconCopyDocument from '@/components/icons/IconCopyDocument.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'

const props = defineProps({
  record: {
    type: Object,
    default: null
  },
  model: {
    type: Object,
    default: null
  },
  modelId: {
    type: String,
    required: true
  },
  previewTimestamp: {
    type: String,
    default: null
  },
  viewMode: {
    type: String,
    default: 'ui',
    validator: (value) => ['ui', 'json'].includes(value)
  }
})

const emit = defineEmits([
  'clear-preview',
  'update:view-mode',
  'go-to-model'
])

// Computed properties
const recordMetadata = computed(() => {
  if (!props.record) return null
  
  return {
    id: props.record.id,
    created_at: props.record.created_at,
    updated_at: props.record.updated_at,
    model_version: props.record.model_version,
    created_by: props.record.created_by,
    updated_by: props.record.updated_by
  }
})

// Format timestamp for display
const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A'
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return timestamp
  }
}

// Copy Record ID to clipboard
const copyRecordId = async () => {
  if (!props.record?.id) return
  
  try {
    await navigator.clipboard.writeText(props.record.id)
    ElMessage.success('Record ID copied to clipboard')
  } catch (error) {
    console.error('Failed to copy record ID:', error)
    ElMessage.error('Failed to copy record ID to clipboard')
  }
}

// Copy Model ID to clipboard
const copyModelId = async () => {
  try {
    await navigator.clipboard.writeText(props.modelId)
    ElMessage.success('Model ID copied to clipboard')
  } catch (error) {
    console.error('Failed to copy model ID:', error)
    ElMessage.error('Failed to copy model ID to clipboard')
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';

.record-header {
  margin-bottom: 8px;

  .record-info {
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 8px 0 12px 0;
      
      .title-section {
        display: flex;
        align-items: center;
        gap: 12px;
        
        h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: theme.$gray_6;
        }
        
        .preview-tag {
          cursor: pointer;
          font-size: 11px;
          padding: 4px 8px;
          
          &:hover {
            opacity: 0.8;
          }
        }
      }
    }

    // Record Metadata Section (minimal styling)
    .record-metadata {
      border-bottom: 1px solid theme.$gray_2;
      padding-bottom: 12px;
      margin-bottom: 16px;

      .metadata-item {
        display: inline-block;
        margin-right: 24px;
        margin-bottom: 6px;
        font-size: 12px;
        color: theme.$gray_4;

        .metadata-label {
          font-weight: 500;
          margin-right: 6px;
        }

        .metadata-value-container {
          display: inline-flex;
          align-items: center;
          gap: 4px;

          .metadata-value {
            color: theme.$gray_5;
            font-size: 12px;
          }

          .metadata-action-btn {
            opacity: 0.5;
            transition: all 0.2s ease;
            padding: 1px !important;
            min-height: unset !important;
            height: 14px !important;
            width: 14px !important;
            
            :deep(.el-button__icon) {
              margin: 0 !important;
            }
            
            &:hover {
              opacity: 0.8;
              color: theme.$gray_5 !important;
            }
          }
        }

        // For metadata items without actions (like Created At)
        .metadata-value:not(.metadata-value-container .metadata-value) {
          color: theme.$gray_5;
          font-size: 12px;
        }
      }
    }
  }
}
</style>