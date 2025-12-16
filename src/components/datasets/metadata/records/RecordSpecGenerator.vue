<script setup>
import { ref, computed, onMounted, watch, h } from 'vue'
import { ElCard, ElForm, ElFormItem, ElInput, ElInputNumber, ElSelect, ElOption, ElDatePicker, ElMessage, ElButton } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'
import { useMetadataStore } from '@/stores/metadataStore.js'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

// Import components
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import StageActions from '@/components/shared/StageActions/StageActions.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import ViewToggle from '@/components/shared/ViewToggle/ViewToggle.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'

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
    required: false
  }
})

const metadataStore = useMetadataStore()
const router = useRouter()
const route = useRoute()

// Reactive data
const model = ref(null)
const existingRecord = ref(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const viewMode = ref('ui') // 'ui' or 'json'
const formData = ref({})
const validationErrors = ref([])
const nullKeyFields = ref({}) // Track which nullable fields should be set to null
const jsonContent = ref('')
const jsonError = ref('')
const jsonEditor = ref(null)

// Form validation - configure AJV for JSON Schema Draft 2020-12
const ajv = new Ajv({ 
  allErrors: true,
  strict: false, // Allow unknown keywords like $schema
  validateSchema: false, // Skip schema validation to avoid draft issues
  loadSchema: false, // Don't try to load external schemas
  addUsedSchema: false, // Don't add schemas to internal storage
  missingRefs: 'ignore' // Ignore missing references instead of throwing errors
})

// Try to add formats, but don't fail if it doesn't work
try {
  if (typeof addFormats === 'function') {
    addFormats(ajv)
  }
} catch (error) {
  console.warn('Could not add AJV formats, proceeding without formats:', error)
}

// Computed properties
const isUpdateMode = computed(() => !!props.recordId)

const modelSchema = computed(() => {
  if (!model.value?.latest_version?.schema) return null
  return model.value.latest_version.schema
})

const schemaProperties = computed(() => {
  if (!modelSchema.value?.properties) return []
  
  const flattenProperties = (properties, parentKey = '', requiredFields = []) => {
    const flattened = []
    
    Object.entries(properties).forEach(([key, property]) => {
      const fullKey = parentKey ? `${parentKey}.${key}` : key
      // Check if required via schema or x-pennsieve-key
      const isRequired = requiredFields.includes(key) || (property && property['x-pennsieve-key'] === true)
      
      // Calculate level based on the full key (counting dots)
      const level = fullKey.split('.').length - 1
      
      // Handle union types (e.g., ["string", "null"])
      const actualType = Array.isArray(property.type) ? property.type[0] : property.type
      
      
      if (actualType === 'object' && property.properties) {
        // Add the object itself as a field
        flattened.push({
          key: fullKey,
          label: property.title || key,
          type: 'object',
          format: property.format,
          description: property.description,
          enum: property.enum,
          required: isRequired,
          property: property,
          isObjectHeader: true,
          level: level
        })
        
        // Recursively flatten nested properties
        const nestedFlattened = flattenProperties(
          property.properties, 
          fullKey, 
          property.required || []
        )
        flattened.push(...nestedFlattened)
      } else if (actualType === 'array' && property.items) {
        // Handle arrays - for now, we'll just show a JSON input
        flattened.push({
          key: fullKey,
          label: property.title || key,
          type: 'array',
          format: property.format,
          description: property.description,
          enum: property.enum,
          required: isRequired,
          property: property,
          level: level
        })
      } else {
        // Regular property
        flattened.push({
          key: fullKey,
          label: property.title || key,
          type: actualType,
          format: property.format,
          description: property.description,
          enum: property.enum,
          required: isRequired,
          property: property,
          level: level
        })
      }
    })
    
    return flattened
  }
  
  return flattenProperties(modelSchema.value.properties, '', modelSchema.value.required || [])
})

const recordJson = computed(() => {
  const cleanData = {}
  
  // Convert flat form data back to nested structure
  Object.entries(formData.value).forEach(([key, value]) => {
    // Check if this is a nullable field that should be explicitly set to null
    const shouldSetNull = nullKeyFields.value[key]
    
    // Include the field if:
    // 1. It's a nullable field explicitly set to null, OR
    // 2. It has a non-empty, non-unspecified value
    if (shouldSetNull || (value !== null && value !== undefined && value !== '' && value !== 'unspecified')) {
      // Handle nested keys like "clinical_data.participants.total_enrolled"
      const keyParts = key.split('.')
      let current = cleanData
      
      // Navigate/create nested structure
      for (let i = 0; i < keyParts.length - 1; i++) {
        const part = keyParts[i]
        if (!current[part]) {
          current[part] = {}
        }
        current = current[part]
      }
      
      // Set the final value
      const finalKey = keyParts[keyParts.length - 1]
      
      if (shouldSetNull) {
        current[finalKey] = null
      } else {
        // Find the property schema to determine type
        const property = schemaProperties.value.find(p => p.key === key)
        
        // Parse JSON strings for array and object types
        if (property && (property.type === 'array' || property.type === 'object')) {
          try {
            // Try to parse if it's a string
            if (typeof value === 'string' && value.trim()) {
              current[finalKey] = JSON.parse(value)
            } else {
              current[finalKey] = value
            }
          } catch (e) {
            // If parsing fails, keep as string (will be caught by validation)
            console.warn(`Failed to parse JSON for field ${key}:`, e)
            current[finalKey] = value
          }
        } else {
          current[finalKey] = value
        }
      }
    }
  })
  
  return cleanData
})

// Debug computed to check form state
const debugFormState = computed(() => {
  return {
    formDataKeys: Object.keys(formData.value),
    schemaPropertiesLength: schemaProperties.value.length,
    viewMode: viewMode.value,
    modelExists: !!model.value
  }
})

const isValidRecord = computed(() => {
  if (!modelSchema.value) {
    console.log('No model schema available')
    return false
  }
  
  try {
    console.log('Model schema:', modelSchema.value)
    console.log('Record JSON to validate:', recordJson.value)
    
    // Clean the schema to remove problematic references
    const cleanedSchema = cleanSchemaForValidation(modelSchema.value)
    console.log('Cleaned schema:', cleanedSchema)
    
    const validate = ajv.compile(cleanedSchema)
    const valid = validate(recordJson.value)
    
    console.log('Validation result:', valid)
    console.log('Validation errors:', validate.errors)
    
    if (!valid) {
      const errors = validate.errors || []
      validationErrors.value = errors
      console.log('Setting validation errors:', errors)
      return false
    }
    
    validationErrors.value = []
    return true
  } catch (err) {
    console.error('Validation compilation error:', err)
    console.error('Schema that failed to compile:', modelSchema.value)
    validationErrors.value = []
    return false
  }
})

// Methods
const fetchModel = async () => {
  loading.value = true
  error.value = ''
  
  try {
    await metadataStore.fetchModels(props.datasetId)
    model.value = metadataStore.modelById(props.modelId)
    
    if (!model.value) {
      throw new Error('Model not found')
    }
    
    // If a specific version is requested via query params, fetch that version
    const requestedVersion = route.query.version
    if (requestedVersion && requestedVersion !== 'latest') {
      try {
        const versionData = await metadataStore.fetchModelVersion(props.datasetId, props.modelId, requestedVersion)
        if (versionData) {
          // Update the model with the specific version data
          model.value = {
            ...model.value,
            latest_version: versionData
          }
        }
      } catch (versionError) {
        console.warn('Failed to fetch specific version, using latest:', versionError)
      }
    }
    
    // Initialize form data with default values
    initializeFormData()
  } catch (err) {
    console.error('Error fetching model:', err)
    error.value = err.message || 'Failed to load model'
  } finally {
    loading.value = false
  }
}

const fetchExistingRecord = async () => {
  if (!isUpdateMode.value || !props.recordId) return
  
  try {
    loading.value = true
    const response = await metadataStore.fetchRecord(props.datasetId, props.modelId, props.recordId)
    existingRecord.value = response
    
    // Populate form with existing record data
    if (response && response.value) {
      // First, set all boolean fields to 'unspecified' by default
      const initialData = {}
      schemaProperties.value.forEach(prop => {
        if (prop.type === 'boolean' && !prop.isObjectHeader) {
          initialData[prop.key] = 'unspecified'
        }
      })
      
      // Then overlay actual values from the record
      // Flatten nested object structure for form
      const flattenRecordData = (obj, prefix = '') => {
        const flattened = {}
        Object.entries(obj).forEach(([key, value]) => {
          const fullKey = prefix ? `${prefix}.${key}` : key
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(flattened, flattenRecordData(value, fullKey))
          } else {
            flattened[fullKey] = value
          }
        })
        return flattened
      }
      
      const flatData = flattenRecordData(response.value)
      formData.value = { ...initialData, ...flatData }
      
      // Initialize null fields tracking - check for any nullable fields that are explicitly null
      schemaProperties.value.forEach(prop => {
        // Check if field is nullable (type includes "null")
        const isNullable = prop.property && Array.isArray(prop.property.type) && prop.property.type.includes('null')
        if (isNullable && !prop.isObjectHeader) {
          // Check if this field is null in the actual record data
          if (flatData[prop.key] === null) {
            nullKeyFields.value[prop.key] = true
          }
        }
      })
    }
  } catch (err) {
    console.error('Error fetching existing record:', err)
    error.value = err.message || 'Failed to load existing record'
  } finally {
    loading.value = false
  }
}

const initializeFormData = () => {
  const data = {}
  
  if (schemaProperties.value) {
    schemaProperties.value.forEach(prop => {
      // Set default values based on property type
      switch (prop.type) {
        case 'string':
          data[prop.key] = ''
          break
        case 'number':
        case 'integer':
          data[prop.key] = null
          break
        case 'boolean':
          data[prop.key] = 'unspecified' // Default to unspecified for booleans
          break
        case 'array':
          data[prop.key] = []
          break
        case 'object':
          data[prop.key] = {}
          break
        default:
          data[prop.key] = null
      }
    })
  }
  
  // Only set defaults if not in update mode (existing data will be loaded separately)
  if (!isUpdateMode.value) {
    formData.value = data
  }
}

const handleCancel = () => {
  router.back()
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

const goBackToRecords = () => {
  router.push({
    name: 'model-records-search',
    params: {
      datasetId: props.datasetId,
      modelId: props.modelId
    }
  })
}

const handleSubmit = async () => {
  if (!isValidRecord.value) {
    ElMessage.error('Please fix validation errors before submitting')
    return
  }
  
  saving.value = true
  
  try {
    if (isUpdateMode.value) {
      await updateRecord()
      ElMessage.success('Record updated successfully')
      // Navigate back to records list since the record ID changes after update
      goBackToRecords()
    } else {
      await createRecord()
      ElMessage.success('Record created successfully')
      goBackToRecords()
    }
  } catch (err) {
    console.error(`Error ${isUpdateMode.value ? 'updating' : 'creating'} record:`, err)
    ElMessage.error(err.message || `Failed to ${isUpdateMode.value ? 'update' : 'create'} record`)
  } finally {
    saving.value = false
  }
}

const createRecord = async () => {
  try {
    const response = await metadataStore.createRecord(
      props.datasetId,
      props.modelId,
      recordJson.value,
      model.value?.latest_version?.version
    )
    
    return response
  } catch (err) {
    throw new Error(err.message || 'Failed to create record')
  }
}

const updateRecord = async () => {
  try {
    const response = await metadataStore.updateRecord(
      props.datasetId,
      props.modelId,
      props.recordId,
      recordJson.value
    )
    
    return response
  } catch (err) {
    throw new Error(err.message || 'Failed to update record')
  }
}

// Helper function for rendering just the form input
const renderFormFieldInput = (property) => {
  const { key, type, format, enum: enumValues } = property
  
  if (enumValues && enumValues.length > 0) {
    return h(ElSelect, {
      modelValue: formData.value[key],
      'onUpdate:modelValue': (value) => {
        formData.value[key] = value
        // If user selects a value, uncheck the null checkbox
        if (nullKeyFields.value[key]) {
          nullKeyFields.value[key] = false
        }
      },
      placeholder: `Select ${property.label}`,
      clearable: true,
      size: 'default'
    }, () => enumValues.map(option => 
      h(ElOption, { key: option, label: option, value: option })
    ))
  }
  
  switch (type) {
    case 'string':
      if (format === 'date') {
        return h(ElDatePicker, {
          modelValue: formData.value[key],
          'onUpdate:modelValue': (value) => formData.value[key] = value,
          type: 'date',
          placeholder: `Select ${property.label}`,
          format: 'YYYY-MM-DD',
          valueFormat: 'YYYY-MM-DD',
          size: 'default'
        })
      } else if (format === 'date-time') {
        return h(ElDatePicker, {
          modelValue: formData.value[key],
          'onUpdate:modelValue': (value) => formData.value[key] = value,
          type: 'datetime',
          placeholder: `Select ${property.label}`,
          format: 'YYYY-MM-DD HH:mm:ss',
          valueFormat: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
          size: 'default'
        })
      } else if (format === 'time') {
        return h(ElInput, {
          modelValue: formData.value[key],
          'onUpdate:modelValue': (value) => formData.value[key] = value,
          placeholder: 'HH:MM:SS',
          type: 'time',
          size: 'default'
        })
      } else {
        return h(ElInput, {
          modelValue: formData.value[key],
          'onUpdate:modelValue': (value) => {
            formData.value[key] = value
            // If user types something, uncheck the null checkbox
            if (value && nullKeyFields.value[key]) {
              nullKeyFields.value[key] = false
            }
          },
          placeholder: `Enter ${property.label}`,
          type: format === 'email' ? 'email' : 'text',
          size: 'default'
        })
      }
    
    case 'number':
    case 'integer':
      return h(ElInput, {
        modelValue: formData.value[key],
        'onUpdate:modelValue': (value) => {
          const numValue = type === 'integer' ? parseInt(value) : parseFloat(value)
          formData.value[key] = isNaN(numValue) ? null : numValue
          // If user types something, uncheck the null checkbox
          if (!isNaN(numValue) && nullKeyFields.value[key]) {
            nullKeyFields.value[key] = false
          }
        },
        placeholder: `Enter ${property.label}`,
        type: 'number',
        step: type === 'integer' ? '1' : '0.01',
        size: 'default'
      })
    
    case 'boolean':
      // Create tri-state boolean selector (true/false/unspecified)
      const booleanOptions = [
        { label: 'True', value: true },
        { label: 'False', value: false },
        { label: 'Unspecified', value: 'unspecified' }
      ]
      
      return h(ElSelect, {
        modelValue: formData.value[key],
        'onUpdate:modelValue': (value) => {
          formData.value[key] = value
          // If user selects a value, uncheck the null checkbox
          if (value !== 'unspecified' && nullKeyFields.value[key]) {
            nullKeyFields.value[key] = false
          }
        },
        placeholder: `Select ${property.label}`,
        clearable: false,
        size: 'default'
      }, () => booleanOptions.map(option => 
        h(ElOption, { 
          key: String(option.value), 
          label: option.label, 
          value: option.value 
        })
      ))
    
    case 'array':
      return h(ElInput, {
        modelValue: Array.isArray(formData.value[key]) ? JSON.stringify(formData.value[key], null, 2) : formData.value[key] || '',
        'onUpdate:modelValue': (value) => {
          formData.value[key] = value // Store as string, parse on validation/save
        },
        placeholder: 'Enter JSON array (e.g., ["item1", "item2"])',
        type: 'textarea',
        rows: 3,
        size: 'default'
      })
    
    default:
      return h(ElInput, {
        modelValue: formData.value[key],
        'onUpdate:modelValue': (value) => formData.value[key] = value,
        placeholder: `Enter ${property.label}`,
        type: 'textarea',
        rows: 3,
        size: 'default'
      })
  }
}

const renderFormField = (property) => {
  const { key, type, format, enum: enumValues } = property
  // Check if field is nullable (type includes "null")
  const isNullable = property.property && Array.isArray(property.property.type) && property.property.type.includes('null')
  const isNullSet = nullKeyFields.value[key]
  
  // If this is a nullable field, wrap the input with null checkbox
  if (isNullable) {
    return h('div', { class: 'key-field-wrapper' }, [
      h('div', { class: 'key-field-control' }, [
        h('label', { class: 'null-checkbox-label' }, [
          h('input', {
            type: 'checkbox',
            checked: isNullSet,
            onChange: (e) => {
              nullKeyFields.value[key] = e.target.checked
              if (e.target.checked) {
                // Clear the field value when setting to null
                formData.value[key] = type === 'boolean' ? 'unspecified' : 
                                     type === 'number' || type === 'integer' ? null :
                                     type === 'array' ? [] :
                                     type === 'object' ? {} : ''
              }
            },
            class: 'null-checkbox'
          }),
          h('span', { class: 'null-label' }, ' Set to null')
        ])
      ]),
      h('div', { 
        class: 'key-field-input',
        style: { opacity: isNullSet ? '0.5' : '1', pointerEvents: isNullSet ? 'none' : 'auto' }
      }, [renderFormFieldInput(property)])
    ])
  }
  
  return renderFormFieldInput(property)
}

// Create minimal JSON structure with only required properties
const createMinimalJsonStructure = () => {
  const minimalData = {}
  
  // Get all required properties
  const requiredProperties = schemaProperties.value.filter(prop => 
    prop.required && !prop.isObjectHeader
  )
  
  requiredProperties.forEach(prop => {
    const keyParts = prop.key.split('.')
    let current = minimalData
    
    // Navigate/create nested structure
    for (let i = 0; i < keyParts.length - 1; i++) {
      const part = keyParts[i]
      if (!current[part]) {
        current[part] = {}
      }
      current = current[part]
    }
    
    // Set empty default value based on property type
    const finalKey = keyParts[keyParts.length - 1]
    switch (prop.type) {
      case 'string':
        current[finalKey] = ''
        break
      case 'number':
      case 'integer':
        current[finalKey] = null
        break
      case 'boolean':
        current[finalKey] = null
        break
      case 'array':
        current[finalKey] = []
        break
      case 'object':
        current[finalKey] = {}
        break
      default:
        current[finalKey] = null
    }
  })
  
  return minimalData
}

// Update JSON content from form data
const updateJsonContent = () => {
  if (!isUpdateMode.value && Object.keys(recordJson.value).length === 0) {
    // For new records with no data, create minimal structure with required fields only
    const minimalStructure = createMinimalJsonStructure()
    jsonContent.value = JSON.stringify(minimalStructure, null, 2)
  } else {
    // For existing records or records with data, use the current recordJson
    jsonContent.value = JSON.stringify(recordJson.value, null, 2)
  }
  jsonError.value = ''
}

// Validate and parse JSON content 
const validateAndParseJson = () => {
  if (!jsonContent.value.trim()) {
    jsonError.value = 'JSON content cannot be empty'
    return false
  }

  try {
    const parsed = JSON.parse(jsonContent.value)
    
    // Basic validation - should be an object
    if (typeof parsed !== 'object' || parsed === null) {
      jsonError.value = 'Record data must be a valid JSON object'
      return false
    }

    // Update form data from parsed JSON
    updateFormDataFromJson(parsed)
    jsonError.value = ''
    return true
  } catch (e) {
    jsonError.value = `Invalid JSON: ${e.message}`
    return false
  }
}

// Update form data from JSON object
const updateFormDataFromJson = (jsonData) => {
  // Flatten the JSON data to match form structure
  const flattenJsonData = (obj, prefix = '') => {
    const flattened = {}
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, flattenJsonData(value, fullKey))
      } else {
        flattened[fullKey] = value
      }
    })
    return flattened
  }

  const flatData = flattenJsonData(jsonData)
  
  // Reset form data and null fields
  const newFormData = {}
  const newNullFields = {}
  
  // Initialize with default values for all schema properties
  schemaProperties.value.forEach(prop => {
    if (!prop.isObjectHeader) {
      // Set default values
      switch (prop.type) {
        case 'string':
          newFormData[prop.key] = ''
          break
        case 'number':
        case 'integer':
          newFormData[prop.key] = null
          break
        case 'boolean':
          newFormData[prop.key] = 'unspecified'
          break
        case 'array':
          newFormData[prop.key] = []
          break
        case 'object':
          newFormData[prop.key] = {}
          break
        default:
          newFormData[prop.key] = null
      }
    }
  })
  
  // Overlay values from JSON
  Object.entries(flatData).forEach(([key, value]) => {
    if (value === null) {
      // Handle null values
      const property = schemaProperties.value.find(p => p.key === key)
      const isNullable = property?.property && Array.isArray(property.property.type) && property.property.type.includes('null')
      
      if (isNullable) {
        newNullFields[key] = true
        // Set appropriate default value for the form
        newFormData[key] = property.type === 'boolean' ? 'unspecified' : 
                          property.type === 'number' || property.type === 'integer' ? null :
                          property.type === 'array' ? [] :
                          property.type === 'object' ? {} : ''
      }
    } else {
      newFormData[key] = value
    }
  })
  
  formData.value = newFormData
  nullKeyFields.value = newNullFields
}

// Handle JSON content changes
const onJsonContentChange = () => {
  validateAndParseJson()
}

// Handle TAB key in JSON editor
const onJsonEditorKeydown = (event) => {
  if (event.key === 'Tab') {
    event.preventDefault()
    
    const textarea = jsonEditor.value?.$refs?.textarea || jsonEditor.value?.textarea
    if (!textarea) return
    
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentValue = jsonContent.value
    
    // Insert 2 spaces at cursor position
    const newValue = currentValue.substring(0, start) + '  ' + currentValue.substring(end)
    
    jsonContent.value = newValue
    
    // Move cursor to after inserted spaces
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 2
    }, 0)
  }
}

// View mode handler
const handleViewModeChange = (mode) => {
  viewMode.value = mode
  if (mode === 'json') {
    // Update JSON content when switching to JSON mode
    updateJsonContent()
  }
}

// Handle clicking on invalid status tag
const handleInvalidTagClick = () => {
  if (!isValidRecord.value) {
    viewMode.value = 'json'
    // Scroll to validation issues after a short delay to ensure DOM is updated
    setTimeout(() => {
      const validationSection = document.querySelector('.validation-section')
      if (validationSection) {
        validationSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }
}


// Schema cleaning function to remove problematic references and handle x-pennsieve-key
const cleanSchemaForValidation = (schema) => {
  if (!schema || typeof schema !== 'object') return schema
  
  // Create a deep copy to avoid mutating the original
  const cleanedSchema = JSON.parse(JSON.stringify(schema))
  
  // Helper function to add x-pennsieve-key properties to required array
  const addPennsieveKeysToRequired = (obj, currentPath = '') => {
    if (!obj || typeof obj !== 'object') return obj
    
    if (Array.isArray(obj)) {
      return obj.map(item => addPennsieveKeysToRequired(item, currentPath))
    }
    
    const processed = { ...obj }
    
    // If this object has properties, check for x-pennsieve-key
    if (processed.properties && typeof processed.properties === 'object') {
      const requiredFields = new Set(processed.required || [])
      
      // Check each property for x-pennsieve-key
      Object.entries(processed.properties).forEach(([propKey, propValue]) => {
        if (propValue && typeof propValue === 'object' && propValue['x-pennsieve-key'] === true) {
          requiredFields.add(propKey)
        }
      })
      
      // Update the required array
      processed.required = Array.from(requiredFields)
      
      // Recursively process nested objects
      processed.properties = Object.fromEntries(
        Object.entries(processed.properties).map(([key, value]) => [
          key,
          addPennsieveKeysToRequired(value, currentPath ? `${currentPath}.${key}` : key)
        ])
      )
    }
    
    return processed
  }
  
  // Recursively remove $ref properties and other problematic features
  const removeRefs = (obj) => {
    if (!obj || typeof obj !== 'object') return obj
    
    if (Array.isArray(obj)) {
      return obj.map(removeRefs)
    }
    
    const cleaned = {}
    for (const [key, value] of Object.entries(obj)) {
      // Skip $ref properties as they cause issues with missing definitions
      if (key === '$ref') {
        continue
      }
      
      // Skip $defs and definitions as they might contain circular refs
      if (key === '$defs' || key === 'definitions') {
        continue
      }
      
      // Recursively clean nested objects
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = removeRefs(value)
      } else {
        cleaned[key] = value
      }
    }
    
    return cleaned
  }
  
  // First add x-pennsieve-key properties to required arrays
  const schemaWithPennsieveKeys = addPennsieveKeysToRequired(cleanedSchema)
  
  // Then remove problematic references
  return removeRefs(schemaWithPennsieveKeys)
}

// Validation helper functions
const getFieldPath = (error) => {
  if (error.instancePath) {
    return error.instancePath.replace(/^\//, '').replace(/\//g, '.')
  }
  if (error.schemaPath && error.schemaPath.includes('/properties/')) {
    const match = error.schemaPath.match(/\/properties\/([^\/]+)/)
    return match ? match[1] : 'Root'
  }
  return 'Root'
}

const getSuggestion = (error) => {
  const keyword = error.keyword
  const schemaPath = error.schemaPath || ''
  
  switch (keyword) {
    case 'required':
      return `This field is required. Please provide a value.`
    case 'type':
      return `Expected ${error.schema?.type} but got ${typeof error.data}. Please enter a valid ${error.schema?.type} value.`
    case 'format':
      if (error.schema?.format === 'email') return 'Please enter a valid email address (e.g., user@example.com)'
      if (error.schema?.format === 'date') return 'Please enter a valid date in YYYY-MM-DD format'
      if (error.schema?.format === 'date-time') return 'Please enter a valid date-time in ISO format'
      return `Please enter a value in ${error.schema?.format} format`
    case 'minimum':
      return `Value must be at least ${error.schema?.minimum}`
    case 'maximum':
      return `Value must be no more than ${error.schema?.maximum}`
    case 'minLength':
      return `Text must be at least ${error.schema?.minLength} characters long`
    case 'maxLength':
      return `Text must be no more than ${error.schema?.maxLength} characters long`
    case 'pattern':
      return `Value must match the required pattern: ${error.schema?.pattern}`
    case 'enum':
      return `Please select one of the allowed values: ${error.schema?.enum?.join(', ')}`
    case 'additionalProperties':
      return 'This field is not allowed in the schema. Please remove it.'
    default:
      return null
  }
}

// Initialize
onMounted(async () => {
  await fetchModel()
  if (isUpdateMode.value) {
    await fetchExistingRecord()
  }
})
</script>

<template>
  <bf-stage class="create-record" no-padding>
    <template #actions>
      <stage-actions>
        <template #left>
          <!-- Empty left side -->
        </template>
        <template #right>
          <div class="action-buttons">
            <bf-button @click="handleCancel" class="secondary" size="small">
              Cancel
            </bf-button>
            <bf-button
              type="primary" 
              @click="handleSubmit"
              :loading="saving"
              :disabled="!isValidRecord"
            >
              {{ isUpdateMode ? 'Save Record' : 'Save Record' }}
            </bf-button>
          </div>
        </template>
      </stage-actions>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state" v-loading="true">
      <p>Loading model...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <el-card shadow="never">
        <div class="error-content">
          <h3>Error Loading Model</h3>
          <p>{{ error }}</p>
          <bf-button @click="handleCancel" type="primary">
            Cancel
          </bf-button>
        </div>
      </el-card>
    </div>

    <!-- Create Record Content -->
    <div v-else-if="model" class="create-content">
      <!-- Header -->
      <div class="create-header">
        <div class="create-info">
          <h2>{{ isUpdateMode ? 'Update' : 'Create New' }} <span class="model-name-highlight">{{ model.display_name || model.name }}</span> Record</h2>
          <div class="create-meta">
            <el-tag type="info" size="small" class="model-id-tag">
              Model: {{ model.name }}
              <el-button 
                @click="goToModelDetails" 
                type="text" 
                size="small" 
                class="nav-btn" 
                title="Go to Model Details"
              >
                <IconArrowRight :width="12" :height="12" />
              </el-button>
            </el-tag>
            <el-tag type="success" size="small" class="version-tag">
              Version {{ model.latest_version?.version || 'latest' }}
            </el-tag>
          </div>
          <p class="model-description" v-if="model.description">{{ model.description }}</p>
        </div>
      </div>

      <!-- View Mode Toggle -->
      <div class="view-controls">
        <div class="validation-status">
          <el-tag 
            :type="isValidRecord ? 'success' : 'danger'" 
            size="small"
            :class="{ 'clickable-tag': !isValidRecord }"
            @click="handleInvalidTagClick"
          >
            {{ isValidRecord ? 'Valid' : 'Validation Failed' }}
          </el-tag>
        </div>
        <ViewToggle 
          :view-mode="viewMode" 
          size="small" 
          @update:view-mode="handleViewModeChange"
        />
      </div>

      <!-- Form View -->
      <div v-if="viewMode === 'ui'" class="form-view">
        <div class="properties-list">
          <div
            v-for="property in schemaProperties"
            :key="property.key"
            class="property-item"
            :class="{ 
              'is-nested': property.level > 0,
              'object-header': property.isObjectHeader,
              [`level-${property.level}`]: true
            }"
            :style="{ '--nesting-level': property.level }"
          >
            <!-- Object Header (non-editable) -->
            <div v-if="property.isObjectHeader" class="object-header-section" :class="[`level-${property.level}`]">
              <h4 class="object-title">{{ property.label }}</h4>
              <p v-if="property.description" class="object-description">{{ property.description }}</p>
            </div>
            
            <!-- Regular Property -->
            <div v-else class="property-content">
              <!-- Property Header -->
              <div class="property-header">
                <div class="property-info">
                  <div class="property-name-line">
                    <span class="property-name">{{ property.label }}</span>
                    <span v-if="property.description" class="property-description"> — {{ property.description }}</span>
                  </div>
                </div>
                <div class="property-tags">
                  <el-tag 
                    v-if="property.required"
                    size="small"
                    effect="plain"
                    class="tag-required"
                  >
                    Required
                  </el-tag>
                  <el-tag 
                    v-if="property.property && property.property['x-pennsieve-key']"
                    size="small"
                    effect="plain"
                    class="tag-key"
                  >
                    Key
                  </el-tag>
                  <el-tag 
                    size="small"
                    effect="plain"
                    :class="property.type === 'array' ? 'tag-array' : 'tag-type'"
                  >
                    {{ property.type }}
                  </el-tag>
                  <el-tag 
                    v-if="property.type === 'array' && property.property?.items?.type"
                    size="small"
                    effect="plain"
                    class="tag-array-items"
                  >
                    {{ Array.isArray(property.property.items.type) ? property.property.items.type[0] : property.property.items.type }}[]
                  </el-tag>
                </div>
              </div>
              
              <!-- Form Input -->
              <div class="property-input">
                <component :is="renderFormField(property)" />
                
                <!-- Validation Error Display -->
                <div 
                  v-for="error in validationErrors.filter(err => err.instancePath && err.instancePath.includes(property.key))" 
                  :key="error.message"
                  class="validation-error"
                >
                  {{ error.message }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- JSON View -->
      <div v-if="viewMode === 'json'" class="json-view">
        <el-card shadow="never" class="json-card">
          <template #header>
            <div class="json-header">
              <h3>Record JSON Editor</h3>
              <el-tag 
                :type="isValidRecord ? 'success' : 'danger'" 
                size="small"
                :class="{ 'clickable-tag': !isValidRecord }"
                @click="handleInvalidTagClick"
              >
                {{ isValidRecord ? 'Valid' : 'Validation Failed' }}
              </el-tag>
            </div>
          </template>
          
          <div class="json-editor">
            <el-input
              ref="jsonEditor"
              v-model="jsonContent"
              type="textarea"
              :rows="20"
              placeholder="Enter record JSON here..."
              @input="onJsonContentChange"
              @keydown="onJsonEditorKeydown"
            />
            <div v-if="jsonError" class="json-error">
              {{ jsonError }}
            </div>
          </div>
          
          <!-- Validation Status -->
          <div v-if="!isValidRecord" class="validation-section">
            <div class="validation-header">
              <h4>Validation Issues</h4>
              <p>Please address the following to {{ isUpdateMode ? 'update' : 'create' }} a valid record:</p>
            </div>
            
            <div class="validation-list">
              <div v-if="validationErrors.length === 0" class="no-errors-debug">
                <p>No validation errors found, but record is marked as invalid.</p>
              </div>
              <div v-for="(error, index) in validationErrors" :key="index" class="validation-item">
                <div class="validation-item-content">
                  <div class="field-name">{{ getFieldPath(error) }}</div>
                  <div class="error-message">{{ error.message }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Success Message -->
          <div v-else class="validation-success">
            <h4>✅ Validation Passed</h4>
            <p>This record conforms to the model's JSON schema and is ready to be {{ isUpdateMode ? 'updated' : 'created' }}.</p>
          </div>
        </el-card>
      </div>
    </div>
  </bf-stage>
</template>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/tag';


.create-record {
  // Action buttons spacing
  .action-buttons {
    display: flex;
    gap: 8px;
    align-items: center;
  }

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

  .create-content {
    padding: 24px;

    .create-header {
      margin-bottom: 24px;

      .create-info {
        h2 {
          font-size: 24px;
          font-weight: 400;
          color: theme.$gray_6;
          
          .model-name-highlight {
            color: theme.$purple_1;
            font-weight: 600;
          }
        }

        .create-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 8px 0;
          
          .model-id-tag,
          .version-tag {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            
            .nav-btn {
              padding: 0;
              margin-left: 4px;
              
              &:hover {
                color: theme.$purple_2 !important;
              }
            }
          }
          
          .model-id-tag {
            background-color: theme.$purple_tint !important;
            border-color: theme.$purple_tint !important;
            color: theme.$purple_2 !important;
            
            .nav-btn {
              color: theme.$purple_2 !important;
            }
          }
          
          .version-tag {
            background-color: theme.$green_tint !important;
            border-color: theme.$green_tint !important;
            color: theme.$green_1 !important;
          }
        }

        .model-description {
          margin: 8px 0 0 0;
          color: theme.$gray_5;
          font-size: 14px;
        }
      }
    }

    .view-controls {
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .validation-status {
        display: flex;
        align-items: center;
        
        .clickable-tag {
          cursor: pointer;
          transition: all 0.2s ease;
          
          &:hover {
            opacity: 0.8;
            transform: translateY(-1px);
          }
        }
      }
    }

    .form-view {
      .properties-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 8px;
        
        .property-item {
            padding: 12px;
            background-color: theme.$gray_1;
            border-left: 2px solid theme.$purple_2;
            
            // Dynamic nesting styles using CSS custom properties
            &.is-nested {
              // Dynamic margin based on nesting level (24px per level)
              margin-left: calc(var(--nesting-level) * 24px);
              
              // Level 1: light purple, moderate opacity
              &.level-1 {
                background-color: rgba(255,255,255,0.85);
                border-left: 2px solid theme.$purple_1;
              }
              
              // Level 2: lighter purple, higher opacity  
              &.level-2 {
                background-color: rgba(255,255,255,0.95);
                border-left: 2px solid theme.$purple_0_7;
              }
              
              // Level 3+: white background, gray borders
              &:not(.level-1):not(.level-2) {
                background-color: white;
                border-left: 2px solid theme.$gray_3;
              }
            }
            
            // Object headers
            &.object-header {
              background: transparent !important;
              border: none !important;
              border-left: none !important;
              padding: 8px 0;
              margin-bottom: 8px;
              
              // Dynamic margin for object headers too
              &.is-nested {
                margin-left: calc(var(--nesting-level) * 24px);
              }

              .object-header-section {
                .object-title {
                  margin: 0 0 4px 0;
                  font-size: 16px;
                  font-weight: 600;
                  color: theme.$gray_6;
                  padding: 8px 12px;
                  background: theme.$gray_1;
                  border-left: 4px solid theme.$purple_1;
                }
                
                // Nested object titles get progressively smaller and lighter
                &.level-1 .object-title {
                  font-size: 15px;
                  border-left-color: theme.$purple_1;
                }
                
                &.level-2 .object-title {
                  font-size: 14px;
                  border-left-color: theme.$purple_0_7;
                }
                
                &.level-3 .object-title {
                  font-size: 14px;
                  border-left-color: theme.$gray_3;
                }

                .object-description {
                  margin: 4px 0 0 12px;
                  font-size: 13px;
                  color: theme.$gray_5;
                  font-style: italic;
                }
              }
            }

            .property-content {
              .property-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 12px;

                .property-info {
                  flex: 1;
                  min-width: 0;
                  
                  .property-name-line {
                    line-height: 1.4;
                    word-wrap: break-word;
                    
                    .property-name {
                      font-weight: 500;
                      color: theme.$gray_6;
                      font-size: 14px;
                    }

                    .property-description {
                      font-size: 12px;
                      color: theme.$gray_5;
                      font-weight: normal;
                    }
                  }
                }

                .property-tags {
                  display: flex;
                  gap: 6px;
                  flex-wrap: wrap;
                  flex-shrink: 0;
                  
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
                  
                  :deep(.tag-type) {
                    background-color: theme.$gray_1;
                    border-color: theme.$gray_3;
                    color: theme.$gray_5;
                  }
                  
                  :deep(.tag-array) {
                    background-color: theme.$purple_tint;
                    border-color: theme.$purple_0_7;
                    color: theme.$purple_2;
                  }
                  
                  :deep(.tag-array-items) {
                    background-color: #f5f6f8;
                    border-color: theme.$purple_0_7;
                    color: theme.$purple_1;
                    font-style: italic;
                  }
                }
              }

              .property-input {
                // Ensure all form inputs have proper pointer events
                :deep(.el-input) {
                  pointer-events: auto;
                  
                  .el-input__wrapper,
                  .el-textarea__inner {
                    pointer-events: auto;
                  }
                }
                
                // Ensure boolean switches have proper pointer events
                .boolean-field-wrapper {
                  // Make sure the wrapper doesn't interfere with click events
                  pointer-events: none;
                  
                  :deep(.el-switch) {
                    // Restore pointer events for the switch itself
                    pointer-events: auto;
                    // Ensure proper z-index
                    position: relative;
                    z-index: 1;
                    
                    // Make sure all internal switch elements are clickable
                    .el-switch__core,
                    .el-switch__action {
                      pointer-events: auto;
                      z-index: inherit;
                    }
                  }
                }
                
                // Nullable field wrapper styling
                .key-field-wrapper {
                  .key-field-control {
                    margin-bottom: 8px;
                    
                    .null-checkbox-label {
                      display: flex;
                      align-items: center;
                      font-size: 13px;
                      color: theme.$gray_5;
                      cursor: pointer;
                      
                      .null-checkbox {
                        margin-right: 6px;
                        cursor: pointer;
                      }
                      
                      .null-label {
                        font-style: italic;
                      }
                    }
                  }
                  
                  .key-field-input {
                    transition: opacity 0.2s ease;
                  }
                }
                
                .validation-error {
                  color: theme.$red_1;
                  font-size: 12px;
                  margin-top: 6px;
                  padding: 4px 8px;
                  background: theme.$red_tint;
                  border: 1px solid theme.$red_1;
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

          .json-header {
            display: flex;
            justify-content: space-between;
            align-items: center;

            h3 {
              margin: 0;
              font-size: 18px;
              font-weight: 600;
              color: theme.$gray_6;
            }
          }
        }

        :deep(.el-card__body) {
          padding: 0;
        }

        .json-editor {
          padding: 24px;
          
          :deep(.el-textarea) {
            .el-textarea__inner {
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 13px;
              line-height: 1.5;
              resize: none;
              min-height: 400px;
            }
          }
          
          .json-error {
            color: theme.$red_1;
            background-color: theme.$red_tint;
            padding: 8px;
            border-radius: 4px;
            margin-top: 8px;
            font-size: 13px;
          }
        }

        .validation-section {
          border-top: 1px solid theme.$red_1;

          .validation-header {
            padding: 16px 24px;
            background: theme.$red_tint;
            border-bottom: 1px solid theme.$red_1;

            h4 {
              margin: 0 0 4px 0;
              color: theme.$red_2;
              font-size: 14px;
              font-weight: 500;
            }

            p {
              margin: 0;
              color: theme.$red_2;
              font-size: 13px;
            }
          }

          .validation-list {
            padding: 12px 24px;

            .no-errors-debug p {
              color: theme.$gray_5;
              font-size: 13px;
              margin: 0;
              font-style: italic;
            }

            .validation-item {
              padding: 8px 0;
              border-bottom: 1px solid theme.$gray_2;

              &:last-child {
                border-bottom: none;
                padding-bottom: 0;
              }

              .validation-item-content {
                .field-name {
                  font-size: 13px;
                  font-weight: 500;
                  color: theme.$gray_6;
                  margin-bottom: 2px;
                }

                .error-message {
                  font-size: 12px;
                  color: theme.$gray_5;
                  line-height: 1.4;
                }
              }
            }
          }
        }

        .validation-success {
          padding: 16px 24px;
          background: theme.$green_tint;
          border-top: 1px solid theme.$green_1;

          h4 {
            margin: 0 0 8px 0;
            color: theme.$green_2;
            font-size: 16px;
            font-weight: 600;
          }

          p {
            margin: 0;
            color: theme.$green_2;
            font-size: 14px;
          }
        }
      }
    }
  }
}
</style>