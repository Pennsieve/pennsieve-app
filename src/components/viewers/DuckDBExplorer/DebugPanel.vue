<!-- DebugPanel.vue - Optional debug component for monitoring resources -->
<template>
  <div class="debug-panel" v-if="showDebug">
    <div class="debug-header">
      <h3>DuckDB Resource Monitor</h3>
      <button @click="toggleDebug" class="toggle-btn">
        {{ showDetails ? 'Hide Details' : 'Show Details' }}
      </button>
      <button @click="refreshData" class="refresh-btn">Refresh</button>
    </div>

    <div class="debug-stats">
      <div class="stat-card">
        <h4>Connections</h4>
        <div class="stat-value">{{ duckDBStore.activeConnectionCount }}</div>
        <div class="stat-label">Active</div>
      </div>

      <div class="stat-card">
        <h4>Files</h4>
        <div class="stat-value">{{ duckDBStore.loadedFiles.size }}</div>
        <div class="stat-label">Loaded</div>
      </div>

      <div class="stat-card">
        <h4>Status</h4>
        <div class="stat-value" :class="{ ready: duckDBStore.isReady, loading: duckDBStore.isInitializing }">
          {{ duckDBStore.isReady ? '●' : duckDBStore.isInitializing ? '◐' : '○' }}
        </div>
        <div class="stat-label">
          {{ duckDBStore.isReady ? 'Ready' : duckDBStore.isInitializing ? 'Loading' : 'Offline' }}
        </div>
      </div>
    </div>

    <div v-if="showDetails" class="debug-details">
      <!-- Active Connections -->
      <div class="detail-section">
        <h4>Active Connections</h4>
        <div v-if="connectionInfo.length === 0" class="empty-state">
          No active connections
        </div>
        <div v-else class="connection-list">
          <div v-for="conn in connectionInfo" :key="conn.connectionId" class="connection-item">
            <div class="connection-header">
              <strong>{{ conn.viewerId }}</strong>
              <span class="connection-time">{{ formatTime(conn.createdAt) }}</span>
              <button
                @click="forceCloseConnection(conn.connectionId)"
                class="close-btn"
                title="Force close connection"
              >
                ×
              </button>
            </div>
            <div class="connection-id">ID: {{ conn.connectionId }}</div>
          </div>
        </div>
      </div>

      <!-- Loaded Files -->
      <div class="detail-section">
        <h4>Loaded Files</h4>
        <div v-if="fileUsageInfo.length === 0" class="empty-state">
          No files loaded
        </div>
        <div v-else class="file-list">
          <div v-for="file in fileUsageInfo" :key="file.fileUrl" class="file-item">
            <div class="file-header">
              <strong>{{ file.tableName }}</strong>
              <span class="file-type">{{ file.fileType.toUpperCase() }}</span>
              <button
                @click="forceUnloadFile(file.fileUrl)"
                class="close-btn"
                :disabled="file.usedByViewers.length > 0"
                title="Force unload file"
              >
                🗑
              </button>
            </div>
            <div class="file-details">
              <div>{{ file.rowCount?.toLocaleString() }} rows</div>
              <div>Loaded: {{ formatTime(file.loadedAt) }}</div>
              <div>Used by: {{ file.usedByViewers.length }} viewer(s)</div>
            </div>
            <div v-if="file.usedByViewers.length > 0" class="file-viewers">
              <span v-for="viewerId in file.usedByViewers" :key="viewerId" class="viewer-tag">
                {{ viewerId }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="debug-actions">
      <button @click="performGlobalCleanup" class="cleanup-btn" :disabled="!canCleanup">
        Force Global Cleanup
      </button>
      <button @click="logAllInfo" class="log-btn">
        Log to Console
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDuckDBStore } from '@/stores/duckdbStore'

const props = defineProps({
  autoRefresh: {
    type: Boolean,
    default: true
  },
  refreshInterval: {
    type: Number,
    default: 2000
  }
})

const duckDBStore = useDuckDBStore()

const showDebug = ref(true)
const showDetails = ref(false)
const connectionInfo = ref([])
const fileUsageInfo = ref([])
const refreshTimer = ref(null)

const canCleanup = computed(() => duckDBStore.isReady)

const toggleDebug = () => {
  showDetails.value = !showDetails.value
}

const refreshData = () => {
  connectionInfo.value = duckDBStore.getConnectionInfo()
  fileUsageInfo.value = duckDBStore.getFileUsageInfo()
}

const formatTime = (date) => {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleTimeString()
}

const forceCloseConnection = async (connectionId) => {
  try {
    await duckDBStore.closeConnection(connectionId)
    refreshData()
  } catch (err) {
    console.error('Failed to close connection:', err)
  }
}

const forceUnloadFile = async (fileUrl) => {
  try {
    await duckDBStore.unloadFile(fileUrl)
    refreshData()
  } catch (err) {
    console.error('Failed to unload file:', err)
  }
}

const performGlobalCleanup = async () => {
  if (confirm('This will close all connections and terminate DuckDB. Are you sure?')) {
    try {
      await duckDBStore.performGlobalCleanup()
      refreshData()
    } catch (err) {
      console.error('Failed to perform global cleanup:', err)
    }
  }
}

const logAllInfo = () => {
  console.group('DuckDB Store Debug Info')
  console.log('Store State:', {
    isReady: duckDBStore.isReady,
    isInitializing: duckDBStore.isInitializing,
    activeConnections: duckDBStore.activeConnectionCount,
    loadedFiles: duckDBStore.loadedFiles.size
  })
  console.log('Connections:', connectionInfo.value)
  console.log('Files:', fileUsageInfo.value)
  console.groupEnd()
}

const startAutoRefresh = () => {
  if (props.autoRefresh && !refreshTimer.value) {
    refreshTimer.value = setInterval(refreshData, props.refreshInterval)
  }
}

const stopAutoRefresh = () => {
  if (refreshTimer.value) {
    clearInterval(refreshTimer.value)
    refreshTimer.value = null
  }
}

onMounted(() => {
  refreshData()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped lang="scss">
.debug-panel {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  font-size: 13px;
  z-index: 1000;
  max-height: 80vh;
  overflow-y: auto;
}

.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;

  h3 {
    margin: 0;
    font-size: 14px;
    color: #333;
  }
}

.toggle-btn, .refresh-btn, .close-btn, .cleanup-btn, .log-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  margin-left: 5px;

  &:hover:not(:disabled) {
    background: #0056b3;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
}

.close-btn {
  background: #dc3545;
  padding: 2px 6px;

  &:hover:not(:disabled) {
    background: #c82333;
  }
}

.cleanup-btn {
  background: #ffc107;
  color: #212529;

  &:hover:not(:disabled) {
    background: #e0a800;
  }
}

.debug-stats {
  display: flex;
  padding: 12px 16px;
  gap: 12px;
}

.stat-card {
  flex: 1;
  text-align: center;

  h4 {
    margin: 0 0 4px 0;
    font-size: 11px;
    color: #666;
    text-transform: uppercase;
  }

  .stat-value {
    font-size: 18px;
    font-weight: bold;
    color: #333;

    &.ready { color: #28a745; }
    &.loading { color: #ffc107; }
  }

  .stat-label {
    font-size: 10px;
    color: #888;
    margin-top: 2px;
  }
}

.debug-details {
  border-top: 1px solid #eee;
  max-height: 300px;
  overflow-y: auto;
}

.detail-section {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;

  h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: #555;
  }
}

.empty-state {
  color: #888;
  font-style: italic;
  font-size: 11px;
}

.connection-list, .file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.connection-item, .file-item {
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.connection-header, .file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;

  strong {
    color: #333;
    font-size: 12px;
  }
}

.connection-time, .file-type {
  font-size: 10px;
  color: #666;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 2px;
}

.connection-id {
  font-family: monospace;
  font-size: 10px;
  color: #666;
}

.file-details {
  font-size: 10px;
  color: #666;
  line-height: 1.3;
}

.file-viewers {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.viewer-tag {
  background: #007bff;
  color: white;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 9px;
}

.debug-actions {
  padding: 12px 16px;
  background: #f8f9fa;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
}
</style>