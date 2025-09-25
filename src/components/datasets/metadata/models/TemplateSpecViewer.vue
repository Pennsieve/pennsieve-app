<script setup>
import { ref, computed, defineComponent, h, onMounted } from 'vue'
import { ElCard, ElTag, ElTooltip, ElButton, ElDescriptions, ElDescriptionsItem, ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'

// Import components
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import ViewToggle from '@/components/shared/ViewToggle/ViewToggle.vue'
import IconCopyDocument from '@/components/icons/IconCopyDocument.vue'

const props = defineProps({
  datasetId: {
    type: String,
    default: ''
  },
  orgId: {
    type: String,
    default: ''
  },
  templateId: {
    type: String,
    default: ''
  },
  templateData: {
    type: Object,
    default: null
  },
  viewMode: {
    type: String,
    default: 'ui'
  },
  minimal: {
    type: Boolean,
    default: false
  },
  hideActions: {
    type: Boolean,
    default: false
  },
  hideSelector: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const metadataStore = useMetadataStore()

// Reactive data
const internalTemplateData = ref(null)
const loading = ref(true)
const error = ref('')
const internalViewMode = ref(props.viewMode || 'ui')

// Computed properties - use props.templateData if provided, otherwise lookup by ID
const effectiveTemplateData = computed(() => {
  if (props.templateData) {
    return props.templateData
  }
  
  if (props.templateId) {
    const template = metadataStore.templateById(props.templateId)
    return template || internalTemplateData.value
  }
  
  return internalTemplateData.value
})

const templateSchema = computed(() => {
  const data = effectiveTemplateData.value
  if (!data) return null
  
  // Handle both direct schema and latest_version.schema structures
  if (data.schema) {
    return data.schema
  }
  if (data.latest_version?.schema) {
    return data.latest_version.schema
  }
  return null
})

const templateProperties = computed(() => {
  if (!templateSchema.value?.properties) return {}
  return templateSchema.value.properties
})

const propertyCount = computed(() => {
  return Object.keys(templateProperties.value).length
})

const viewMode = computed(() => {
  // In minimal mode (preview), respect the parent's viewMode prop
  // In normal mode, use internal state for user interactions
  return props.minimal ? (props.viewMode || internalViewMode.value) : internalViewMode.value
})

// Template fetching
const fetchTemplateData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // Use the metadata store to fetch templates (store handles storage and transformation)
    await metadataStore.fetchTemplates(props.orgId)
    
    // Try to find the template using the store's templateById method
    const template = metadataStore.templateById(props.templateId)
    if (!template) {
      error.value = 'Template not found'
    }
    // No need to set internalTemplateData since effectiveTemplateData now uses templateById directly
  } catch (err) {
    console.error('Failed to fetch template data:', err)
    error.value = err.message || 'Failed to load template'
  } finally {
    loading.value = false
  }
}

// Event handlers

const handleCreateModel = () => {
  if (!effectiveTemplateData.value) return
  
  // Navigate to new-model route with template data
  router.push({
    name: 'new-model',
    params: {
      datasetId: props.datasetId,
      orgId: props.orgId,
    },
    query: {
      template: btoa(JSON.stringify(effectiveTemplateData.value)) // Base64 encode the template
    }
  })
}

const handleEditTemplate = () => {
  if (!effectiveTemplateData.value) return
  
  // Navigate to template edit route
  router.push({
    name: 'template-edit',
    params: {
      templateId: props.templateId,
      orgId: props.orgId
    }
  })
}

// Property formatting utilities
const formatPropertyType = (property) => {
  if (property.type === 'object' && property.properties) {
    return 'object'
  }
  
  if (property.type === 'array' && property.items) {
    const itemType = property.items.type || 'any'
    return `array<${itemType}>`
  }
  
  if (Array.isArray(property.type)) {
    return property.type.filter(t => t !== 'null').join(' | ')
  }
  
  // Add format information for special types
  if (property.format) {
    switch (property.format) {
      case 'date': return 'date'
      case 'date-time': return 'datetime'
      case 'time': return 'time'
      case 'email': return 'email'
      case 'uri':
      case 'url': return 'url'
      case 'uuid': return 'uuid'
      default: return `${property.type} (${property.format})`
    }
  }
  
  return property.type || 'any'
}

const isRequired = (propName) => {
  const required = templateSchema.value?.required || []
  return required.includes(propName)
}

const getConstraintInfo = (property) => {
  const constraints = []
  
  if (property.minimum !== undefined) constraints.push(`min: ${property.minimum}`)
  if (property.maximum !== undefined) constraints.push(`max: ${property.maximum}`)
  if (property.minLength !== undefined) constraints.push(`minLen: ${property.minLength}`)
  if (property.maxLength !== undefined) constraints.push(`maxLen: ${property.maxLength}`)
  if (property.pattern) constraints.push(`pattern: ${property.pattern}`)
  if (property.enum) constraints.push(`values: [${property.enum.join(', ')}]`)
  
  return constraints
}

const getDefaultOrExample = (property) => {
  if (property.default !== undefined) {
    return { value: property.default, type: 'default' }
  }
  if (property.examples && property.examples.length > 0) {
    return { value: property.examples[0], type: 'example' }
  }
  if (property.example !== undefined) {
    return { value: property.example, type: 'example' }
  }
  return null
}

const formatValue = (value) => {
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const isNestedObject = (property) => {
  return property.type === 'object' && property.properties
}

// Copy Template ID to clipboard
const copyTemplateId = async () => {
  try {
    await navigator.clipboard.writeText(effectiveTemplateData.value.id)
    ElMessage.success('Template ID copied to clipboard')
  } catch (error) {
    console.error('Failed to copy template ID:', error)
    ElMessage.error('Failed to copy template ID')
  }
}

// Lifecycle
onMounted(() => {
  // Only fetch if we don't have templateData from props
  if (!props.templateData) {
    fetchTemplateData()
  } else {
    // If we have templateData from props, set loading to false
    loading.value = false
  }
})

// Recursive component for nested properties
const PropertyTree = defineComponent({
  name: 'PropertyTree',
  props: {
    properties: {
      type: Object,
      required: true
    },
    required: {
      type: Array,
      default: () => []
    },
    level: {
      type: Number,
      default: 0
    }
  },
  setup(props) {
    const formatType = (property) => {
      if (property.type === 'object' && property.properties) {
        return 'object'
      }
      
      if (property.type === 'array' && property.items) {
        const itemType = property.items.type || 'any'
        return `array<${itemType}>`
      }
      
      if (Array.isArray(property.type)) {
        return property.type.filter(t => t !== 'null').join(' | ')
      }
      
      return property.type || 'any'
    }
    
    return () => {
      const items = []
      
      const propertyEntries = Object.entries(props.properties)
      propertyEntries.forEach(([propName, property]) => {
        const tags = []
        
        if (props.required.includes(propName)) {
          tags.push(h(ElTag, { 
            type: '', 
            size: 'small', 
            effect: 'plain',
            class: 'tag-required'
          }, () => 'Required'))
        }
        
        tags.push(h(ElTag, { 
          type: '', 
          size: 'small', 
          effect: 'plain',
          class: 'tag-type'
        }, () => formatType(property)))
        
        const header = h('div', { class: 'nested-property-header' }, [
          h('span', { class: 'nested-property-name' }, propName),
          h('div', { 
            class: 'property-tags',
            style: {
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              alignItems: 'center'
            }
          }, tags)
        ])
        
        const content = [header]
        
        if (property.type === 'object' && property.properties) {
          content.push(h(PropertyTree, {
            properties: property.properties,
            required: property.required || [],
            level: props.level + 1
          }))
        }
        
        const itemStyle = { 
          marginLeft: props.level > 0 ? '10px' : `${props.level * 20}px`,
          paddingLeft: '8px',
          paddingRight: '8px',
          paddingTop: '8px',
          paddingBottom: '8px'
        }
        
        items.push(h('div', { 
          class: 'nested-property-item',
          style: itemStyle
        }, content))
      })
      
      return h('div', { class: 'nested-properties-list' }, items)
    }
  }
})
</script>

<template>
  <bf-stage v-if="!minimal" class="template-spec-viewer" :class="{ minimal: minimal }" no-padding>
    <template #actions>
      <stage-actions v-if="!hideActions">
        <template #right>
          <div class="action-buttons">
            <bf-button @click="handleEditTemplate" size="small">
              Edit Template
            </bf-button>
            <bf-button @click="handleCreateModel" type="primary" size="small">
              Create Model from Template
            </bf-button>
          </div>
        </template>
      </stage-actions>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner">Loading template...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-message">
        <h3>Failed to load template</h3>
        <p>{{ error }}</p>
        <bf-button @click="fetchTemplateData">Retry</bf-button>
      </div>
    </div>

    <!-- Template Content -->
    <div v-else-if="effectiveTemplateData" >
      <!-- Template Information Header -->

      <div v-if="effectiveTemplateData" class="template-info-header">

        <span class="template-name">{{ effectiveTemplateData.display_name || effectiveTemplateData.name }}</span>
        <span class="template-type-indicator">
          <el-tag type="warning" size="small" effect="plain" class="template-badge">
            📋 Template
          </el-tag>
        </span>
        <el-tag type="info" size="small" effect="plain">
          {{ Object.keys(effectiveTemplateData.latest_version.schema.properties).length }} properties
        </el-tag>
      </div>

      <div class="template-content">
        <!-- Template Metadata (non-minimal mode) -->
        <div v-if="!minimal" class="template-metadata">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="Name">
              {{ effectiveTemplateData.name }}
            </el-descriptions-item>
            <el-descriptions-item label="Display Name">
              {{ effectiveTemplateData.display_name }}
            </el-descriptions-item>
            <el-descriptions-item label="Description">
              {{ effectiveTemplateData.description || 'No description' }}
            </el-descriptions-item>
            <el-descriptions-item label="Template ID">
              <div class="editable-field">
                <span style="font-family: Monaco, monospace; font-size: 12px;">{{ effectiveTemplateData?.id || 'NO ID FOUND' }}</span>
                <el-button
                  v-if="effectiveTemplateData?.id"
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
              v{{ effectiveTemplateData.latest_version?.version || 1 }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- Properties Header with View Mode Tabs (shared between both views) -->
        <div class="properties-header">
          <h4 class="properties-title">{{ viewMode === 'json' ? 'JSON Schema' : 'Properties' }}</h4>
          <div v-if="!hideSelector && !minimal" class="view-controls">
            <ViewToggle v-model:viewMode="internalViewMode" :minimal="minimal" />
          </div>
        </div>

        <div v-if="viewMode === 'json'" class="json-view">
          <!-- JSON Schema display -->
          <el-card>
            <pre class="json-content">{{ JSON.stringify(templateSchema, null, 2) }}</pre>
          </el-card>
        </div>

        <div v-else class="ui-view">
          <!-- Properties list -->
          <div class="properties-list">
            <div
              v-for="(property, propName) in templateProperties"
              :key="propName"
              class="property-item"
              :class="{ 'is-nested': isNestedObject(property) }"
            >
              <div class="property-header">
                <span class="property-name">{{ propName }}</span>
                <div class="property-tags">
                  <el-tag
                    v-if="isRequired(propName)"
                    type=""
                    size="small"
                    effect="plain"
                    class="tag-required"
                  >
                    Required
                  </el-tag>
                  <el-tag
                    type=""
                    size="small"
                    effect="plain"
                    class="tag-type"
                  >
                    {{ formatPropertyType(property) }}
                  </el-tag>
                </div>
              </div>

              <!-- Property details -->
              <div v-if="property.description || getConstraintInfo(property).length > 0 || getDefaultOrExample(property)"
                   class="property-details">
                <div v-if="property.description" class="property-description">
                  {{ property.description }}
                </div>
                <div v-if="getConstraintInfo(property).length > 0" class="property-constraints">
                  <span class="constraint-label">Constraints:</span>
                  <span class="constraint-value">{{ getConstraintInfo(property).join(', ') }}</span>
                </div>
                <div v-if="getDefaultOrExample(property)" class="property-default">
                  <span class="default-label">{{ getDefaultOrExample(property).type === 'default' ? 'Default' : 'Example' }}:</span>
                  <code class="default-value">{{ formatValue(getDefaultOrExample(property).value) }}</code>
                </div>
              </div>

              <!-- Nested properties -->
              <div v-if="isNestedObject(property)" class="nested-properties">
                <PropertyTree
                  :properties="property.properties"
                  :required="property.required || []"
                  :level="1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  </bf-stage>

  <!-- Minimal mode version without BfStage wrapper -->
  <div v-else class="template-spec-viewer minimal">
    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner">Loading template...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-message">
        <h3>Failed to load template</h3>
        <p>{{ error }}</p>
        <bf-button @click="fetchTemplateData">Retry</bf-button>
      </div>
    </div>

    <!-- Template Content -->
    <div v-else-if="effectiveTemplateData" class="template-content">
      <!-- Template Attributes (shown in minimal mode for preview) -->
      <div v-if="minimal" class="template-attributes">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="Display Name">
            {{ effectiveTemplateData.display_name || effectiveTemplateData.name }}
          </el-descriptions-item>
          <el-descriptions-item label="Description">
            {{ effectiveTemplateData.description || 'No description' }}
          </el-descriptions-item>
          <el-descriptions-item label="Template ID">
            <div class="editable-field">
              <span style="font-family: Monaco, monospace; font-size: 12px;">{{ effectiveTemplateData?.id || 'NO ID FOUND' }}</span>
              <el-button 
                v-if="effectiveTemplateData?.id"
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
            v{{ (effectiveTemplateData.latest_version?.version || 1) + 1 }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      
      <!-- Template Information Header (hidden in minimal mode) -->
      <div v-if="!minimal" class="template-info-header">
        <div class="template-title-section">
          <h1 class="template-name">{{ effectiveTemplateData.display_name || effectiveTemplateData.name }}</h1>
          <p v-if="effectiveTemplateData.description" class="template-description">{{ effectiveTemplateData.description }}</p>
        </div>
        <el-tag type="info" size="large" effect="plain">
          {{ propertyCount }} properties
        </el-tag>
      </div>


      <div v-if="viewMode === 'json'" class="json-view">
        <!-- Properties Header with View Mode Toggle -->
        <div class="properties-header">
          <h4 class="properties-title">JSON Schema</h4>
          <div v-if="!hideSelector && !minimal" class="view-controls">
            <ViewToggle v-model:viewMode="internalViewMode" :minimal="minimal" />
          </div>
        </div>
        
        <!-- JSON Schema display -->
        <el-card>
          <pre class="json-content">{{ JSON.stringify(templateSchema, null, 2) }}</pre>
        </el-card>
      </div>

      <div v-else class="ui-view">
        <!-- Properties Header with View Mode Toggle -->
        <div class="properties-header">
          <h4 class="properties-title">Properties</h4>
          <div v-if="!hideSelector && !minimal" class="view-controls">
            <ViewToggle v-model:viewMode="internalViewMode" :minimal="minimal" />
          </div>
        </div>
        
        <!-- Properties list -->
        <div class="properties-list">
          <div 
            v-for="(property, propName) in templateProperties"
            :key="propName"
            class="property-item"
            :class="{ 'is-nested': isNestedObject(property) }"
          >
            <div class="property-header">
              <span class="property-name">{{ propName }}</span>
              <div class="property-tags">
                <el-tag 
                  v-if="isRequired(propName)"
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-required"
                >
                  Required
                </el-tag>
                <el-tag 
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-type"
                >
                  {{ formatPropertyType(property) }}
                </el-tag>
              </div>
            </div>
            
            <!-- Property details -->
            <div v-if="property.description || getConstraintInfo(property).length > 0 || getDefaultOrExample(property)" 
                 class="property-details">
              <div v-if="property.description" class="property-description">
                {{ property.description }}
              </div>
              <div v-if="getConstraintInfo(property).length > 0" class="property-constraints">
                <span class="constraint-label">Constraints:</span>
                <span class="constraint-value">{{ getConstraintInfo(property).join(', ') }}</span>
              </div>
              <div v-if="getDefaultOrExample(property)" class="property-default">
                <span class="default-label">{{ getDefaultOrExample(property).type === 'default' ? 'Default' : 'Example' }}:</span>
                <code class="default-value">{{ formatValue(getDefaultOrExample(property).value) }}</code>
              </div>
            </div>
            
            <!-- Nested properties -->
            <div v-if="isNestedObject(property)" class="nested-properties">
              <PropertyTree 
                :properties="property.properties" 
                :required="property.required || []"
                :level="1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/tag';

.template-spec-viewer {
  padding: 16px;
  
  &.minimal {
    padding: 0;
    
    .template-content {
      padding: 0;
    }
    
    .view-mode-tabs {
      &.minimal {
        .view-mode-tab {
          padding: 6px 8px;
          
          .tab-label {
            display: none;
          }
        }
      }
    }
  }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  
  .loading-spinner {
    font-size: 18px;
    color: theme.$gray_5;
  }
}

.error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  
  .error-message {
    text-align: center;
    
    h3 {
      color: theme.$red_1;
      margin-bottom: 8px;
    }
    
    p {
      color: theme.$gray_5;
      margin-bottom: 16px;
    }
  }
}

.template-content {
  padding: 16px;
}

.template-attributes {
  margin-bottom: 24px;
  
  :deep(.el-descriptions) {
    .el-descriptions__label {
      font-weight: 500;
      color: theme.$gray_6;
      width: 120px;
    }
    
    .el-descriptions__content {
      color: theme.$gray_6;
    }
  }
  
  .editable-field {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .edit-btn {
      padding: 4px;
      margin: 0;
      border: none;
      background: transparent;
      color: theme.$gray_4;
      
      &:hover {
        color: theme.$purple_2;
        background-color: theme.$gray_1;
      }
      
      &:focus {
        background-color: theme.$gray_1;
        color: theme.$purple_2;
      }
    }
  }
}

.template-info-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0 8px 0;
  margin: 0 16px;
  border-bottom: 1px solid theme.$gray_2;

  .template-name {
    font-weight: 500;
    font-size: 18px;
    color: theme.$gray_6;
  }

  .template-badge {
    background-color: rgba(255, 193, 7, 0.1) !important;
    border-color: rgba(255, 193, 7, 0.3) !important;
    color: #b8860b !important;
    font-weight: 500;
    font-size: 12px;
  }

}

.template-metadata {
  margin-bottom: 24px;
  
  :deep(.el-descriptions) {
    .el-descriptions__label {
      font-weight: 500;
      color: theme.$gray_6;
      width: 120px;
    }
    
    .el-descriptions__content {
      color: theme.$gray_6;
      min-height: 18px;
      display: flex;
      align-items: center;
    }
  }
  
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

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 16px 0;
  
  .properties-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: theme.$gray_6;
  }
}

.view-mode-tabs {
  display: flex;
  background-color: theme.$gray_1;
  padding: 4px;
  gap: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  
  .view-mode-tab {
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

.json-view {
  .json-content {
    background-color: #f5f7fa;
    padding: 16px;
    border-radius: 4px;
    overflow-x: auto;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
  }
}

.ui-view {
  .properties-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .property-item {
    padding: 12px;
    background-color: theme.$gray_1;
    border-left: 2px solid theme.$purple_2;

    &.is-nested {
      background-color: theme.$gray_1;
    }

    .property-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;

      .property-name {
        font-weight: 500;
        color: theme.$gray_6;
        font-size: 14px;
      }

      .property-tags {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        
        :deep(.tag-required) {
          background-color: theme.$red_tint;
          border-color: theme.$red_1;
          color: theme.$red_2;
        }
        
        :deep(.tag-type) {
          background-color: theme.$gray_1;
          border-color: theme.$gray_3;
          color: theme.$gray_5;
        }
      }
    }
    
    .property-details {
      margin-top: 12px;
      padding: 12px;
      background-color: rgba(255, 255, 255, 0.75);
      border-radius: 4px;
      font-size: 14px;
      
      .property-description {
        color: theme.$gray_5;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      
      .property-constraints {
        margin-bottom: 6px;
        
        .constraint-label {
          font-weight: 500;
          color: theme.$gray_5;
          margin-right: 8px;
        }
        
        .constraint-value {
          color: theme.$gray_6;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 12px;
        }
      }
      
      .property-default {
        .default-label {
          font-weight: 500;
          color: theme.$gray_5;
          margin-right: 8px;
        }
        
        .default-value {
          background-color: theme.$gray_1;
          padding: 4px 8px;
          border-radius: 3px;
          color: theme.$purple_2;
          font-size: 12px;
        }
      }
    }
    
    .nested-properties {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      
      .nested-properties-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      :deep(.nested-property-item) {
        background-color: rgba(255,255,255,0.75);
        border-left: 1px solid theme.$purple_1;
        border-radius: 3px;
        
        .nested-property-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          
          .nested-property-name {
            font-weight: 500;
            color: theme.$gray_5;
            font-size: 14px;
          }
        }
      }
    }
  }
}

.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>