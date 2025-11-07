<script setup>
import { ref, computed, onMounted, watch, toRefs } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElRadioGroup, ElRadioButton, ElCard, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElButton, ElMessage, ElCheckbox, ElDescriptions, ElDescriptionsItem } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'
import ModelSpecViewer from './ModelSpecViewer.vue'
import PropertyDialog from './PropertyDialog.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

// Store setup
const metadataStore = useMetadataStore()
const router = useRouter()

// Props
const props = defineProps({
  initialModel: {
    type: Object,
    default: null
  },
  datasetId: {
    type: String,
    default: ''
  },
  modelId: {
    type: String,
    default: null
  },
  editMode: {
    type: Boolean,
    default: false
  },
  orgId: {
    type: String,
    default: ''
  },
  // Template support props
  isTemplate: {
    type: Boolean,
    default: false
  },
  initialTemplate: {
    type: Object,
    default: null
  },
  templateId: {
    type: String,
    default: null
  }
})

// Determine if we're in template mode
const isTemplateMode = computed(() => props.isTemplate || !!props.templateId)

// Determine if we're in edit mode based on modelId or templateId presence
const isEditMode = computed(() => props.editMode || !!props.modelId || !!props.templateId)

// Emits
const emit = defineEmits(['save-model', 'save-template', 'cancel'])

// Reactive data
const mode = ref('guided') // 'guided' or 'json'
const previewViewMode = ref('ui') // 'ui' or 'json' for preview panel

// JSON Schema template
const defaultSchema = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type" : "object",
  "required": [],
  "properties": {}
}

// Model data
const modelData = ref({
  name: '',
  display_name: '',
  description: '',
  latest_version: {
    version: 1,
    schema: { ...defaultSchema }
  }
})

// Shared JSON data for real-time preview updates
const sharedJsonData = ref({
  name: '',
  display_name: '',
  description: '',
  schema: { ...defaultSchema }
})

// JSON editor content
const jsonContent = ref('')
const jsonError = ref('')
const jsonEditor = ref(null)

// Track if model name was manually edited
const modelNameManuallyEdited = ref(false)

// Property dialog
const propertyDialogVisible = ref(false)
const editingProperty = ref(null)
const propertyForm = ref({
  name: '',
  displayName: '',
  type: 'string',
  required: false,
  description: '',
  format: '',
  minimum: undefined,
  maximum: undefined,
  minLength: undefined,
  maxLength: undefined,
  pattern: '',
  enum: [],
  enumInput: '',
  default: undefined
})

// Property types with format support
const propertyTypes = [
  { value: 'string', label: 'Text', description: 'Text data with optional format validation' },
  { value: 'number', label: 'Number', description: 'Decimal numbers (e.g., 3.14, 42.0)' },
  { value: 'integer', label: 'Integer', description: 'Whole numbers only (e.g., 1, 42, 100)' },
  { value: 'boolean', label: 'True/False', description: 'Boolean values (true or false)' },
  { value: 'array', label: 'Array', description: 'List of values' },
  { value: 'object', label: 'Object', description: 'Nested object with properties' }
]

const stringFormats = [
  { value: '', label: 'Plain text' },
  { value: 'date', label: 'Date (YYYY-MM-DD)' },
  { value: 'date-time', label: 'Date & Time (ISO 8601)' },
  { value: 'time', label: 'Time (HH:MM:SS)' },
  { value: 'email', label: 'Email Address' },
  { value: 'uri', label: 'URL/URI' },
  { value: 'uuid', label: 'UUID' },
  { value: 'ipv4', label: 'IPv4 Address' },
  { value: 'ipv6', label: 'IPv6 Address' },
  { value: 'hostname', label: 'Hostname' }
]

// Form validation rules
const modelRules = {
  name: [
    { required: true, message: 'Model name is required', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: 'Must start with letter and contain only letters, numbers, and underscores', trigger: 'blur' }
  ],
  display_name: [
    { required: true, message: 'Display name is required', trigger: 'blur' }
  ]
}

const propertyRules = {
  name: [
    { required: true, message: 'Property name is required', trigger: 'blur' },
    { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: 'Must start with letter and contain only letters, numbers, and underscores', trigger: 'blur' }
  ],
  displayName: [
    { required: true, message: 'Display name is required', trigger: 'blur' }
  ],
  type: [
    { required: true, message: 'Type is required', trigger: 'change' }
  ]
}

// Computed properties
const modelProperties = computed(() => {
  return Object.entries(modelData.value.latest_version.schema.properties || {})
})

const previewModel = computed(() => {
  let baseModel = modelData.value
  
  if (mode.value === 'json' && jsonContent.value && !jsonError.value) {
    try {
      const parsed = JSON.parse(jsonContent.value)
      baseModel = {
        ...modelData.value,
        latest_version: {
          ...modelData.value.latest_version,
          schema: parsed
        }
      }
    } catch (e) {
      baseModel = modelData.value
    }
  }
  
  // When editing an existing model, increment the version for preview
  if (isEditMode.value) {
    return {
      ...baseModel,
      latest_version: {
        ...baseModel.latest_version,
        version: (baseModel.latest_version?.version || 1) + 1
      },
      // For preview, don't show the original creation date since this will be a new version
      created_at: null
    }
  }
  
  return baseModel
})

// Computed property for property form data to pass to PropertyDialog
const propertyFormData = computed(() => propertyForm.value)

// Update shared JSON data with current model state
const updateSharedJsonData = () => {
  sharedJsonData.value = {
    name: modelData.value.name,
    display_name: modelData.value.display_name,
    description: modelData.value.description,
    schema: { ...modelData.value.latest_version.schema }
  }
}

// Methods
const initializeData = () => {
  // Handle template initialization
  if (isTemplateMode.value && props.initialTemplate) {
    const template = JSON.parse(JSON.stringify(props.initialTemplate))
    
    modelData.value = {
      id: template.id || undefined,
      name: template.name || '',
      display_name: template.display_name || template.displayName || '',
      description: template.description || '',
      created_at: template.created_at || template.createdAt || new Date().toISOString(),
      latest_version: template.latest_version || template.latestVersion || {
        version: 1,
        schema: template.schema || { ...defaultSchema }
      }
    }
    
    // If the template has a direct schema property, use it
    if (template.schema && !template.latest_version && !template.latestVersion) {
      modelData.value.latest_version.schema = template.schema
    }
  } 
  // Handle model initialization
  else if (props.initialModel) {
    const model = JSON.parse(JSON.stringify(props.initialModel))
    
    // Ensure the model has the expected structure
    modelData.value = {
      id: model.id || undefined,
      name: model.name || '',
      display_name: model.display_name || model.displayName || '',
      description: model.description || '',
      created_at: model.created_at || model.createdAt || new Date().toISOString(),
      latest_version: model.latest_version || model.latestVersion || {
        version: 1,
        schema: model.schema || { ...defaultSchema }
      }
    }
    
    // If the model has a direct schema property, use it
    if (model.schema && !model.latest_version && !model.latestVersion) {
      modelData.value.latest_version.schema = model.schema
    }
  } else {
    modelData.value = {
      name: '',
      display_name: '',
      description: '',
      created_at: new Date().toISOString(),
      latest_version: {
        version: 1,
        schema: { ...defaultSchema }
      }
    }
  }
  updateJsonContent()
  updateSharedJsonData()
}

const updateJsonContent = () => {
  // Ensure we have a valid schema before stringifying
  const schema = modelData.value?.latest_version?.schema || defaultSchema
  jsonContent.value = JSON.stringify(schema, null, 2)
  jsonError.value = ''
}

const validateAndParseJson = () => {
  if (!jsonContent.value.trim()) {
    jsonError.value = 'JSON content cannot be empty'
    return false
  }

  try {
    const parsed = JSON.parse(jsonContent.value)
    
    // Basic JSON Schema validation
    if (typeof parsed !== 'object' || parsed === null) {
      jsonError.value = 'Schema must be a valid JSON object'
      return false
    }
    
    if (parsed.type !== 'object') {
      jsonError.value = 'Root schema type must be "object"'
      return false
    }
    
    if (!parsed.properties || typeof parsed.properties !== 'object') {
      jsonError.value = 'Schema must have a "properties" object'
      return false
    }

    // Validate Pennsieve-specific rules
    const required = parsed.required || []
    const properties = parsed.properties || {}
    
    // Check that properties with x-pennsieve-key are required
    for (const [propName, property] of Object.entries(properties)) {
      if (property && property['x-pennsieve-key'] === true) {
        if (!required.includes(propName)) {
          jsonError.value = `Property "${propName}" has x-pennsieve-key set but is not marked as required`
          return false
        }
      }
    }

    modelData.value.latest_version.schema = parsed
    jsonError.value = ''
    return true
  } catch (e) {
    jsonError.value = `Invalid JSON: ${e.message}`
    return false
  }
}

const onJsonContentChange = () => {
  if (validateAndParseJson()) {
    updateSharedJsonData()
  }
}

const onJsonEditorKeydown = (event) => {
  // Handle TAB key in JSON editor to insert 4 spaces instead of changing focus
  if (event.key === 'Tab') {
    event.preventDefault()
    
    // Get the textarea element - Element Plus wraps it in a component
    const textarea = jsonEditor.value?.$refs?.textarea || jsonEditor.value?.textarea
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = jsonContent.value
    
    // Insert 4 spaces at cursor position
    const newValue = currentValue.substring(0, start) + '    ' + currentValue.substring(end)
    
    // Update the content
    jsonContent.value = newValue
    
    // Move cursor to after inserted spaces
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    }, 0)
  }
}

const openPropertyDialog = (propertyName = null) => {
  editingProperty.value = propertyName
  
  if (propertyName) {
    // Edit existing property
    const property = modelData.value.latest_version.schema.properties[propertyName]
    
    // Handle type - check if it's an array with null
    let propertyType = property.type || 'string'
    let allowNull = false
    
    if (Array.isArray(property.type)) {
      // Find the non-null type
      const nonNullTypes = property.type.filter(t => t !== 'null')
      if (nonNullTypes.length === 1) {
        propertyType = nonNullTypes[0]
        allowNull = property.type.includes('null')
      } else {
        // If multiple non-null types, keep as is (shouldn't normally happen in our UI)
        propertyType = property.type
      }
    }
    
    propertyForm.value = {
      name: propertyName,
      displayName: property.title || propertyName,
      type: propertyType,
      required: modelData.value.latest_version.schema.required?.includes(propertyName) || false,
      description: property.description || '',
      format: property.format || '',
      minimum: property.minimum,
      maximum: property.maximum,
      minLength: property.minLength,
      maxLength: property.maxLength,
      pattern: property.pattern || '',
      enum: property.enum || [],
      enumInput: property.enum ? property.enum.join(', ') : '',
      default: property.default,
      isKey: property['x-pennsieve-key'] || false,
      isSensitive: property['x-pennsieve-sensitive'] || false,
      allowNull: allowNull
    }
  } else {
    // Add new property
    propertyForm.value = {
      name: '',
      displayName: '',
      type: 'string',
      required: false,
      description: '',
      format: '',
      minimum: undefined,
      maximum: undefined,
      minLength: undefined,
      maxLength: undefined,
      pattern: '',
      enum: [],
      enumInput: '',
      default: undefined,
      isKey: false,
      isSensitive: false,
      allowNull: false
    }
  }
  
  propertyDialogVisible.value = true
}

const removeProperty = (propertyName) => {
  const newProperties = { ...modelData.value.latest_version.schema.properties }
  delete newProperties[propertyName]
  
  const newRequired = (modelData.value.latest_version.schema.required || []).filter(name => name !== propertyName)
  
  modelData.value.latest_version.schema = {
    ...modelData.value.latest_version.schema,
    properties: newProperties,
    required: newRequired
  }

  if (mode.value === 'json') {
    updateJsonContent()
  }

  // Update shared JSON data for preview
  updateSharedJsonData()

  ElMessage.success('Property removed successfully')
}

const saveEntity = async () => {
  if (mode.value === 'json' && !validateAndParseJson()) {
    ElMessage.error('Please fix JSON errors before saving')
    return
  }

  // Basic validation
  const entityType = isTemplateMode.value ? 'Template' : 'Model'
  if (!modelData.value.name || !modelData.value.display_name) {
    ElMessage.error(`${entityType} name and display name are required`)
    return
  }

  try {
    // Update schema title
    modelData.value.latest_version.schema.title = modelData.value.name

    if (isTemplateMode.value) {
      // Template save operations
      if (isEditMode.value && props.templateId) {
        // Create new version of existing template
        await metadataStore.createTemplateVersion(props.templateId, {
          schema: modelData.value.latest_version.schema
        }, props.orgId)
        ElMessage.success(`New version of "${modelData.value.display_name}" created successfully`)
        
        // Navigate back to template details after successful version creation
        router.push({
          name: 'template-details',
          params: {
            orgId: props.orgId,
            templateId: props.templateId
          }
        })
      } else {
        // Create new template
        const createdTemplate = await metadataStore.createTemplateFromModel({
          name: modelData.value.name,
          display_name: modelData.value.display_name,
          description: modelData.value.description,
          schema: modelData.value.latest_version.schema
        }, props.orgId)
        
        ElMessage.success(`Template "${modelData.value.display_name}" created successfully`)
        emit('save-template', createdTemplate)
        
        // Navigate back to template gallery after successful creation
        router.push({
          name: 'new-model-from-template',
          params: {
            orgId: props.orgId
          }
        })
      }
    } else {
      // Model save operations
      if (isEditMode.value && props.modelId) {
        // Create new version of existing model
        await metadataStore.updateVersion(props.datasetId, modelData.value.id, {
          schema: modelData.value.latest_version.schema
        })
        ElMessage.success(`New version of "${modelData.value.display_name}" created successfully`)
        
        // Navigate to model details page after successful version creation
        router.push({
          name: 'model-details',
          params: {
            datasetId: props.datasetId,
            orgId: props.orgId,
            modelId: modelData.value.id
          }
        })
      } else {
        // Create new model
        const createdModel = await metadataStore.createModel(props.datasetId, {
          name: modelData.value.name,
          display_name: modelData.value.display_name,
          description: modelData.value.description,
          schema: modelData.value.latest_version.schema
        })
        
        ElMessage.success(`Model "${modelData.value.display_name}" created successfully`)
        emit('save-model', createdModel)
        
        // Navigate back to models list after successful creation
        router.push({
          name: 'models-list',
          params: {
            datasetId: props.datasetId,
            orgId: props.orgId
          }
        })
      }
    }
  } catch (error) {
    console.error(`Failed to save ${entityType.toLowerCase()}:`, error)
    ElMessage.error(`Failed to save ${entityType.toLowerCase()}: ${error.message || 'Unknown error'}`)
  }
}

// Backward compatibility alias
const saveModel = saveEntity

const cancelEdit = () => {
  emit('cancel')
}

const cancelAndReturnToList = () => {
  // Navigate back to the model list
  router.push({
    name: 'models-list',
    params: {
      datasetId: props.datasetId,
      orgId: props.orgId,
    }
  })
}

// Generate property name from display name
const generatePropertyName = () => {
  if (propertyForm.value.displayName && !editingProperty.value) {
    propertyForm.value.name = propertyForm.value.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
  }
}

// Generate model name from display name
const generateModelName = () => {
  // Only auto-generate if the name field hasn't been manually edited
  if (modelData.value.display_name && !modelNameManuallyEdited.value) {
    modelData.value.name = modelData.value.display_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
  }
}

// Format date function (same as in ModelSpecViewer)
const formatDate = (dateString) => {
  if (!dateString) return 'TBD on creation'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Handle PropertyDialog save event
const handlePropertySave = ({ propertyName, propertySchema, required, oldPropertyName }) => {
  try {
    // Validate Pennsieve-specific rules before saving
    if (propertySchema['x-pennsieve-key'] === true && !required) {
      ElMessage.error(`Property "${propertyName}" has x-pennsieve-key set but is not marked as required`)
      return
    }

    if (propertySchema['x-pennsieve-sensitive'] === true && !required) {
      ElMessage.error(`Property "${propertyName}" has x-pennsieve-sensitive set but is not marked as required`)
      return
    }

    // Update schema
    const newProperties = { ...modelData.value.latest_version.schema.properties }
    const newRequired = [...(modelData.value.latest_version.schema.required || [])]

    // Remove old property name if editing
    if (oldPropertyName && oldPropertyName !== propertyName) {
      delete newProperties[oldPropertyName]
      const oldIndex = newRequired.indexOf(oldPropertyName)
      if (oldIndex > -1) {
        newRequired.splice(oldIndex, 1)
      }
    }

    // Add/update property
    newProperties[propertyName] = propertySchema

    // Handle required status
    const requiredIndex = newRequired.indexOf(propertyName)
    if (required && requiredIndex === -1) {
      newRequired.push(propertyName)
    } else if (!required && requiredIndex > -1) {
      newRequired.splice(requiredIndex, 1)
    }

    // Update model
    modelData.value.latest_version.schema = {
      ...modelData.value.latest_version.schema,
      properties: newProperties,
      required: newRequired
    }

    // Update JSON content if in JSON mode
    if (mode.value === 'json') {
      updateJsonContent()
    }

    // Update shared JSON data for preview
    updateSharedJsonData()

    ElMessage.success(oldPropertyName ? 'Property updated successfully' : 'Property added successfully')
  } catch (error) {
    ElMessage.error('Failed to save property: ' + error.message)
  }
}

// Handle PropertyDialog cancel event
const handlePropertyCancel = () => {
  // Nothing special needed, dialog will close automatically
}

// Lifecycle
onMounted(async () => {
  // Check if we're editing an existing template/model - prioritize template mode
  if (isTemplateMode.value && props.templateId) {
    await loadTemplateForEdit()
  } else if (props.modelId) {
    await loadModelForEdit()
  } else {
    initializeData()
    // Check for template data in URL query parameters (for model creation from template)
    if (!isTemplateMode.value) {
      loadTemplateFromQuery()
    }
  }
})

// Load template data from URL query parameters
const loadTemplateFromQuery = () => {
  const route = useRoute()
  
  if (route.query.template) {
    try {
      const templateData = JSON.parse(atob(route.query.template))
      loadTemplate(templateData)
    } catch (error) {
      console.error('Failed to parse template data:', error)
    }
  }
}

// Helper function to clean template names for model creation
const cleanTemplateName = (name) => {
  if (!name) return ''
  
  // Remove 'template' (case insensitive) and clean up
  return name
    .replace(/[_\s]*template[_\s]*/gi, '_')  // Replace 'template' with single underscore
    .replace(/^_+|_+$/g, '')  // Remove leading/trailing underscores
    .replace(/_+/g, '_')  // Replace multiple underscores with single
    || 'model'  // Fallback if name becomes empty
}

const cleanTemplateDisplayName = (displayName) => {
  if (!displayName) return ''
  
  // Remove 'template' (case insensitive) and clean up
  return displayName
    .replace(/\s*template\s*/gi, ' ')  // Replace 'template' with single space
    .replace(/^\s+|\s+$/g, '')  // Remove leading/trailing spaces
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    || 'Model'  // Fallback if name becomes empty
}

// Load template data into the model
const loadTemplate = (template) => {
  modelData.value = {
    id: undefined, // New model, no ID
    name: cleanTemplateName(template.name),
    display_name: cleanTemplateDisplayName(template.display_name || template.name),
    description: template.description || '',
    created_at: new Date().toISOString(),
    latest_version: {
      version: 1,
      schema: template.latest_version?.schema || template.schema || { ...defaultSchema }
    }
  }
  
  updateJsonContent()
  updateSharedJsonData()
}

// Load existing model for editing
const loadModelForEdit = async () => {
  try {
    console.log('Loading model for edit with modelId:', props.modelId, 'datasetId:', props.datasetId)
    
    // Always fetch models to ensure we have the latest data
    await metadataStore.fetchModels(props.datasetId)
    
    // Get the model from the store
    const model = metadataStore.modelById(props.modelId)
    
    console.log('Found model:', model)
    
    if (model) {
      loadExistingModel(model)
    } else {
      // Try looking through models directly in case modelById has an issue
      const allModels = metadataStore.models
      console.log('All models in store:', allModels)
      
      // Check if we can find the model directly
      const directModel = allModels.find(item => {
        // Try different possible structures
        return (item.model?.id === props.modelId) || 
               (item.id === props.modelId) ||
               (item.model?.id === parseInt(props.modelId)) ||
               (item.id === parseInt(props.modelId))
      })
      
      if (directModel) {
        console.log('Found model directly:', directModel)
        loadExistingModel(directModel.model || directModel)
      } else {
        throw new Error(`Model with ID ${props.modelId} not found in store`)
      }
    }
  } catch (error) {
    console.error('Failed to load model for editing:', error)
    ElMessage.error(`Failed to load model: ${error.message}`)
    // Navigate back to models list on error
    router.push({
      name: 'models-list',
      params: {
        datasetId: props.datasetId,
        orgId: props.orgId
      }
    })
  }
}

// Load existing template for editing
const loadTemplateForEdit = async () => {
  try {
    console.log('Loading template for edit with templateId:', props.templateId, 'orgId:', props.orgId)
    
    // Fetch template data from the store (implementation depends on your template store methods)
    await metadataStore.fetchTemplates(props.orgId)
    
    // Get the template from the store (adjust based on your store implementation)
    const template = metadataStore.templateById(props.templateId)
    
    if (template) {
      loadExistingTemplate(template)
    } else {
      throw new Error(`Template with ID ${props.templateId} not found`)
    }
  } catch (error) {
    console.error('Failed to load template for editing:', error)
    ElMessage.error(`Failed to load template: ${error.message}`)
    // Navigate back to template gallery on error
    router.push({
      name: 'new-model-from-template',
      params: {
        orgId: props.orgId
      }
    })
  }
}

// Load existing model data into the form
const loadExistingModel = (model) => {
  modelData.value = {
    id: model.id,
    name: model.name || '',
    display_name: model.display_name || model.displayName || '',
    description: model.description || '',
    created_at: model.created_at || model.createdAt || new Date().toISOString(),
    latest_version: {
      version: model.latest_version?.version || model.latestVersion?.version || 1,
      schema: model.latest_version?.schema || model.latestVersion?.schema || model.schema || { ...defaultSchema }
    }
  }
  
  updateJsonContent()
  updateSharedJsonData()
}

// Load existing template data into the form
const loadExistingTemplate = (template) => {
  modelData.value = {
    id: template.id,
    name: template.name || '',
    display_name: template.display_name || template.displayName || '',
    description: template.description || '',
    created_at: template.created_at || template.createdAt || new Date().toISOString(),
    latest_version: {
      version: template.latest_version?.version || template.latestVersion?.version || 1,
      schema: template.latest_version?.schema || template.latestVersion?.schema || template.schema || { ...defaultSchema }
    }
  }
  
  updateJsonContent()
  updateSharedJsonData()
}

// Watch for prop changes
const { initialModel } = toRefs(props)
watch(initialModel, () => {
  initializeData()
}, { deep: true })

// Watch for mode changes to sync JSON content
watch(mode, (newMode) => {
  if (newMode === 'json') {
    // Update JSON content when switching to JSON mode
    updateJsonContent()
  }
})

// Watch for form field changes to update shared JSON data in real-time
watch([() => modelData.value.name, () => modelData.value.display_name, () => modelData.value.description], () => {
  updateSharedJsonData()
}, { deep: true })
</script>

<template>
  <div class="model-spec-generator">
    <!-- Header -->
    <div class="generator-header">
      <div class="header-content">
        <div class="header-text">
<!--          <h1>{{ editMode ? 'Edit Model' : 'Create Model' }}</h1>-->
          <div class="header-title-row">
            <p v-if="!isEditMode">Define your JSON Schema specification using the guided builder or JSON editor.</p>
            <p v-else>Update your {{ isTemplateMode ? 'template' : 'model' }} specification and properties.</p>
            <el-tag v-if="isTemplateMode" type="success" size="small" effect="plain" class="template-badge">
              Template
            </el-tag>
          </div>
        </div>
        <div class="header-actions">
          <bf-button class="secondary" @click="cancelAndReturnToList">
            Cancel
          </bf-button>
          <bf-button type="primary" @click="saveModel">
            {{ isEditMode ? 'Create New Version' : (isTemplateMode ? 'Create Template' : 'Create Model') }}
          </bf-button>
        </div>
      </div>
    </div>


    <div class="generator-content">
      <!-- Left Panel: Form or JSON Editor -->
      <div class="editor-panel">
        <!-- Model Basic Info -->
        <el-card class="model-info-card" :class="{ 'edit-mode': isEditMode }">
          <template #header v-if="!isEditMode">
            <span>{{ isTemplateMode ? 'Template' : 'Model' }} Information</span>
          </template>
          
          <!-- Edit Mode: Static display exactly like ModelSpecViewer -->
          <div v-if="isEditMode" class="model-info-static">
            <div class="model-header">
              <span class="model-name">{{ modelData.display_name || modelData.name }}</span>
              <el-tag type="info" size="small" effect="plain">
                {{ Object.keys(modelData.latest_version?.schema?.properties || {}).length }} properties
              </el-tag>
            </div>
            
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="Name">
                {{ modelData.name }}
              </el-descriptions-item>
              <el-descriptions-item label="Display Name">
                {{ modelData.display_name }}
              </el-descriptions-item>
              <el-descriptions-item label="Description">
                {{ modelData.description || 'No description' }}
              </el-descriptions-item>
              <el-descriptions-item label="Created">
                {{ formatDate(modelData.created_at) }}
              </el-descriptions-item>
              <el-descriptions-item label="Version">
                v{{ modelData.latest_version?.version || 1 }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
          
          <!-- Create Mode: Editable form -->
          <el-form v-else :model="modelData" :rules="modelRules" label-position="top">
            <el-form-item prop="display_name" label="Display Name">
              <el-input
                v-model="modelData.display_name"
                placeholder="Human-readable name (e.g., Clinical Drug)"
                @input="generateModelName"
              />
            </el-form-item>
            <el-form-item prop="name" label="Model Identifier">
              <el-input
                v-model="modelData.name"
                placeholder="Technical identifier (e.g., clinical_drug)"
                @input="modelNameManuallyEdited = true"
              />
            </el-form-item>
            <el-form-item prop="description" label="Description">
              <el-input
                v-model="modelData.description"
                type="textarea"
                :rows="2"
                placeholder="Describe what this model represents"
              />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- Guided Mode -->
        <div v-if="mode === 'guided'" class="guided-mode">
          <el-card>
            <template #header>
              <div class="properties-header">
                <span>Properties</span>

                <div class="header-controls">
                  <button type="primary" size="small" @click="openPropertyDialog()">
                    Add Property
                  </button>
                  <div class="mode-switcher-tabs">
                    <button 
                      class="mode-switcher-tab" 
                      :class="{ active: mode === 'guided' }"
                      @click="mode = 'guided'"
                    >
                      <span class="tab-icon">🛠</span>
                    </button>
                    <button 
                      class="mode-switcher-tab" 
                      :class="{ active: mode === 'json' }"
                      @click="mode = 'json'"
                    >
                      <span class="tab-icon">{ }</span>
                    </button>
                  </div>

                </div>
              </div>
            </template>

            <div v-if="modelProperties.length === 0" class="no-properties">
              <p>No properties defined yet. Click "Add Property" to get started.</p>
            </div>

            <div v-else class="properties-list">
              <div
                v-for="[propName, property] in modelProperties"
                :key="propName"
                class="property-item"
              >
                <div class="property-info">
                  <div class="property-name">{{ property.title || propName }}</div>
                  <div class="property-meta">
                    <span class="property-type">{{ property.type }}</span>
                    <span v-if="property.format" class="property-format">({{ property.format }})</span>
                    <span v-if="modelData.latest_version.schema.required?.includes(propName)" class="required-badge">Required</span>
                    <span v-if="property['x-pennsieve-key']" class="key-badge">Key</span>
                  </div>
<!--                  <div v-if="property.description" class="property-description">-->
<!--                    {{ property.description }}-->
<!--                  </div>-->
                </div>
                <div class="property-actions">
                  <el-button size="small" @click="openPropertyDialog(propName)">Edit</el-button>
                  <el-button size="small" type="danger" @click="removeProperty(propName)">Remove</el-button>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <!-- JSON Mode -->
        <div v-if="mode === 'json'" class="json-mode">
          <el-card>
            <template #header>
              <div class="json-editor-header">
                <span>JSON Schema Editor</span>
                <div class="mode-switcher-tabs">
                  <button 
                    class="mode-switcher-tab" 
                    :class="{ active: mode === 'guided' }"
                    @click="mode = 'guided'"
                  >
                    <span class="tab-icon">🛠</span>
                  </button>
                  <button 
                    class="mode-switcher-tab" 
                    :class="{ active: mode === 'json' }"
                    @click="mode = 'json'"
                  >
                    <span class="tab-icon">{ }</span>
                  </button>
                </div>
              </div>
            </template>
            <div class="json-editor">
              <el-input
                ref="jsonEditor"
                v-model="jsonContent"
                type="textarea"
                :rows="20"
                placeholder="Enter JSON Schema here..."
                @input="onJsonContentChange"
                @keydown="onJsonEditorKeydown"
              />
              <div v-if="jsonError" class="json-error">
                {{ jsonError }}
              </div>
            </div>
          </el-card>
        </div>
      </div>

      <!-- Right Panel: Preview -->
      <div class="preview-panel">
        <div class="preview-header">
          <span>Preview</span>
          <div class="preview-view-mode-tabs">
            <button 
              class="preview-view-mode-tab" 
              :class="{ active: previewViewMode === 'ui' }"
              @click="previewViewMode = 'ui'"
            >
              <span class="tab-icon">👁</span>
            </button>
            <button 
              class="preview-view-mode-tab" 
              :class="{ active: previewViewMode === 'json' }"
              @click="previewViewMode = 'json'"
            >
              <span class="tab-icon">{ }</span>
            </button>
          </div>
        </div>
        <div class="preview-content">
          <ModelSpecViewer :model="previewModel" :view-mode="previewViewMode" :hide-selector="true" :minimal="true" />
        </div>
      </div>
    </div>


    <!-- Property Dialog -->
    <PropertyDialog
      v-model:visible="propertyDialogVisible"
      :editing-property="editingProperty"
      :initial-property-data="propertyFormData"
      @save="handlePropertySave"
      @cancel="handlePropertyCancel"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/button';
@use '../../../../styles/element/tag';


.model-spec-generator {
  padding: 24px;
  
  .generator-header {
    margin-bottom: 24px;
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      
      .header-text {
        flex: 1;
        
        h1 {
          font-size: 28px;
          font-weight: 600;
          color: theme.$gray_6;
          margin: 0 0 8px 0;
        }
        
        .header-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          
          p {
            color: theme.$gray_5;
            margin: 0;
            font-size: 16px;
          }
          
          .template-badge {
            flex-shrink: 0;
          }
        }
        
        p {
          color: theme.$gray_5;
          margin: 0;
          font-size: 16px;
        }
      }
      
      .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;
      }
    }
  }
  
  .mode-toggle {
    display: flex;
    justify-content: center;
    margin-bottom: 24px;
    
    .mode-tabs {
      display: flex;
      background-color: theme.$gray_1;
      border-radius: 6px;
      padding: 4px;
      gap: 2px;
      border: 1px solid theme.$gray_2;
      
      .mode-tab {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: transparent;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        color: theme.$gray_5;
        
        .tab-icon {
          font-size: 14px;
        }
        
        .tab-label {
          font-size: 14px;
          font-weight: 500;
        }
        
        &:hover {
          background-color: theme.$gray_2;
          color: theme.$gray_6;
        }
        
        &.active {
          background-color: theme.$white;
          color: theme.$purple_3;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          
          .tab-icon {
            color: theme.$purple_2;
          }
        }
      }
    }
  }
  
  .generator-content {
    display: flex;
    gap: 24px;
    min-height: 600px;
  }
  
  .editor-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    .model-info-card {
      flex-shrink: 0;
      border: none;
      box-shadow: none;
      border-left: 2px solid theme.$purple_2;
      border-radius: 0;
      
      // Edit mode: remove header and left border
      &.edit-mode {
        border-left: none;
        
        :deep(.el-card__header) {
          display: none;
        }
        
        :deep(.el-card__body) {
          padding: 0;
        }
      }
      
      :deep(.el-card__header) {
        background-color: theme.$gray_1;
        border-bottom: 1px solid theme.$gray_2;
        padding: 16px 20px;
        
        span {
          font-weight: 500;
          color: theme.$gray_6;
        }
      }
      
      :deep(.el-card__body) {
        padding: 20px;
      }
      
      .model-info-static {
        .model-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-left: 8px;
          
          .model-name {
            font-size: 16px;
            font-weight: 600;
            color: theme.$gray_6;
          }
        }
        
        .model-info-item {
          margin-bottom: 16px;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: theme.$gray_5;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .info-value {
            font-size: 14px;
            color: theme.$gray_6;
            line-height: 1.4;
            min-height: 20px;
          }
        }
      }
      
      // Style the descriptions component to match ModelSpecViewer
      :deep(.el-descriptions) {
        .el-descriptions__label {
          font-weight: 500;
          width: 120px;
        }
      }
    }
    
    .guided-mode,
    .json-mode {
      flex: 1;
      min-height: 400px;
      display: flex;
      flex-direction: column;
      
      .el-card {
        height: 100%;
        border: none;
        box-shadow: none;
        border-left: 2px solid theme.$purple_2;
        border-radius: 0;
        display: flex;
        flex-direction: column;
        
        :deep(.el-card__header) {
          background-color: theme.$gray_1;
          border-bottom: 1px solid theme.$gray_2;
          padding: 16px 20px;
          flex-shrink: 0;
          
          .properties-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            
            span {
              font-weight: 500;
              color: theme.$gray_6;
            }
            
            // Theme colors for Add Property button
            :deep(.el-button--primary) {
              background-color: theme.$purple_3 !important;
              border-color: theme.$purple_3 !important;
              color: theme.$white !important;
              
              &:hover, &:focus {
                background-color: theme.$purple_2 !important;
                border-color: theme.$purple_2 !important;
                color: theme.$white !important;
              }
            }
          }
        }
        
        :deep(.el-card__body) {
          flex: 1;
          overflow: hidden;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
      }
      
      .json-editor {
        flex: 1;
        display: flex;
        flex-direction: column;
        
        :deep(.el-textarea) {
          height: 100%;
          
          .el-textarea__inner {
            height: 100% !important;
            resize: none;
            min-height: 300px;
          }
        }
      }
    }
  }
  
  .preview-panel {
    flex: 1;
    min-width: 0;
    height: 100%;
    min-height: 600px;
    display: flex;
    flex-direction: column;
    //border-left: 2px solid theme.$purple_2;
    
    .preview-header {
      //background-color: theme.$gray_1;
      //border-bottom: 1px solid theme.$gray_2;
      font-size: 18px;
      //padding: 16px 20px;
      flex-shrink: 0;
      
      span {
        font-weight: 500;
        color: theme.$gray_6;
      }
    }
    
    .preview-content {
      flex: 1;
      overflow-y: auto;
      //padding: 20px;
    }
  }
  
  .generator-actions {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid theme.$gray_2;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    
    // Theme button colors
    :deep(.el-button--primary) {
      background-color: theme.$purple_3 !important;
      border-color: theme.$purple_3 !important;
      color: theme.$white !important;
      
      &:hover, &:focus {
        background-color: theme.$purple_2 !important;
        border-color: theme.$purple_2 !important;
        color: theme.$white !important;
      }
    }
    
    :deep(.el-button:not(.el-button--primary)) {
      color: theme.$gray_5;
      border-color: theme.$gray_3;
      background-color: theme.$white;
      
      &:hover {
        color: theme.$purple_3;
        border-color: theme.$purple_3;
      }
      
      &:focus {
        color: theme.$purple_3;
        border-color: theme.$purple_3;
      }
    }
  }
}

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .header-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.json-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  span {
    font-weight: 500;
    color: theme.$gray_6;
  }
}

.mode-switcher-tabs {
  display: flex;
  background-color: theme.$gray_1;
  border-radius: 4px;
  padding: 2px;
  gap: 1px;
  border: 1px solid theme.$gray_2;
  
  .mode-switcher-tab {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: theme.$gray_5;
    
    .tab-icon {
      font-size: 12px;
    }
    
    &:hover {
      background-color: theme.$gray_2;
      color: theme.$gray_6;
    }
    
    &.active {
      background-color: theme.$white;
      color: theme.$purple_3;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      
      .tab-icon {
        color: theme.$purple_2;
      }
    }
  }
}

.no-properties {
  text-align: center;
  padding: 32px;
  color: theme.$gray_4;
}

.properties-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.property-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  //background-color: theme.$gray_1;
  //border-left: 3px solid theme.$purple_2;
  
  .property-info {
    flex: 1;
    
    .property-name {
      font-weight: 500;
      color: theme.$gray_6;
      margin-bottom: 4px;
    }
    
    .property-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 4px;
      
      .property-type {
        background-color: theme.$purple_tint;
        color: theme.$purple_2;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
      
      .property-format {
        color: theme.$gray_5;
        font-size: 12px;
      }
      
      .required-badge {
        background-color: theme.$red_tint;
        color: theme.$red_2;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
      
      .key-badge {
        background-color: theme.$orange_tint;
        color: theme.$orange_1;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
      }
    }
    
    .property-description {
      color: theme.$gray_5;
      font-size: 13px;
    }
  }
  
  .property-actions {
    display: flex;
    gap: 4px;
    
    // Style property action buttons
    :deep(.el-button:not(.el-button--danger)) {
      color: theme.$purple_3;
      border-color: theme.$purple_1;
      background-color: theme.$white;
      
      &:hover {
        color: theme.$white;
        background-color: theme.$purple_3;
        border-color: theme.$purple_3;
      }
    }
    
    :deep(.el-button--danger) {
      color: theme.$red_1;
      border-color: theme.$red_1;
      background-color: theme.$white;
      
      &:hover {
        color: theme.$white;
        background-color: theme.$red_1;
        border-color: theme.$red_1;
      }
    }
  }
}

.json-editor {
  .json-error {
    color: theme.$red_1;
    background-color: theme.$red_tint;
    padding: 8px;
    border-radius: 4px;
    margin-top: 8px;
    font-size: 13px;
  }
}

.property-dialog {
  .constraints-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid theme.$gray_2;
    
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: theme.$gray_6;
    }
  }
  
  .constraint-row {
    display: flex;
    gap: 16px;
    
    .el-form-item {
      flex: 1;
    }
  }
  
  .dialog-actions {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid theme.$gray_2;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

// Fix element-plus textarea in JSON mode
:deep(.json-mode .el-textarea__inner) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
}

// Preview header with view mode selector
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  .preview-view-mode-tabs {
    display: flex;
    background-color: theme.$gray_1;
    border-radius: 4px;
    padding: 2px;
    gap: 1px;
    border: 1px solid theme.$gray_2;
    
    .preview-view-mode-tab {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      background: transparent;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: theme.$gray_5;
      
      .tab-icon {
        font-size: 12px;
      }
      
      &:hover {
        background-color: theme.$gray_2;
        color: theme.$gray_6;
      }
      
      &.active {
        background-color: theme.$white;
        color: theme.$purple_3;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        
        .tab-icon {
          color: theme.$purple_2;
        }
      }
    }
  }
}
</style>