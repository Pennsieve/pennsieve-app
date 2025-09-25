<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElTable, ElTableColumn, ElCard, ElButton, ElSelect, ElOption, ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'
import RecordFilter from './RecordFilterStyled.vue'
import ModelSelectorDialog from './ModelSelectorDialog.vue'
import IconPlus from '@/components/icons/IconPlus.vue'
import StageActions from "@/components/shared/StageActions/StageActions.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

// Props
const props = defineProps({
  datasetId: {
    type: String,
    required: true
  },
  modelId: {
    type: String,
    required: true
  },
  versionId: {
    type: String,
    required: false
  }
})

// Store and router
const metadataStore = useMetadataStore()
const router = useRouter()

// Reactive data
const records = ref([])
const loading = ref(false)
const error = ref('')
const activeFilter = ref(null) // Store the active predicate filter
const pageSize = ref(10)
const nextCursor = ref(null)
const currentCursor = ref(null) // Cursor used to get TO the current page
const pageHistory = ref([]) // Stack of cursors to get to each previous page
const hasNextPage = ref(false)
const hasPreviousPage = ref(false)
const currentPageNumber = ref(1)
const selectedVersion = ref(null) // Currently selected model version

// Model data
const model = ref(null)
const modelSchema = ref(null)
const availableVersions = ref([])
const loadingVersions = ref(false)
const loadingModels = ref(false)
const modelError = ref('')
const versionError = ref('')
const modelSelectorVisible = ref(false)

// Computed properties
const tableColumns = computed(() => {
  if (!modelSchema.value?.properties) return []
  
  return Object.entries(modelSchema.value.properties).map(([key, property]) => ({
    key,
    label: property.title || key,
    type: property.type,
    format: property.format
  }))
})

const hasRecords = computed(() => records.value.length > 0)

const recordsHeading = computed(() => {
  const modelName = model.value?.display_name || model.value?.name || 'Unknown Model'
  const recordsText = records.value.length === 1 ? 'record' : 'records'
  
  let versionText = ''
  if (selectedVersion.value === 'all') {
    versionText = ' (All Versions)'
  } else if (selectedVersion.value === 'latest') {
    versionText = ` (Latest - v${model.value?.latest_version?.version || 1})`
  } else if (selectedVersion.value) {
    versionText = ` (v${selectedVersion.value})`
  }
  
  return `Showing ${records.value.length} ${recordsText} in ${modelName}${versionText} (Page ${currentPageNumber.value})`
})

const versionOptions = computed(() => {
  const options = []
  const latestVersionNum = model.value?.latest_version?.version || 1
  
  // Always show "All Versions" as first option
  options.push({
    value: 'all',
    label: 'All Versions',
    isAll: true,
    version: null,
    createdAt: null,
    author: null
  })
  
  // Then show "Latest" as second option
  options.push({
    value: 'latest',
    label: `Latest (v${latestVersionNum})`,
    isLatest: true,
    version: latestVersionNum,
    createdAt: model.value?.latest_version?.created_at,
    author: model.value?.latest_version?.created_by
  })
  
  // Add specific versions
  if (availableVersions.value?.length) {
    availableVersions.value.forEach(version => {
      if (version.value !== 'latest') {
        options.push({
          value: version.value,
          label: version.label,
          isLatest: false,
          version: parseInt(version.value),
          createdAt: version.versionData?.created_at,
          author: version.versionData?.created_by
        })
      }
    })
  }
  
  return options
})

const modelOptions = computed(() => {
  const rawModels = metadataStore.models || []
  const models = rawModels.map(item => item.model || item).filter(Boolean)
  
  return models.map(model => ({
    label: model.display_name || model.name,
    value: model.id,
    description: model.description || '',
    count: model.count || 0,
    latestVersion: model.latest_version?.version || 1
  })).filter(option => option.value).sort((a, b) => a.label.localeCompare(b.label))
})

const noRecordsMessage = computed(() => {
  // Check if there are multiple versions available
  const hasMultipleVersions = versionOptions.value.length > 1
  
  if (hasMultipleVersions) {
    return "This model version doesn't have any records yet. You might want to try an older model version."
  } else {
    return "This model doesn't have any records yet."
  }
})


// Methods
const fetchRecords = async (cursor = null, direction = 'forward', resetPagination = false) => {
  loading.value = true
  error.value = ''
  
  try {
    if (resetPagination) {
      pageHistory.value = []
      currentPageNumber.value = 1
      currentCursor.value = null
      hasNextPage.value = false
      hasPreviousPage.value = false
    }
    
    // Handle version parameter for API call
    let apiVersion = null
    if (selectedVersion.value === 'latest') {
      apiVersion = model.value?.latest_version?.version
    } else if (selectedVersion.value !== 'all') {
      apiVersion = selectedVersion.value
    }
    // If selectedVersion.value === 'all', apiVersion remains null (omit version parameter)
    
    const options = {
      limit: pageSize.value,
      cursor: cursor,
      ...(activeFilter.value && { filter: activeFilter.value }),
      ...(apiVersion && { version: apiVersion })
    }
    
    console.log(`🔍 Fetching records with cursor:`, cursor, `direction: ${direction}`)
    console.log(`🔍 Request options:`, options)
    
    const response = await metadataStore.fetchRecords(props.datasetId, props.modelId, options)
    
    console.log(`🔍 API Response:`, {
      recordCount: response.records?.length || 0,
      returnedCursor: response.cursor,
      inputCursor: cursor
    })
    
    records.value = response.records || []
    const newCursor = response.cursor || null
    
    // Check if we're getting the same cursor as input (indicates end of results)
    if (newCursor && newCursor === cursor) {
      console.warn(`⚠️ API returned the same cursor as input - likely end of results`)
      console.warn(`Input cursor: ${cursor}`)
      console.warn(`Returned cursor: ${newCursor}`)
      
      // Don't update cursors if we get the same one back
      hasNextPage.value = false
      return
    }
    
    // Update cursors only if they're different
    nextCursor.value = newCursor
    currentCursor.value = cursor // Remember what cursor got us TO this page
    
    // Update pagination state
    hasNextPage.value = !!nextCursor.value
    hasPreviousPage.value = pageHistory.value.length > 0
    
    console.log(`📄 Updated state - nextCursor: ${nextCursor.value}, currentCursor: ${currentCursor.value}`)
    console.log(`📄 hasNext: ${hasNextPage.value}, hasPrev: ${hasPreviousPage.value}, pageHistory:`, pageHistory.value)
    
  } catch (err) {
    console.error('Error fetching records:', err)
    error.value = err.message || 'Failed to load records'
    records.value = []
    hasNextPage.value = false
    hasPreviousPage.value = false
  } finally {
    loading.value = false
  }
}

const fetchModel = async () => {
  try {
    loadingModels.value = true
    modelError.value = ''
    
    // Ensure models are loaded
    await metadataStore.fetchModels(props.datasetId)
    
    // Get the model from the store
    model.value = metadataStore.modelById(props.modelId)
    
    if (model.value?.latest_version?.schema) {
      modelSchema.value = model.value.latest_version.schema
      // Initialize selected version based on route param or default to all versions
      if (!selectedVersion.value) {
        if (props.versionId) {
          selectedVersion.value = props.versionId
        } else {
          selectedVersion.value = 'all'
        }
      }
    } else {
      const errorMsg = 'Model schema not found'
      modelError.value = errorMsg
      error.value = errorMsg
    }
  } catch (err) {
    console.error('Error fetching model:', err)
    const errorMsg = err.message || 'Failed to load model information'
    modelError.value = errorMsg
    error.value = errorMsg
  } finally {
    loadingModels.value = false
  }
}

const fetchVersions = async () => {
  try {
    loadingVersions.value = true
    versionError.value = ''
    
    const response = await metadataStore.fetchModelVersions(props.datasetId, props.modelId)
    
    // Extract versions array from the nested response structure
    const versions = response?.model?.versions || []
    const versionOptions = []
    
    // Add latest option first
    const latestVersionNum = model.value?.latest_version?.version || 1
    versionOptions.push({
      value: 'latest',
      label: `Latest (v${latestVersionNum})`,
      versionData: {
        created_at: model.value?.latest_version?.created_at,
        created_by: model.value?.latest_version?.created_by
      }
    })
    
    // Add individual version options from API response
    if (versions && versions.length > 0) {
      versions.forEach(version => {
        if (version.version !== latestVersionNum) {
          versionOptions.push({
            value: version.version.toString(),
            label: `Version ${version.version}`,
            versionData: version
          })
        }
      })
    } else {
      // Fallback: create versions based on latest version number
      for (let i = latestVersionNum - 1; i >= 1; i--) {
        versionOptions.push({
          value: i.toString(),
          label: `Version ${i}`,
          versionData: {}
        })
      }
    }
    
    availableVersions.value = versionOptions
    console.log('📄 Fetched versions:', availableVersions.value)
  } catch (err) {
    console.error('Error fetching model versions:', err)
    versionError.value = 'Failed to load version information'
    
    // Fallback to basic version structure
    const latestVersionNum = model.value?.latest_version?.version || 1
    const fallbackVersions = [{
      value: 'latest',
      label: `Latest (v${latestVersionNum})`,
      versionData: {}
    }]
    
    for (let i = latestVersionNum - 1; i >= 1; i--) {
      fallbackVersions.push({
        value: i.toString(),
        label: `Version ${i}`,
        versionData: {}
      })
    }
    
    availableVersions.value = fallbackVersions
  } finally {
    loadingVersions.value = false
  }
}


const onFilterChange = (newFilter) => {
  activeFilter.value = newFilter
  fetchRecords(null, 'forward', true)
}

const onNextPage = () => {
  if (!hasNextPage.value) return
  
  // Save the current page's cursor to history so we can come back
  pageHistory.value.push(currentCursor.value)
  currentPageNumber.value++
  
  console.log(`📄 Going forward with nextCursor:`, nextCursor.value)
  console.log(`📄 Saved currentCursor to history:`, currentCursor.value)
  console.log(`📄 Page history:`, pageHistory.value)
  
  fetchRecords(nextCursor.value, 'forward')
}

const onPreviousPage = () => {
  if (!hasPreviousPage.value) return
  
  // Get the previous page's cursor from history
  const previousPageCursor = pageHistory.value.pop()
  currentPageNumber.value--
  
  console.log(`📄 Going back with cursor:`, previousPageCursor)
  console.log(`📄 Page history after pop:`, pageHistory.value)
  
  fetchRecords(previousPageCursor, 'backward')
}

const onPageSizeChange = (size) => {
  pageSize.value = size
  fetchRecords(null, 'forward', true)
}

const normalizeVersion = (version) => {
  if (!version || version === 'latest') return 'latest'
  if (version === 'all') return 'all'
  return version.toString()
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return ''
  }
}

const onVersionChange = (version) => {
  const normalizedVersion = normalizeVersion(version)
  selectedVersion.value = normalizedVersion
  
  // Just refetch records without changing the URL
  // The current route structure uses /metadata/models/{modelId}/records/search
  fetchRecords(null, 'forward', true)
}

const openModelSelector = () => {
  modelSelectorVisible.value = true
}

const selectModel = (newModelId) => {
  modelSelectorVisible.value = false
  
  // Navigate to the new model's records route
  router.push({
    name: 'model-records-search',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: props.datasetId,
      modelId: newModelId
    }
  })
}

const formatCellValue = (value, column) => {
  if (value === null || value === undefined) {
    return ''
  }
  
  // Format based on column type
  if (column.type === 'number' || column.type === 'integer') {
    return Number(value).toLocaleString()
  }
  
  if (column.format === 'date') {
    try {
      return new Date(value).toLocaleDateString()
    } catch {
      return value
    }
  }
  
  if (column.format === 'date-time') {
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }
  
  return String(value)
}

// Helper function to get a record display name
const getRecordDisplayName = (record) => {
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

const goToRecordDetails = async (record) => {
  // Check if we're in relationship creation mode
  if (metadataStore.activeRelationshipCreation) {
    // Create a custom event to trigger relationship creation with complete record data
    const recordData = {
      id: record.id,
      name: getRecordDisplayName(record),
      modelId: props.modelId,
      modelName: model.value?.display_name || model.value?.name || 'Unknown Model'
    }
    
    const event = new CustomEvent('record-selected', { 
      detail: recordData
    })
    window.dispatchEvent(event)
    return
  }
  
  // Normal record navigation
  router.push({
    name: 'record-details',
    params: {
      datasetId: props.datasetId,
      modelId: props.modelId,
      recordId: record.id
    }
  })
}

const createRecord = () => {
  router.push({
    name: 'create-record',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  })
}

// Watch for route changes
watch(() => [props.datasetId, props.modelId], () => {
  Promise.all([fetchModel(), fetchVersions()]).then(() => {
    fetchRecords(null, 'forward', true)
  })
}, { immediate: false })

// Initialize
onMounted(async () => {
  await fetchModel()
  await fetchVersions()
  await fetchRecords(null, 'forward', true)
})
</script>

<template>
  <bf-stage class="list-records" >
    <template #actions>
      <stage-actions>
        <template #left>
          <div class="left-wrapper">
            <!-- Model Selector -->
            <div class="model-selector-section">
              <!--            <div class="model-label">Model</div>-->
              <div class="model-title-content" @click="openModelSelector" :class="{ 'loading': loadingModels }">
                <h3 v-if="model" class="model-title">{{ model.display_name || model.name }}</h3>
                <div class="model-selector-icon" :class="{ 'loading': loadingModels }">
                  <svg v-if="!loadingModels" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5H7z"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="loading-spinner">
                    <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
                    <path d="M12,4a8,8,0,0,1,8,8" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- Version Selector -->
            <div class="version-selector-section">
              <!--            <label class="selector-label">Version</label>-->
              <el-select
                :model-value="selectedVersion"
                @update:model-value="onVersionChange"
                placeholder="Choose version..."
                :loading="loadingVersions"
                :disabled="!versionOptions.length && !loadingVersions"
                class="version-dropdown-compact"
              >
                <el-option
                  v-for="version in versionOptions"
                  :key="version.value"
                  :label="version.label"
                  :value="version.value"
                >
                  <div class="version-option">
                    <div class="version-info">
                      <span class="version-label">{{ version.label }}</span>
                      <span v-if="version.createdAt" class="version-date">{{ formatDate(version.createdAt) }}</span>
                    </div>
                  </div>
                </el-option>
              </el-select>
            </div>
          </div>

        </template>
        <template #right>
          <!-- Create Record Button -->
          <bf-button @click="createRecord" size="small">
            <template #prefix>
              <IconPlus class="mr-8" :height="16" :width="16" />
            </template>
            Create Record
          </bf-button>
        </template>
      </stage-actions>
    </template>
    <!-- Model Selector Dialog -->
    <ModelSelectorDialog
      v-model:visible="modelSelectorVisible"
      :models="modelOptions"
      :current-model-id="modelId"
      :loading="loadingModels"
      @select="selectModel"
      @cancel="modelSelectorVisible = false"
    />

    <!-- Record Filters - Always show when schema is available -->
    <record-filter
      class="record-filter-section"
      v-if="modelSchema && !error"
      :model-schema="modelSchema"
      @filter-change="onFilterChange"
    />

    <!-- Loading and Error States -->
    <div v-if="loading && !hasRecords" class="loading-state" v-loading="true">
      <p>Loading records...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    
    <!-- No Records State -->
    <div v-else-if="!hasRecords && !loading" class="no-records-state">
      <el-card shadow="never">
        <div class="no-records-content">
          <h3>No Records Found</h3>
          <p v-if="activeFilter">No records match your filter criteria.</p>
          <p v-else>{{ noRecordsMessage }}</p>
        </div>
      </el-card>
    </div>
    
    <!-- Records Table -->
    <div v-else class="records-content">




      <!-- Pagination Controls (Top) -->
      <div class="records-controls">
        <div class="records-controls-left">
          <span class="records-count">{{ recordsHeading }}</span>
        </div>
        
        <div v-if="hasNextPage || hasPreviousPage" class="pagination-controls">
          <el-button
            :disabled="!hasPreviousPage"
            @click="onPreviousPage"
          >
            ← Previous
          </el-button>
          <span class="page-info">Page {{ currentPageNumber }}</span>
          <el-button
            :disabled="!hasNextPage"
            @click="onNextPage"
          >
            Next →
          </el-button>
        </div>
      </div>
      
      <!-- Records Table -->
      <el-card shadow="never" class="table-card">
        <el-table
          :data="records"
          v-loading="loading"
          stripe
          style="width: 100%"
          @row-click="goToRecordDetails"
          class="clickable-table"
        >
          <!-- Dynamic columns from model schema -->
          <el-table-column
            v-for="column in tableColumns"
            :key="column.key"
            :prop="`value.${column.key}`"
            :label="column.label"
            :min-width="120"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ formatCellValue(row.value[column.key], column) }}
            </template>
          </el-table-column>
          
          <!-- Metadata columns -->
          <el-table-column
            prop="created_at"
            label="Created"
            width="180"
          >
            <template #default="{ row }">
              {{ new Date(row.created_at).toLocaleString() }}
            </template>
          </el-table-column>
          
          <el-table-column
            prop="model_version"
            label="Model Version"
            width="120"
            align="center"
          >
            <template #default="{ row }">
              v{{ row.model_version }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      
      <!-- Pagination Controls (Bottom) -->
      <div class="records-controls records-controls-bottom">
        <div class="records-controls-left">
          <span class="page-size-selector">
            Show 
            <el-select v-model="pageSize" @change="onPageSizeChange" style="width: 80px; margin: 0 8px;">
              <el-option :value="10" label="10" />
              <el-option :value="25" label="25" />
              <el-option :value="50" label="50" />
              <el-option :value="100" label="100" />
            </el-select>
            records per page
          </span>
        </div>
        
        <div v-if="hasNextPage || hasPreviousPage" class="pagination-controls">
          <el-button
            :disabled="!hasPreviousPage"
            @click="onPreviousPage"
          >
            ← Previous
          </el-button>
          <span class="page-info">Page {{ currentPageNumber }}</span>
          <el-button
            :disabled="!hasNextPage"
            @click="onNextPage"
          >
            Next →
          </el-button>
        </div>
      </div>
    </div>
  </bf-stage>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/table';
@use '../../../../styles/element/select';
@use '../../../../styles/element/input';
@use '../../../../styles/element/dialog';
@use '../../../../styles/element/dropdown';

.record-filter-section {
}

.list-records {
  padding: 24px;
  
  // Stage actions compact selectors
  :deep(.stage-actions) {
    align-items: flex-end; // Align items to bottom to prevent stretching

    .left-wrapper {
      align-items: center;
      display: flex;
      flex-direction: row;
    }

    .model-selector-section,
    .version-selector-section {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .selector-label {
        font-size: 12px;
        font-weight: 600;
        color: theme.$gray_5;
        margin: 0;
      }

      .model-label {
        font-size: 12px;
        font-weight: 600;
        margin-left: 16px;
        color: theme.$gray_5;
      }

      .model-title-prefix {
        font-size: 12px;
        font-weight: 300;
      }

    }
    
    // Ensure Create Record button doesn't stretch
    .bf-button,
    button {
      align-self: flex-end;
      height: 32px; // Match the height of other controls
    }
    
    .model-selector-section {
      .model-title-content {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0 8px;
        margin: 8px 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: theme.$white;
        //border: 1px solid theme.$gray_3;
        border-radius: 4px;
        user-select: none;
        min-height: 32px;

        
        &:hover:not(.loading) {
          background-color: theme.$gray_1;
          border-color: theme.$purple_2;
        }
        
        &.loading {
          cursor: default;
          opacity: 0.7;
        }
        
        .model-title {
          margin: 0;
          font-size: 24px;
          font-weight: 500;
          color: theme.$purple_3;
          transition: color 0.2s ease;
          white-space: nowrap;
          //overflow: hidden;
          text-overflow: ellipsis;
          //min-width: 70px;

        }
        
        .model-selector-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          color: theme.$gray_5;
          transition: all 0.2s ease;
          flex-shrink: 0;
          
          svg {
            display: block;
            transition: transform 0.2s ease;
          }
        }
        
        &:hover:not(.loading) .model-selector-icon {
          color: theme.$purple_3;
          
          svg {
            transform: translateY(1px);
          }
        }
        
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
      }
    }
    
    .version-dropdown-compact {
      width: 140px;
      height: 32px;

      :deep(.el-input__wrapper) {
        height: 32px;
        border-radius: 4px;
        border: 1px solid theme.$gray_3;
        background-color: theme.$white;
        box-shadow: none;
        
        &:hover:not(.is-disabled) {
          border-color: theme.$purple_2;
          background-color: theme.$white;
        }
        
        &.is-focus {
          border-color: theme.$purple_3;
          box-shadow: 0 0 0 2px rgba(1, 31, 91, 0.1);
        }
        
        .el-input__inner {
          color: theme.$gray_6;
          font-size: 14px;
          
          &::placeholder {
            color: theme.$gray_4;
          }
        }
        
        .el-input__suffix {
          .el-icon {
            color: theme.$gray_5;
          }
        }
      }
    }
  }
  
  .loading-state, .error-state, .no-records-state {
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
  
  .error-state p {
    color: theme.$red_2;
  }
  
  .no-records-content {
    padding: 24px;
  }
  
  .records-content {
    .records-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      &.records-controls-bottom {
        margin-top: 16px;
        margin-bottom: 0;
      }
      
      .records-controls-left {
        .records-count {
          color: theme.$gray_5;
          font-size: 14px;
          font-weight: 500;
        }
        
        .page-size-selector {
          color: theme.$gray_5;
          font-size: 14px;
          display: flex;
          align-items: center;
        }
      }
      
      .pagination-controls {
        display: flex;
        align-items: center;
        gap: 16px;
        
        .page-info {
          color: theme.$gray_5;
          font-size: 14px;
          font-weight: 500;
          padding: 0 8px;
        }
        
        .el-button {
          font-size: 14px;
          
          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }
    
    .table-card {
      border: none;
      //box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      //border-radius: 8px;
      
      :deep(.el-card__body) {
        padding: 0;
      }
      
      :deep(.el-table) {
        .el-table__header {
          background-color: theme.$gray_1;
          
          th {
            background-color: theme.$gray_1 !important;
            color: theme.$gray_6;
            font-weight: 600;
            border-bottom: 1px solid theme.$gray_2;
          }
        }
        
        .el-table__row {
          &:hover {
            background-color: theme.$gray_1;
          }
          
          td {
            border-bottom: 1px solid theme.$gray_2;
            color: theme.$gray_6;
          }
        }
      }
    }
    
    // Clickable table styling
    :deep(.clickable-table) {
      .el-table__row {
        cursor: pointer;
        
        &:hover {
          background-color: theme.$gray_1;
        }
      }
    }
  }
}

// Keyframe animations
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// Element Plus pagination styling
:deep(.el-pagination) {
  .el-pagination__sizes {
    margin-right: 16px;
  }
  
  .btn-prev, .btn-next {
    background-color: theme.$white;
    border: 1px solid theme.$gray_3;
    color: theme.$gray_5;
    
    &:hover {
      color: theme.$purple_3;
      border-color: theme.$purple_3;
    }
    
    &.is-disabled {
      color: theme.$gray_3;
      border-color: theme.$gray_2;
    }
  }
  
  .el-pager li {
    background-color: theme.$white;
    border: 1px solid theme.$gray_3;
    color: theme.$gray_5;
    margin: 0 2px;
    
    &:hover {
      color: theme.$purple_3;
      border-color: theme.$purple_3;
    }
    
    &.is-active {
      background-color: theme.$purple_3;
      border-color: theme.$purple_3;
      color: theme.$white;
    }
  }
}

// Custom dropdown option styling
:deep(.el-select-dropdown) {
  // Override Element Plus dropdown item colors
  .el-select-dropdown__item {
    color: theme.$gray_6;
    
    &:hover:not(.is-disabled) {
      background-color: theme.$gray_1;
      color: theme.$purple_3;
    }
    
    &.is-selected {
      color: theme.$purple_3;
      font-weight: 600;
      
      &:hover {
        background-color: theme.$gray_1;
      }
    }
    
    &.is-disabled {
      color: theme.$gray_3;
      cursor: not-allowed;
    }
  }
  
  .model-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    width: 100%;

    .model-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .model-name {
        font-size: 14px;
        font-weight: 500;
        color: inherit;
      }

      .model-description {
        font-size: 12px;
        color: theme.$gray_4;
        line-height: 1.3;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .model-stats {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
  }

  .version-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    width: 100%;

    .version-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;

      .version-label {
        font-size: 14px;
        font-weight: 500;
        color: inherit;
      }

      .version-date {
        font-size: 12px;
        color: theme.$gray_4;
      }
    }

    .version-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
  }
}

// Custom latest indicator styling
:deep(.el-select-dropdown) {
  .latest-indicator {
    font-size: 11px;
    color: theme.$gray_4;
    font-style: italic;
    text-transform: lowercase;
  }
}
</style>