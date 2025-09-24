<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElSelect, ElOption, ElCard, ElTag } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'

// Import components
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import ListRecords from './ListRecords.vue'

const props = defineProps({
  datasetId: {
    type: String,
    required: true
  },
  orgId: {
    type: String,
    required: true
  }
})

const metadataStore = useMetadataStore()

// Reactive data
const selectedModelId = ref('')
const loading = ref(false)

// Computed properties
const rawModels = computed(() => metadataStore.models || [])
const models = computed(() => {
  // Extract the actual model objects from the nested structure
  return rawModels.value.map(item => item.model || item).filter(Boolean)
})

const selectedModel = computed(() => {
  return models.value.find(model => model.id === selectedModelId.value)
})

const modelOptions = computed(() => {
  return models.value.map(model => ({
    label: model.display_name || model.name,
    value: model.id,
    count: model.count || 0
  })).filter(option => option.value) // Filter out any options with undefined values
})

const hasModels = computed(() => models.value.length > 0)

// Methods
const fetchModels = async () => {
  loading.value = true
  try {
    await metadataStore.fetchModels(props.datasetId)
  } catch (error) {
    console.error('Failed to fetch models:', error)
  } finally {
    loading.value = false
  }
}

const handleModelSelect = (modelId) => {
  selectedModelId.value = modelId
}

// Initialize
onMounted(async () => {
  await fetchModels()
  
  console.log('Raw models from store:', rawModels.value)
  console.log('Processed models:', models.value)
  console.log('Model options:', modelOptions.value)
  
  // Auto-select the first model if available
  if (models.value.length > 0) {
    selectedModelId.value = models.value[0].id
    console.log('Auto-selected model ID:', selectedModelId.value)
  }
})
</script>

<template>
  <bf-stage class="model-records-selector" no-padding>
<!--    <template #actions>-->
<!--      <stage-actions>-->
<!--        <template #left>-->
<!--          <div class="page-title">-->
<!--            <h2>Records</h2>-->
<!--            <p>Browse and manage metadata records across all models</p>-->
<!--          </div>-->
<!--        </template>-->
<!--      </stage-actions>-->
<!--    </template>-->

    <div class="records-content">
      <!-- Model Selection Header -->
      <div class="model-selection-header">
        <el-card shadow="never" class="selection-card">
          <div class="selection-content">
            <div class="selection-info">
              <h4>Select a Model</h4>
            </div>
            
            <div class="model-selector">
              <el-select
                v-model="selectedModelId"
                placeholder="Select a model..."
                size="default"
                class="model-dropdown"
                :loading="loading"
                @change="handleModelSelect"
              >
                <el-option
                  v-for="option in modelOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                >
                  <div class="option-content">
                    <span class="option-label">{{ option.label }}</span>
                    <el-tag size="small" type="info" effect="plain">
                      {{ option.count }} records
                    </el-tag>
                  </div>
                </el-option>
              </el-select>
            </div>
          </div>
        </el-card>
      </div>

      <!-- Records List -->
      <div v-if="selectedModelId" class="records-section">
        <ListRecords 
          :dataset-id="datasetId"
          :model-id="selectedModelId"
        />
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasModels && !loading" class="empty-state">
        <el-card shadow="never">
          <div class="empty-content">
            <h3>No Models Available</h3>
            <p>You need to create at least one model before you can view records.</p>
            <router-link :to="{ name: 'models-list' }">
              <el-button type="primary">Manage Models</el-button>
            </router-link>
          </div>
        </el-card>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="loading-state">
        <el-card shadow="never">
          <div class="loading-content">
            <p>Loading models...</p>
          </div>
        </el-card>
      </div>
    </div>
  </bf-stage>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;

.model-records-selector {
  .records-content {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .page-title {
    h2 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 600;
      color: theme.$gray_6;
    }

    p {
      margin: 0;
      font-size: 14px;
      color: theme.$gray_5;
    }
  }

  .model-selection-header {
    .selection-card {
      border: 1px solid theme.$gray_2;
      
      :deep(.el-card__body) {
        padding: 16px;
      }
    }

    .selection-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
    }

    .selection-info {
      flex: 1;

      h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: theme.$gray_6;
      }
    }

    .model-selector {
      flex: 0 0 280px;

      @media (max-width: 768px) {
        flex: 1;
      }

      .model-dropdown {
        width: 100%;

        :deep(.el-input__wrapper) {
          border-radius: 4px;
          border: 1px solid theme.$gray_3;
          
          &:hover {
            border-color: theme.$purple_2;
          }
        }

        :deep(.el-input__inner) {
          font-size: 14px;
          color: theme.$gray_6;
        }
      }
    }
  }

  .records-section {
    margin-top: 0;
  }

  .empty-state,
  .loading-state {
    .empty-content,
    .loading-content {
      text-align: center;
      padding: 48px 24px;

      h3 {
        margin: 0 0 12px 0;
        font-size: 20px;
        font-weight: 500;
        color: theme.$gray_6;
      }

      p {
        margin: 0 0 24px 0;
        font-size: 14px;
        color: theme.$gray_5;
      }
    }
  }
}

// Custom dropdown option styling
:deep(.el-select-dropdown) {
  .option-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    .option-label {
      flex: 1;
      font-size: 14px;
      color: theme.$gray_6;
    }
  }
}
</style>