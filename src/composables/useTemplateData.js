import { computed } from 'vue'

export function useTemplateData(props, template, currentVersionData, selectedVersion) {
  // Compute the template data to display
  const templateData = computed(() => {
    // If we're in preview mode (creating a new template), use preview data
    if (props.previewName || props.previewDisplayName) {
      return {
        name: props.previewName || 'New Template',
        display_name: props.previewDisplayName || props.previewName || 'New Template',
        description: props.previewDescription || '',
        latest_version: {
          version: '1.0.0',
          schema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      }
    }

    // If a specific version is selected and loaded, use that version's data
    if (currentVersionData.value && selectedVersion.value !== 'latest') {
      return {
        ...template.value,
        latest_version: currentVersionData.value
      }
    }

    // Otherwise, use the template's latest version
    if (template.value) {
      return template.value
    }

    // Fallback to empty structure
    return {
      name: '',
      display_name: '',
      description: '',
      latest_version: {
        version: '',
        schema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }
  })

  // Compute the schema to display (for JSON view)
  const displaySchema = computed(() => {
    if (!templateData.value || !templateData.value.latest_version) {
      return {}
    }

    const schema = templateData.value.latest_version.schema

    // Return the full schema for display
    return {
      $schema: schema.$schema || 'http://json-schema.org/draft-07/schema#',
      type: schema.type || 'object',
      title: templateData.value.display_name || templateData.value.name,
      description: templateData.value.description,
      properties: schema.properties || {},
      required: schema.required || [],
      // Include any additional schema properties
      ...Object.keys(schema).reduce((acc, key) => {
        if (!['$schema', 'type', 'title', 'description', 'properties', 'required'].includes(key)) {
          acc[key] = schema[key]
        }
        return acc
      }, {})
    }
  })

  return {
    templateData,
    displaySchema
  }
}