/**
 * Composable for extracting and formatting record key properties
 * based on model schema x-pennsieve-key markers
 */
import { useMetadataStore } from '@/stores/metadataStore'

export function useRecordKeyProperties() {
  const metadataStore = useMetadataStore()

  /**
   * Get only the key properties from a record based on model schema
   * @param {Object} record - The record object
   * @returns {Object} Object with only key properties
   */
  const getKeyProperties = (record) => {
    const model = metadataStore.models.find(m => m.id === record.model_id)
    
    // Get schema from model.schema or model.latest_version.schema
    const schema = model?.schema || model?.latest_version?.schema
    
    if (!schema || !schema.properties) {
      return {}
    }
    
    const keyProperties = {}
    const recordValue = record.value || {}
    
    // Find properties marked with x-pennsieve-key: true
    Object.entries(schema.properties).forEach(([propertyName, propertySchema]) => {
      if (propertySchema['x-pennsieve-key'] === true && recordValue[propertyName] !== undefined) {
        keyProperties[propertyName] = recordValue[propertyName]
      }
    })
    return keyProperties
  }

  /**
   * Format record key-value pairs for display in a single line
   * @param {Object} record - The record object
   * @returns {String} Formatted key-value string
   */
  const formatRecordKeyValues = (record) => {
    const keyProperties = getKeyProperties(record)
    const keyEntries = Object.entries(keyProperties)
    
    if (keyEntries.length === 0) {
      // Fallback to truncated record ID if no key properties
      return record.id ? record.id.substring(0, 8) + '...' : 'Record'
    }
    
    // Format as "key1: value1, key2: value2"
    return keyEntries.map(([key, value]) => `${key}: ${value}`).join(', ')
  }

  /**
   * Check if record has key properties to display
   * @param {Object} record - The record object
   * @returns {Boolean} Whether record has key properties
   */
  const hasKeyProperties = (record) => {
    const keyProperties = getKeyProperties(record)
    return Object.keys(keyProperties).length > 1 // More than just the title property
  }

  /**
   * Get a concise title for a record from the first key property
   * @param {Object} record - The record object
   * @returns {String} Record title
   */
  const getRecordTitle = (record) => {
    const keyProperties = getKeyProperties(record)
    const keyEntries = Object.entries(keyProperties)
    
    if (keyEntries.length > 0) {
      const [firstKey, firstValue] = keyEntries[0]
      return firstValue
    }
    
    // Fallback to truncated record ID
    return record.id ? record.id.substring(0, 8) + '...' : 'Record'
  }

  return {
    getKeyProperties,
    formatRecordKeyValues,
    hasKeyProperties,
    getRecordTitle
  }
}