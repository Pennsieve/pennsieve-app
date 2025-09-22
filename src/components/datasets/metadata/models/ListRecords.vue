<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElTable, ElTableColumn, ElInput, ElCard, ElButton, ElSelect, ElOption } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'
import IconMagnifyingGlass from '@/components/icons/IconMagnifyingGlass.vue'
import RecordFilter from './RecordFilter.vue'

// Props
const props = defineProps({
  datasetId: {
    type: String,
    required: true
  },
  modelId: {
    type: String,
    required: true
  }
})

// Store
const metadataStore = useMetadataStore()

// Reactive data
const records = ref([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
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

const searchHeading = computed(() => {
  const modelName = model.value?.display_name || model.value?.name || 'Unknown Model'
  const recordsText = records.value.length === 1 ? 'record' : 'records'
  const versionText = selectedVersion.value ? ` (v${selectedVersion.value})` : ''
  
  if (searchQuery.value) {
    return `Showing ${records.value.length} ${recordsText} for "${searchQuery.value}" in ${modelName}${versionText}`
  }
  return `Showing ${records.value.length} ${recordsText} in ${modelName}${versionText} (Page ${currentPageNumber.value})`
})

const versionOptions = computed(() => {
  return availableVersions.value // Already properly formatted from fetchVersions
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
    
    const options = {
      limit: pageSize.value,
      cursor: cursor,
      ...(activeFilter.value && { filter: activeFilter.value }),
      ...(selectedVersion.value && { version: selectedVersion.value })
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
    // Ensure models are loaded
    await metadataStore.fetchModels(props.datasetId)
    
    // Get the model from the store
    model.value = metadataStore.modelById(props.modelId)
    
    if (model.value?.latest_version?.schema) {
      modelSchema.value = model.value.latest_version.schema
      // Initialize selected version to 'latest' if not already set
      if (!selectedVersion.value) {
        selectedVersion.value = 'latest'
      }
    } else {
      throw new Error('Model schema not found')
    }
  } catch (err) {
    console.error('Error fetching model:', err)
    error.value = err.message || 'Failed to load model information'
  }
}

const fetchVersions = async () => {
  try {
    loadingVersions.value = true
    const response = await metadataStore.fetchModelVersions(props.datasetId, props.modelId)
    
    // Extract versions array from the nested response structure like ModelSpecViewer
    const versions = response?.model?.versions || []
    const versionOptions = []
    
    // Add latest option first
    const latestVersionNum = model.value?.latest_version?.version || 1
    versionOptions.push({
      value: 'latest',
      label: `Latest (v${latestVersionNum})`
    })
    
    // Add individual version options from API response
    if (versions && versions.length > 0) {
      versions.forEach(version => {
        versionOptions.push({
          value: version.version.toString(),
          label: `Version ${version.version}`,
          versionData: version
        })
      })
    } else {
      // Fallback: create versions based on latest version number
      for (let i = latestVersionNum; i >= 1; i--) {
        versionOptions.push({
          value: i.toString(),
          label: `Version ${i}`
        })
      }
    }
    
    availableVersions.value = versionOptions
    console.log('📄 Fetched versions:', availableVersions.value)
  } catch (err) {
    console.error('Error fetching model versions:', err)
    // Fallback to mock data on error
    const latestVersionNum = model.value?.latest_version?.version || 1
    const fallbackVersions = []
    
    fallbackVersions.push({
      value: 'latest',
      label: `Latest (v${latestVersionNum})`
    })
    
    for (let i = latestVersionNum; i >= 1; i--) {
      fallbackVersions.push({
        value: i.toString(),
        label: `Version ${i}`
      })
    }
    
    availableVersions.value = fallbackVersions
  } finally {
    loadingVersions.value = false
  }
}

const onSearch = () => {
  fetchRecords(null, 'forward', true)
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

const onVersionChange = (version) => {
  selectedVersion.value = version
  fetchRecords(null, 'forward', true)
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
  <div class="list-records">
    <!-- Header with model info and search -->
    <div class="records-header">
      <div class="header-content">
        <div class="header-info">
          <h2 v-if="model">{{ model.display_name || model.name }}</h2>
          <p v-if="model" class="model-description">{{ model.description || 'No description available' }}</p>
          <p v-if="hasRecords">{{ searchHeading }}</p>
        </div>
        
        <div class="search-controls">
          <!-- Version selector -->
          <div class="version-controls">
            <el-select 
              :model-value="selectedVersion"
              @update:model-value="onVersionChange"
              placeholder="Select version"
              size="small"
              :loading="loadingVersions"
              class="version-dropdown"
            >
              <el-option
                v-for="version in versionOptions"
                :key="version.value"
                :label="version.label"
                :value="version.value"
              />
            </el-select>
          </div>
          
          <form class="search-form" @submit.prevent="onSearch">
            <el-input
              v-model="searchQuery"
              class="search-input"
              placeholder="Search records..."
              @keyup.enter="onSearch"
            >
              <template #prefix>
                <IconMagnifyingGlass :height="20" :width="20" color="#71747c" />
              </template>
            </el-input>
          </form>
        </div>
      </div>
    </div>

    <!-- Record Filters - Always show when schema is available -->
    <record-filter
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
          <p v-else-if="searchQuery">No records match your search criteria.</p>
          <p v-else>This model doesn't have any records yet.</p>
        </div>
      </el-card>
    </div>
    
    <!-- Records Table -->
    <div v-else class="records-content">




      <!-- Pagination Controls (Top) -->
      <div class="records-controls">
        <div class="records-controls-left">
          <span class="records-count">{{ searchHeading }}</span>
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
          :default-sort="{ prop: 'created_at', order: 'descending' }"
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
            sortable
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
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/table';


.list-records {
  padding: 24px;
  
  .records-header {
    margin-bottom: 24px;
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      
      .header-info {
        flex: 1;
        
        h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
          color: theme.$gray_6;
        }
        
        .model-description {
          margin: 0 0 16px 0;
          color: theme.$gray_5;
          font-size: 16px;
        }
        
        p {
          margin: 0;
          color: theme.$gray_5;
          font-size: 14px;
        }
      }
      
      .search-controls {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 16px;
        
        .version-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          
          .version-dropdown {
            width: 160px;
            height: 32px;
            
            :deep(.el-input__wrapper) {
              height: 32px;
              border-radius: 4px;
              border: 1px solid theme.$gray_2;
              background-color: theme.$white;
            }
          }
        }
        
        .search-form {
          .search-input {
            width: 300px;
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
</style>