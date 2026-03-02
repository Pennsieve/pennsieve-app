<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      :show-close="false"
      class="property-dialog"
      width="800px"
    >
      <template #header>
        <bf-dialog-header :title="editingProperty ? 'Edit Property' : 'Add Property'" />
      </template>

      <dialog-body>
        <!-- Informational Note -->
        <div class="info-note">
          <el-alert
            type="info"
            :closable="false"
            show-icon
          >
            <template #title>
              <span class="alert-title">Form-Based Property Creation</span>
            </template>
            This form provides the most common property configuration options. For advanced JSON Schema functionality (constraints, conditional schemas, etc.), you can define the full specification by directly editing the model definition as JSON.
          </el-alert>
        </div>

        <el-form ref="formRef" :model="propertyForm" :rules="propertyRules" label-position="top" class="property-form">
          <!-- Basic Information Section -->
          <div class="form-section">
            <h3 class="section-title">Basic Information</h3>
            <div class="form-grid">
              <el-form-item prop="displayName" label="Display Name">
                <el-input
                  v-model="propertyForm.displayName"
                  placeholder="Human-readable name"
                  @input="generatePropertyName"
                />
              </el-form-item>
              
              <el-form-item prop="name" label="Property Name">
                <el-input
                  v-model="propertyForm.name"
                  placeholder="Technical identifier"
                  :disabled="!!editingProperty"
                />
              </el-form-item>
            </div>

            <div class="form-grid">
              <el-form-item prop="type" label="Data Type">
                <el-select 
                  v-model="propertyForm.type" 
                  @change="onTypeChange"
                  popper-class="property-dialog-dropdown"
                >
                  <el-option
                    v-for="type in propertyTypes"
                    :key="type.value"
                    :value="type.value"
                    :label="type.label"
                  >
                    <div class="option-content">
                      <span class="option-label">{{ type.label }}</span>
                      <span class="option-description">{{ type.description }}</span>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>

              <el-form-item v-if="showFormatField" label="Format">
                <el-select 
                  v-model="propertyForm.format" 
                  clearable 
                  placeholder="Select text format"
                  style="width: 100%"
                  popper-class="property-dialog-dropdown"
                >
                  <el-option
                    v-for="format in availableFormats"
                    :key="format.value"
                    :value="format.value"
                    :label="format.label"
                  >
                    <div class="option-content">
                      <span class="option-label">{{ format.label }}</span>
                      <span class="option-description">{{ format.description }}</span>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>
            </div>

            <el-form-item label="Description">
              <el-input
                v-model="propertyForm.description"
                type="textarea"
                :rows="2"
                placeholder="Describe this property's purpose and usage"
              />
            </el-form-item>

            <!-- Object Template Selector -->
            <div v-if="propertyForm.type === 'object'" class="object-template-section">
              <h4 class="template-section-title">Object Structure Templates</h4>
              <div class="template-info">
                <el-alert
                  type="warning"
                  :closable="false"
                  show-icon
                >
                  <template #title>
                    Object properties require JSON Schema editing
                  </template>
                  Objects with nested properties are complex and require direct JSON Schema editing. Choose a template below to get started, then switch to JSON mode to customize the structure.
                </el-alert>
              </div>

              <el-form-item label="Choose Template">
                <el-select 
                  v-model="selectedObjectTemplate" 
                  placeholder="Select an object template"
                  style="width: 100%"
                  popper-class="property-dialog-dropdown"
                  @change="onTemplateSelect"
                >
                  <el-option
                    v-for="template in objectTemplates"
                    :key="template.id"
                    :value="template.id"
                    :label="template.name"
                  >
                    <div class="option-content">
                      <span class="option-label">{{ template.name }}</span>
                      <span class="option-description">{{ template.description }}</span>
                    </div>
                  </el-option>
                </el-select>
              </el-form-item>

            </div>

            <!-- Property Options -->
            <div class="property-options">
              <h4 class="options-title">Property Options</h4>
              <div class="options-grid">
                <el-form-item>
                  <el-checkbox 
                    v-model="propertyForm.required"
                    :disabled="propertyForm.isKey"
                  >
                    Required Property
                  </el-checkbox>
                  <div class="field-help">
                    {{ propertyForm.isKey 
                       ? 'Required because this property is marked as part of key' 
                       : 'Mark this property as mandatory' }}
                  </div>
                </el-form-item>

                <el-form-item>
                  <el-checkbox v-model="propertyForm.isKey">
                    Part of Key
                  </el-checkbox>
                  <div class="field-help">Include this property in the unique identifier</div>
                </el-form-item>

                <el-form-item>
                  <el-checkbox v-model="propertyForm.isSensitive">
                    Sensitive Data
                  </el-checkbox>
                  <div class="field-help">Mark this property as containing sensitive information</div>
                </el-form-item>

                <el-form-item v-show="propertyForm.type !== 'object'">
                  <el-checkbox v-model="propertyForm.isArray">
                    Array Property
                  </el-checkbox>
                  <div class="field-help">Make this an array of {{ propertyForm.type }} values</div>
                </el-form-item>

                <el-form-item v-show="propertyForm.required">
                  <el-checkbox v-model="propertyForm.allowNull">
                    Allow Null Values
                  </el-checkbox>
                  <div class="field-help">Allow this required property to be null</div>
                </el-form-item>
              </div>
            </div>
          </div>

          <!-- Constraints Section -->
          <div v-if="showConstraintsSection" class="form-section">
            <h3 class="section-title">{{ constraintsSectionTitle }}</h3>
            
            <!-- String constraints -->
            <div v-if="propertyForm.type === 'string'" class="constraints-content">
              <div class="constraint-row">
                <el-form-item label="Min Length">
                  <el-input 
                    v-model="propertyForm.minLength" 
                    type="number" 
                    min="0"
                    placeholder="0"
                  />
                </el-form-item>
                <el-form-item label="Max Length">
                  <el-input 
                    v-model="propertyForm.maxLength" 
                    type="number" 
                    min="1"
                    placeholder="No limit"
                  />
                </el-form-item>
              </div>
              <el-form-item label="Pattern (Regular Expression)">
                <el-input 
                  v-model="propertyForm.pattern" 
                  placeholder="^[A-Z]{3}[0-9]{6}$ (e.g., ABC123456)"
                />
                <div class="field-help">Use regex to validate text format</div>
              </el-form-item>
            </div>

            <!-- Numeric constraints -->
            <div v-if="isNumericType" class="constraints-content">
              <div class="constraint-row">
                <el-form-item label="Minimum Value">
                  <el-input 
                    v-model="propertyForm.minimum" 
                    :type="propertyForm.type === 'integer' ? 'number' : 'text'"
                    :step="propertyForm.type === 'integer' ? '1' : 'any'"
                    placeholder="No minimum"
                  />
                </el-form-item>
                <el-form-item label="Maximum Value">
                  <el-input 
                    v-model="propertyForm.maximum" 
                    :type="propertyForm.type === 'integer' ? 'number' : 'text'"
                    :step="propertyForm.type === 'integer' ? '1' : 'any'"
                    placeholder="No maximum"
                  />
                </el-form-item>
              </div>
            </div>

            <!-- Array constraints (when isArray is checked) -->
            <div v-if="propertyForm.isArray" class="constraints-content array-constraints">
              <h4 class="constraint-subsection-title">Array Constraints</h4>
              <div class="constraint-row">
                <el-form-item label="Min Items">
                  <el-input 
                    v-model="propertyForm.minItems" 
                    type="number" 
                    min="0"
                    placeholder="0"
                  />
                </el-form-item>
                <el-form-item label="Max Items">
                  <el-input 
                    v-model="propertyForm.maxItems" 
                    type="number" 
                    min="1"
                    placeholder="No limit"
                  />
                </el-form-item>
              </div>
              <el-form-item>
                <el-checkbox v-model="propertyForm.uniqueItems">
                  Require unique items
                </el-checkbox>
                <div class="field-help">Each item in the array must be unique</div>
              </el-form-item>
              
              <div v-if="propertyForm.type === 'string' || isNumericType" class="item-constraints">
                <h4 class="constraint-subsection-title">Item Constraints</h4>
                <div class="field-help">These constraints apply to each individual {{ propertyForm.type }} in the array</div>
              </div>
            </div>
          </div>

          <!-- Values & Options Section -->
          <div class="form-section">
            <h3 class="section-title">Values & Options</h3>
            
            <!-- Enum values -->
            <el-form-item v-if="showEnumField" label="Allowed Values">
              <el-input
                v-model="propertyForm.enumInput"
                type="textarea"
                :rows="2"
                :placeholder="enumPlaceholder"
              />
              <div class="field-help">{{ enumHelp }}</div>
            </el-form-item>

            <!-- Default value -->
            <el-form-item 
              label="Default Value" 
              :class="{ 'disabled-section': propertyForm.type === 'object' }"
            >
              <el-select 
                v-if="propertyForm.type === 'boolean'"
                v-model="propertyForm.default"
                :disabled="propertyForm.type === 'object'"
                clearable
                style="width: 100%"
                placeholder="Select default value"
              >
                <el-option value="true" label="True" />
                <el-option value="false" label="False" />
              </el-select>
              <el-input 
                v-else
                v-model="propertyForm.default" 
                :disabled="propertyForm.type === 'object'"
                :type="defaultInputType"
                :placeholder="defaultPlaceholder"
              />
              <div class="field-help">{{ defaultValueHelp }}</div>
            </el-form-item>
          </div>
        </el-form>

        <div class="dialog-actions">
          <bf-button @click="handleCancel">Cancel</bf-button>
          <bf-button type="primary" @click="handleSave">
            {{ editingProperty ? 'Update' : 'Add' }} Property
          </bf-button>
        </div>
      </dialog-body>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElButton, ElCheckbox, ElDialog, ElMessage } from 'element-plus'
import BfButton from "@/components/shared/bf-button/BfButton.vue";
import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "@/components/shared/dialog-body/DialogBody.vue";

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  editingProperty: {
    type: String,
    default: null
  },
  initialPropertyData: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['update:visible', 'save', 'cancel', 'template-selected'])

// Form ref
const formRef = ref(null)

// Computed property for dialog visibility
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Property form data
const propertyForm = ref({
  name: '',
  displayName: '',
  type: 'string',
  format: '',
  description: '',
  minLength: '',
  maxLength: '',
  pattern: '',
  minimum: '',
  maximum: '',
  minItems: '',
  maxItems: '',
  uniqueItems: false,
  enumInput: '',
  default: '',
  required: false,
  isKey: false,
  isSensitive: false,
  allowNull: false,
  isArray: false
})

// Object template state
const selectedObjectTemplate = ref('')
const showTemplateDocumentation = ref(false)

// Property types with enhanced descriptions (Array removed - now handled as modifier)
const propertyTypes = [
  { value: 'string', label: 'Text', description: 'Text data with optional format validation' },
  { value: 'number', label: 'Number', description: 'Decimal numbers (e.g., 3.14, 42.0)' },
  { value: 'integer', label: 'Integer', description: 'Whole numbers only (e.g., 1, 42, 100)' },
  { value: 'boolean', label: 'True/False', description: 'Boolean values (true or false)' },
  { value: 'object', label: 'Object', description: 'Nested object with properties' }
]

const stringFormats = [
  { value: 'plain', label: 'Plain text', description: 'Any text content without validation' },
  { value: 'date', label: 'Date', description: 'Date in YYYY-MM-DD format (e.g., 2023-12-25)' },
  { value: 'date-time', label: 'Date & Time', description: 'ISO 8601 format (e.g., 2023-12-25T10:30:00Z)' },
  { value: 'time', label: 'Time', description: 'Time in HH:MM:SS format (e.g., 14:30:00)' },
  { value: 'email', label: 'Email Address', description: 'Valid email format (e.g., user@domain.com)' },
  { value: 'uri', label: 'URL/URI', description: 'Valid URL format (e.g., https://example.com)' },
  { value: 'uuid', label: 'UUID', description: 'Universally unique identifier' },
  { value: 'ipv4', label: 'IPv4 Address', description: 'IPv4 format (e.g., 192.168.1.1)' },
  { value: 'ipv6', label: 'IPv6 Address', description: 'IPv6 format' },
  { value: 'hostname', label: 'Hostname', description: 'Valid hostname format' }
]

const objectTemplates = [
  {
    id: 'empty',
    name: 'Empty Object',
    description: 'Minimal object structure to customize',
    schema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    id: 'person',
    name: 'Person',
    description: 'Person with name, age, and contact information',
    schema: {
      type: "object",
      properties: {
        firstName: {
          type: "string",
          title: "First Name",
          minLength: 1
        },
        lastName: {
          type: "string", 
          title: "Last Name",
          minLength: 1
        },
        age: {
          type: "integer",
          title: "Age",
          minimum: 0,
          maximum: 150
        },
        email: {
          type: "string",
          title: "Email Address",
          format: "email"
        }
      },
      required: ["firstName", "lastName"],
      additionalProperties: false
    }
  },
  {
    id: 'address',
    name: 'Address',
    description: 'Physical address with validation',
    schema: {
      type: "object",
      properties: {
        street: {
          type: "string",
          title: "Street Address",
          minLength: 1
        },
        city: {
          type: "string",
          title: "City",
          minLength: 1
        },
        state: {
          type: "string",
          title: "State/Province",
          minLength: 2,
          maxLength: 3
        },
        zipCode: {
          type: "string",
          title: "ZIP/Postal Code",
          pattern: "^[0-9]{5}(-[0-9]{4})?$"
        },
        country: {
          type: "string",
          title: "Country",
          enum: ["US", "CA", "UK", "DE", "FR", "AU"]
        }
      },
      required: ["street", "city", "country"],
      additionalProperties: false
    }
  },
  {
    id: 'measurement',
    name: 'Measurement',
    description: 'Numeric measurement with units and metadata',
    schema: {
      type: "object",
      properties: {
        value: {
          type: "number",
          title: "Measurement Value"
        },
        unit: {
          type: "string",
          title: "Unit of Measurement",
          enum: ["mm", "cm", "m", "km", "in", "ft", "yd", "mi", "mg", "g", "kg", "oz", "lb"]
        },
        precision: {
          type: "number",
          title: "Measurement Precision",
          minimum: 0
        },
        timestamp: {
          type: "string",
          title: "Measurement Time",
          format: "date-time"
        }
      },
      required: ["value", "unit"],
      additionalProperties: false
    }
  },
  {
    id: 'coordinates',
    name: 'Geographic Coordinates',
    description: 'Latitude/longitude with optional elevation',
    schema: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
          title: "Latitude",
          minimum: -90,
          maximum: 90
        },
        longitude: {
          type: "number", 
          title: "Longitude",
          minimum: -180,
          maximum: 180
        },
        elevation: {
          type: "number",
          title: "Elevation (meters)"
        },
        accuracy: {
          type: "number",
          title: "Accuracy (meters)",
          minimum: 0
        }
      },
      required: ["latitude", "longitude"],
      additionalProperties: false
    }
  }
]

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

// Computed properties for reactive form behavior
const showFormatField = computed(() => propertyForm.value.type === 'string')
const showConstraintsSection = computed(() => 
  ['string', 'number', 'integer'].includes(propertyForm.value.type) || propertyForm.value.isArray
)
const isNumericType = computed(() => 
  ['number', 'integer'].includes(propertyForm.value.type)
)
const showEnumField = computed(() => 
  !['object'].includes(propertyForm.value.type)
)

const availableFormats = computed(() => {
  if (propertyForm.value.type === 'string') {
    return stringFormats
  }
  return []
})

const constraintsSectionTitle = computed(() => {
  if (propertyForm.value.isArray) {
    return `${propertyForm.value.type} Array Constraints`
  }
  switch (propertyForm.value.type) {
    case 'string': return 'Text Constraints'
    case 'number':
    case 'integer': return 'Numeric Constraints'
    default: return 'Constraints'
  }
})

const enumPlaceholder = computed(() => {
  switch (propertyForm.value.type) {
    case 'string': return 'option1, option2, option3'
    case 'number': return '1.5, 2.7, 3.14'
    case 'integer': return '1, 2, 3, 5, 8'
    case 'boolean': return 'true, false'
    default: return 'value1, value2, value3'
  }
})

const enumHelp = computed(() => {
  return 'Comma-separated list of allowed values. Leave empty to allow any value.'
})

const defaultInputType = computed(() => {
  switch (propertyForm.value.type) {
    case 'number': return 'number'
    case 'integer': return 'number'
    case 'email': return 'email'
    case 'uri': return 'url'
    default: return 'text'
  }
})

const defaultPlaceholder = computed(() => {
  switch (propertyForm.value.type) {
    case 'string': return 'Enter default text value'
    case 'number': return 'Enter default number (e.g., 3.14)'
    case 'integer': return 'Enter default integer (e.g., 42)'
    case 'array': return 'Not applicable for arrays'
    case 'object': return 'Not applicable for objects'
    default: return 'Enter default value'
  }
})

const defaultValueHelp = computed(() => {
  switch (propertyForm.value.type) {
    case 'boolean': return 'Select true or false as the default value'
    case 'array': return 'Default values for arrays are not supported'
    case 'object': return 'Default values for objects are not supported'
    default: return 'Optional default value for this property'
  }
})

// Watch for initial property data changes
watch(() => props.initialPropertyData, (newData) => {
  if (newData && Object.keys(newData).length > 0) {
    propertyForm.value = { ...newData }
  } else {
    // Reset form for new property
    propertyForm.value = {
      name: '',
      displayName: '',
      type: 'string',
      format: '',
      description: '',
      minLength: '',
      maxLength: '',
      pattern: '',
      minimum: '',
      maximum: '',
      minItems: '',
      maxItems: '',
      uniqueItems: false,
      enumInput: '',
      default: '',
      required: false,
      isKey: false,
      isSensitive: false,
      allowNull: false,
      isArray: false
    }
  }
}, { deep: true, immediate: true })

// Methods
const generatePropertyName = () => {
  if (propertyForm.value.displayName && !props.editingProperty) {
    const displayName = String(propertyForm.value.displayName || '')
    propertyForm.value.name = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
  }
}

const onTypeChange = () => {
  // Clear type-specific fields when type changes
  propertyForm.value.minLength = ''
  propertyForm.value.maxLength = ''
  propertyForm.value.pattern = ''
  propertyForm.value.minimum = ''
  propertyForm.value.maximum = ''
  propertyForm.value.minItems = ''
  propertyForm.value.maxItems = ''
  propertyForm.value.uniqueItems = false
  propertyForm.value.enumInput = ''
  propertyForm.value.default = ''
  
  // Set default format for string type, clear for others
  if (propertyForm.value.type === 'string') {
    propertyForm.value.format = 'plain' // This corresponds to "Plain text" option
  } else {
    propertyForm.value.format = ''
  }
}

// Watch for changes to the required property to clear allowNull when not required
watch(() => propertyForm.value.required, (newRequired) => {
  if (!newRequired) {
    propertyForm.value.allowNull = false
  }
})

// Watch for changes to the isKey property to automatically set required
watch(() => propertyForm.value.isKey, (newIsKey) => {
  if (newIsKey) {
    propertyForm.value.required = true
  }
  // Note: We don't automatically unset required when unchecking isKey
  // because the user might want to keep it required for other reasons
})

// Note: Sensitive data properties are not automatically required
// Users can choose whether sensitive properties should be required or optional

// Object template methods
const onTemplateSelect = (templateId) => {
  const template = objectTemplates.find(t => t.id === templateId)
  if (template) {
    // Store template schema for JSON mode
    emit('template-selected', {
      propertyName: propertyForm.value.name || 'untitled_object',
      template: template
    })
  }
}

const emitSwitchToJson = () => {
  // Get selected template or empty object template
  const template = selectedObjectTemplate.value 
    ? objectTemplates.find(t => t.id === selectedObjectTemplate.value)
    : objectTemplates[0] // Default to empty object
  
  emit('switch-to-json', {
    propertyName: propertyForm.value.name || 'untitled_object',
    displayName: propertyForm.value.displayName || 'Untitled Object',
    description: propertyForm.value.description || '',
    required: propertyForm.value.required,
    isKey: propertyForm.value.isKey,
    isSensitive: propertyForm.value.isSensitive,
    template: template
  })
}

const validateForm = () => {
  const errors = []
  
  // Required field validation
  const name = String(propertyForm.value.name || '')
  const displayName = String(propertyForm.value.displayName || '')
  
  if (!name.trim()) {
    errors.push('Property identifier is required')
  } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    errors.push('Property identifier must start with a letter and contain only letters, numbers, and underscores')
  }
  
  if (!displayName.trim()) {
    errors.push('Display name is required')
  }
  
  // Type-specific validation
  const type = propertyForm.value.type
  
  // String validation
  if (type === 'string') {
    if (propertyForm.value.minLength !== '' && propertyForm.value.maxLength !== '') {
      const minLen = parseInt(propertyForm.value.minLength)
      const maxLen = parseInt(propertyForm.value.maxLength)
      if (minLen > maxLen) {
        errors.push('Minimum length cannot be greater than maximum length')
      }
    }
    
    if (propertyForm.value.pattern) {
      try {
        new RegExp(propertyForm.value.pattern)
      } catch (e) {
        errors.push('Invalid regular expression pattern')
      }
    }
  }
  
  // Number/Integer validation
  if (type === 'number' || type === 'integer') {
    if (propertyForm.value.minimum !== '' && propertyForm.value.maximum !== '') {
      const min = parseFloat(propertyForm.value.minimum)
      const max = parseFloat(propertyForm.value.maximum)
      if (min > max) {
        errors.push('Minimum value cannot be greater than maximum value')
      }
    }
    
    if (type === 'integer') {
      if (propertyForm.value.minimum !== '' && !Number.isInteger(parseFloat(propertyForm.value.minimum))) {
        errors.push('Minimum value must be an integer')
      }
      if (propertyForm.value.maximum !== '' && !Number.isInteger(parseFloat(propertyForm.value.maximum))) {
        errors.push('Maximum value must be an integer')
      }
    }
  }
  
  // Array validation
  if (type === 'array') {
    if (propertyForm.value.minItems !== '' && propertyForm.value.maxItems !== '') {
      const minItems = parseInt(propertyForm.value.minItems)
      const maxItems = parseInt(propertyForm.value.maxItems)
      if (minItems > maxItems) {
        errors.push('Minimum items cannot be greater than maximum items')
      }
    }
  }
  
  // Enum validation
  if (propertyForm.value.enumInput) {
    const enumValues = String(propertyForm.value.enumInput).split(',').map(v => v.trim()).filter(v => v)
    if (enumValues.length === 0) {
      errors.push('At least one enum value is required')
    }
  }
  
  // Default value validation
  if (propertyForm.value.default !== '') {
    if (type === 'number' || type === 'integer') {
      const defaultNum = parseFloat(propertyForm.value.default)
      if (isNaN(defaultNum)) {
        errors.push(`Default value must be a valid ${type}`)
      }
      if (type === 'integer' && !Number.isInteger(defaultNum)) {
        errors.push('Default value must be an integer')
      }
      
      // Check against min/max
      if (propertyForm.value.minimum !== '' && defaultNum < parseFloat(propertyForm.value.minimum)) {
        errors.push('Default value cannot be less than minimum')
      }
      if (propertyForm.value.maximum !== '' && defaultNum > parseFloat(propertyForm.value.maximum)) {
        errors.push('Default value cannot be greater than maximum')
      }
    }
    
    // Check enum values
    if (propertyForm.value.enumInput) {
      const enumValues = String(propertyForm.value.enumInput).split(',').map(v => v.trim())
      if (!enumValues.includes(propertyForm.value.default)) {
        errors.push('Default value must be one of the enum values')
      }
    }
  }
  
  return errors
}

const handleCancel = () => {
  emit('cancel')
  dialogVisible.value = false
}

const handleSave = () => {
  // Validate form
  const errors = validateForm()
  if (errors.length > 0) {
    ElMessage.error({
      message: errors.join('; '),
      duration: 5000
    })
    return
  }

  // Validate Pennsieve-specific rules
  if (propertyForm.value.isKey && !propertyForm.value.required) {
    ElMessage.error(`Property "${propertyForm.value.name}" has "Part of Key" set but is not marked as required`)
    return
  }

  // Note: Sensitive data properties are allowed to be optional
  // This is different from key properties which must be required

  // Build property schema
  const property = {}
  
  // Handle array properties vs. single properties
  if (propertyForm.value.isArray) {
    // This is an array property
    property.type = 'array'
    
    // Create items schema for the array elements
    const itemsSchema = {}
    
    // Set the base type for array items
    if (propertyForm.value.allowNull) {
      itemsSchema.type = [propertyForm.value.type, "null"]
    } else {
      itemsSchema.type = propertyForm.value.type
    }
    
    property.items = itemsSchema
  } else {
    // This is a single (non-array) property
    if (propertyForm.value.allowNull) {
      property.type = [propertyForm.value.type, "null"]
    } else {
      property.type = propertyForm.value.type
    }
  }

  property.title = propertyForm.value.displayName

  if (propertyForm.value.description) {
    property.description = propertyForm.value.description
  }

  if (propertyForm.value.format && propertyForm.value.type === 'string' && propertyForm.value.format !== 'plain') {
    property.format = propertyForm.value.format
  }

  // Add constraints based on whether this is an array or single property
  if (propertyForm.value.isArray) {
    // Array-level constraints
    if (propertyForm.value.minItems !== undefined && propertyForm.value.minItems !== '') {
      property.minItems = parseInt(propertyForm.value.minItems)
    }
    if (propertyForm.value.maxItems !== undefined && propertyForm.value.maxItems !== '') {
      property.maxItems = parseInt(propertyForm.value.maxItems)
    }
    if (propertyForm.value.uniqueItems) {
      property.uniqueItems = true
    }
    
    // Item-level constraints go into the items schema
    if (propertyForm.value.type === 'string') {
      if (propertyForm.value.minLength !== undefined && propertyForm.value.minLength !== '') {
        property.items.minLength = parseInt(propertyForm.value.minLength)
      }
      if (propertyForm.value.maxLength !== undefined && propertyForm.value.maxLength !== '') {
        property.items.maxLength = parseInt(propertyForm.value.maxLength)
      }
      if (propertyForm.value.pattern) {
        property.items.pattern = propertyForm.value.pattern
      }
      if (propertyForm.value.format && propertyForm.value.format !== 'plain') {
        property.items.format = propertyForm.value.format
      }
    }

    if (propertyForm.value.type === 'number' || propertyForm.value.type === 'integer') {
      if (propertyForm.value.minimum !== undefined && propertyForm.value.minimum !== '') {
        property.items.minimum = parseFloat(propertyForm.value.minimum)
      }
      if (propertyForm.value.maximum !== undefined && propertyForm.value.maximum !== '') {
        property.items.maximum = parseFloat(propertyForm.value.maximum)
      }
    }
    
    // Handle enum values for array items
    if (propertyForm.value.enumInput) {
      const enumValues = String(propertyForm.value.enumInput).split(',').map(v => v.trim()).filter(v => v)
      if (enumValues.length > 0) {
        property.items.enum = enumValues
      }
    }
  } else {
    // Single property constraints
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
      if (propertyForm.value.format) {
        property.format = propertyForm.value.format
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
    
    // Handle object type with template
    if (propertyForm.value.type === 'object' && selectedObjectTemplate.value) {
      const template = objectTemplates.find(t => t.id === selectedObjectTemplate.value)
      if (template && template.schema) {
        // Copy the template's properties and other schema attributes
        if (template.schema.properties) {
          property.properties = template.schema.properties
        }
        if (template.schema.required) {
          property.required = template.schema.required
        }
        if (template.schema.additionalProperties !== undefined) {
          property.additionalProperties = template.schema.additionalProperties
        }
      }
    }
    
    // Handle enum values for single properties
    if (propertyForm.value.enumInput) {
      const enumValues = String(propertyForm.value.enumInput).split(',').map(v => v.trim()).filter(v => v)
      if (enumValues.length > 0) {
        property.enum = enumValues
      }
    }
  }


  // Handle default value
  if (propertyForm.value.default !== undefined && propertyForm.value.default !== '') {
    let defaultValue = propertyForm.value.default
    if (propertyForm.value.type === 'number') {
      defaultValue = parseFloat(defaultValue)
    } else if (propertyForm.value.type === 'integer') {
      defaultValue = parseInt(defaultValue)
    } else if (propertyForm.value.type === 'boolean') {
      defaultValue = defaultValue === 'true' || defaultValue === true
    }
    property.default = defaultValue
  }

  // Add Pennsieve custom extensions
  if (propertyForm.value.isKey) {
    property['x-pennsieve-key'] = true
  }
  
  if (propertyForm.value.isSensitive) {
    property['x-pennsieve-sensitive'] = true
  }

  // Emit save event with all the data needed
  emit('save', {
    propertyName: propertyForm.value.name,
    propertySchema: property,
    required: propertyForm.value.required,
    oldPropertyName: props.editingProperty
  })

  dialogVisible.value = false
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme' as theme;
@use '../../../../styles/element/dialog';
@use '../../../../styles/element/checkbox';
@use '../../../../styles/element/select';


// Global Element Plus error styling
:deep(.el-form-item__error) {
  color: theme.$red_2 !important;
}

.property-dialog {
  :deep(.el-dialog) {
    border-radius: 8px;
  }
  
  .property-form {
    max-height: 70vh;
    overflow-y: auto;
    
    .form-section {
      margin-bottom: 32px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: theme.$gray_6;
      margin: 0 0 20px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid theme.$purple_2;
      display: flex;
      align-items: center;
      
      &::before {
        content: '';
        width: 4px;
        height: 16px;
        background: theme.$purple_2;
        margin-right: 12px;
        border-radius: 2px;
      }
    }
    
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
      
      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }
    
    .constraints-content {
      padding: 20px;
      background-color: theme.$gray_1;
      //border-left: 4px solid theme.$purple_2;
      
      .constraint-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        
        @media (max-width: 640px) {
          grid-template-columns: 1fr;
        }
      }
    }
    
    .field-help {
      font-size: 12px;
      color: theme.$gray_4;
      margin-top: 4px;
      line-height: 1.1em;
    }
    
    .option-content {
      display: flex;
      flex-direction: column;
      
      .option-label {
        font-weight: 500;
        color: theme.$gray_6;
      }
      
      .option-description {
        font-size: 12px;
        color: theme.$gray_4;
        margin-top: 2px;
      }
    }
    
    .property-options {
      background-color: theme.$gray_1;
      padding: 20px;
      border-left: 4px solid theme.$green_2;
      margin-top: 20px;
      
      .options-title {
        margin: 0 0 16px 0;
        font-size: 14px;
        font-weight: 600;
        color: theme.$gray_6;
      }
      
      .options-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        
        @media (min-width: 768px) {
          grid-template-columns: repeat(3, 1fr);
        }
        
        // Smooth transition for conditional items
        .el-form-item {
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
      }
    }
  }

  // Disabled section styling for object types
  .disabled-section {
    opacity: 0.6;
    pointer-events: none;
    
    :deep(.el-form-item__label) {
      color: theme.$gray_4 !important;
    }
    
    :deep(.el-input__inner),
    :deep(.el-select .el-input__inner) {
      background-color: theme.$gray_1 !important;
      color: theme.$gray_4 !important;
    }
  }
  
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid theme.$gray_2;
  }
  
  // Enhanced form item styling
  :deep(.el-form-item) {
    margin-bottom: 20px;
    
    .el-form-item__label {
      font-weight: 500;
      color: theme.$gray_6;
      font-size: 14px;
    }
    
    .el-form-item__error {
      color: theme.$red_2;
    }
    
    .el-input, .el-select, .el-textarea {
      .el-input__inner, .el-textarea__inner {
        border: 1px solid theme.$gray_3;
        transition: all 0.2s ease;
        
        &:focus {
          border-color: theme.$purple_2;
          box-shadow: 0 0 0 2px rgba(71, 69, 255, 0.1);
        }
      }
    }
  }
  
  // Checkbox styling
  :deep(.el-checkbox) {
    .el-checkbox__label {
      font-weight: 500;
      color: theme.$gray_6;
    }
    
    .el-checkbox__inner {
      border-color: theme.$gray_3;
      
      &:hover {
        border-color: theme.$purple_2;
      }
    }
    
    &.is-checked .el-checkbox__inner {
      background-color: theme.$purple_2;
      border-color: theme.$purple_2;
    }
  }
  
  // Select dropdown styling
  :deep(.el-select-dropdown__item) {
    height: auto;
    line-height: normal;
    padding: 8px 12px;
    
    &:hover {
      background-color: theme.$gray_1;
    }
    
    &.selected {
      color: theme.$purple_2;
      font-weight: 500;
    }
  }
}

// Info note styling
.info-note {
  margin-bottom: 24px;
  
  :deep(.el-alert) {
    .el-alert__title {
      font-weight: 600;
      font-size: 14px;
    }
    
    .el-alert__content {
      font-size: 13px;
      line-height: 1.5;
      color: theme.$gray_5;
      margin-top: 4px;
    }
  }
}

// Custom dropdown styling to fix width issues
// Object template section styling
.object-template-section {
  background-color: theme.$gray_1;
  padding: 20px;
  border-left: 4px solid theme.$orange_2;
  margin-top: 20px;

  .template-section-title {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: theme.$gray_6;
  }

  .template-info {
    margin-bottom: 20px;

    :deep(.el-alert) {
      .el-alert__title {
        font-weight: 600;
        font-size: 14px;
      }

      .el-alert__content {
        font-size: 13px;
        line-height: 1.5;
        color: theme.$gray_5;
        margin-top: 4px;
      }
    }
  }

  .template-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    justify-content: flex-end;
  }
}

// Custom dropdown styling to fix width issues
:deep(.property-dialog-dropdown) {
  max-width: 320px !important;

  .el-select-dropdown__item {
    height: auto !important;
    line-height: normal !important;
    padding: 8px 12px !important;
    white-space: normal !important;

    &:hover {
      background-color: theme.$gray_1 !important;
    }

    &.selected {
      color: theme.$purple_2 !important;
      font-weight: 500 !important;
    }
  }

  .option-content {
    display: flex !important;
    flex-direction: column !important;

    .option-label {
      font-weight: 500 !important;
      color: theme.$gray_6 !important;
    }

    .option-description {
      font-size: 12px !important;
      color: theme.$gray_4 !important;
      margin-top: 2px !important;
    }
  }
}

</style>