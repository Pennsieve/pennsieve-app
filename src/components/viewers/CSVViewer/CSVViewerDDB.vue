<!-- CSVViewerDDB.vue - Clean CSV Viewer with Element Plus Pagination -->
<template>
  <div class="csv-viewer-container">
    <!-- Header with Status -->
    <header class="viewer-header">
      <h2>Tabular Data Viewer</h2>
      <div class="header-controls">
        <div class="status-indicator" :class="{ connected: isConnected, loading: isLoading, error: hasError }">
          {{ statusText }}
        </div>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-panel">
      <div class="loading-spinner"></div>
      <p>Loading CSV data...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-panel">
      <h3>Error</h3>
      <p>{{ error }}</p>
      <button @click="retryLoad" class="retry-btn">Retry</button>
    </div>

    <!-- Data View -->
    <div v-else-if="isConnected && queryResults" class="data-panel">
      <!-- Info Bar -->
      <div class="info-bar">
        <span class="row-count">
          Showing {{ paginatedResults.length }} of {{ typeof totalRows === 'bigint' ? Number(totalRows) : totalRows }} rows
        </span>
        <div class="info-bar-controls">
          <div class="top-pagination">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="typeof totalRows === 'bigint' ? Number(totalRows) : totalRows"
              layout="prev, pager, next"
              @current-change="handlePageChange"
              hide-on-single-page
            />
          </div>
        </div>
      </div>

      <!-- Data Table -->
      <div class="table-container">
        <table class="data-table">
          <thead>
          <tr>
            <th v-for="column in tableColumns" :key="column">
              {{ column }}
            </th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(row, index) in paginatedResults" :key="index">
            <td v-for="column in tableColumns" :key="column">
              {{ formatCellValue(row[column]) }}
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDuckDBStore } from '@/stores/duckdbStore'

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    default: 'csv'
  },
  rowsPerPage: {
    type: Number,
    default: 25
  },
  autoLoad: {
    type: Boolean,
    default: true
  },
  fileId: {
    type: String,
    default: null
  }
})

// Store
const duckDBStore = useDuckDBStore()

// State
const isLoading = ref(false)
const error = ref('')
const connectionId = ref(null)
const tableName = ref('')
const queryResults = ref(null)
const totalRows = ref(0)
const currentPage = ref(1)
const pageSize = ref(props.rowsPerPage)

// CSV options
const csvOptions = ref({
  header: true,
  delimiter: ','
})

// Computed
const isConnected = computed(() => {
  return duckDBStore.isReady && connectionId.value && !isLoading.value && !error.value
})

const hasError = computed(() => !!error.value)

const statusText = computed(() => {
  if (isLoading.value) return 'Loading...'
  if (error.value) return 'Error'
  if (duckDBStore.isInitializing) return 'Initializing...'
  if (!duckDBStore.isReady) return 'Not Ready'
  if (isConnected.value) {
    return `Connected`
  }
  return 'Not Connected'
})

const tableColumns = computed(() => {
  if (!queryResults.value || !Array.isArray(queryResults.value) || queryResults.value.length === 0) {
    return []
  }
  return Object.keys(queryResults.value[0] || {})
})

const totalPages = computed(() => {
  const totalRowsNum = typeof totalRows.value === 'bigint'
    ? Number(totalRows.value)
    : totalRows.value
  return Math.ceil(totalRowsNum / pageSize.value)
})

const paginatedResults = computed(() => {
  if (!queryResults.value || !Array.isArray(queryResults.value)) {
    return []
  }
  return queryResults.value
})

// Methods
const initialize = async () => {
  try {
    isLoading.value = true
    error.value = ''

    console.log('Starting CSV viewer initialization...')

    if (!duckDBStore.isReady) {
      console.log('DuckDB not ready, initializing...')
      await duckDBStore.initDuckDB()
    }

    const viewerId = `csv_viewer_${Date.now()}`
    const { connection, connectionId: connId } = await duckDBStore.createConnection(viewerId)
    connectionId.value = connId

    console.log(`CSV Viewer connected with ID: ${connId}`)

    if (props.autoLoad && props.url) {
      await loadCSVFile()
    } else {
      isLoading.value = false
    }
  } catch (err) {
    console.error('Failed to initialize CSV viewer:', err)
    error.value = `Failed to initialize: ${err.message}`
    isLoading.value = false
  }
}

const loadCSVFile = async () => {
  if (!props.url) {
    error.value = 'No URL provided'
    isLoading.value = false
    return
  }

  console.log('Loading CSV file from URL:', props.url)

  try {
    const stableKey = props.fileId || props.url
    const existingFile = duckDBStore.getLoadedFile(stableKey)
    if (existingFile && !existingFile.isLoading && !existingFile.error) {
      console.log('File already loaded, reusing table:', existingFile.tableName)
      tableName.value = existingFile.tableName
      await getTotalRowCount()
      await loadPage(1)
      isLoading.value = false
      return
    }

    const tableId = props.fileId ? `file_${props.fileId}` : `csv_data_${Date.now()}`

    tableName.value = await duckDBStore.loadFile(
      props.url,
      'csv',
      tableId,
      csvOptions.value,
      connectionId.value,
      props.fileId
    )

    console.log(`CSV loaded successfully as table: ${tableName.value}`)

    await getTotalRowCount()
    await loadPage(1)

  } catch (err) {
    console.error('Failed to load CSV file:', err)
    error.value = `Failed to load CSV: ${err.message}`
  } finally {
    isLoading.value = false
  }
}

const getTotalRowCount = async () => {
  try {
    const countQuery = `SELECT COUNT(*) as total_count FROM ${tableName.value}`
    const result = await duckDBStore.executeQuery(countQuery, connectionId.value)

    const count = result[0]?.total_count || 0
    totalRows.value = typeof count === 'bigint' ? Number(count) : count
  } catch (err) {
    console.error('Failed to get row count:', err)
    totalRows.value = 0
    throw err
  }
}

const loadPage = async (page) => {
  if (!tableName.value || !connectionId.value) {
    return
  }

  try {
    const offset = (page - 1) * pageSize.value
    const query = `
      SELECT * FROM ${tableName.value}
      LIMIT ${pageSize.value}
      OFFSET ${offset}
    `

    queryResults.value = await duckDBStore.executeQuery(query, connectionId.value)
    currentPage.value = page
  } catch (err) {
    console.error('Failed to load page:', err)
    error.value = `Failed to load page: ${err.message}`
    throw err
  }
}

const handlePageChange = async (page) => {
  await loadPage(page)
}

const handleSizeChange = async (newSize) => {
  pageSize.value = newSize
  currentPage.value = 1
  await loadPage(1)
}

const formatCellValue = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(4)
  }
  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...'
  }
  return value.toString()
}

const retryLoad = async () => {
  error.value = ''
  await loadCSVFile()
}

const debugStatus = () => {
  console.log('=== CSV Viewer Debug Info ===')
  console.log('Props:', {
    url: props.url,
    fileType: props.fileType,
    rowsPerPage: props.rowsPerPage,
    autoLoad: props.autoLoad,
    fileId: props.fileId
  })
  console.log('State:', {
    isLoading: isLoading.value,
    error: error.value,
    connectionId: connectionId.value,
    tableName: tableName.value,
    totalRows: totalRows.value,
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    hasResults: !!queryResults.value,
    resultsLength: queryResults.value?.length
  })
  console.log('Store State:', {
    isReady: duckDBStore.isReady,
    isInitializing: duckDBStore.isInitializing,
    activeConnections: duckDBStore.activeConnectionCount,
    loadedFilesCount: duckDBStore.loadedFiles.size
  })
}

// Watchers
watch(() => props.url, async (newUrl) => {
  if (newUrl && isConnected.value) {
    await loadCSVFile()
  }
})

// Lifecycle
onMounted(async () => {
  await initialize()
})

onUnmounted(async () => {
  if (connectionId.value) {
    console.log(`Cleaning up CSV viewer connection: ${connectionId.value}`)
    await duckDBStore.closeConnection(connectionId.value)
  }
})
</script>

<style scoped lang="scss">
@import "../../../assets/variables.scss";

.csv-viewer-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 20px;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;

  h2 {
    margin: 0;
    color: #333;
    font-size: 1.5rem;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 15px;
  }
}

.status-indicator {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  color: white;
  background-color: $gray_4;
  font-size: 0.9rem;

  &.loading {
    background-color: $gray_4;
  }

  &.connected {
    background-color: $green_2;
  }

  &.error {
    background-color: $red_2;
  }
}

.loading-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: #666;

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #2196f3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-panel {
  background: #ffebee;
  border: 1px solid #f44336;
  padding: 20px;
  margin: 20px 0;

  h3 {
    color: #d32f2f;
    margin-top: 0;
  }

  p {
    color: #c62828;
    margin: 10px 0;
  }
}

.data-panel {
  background: white;
  border: 1px solid #ddd;
  overflow: hidden;
}

.info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: $purple_tint;

  .row-count {
    font-weight: 500;
    color: #666;
  }

  .info-bar-controls {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .top-pagination {
    display: flex;
    align-items: center;
  }
}

.export-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background: #218838;
  }
}

.table-container {
  overflow-x: auto;
  max-height: 600px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;

  th, td {
    border: 1px solid #ddd;
    padding: 12px 8px;
    text-align: left;
  }

  th:first-child, td:first-child {
    border-left: 0;
  }

  th:last-child, td:last-child {
    border-right: 0;
  }

  th {
    background: #f8f9fa;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  tbody tr:hover {
    background: #f5f5f5;
  }

  tbody tr:nth-child(even) {
    background: #fafafa;
  }
}

.pagination-bottom {
  padding: 15px 20px;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: center;
  align-items: center;
}

.debug-btn, .retry-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;

  &:hover:not(:disabled) {
    background: #1976d2;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
}

.debug-btn {
  background: #9c27b0;
  font-size: 12px;
  padding: 6px 12px;

  &:hover {
    background: #7b1fa2;
  }
}

.retry-btn {
  background: #f44336;

  &:hover {
    background: #d32f2f;
  }
}

// Element Plus pagination customization
//:deep(.el-pagination) {
//  --el-color-primary: #2196f3;
//  --el-color-primary-light-3: rgba(33, 150, 243, 0.3);
//
//  .el-pagination__total {
//    color: #666;
//    font-weight: 500;
//  }
//
//  .el-pagination__sizes .el-select .el-input__inner {
//    border-color: #ddd;
//    font-size: 14px;
//  }
//
//  .el-pager li {
//    background-color: #f8f9fa;
//    border: 1px solid #ddd;
//    color: #333;
//
//    &:hover {
//      background-color: #e0e0e0;
//    }
//
//    &.is-active {
//      background-color: #2196f3;
//      border-color: #2196f3;
//      color: white;
//    }
//  }
//
//  .btn-prev, .btn-next {
//    background-color: #f8f9fa;
//    border: 1px solid #ddd;
//    color: #333;
//
//    &:hover:not(:disabled) {
//      background-color: #e0e0e0;
//    }
//
//    &:disabled {
//      background-color: #f5f5f5;
//      border-color: #e9ecef;
//      color: #ccc;
//    }
//  }
//
//  .el-pagination__jump {
//    color: #666;
//
//    .el-input__inner {
//      border-color: #ddd;
//      text-align: center;
//    }
//  }
//}
</style>