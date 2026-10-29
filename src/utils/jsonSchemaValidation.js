// JSON Schema validation, shared by metadata records (RecordSpecGenerator) and
// app.yml (Analysis/Applications/manifestValidation): one Ajv setup, and one
// way of naming the field an error is about.
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

/**
 * An Ajv instance for our schemas. They declare JSON Schema 2020-12 but only
 * use keywords Ajv's default draft also has ($defs, if/then, const, …), so
 * the schema's own $schema isn't checked.
 */
export function createSchemaValidator() {
  const ajv = new Ajv({
    allErrors: true,
    strict: false, // Allow unknown keywords like $schema
    validateSchema: false, // Skip schema validation to avoid draft issues
    loadSchema: false, // Don't try to load external schemas
    addUsedSchema: false, // Don't add schemas to internal storage
    missingRefs: 'ignore', // Ignore missing references instead of throwing errors
  })
  // Try to add formats, but don't fail if it doesn't work
  try {
    if (typeof addFormats === 'function') addFormats(ajv)
  } catch (error) {
    console.warn('Could not add AJV formats, proceeding without formats:', error)
  }
  return ajv
}

/** The field an Ajv error is about, as a dotted path ("inputs.0.formats"), or "Root". */
export function errorFieldPath(error) {
  if (error?.instancePath) {
    return error.instancePath.replace(/^\//, '').replace(/\//g, '.')
  }
  if (error?.schemaPath && error.schemaPath.includes('/properties/')) {
    const match = error.schemaPath.match(/\/properties\/([^/]+)/)
    return match ? match[1] : 'Root'
  }
  return 'Root'
}
