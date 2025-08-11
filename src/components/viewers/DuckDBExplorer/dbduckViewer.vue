<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Data Explorer</h1>
      <div class="status-indicator" :class="{ connected: isConnected, loading: isLoading }">
        {{ statusText }}
      </div>
    </header>

    <div class="dashboard-content">

<!--      &lt;!&ndash; CSV Options (only shown for CSV files) &ndash;&gt;-->
<!--      <div class="form-group" v-if="props.fileType === 'csv'">-->
<!--        <label>CSV Options:</label>-->
<!--        <div class="csv-options">-->
<!--          <label class="checkbox-label">-->
<!--            <input type="checkbox" v-model="csvOptions.header" />-->
<!--            First row contains headers-->
<!--          </label>-->
<!--          <label class="checkbox-label">-->
<!--            <input type="checkbox" v-model="csvOptions.dynamicTyping" />-->
<!--            Auto-detect data types-->
<!--          </label>-->
<!--          <div class="delimiter-group">-->
<!--            <label for="delimiter">Delimiter:</label>-->
<!--            <select id="delimiter" v-model="csvOptions.delimiter" class="delimiter-select">-->
<!--              <option value=",">Comma (,)</option>-->
<!--              <option value=";">Semicolon (;)</option>-->
<!--              <option value="\t">Tab</option>-->
<!--              <option value="|">Pipe (|)</option>-->
<!--            </select>-->
<!--          </div>-->
<!--        </div>-->
<!--      </div>-->

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
          placeholder="SELECT * FROM my_data LIMIT 10;"
          class="query-textarea"
          rows="4"
        ></textarea>
        <bf-button
          @click="executeQuery"
          :disabled="isQueryRunning || !sqlQuery"
          class="execute-btn"
        >
          {{ isQueryRunning ? 'Running...' : 'Execute Query' }}
        </bf-button>
      </div>

      <!-- Results Panel -->
      <div class="results-panel" v-if="queryResults">
        <h3>Results ({{ queryResults.length }} rows)</h3>
        <div class="results-controls">
          <button @click="exportToCsv" class="export-btn">Export to CSV</button>
          <select v-model="displayMode" class="display-mode">
            <option value="table">Table View</option>
            <option value="json">JSON View</option>
          </select>
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

          <!-- Pagination -->
          <div class="pagination" v-if="totalPages > 1">
            <button
              @click="currentPage--"
              :disabled="currentPage === 1"
              class="page-btn"
            >
              Previous
            </button>
            <span class="page-info">
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <button
              @click="currentPage++"
              :disabled="currentPage === totalPages"
              class="page-btn"
            >
              Next
            </button>
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

const props = defineProps({
  url: {
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    default: 'parquet',
    validator: (value) => ['parquet', 'csv'].includes(value)
  }
})

// CSV-specific state
const csvOptions = ref({
  header: true,
  dynamicTyping: true,
  delimiter: ','
})

// Reactive state
const isConnected = ref(false)
const isLoading = ref(false)
const isQueryRunning = ref(false)
const s3Url = ref('')
const tableName = ref('my_data')
const sqlQuery = ref('')
const queryResults = ref(null)
const error = ref('')
const db = ref(null)
const conn = ref(null)
const displayMode = ref('table')
const currentPage = ref(1)
const itemsPerPage = ref(50)

watch(() => props.url, (newValue, oldValue) => {
  s3Url.value = newValue
})

// Computed properties
const statusText = computed(() => {
  if (isLoading.value) return 'Loading...'
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
  const table = tableName.value || 'my_data'
  return [
    { name: 'Show All', query: `SELECT * FROM ${table} LIMIT 100;` },
    { name: 'Count Rows', query: `SELECT COUNT(*) as row_count FROM ${table};` },
    { name: 'Group By', query: `SELECT
    <variablle 1>, <variable 2>,
    COUNT(*) as count
FROM my_data
GROUP BY <variablle 1>, <variable 2>
ORDER BY <variablle 1>, <variable 2>;`},
    { name: 'Describe', query: `DESCRIBE ${table};` },
    { name: 'Sample', query: `SELECT * FROM ${table} USING SAMPLE 10;` }
  ]
})

// Initialize DuckDB (fallback approach for development)
const initDuckDB = async () => {
  try {
    // Import DuckDB-WASM from npm package
    const duckdb = await import('@duckdb/duckdb-wasm')

    // Try different bundle approaches in order of preference
    let bundle, worker, db_instance

    try {
      // Approach 1: Try JSDelivr bundles (best for production)
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
      bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)
      worker = await duckdb.createWorker(bundle.mainWorker)
    } catch (e) {
      console.log('JSDelivr bundles failed, trying manual approach...')

      // Approach 2: Manual bundle configuration
      const MANUAL_BUNDLES = {
        mvp: {
          mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-mvp.wasm',
          mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-mvp.worker.js',
        },
        eh: {
          mainModule: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-eh.wasm',
          mainWorker: 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.28.0/dist/duckdb-browser-eh.worker.js',
        },
      }
      bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
      worker = new Worker(bundle.mainWorker)
    }

    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)

    db.value = new duckdb.AsyncDuckDB(logger, worker)
    await db.value.instantiate(bundle.mainModule)

    conn.value = await db.value.connect()

    console.log('DuckDB initialized successfully')

    loadFile()

  } catch (err) {
    console.error('Failed to initialize DuckDB:', err)
    error.value = `Failed to initialize DuckDB: ${err.message}.

    Try adding these headers to your vite.config.js:
    server: {
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    }`
  }
}

// Load file (auto-detects Parquet or CSV)
const loadFile = async () => {
  if (!s3Url.value || !conn.value) {
    error.value = 'Please provide a valid S3 URL and ensure DuckDB is initialized'
    return
  }

  const fileType = props.fileType

  isLoading.value = true
  error.value = ''

  try {
    if (fileType === 'csv') {
      await loadCsvFile()
    } else if (fileType === 'parquet') {
      await loadParquetFile()
    }
  } catch (err) {
    console.error('Failed to load file:', err)
    error.value = `Failed to load ${fileType} file: ${err.message}`
    isConnected.value = false
  } finally {
    isLoading.value = false
  }
}

// Load CSV file from S3
const loadCsvFile = async () => {
  console.log('Downloading CSV file from S3...')

  const response = await fetch(s3Url.value)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
  }

  const fileText = await response.text()
  console.log(`Downloaded ${fileText.length} characters`)

  // Create buffer and register with DuckDB
  const blob = new Blob([fileText], { type: 'text/csv' })
  const arrayBuffer = await blob.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  const fileName = `${tableName.value}.csv`
  await db.value.registerFileBuffer(fileName, uint8Array)

  // Create table from CSV file using basic read_csv syntax
  const createTableQuery = `
    CREATE OR REPLACE TABLE ${tableName.value} AS
    SELECT * FROM read_csv('${fileName}', header=${csvOptions.value.header}, delim='${csvOptions.value.delimiter}');
  `

  console.log('Executing query:', createTableQuery)
  await conn.value.query(createTableQuery)

  // Verify the table was created
  const result = await conn.value.query(`SELECT COUNT(*) as count FROM ${tableName.value};`)
  const rowCount = result.toArray()[0].count

  isConnected.value = true
  console.log(`Successfully loaded ${rowCount} rows from CSV file`)

  // Auto-execute a sample query
  setQuery(`SELECT * FROM ${tableName.value} LIMIT 10;`)
}

// Load Parquet file from S3
const loadParquetFile = async () => {
  if (!s3Url.value || !conn.value) {
    error.value = 'Please provide a valid S3 URL and ensure DuckDB is initialized'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    // Download the Parquet file from S3 using fetch
    console.log('Downloading Parquet file from S3...')
    const response = await fetch(s3Url.value)

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    console.log(`Downloaded ${uint8Array.length} bytes`)

    // Register the file with DuckDB
    await db.value.registerFileBuffer(`${tableName.value}.parquet`, uint8Array)

    // Create table from the registered Parquet file
    const createTableQuery = `
      CREATE OR REPLACE TABLE ${tableName.value} AS
      SELECT * FROM read_parquet('${tableName.value}.parquet');
    `

    await conn.value.query(createTableQuery)

    // Verify the table was created
    const result = await conn.value.query(`SELECT COUNT(*) as count FROM ${tableName.value};`)
    const rowCount = result.toArray()[0].count

    isConnected.value = true

    console.log(`Successfully loaded ${rowCount} rows from Parquet file`)

    // Auto-execute a sample query
    setQuery(`SELECT * FROM ${tableName.value} LIMIT 10;`)

  } catch (err) {
    console.error('Failed to load Parquet file:', err)

    // Provide more helpful error messages
    let errorMsg = err.message
    if (err.message.includes('CORS')) {
      errorMsg += '\n\nThis might be a CORS issue. Make sure your S3 bucket allows cross-origin requests from your domain.'
    } else if (err.message.includes('Failed to fetch')) {
      errorMsg += '\n\nCheck that the presigned URL is valid and not expired.'
    }

    error.value = `Failed to load Parquet file: ${errorMsg}`
    isConnected.value = false
  } finally {
    isLoading.value = false
  }
}

// Execute SQL query
const executeQuery = async () => {
  if (!sqlQuery.value || !conn.value) {
    error.value = 'Please provide a valid SQL query'
    return
  }

  isQueryRunning.value = true
  error.value = ''
  currentPage.value = 1

  try {
    const result = await conn.value.query(sqlQuery.value)
    const rawResults = result.toArray()

    // Convert to plain JavaScript objects to avoid proxy issues
    queryResults.value = rawResults.map(row => {
      const plainRow = {}
      for (const [key, value] of Object.entries(row)) {
        plainRow[key] = value
      }
      return plainRow
    })

    console.log(`Query executed successfully, returned ${queryResults.value.length} rows`)
  } catch (err) {
    console.error('Query execution failed:', err)
    error.value = `Query execution failed: ${err.message}`
    queryResults.value = null
  } finally {
    isQueryRunning.value = false
  }
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

// Lifecycle hooks
onMounted(() => {
  initDuckDB()
})

onUnmounted(() => {
  if (conn.value) {
    conn.value.close()
  }
  if (db.value) {
    db.value.terminate()
  }
})
</script>

<style scoped lang="scss">

.dashboard-container {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
  background-color: #4caf50;
}

.dashboard-content {
  display: grid;
  gap: 25px;
}

.config-panel, .query-panel, .results-panel, .error-panel {
  background: white;
  width: inherit;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: scroll;

}

.config-panel h3, .query-panel h3, .results-panel h3, .error-panel h3 {
  margin-top: 0;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
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

.url-input:focus, .table-input:focus, .query-textarea:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

//.load-btn, .execute-btn, .example-btn, .export-btn, .clear-error-btn, .page-btn {
//  background: #2196f3;
//  color: white;
//  border: none;
//  padding: 10px 20px;
//  border-radius: 4px;
//  cursor: pointer;
//  font-size: 14px;
//  transition: background-color 0.2s;
//}

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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
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
</style>