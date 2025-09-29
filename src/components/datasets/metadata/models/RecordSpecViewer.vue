<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElCard, ElTag, ElMessage, ElButton, ElPagination, ElMessageBox } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'

// Import components
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import ViewToggle from '@/components/shared/ViewToggle/ViewToggle.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconCopyDocument from '@/components/icons/IconCopyDocument.vue'
import IconPencil from '@/components/icons/IconPencil.vue'

const props = defineProps({
  datasetId: {
    type: String,
    required: true
  },
  modelId: {
    type: String,
    required: true
  },
  recordId: {
    type: String,
    required: true
  }
})

const metadataStore = useMetadataStore()
const router = useRouter()

// Reactive data
const record = ref(null)
const model = ref(null)
const loading = ref(false)
const error = ref('')
const viewMode = ref('ui') // 'ui' or 'json'
const packages = ref([])

// Pagination state
const inboundCurrentPage = ref(1)
const outboundCurrentPage = ref(1)
const pageSize = 25


// Helper to get a record display name for the current record
const currentRecordDisplayName = computed(() => {
  if (!record.value || !recordData.value) return 'Unknown Record'
  return getRecordDisplayValue(record.value)
})

// Computed properties
const recordData = computed(() => {
  if (!record.value) return null
  return record.value.value || {}
})

const modelSchema = computed(() => {
  if (!model.value?.latest_version?.schema) return null
  return model.value.latest_version.schema
})

const recordProperties = computed(() => {
  if (!modelSchema.value?.properties || !recordData.value) return []
  
  return Object.entries(modelSchema.value.properties).map(([key, property]) => ({
    key,
    label: property.title || key,
    type: property.type,
    format: property.format,
    description: property.description,
    value: recordData.value[key],
    property: property
  }))
})

const recordMetadata = computed(() => {
  if (!record.value) return null
  
  return {
    id: record.value.id,
    created_at: record.value.created_at,
    updated_at: record.value.updated_at,
    model_version: record.value.model_version,
    created_by: record.value.created_by,
    updated_by: record.value.updated_by
  }
})

const relationships = computed(() => {
  if (!record.value?.relationships) return { inbound: [], outbound: [] }
  
  // Ensure both arrays exist, defaulting to empty arrays if not present
  return {
    inbound: record.value.relationships.inbound || [],
    outbound: record.value.relationships.outbound || []
  }
})

const hasRelationships = computed(() => {
  const rels = relationships.value
  return (rels.inbound && rels.inbound.length > 0) || (rels.outbound && rels.outbound.length > 0)
})

const relationshipsSummary = computed(() => {
  const rels = relationships.value
  return {
    inbound: rels.inbound ? rels.inbound.length : 0,
    outbound: rels.outbound ? rels.outbound.length : 0,
    total: (rels.inbound ? rels.inbound.length : 0) + (rels.outbound ? rels.outbound.length : 0)
  }
})

// Paginated relationships
const paginatedInboundRelationships = computed(() => {
  const rels = relationships.value.inbound || []
  const start = (inboundCurrentPage.value - 1) * pageSize
  const end = start + pageSize
  return rels.slice(start, end)
})

const paginatedOutboundRelationships = computed(() => {
  const rels = relationships.value.outbound || []
  const start = (outboundCurrentPage.value - 1) * pageSize
  const end = start + pageSize
  return rels.slice(start, end)
})

// Pagination info
const inboundPagination = computed(() => {
  const total = relationships.value.inbound?.length || 0
  return {
    total,
    totalPages: Math.ceil(total / pageSize),
    currentPage: inboundCurrentPage.value,
    showPagination: total > pageSize
  }
})

const outboundPagination = computed(() => {
  const total = relationships.value.outbound?.length || 0
  return {
    total,
    totalPages: Math.ceil(total / pageSize),
    currentPage: outboundCurrentPage.value,
    showPagination: total > pageSize
  }
})

// Methods
const fetchRecord = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await metadataStore.fetchRecord(props.datasetId, props.modelId, props.recordId)
    record.value = response
  } catch (err) {
    console.error('Error fetching record:', err)
    error.value = err.message || 'Failed to load record'
  } finally {
    loading.value = false
  }
}

const fetchModel = async () => {
  try {
    await metadataStore.fetchModels(props.datasetId)
    model.value = metadataStore.modelById(props.modelId)
  } catch (err) {
    console.error('Error fetching model:', err)
    error.value = err.message || 'Failed to load model information'
  }
}

const fetchPackages = async () => {
  try {
    const response = await metadataStore.fetchRecordPackages(props.datasetId, props.recordId)
    packages.value = response || []
  } catch (err) {
    console.error('Error fetching packages:', err)
    // Don't show error for packages as it's not critical
    packages.value = []
  }
}

const goBackToRecords = () => {
  router.push({
    name: 'model-records-search',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  })
}

const goToUpdateRecord = () => {
  router.push({
    name: 'update-record',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: props.datasetId,
      modelId: props.modelId,
      recordId: props.recordId
    }
  })
}


const formatPropertyValue = (value, property) => {
  if (value === null || value === undefined) {
    return { display: 'N/A', isNull: true }
  }
  
  // Handle different property types
  if (property.type === 'boolean') {
    return { display: value ? 'Yes' : 'No', isNull: false }
  }
  
  if (property.type === 'number' || property.type === 'integer') {
    return { display: Number(value).toLocaleString(), isNull: false }
  }
  
  if (property.format === 'date') {
    try {
      return { display: new Date(value).toLocaleDateString(), isNull: false }
    } catch {
      return { display: String(value), isNull: false }
    }
  }
  
  if (property.format === 'date-time') {
    try {
      return { display: new Date(value).toLocaleString(), isNull: false }
    } catch {
      return { display: String(value), isNull: false }
    }
  }
  
  if (Array.isArray(value)) {
    return { display: value.join(', '), isNull: false }
  }
  
  if (typeof value === 'object') {
    return { display: JSON.stringify(value, null, 2), isNull: false }
  }
  
  return { display: String(value), isNull: false }
}

const getPropertyTypeDisplay = (property) => {
  let type = property.type || 'string'
  if (property.format) {
    type += ` (${property.format})`
  }
  return type
}

// Copy Record ID to clipboard
const copyRecordId = async () => {
  try {
    await navigator.clipboard.writeText(record.value.id)
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

const goToModelDetails = () => {
  router.push({
    name: 'model-details',
    params: {
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  })
}

// Navigate to a related record
const goToRelatedRecord = async (relatedRecord) => {
  // Get the current route's orgId parameter
  const currentRoute = router.currentRoute.value
  const orgId = currentRoute.params.orgId
  
  console.log('Current route:', currentRoute.fullPath)
  console.log('Current route params:', currentRoute.params)
  console.log('Navigating to related record:', {
    orgId,
    datasetId: props.datasetId,
    modelId: relatedRecord.model_id,
    recordId: relatedRecord.id
  })
  
  // Show visual feedback that navigation is happening
  loading.value = true
  
  try {
    // Try the named route first
    await router.push({
      name: 'record-details',
      params: {
        orgId: orgId,
        datasetId: props.datasetId,
        modelId: relatedRecord.model_id,
        recordId: relatedRecord.id
      }
    })
    console.log('Named route navigation successful - new record should be loading')
    
    // Scroll to top to show the change
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
  } catch (error) {
    console.error('Navigation error:', error)
    loading.value = false
    ElMessage.error('Failed to navigate to related record')
  }
}

// Get a readable display value for a record
const getRecordDisplayValue = (record) => {
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

// Pagination methods
const handleInboundPageChange = (page) => {
  inboundCurrentPage.value = page
}

const handleOutboundPageChange = (page) => {
  outboundCurrentPage.value = page
}

// Relationship creation methods
const startRelationshipCreation = () => {
  metadataStore.startRelationshipCreation(
    props.recordId,
    props.modelId, 
    props.datasetId,
    currentRecordDisplayName.value
  )
  
  ElMessage.info('Relationship creation started. Navigate to find your target record.')
}

// Package attachment methods
const startPackageAttachment = () => {
  metadataStore.startPackageAttachment(
    props.recordId,
    props.modelId,
    props.datasetId,
    currentRecordDisplayName.value
  )
}

// Navigate to package details
const goToPackageDetails = (packageItem) => {
  const currentRoute = router.currentRoute.value
  const orgId = currentRoute.params.orgId
  
  // For collections, navigate to the folder view instead of details page
  const routeName = packageItem.package.package_type === 'Collection' ? 'collection-files' : 'file-record'
  
  router.push({
    name: routeName,
    params: {
      orgId: orgId,
      datasetId: props.datasetId,
      fileId: packageItem.package.node_id
    }
  })
}

// Get shortened location for package display
const getPackageLocation = (packageItem) => {
  // For now, just show the dataset context
  return `~/datasets/${props.datasetId.slice(-8)}/`
}

// Delete package from record
const deletePackage = async (packageItem) => {
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to remove "${packageItem.package.name}" from this record? This will not delete the file from the dataset.`,
      'Remove File',
      {
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        type: 'warning',
        center: true,
        lockScroll: true,
        closeOnClickModal: false,
        closeOnPressEscape: true,
        showClose: true,
        beforeClose: null,
        distinguishCancelAndClose: true,
        roundButton: false
      }
    )

    await metadataStore.deletePackageFromRecord(
      props.datasetId,
      props.recordId,
      packageItem.package.node_id
    )

    ElMessage.success('File removed from record successfully')

    // Refresh the packages list
    await fetchPackages()
  } catch (action) {
    if (action === 'cancel' || action === 'close') {
      // User cancelled or closed dialog
      return
    }
    console.error('Error deleting package from record:', action)
    ElMessage.error(`Failed to remove file: ${action.message || 'Unknown error'}`)
  }
}

// Delete relationship from record
const deleteRelationship = async (relationship, direction) => {
  const isOutbound = direction === 'outbound'
  const sourceRecordId = isOutbound ? props.recordId : relationship.record.id
  const targetRecordId = isOutbound ? relationship.record.id : props.recordId
  const relationshipDisplayName = getRecordDisplayValue(relationship.record)
  
  try {
    await ElMessageBox.confirm(
      `Are you sure you want to remove the "${relationship.relationship_type}" relationship with "${relationshipDisplayName}"? This cannot be undone.`,
      'Remove Relationship',
      {
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        type: 'warning',
        center: true,
        lockScroll: true,
        closeOnClickModal: false,
        closeOnPressEscape: true,
        showClose: true,
        beforeClose: null,
        distinguishCancelAndClose: true,
        roundButton: false
      }
    )

    await metadataStore.deleteRelationship(
      props.datasetId,
      sourceRecordId,
      targetRecordId,
      relationship.relationship_type
    )

    ElMessage.success('Relationship removed successfully')

    // Refresh the record to get updated relationships
    await fetchRecord()
  } catch (action) {
    if (action === 'cancel' || action === 'close') {
      // User cancelled or closed dialog
      return
    }
    console.error('Error deleting relationship:', action)
    ElMessage.error(`Failed to remove relationship: ${action.message || 'Unknown error'}`)
  }
}

// Watch for prop changes to refetch data when navigating between records
watch([() => props.modelId, () => props.recordId], async () => {
  console.log('Props changed - refetching data for:', props.modelId, props.recordId)
  // Clear current data
  record.value = null
  model.value = null
  error.value = ''
  
  // Reset pagination when loading new record
  inboundCurrentPage.value = 1
  outboundCurrentPage.value = 1
  
  // Fetch new data
  await Promise.all([fetchModel(), fetchRecord(), fetchPackages()])
})

// Initialize
onMounted(async () => {
  await Promise.all([fetchModel(), fetchRecord(), fetchPackages()])
})
</script>

<template>
  <bf-stage class="record-spec-viewer" >
    <template #actions>
      <stage-actions>
        <template #left>
<!--          <bf-button @click="goBackToRecords" size="small">-->
<!--            <template #prefix>-->
<!--              <IconArrowLeft class="mr-8" :height="16" :width="16" />-->
<!--            </template>-->
<!--            Back to Records-->
<!--          </bf-button>-->
        </template>
        <template #right>
          <bf-button @click="goToUpdateRecord" size="small">
            <template #prefix>
              <IconPencil class="mr-8" :height="16" :width="16" />
            </template>
            Update Record
          </bf-button>
        </template>
      </stage-actions>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state" v-loading="true">
      <p>Loading record...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <el-card shadow="never">
        <div class="error-content">
          <h3>Error Loading Record</h3>
          <p>{{ error }}</p>
          <bf-button @click="goBackToRecords" type="primary">
            Back to Records
          </bf-button>
        </div>
      </el-card>
    </div>

    <!-- Record Content -->
    <div v-else-if="record && model" class="record-content">
      <!-- Record Header -->
      <div class="record-header">
        <div class="record-info">
          <div class="title-row">
            <h2>{{ model.display_name || model.name }} Record</h2>
            <ViewToggle v-model:viewMode="viewMode" size="small" />
          </div>
          
          <!-- Record Metadata (hidden in JSON mode) -->
          <div v-if="viewMode === 'ui'" class="record-metadata">
            <div class="metadata-item">
              <span class="metadata-label">Record ID:</span>
              <div class="metadata-value-container">
                <span class="metadata-value">{{ record.id }}</span>
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
                <span class="metadata-value">{{ recordMetadata.model_version }}</span>
                <el-button
                  @click="goToModelDetails"
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
              <span class="metadata-value">{{ new Date(recordMetadata.created_at).toLocaleString() }}</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Enhanced View -->
      <div v-if="viewMode === 'ui'" class="enhanced-view">
        <!-- Record Properties -->
        <div class="section record-data">
          <div class="record-attributes">
            <div
              v-for="prop in recordProperties"
              :key="prop.key"
              class="attribute-item"
            >
              <span class="attribute-name">{{ prop.label }}:</span>
              <span class="attribute-value" :class="{ 'is-null': formatPropertyValue(prop.value, prop.property).isNull }">
                {{ formatPropertyValue(prop.value, prop.property).display }}
              </span>
            </div>
          </div>
        </div>



        <!-- Relationships Section -->
        <div class="section">
          <div class="section-header">
            <h3>Relationships</h3>
            <div class="header-actions">
              <el-tag size="small" class="record-tag relationship-tag inbound">
                ← {{ relationshipsSummary.inbound > 0 ? `${relationshipsSummary.inbound} inbound` : 'No inbound' }}
              </el-tag>
              <el-tag size="small" class="record-tag relationship-tag outbound">
                {{ relationshipsSummary.outbound > 0 ? `${relationshipsSummary.outbound} outbound` : 'No outbound' }} →
              </el-tag>
              <span class="add-relationship-link" @click="startRelationshipCreation">
                Add Relationship
              </span>
            </div>
          </div>

          <div class="relationships-container">
            <!-- Show "no relationships" message when there are none -->
            <div v-if="!hasRelationships" class="no-relationships">
              <p class="no-relationships-message">No relationships have been created for this record</p>
            </div>

            <!-- Show relationship lists when there are relationships -->
            <div v-else class="relationships-list">
              <!-- Inbound Relationships (only show if there are inbound relationships) -->
              <div v-if="relationships.inbound.length > 0" class="relationship-section">
                <h4 class="relationship-section-title inbound">← Inbound</h4>
                
                <div class="relationship-items">
                  <div
                    v-for="(relationship, index) in paginatedInboundRelationships"
                    :key="`inbound-${index}`"
                    class="relationship-item"
                  >
                    <div class="relationship-content clickable" @click="goToRelatedRecord(relationship.record)" :title="'Click to view record'">
                      <el-tag size="small" class="relationship-type inbound">{{ relationship.relationship_type }}</el-tag>
                      <span class="record-title">{{ getRecordDisplayValue(relationship.record) }}</span>
                      <IconArrowRight class="nav-icon" :width="12" :height="12" />
                    </div>
                    <el-button
                      @click.stop="deleteRelationship(relationship, 'inbound')"
                      link
                      size="small"
                      class="delete-relationship-btn"
                      title="Remove relationship"
                    >
                      ✕
                    </el-button>
                  </div>
                </div>
                
                <!-- Inbound Pagination -->
                <div v-if="inboundPagination.showPagination" class="relationship-pagination">
                  <el-pagination
                    v-model:current-page="inboundCurrentPage"
                    :page-size="pageSize"
                    :total="inboundPagination.total"
                    layout="prev, pager, next"
                    @current-change="handleInboundPageChange"
                    size="small"
                    hide-on-single-page
                  />
                </div>
              </div>

              <!-- Outbound Relationships (only show if there are outbound relationships) -->
              <div v-if="relationships.outbound.length > 0" class="relationship-section">
                <h4 class="relationship-section-title outbound">Outbound →</h4>
                
                <div class="relationship-items">
                  <div
                    v-for="(relationship, index) in paginatedOutboundRelationships"
                    :key="`outbound-${index}`"
                    class="relationship-item"
                  >
                    <div class="relationship-content clickable" @click="goToRelatedRecord(relationship.record)" :title="'Click to view record'">
                      <el-tag size="small" class="relationship-type outbound">{{ relationship.relationship_type }}</el-tag>
                      <span class="record-title">{{ getRecordDisplayValue(relationship.record) }}</span>
                      <IconArrowRight class="nav-icon" :width="12" :height="12" />
                    </div>
                    <el-button
                      @click.stop="deleteRelationship(relationship, 'outbound')"
                      link
                      size="small"
                      class="delete-relationship-btn"
                      title="Remove relationship"
                    >
                      ✕
                    </el-button>
                  </div>
                </div>
                
                <!-- Outbound Pagination -->
                <div v-if="outboundPagination.showPagination" class="relationship-pagination">
                  <el-pagination
                    v-model:current-page="outboundCurrentPage"
                    :page-size="pageSize"
                    :total="outboundPagination.total"
                    layout="prev, pager, next"
                    @current-change="handleOutboundPageChange"
                    size="small"
                    hide-on-single-page
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Files Section -->
        <div class="section">
          <div class="section-header">
            <h3>Attached Files</h3>
            <div class="header-actions">
              <el-tag size="small" class="record-tag files-tag">
                {{ packages.length > 0 ? `${packages.length} files` : 'No files' }}
              </el-tag>
              <span class="attach-file-link" @click="startPackageAttachment">
                Attach File
              </span>
            </div>
          </div>

          <div class="files-container">
            <!-- Files exist -->
            <div v-if="packages.length > 0" class="file-items">
              <div
                v-for="(packageItem, index) in packages"
                :key="`package-${index}`"
                class="file-item"
                :title="'Click to view file details'"
              >
                <div class="file-content clickable" @click="goToPackageDetails(packageItem)">
                  <el-tag size="small" class="package-type">{{ packageItem.package.package_type }}</el-tag>
                  <span class="package-name">{{ packageItem.package.name }}</span>
                  <IconArrowRight class="nav-icon" :width="12" :height="12" />
                </div>
                <el-button
                  @click.stop="deletePackage(packageItem)"
                  link
                  size="small"
                  class="delete-package-btn"
                  title="Remove file from record"
                >
                  ✕
                </el-button>
              </div>
            </div>

            <!-- No files -->
            <div v-else class="no-files">
              <p class="no-files-message">No files attached to this record</p>
            </div>
          </div>
        </div>

      </div>

      <!-- JSON View -->
      <div v-if="viewMode === 'json'" class="json-view">
        <el-card shadow="never" class="json-card">
          <template #header>
            <h3>Raw Record Data</h3>
          </template>
          
          <pre class="json-content">{{ JSON.stringify(record, null, 2) }}</pre>
        </el-card>
      </div>
    </div>

  </bf-stage>
</template>

<style lang="scss" scoped>
@use 'sass:color';
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/select';
@use '../../../../styles/element/dialog';
@use '../../../../styles/element/tag';


.record-spec-viewer {
  .loading-state,
  .error-state {
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

  .error-state {
    .error-content {
      padding: 24px;
      
      p {
        color: theme.$red_2;
        margin-bottom: 24px;
      }
    }
  }

  .record-content {
    //padding: 0 24px 24px 24px;

    .record-header {
      margin-bottom: 8px;

      .record-info {
        .title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 8px 0 12px 0;
          
          h2 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            color: theme.$gray_6;
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

        .record-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
          
          // Base styling for all record tags
          .record-tag {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
            transition: all 0.2s ease;

            // Action button styling (for clickable icons)
            .tag-action-btn {
              opacity: 0.7;
              transition: all 0.2s ease;
              padding: 2px !important;
              min-height: unset !important;
              height: 16px !important;
              width: 16px !important;
              margin-left: 4px;
              
              :deep(.el-button__icon) {
                margin: 0 !important;
              }
              
              &:hover {
                opacity: 1;
              }
            }

            // Record Identification Group (teal theme)
            &.record-id-tag,
            &.model-id-tag {
              background-color: theme.$gray_1 !important;
              border-color: theme.$gray_3 !important;
              color: theme.$gray_4 !important;

            }

            // Model Information Group (green theme)
            &.version-tag {
              background-color: theme.$gray_1 !important;
              border-color: theme.$gray_3 !important;
              color: theme.$gray_4 !important;
              
              //.tag-action-btn {
              //  color: theme.$gray_4 !important;
              //
              //  &:hover {
              //    color: theme.$gray_5 !important;
              //  }
              //}
            }

            // Temporal Information Group (gray theme)
            &.created-tag {
              background-color: theme.$purple_tint !important;
              border-color: theme.$purple_1 !important;
              color: theme.$purple_2 !important;
            }

            // Relationships Group
            &.relationship-tag {
              &.inbound,
              &.outbound {
                background-color: theme.$orange_tint !important;
                border-color: theme.$orange_1 !important;
                color: theme.$orange_1 !important;
              }
            }
            
            // Files Group
            &.files-tag {
              background-color: theme.$teal_tint !important;
              border-color: theme.$teal_1 !important;
              color: theme.$teal_2 !important;
            }
          }
        }
      }
    }

    .view-controls {
      margin-bottom: 8px;
      display: flex;
      justify-content: flex-end;
    }

    .enhanced-view {
      display: flex;
      flex-direction: column;
      gap: 32px;

      .section {





        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid theme.$gray_2;

          &.record-data{
            border-bottom: 2px solid theme.$purple_2;
          }

          h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 500;
            color: theme.$gray_6;
          }
          
          .header-actions {
            display: flex;
            align-items: center;
            gap: 12px;

            // Ensure record tags in headers have correct styling
            .record-tag {
              position: relative;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-weight: 500;
              transition: all 0.2s ease;

              // Relationships Group
              &.relationship-tag {
                &.inbound,
                &.outbound {
                  background-color: theme.$orange_tint !important;
                  border-color: theme.$orange_1 !important;
                  color: theme.$orange_1 !important;
                }
              }
              
              // Files Group
              &.files-tag {
                background-color: theme.$teal_tint !important;
                border-color: theme.$teal_1 !important;
                color: theme.$teal_2 !important;
              }
            }
            
            .add-relationship-link {
              color: theme.$orange_2;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              text-decoration: none;
              transition: all 0.2s ease;
              
              &:hover {
                color: theme.$orange_1;
                text-decoration: underline;
              }
              
              &:active {
                color: theme.$orange_1;
              }
            }
            
            .attach-file-link {
              color: theme.$teal_2;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              text-decoration: none;
              transition: all 0.2s ease;
              
              &:hover {
                color: theme.$teal_1;
                text-decoration: underline;
              }
              
              &:active {
                color: theme.$teal_1;
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

        .record-attributes {
          .attribute-item {
            display: flex;
            margin-bottom: 12px;
            //padding: 8px 0;
            border-bottom: 1px solid theme.$gray_1;
            
            &:last-child {
              margin-bottom: 0;
              border-bottom: none;
            }

            .attribute-name {
              font-weight: 500;
              color: theme.$gray_5;
              margin-right: 16px;
              min-width: 160px;
              font-size: 14px;
            }

            .attribute-value {
              color: theme.$gray_6;
              font-size: 14px;
              line-height: 1.4;
              
              &.is-null {
                color: theme.$gray_4;
                font-style: italic;
              }
            }
          }
        }

        // Files and Relationships sections styling
        &:not(.record-data) {
          .section-header {
            border-bottom: 1px solid theme.$gray_2;
          }
          
          // Add extra spacing for relationships section
          &:nth-child(2) {
            margin-top: 24px;
          }
        }

        .metadata-list {
          .metadata-item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 13px;

            &:last-child {
              border-bottom: none;
            }

            .metadata-label {
              font-weight: 400;
              color: theme.$gray_4;
            }

            .metadata-value {
              color: theme.$gray_5;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 12px;
            }
          }
        }

        // Files Section Styling
        .files-container {
          .file-items {
            display: flex;
            flex-direction: column;
            gap: 4px;

            .file-item {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 6px 12px;
              background: white;
              border: 1px solid theme.$gray_2;
              border-radius: 4px;
              transition: all 0.2s ease;
              justify-content: space-between;

              .file-content {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;

                &.clickable {
                  cursor: pointer;
                }
              }

              &:hover {
                border-color: theme.$teal_1;
                background-color: theme.$gray_1;

                .nav-icon {
                  color: theme.$teal_2;
                }

                .delete-package-btn {
                  opacity: 1;
                }
              }

              .delete-package-btn {
                opacity: 0;
                transition: all 0.2s ease;
                padding: 2px 4px !important;
                min-height: unset !important;
                height: 18px !important;
                width: 18px !important;
                font-size: 12px;
                color: theme.$gray_4;
                flex-shrink: 0;
                
                &:hover {
                  color: theme.$red_2 !important;
                  background-color: theme.$red_tint !important;
                }
              }

              .package-type {
                font-size: 10px;
                font-weight: 500;
                padding: 2px 6px;
                white-space: nowrap;
                flex-shrink: 0;
                background: theme.$gray_1 !important;
                border-color: theme.$gray_3 !important;
                color: theme.$gray_5 !important;
              }

              .package-name {
                flex: 1;
                font-size: 13px;
                color: theme.$gray_6;
                font-weight: 400;
                line-height: 1.3;
              }

              .package-location {
                font-size: 11px;
                color: theme.$gray_4;
                font-style: italic;
                flex-shrink: 0;
              }

              .nav-icon {
                color: theme.$gray_4;
                transition: color 0.2s ease;
                flex-shrink: 0;
              }
            }
          }

          .no-files {
            padding: 20px 16px;
            text-align: center;
            background-color: theme.$gray_1;
            border: 1px solid theme.$gray_2;
            margin: 4px 0;
            border-radius: 4px;

            .no-files-message {
              margin: 0;
              color: theme.$gray_4;
              font-size: 13px;
              font-style: italic;
            }
          }
        }

        // Relationships Section Styling
        .relationships-container {
          .relationships-list {
            .relationship-section {
              margin-bottom: 20px;

              &:last-child {
                margin-bottom: 0;
              }

              .relationship-section-title {
                font-size: 14px;
                font-weight: 500;
                margin: 0 0 8px 0;
                
                &.inbound,
                &.outbound {
                  color: theme.$orange_2;
                }
              }

              .relationship-items {
                display: flex;
                flex-direction: column;
                gap: 4px;

                .relationship-item {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 6px 12px;
                  background: white;
                  border: 1px solid theme.$gray_2;
                  border-radius: 4px;
                  transition: all 0.2s ease;
                  justify-content: space-between;

                  .relationship-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;

                    &.clickable {
                      cursor: pointer;
                    }
                  }

                  &:hover {
                    border-color: theme.$purple_1;
                    background-color: theme.$gray_1;

                    .nav-icon {
                      color: theme.$purple_2;
                    }

                    .delete-relationship-btn {
                      opacity: 1;
                    }
                  }

                  .delete-relationship-btn {
                    opacity: 0;
                    transition: all 0.2s ease;
                    padding: 2px 4px !important;
                    min-height: unset !important;
                    height: 18px !important;
                    width: 18px !important;
                    font-size: 12px;
                    color: theme.$gray_4;
                    flex-shrink: 0;
                    
                    &:hover {
                      color: theme.$red_2 !important;
                      background-color: theme.$red_tint !important;
                    }
                  }

                  .relationship-type {
                    font-size: 10px;
                    font-weight: 500;
                    padding: 2px 6px;
                    white-space: nowrap;
                    flex-shrink: 0;

                    &.inbound,
                    &.outbound {
                      background: theme.$gray_1 !important;
                      border-color: theme.$gray_3 !important;
                      color: theme.$gray_5 !important;
                    }
                  }

                  .record-title {
                    flex: 1;
                    font-size: 13px;
                    color: theme.$gray_6;
                    font-weight: 400;
                    line-height: 1.3;
                  }

                  .nav-icon {
                    color: theme.$gray_4;
                    transition: color 0.2s ease;
                    flex-shrink: 0;
                  }
                }
              }

              // No relationships styling - subtle and clean
              .no-relationships {
                padding: 20px 16px;
                text-align: center;
                background-color: theme.$gray_1;
                border: 1px solid theme.$gray_2;
                margin: 4px 0;

                .no-relationships-message {
                  margin: 0;
                  color: theme.$gray_4;
                  font-size: 13px;
                  font-style: italic;
                }
              }

              .relationship-pagination {
                margin-top: 16px;
                display: flex;
                justify-content: center;

                :deep(.el-pagination) {
                  display: flex;
                  align-items: center;
                  
                  .el-pager {
                    list-style: none !important;
                    display: flex !important;
                    flex-direction: row !important;
                    margin: 0;
                    padding: 0;
                    
                    li {
                      list-style: none !important;
                      display: inline-block !important;
                      margin: 0 2px;
                      
                      &::before {
                        display: none !important;
                      }
                    }
                  }
                  
                  .btn-prev,
                  .btn-next {
                    display: inline-block !important;
                    list-style: none !important;
                    
                    &::before {
                      display: none !important;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    .json-view {
      .json-card {
        border: 1px solid theme.$gray_2;

        :deep(.el-card__header) {
          background: theme.$gray_1;
          border-bottom: 1px solid theme.$gray_2;
          padding: 16px 24px;

          h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: theme.$gray_6;
          }
        }

        :deep(.el-card__body) {
          padding: 0;
        }

        .json-content {
          padding: 24px;
          margin: 0;
          background: theme.$gray_1;
          color: theme.$gray_6;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          line-height: 1.5;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
      }
    }
  }
}
</style>