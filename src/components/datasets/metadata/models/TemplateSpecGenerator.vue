<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElRadioGroup, ElRadioButton, ElCard, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElButton, ElMessage, ElCheckbox, ElDescriptions, ElDescriptionsItem } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'
import TemplateSpecViewer from './TemplateSpecViewer.vue'
import PropertyDialog from './PropertyDialog.vue'
import BfButton from "@/components/shared/bf-button/BfButton.vue"
import IconCopyDocument from '@/components/icons/IconCopyDocument.vue'

// Store setup
const metadataStore = useMetadataStore()
const router = useRouter()

// Props
const props = defineProps({
  initialTemplate: {
    type: Object,
    default: null
  },
  templateId: {
    type: String,
    default: null
  },
  editMode: {
    type: Boolean,
    default: false
  },
  orgId: {
    type: String,
    required: true
  }
})

// Determine if we're in edit mode based on templateId presence
const isEditMode = computed(() => props.editMode || !!props.templateId)

// Emits
const emit = defineEmits(['save-template', 'cancel'])

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

// Template data
const templateData = ref({
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
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' }
]

const stringFormats = [
  { value: '', label: 'None' },
  { value: 'date', label: 'Date' },
  { value: 'date-time', label: 'Date Time' },
  { value: 'time', label: 'Time' },
  { value: 'email', label: 'Email' },
  { value: 'uri', label: 'URI' },
  { value: 'uuid', label: 'UUID' }
]

// Computed properties
const propertyEntries = computed(() => {
  return Object.entries(templateData.value.latest_version.schema.properties || {})
})

const hasProperties = computed(() => {
  return propertyEntries.value.length > 0
})

// Watch for data changes to update preview
watch(() => templateData.value, (newData) => {
  sharedJsonData.value = {
    name: newData.name,
    display_name: newData.display_name,
    description: newData.description,
    latest_version: {
      version: (newData.latest_version?.version || 0) + 1,
      schema: newData.latest_version.schema
    },
    schema: newData.latest_version.schema
  }
}, { deep: true })

// Watch for JSON mode changes
watch(() => mode.value, (newMode) => {
  if (newMode === 'json') {
    // Update JSON content when switching to JSON mode
    updateJsonContent()
  } else {
    // Parse JSON content when switching back to guided mode
    parseJsonContent()
  }
})

const updateJsonContent = () => {
  const jsonData = {
    name: templateData.value.name,
    display_name: templateData.value.display_name,
    description: templateData.value.description,
    schema: templateData.value.latest_version.schema
  }
  jsonContent.value = JSON.stringify(jsonData, null, 2)
}

const parseJsonContent = () => {
  if (!jsonContent.value.trim()) return

  try {
    const parsed = JSON.parse(jsonContent.value)
    
    // Validate structure
    if (!parsed.schema || typeof parsed.schema !== 'object') {
      throw new Error('Invalid schema structure')
    }

    // Update template data
    templateData.value.name = parsed.name || ''
    templateData.value.display_name = parsed.display_name || ''
    templateData.value.description = parsed.description || ''
    templateData.value.latest_version.schema = {
      ...defaultSchema,
      ...parsed.schema
    }

    jsonError.value = ''
  } catch (error) {
    jsonError.value = `Invalid JSON: ${error.message}`
  }
}

const handleJsonInput = (event) => {
  jsonContent.value = event.target.value
  parseJsonContent()
}

const handleTabInTextarea = (event) => {
  if (event.key === 'Tab') {
    event.preventDefault()
    
    const textarea = event.target
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    
    // Insert 2 spaces at cursor position
    const newValue = jsonContent.value.substring(0, start) + '  ' + jsonContent.value.substring(end)
    
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
    const property = templateData.value.latest_version.schema.properties[propertyName]
    propertyForm.value = {
      name: propertyName,
      displayName: property.title || propertyName,
      type: property.type || 'string',
      required: templateData.value.latest_version.schema.required?.includes(propertyName) || false,
      description: property.description || '',
      format: property.format || '',
      minimum: property.minimum,
      maximum: property.maximum,
      minLength: property.minLength,
      maxLength: property.maxLength,
      pattern: property.pattern || '',
      enum: property.enum || [],
      enumInput: property.enum ? property.enum.join(', ') : '',
      default: property.default
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
      default: undefined
    }
  }
  
  propertyDialogVisible.value = true
}

const saveProperty = async () => {
  try {
    // Build property schema
    const property = {
      type: propertyForm.value.type
    }

    if (propertyForm.value.displayName !== propertyForm.value.name) {
      property.title = propertyForm.value.displayName
    }

    if (propertyForm.value.description) {
      property.description = propertyForm.value.description
    }

    if (propertyForm.value.format && propertyForm.value.type === 'string') {
      property.format = propertyForm.value.format
    }

    // Add constraints based on type
    if (propertyForm.value.type === 'string') {
      if (propertyForm.value.minLength !== undefined && propertyForm.value.minLength !== '') {
        property.minLength = parseInt(propertyForm.value.minLength)
      }
      if (propertyForm.value.maxLength !== undefined && propertyForm.value.maxLength !== '') {
        property.maxLength = parseInt(propertyForm.value.maxLength)
      }
      if (propertyForm.value.pattern) {
        property.pattern = propertyForm.value.pattern
      }
    }

    if (propertyForm.value.type === 'number' || propertyForm.value.type === 'integer') {
      if (propertyForm.value.minimum !== undefined && propertyForm.value.minimum !== '') {
        property.minimum = parseFloat(propertyForm.value.minimum)
      }
      if (propertyForm.value.maximum !== undefined && propertyForm.value.maximum !== '') {
        property.maximum = parseFloat(propertyForm.value.maximum)
      }
    }

    // Handle enum values
    if (propertyForm.value.enumInput) {
      const enumValues = propertyForm.value.enumInput.split(',').map(v => v.trim()).filter(v => v)
      if (enumValues.length > 0) {
        property.enum = enumValues
      }
    }

    // Handle default value
    if (propertyForm.value.default !== undefined && propertyForm.value.default !== '') {
      property.default = propertyForm.value.default
    }

    // Update schema
    const schema = { ...templateData.value.latest_version.schema }
    
    // If editing, remove old property first
    if (editingProperty.value && editingProperty.value !== propertyForm.value.name) {
      delete schema.properties[editingProperty.value]
      
      // Remove from required array if present
      if (schema.required) {
        schema.required = schema.required.filter(req => req !== editingProperty.value)
      }
    }

    // Add/update property
    schema.properties[propertyForm.value.name] = property

    // Handle required status
    if (!schema.required) {
      schema.required = []
    }
    
    if (propertyForm.value.required) {
      if (!schema.required.includes(propertyForm.value.name)) {
        schema.required.push(propertyForm.value.name)
      }
    } else {
      schema.required = schema.required.filter(req => req !== propertyForm.value.name)
    }

    templateData.value.latest_version.schema = schema
    propertyDialogVisible.value = false

    ElMessage.success('Property saved successfully')
  } catch (error) {
    console.error('Failed to save property:', error)
    ElMessage.error(`Failed to save property: ${error.message}`)
  }
}

const deleteProperty = (propertyName) => {
  const schema = { ...templateData.value.latest_version.schema }
  delete schema.properties[propertyName]
  
  // Remove from required array if present
  if (schema.required) {
    schema.required = schema.required.filter(req => req !== propertyName)
  }
  
  templateData.value.latest_version.schema = schema
  ElMessage.success('Property deleted successfully')
}

const saveTemplate = async () => {
  // Validation
  if (!templateData.value.name || !templateData.value.display_name) {
    ElMessage.error('Template name and display name are required')
    return
  }

  try {
    // Update schema title
    templateData.value.latest_version.schema.title = templateData.value.name

    if (isEditMode.value) {
      // Create new version of existing template
      await metadataStore.createTemplateVersion(props.templateId, {
        schema: templateData.value.latest_version.schema
      })
      ElMessage.success(`New version of "${templateData.value.display_name}" created successfully`)
      
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
        name: templateData.value.name,
        display_name: templateData.value.display_name,
        description: templateData.value.description,
        schema: templateData.value.latest_version.schema
      }, props.orgId)
      
      ElMessage.success(`Template "${templateData.value.display_name}" created successfully`)
      emit('save-template', createdTemplate)
      
      // Navigate back to template gallery after successful creation
      router.push({
        name: 'new-model-from-template',
        params: {
          orgId: props.orgId
        }
      })
    }
  } catch (error) {
    console.error('Failed to save template:', error)
    ElMessage.error(`Failed to save template: ${error.message || 'Unknown error'}`)
  }
}

const cancel = () => {
  if (isEditMode.value) {
    router.push({
      name: 'template-details',
      params: {
        orgId: props.orgId,
        templateId: props.templateId
      }
    })
  } else {
    router.push({
      name: 'new-model-from-template',
      params: {
        orgId: props.orgId
      }
    })
  }
}

// Copy Template ID to clipboard
const copyTemplateId = async () => {
  try {
    await navigator.clipboard.writeText(templateData.value.id)
    ElMessage.success('Template ID copied to clipboard')
  } catch (error) {
    console.error('Failed to copy template ID:', error)
    ElMessage.error('Failed to copy template ID to clipboard')
  }
}

// Load template data if editing
const loadTemplate = async () => {
  if (isEditMode.value && props.templateId) {
    try {
      // Ensure templates are loaded in the store
      await metadataStore.fetchTemplates(props.orgId)
      
      // Use the centralized templateById lookup
      const template = metadataStore.templateById(props.templateId)
      
      if (template) {
        templateData.value = { ...template }
      } else {
        ElMessage.error('Template not found')
      }
    } catch (error) {
      console.error('Failed to load template:', error)
      ElMessage.error('Failed to load template')
    }
  }
}

// Initialize component
onMounted(() => {
  if (props.initialTemplate) {
    templateData.value = { ...props.initialTemplate }
  }
  
  loadTemplate()
  updateJsonContent()
})
</script>

<template>
  <div class="template-spec-generator">
    <!-- Header -->
    <div class="generator-header">
      <div class="header-content">
        <div class="header-text">
          <div class="template-type-indicator">
            <el-tag type="warning" size="small" effect="plain" class="template-badge">
              {{ isEditMode ? '✏️ Editing Template' : '📋 Creating Template' }}
            </el-tag>
          </div>
          <p v-if="!isEditMode">Define your template JSON Schema specification using the guided builder or JSON editor.</p>
          <p v-else>Update your template specification and properties.</p>
        </div>
        <div class="header-actions">
          <bf-button @click="cancel">
            Cancel
          </bf-button>
          <bf-button type="primary" @click="saveTemplate">
            {{ isEditMode ? 'Create New Version' : 'Save Template' }}
          </bf-button>
        </div>
      </div>
    </div>

    <div class="generator-content">
      <!-- Left Panel: Form or JSON Editor -->
      <div class="editor-panel">
        <!-- Template Basic Info -->
        <el-card class="template-info-card" :class="{ 'edit-mode': isEditMode }">
          <template #header v-if="!isEditMode">
            <span>Template Information</span>
          </template>
          
          <!-- Edit Mode: Static display exactly like ModelSpecGenerator -->
          <div v-if="isEditMode" class="template-info-static">
            <div class="template-header">
              <span class="template-name">{{ templateData.display_name || templateData.name }}</span>
              <el-tag type="info" size="small" effect="plain">
                {{ Object.keys(templateData.latest_version?.schema?.properties || {}).length }} properties
              </el-tag>
            </div>
            
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="Name">
                {{ templateData.name }}
              </el-descriptions-item>
              <el-descriptions-item label="Display Name">
                {{ templateData.display_name }}
              </el-descriptions-item>
              <el-descriptions-item label="Description">
                {{ templateData.description || 'No description' }}
              </el-descriptions-item>
              <el-descriptions-item label="Template ID" v-if="templateData.id">
                <div class="editable-field">
                  <span style="font-family: Monaco, monospace; font-size: 12px;">{{ templateData.id }}</span>
                  <el-button 
                    @click="copyTemplateId" 
                    type="text" 
                    size="small" 
                    class="edit-btn" 
                    title="Copy Template ID"
                  >
                    <IconCopyDocument />
                  </el-button>
                </div>
              </el-descriptions-item>
              <el-descriptions-item label="Version">
                v{{ (templateData.latest_version?.version || 0) + 1 }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
          
          <!-- Create Mode: Editable form -->
          <el-form v-else :model="templateData" label-position="top">
            <el-form-item prop="display_name" label="Display Name">
              <el-input
                v-model="templateData.display_name"
                placeholder="Human-readable name (e.g., Clinical Drug Template)"
              />
            </el-form-item>
            <el-form-item prop="name" label="Template Identifier">
              <el-input
                v-model="templateData.name"
                placeholder="Technical identifier (e.g., clinical_drug_template)"
              />
            </el-form-item>
            <el-form-item prop="description" label="Description">
              <el-input
                v-model="templateData.description"
                type="textarea"
                :rows="2"
                placeholder="Describe what this template represents"
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
                  <el-button type="primary" size="small" @click="openPropertyDialog()">
                    Add Property
                  </el-button>
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

            <div v-if="propertyEntries.length === 0" class="no-properties">
              <p>No properties defined yet. Click "Add Property" to get started.</p>
            </div>

            <div v-else class="properties-list">
              <div
                v-for="[propName, property] in propertyEntries"
                :key="propName"
                class="property-item"
              >
                <div class="property-info">
                  <div class="property-name">{{ property.title || propName }}</div>
                  <div class="property-meta">
                    <span class="property-type">{{ property.type }}</span>
                    <span v-if="property.format" class="property-format">({{ property.format }})</span>
                    <span v-if="templateData.latest_version.schema.required?.includes(propName)" class="required-badge">Required</span>
                  </div>
                </div>
                <div class="property-actions">
                  <el-button size="small" @click="openPropertyDialog(propName)">Edit</el-button>
                  <el-button size="small" type="danger" @click="deleteProperty(propName)">Remove</el-button>
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
                @input="handleJsonInput"
                @keydown="handleTabInTextarea"
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
        <el-card>
          <template #header>
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
          </template>
          <TemplateSpecViewer
            :templateData="sharedJsonData"
            :viewMode="previewViewMode"
            :minimal="true"
            :hideActions="true"
          />
        </el-card>
      </div>
    </div>

    <!-- Property Dialog -->
    <PropertyDialog
      v-model:visible="propertyDialogVisible"
      :property-form="propertyForm"
      :property-types="propertyTypes"
      :string-formats="stringFormats"
      @save="saveProperty"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/button';
@use '../../../../styles/element/tag';

.template-spec-generator {
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
        
        .template-type-indicator {
          margin-bottom: 8px;
          
          .template-badge {
            background-color: rgba(255, 193, 7, 0.1) !important;
            border-color: rgba(255, 193, 7, 0.3) !important;
            color: #b8860b !important;
            font-weight: 500;
            font-size: 12px;
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
    
    .template-info-card {
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
      
      .template-info-static {
        .template-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          
          .template-name {
            font-size: 16px;
            font-weight: 600;
            color: theme.$gray_6;
          }
        }
        
        // Style the descriptions component to match ModelSpecViewer
        :deep(.el-descriptions) {
          .el-descriptions__label {
            font-weight: 500;
            width: 120px;
          }
          
          .el-descriptions__content {
            min-height: 18px;
            display: flex;
            align-items: center;
          }
        }
        
        // Inline editing styles
        .editable-field {
          display: flex;
          align-items: center;
          gap: 8px;
          
          .edit-btn {
            opacity: 0.7;
            transition: all 0.2s ease;
            padding: 2px !important;
            min-height: unset !important;
            height: 16px !important;
            width: 16px !important;
            color: theme.$gray_5 !important;
            
            :deep(.el-button__icon) {
              margin: 0 !important;
            }
            
            :deep(svg) {
              width: 12px !important;
              height: 12px !important;
            }
            
            &:hover {
              opacity: 1;
              color: theme.$purple_2 !important;
            }
          }
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
          
          .properties-header,
          .json-editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            
            span {
              font-weight: 500;
              color: theme.$gray_6;
            }
            
            .header-controls {
              display: flex;
              align-items: center;
              gap: 12px;
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
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            line-height: 1.5;
          }
        }
        
        .json-error {
          margin-top: 8px;
          padding: 8px 12px;
          background-color: theme.$red_tint;
          border: 1px solid theme.$red_1;
          border-radius: 4px;
          color: theme.$red_2;
          font-size: 14px;
        }
      }
      
      .properties-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        flex: 1;
        overflow-y: auto;
      }
      
      .property-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 16px;
        background-color: theme.$gray_1;
        border-radius: 8px;
        border: 1px solid theme.$gray_2;
        
        .property-info {
          flex: 1;
          
          .property-name {
            font-weight: 600;
            color: theme.$gray_6;
            margin-bottom: 4px;
            font-size: 14px;
          }
          
          .property-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            
            .property-type {
              font-size: 12px;
              color: theme.$purple_2;
              background-color: theme.$purple_tint;
              padding: 2px 6px;
              border-radius: 3px;
              display: inline-block;
            }
            
            .property-format {
              font-size: 12px;
              color: theme.$gray_5;
              font-style: italic;
            }
            
            .required-badge {
              font-size: 12px;
              color: theme.$red_2;
              background-color: theme.$red_tint;
              padding: 2px 6px;
              border-radius: 3px;
              display: inline-block;
            }
          }
        }
        
        .property-actions {
          display: flex;
          gap: 8px;
        }
      }
      
      .no-properties {
        text-align: center;
        padding: 48px 24px;
        color: theme.$gray_4;
        
        p {
          margin: 0;
          font-size: 16px;
        }
      }
    }
  }
  
  .preview-panel {
    flex: 1;
    min-width: 0;
    
    .el-card {
      height: 100%;
      min-height: 600px;
      border: none;
      box-shadow: none;
      border-left: 2px solid theme.$purple_2;
      border-radius: 0;
      
      :deep(.el-card__header) {
        background-color: theme.$gray_1;
        border-bottom: 1px solid theme.$gray_2;
        padding: 16px 20px;
        
        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          
          span {
            font-weight: 500;
            color: theme.$gray_6;
          }
        }
      }
      
      :deep(.el-card__body) {
        height: calc(100% - 60px);
        overflow-y: auto;
        padding: 20px;
      }
    }
  }
}

// Mode switcher tabs styling
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
    justify-content: center;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: theme.$gray_5;
    min-width: 32px;
    
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
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      
      .tab-icon {
        color: theme.$purple_2;
      }
    }
  }
}

// Preview view mode tabs styling
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
    justify-content: center;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: theme.$gray_5;
    min-width: 32px;
    
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
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      
      .tab-icon {
        color: theme.$purple_2;
      }
    }
  }
}

// Button theme overrides
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

:deep(.el-button:not(.el-button--primary):not(.el-button--danger)) {
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
</style>