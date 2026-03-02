/**
 * Composable for property formatting and validation utilities
 * Used by ModelSpecViewer and related components for consistent property display
 */

export function usePropertyFormatting() {
  
  /**
   * Format property type for display (e.g., "string", "array<object>", "date")
   */
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

  /**
   * Get constraint information for a property (min/max, length, pattern, etc.)
   */
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

  /**
   * Get default or example value for a property
   */
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

  /**
   * Format a value for display (add quotes for strings, etc.)
   */
  const formatValue = (value) => {
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'boolean') return value ? 'true' : 'false'
    if (value === null) return 'null'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  /**
   * Format date string for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return '<TBD on creation>'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Property checking functions
  
  /**
   * Check if a property is required in the schema
   */
  const isRequired = (modelSchema, propertyName) => {
    return modelSchema.required?.includes(propertyName) || false
  }

  /**
   * Check if property is marked as a key field
   */
  const isKey = (property) => {
    return property['x-pennsieve-key'] === true
  }

  /**
   * Check if property is deprecated
   */
  const isDeprecated = (property) => {
    return property.deprecated === true
  }

  /**
   * Check if property is read-only
   */
  const isReadOnly = (property) => {
    return property.readOnly === true
  }

  /**
   * Check if property is write-only
   */
  const isWriteOnly = (property) => {
    return property.writeOnly === true
  }

  /**
   * Check if property contains sensitive data
   */
  const isSensitive = (property) => {
    return property['x-pennsieve-sensitive'] === true
  }

  /**
   * Check if property is a nested object with sub-properties
   */
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

  /**
   * Check for advanced JSON Schema features not displayed in Simple View
   */
  const hasHiddenFeatures = (property) => {
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

  return {
    // Formatting functions
    formatPropertyType,
    getConstraintInfo,
    getDefaultOrExample,
    formatValue,
    formatDate,
    
    // Property checking functions
    isRequired,
    isKey,
    isDeprecated,
    isReadOnly,
    isWriteOnly,
    isSensitive,
    isNestedObject,
    hasHiddenFeatures
  }
}