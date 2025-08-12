<!-- dbduckViewer.vue - Updated with Element Plus pagination -->
<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Data Explorer</h1>
      <div class="status-indicator" :class="{ connected: isConnected, loading: isLoading }">
        {{ statusText }}
      </div>
    </header>

    <div class="dashboard-content">
      <!-- Query Panel -->
      <div class="query-panel" v-if="isConnected">
        <h3>SQL Query</h3>
        <div class="query-examples">
          <span>Quick queries:</span>
          <button
            v-for="example in queryExamples"
            :key="example.name"
            @click="setQuery(example.query)"
            class="example-btn"
          >
            {{ example.name }}
          </button>
        </div>
        <textarea
          v-model="sqlQuery"
          placeholder="SELECT * FROM data LIMIT 10;"
          class="query-textarea"
          rows="4"
        ></textarea>
        <bf-button
          @click="executeQuery"
          :disabled="isQueryRunning || !sqlQuery"
        >
          {{ isQueryRunning ? 'Running...' : 'Execute Query' }}
        </bf-button>
      </div>

      <!-- Results Panel -->
      <div class="results-panel" v-if="queryResults">
        <h3>Results ({{ queryResults.length }} rows)</h3>
        <div class="results-controls">
          <div class="left-controls">
            <bf-button class='secondary' @click="exportToCsv">Export to CSV</bf-button>

          </div>
          <div class="right-controls">
            <el-pagination
              v-if="displayMode === 'table' && totalPages > 1"
              v-model:current-page="currentPage"
              :page-size="itemsPerPage"
              :total="queryResults.length"
              layout="prev, pager, next"
              @current-change="handlePageChange"
              class="results-pagination"
            />
          </div>
        </div>
        <div class="pagination-wrapper">

        </div>


        <!-- Table View -->
        <div v-if="displayMode === 'table'" class="table-container">
          <table class="results-table">
            <thead>
            <tr>
              <th v-for="column in tableColumns" :key="column">{{ column }}</th>
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

          <!-- Bottom Pagination for large datasets -->
          <div v-if="totalPages > 1" class="bottom-pagination">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="itemsPerPage"
              :total="queryResults.length"
              layout=" prev, pager, next"
              :page-sizes="[25, 50, 100, 200, 500]"
              @current-change="handlePageChange"
              @size-change="handleSizeChange"
            />
          </div>
        </div>

        <!-- JSON View -->
        <div v-else class="json-container">
          <pre>{{ JSON.stringify(queryResults.slice(0, 100), null, 2) }}</pre>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="error-panel">
        <h3>Error</h3>
        <p>{{ error }}</p>
        <button @click="clearError" class="clear-error-btn">Clear</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineProps, watch } from 'vue'
import { useDuckDBStore } from '@/stores/duckdbStore'

const props = defineProps({
  url: {
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    default: 'parquet',
    validator: (value) => ['parquet', 'csv'].includes(value)
  },
  viewerId: {
    type: String,
    default: () => `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  fileId: {
    type: String,
    default: null // Stable file identifier for reuse
  }
})

// Use DuckDB store
const duckDBStore = useDuckDBStore()

// CSV-specific state
const csvOptions = ref({
  header: true,
  dynamicTyping: true,
  delimiter: ','
})

// Reactive state
const isLoading = ref(false)
const isQueryRunning = ref(false)
const s3Url = ref(props.url)
const tableName = ref('my_data')
const sqlQuery = ref('')
const queryResults = ref(null)
const error = ref('')
const displayMode = ref('table')
const currentPage = ref(1)
const itemsPerPage = ref(50)
const connectionId = ref(null)

// Watch for URL changes
watch(() => props.url, (newValue) => {
  s3Url.value = newValue
  if (newValue) {
    loadFile()
    executeQuery()
  }
})

// Computed properties
const isConnected = computed(() => {
  return duckDBStore.isReady && connectionId.value && !isLoading.value
})

const statusText = computed(() => {
  if (isLoading.value) return 'Loading...'
  if (duckDBStore.isInitializing) return 'Initializing...'
  if (!duckDBStore.isReady) return 'Not Ready'
  if (isConnected.value) return 'Connected'
  return 'Not Connected'
})

const tableColumns = computed(() => {
  if (!queryResults.value || !Array.isArray(queryResults.value) || queryResults.value.length === 0) return []
  return Object.keys(queryResults.value[0] || {})
})

const totalPages = computed(() => {
  if (!queryResults.value || !Array.isArray(queryResults.value)) return 0
  return Math.ceil(queryResults.value.length / itemsPerPage.value)
})

const paginatedResults = computed(() => {
  if (!queryResults.value || !Array.isArray(queryResults.value)) return []
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return queryResults.value.slice(start, end)
})

const queryExamples = computed(() => {
  return [
    { name: 'Show All', query: `SELECT * FROM data LIMIT 100;` },
    { name: 'Count Rows', query: `SELECT COUNT(*) as row_count FROM data;` },
    { name: 'Group By', query: `SELECT
                                  column1, column2,
                                  COUNT(*) as count
                                FROM data
                                GROUP BY column1, column2
                                ORDER BY column1, column2
                                LIMIT 20;`},
    { name: 'Describe', query: `DESCRIBE data;` },
    { name: 'Sample', query: `SELECT * FROM data USING SAMPLE 10;` },
    { name: 'Columns', query: `PRAGMA table_info(data);` }
  ]
})

// Debug info (can be removed in production)
const debugInfo = computed(() => ({
  viewerId: props.viewerId,
  fileId: props.fileId,
  connectionId: connectionId.value,
  tableName: tableName.value,
  isConnected: isConnected.value,
  activeConnections: duckDBStore.activeConnectionCount,
  hasActiveConnections: duckDBStore.hasActiveConnections
}))

// Initialize connection and load file
const initialize = async () => {
  try {
    // Create a connection for this viewer instance
    const { connection, connectionId: connId } = await duckDBStore.createConnection(props.viewerId)
    connectionId.value = connId

    console.log(`Viewer ${props.viewerId} connected with connection ID: ${connId}`)

    // Load file if URL is provided
    if (s3Url.value) {
      await loadFile()
      executeQuery()
    }
  } catch (err) {
    console.error('Failed to initialize viewer:', err)
    error.value = `Failed to initialize: ${err.message}`
  }
}

// Load file using the store
const loadFile = async () => {
  if (!s3Url.value) {
    error.value = 'Please provide a valid S3 URL'
    return
  }

  console.log('Loading file:', s3Url.value)
  console.log('Using stable file ID:', props.fileId)

  // Check if file is already loaded using stable ID
  const stableKey = props.fileId || s3Url.value
  const existingFile = duckDBStore.getLoadedFile(stableKey)
  if (existingFile && !existingFile.isLoading && !existingFile.error) {
    tableName.value = existingFile.tableName
    console.log(`File already loaded using stable key, reusing table: ${tableName.value}`)
    setQuery(`SELECT * FROM data LIMIT 10;`)
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    // Generate table name using stable ID if available
    const tableId = props.fileId ? `file_${props.fileId}` : `data_${Date.now()}`

    // Use store to load file (will be shared across all viewers with same fileId)
    const loadedTableName = await duckDBStore.loadFile(
      s3Url.value,
      props.fileType,
      tableId, // Stable table name
      csvOptions.value,
      props.viewerId, // Pass viewer ID for tracking
      props.fileId // Pass stable file ID
    )

    tableName.value = loadedTableName
    console.log(`File loaded as table: ${tableName.value}`)

    // Auto-execute a sample query using "data"
    setQuery(`SELECT * FROM data LIMIT 10;`)

  } catch (err) {
    console.error('Failed to load file:', err)
    error.value = `Failed to load ${props.fileType} file: ${err.message}`
  } finally {
    isLoading.value = false
  }
}

// Query interceptor to replace "data" with actual table name
const interceptQuery = (query) => {
  if (!tableName.value || !query) return query

  console.log('Original query:', query)

  // Replace "data" table references with actual table name
  // This handles various SQL patterns:
  // - FROM data
  // - JOIN data
  // - UPDATE data
  // - INSERT INTO data
  // - table_info(data)
  const interceptedQuery = query
    .replace(/\bFROM\s+data\b/gi, `FROM ${tableName.value}`)
    .replace(/\bJOIN\s+data\b/gi, `JOIN ${tableName.value}`)
    .replace(/\bUPDATE\s+data\b/gi, `UPDATE ${tableName.value}`)
    .replace(/\bINSERT\s+INTO\s+data\b/gi, `INSERT INTO ${tableName.value}`)
    .replace(/\bINTO\s+data\b/gi, `INTO ${tableName.value}`)
    .replace(/\btable_info\(\s*data\s*\)/gi, `table_info(${tableName.value})`)
    .replace(/\bDESCRIBE\s+data\b/gi, `DESCRIBE ${tableName.value}`)
    .replace(/\bPRAGMA\s+table_info\(\s*data\s*\)/gi, `PRAGMA table_info(${tableName.value})`)

  if (interceptedQuery !== query) {
    console.log('Intercepted query:', interceptedQuery)
    console.log(`Replaced "data" references with "${tableName.value}"`)
  }

  return interceptedQuery
}

// Execute SQL query using store
const executeQuery = async () => {
  if (!sqlQuery.value || !connectionId.value) {
    error.value = 'Please provide a valid SQL query'
    return
  }

  if (!tableName.value) {
    error.value = 'No data table loaded'
    return
  }

  isQueryRunning.value = true
  error.value = ''
  currentPage.value = 1

  try {
    // Intercept and transform the query
    const transformedQuery = interceptQuery(sqlQuery.value.trim())

    console.log('Executing transformed query:', transformedQuery)
    queryResults.value = await duckDBStore.executeQuery(transformedQuery, connectionId.value)
    console.log(`Query executed successfully, returned ${queryResults.value.length} rows`)
  } catch (err) {
    console.error('Query execution failed:', err)
    error.value = `Query execution failed: ${err.message}`
    queryResults.value = null
  } finally {
    isQueryRunning.value = false
  }
}

// Pagination event handlers for Element Plus
const handlePageChange = (page) => {
  console.log('Page changed to:', page)
  currentPage.value = page
}

const handleSizeChange = (newSize) => {
  console.log('Page size changed to:', newSize)
  itemsPerPage.value = newSize
  currentPage.value = 1 // Reset to first page when changing size
}

// Set predefined query
const setQuery = (query) => {
  sqlQuery.value = query
}

// Format cell values for display
const formatCellValue = (value) => {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value.toString() : value.toFixed(4)
  }
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...'
  }
  return value.toString()
}

// Export results to CSV
const exportToCsv = () => {
  if (!queryResults.value || queryResults.value.length === 0) return

  const headers = Object.keys(queryResults.value[0])
  const csvContent = [
    headers.join(','),
    ...queryResults.value.map(row =>
      headers.map(header => {
        const value = row[header]
        const stringValue = value === null || value === undefined ? '' : value.toString()
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'query-results.csv'
  link.click()
  URL.revokeObjectURL(url)
}

// Clear error
const clearError = () => {
  error.value = ''
}

// Debug method (optional)
const logDebugInfo = () => {
  console.log('Viewer Debug Info:', debugInfo.value)
  console.log('Store Connection Info:', duckDBStore.getConnectionInfo())
  console.log('Store File Usage Info:', duckDBStore.getFileUsageInfo())
}

// Lifecycle hooks
onMounted(async () => {
  await initialize()
})

onUnmounted(async () => {
  // Clean up this viewer's connection
  if (connectionId.value) {
    console.log(`Cleaning up viewer ${props.viewerId}...`)

    const beforeCleanup = {
      activeConnections: duckDBStore.activeConnectionCount,
      loadedFiles: duckDBStore.loadedFiles.size
    }

    await duckDBStore.closeConnection(connectionId.value)

    const afterCleanup = {
      activeConnections: duckDBStore.activeConnectionCount,
      loadedFiles: duckDBStore.loadedFiles.size
    }

    console.log(`Viewer ${props.viewerId} cleanup complete:`, {
      beforeCleanup,
      afterCleanup,
      hasActiveConnections: duckDBStore.hasActiveConnections
    })

    // If this was the last viewer and you want automatic global cleanup:
    // if (!duckDBStore.hasActiveConnections) {
    //   console.log('Last viewer closed, performing global cleanup...')
    //   await duckDBStore.performGlobalCleanup()
    // }
  }
})
</script>

<style scoped lang="scss">
@import "../../../assets/variables.scss";

.dashboard-container {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  padding: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
}

.dashboard-header h1 {
  margin: 0;
  color: #333;
}

.status-indicator {
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  color: white;
  background-color: #666;
}

.status-indicator.loading {
  background-color: #ff9800;
}

.status-indicator.connected {
  background-color: $green_2;
}

.dashboard-content {
  display: grid;
  gap: 25px;
}

.config-panel, .query-panel, .results-panel, .error-panel {
  background: white;
  width: inherit;
  border: 1px solid #ddd;
  padding: 20px;
  overflow: scroll;
}

.config-panel h3, .query-panel h3, .results-panel h3, .error-panel h3 {
  margin-top: 0;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.query-info {
  background: #e8f4fd;
  border: 1px solid #bee5eb;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 15px;
}

.query-info .info-text {
  color: #0c5460;
  font-size: 14px;
  font-weight: 500;
}

.pagination-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: end;
}

.query-info .info-text code {
  background: #d1ecf1;
  color: #0c5460;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #555;
}

.url-input, .table-input, .query-textarea, .display-mode {
  width: calc(100% - 16px);
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin: 8px 0;
}

.query-textarea {
  font-family: 'Courier New', monospace;
  resize: vertical;
  min-height: 100px;
}

.url-input:focus, .table-input:focus, .query-textarea:focus {
  outline: none;
  border-color: #2196f3;
}

.load-btn, .execute-btn, .example-btn, .export-btn, .clear-error-btn, .page-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.load-btn:hover, .execute-btn:hover, .export-btn:hover, .clear-error-btn:hover, .page-btn:hover {
  background: #1976d2;
}

.load-btn:disabled, .execute-btn:disabled, .page-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.query-examples {
  margin-bottom: 15px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.query-examples span {
  font-weight: 500;
  color: #666;
}

.example-btn {
  background: #f5f5f5;
  color: #333;
  padding: 6px 12px;
  font-size: 12px;
}

.example-btn:hover {
  background: #e0e0e0;
}

.results-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.left-controls {
  display: flex;
  align-items: center;
}

.right-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.results-pagination {
  margin-right: 20px;
}

.table-container {
  overflow-x: auto;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.results-table th, .results-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.results-table th {
  background: #f8f9fa;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.results-table tbody tr:hover {
  background: #f5f5f5;
}

.bottom-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px 0;
  margin-top: 20px;
  border-top: 1px solid #e9ecef;
}

.page-info {
  font-weight: 500;
  color: #666;
}

.json-container {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 15px;
  max-height: 400px;
  overflow: auto;
}

.json-container pre {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
}

.error-panel {
  border-color: #f44336;
  background: #ffebee;
}

.error-panel h3 {
  color: #d32f2f;
}

.error-panel p {
  color: #c62828;
  margin: 10px 0;
}

.clear-error-btn {
  background: #f44336;
}

.clear-error-btn:hover {
  background: #d32f2f;
}

//// Element Plus pagination customization
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