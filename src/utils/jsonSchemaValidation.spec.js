import { describe, it, expect } from 'vitest'
import { createSchemaValidator, errorFieldPath } from './jsonSchemaValidation'

describe('jsonSchemaValidation', () => {
  it('validates 2020-12 schemas with $defs, formats and if/then', () => {
    const validate = createSchemaValidator().compile({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $defs: { person: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } },
      type: 'object',
      properties: { owner: { $ref: '#/$defs/person' }, kind: { type: 'string' } },
      if: { properties: { kind: { const: 'a' } }, required: ['kind'] },
      then: { required: ['owner'] },
    })
    expect(validate({ kind: 'b' })).toBe(true)
    expect(validate({ kind: 'a' })).toBe(false)
    expect(validate({ owner: { email: 'nope' } })).toBe(false)
  })

  it('names an error\'s field as a dotted path', () => {
    expect(errorFieldPath({ instancePath: '/inputs/0/formats' })).toBe('inputs.0.formats')
    expect(errorFieldPath({ instancePath: '', schemaPath: '#/properties/name/type' })).toBe('name')
    expect(errorFieldPath({ instancePath: '' })).toBe('Root')
  })
})
