<script setup>
import { ref, computed, defineComponent, h, onMounted } from 'vue'
import { ElCard, ElTag, ElTooltip, ElMessage, ElSelect, ElOption, ElButtonGroup, ElButton } from 'element-plus'
import { useRouter } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'

// Import composables
import { useModelData } from '@/composables/useModelData.js'
import { useModelVersions } from '@/composables/useModelVersions.js'
import { usePropertyFormatting } from '@/composables/usePropertyFormatting.js'

// Import components
import ModelMetadata from './ModelMetadata.vue'
import SaveAsTemplateDialog from './SaveAsTemplateDialog.vue'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import PsButtonDropdown from '@/components/shared/ps-button-dropdown/PsButtonDropdown.vue'
import IconEyeball from '@/components/icons/IconEyeball.vue'
import ViewToggle from "@/components/shared/ViewToggle/ViewToggle.vue";

const props = defineProps({
  datasetId: {
    type: String,
    default: ''
  },
  orgId: {
    type: String,
    default: ''
  },
  modelId: {
    type: String,
    default: ''
  },
  templateId: {
    type: String,
    default: ''
  },
  model: {
    type: Object,
    default: null
  },
  minimal: {
    type: Boolean,
    default: false
  },
  viewMode: {
    type: String,
    default: null
  },
  hideSelector: {
    type: Boolean,
    default: false
  },
  // Props for updating preview when creating new models
  previewName: {
    type: String,
    default: ''
  },
  previewDisplayName: {
    type: String,
    default: ''
  },
  previewDescription: {
    type: String,
    default: ''
  }
})

const metadataStore = useMetadataStore()
const router = useRouter()

const internalViewMode = ref('ui')
const viewMode = computed(() => props.viewMode || internalViewMode.value)

// Dropdown state for action buttons
const quickActionsVisible = ref(true)

// The model and version management
const model = ref()
const templateData = ref()

// Computed to determine if we're viewing a template
const isTemplate = computed(() => !!props.templateId)

// Use composablesOKay
const {
  selectedVersion,
  availableVersions,
  currentVersionData,
  loadingVersion,
  fetchVersions,
  fetchVersion,
  createNewVersion
} = useModelVersions(props, model)

const {
  modelData,
  displaySchema
} = useModelData(props, model, currentVersionData, selectedVersion)

// Template data computed properties
const templateDataFormatted = computed(() => {
  if (!templateData.value) return null
  
  return {
    id: templateData.value.id,
    name: templateData.value.name,
    display_name: templateData.value.display_name,
    description: templateData.value.description,
    latest_version: templateData.value.latest_version
  }
})

// Combined data source - use template data if we're viewing a template
const effectiveModelData = computed(() => {
  if (isTemplate.value && templateDataFormatted.value) {
    return templateDataFormatted.value
  }
  return modelData.value
})

const {
  formatPropertyType,
  getConstraintInfo,
  getDefaultOrExample,
  formatValue,
  isRequired,
  isKey,
  isDeprecated,
  isReadOnly,
  isWriteOnly,
  isSensitive,
  isNestedObject,
  hasHiddenFeatures
} = usePropertyFormatting()

// Event handlers
const handleVersionChange = (version) => {
  selectedVersion.value = version
}

const handleViewModeChange = (mode) => {
  internalViewMode.value = mode
}

const handleMetadataUpdated = async () => {
  // Refresh model data after metadata update
  try {
    await metadataStore.fetchModels(props.datasetId)
    model.value = metadataStore.modelById(props.modelId)
  } catch (error) {
    console.error('Failed to refresh model data:', error)
  }
}

// Template creation dialog state
const showTemplateDialog = ref(false)

const handleSaveAsTemplate = () => {
  if (!modelData.value) {
    console.warn('No model data available to save as template')
    return
  }
  
  showTemplateDialog.value = true
}

const handleTemplateCreated = (createdTemplate) => {
  console.log('Template created successfully:', createdTemplate)
}

// Navigation functions
const goToRecords = () => {
  if (!props.modelId) {
    console.warn('No model ID available for navigation')
    return
  }
  
  router.push({
    name: 'model-records-search',
    params: {
      modelId: props.modelId
    }
  })
}

const goToCreateRecord = () => {
  if (!props.modelId) {
    console.warn('No model ID available for navigation')
    return
  }
  
  const routeParams = {
    name: 'create-record',
    params: {
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  }
  
  // Add version as query parameter if it's not 'latest'
  if (selectedVersion.value && selectedVersion.value !== 'latest') {
    routeParams.query = { version: selectedVersion.value }
  }
  
  router.push(routeParams)
}

// Dropdown toggle function
const toggleActionDropdown = () => {
  quickActionsVisible.value = !quickActionsVisible.value
}

// Template fetching function
const fetchTemplateData = async () => {
  try {
    const fetchedTemplates = await metadataStore.fetchTemplates(props.orgId)
    if (fetchedTemplates && Array.isArray(fetchedTemplates)) {
      const template = fetchedTemplates.find(t => 
        (t.model_template?.id || t.id) === props.templateId
      )
      
      if (template) {
        templateData.value = {
          id: template.model_template?.id || template.id,
          name: template.model_template?.name || template.name,
          display_name: template.model_template?.display_name || template.display_name,
          description: template.description || template.model_template?.description || '',
          latest_version: template.model_template?.latest_version || template.latest_version || {
            version: 1,
            schema: template.model_template?.latest_version?.schema || template.schema || {}
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch template data:', error)
  }
}

onMounted(async () => {
  if (isTemplate.value) {
    // If viewing a template, fetch template data
    await fetchTemplateData()
  } else {
    // If viewing a model, fetch model data
    if (!metadataStore.modelsLoaded) {
      await metadataStore.fetchModels(props.datasetId)
    }
    model.value = metadataStore.modelById(props.modelId)
    
    // Fetch available versions
    await fetchVersions()
    
    // If we have a selectedVersion that's not 'latest', fetch that version's data
    if (selectedVersion.value !== 'latest') {
      fetchVersion(selectedVersion.value)
    }
  }
})

// Recursive component for nested properties (kept from original)
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
      let baseType = ''
      
      if (property.type === 'object' && property.properties) {
        return 'object'
      }
      
      if (property.type === 'array' && property.items) {
        const itemType = property.items.type || 'any'
        return `array<${itemType}>`
      }
      
      if (Array.isArray(property.type)) {
        baseType = property.type.filter(t => t !== 'null').join(' | ')
      } else {
        baseType = property.type
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
          case 'uri-reference': return 'uri-ref'
          case 'iri': return 'iri'
          case 'iri-reference': return 'iri-ref'
          case 'uuid': return 'uuid'
          case 'ipv4': return 'ipv4'
          case 'ipv6': return 'ipv6'
          case 'hostname': return 'hostname'
          case 'json-pointer': return 'json-pointer'
          case 'relative-json-pointer': return 'rel-json-pointer'
          case 'regex': return 'regex'
          case 'binary': return 'binary'
          case 'byte': return 'base64'
          case 'password': return 'password'
          case 'uri-template': return 'uri-template'
          default: return `${baseType} (${property.format})`
        }
      }
      
      return baseType
    }
    
    const getNestedConstraints = (property) => {
      const constraints = []
      
      // Numeric constraints
      if (property.minimum !== undefined) {
        constraints.push(`min: ${property.minimum}`)
      }
      if (property.maximum !== undefined) {
        constraints.push(`max: ${property.maximum}`)
      }
      if (property.multipleOf !== undefined) {
        constraints.push(`step: ${property.multipleOf}`)
      }
      
      // String constraints
      if (property.minLength !== undefined) {
        constraints.push(`minLen: ${property.minLength}`)
      }
      if (property.maxLength !== undefined) {
        constraints.push(`maxLen: ${property.maxLength}`)
      }
      if (property.pattern) {
        constraints.push(`pattern: ${property.pattern}`)
      }
      
      // Array constraints
      if (property.minItems !== undefined) {
        constraints.push(`minItems: ${property.minItems}`)
      }
      if (property.maxItems !== undefined) {
        constraints.push(`maxItems: ${property.maxItems}`)
      }
      if (property.uniqueItems) {
        constraints.push('unique')
      }
      
      // Enum values
      if (property.enum) {
        constraints.push(`values: [${property.enum.join(', ')}]`)
      }
      
      return constraints
    }
    
    const getNestedDefaultOrExample = (property) => {
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
    
    const formatNestedValue = (value) => {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'boolean') return value ? 'true' : 'false'
      if (value === null) return 'null'
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)
    }
    
    const buildTooltipContent = (property) => {
      const parts = []
      
      // Description section
      if (property.description) {
        parts.push(`<strong>DESC:</strong> ${property.description}`)
      }
      
      // Constraints section
      const constraints = getNestedConstraints(property)
      if (constraints.length > 0) {
        parts.push(`<strong>COND:</strong>\n   ${constraints.join('\n   ')}`)
      }
      
      // Default/Example section
      const defaultOrExample = getNestedDefaultOrExample(property)
      if (defaultOrExample) {
        const label = defaultOrExample.type === 'default' ? 'DEFAULT' : 'EXAMPLE'
        parts.push(`<strong>${label}:</strong> ${formatNestedValue(defaultOrExample.value)}`)
      }
      
      return parts.join('\n\n')
    }
    
    const hasTooltipContent = (property) => {
      return property.description || 
             getNestedConstraints(property).length > 0 || 
             getNestedDefaultOrExample(property) !== null
    }
    
    const isNestedObj = (property) => {
      return property.type === 'object' && property.properties
    }
    
    const hasHiddenFeatures = (property) => {
      // Check for JSON Schema features that are not displayed in the UI
      const hiddenFeatures = []
      
      // Schema composition
      if (property.allOf) hiddenFeatures.push('allOf')
      if (property.anyOf) hiddenFeatures.push('anyOf')
      if (property.oneOf) hiddenFeatures.push('oneOf')
      if (property.not) hiddenFeatures.push('not')
      
      // Conditional schemas
      if (property.if) hiddenFeatures.push('if/then/else')
      
      // Advanced object features
      if (property.additionalProperties !== undefined) hiddenFeatures.push('additionalProperties')
      if (property.patternProperties) hiddenFeatures.push('patternProperties')
      if (property.propertyNames) hiddenFeatures.push('propertyNames')
      if (property.minProperties !== undefined) hiddenFeatures.push('minProperties')
      if (property.maxProperties !== undefined) hiddenFeatures.push('maxProperties')
      if (property.dependentRequired) hiddenFeatures.push('dependentRequired')
      if (property.dependentSchemas) hiddenFeatures.push('dependentSchemas')
      
      // Advanced array features
      if (property.prefixItems) hiddenFeatures.push('prefixItems')
      if (property.unevaluatedItems) hiddenFeatures.push('unevaluatedItems')
      if (property.contains) hiddenFeatures.push('contains')
      if (property.minContains !== undefined) hiddenFeatures.push('minContains')
      if (property.maxContains !== undefined) hiddenFeatures.push('maxContains')
      
      // Content encoding/media type
      if (property.contentMediaType) hiddenFeatures.push('contentMediaType')
      if (property.contentEncoding) hiddenFeatures.push('contentEncoding')
      
      // Schema metadata not shown
      if (property.$ref) hiddenFeatures.push('$ref')
      if (property.$comment) hiddenFeatures.push('$comment')
      if (property.title && property.title !== property.description) hiddenFeatures.push('title')
      
      // Const values (different from enum)
      if (property.const !== undefined) hiddenFeatures.push('const')
      
      return hiddenFeatures
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
        
        if (property['x-pennsieve-key']) {
          tags.push(h(ElTag, { 
            type: '', 
            size: 'small', 
            effect: 'plain',
            class: 'tag-key'
          }, () => 'Key'))
        }
        
        if (property['x-pennsieve-sensitive']) {
          tags.push(h(ElTag, { 
            type: '', 
            size: 'small', 
            effect: 'plain',
            class: 'tag-sensitive'
          }, () => 'Sensitive'))
        }
        
        if (property.deprecated) {
          tags.push(h(ElTag, { 
            type: '', 
            size: 'small', 
            effect: 'plain',
            class: 'tag-deprecated'
          }, () => 'Deprecated'))
        }
        
        if (property.readOnly) {
          tags.push(h(ElTag, { 
            type: '', 
            size: 'small', 
            effect: 'plain',
            class: 'tag-readonly'
          }, () => 'Read-only'))
        }
        
        tags.push(h(ElTag, { 
          type: '', 
          size: 'small', 
          effect: 'plain',
          class: 'tag-type'
        }, () => formatType(property)))
        
        // Add hidden features indicator if present
        const hiddenFeatures = hasHiddenFeatures(property)
        if (hiddenFeatures.length > 0) {
          const tooltipContent = `This property has advanced JSON Schema features not shown in Simple View:<br><strong>${hiddenFeatures.join(', ')}</strong><br>Switch to JSON View to see the complete specification.`
          tags.push(h(ElTooltip, {
            content: tooltipContent,
            placement: 'top',
            effect: 'light',
            'raw-content': true
          }, {
            default: () => h(ElTag, {
              type: '',
              size: 'small',
              effect: 'plain',
              class: 'tag-hidden-features'
            }, () => `+${hiddenFeatures.length}`)
          }))
        }
        
        const nameSpan = h('span', { 
          class: {
            'nested-property-name': true,
            'deprecated': property.deprecated
          }
        }, propName)
        
        const propertyNameElement = hasTooltipContent(property) ?
          h(ElTooltip, {
            content: buildTooltipContent(property),
            placement: 'top-start',
            effect: 'light',
            'raw-content': true,
            'popper-class': 'property-tooltip',
            'hide-after': 200,
            trigger: ['hover', 'click']
          }, {
            default: () => h('span', { class: { 'nested-property-name': true, 'tooltip-trigger': true, 'deprecated': property.deprecated } }, propName)
          }) :
          nameSpan

        const header = h('div', { class: 'nested-property-header' }, [
          propertyNameElement,
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
        
        if (isNestedObj(property)) {
          content.push(h(PropertyTree, {
            properties: property.properties,
            required: property.required || [],
            level: props.level + 1
          }))
        }
        
        // Handle array items with object properties
        if (property.type === 'array' && property.items && property.items.type === 'object' && property.items.properties) {
          content.push(h('div', { class: 'array-items-section', style: { marginTop: '8px' } }, [
            h('div', { class: 'array-items-header' }, [
              h('span', { class: 'array-items-title', style: { fontSize: '12px', fontWeight: 'normal', color: '#808fad' } }, 'Array Item Properties:')
            ]),
            h(PropertyTree, {
              properties: property.items.properties,
              required: property.items.required || [],
              level: props.level + 1
            })
          ]))
        }
        
        const itemStyle = { 
          marginLeft: props.level > 0 ? '10px' : `${props.level * 20}px`,
          marginRight: '0px',
          paddingLeft: '8px',
          paddingRight: '0px',
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
  <bf-stage class="model-spec-viewer" :class="{ minimal: minimal }" no-padding: true>
    <template #actions>
      <stage-actions>
        <template #left>
          <!-- Version selector -->
          <div v-if="!hideSelector" class="version-controls">
            <el-select 
              :model-value="selectedVersion"
              @update:model-value="handleVersionChange"
              placeholder="Select version"
              size="small"
              :loading="loadingVersion"
              class="version-dropdown"
            >
              <el-option
                v-for="version in availableVersions"
                :key="version.value"
                :label="version.label"
                :value="version.value"
              />
            </el-select>
          </div>
        </template>
        <template #right>
          <!-- Action buttons with dropdown -->
          <div v-if="!hideSelector && !isTemplate" class="action-buttons">
            <!-- Always visible View Records button -->

            
            <!-- Quick actions (shown when dropdown is closed) -->
            <template v-if="quickActionsVisible">
              <bf-button @click="goToRecords" size="small" class="mr-8">
                <template #prefix>
                  <IconEyeball class="mr-8" :height="16" :width="16" />
                </template>
                View Records
              </bf-button>
<!--              <bf-button @click="createNewVersion" size="small" class="mr-8">-->
<!--                Draft New Version-->
<!--              </bf-button>-->
<!--              <bf-button @click="handleSaveAsTemplate" type="secondary" size="small">-->
<!--                Save as Template-->
<!--              </bf-button>-->
            </template>
            
            <!-- Dropdown with all actions -->
            <ps-button-dropdown
              @click="toggleActionDropdown"
              :menu-open="!quickActionsVisible"
            >
              <template #buttons>
                <bf-button @click="goToRecords" class="dropdown-button">
                  <template #prefix>
                    <IconEyeball class="mr-8" :height="16" :width="16" />
                  </template>
                  View Records
                </bf-button>
                
                <bf-button @click="goToCreateRecord" class="dropdown-button">
                  Create Record
                </bf-button>
                
                <bf-button @click="createNewVersion" class="dropdown-button">
                  Draft New Version
                </bf-button>
                
                <bf-button @click="handleSaveAsTemplate" class="dropdown-button">
                  Save as Template
                </bf-button>
              </template>
            </ps-button-dropdown>
          </div>
        </template>
      </stage-actions>
    </template>

    <!-- Model Information Header outside stage-actions -->
    <div v-if="effectiveModelData" class="model-info-header">
      <span class="model-name">{{ effectiveModelData.display_name || effectiveModelData.name }}</span>
      <el-tag type="info" size="small" effect="plain">
        {{ Object.keys(effectiveModelData.latest_version.schema.properties).length }} properties
      </el-tag>
    </div>

    <div v-if="viewMode === 'json'" class="json-view">
      <div class="model-content">
        <!-- Model metadata -->
        <ModelMetadata
          :model-data="modelData"
          :dataset-id="datasetId"
          :model-id="modelId"
          :model="model"
          @metadata-updated="handleMetadataUpdated"
        />
        
        <!-- Properties Header with View Mode Tabs -->
        <div class="properties-header">
          <h4 class="properties-title">JSON Schema</h4>
          <div v-if="!hideSelector" class="view-controls">
            <ViewToggle
              :view-mode="viewMode"
              size='small'
              :minimal="minimal"
              @update:view-mode="handleViewModeChange"
            />
          </div>
        </div>
        
        <!-- JSON Schema display -->
        <el-card>
          <pre class="json-content">{{ JSON.stringify(displaySchema, null, 2) }}</pre>
        </el-card>
      </div>
    </div>

    <div v-else class="ui-view">
      <div class="model-content">
        <!-- Model metadata -->
        <ModelMetadata
          :model-data="modelData"
          :dataset-id="datasetId"
          :model-id="modelId"
          :model="model"
          @metadata-updated="handleMetadataUpdated"
        />
        
        <!-- Properties Header with View Mode Tabs -->
        <div class="properties-header">
          <h4 class="properties-title">Properties</h4>
          <div v-if="!hideSelector" class="view-controls">
            <ViewToggle 
              :view-mode="viewMode"
              size='small'
              :minimal="minimal"
              @update:view-mode="handleViewModeChange"
            />
          </div>
        </div>
        
        <!-- Properties list -->
        <div v-if="effectiveModelData" class="properties-list">
          <div 
            v-for="(property, propName) in effectiveModelData.latest_version.schema.properties"
            :key="propName"
            class="property-item"
            :class="{ 'is-nested': isNestedObject(property) }"
          >
            <div class="property-header">
              <span class="property-name" :class="{ 'deprecated': isDeprecated(property) }">
                {{ propName }}
              </span>
              <div class="property-tags">
                <el-tag 
                  v-if="isRequired(effectiveModelData.latest_version.schema, propName)"
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-required"
                >
                  Required
                </el-tag>
                <el-tag 
                  v-if="isKey(property)"
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-key"
                >
                  Key
                </el-tag>
                <el-tag 
                  v-if="isSensitive(property)"
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-sensitive"
                >
                  Sensitive
                </el-tag>
                <el-tag 
                  v-if="isDeprecated(property)"
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-deprecated"
                >
                  Deprecated
                </el-tag>
                <el-tag 
                  v-if="isReadOnly(property)"
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-readonly"
                >
                  Read-only
                </el-tag>
                <el-tag 
                  v-if="isWriteOnly(property)"
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-writeonly"
                >
                  Write-only
                </el-tag>
                <el-tag 
                  type="" 
                  size="small"
                  effect="plain"
                  class="tag-type"
                >
                  {{ formatPropertyType(property) }}
                </el-tag>
                <el-tooltip 
                  v-if="hasHiddenFeatures(property).length > 0"
                  effect="light"
                  placement="top"
                  raw-content
                  :content="`This property has advanced JSON Schema features not shown in Simple View:<br><strong>${hasHiddenFeatures(property).join(', ')}</strong><br>Switch to JSON View to see the complete specification.`"
                >
                  <el-tag 
                    type="" 
                    size="small"
                    effect="plain"
                    class="tag-hidden-features"
                  >
                    +{{ hasHiddenFeatures(property).length }}
                  </el-tag>
                </el-tooltip>
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
              <!-- Object properties -->
              <PropertyTree 
                v-if="property.type === 'object' && property.properties"
                :properties="property.properties" 
                :required="property.required || []"
                :level="1"
              />
              
              <!-- Array item properties -->
              <div v-if="property.type === 'array' && property.items && property.items.type === 'object' && property.items.properties" class="array-items-section">
                <div class="array-items-header">
                  <span class="array-items-title">Array Item Properties:</span>
                </div>
                <PropertyTree 
                  :properties="property.items.properties" 
                  :required="property.items.required || []"
                  :level="1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Save as Template Dialog -->
    <SaveAsTemplateDialog
      v-model:visible="showTemplateDialog"
      :model-data="modelData"
      :organization-id="orgId"
      @template-created="handleTemplateCreated"
    />
  </bf-stage>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/tag';
@use '../../../../styles/element/button';


.model-spec-viewer {
  padding: 16px;
  
  &.minimal {
    padding: 0;
    
    .model-content {
      padding: 0;
    }
  }
}

.json-view {
  .model-content {
    padding: 16px;
  }

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

// Properties header and view mode tabs (shared between json-view and ui-view)
.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 0 12px 0;
  
  .properties-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: theme.$gray_6;
  }

  .view-controls {
    // ViewToggle component handles its own styling
  }
}

.view-mode-tabs {
  display: flex;
  background-color: theme.$gray_1;
  padding: 4px;
  gap: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  
  &.minimal {
    padding: 2px;
    gap: 1px;
  }
  
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
    
    &.minimal {
      padding: 4px 8px;
      gap: 0;
      border-radius: 3px;
    }
    
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
      
      &.minimal {
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
      }
    }
  }
}

.ui-view {
  .no-models {
    text-align: center;
    padding: 48px;
    color: theme.$gray_4;
    font-size: 14px;
  }

  .model-content {
    padding: 16px;

    .properties-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
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
        gap: 8px;
        padding-right: 8px;

        .property-name {
          font-weight: 500;
          color: theme.$gray_6;
          font-size: 14px;
          
          &.deprecated {
            text-decoration: line-through;
            opacity: 0.7;
          }
        }

        .property-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          
          // Custom tag styles using app theme colors
          :deep(.tag-required) {
            background-color: theme.$red_tint;
            border-color: theme.$red_1;
            color: theme.$red_2;
          }
          
          :deep(.tag-key) {
            background-color: theme.$orange_tint;
            border-color: theme.$orange_1;
            color: theme.$orange_1;
          }
          
          :deep(.tag-sensitive) {
            background-color: theme.$yellow_tint;
            border-color: theme.$yellow_1;
            color: theme.$yellow_2;
          }
          
          :deep(.tag-deprecated) {
            background-color: theme.$gray_2;
            border-color: theme.$gray_4;
            color: theme.$gray_5;
          }
          
          :deep(.tag-readonly) {
            background-color: theme.$purple_tint;
            border-color: theme.$purple_1;
            color: theme.$purple_2;
          }
          
          :deep(.tag-writeonly) {
            background-color: theme.$purple_tint;
            border-color: theme.$purple_1;
            color: theme.$purple_2;
          }
          
          :deep(.tag-type) {
            background-color: theme.$gray_1;
            border-color: theme.$gray_3;
            color: theme.$gray_5;
          }
          
          :deep(.tag-hidden-features) {
            background-color: theme.$purple_tint;
            border-color: theme.$purple_1;
            color: theme.$purple_1;
            cursor: help;
          }
        }
      }
      
      .nested-properties {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e0e0e0;
        
        .nested-properties-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        :deep(.nested-property-item) {
          background-color: rgba(255,255,255,0.75);
          border-left: 1px solid theme.$purple_1;
          
          .nested-property-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
            padding-right: 8px;
            
            .nested-property-name {
              font-weight: 500;
              color: theme.$gray_5;
              font-size: 13px;
              
              &.deprecated {
                text-decoration: line-through;
                opacity: 0.7;
              }
              
              &.tooltip-trigger {
                cursor: help;
                padding: 2px 4px;
                margin: -2px -4px;
                border-radius: 3px;
                transition: background-color 0.2s ease;
                
                &:hover {
                  background-color: rgba(64, 158, 255, 0.06);
                }
              }
            }
            
            // Target the actual rendered property-tags div
            > .property-tags {
              display: flex !important;
              gap: 6px !important;
              flex-wrap: wrap !important;
              justify-content: flex-end !important;
              align-items: center !important;
              
              // Custom tag styles for nested properties
              .tag-required {
                background-color: theme.$red_tint !important;
                border-color: theme.$red_1 !important;
                color: theme.$red_2 !important;
              }
              
              .tag-key {
                background-color: theme.$orange_tint !important;
                border-color: theme.$orange_1 !important;
                color: theme.$orange_1 !important;
              }
              
              .tag-sensitive {
                background-color: theme.$yellow_tint !important;
                border-color: theme.$yellow_1 !important;
                color: theme.$yellow_2 !important;
              }
              
              .tag-deprecated {
                background-color: theme.$gray_2 !important;
                border-color: theme.$gray_4 !important;
                color: theme.$gray_5 !important;
              }
              
              .tag-readonly {
                background-color: theme.$purple_tint !important;
                border-color: theme.$purple_1 !important;
                color: theme.$purple_2 !important;
              }
              
              .tag-type {
                background-color: theme.$gray_1 !important;
                border-color: theme.$gray_3 !important;
                color: theme.$gray_5 !important;
              }
              
              .tag-hidden-features {
                background-color: theme.$purple_tint !important;
                border-color: theme.$purple_1 !important;
                color: theme.$purple_1 !important;
                cursor: help !important;
              }
            }
          }
        }
      }
      
      .property-details {
        margin-top: 8px;
        padding: 8px;
        background-color: rgba(255, 255, 255, 0.75);
        font-size: 13px;
        
        .property-description {
          color: theme.$gray_5;
          margin-bottom: 6px;
          line-height: 1.4;
        }
        
        .property-constraints {
          margin-bottom: 4px;
          
          .constraint-label {
            font-weight: 500;
            color: theme.$gray_5;
            margin-right: 6px;
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
            margin-right: 6px;
          }
          
          .default-value {
            background-color: theme.$gray_1;
            padding: 2px 6px;
            border-radius: 3px;
            color: theme.$purple_2;
            font-size: 12px;
          }
        }
      }
    }
  }
}

// Version controls styling
.version-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .version-dropdown {
    width: 160px;
    height: 32px;
    
    :deep(.el-input__wrapper) {
      height: 32px;
      border-radius: 4px;
      border: 1px solid theme.$gray_2;
      background-color: theme.$white;
    }
    
    :deep(.el-input__inner) {
      height: 32px;
      line-height: 32px;
      font-size: 14px;
      color: theme.$gray_6;
    }
  }
}

// Model info header styling (outside stage-actions)
.model-info-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0 8px 0;
  margin: 0 16px;
  border-bottom: 1px solid theme.$gray_2;
  
  .model-name {
    font-weight: 500;
    font-size: 18px;
    color: theme.$gray_6;
  }
}

// Action buttons styling
.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  
  .dropdown-button {
    margin-top: 8px;
  }
}

:deep(.el-collapse-item__header) {
  height: auto;
  min-height: 48px;
  line-height: normal;
  padding: 8px 0;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 0;
}

// Custom tooltip styling
:deep(.property-tooltip) {
  max-width: 320px;
  
  .el-tooltip__content {
    background-color: #ffffff;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 12px 16px;
    font-size: 13px;
    line-height: 1.5;
    color: theme.$gray_6;
    white-space: pre-line;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    
    // Bold labels for sections
    strong {
      font-weight: 600;
      color: theme.$gray_6;
    }
    
    // Constraint values should appear in monospace
    code, .constraint-values {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      background-color: rgba(0, 0, 0, 0.05);
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 12px;
    }
  }
  
  .el-tooltip__arrow {
    &:before {
      background-color: #ffffff;
      border: 1px solid #e4e7ed;
    }
  }
}

</style>