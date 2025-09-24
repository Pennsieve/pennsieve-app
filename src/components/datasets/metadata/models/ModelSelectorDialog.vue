<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      :show-close="false"
      class="model-selector-dialog"
      width="600px"
    >
      <template #header>
        <bf-dialog-header title="Select Model" />
      </template>

      <dialog-body>
        <div class="dialog-content">
          <!-- Search Section -->
          <div class="search-section">
            <el-input
              v-model="searchQuery"
              placeholder="Search models by name or description..."
              size="default"
              class="model-search"
              clearable
            >
              <template #prefix>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
              </template>
            </el-input>
          </div>

          <!-- Models List Section -->
          <div class="models-section">
            <div v-if="loading" class="loading-state">
              <p>Loading models...</p>
            </div>
            
            <div v-else-if="filteredModels.length === 0" class="empty-state">
              <p v-if="searchQuery">No models match your search criteria.</p>
              <p v-else>No models available.</p>
            </div>
            
            <div v-else class="models-list">
              <div 
                v-for="modelOption in filteredModels"
                :key="modelOption.value"
                class="model-item"
                :class="{ active: modelOption.value === currentModelId }"
                @click="selectModel(modelOption.value)"
              >
                <div class="model-info">
                  <h4 class="model-name">{{ modelOption.label }}</h4>
                  <p v-if="modelOption.description" class="model-description">
                    {{ modelOption.description }}
                  </p>
                  <div v-if="!modelOption.description" class="model-description">
                    No description available
                  </div>
                </div>
                <div class="model-stats">
                  <el-tag size="small" class="record-count-tag">
                    {{ modelOption.count }} records
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-actions">
          <bf-button @click="handleCancel">Cancel</bf-button>
        </div>
      </dialog-body>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElDialog, ElInput, ElTag } from 'element-plus'
import BfButton from "@/components/shared/bf-button/BfButton.vue"
import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue"
import DialogBody from "@/components/shared/dialog-body/DialogBody.vue"

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  models: {
    type: Array,
    default: () => []
  },
  currentModelId: {
    type: String,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['update:visible', 'select', 'cancel'])

// Reactive data
const searchQuery = ref('')

// Computed property for dialog visibility
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Computed property for filtered models
const filteredModels = computed(() => {
  if (!searchQuery.value) return props.models
  
  const query = searchQuery.value.toLowerCase()
  return props.models.filter(model => 
    model.label.toLowerCase().includes(query) ||
    (model.description && model.description.toLowerCase().includes(query))
  )
})

// Watch for dialog visibility to reset search
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    searchQuery.value = ''
  }
})

// Methods
const selectModel = (modelId) => {
  emit('select', modelId)
  dialogVisible.value = false
}

const handleCancel = () => {
  emit('cancel')
  dialogVisible.value = false
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/dialog';

.model-selector-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
  }
  
  .dialog-content {
    max-height: 70vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .search-section {
    .model-search {
      :deep(.el-input__wrapper) {
        border-radius: 6px;
        border: 1px solid theme.$gray_3;
        transition: all 0.2s ease;
        
        &:hover {
          border-color: theme.$purple_2;
        }
        
        &.is-focus {
          border-color: theme.$purple_2;
          box-shadow: 0 0 0 2px rgba(71, 69, 255, 0.1);
        }
      }
      
      :deep(.el-input__prefix) {
        color: theme.$gray_4;
      }
    }
  }
  
  .models-section {
    flex: 1;
    min-height: 0;
    
    .loading-state,
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      
      p {
        margin: 0;
        color: theme.$gray_5;
        font-size: 16px;
      }
    }
    
    .models-list {
      max-height: 400px;
      overflow-y: auto;
      border-radius: 6px;
      background-color: theme.$white;
      
      .model-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        border-bottom: 1px solid theme.$gray_2;
        cursor: pointer;
        transition: all 0.2s ease;
        
        &:last-child {
          border-bottom: none;
        }
        
        &:hover {
          background-color: theme.$gray_1;
        }
        
        &.active {
          background-color: theme.$purple_0_7;
          //border-left: 4px solid theme.$purple_2;
          padding-left: 16px;
          
          .model-name {
            color: theme.$purple_3;
          }
        }
        
        .model-info {
          flex: 1;
          
          .model-name {
            margin: 0 0 8px 0;
            font-size: 16px;
            font-weight: 600;
            color: theme.$gray_6;
            line-height: 1.3;
          }
          
          .model-description {
            margin: 0;
            font-size: 14px;
            color: theme.$gray_5;
            line-height: 1.4;
          }
        }
        
        .model-stats {
          flex-shrink: 0;
          margin-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-end;
        }
      }
    }
  }
  
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid theme.$gray_2;
  }
  
  // Enhanced styling for consistency with PropertyDialog
  :deep(.el-form-item) {
    margin-bottom: 20px;
    
    .el-form-item__label {
      font-weight: 500;
      color: theme.$gray_6;
      font-size: 14px;
    }
    
    .el-input, .el-select, .el-textarea {
      .el-input__inner, .el-textarea__inner {
        border: 1px solid theme.$gray_3;
        transition: all 0.2s ease;
        
        &:focus {
          border-color: theme.$purple_2;
          box-shadow: 0 0 0 2px rgba(71, 69, 255, 0.1);
        }
      }
    }
  }
  
  // Scrollbar styling for models list
  .models-list {
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: theme.$gray_1;
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: theme.$gray_3;
      border-radius: 3px;
      
      &:hover {
        background: theme.$gray_4;
      }
    }
  }
}

// Custom tag styling
:deep(.record-count-tag) {
  background-color: theme.$gray_1 !important;
  border-color: theme.$gray_2 !important;
  color: theme.$gray_5 !important;
  
  .el-tag__content {
    color: theme.$gray_5 !important;
  }
}

:deep(.current-tag) {
  background-color: theme.$purple_1 !important;
  border-color: theme.$purple_2 !important;
  color: theme.$purple_3 !important;
  
  .el-tag__content {
    color: theme.$purple_3 !important;
  }
}
</style>