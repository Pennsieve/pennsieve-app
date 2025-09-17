<script setup>
import { ref, computed, defineComponent, h, onMounted, watch } from 'vue'
import { ElRadioGroup, ElRadioButton, ElCard, ElCollapse, ElCollapseItem, ElTag, ElDescriptions, ElDescriptionsItem, ElTooltip, ElSelect, ElOption } from 'element-plus'
import { useMetadataStore } from '@/stores/metadataStore.js'
import { useRouter } from 'vue-router'
import BfButton from "@/components/shared/bf-button/BfButton.vue";

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

// Default schema template
const defaultSchema = {
  "type": "object",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "properties": {}
}

// Test data with diverse data types and three levels of nesting
const testModel = {
  "id": "085a6d55-2681-4a2d-9206-4d656c1accf9",
  "name": "drug",
  "display_name": "Clinical Drug",
  "description": "Comprehensive drug information model with diverse data types",
  "created_at": "2025-07-18T16:01:08.852253Z",
  "latest_version": {
    "version": 1,
    "schema": {
      "type": "object",
      "title": "drug",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "required": [
        "drug_id",
        "name",
        "is_approved",
        "approval_date"
      ],
      "properties": {
        "drug_id": {
          "type": "integer",
          "x-pennsieve-key": true,
          "description": "Unique identifier"
        },
        "name": {
          "type": "string",
          "x-pennsieve-key": true,
          "description": "Drug commercial name",
          "minLength": 3,
          "maxLength": 100
        },
        "is_approved": {
          "type": "boolean",
          "description": "FDA approval status"
        },
        "approval_date": {
          "type": "string",
          "format": "date",
          "description": "Date of FDA approval (YYYY-MM-DD)"
        },
        "expiration_datetime": {
          "type": "string",
          "format": "date-time",
          "description": "Expiration timestamp (ISO 8601)"
        },
        "daily_dose_time": {
          "type": "string",
          "format": "time",
          "description": "Recommended administration time (HH:MM:SS)",
          "default": "08:00:00"
        },
        "price": {
          "type": "number",
          "description": "Retail price in USD",
          "minimum": 0,
          "multipleOf": 0.01,
          "x-pennsieve-sensitive": true
        },
        "concentration_mg": {
          "type": "integer",
          "description": "Active ingredient concentration in milligrams",
          "minimum": 0,
          "maximum": 10000
        },
        "ph_level": {
          "type": "number",
          "description": "Solution pH level",
          "minimum": 0,
          "maximum": 14
        },
        "clinical_data": {
          "type": "object",
          "required": ["trial_phase", "efficacy_rate"],
          "properties": {
            "trial_phase": {
              "type": "integer",
              "minimum": 1,
              "maximum": 4,
              "description": "Clinical trial phase (1-4)"
            },
            "efficacy_rate": {
              "type": "number",
              "minimum": 0,
              "maximum": 100,
              "description": "Efficacy percentage"
            },
            "trial_start_date": {
              "type": "string",
              "format": "date",
              "description": "Trial start date"
            },
            "trial_duration_days": {
              "type": "integer",
              "description": "Duration of trial in days"
            },
            "double_blind": {
              "type": "boolean",
              "description": "Was trial double-blind"
            },
            "participants": {
              "type": "object",
              "properties": {
                "total_enrolled": {
                  "type": "integer",
                  "minimum": 0
                },
                "completed": {
                  "type": "integer",
                  "minimum": 0
                },
                "dropout_rate": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 100,
                  "description": "Percentage who dropped out"
                },
                "demographics": {
                  "type": "object",
                  "properties": {
                    "average_age": {
                      "type": "number",
                      "description": "Mean age of participants"
                    },
                    "age_range": {
                      "type": "object",
                      "properties": {
                        "min": { 
                          "type": "integer", 
                          "minimum": 0,
                          "maximum": 100,
                          "description": "Minimum age of participants",
                          "default": 18
                        },
                        "max": { 
                          "type": "integer", 
                          "minimum": 18,
                          "maximum": 120,
                          "description": "Maximum age of participants",
                          "default": 65
                        }
                      }
                    },
                    "male_percentage": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 100,
                      "description": "Percentage of male participants",
                      "multipleOf": 0.1,
                      "examples": [45.5, 52.3]
                    },
                    "female_percentage": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 100,
                      "description": "Percentage of female participants",
                      "multipleOf": 0.1,
                      "examples": [54.5, 47.7]
                    },
                    "diverse_population": {
                      "type": "boolean",
                      "description": "Whether the study included diverse ethnic populations",
                      "default": true
                    }
                  }
                }
              }
            },
            "adverse_events": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "event_name": { 
                    "type": "string",
                    "pattern": "^[A-Za-z\\s]+$"
                  },
                  "severity": { 
                    "type": "integer",
                    "enum": [1, 2, 3, 4, 5],
                    "description": "Severity scale: 1=Mild, 2=Moderate, 3=Severe, 4=Life-threatening, 5=Death"
                  },
                  "frequency_percent": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100
                  },
                  "reported_date": {
                    "type": "string",
                    "format": "date"
                  },
                  "resolved": {
                    "type": "boolean"
                  },
                  "medication_ref": {
                    "type": "string",
                    "$ref": "#/definitions/medication",
                    "$comment": "Reference to medication that caused the event"
                  }
                }
              }
            }
          }
        },
        "manufacturing": {
          "type": "object",
          "properties": {
            "batch_number": {
              "type": "string",
              "pattern": "^[A-Z]{3}[0-9]{6}$",
              "description": "Format: XXX000000",
              "examples": ["ABC123456", "XYZ789012"]
            },
            "production_date": {
              "type": "string",
              "format": "date"
            },
            "production_time": {
              "type": "string",
              "format": "time",
              "description": "Start time of production run"
            },
            "temperature_celsius": {
              "type": "number",
              "description": "Storage temperature",
              "minimum": -80,
              "maximum": 40
            },
            "humidity_percent": {
              "type": "number",
              "minimum": 0,
              "maximum": 100
            },
            "sterile": {
              "type": "boolean",
              "default": true
            },
            "quality_checks": {
              "type": "object",
              "properties": {
                "passed_all": {
                  "type": "boolean"
                },
                "check_date": {
                  "type": "string",
                  "format": "date"
                },
                "inspector_id": {
                  "type": "integer",
                  "readOnly": true,
                  "description": "System-assigned inspector ID",
                  "x-pennsieve-sensitive": true
                },
                "measurements": {
                  "type": "object",
                  "properties": {
                    "weight_grams": {
                      "type": "number",
                      "multipleOf": 0.001,
                      "minimum": 0.001,
                      "maximum": 1000,
                      "description": "Product weight in grams",
                      "examples": [125.5, 250.0]
                    },
                    "volume_ml": {
                      "type": "number",
                      "multipleOf": 0.1,
                      "minimum": 0.1,
                      "maximum": 5000,
                      "description": "Product volume in milliliters",
                      "default": 100.0
                    },
                    "purity_percent": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 100,
                      "multipleOf": 0.01
                    }
                  }
                }
              }
            }
          }
        },
        "availability": {
          "type": "object",
          "properties": {
            "in_stock": {
              "type": "boolean"
            },
            "quantity": {
              "type": "integer",
              "minimum": 0
            },
            "reorder_point": {
              "type": "integer",
              "minimum": 0
            },
            "last_restocked": {
              "type": "string",
              "format": "date-time"
            },
            "discontinued": {
              "type": "boolean",
              "default": false,
              "deprecated": true,
              "description": "Use availability_status instead"
            },
            "available_countries": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": ["US", "CA", "UK", "EU", "JP", "AU"]
              },
              "minItems": 1,
              "uniqueItems": true,
              "default": ["US"]
            }
          }
        },
        "notes": {
          "type": ["string", "null"],
          "description": "Additional notes"
        },
        "api_config": {
          "type": "object",
          "description": "API configuration with advanced features",
          "additionalProperties": true,
          "minProperties": 2,
          "maxProperties": 10,
          "properties": {
            "endpoint": {
              "type": "string",
              "format": "uri",
              "const": "https://api.example.com/v1"
            },
            "auth_token": {
              "type": "string",
              "writeOnly": true,
              "contentMediaType": "application/jwt",
              "contentEncoding": "base64"
            }
          }
        }
      }
    },
    "created_at": "2025-07-18T16:01:08.852253Z",
    "model_template_id": null,
    "model_template_version": null
  }
}

// The model and version management
const model = ref()
const selectedVersion = ref('latest')
const availableVersions = ref([])
const currentVersionData = ref(null)
const loadingVersion = ref(false)

// Create a minimal empty model for new model creation
const emptyModel = {
  "id": "",
  "name": "",
  "display_name": "",
  "description": "",
  "created_at": new Date().toISOString(),
  "latest_version": {
    "version": 1,
    "schema": {
      "type": "object",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": {}
    },
    "created_at": new Date().toISOString(),
    "model_template_id": null,
    "model_template_version": null
  }
}

// Use test model if no model prop provided, with version handling
const modelData = computed(() => {
  // If a model prop is provided (from ModelSpecGenerator), use that
  if (props.model) {
    return {
      ...props.model,
      // Ensure latest_version structure is correct
      latest_version: props.model.latest_version || {
        version: 1,
        schema: props.model.schema || { ...defaultSchema }
      }
    }
  }
  
  // If no modelId is provided, we're creating a new model
  if (!props.modelId) {
    return {
      ...emptyModel,
      name: props.previewName || '',
      display_name: props.previewDisplayName || '',
      description: props.previewDescription || ''
    }
  }
  
  // If we have a specific version loaded, use that
  if (currentVersionData.value && selectedVersion.value !== 'latest') {
    return {
      ...model.value,
      latest_version: currentVersionData.value
    }
  }
  // Otherwise use the model's latest version
  return model.value || testModel
})

// For new models, show only the schema in JSON view
const displaySchema = computed(() => {
  // If we have a shared model prop (from ModelSpecGenerator), use its schema
  if (props.model) {
    return props.model.schema || {
      "type": "object",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": {}
    }
  }
  
  if (!props.modelId) {
    // For new models, only show the minimal schema
    return {
      "type": "object",
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "properties": {}
    }
  }
  
  // For existing models, show the full schema
  return modelData.value.latest_version.schema
})

// Fetch available versions for the model
const fetchVersions = async () => {
  if (!props.modelId || !props.datasetId) return
  
  try {
    // Fetch versions from API
    const versions = await metadataStore.fetchModelVersions(props.datasetId, props.modelId)
    
    const versionOptions = []
    
    // Add latest option first
    const latestVersionNum = model.value?.latest_version?.version || 1
    versionOptions.push({
      value: 'latest',
      label: `Latest (v${latestVersionNum})`
    })
    
    // Add individual version options from API response
    if (versions && versions.length > 0) {
      versions.forEach(version => {
        versionOptions.push({
          value: version.version.toString(),
          label: `Version ${version.version}`
        })
      })
    } else {
      // Fallback: create versions based on latest version number
      for (let i = latestVersionNum; i >= 1; i--) {
        versionOptions.push({
          value: i.toString(),
          label: `Version ${i}`
        })
      }
    }
    
    availableVersions.value = versionOptions
  } catch (error) {
    console.error('Error fetching model versions:', error)
    // Fallback to mock data on error
    const latestVersionNum = model.value?.latest_version?.version || 1
    const fallbackVersions = []
    
    fallbackVersions.push({
      value: 'latest',
      label: `Latest (v${latestVersionNum})`
    })
    
    for (let i = latestVersionNum; i >= 1; i--) {
      fallbackVersions.push({
        value: i.toString(),
        label: `Version ${i}`
      })
    }
    
    availableVersions.value = fallbackVersions
  }
}

// Fetch specific version data
const fetchVersion = async (versionNumber) => {
  if (!props.modelId || !props.datasetId || versionNumber === 'latest') {
    currentVersionData.value = null
    return
  }
  
  loadingVersion.value = true
  
  try {
    // TODO: Replace with actual API call to fetch specific version
    // Example: const response = await metadataStore.fetchModelVersion(props.datasetId, props.modelId, versionNumber)
    // For now, using mock data
    console.log(`Fetching version ${versionNumber} for model ${props.modelId}`)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Mock: return the same schema for now
    // In reality, this would be the specific version's schema
    currentVersionData.value = {
      ...model.value.latest_version,
      version: parseInt(versionNumber)
    }
  } catch (error) {
    console.error('Error fetching model version:', error)
    currentVersionData.value = null
  } finally {
    loadingVersion.value = false
  }
}

// Watch for version changes
watch(selectedVersion, async (newVersion) => {
  await fetchVersion(newVersion)
})

// Handle creating a new version
const createNewVersion = () => {
  if (!props.modelId || !props.datasetId) {
    console.warn('Cannot create new version: missing modelId or datasetId')
    return
  }
  
  // Navigate to the edit route for creating a new version
  router.push({
    name: 'model-edit',
    params: {
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  })
}

onMounted(async () => {
  if (!metadataStore.modelsLoaded) {
    await metadataStore.fetchModels(props.datasetId)
  }
  model.value = metadataStore.modelById(props.modelId)
  
  // Fetch available versions
  await fetchVersions()
})

const formatPropertyType = (property) => {
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

const getConstraintInfo = (property) => {
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

const isRequired = (modelSchema, propertyName) => {
  return modelSchema.required?.includes(propertyName) || false
}

const isKey = (property) => {
  return property['x-pennsieve-key'] === true
}

const isDeprecated = (property) => {
  return property.deprecated === true
}

const isReadOnly = (property) => {
  return property.readOnly === true
}

const isWriteOnly = (property) => {
  return property.writeOnly === true
}

const isSensitive = (property) => {
  return property['x-pennsieve-sensitive'] === true
}

const isNestedObject = (property) => {
  // Object with properties
  if (property.type === 'object' && property.properties) {
    return true
  }
  
  // Array with object items that have properties
  if (property.type === 'array' && property.items && property.items.type === 'object' && property.items.properties) {
    return true
  }
  
  return false
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

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

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
  <div class="model-spec-viewer" :class="{ minimal: minimal }">
    <div v-if="!hideSelector" class="top-controls">
      <div class="version-selector">
        <el-select 
          v-model="selectedVersion" 
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
        <bf-button @click="createNewVersion">
          Draft New Version
        </bf-button>
      </div>
    </div>

    <div v-if="viewMode === 'json'" class="json-view">
      <div class="model-content">
        <div class="model-header">
          <span class="model-name">{{ modelData.display_name || modelData.name }}</span>
          <el-tag type="info" size="small" effect="plain">
            {{ Object.keys(modelData.latest_version.schema.properties).length }} properties
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
            v{{ modelData.latest_version.version }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="properties-header">
          <h4 class="properties-title">JSON Schema</h4>
          <div v-if="!hideSelector" class="view-mode-tabs" :class="{ minimal: minimal }">
            <button 
              class="view-mode-tab" 
              :class="{ active: viewMode === 'ui', minimal: minimal }"
              @click="internalViewMode = 'ui'"
            >
              <span class="tab-icon">👁</span>
              <span v-if="!minimal" class="tab-label">Enhanced View</span>
            </button>
            <button 
              class="view-mode-tab" 
              :class="{ active: viewMode === 'json', minimal: minimal }"
              @click="internalViewMode = 'json'"
            >
              <span class="tab-icon">{ }</span>
              <span v-if="!minimal" class="tab-label">JSON View</span>
            </button>
          </div>
        </div>
        
        <el-card>
          <pre class="json-content">{{ JSON.stringify(displaySchema, null, 2) }}</pre>
        </el-card>
      </div>
    </div>

    <div v-else class="ui-view">
      <div class="model-content">
        <div class="model-header">
          <span class="model-name">{{ modelData.display_name || modelData.name }}</span>
          <el-tag type="info" size="small" effect="plain">
            {{ Object.keys(modelData.latest_version.schema.properties).length }} properties
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
            v{{ modelData.latest_version.version }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="properties-header">
          <h4 class="properties-title">Properties</h4>
          <div v-if="!hideSelector" class="view-mode-tabs" :class="{ minimal: minimal }">
            <button 
              class="view-mode-tab" 
              :class="{ active: viewMode === 'ui', minimal: minimal }"
              @click="internalViewMode = 'ui'"
            >
              <span class="tab-icon">👁</span>
              <span v-if="!minimal" class="tab-label">Enhanced View</span>
            </button>
            <button 
              class="view-mode-tab" 
              :class="{ active: viewMode === 'json', minimal: minimal }"
              @click="internalViewMode = 'json'"
            >
              <span class="tab-icon">{ }</span>
              <span v-if="!minimal" class="tab-label">JSON View</span>
            </button>
          </div>
        </div>
        
        <div class="properties-list">
          <div 
            v-for="(property, propName) in modelData.latest_version.schema.properties"
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
                  v-if="isRequired(modelData.latest_version.schema, propName)"
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
  </div>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/tag';
@use '../../../../styles/element/button';
@use '../../../../styles/element/select';



.model-spec-viewer {
  padding: 16px;
  
  &.minimal {
    padding: 0;
    
    .model-content {
      padding: 0;
    }
  }
}

.top-controls {
  margin-left: 8px;
  margin-bottom: 8px;
  
  .version-selector {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    
    .version-dropdown {
      width: 160px;
      height: 40px;
      
      :deep(.el-input__wrapper) {
        height: 40px;
        border-radius: 4px;
        border: 1px solid theme.$gray_2;
        background-color: theme.$white;
      }
      
      :deep(.el-input__inner) {
        height: 40px;
        line-height: 40px;
        font-size: 14px;
        color: theme.$gray_6;
      }
    }
    
    .create-version-btn {
      height: 40px;
      padding: 0 16px;
      background-color: theme.$purple_2;
      color: theme.$white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      
      &:hover {
        background-color: theme.$purple_3;
      }
      
      &:active {
        background-color: theme.$purple_3;
      }
    }
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

.json-view {
  .model-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 0;

    .model-name {
      font-weight: 500;
      font-size: 16px;
      color: theme.$gray_6;
    }
  }

  .model-content {
    padding: 16px;

    .properties-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 24px 0 16px 0;
      
      .properties-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: theme.$gray_6;
      }
    }
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

.ui-view {
  .no-models {
    text-align: center;
    padding: 48px;
    color: theme.$gray_4;
    font-size: 14px;
  }

  .model-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 0;

    .model-name {
      font-weight: 500;
      font-size: 16px;
      color: theme.$gray_6;
    }
  }

  .model-content {
    padding: 16px;

    .properties-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 24px 0 16px 0;
      
      .properties-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: theme.$gray_6;
      }
    }

    .properties-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
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

:deep(.el-collapse-item__header) {
  height: auto;
  min-height: 48px;
  line-height: normal;
  padding: 8px 0;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 0;
}

:deep(.el-descriptions__label) {
  font-weight: 500;
  width: 120px;
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