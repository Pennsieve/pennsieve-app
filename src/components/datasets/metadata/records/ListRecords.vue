<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { ElTable, ElTableColumn, ElCard, ElButton, ElSelect, ElOption, ElMessage, ElDropdown, ElDropdownMenu, ElDropdownItem, ElIcon, ElTag, ElDivider, ElTooltip, ElCheckbox } from 'element-plus'
import { ArrowDown, View, InfoFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'
import { useOntologyStore } from '@/stores/ontologyStore.js'
import { summarizeObject } from '@/utils/objectSummary.js'
import MultiModelFilter from '../../explore/GraphExplorer/MultiModelFilter.vue'
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
const ontologyStore = useOntologyStore()
const router = useRouter()

// Code→label lookup for over-cap ontology value sets (tier:"subtree"), which carry
// no inline labels in the schema — resolved lazily from the ontology slices.
const subtreeLabels = ref({})

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

// Filter data for MultiModelFilter
const filters = ref([{
  id: 1,
  model: null, // Will be set from route params
  modelProperties: [],
  property: '',
  operator: '',
  value: '',
  logicalOperator: 'and'
}])

// Debouncing for filter updates
let filterUpdateTimeout = null

// Model data
const model = ref(null)
const modelSchema = ref(null)
const availableVersions = ref([])
const loadingVersions = ref(false)
const loadingModels = ref(false)
const modelError = ref('')
const versionError = ref('')

// Computed properties
const tableColumns = computed(() => {
  if (!modelSchema.value?.properties) return []
  
  return Object.entries(modelSchema.value.properties).map(([key, property]) => ({
    key,
    label: property.title || key,
    type: property.type,
    format: property.format,
    // Code→label map for controlled value sets (ontology / CDE), so cells render
    // the human label (e.g. "epilepsy") instead of the stored code ("MONDO:0005027").
    valueLabels: buildValueLabels(property),
    // Over-cap value sets ship no inline labels — resolve them from this ontology.
    subtreeOntology: property['x-pennsieve-concept-valueset']?.ontology || null,
    // Tooltip text when this column holds coded values (null when it doesn't).
    codedTip: codedColumnTip(property)
  }))
})

// Sparse schemas (e.g. CDE models) carry many properties with no values on a
// given page — hide those columns by default, with a toggle to show them.
const showEmptyColumns = ref(false)

const columnHasData = (column) => records.value.some(r => {
  const v = r.value?.[column.key]
  if (v == null || v === '') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
})

const emptyColumnCount = computed(() =>
  records.value.length ? tableColumns.value.filter(c => !columnHasData(c)).length : 0
)

const visibleColumns = computed(() =>
  showEmptyColumns.value || !emptyColumnCount.value
    ? tableColumns.value
    : tableColumns.value.filter(columnHasData)
)

// --- Column resize ----------------------------------------------------------
// Custom drag-resize via a handle element on each header cell's right edge:
// Element Plus's built-in version only applies the new width on mouseup (and
// requires border mode), so widths here are applied live while dragging. The
// handle carries cursor: col-resize in CSS, so the browser resolves the hover
// cursor natively. Widths persist by column key.
const columnWidths = ref({})
const MIN_COLUMN_WIDTH = 80

let resizeState = null

const startColumnResize = (column, e) => {
  const th = e.target.closest('th')
  if (!th) return
  resizeState = {
    key: column.key,
    startX: e.clientX,
    startWidth: th.getBoundingClientRect().width,
    raf: null
  }
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onResizing)
  document.addEventListener('mouseup', endResize)
}

const onResizing = (e) => {
  if (!resizeState || resizeState.raf) return
  const { clientX } = e
  resizeState.raf = requestAnimationFrame(() => {
    if (!resizeState) return
    resizeState.raf = null
    const width = Math.max(MIN_COLUMN_WIDTH, resizeState.startWidth + (clientX - resizeState.startX))
    columnWidths.value = { ...columnWidths.value, [resizeState.key]: width }
  })
}

const endResize = () => {
  if (resizeState?.raf) cancelAnimationFrame(resizeState.raf)
  resizeState = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onResizing)
  document.removeEventListener('mouseup', endResize)
}

onBeforeUnmount(endResize)

// Describe a column's coded-value source for a header tooltip, or null if it isn't
// backed by an ontology / CDE value set.
const codedColumnTip = (property) => {
  const cde =
    property['x-pennsieve-cde-values'] || property['x-pennsieve-cde-valueset'] || property['x-pennsieve-cde']
  const system =
    property['x-pennsieve-concept-valueset']?.ontology ||
    property['x-pennsieve-concept']?.ontology ||
    null
  const isConcept =
    property['x-pennsieve-concept-values'] ||
    property['x-pennsieve-concept-valueset'] ||
    property['x-pennsieve-concept']
  if (!isConcept && !cde) return null
  const source = system ? `the ${system} ontology` : cde ? 'a linked CDE value set' : 'a controlled value set'
  return `Coded values — each entry is a term from ${source}, stored as a code (e.g. MONDO:0015005) and shown here by its label.`
}

// Build a { code: label } lookup from a property's materialized value annotation.
// Returns null when the property has no controlled value labels.
const buildValueLabels = (property) => {
  const vals = property['x-pennsieve-concept-values'] || property['x-pennsieve-cde-values']
  if (!Array.isArray(vals) || !vals.length) return null
  const map = {}
  for (const v of vals) {
    const code = v?.code ?? v?.value
    if (code != null) map[code] = v.label || String(code)
  }
  return Object.keys(map).length ? map : null
}

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
  const models = metadataStore.models || []
  
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
      
      // Initialize filter with model information for MultiModelFilter
      initializeFilter()
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

// Initialize filter with model data for MultiModelFilter
const initializeFilter = () => {
  if (model.value && modelSchema.value) {
    // Convert schema properties to the format expected by MultiModelFilter
    const modelProperties = Object.entries(modelSchema.value.properties).map(([key, property]) => ({
      name: key,
      display_name: property.title || key,
      type: property.type || 'string'
    }))
    
    filters.value[0] = {
      ...filters.value[0],
      model: props.modelId,
      modelProperties
    }
  }
}

// Debounced function to trigger API fetch
const debouncedFetchRecords = () => {
  // Clear any existing timeout
  if (filterUpdateTimeout) {
    clearTimeout(filterUpdateTimeout)
  }
  
  // Set a new timeout to debounce rapid filter updates
  filterUpdateTimeout = setTimeout(() => {
    console.log('🔍 Debounced fetch triggered with filter:', activeFilter.value)
    fetchRecords(null, 'forward', true)
  }, 500) // 500ms debounce
}

// Handle MultiModelFilter events
const onMultiFilterUpdate = (index, updatedFilter) => {
  const previousFilter = activeFilter.value
  
  
  // Handle multiple filters structure
  if (updatedFilter && updatedFilter.hasMultipleFilters && updatedFilter.subFilters) {
    // Multiple filters - convert each subfilter to API format
    const validSubFilters = updatedFilter.subFilters.filter(f => 
      f.property && f.operator && f.value !== ''
    )
    
    if (validSubFilters.length === 0) {
      activeFilter.value = null
      // Immediately fetch for clearing filters (don't debounce clears)
      if (previousFilter) {
        if (filterUpdateTimeout) clearTimeout(filterUpdateTimeout)
        fetchRecords(null, 'forward', true)
      }
      return
    }
    
    // Convert each subfilter to API predicate format
    const predicates = validSubFilters.map(filter => ({
      property: `/${filter.property.replace(/\./g, '/')}`, // JSON pointer format: convert dots to slashes
      operator: filter.operator,
      value: filter.value
    }))
    
    // Create combined predicate structure
    if (predicates.length === 1) {
      activeFilter.value = predicates[0]
    } else {
      // Use logical operator (AND/OR) to combine multiple predicates
      const logicalOp = updatedFilter.logicalOperator || 'and'
      activeFilter.value = {
        [logicalOp]: predicates
      }
    }
    
    // Use debounced fetch for filter updates
    debouncedFetchRecords()
  }
  // Handle single filter (backward compatibility)
  else if (updatedFilter && updatedFilter.property && updatedFilter.operator && updatedFilter.value) {
    const apiFilter = {
      property: `/${updatedFilter.property.replace(/\./g, '/')}`, // JSON pointer format: convert dots to slashes
      operator: updatedFilter.operator,
      value: updatedFilter.value
    }
    activeFilter.value = apiFilter
    
    // Use debounced fetch for filter updates
    debouncedFetchRecords()
  } else {
    activeFilter.value = null
    // Immediately fetch for clearing filters (don't debounce clears)
    if (previousFilter) {
      if (filterUpdateTimeout) clearTimeout(filterUpdateTimeout)
      fetchRecords(null, 'forward', true)
    }
  }
}

const onMultiFilterRemove = (index) => {
  // Not applicable for single model filter, but required by MultiModelFilter
  activeFilter.value = null
  fetchRecords(null, 'forward', true)
}

const onMultiModelChange = (index, modelId) => {
  // Model selection should be disabled, but handle it just in case
  // Navigate to the new model if somehow triggered
  if (modelId !== props.modelId) {
    selectModel(modelId)
  }
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

// Breadcrumb model selector doesn't need this function anymore

const selectModel = (command) => {
  // Check if it's a special command
  if (typeof command === 'string' && command.startsWith('view-details:')) {
    const targetModelId = command.split(':')[1]
    router.push({
      name: 'model-details',
      params: {
        orgId: router.currentRoute.value.params.orgId,
        datasetId: props.datasetId,
        modelId: targetModelId
      }
    })
    return
  }
  
  // Otherwise, it's a model selection - navigate to the new model's records route
  router.push({
    name: 'model-records-search',
    params: {
      orgId: router.currentRoute.value.params.orgId,
      datasetId: props.datasetId,
      modelId: command
    }
  })
}

// Resolve labels for over-cap (subtree) value-set codes on the current page. Inline
// value sets already carry their labels in the schema; this only covers columns whose
// codes aren't in the schema. Fail-open: on any error the codes stay shown as-is.
const resolveSubtreeLabels = async () => {
  const cols = tableColumns.value.filter(c => c.subtreeOntology)
  if (!cols.length || !records.value.length) return

  const needed = new Set()
  for (const c of cols) {
    for (const rec of records.value) {
      const v = rec.value?.[c.key]
      if (v == null) continue
      for (const code of Array.isArray(v) ? v : [v]) {
        if (typeof code === 'string' && !subtreeLabels.value[code]) needed.add(code)
      }
    }
  }
  if (!needed.size) return

  try {
    const onts = [...new Set(cols.map(c => c.subtreeOntology))]
    await Promise.all(onts.map(o => ontologyStore.ensureOntology(o)))
    const map = await ontologyStore.labelsFor([...needed])
    const next = { ...subtreeLabels.value }
    for (const [code, label] of map) if (label) next[code] = label
    subtreeLabels.value = next
  } catch {
    /* leave codes as-is */
  }
}

watch([records, modelSchema], () => { resolveSubtreeLabels() })

// Source text can carry literal HTML (e.g. "<br />" in NLM reference fields) —
// strip tags for the one-line cell display.
const stripHtml = (s) =>
  s.includes('<') ? s.replace(/<\/?[a-z][^>]*>/gi, ' ').replace(/\s+/g, ' ').trim() : s

const formatCellValue = (value, column) => {
  if (value === null || value === undefined) {
    return ''
  }

  // Controlled value set (ontology / CDE): show the label, fall back to the code
  // when a value isn't resolved yet (subtree labels load async) or isn't in the
  // set (e.g. a code from a since-narrowed value set).
  if (column.valueLabels || column.subtreeOntology) {
    const toLabel = v => (column.valueLabels && column.valueLabels[v]) || subtreeLabels.value[v] || v
    if (Array.isArray(value)) {
      return value.map(toLabel).join(', ')
    }
    return toLabel(value)
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
  
  // Handle arrays: one-line summary per item, capped at 3 items
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return ''
    }
    const preview = value.slice(0, 3).map(item => {
      if (typeof item === 'object' && item !== null) {
        return summarizeObject(item)
      }
      return stripHtml(String(item))
    }).join(' · ')

    const suffix = value.length > 3 ? ` · +${value.length - 3} more` : ''
    return `${preview}${suffix}`
  }

  // Handle objects
  if (typeof value === 'object' && value !== null) {
    return summarizeObject(value)
  }

  return stripHtml(String(value))
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
  
  // Check if we're in record attachment mode
  if (metadataStore.activeRecordAttachment) {
    // Create a custom event to trigger record attachment with complete record data
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
  <bf-stage class="list-records" :no-padding="true">
    <template #actions>
      <stage-actions>
        <template #left>
          <div class="left-wrapper">
            <!-- Breadcrumb Navigation with Model and Version Selectors -->
            <div class="breadcrumb-nav">
              <span class="breadcrumb-item">Models</span>
              <span class="breadcrumb-separator">/</span>
              
              <!-- Model Dropdown -->
              <el-dropdown trigger="click" @command="selectModel" :disabled="loadingModels">
                <span class="breadcrumb-dropdown" :class="{ 'loading': loadingModels }">
                  <span v-if="model">{{ model.display_name || model.name }}</span>
                  <span v-else>Loading...</span>
                  <el-icon class="el-icon--right"><arrow-down /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <!-- View Details option for current model -->
                    <el-dropdown-item 
                      :command="`view-details:${modelId}`"
                      class="model-action-item"
                    >
                      <el-icon style="margin-right: 8px"><View /></el-icon>
                      <span style="font-weight: 500">View Model Details</span>
                    </el-dropdown-item>
                    <el-divider style="margin: 6px 0" />
                    
                    <!-- Model selection items -->
                    <el-dropdown-item 
                      v-for="option in modelOptions" 
                      :key="option.value"
                      :command="option.value"
                      :class="{ 'is-active': option.value === modelId }"
                    >
                      <div class="model-dropdown-item">
                        <span class="model-name">{{ option.label }}</span>
<!--                        <el-tag size="small" type="info">{{ option.count }} records</el-tag>-->
                      </div>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              
              <span class="breadcrumb-separator">/</span>
              
              <!-- Version Dropdown -->
              <el-dropdown trigger="click" @command="onVersionChange" :disabled="loadingVersions || !versionOptions.length">
                <span class="breadcrumb-dropdown version-dropdown" :class="{ 'loading': loadingVersions }">
                  <span v-if="selectedVersion === 'all'">All Versions</span>
                  <span v-else-if="selectedVersion === 'latest'">Latest (v{{ model?.latest_version?.version || 1 }})</span>
                  <span v-else>Version {{ selectedVersion }}</span>
                  <el-icon class="el-icon--right"><arrow-down /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item 
                      v-for="version in versionOptions"
                      :key="version.value"
                      :command="version.value"
                      :class="{ 'is-active': version.value === selectedVersion }"
                    >
                      <div class="version-dropdown-item">
                        <div class="version-info-breadcrumb">
                          <span class="version-name">{{ version.label }}</span>
                          <span v-if="version.createdAt" class="version-date">{{ formatDate(version.createdAt) }}</span>
                        </div>
                        <el-tag v-if="version.isAll" size="small" type="info">All</el-tag>
                        <el-tag v-else-if="version.isLatest" size="small" type="info">Current</el-tag>
                      </div>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              
              <span class="breadcrumb-separator">/</span>
              <span class="breadcrumb-item">Records</span>
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

    <!-- Record Filters - Use MultiModelFilter with fixed model -->
    <multi-model-filter
      v-if="filters[0].model && !error"
      class="record-filter-section"
      :models="modelOptions"
      :filter="filters[0]"
      :index="0"
      :can-remove="false"
      :dataset-id="datasetId"
      @update-filter="onMultiFilterUpdate"
      @remove-filter="onMultiFilterRemove"
      @model-change="onMultiModelChange"
      :hide-empty-model-selector="true"
      :enable-autocomplete="true"
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
          <el-checkbox
            v-if="emptyColumnCount > 0"
            v-model="showEmptyColumns"
            class="empty-columns-toggle"
          >
            Show empty columns ({{ emptyColumnCount }})
          </el-checkbox>
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
            v-for="column in visibleColumns"
            :key="column.key"
            :prop="`value.${column.key}`"
            :label="column.label"
            :width="columnWidths[column.key]"
            :min-width="120"
            show-overflow-tooltip
          >
            <template #header>
              <span class="column-header">
                {{ column.label }}
                <el-tooltip v-if="column.codedTip" :content="column.codedTip" placement="top" :show-after="200">
                  <el-icon class="coded-indicator"><InfoFilled /></el-icon>
                </el-tooltip>
              </span>
              <span
                class="col-resize-handle"
                @mousedown.prevent.stop="startColumnResize(column, $event)"
                @click.stop
              />
            </template>
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
      gap: 20px;
    }

    // Breadcrumb navigation styling
    .breadcrumb-nav {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      
      .breadcrumb-item {
        color: theme.$gray_5;
        font-weight: 500;
      }
      
      .breadcrumb-separator {
        color: theme.$gray_4;
        font-size: 16px;
      }
      
      .breadcrumb-dropdown {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        color: theme.$purple_3;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
        user-select: none;
        
        &:hover:not(.loading) {
          background-color: theme.$gray_1;
          color: theme.$purple_2;
        }
        
        &.loading {
          cursor: default;
          opacity: 0.6;
        }
        
        .el-icon {
          font-size: 14px;
          transition: transform 0.2s ease;
        }
        
        &:hover:not(.loading) .el-icon {
          transform: translateY(1px);
        }
      }
      
      // Dropdown is open
      :deep(.el-dropdown.is-active) {
        .breadcrumb-dropdown {
          background-color: theme.$gray_1;
          
          .el-icon {
            transform: rotate(180deg);
          }
        }
      }
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
        display: flex;
        align-items: center;

        .records-count {
          color: theme.$gray_5;
          font-size: 14px;
          font-weight: 500;
        }

        .empty-columns-toggle {
          margin-left: 24px;

          :deep(.el-checkbox__label) {
            color: theme.$gray_5;
            font-size: 14px;
            font-weight: 400;
          }
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

      .column-header {
        display: inline-flex;
        align-items: center;
        gap: 4px;

        .coded-indicator {
          font-size: 13px;
          color: theme.$gray_4;
          cursor: help;
        }
      }

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
            position: relative;
          }
        }

        // Drag handle on the header cell's right edge. Kept fully inside its
        // own cell — an overhang into the neighbor gets covered by that th.
        .col-resize-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          right: 0;
          width: 8px;
          cursor: col-resize;
          z-index: 1;
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

// Custom dropdown styling for model selector breadcrumb
:deep(.el-dropdown__popper) {
  .el-dropdown-menu__item {
    &.is-active {
      background-color: theme.$purple_tint;
      color: theme.$purple_3;
      
      .model-name, .version-name {
        font-weight: 600;
      }
    }
    
    &:hover {
      background-color: theme.$gray_1;
    }
  }
}

// Model dropdown item styling - separate selector to ensure it applies
:deep(.model-dropdown-item) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-width: 250px;
  padding: 4px 0;
  
  .model-name {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .el-tag {
    flex-shrink: 0;
  }
}

// Version dropdown item styling - separate selector to ensure it applies
:deep(.version-dropdown-item) {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  min-width: 250px;
  padding: 4px 0;
  
  .version-info-breadcrumb {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    
    .version-name {
      font-size: 14px;
      font-weight: 500;
    }
    
    .version-date {
      font-size: 12px;
      color: theme.$gray_4;
    }
  }
  
  .el-tag {
    flex-shrink: 0;
  }
}
</style>