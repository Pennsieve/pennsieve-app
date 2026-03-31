<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'

const props = defineProps({
  nodeId: {
    type: String,
    required: true
  },
  isOwner: {
    type: Boolean,
    default: false
  }
})

const computeResourcesStore = useComputeResourcesStore()

const layerData = computed(() => computeResourcesStore.getNodeLayers(props.nodeId))
const layers = computed(() => layerData.value.layers || [])
const isLoading = computed(() => computeResourcesStore.isNodeLayersLoading(props.nodeId))

// Create layer form
const isCreating = ref(false)
const newLayerName = ref('')
const newLayerDescription = ref('')
const isSaving = ref(false)

const LAYER_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

const isValidName = computed(() => {
  return newLayerName.value && LAYER_NAME_PATTERN.test(newLayerName.value)
})

onMounted(async () => {
  await computeResourcesStore.fetchNodeLayers(props.nodeId)
})

function formatSize(sizeBytes) {
  if (!sizeBytes || sizeBytes === 0) return '\u2014'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatFileCount(count) {
  if (!count) return '\u2014'
  return count.toLocaleString()
}

function formatCost(usd) {
  if (usd === undefined || usd === null) return '\u2014'
  return `$${usd.toFixed(2)}`
}

function formatStorageClass(sc) {
  if (sc === 'INFREQUENT_ACCESS') return 'IA'
  if (sc === 'STANDARD') return 'Standard'
  return sc || '\u2014'
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function startCreating() {
  newLayerName.value = ''
  newLayerDescription.value = ''
  isCreating.value = true
}

function cancelCreating() {
  isCreating.value = false
  newLayerName.value = ''
  newLayerDescription.value = ''
}

async function createLayer() {
  if (!isValidName.value) {
    ElMessage.error('Layer name must be lowercase with dashes (e.g., hg38-reference)')
    return
  }

  isSaving.value = true
  try {
    await computeResourcesStore.createNodeLayer(props.nodeId, {
      layerName: newLayerName.value,
      description: newLayerDescription.value || undefined
    })
    ElMessage.success(`Layer "${newLayerName.value}" created`)
    isCreating.value = false
    newLayerName.value = ''
    newLayerDescription.value = ''
  } catch (err) {
    ElMessage.error(err.message || 'Failed to create layer')
  } finally {
    isSaving.value = false
  }
}

async function confirmDeleteLayer(layer) {
  try {
    await ElMessageBox.confirm(
      `Delete layer "${layer.layerName}"? This will remove the layer metadata. EFS data cleanup is handled separately.`,
      'Delete Layer',
      { confirmButtonText: 'Delete', cancelButtonText: 'Cancel', type: 'warning' }
    )
    await computeResourcesStore.deleteNodeLayer(props.nodeId, layer.layerName)
    ElMessage.success(`Layer "${layer.layerName}" deleted`)
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || 'Failed to delete layer')
    }
  }
}
</script>

<template>
  <div class="layers-container">
    <div class="layers-header">
      <div>
        <p class="layers-description">
          Persistent layers store reusable datasets on EFS that survive between workflow executions.
        </p>
      </div>
      <div class="layers-actions" v-if="isOwner && !isCreating">
        <button @click="startCreating" class="create-button">Create Layer</button>
      </div>
    </div>

    <!-- Create Layer Form -->
    <div v-if="isCreating" class="create-form">
      <div class="create-form-row">
        <div class="create-form-field">
          <label>Layer Name <span class="required">*</span></label>
          <input
            v-model="newLayerName"
            placeholder="hg38-reference"
            class="form-input"
            :class="{ invalid: newLayerName && !isValidName }"
          />
          <span class="form-hint">Lowercase letters, numbers, and dashes</span>
        </div>
        <div class="create-form-field grow">
          <label>Description</label>
          <input
            v-model="newLayerDescription"
            placeholder="Human reference genome GRCh38"
            class="form-input"
          />
        </div>
      </div>
      <div class="create-form-actions">
        <button @click="createLayer" :disabled="isSaving || !isValidName" class="save-button">
          {{ isSaving ? 'Creating...' : 'Create' }}
        </button>
        <button @click="cancelCreating" class="cancel-button">Cancel</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="layers-loading" v-loading="true" style="min-height: 80px;"></div>

    <!-- Layers Table -->
    <div v-else-if="layers.length > 0" class="layers-table-wrapper">
      <table class="layers-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Size</th>
            <th>Files</th>
            <th>Storage</th>
            <th>Cost/mo</th>
            <th>Last Accessed</th>
            <th>Created</th>
            <th v-if="isOwner"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="layer in layers" :key="layer.layerName">
            <td>
              <div class="layer-name">{{ layer.layerName }}</div>
              <div v-if="layer.description" class="layer-description">{{ layer.description }}</div>
            </td>
            <td>
              <span class="status-badge" :class="layer.status === 'READY' ? 'badge-green' : 'badge-yellow'">
                {{ layer.status }}
              </span>
            </td>
            <td>{{ formatSize(layer.sizeBytes) }}</td>
            <td>{{ formatFileCount(layer.fileCount) }}</td>
            <td>{{ formatStorageClass(layer.storageClass) }}</td>
            <td>{{ formatCost(layer.estimatedMonthlyCostUsd) }}</td>
            <td>{{ formatRelativeTime(layer.lastAccessed) }}</td>
            <td>{{ formatRelativeTime(layer.createdAt) }}</td>
            <td v-if="isOwner">
              <button class="delete-button" @click="confirmDeleteLayer(layer)" title="Delete layer">&times;</button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="footer-label">Total</td>
            <td>{{ formatSize(layers.reduce((sum, l) => sum + (l.sizeBytes || 0), 0)) }}</td>
            <td></td>
            <td></td>
            <td>{{ formatCost(layerData.totalEstimatedMonthlyCostUsd) }}</td>
            <td :colspan="isOwner ? 3 : 2"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Empty State -->
    <div v-else class="layers-empty">
      No persistent layers configured. Create a layer and populate it by running a workflow with a <code>persistent-layer</code> data target.
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.layers-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.layers-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;

  .layers-description {
    font-size: 13px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.4;
  }
}

.layers-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.create-button,
.save-button,
.cancel-button {
  background: theme.$purple_1;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: theme.$purple_2;
  }

  &:disabled {
    background: theme.$gray_4;
    cursor: not-allowed;
  }
}

.cancel-button {
  background: theme.$gray_4;

  &:hover {
    background: theme.$gray_5;
  }
}

// Create form
.create-form {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 16px;
  background: theme.$gray_1;
}

.create-form-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.create-form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &.grow {
    flex: 1;
  }

  label {
    font-size: 12px;
    font-weight: 600;
    color: theme.$gray_5;

    .required {
      color: theme.$red_1;
    }
  }

  .form-hint {
    font-size: 11px;
    color: theme.$gray_4;
  }
}

.form-input {
  padding: 6px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  font-size: 13px;
  color: theme.$gray_6;
  background: white;

  &:focus {
    outline: none;
    border-color: theme.$purple_1;
    box-shadow: 0 0 0 2px rgba(theme.$purple_1, 0.2);
  }

  &.invalid {
    border-color: theme.$red_1;
  }
}

.create-form-actions {
  display: flex;
  gap: 8px;
}

// Table
.layers-table-wrapper {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  overflow: hidden;
}

.layers-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  th {
    text-align: left;
    padding: 8px 12px;
    background: theme.$gray_1;
    border-bottom: 1px solid theme.$gray_2;
    font-size: 11px;
    font-weight: 600;
    color: theme.$gray_5;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  td {
    padding: 10px 12px;
    border-bottom: 1px solid theme.$gray_1;
    color: theme.$gray_6;
    vertical-align: top;
  }

  tbody tr:hover {
    background: rgba(theme.$gray_1, 0.5);
  }

  tfoot td {
    padding: 8px 12px;
    background: theme.$gray_1;
    border-top: 1px solid theme.$gray_2;
    border-bottom: none;
    font-weight: 600;
    font-size: 12px;
    color: theme.$gray_5;
  }
}

.layer-name {
  font-family: 'Courier New', monospace;
  font-weight: 500;
  color: theme.$gray_6;
}

.layer-description {
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 2px;
}

.footer-label {
  text-align: right;
}

// Status badges
.status-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.badge-green {
    background: rgba(23, 187, 98, 0.12);
    color: #17BB62;
  }

  &.badge-yellow {
    background: #fef3cd;
    color: #856404;
  }
}

.delete-button {
  background: none;
  border: none;
  font-size: 20px;
  line-height: 1;
  color: theme.$gray_4;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.2s ease;

  &:hover {
    color: theme.$red_1;
  }
}

.layers-empty {
  padding: 24px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
  background: theme.$gray_1;
  border-radius: 6px;

  code {
    background: theme.$gray_2;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 13px;
  }
}
</style>
