import {
  PARAM_TYPES,
  createApplicationSchema,
  createParameter,
  parseApplication,
  parseParameters,
  buildSchemaPayload,
  flattenParams,
  toParamSchema,
  extractDefaultParams,
  coerceParameterValue,
  validateParameterValue,
  validateParameters,
  arePortsCompatible,
  validateAppConnection,
  buildManifest,
  createPort,
  MANIFEST_SCHEMA_URL,
} from './applicationSchema'

describe('applicationSchema', () => {
  describe('parseParameters', () => {
    it('prefers the richer paramSchema when present', () => {
      const params = parseParameters({
        paramSchema: [
          { name: 'threshold', type: 'number', defaultValue: 5, required: true },
        ],
        params: { ignored: 'x' },
      })
      expect(params).toHaveLength(1)
      expect(params[0]).toMatchObject({
        name: 'threshold',
        type: PARAM_TYPES.NUMBER,
        defaultValue: 5,
        required: true,
      })
    })

    it('lifts a legacy flat params map into typed string parameters', () => {
      const params = parseParameters({ params: { mode: 'fast', empty: '' } })
      expect(params).toHaveLength(2)
      const mode = params.find((p) => p.name === 'mode')
      expect(mode.type).toBe(PARAM_TYPES.STRING)
      expect(mode.defaultValue).toBe('fast')
      // empty string default is normalized to null ("no default")
      expect(params.find((p) => p.name === 'empty').defaultValue).toBeNull()
    })

    it('infers enum from legacy validValues', () => {
      const [p] = parseParameters({
        paramSchema: [{ name: 'algo', validValues: ['a', 'b'] }],
      })
      expect(p.type).toBe(PARAM_TYPES.ENUM)
      expect(p.allowedValues).toEqual(['a', 'b'])
    })
  })

  describe('parseApplication', () => {
    it('normalizes runtimeConfig, gpu, computeTypes, tags, ports', () => {
      const schema = parseApplication({
        runtimeConfig: {
          cpu: 1024,
          memory: 2048,
          computeTypes: ['ecs', 'lambda'],
          gpu: { enabled: true, count: 2, type: 'nvidia-t4' },
        },
        inputs: [{ name: 'in', dataType: 'file', required: true }],
        outputs: [{ name: 'out', dataType: 'package' }],
        tags: ['mri'],
        categories: ['Segmentation'],
      })
      expect(schema.resources).toEqual({ cpu: 1024, memory: 2048 })
      // "ecs" is mapped to "standard"
      expect(schema.runtime.computeTypes).toEqual(['standard', 'lambda'])
      expect(schema.runtime.gpu).toEqual({ enabled: true, count: 2, type: 'nvidia-t4' })
      expect(schema.inputs[0]).toMatchObject({ name: 'in', dataType: 'file', required: true })
      expect(schema.outputs[0]).toMatchObject({ name: 'out', dataType: 'package' })
      expect(schema.tags).toEqual(['mri'])
      expect(schema.categories).toEqual(['Segmentation'])
    })

    it('defaults gracefully for a bare application', () => {
      const schema = parseApplication({})
      expect(schema.runtime.computeTypes).toEqual(['standard'])
      expect(schema.runtime.gpu.enabled).toBe(false)
      expect(schema.parameters).toEqual([])
    })
  })

  describe('buildSchemaPayload', () => {
    it('emits runtimeConfig, flat params, and richer paramSchema together', () => {
      const schema = createApplicationSchema({
        resources: { cpu: 2048, memory: 4096 },
        runtime: { computeTypes: ['standard'], gpu: { enabled: false } },
        parameters: [
          createParameter({ name: 'mode', type: PARAM_TYPES.STRING, defaultValue: 'fast' }),
          createParameter({ name: 'iters', type: PARAM_TYPES.NUMBER, required: true }),
        ],
      })
      const payload = buildSchemaPayload(schema)
      expect(payload.runtimeConfig).toMatchObject({ cpu: 2048, memory: 4096, computeTypes: ['standard'] })
      expect(payload.runtimeConfig.gpu).toBeUndefined()
      // flat params only include the param that actually has a default
      expect(payload.params).toEqual({ mode: 'fast' })
      expect(payload.paramSchema).toHaveLength(2)
      expect(payload.paramSchema[1]).toMatchObject({ name: 'iters', type: 'number', required: true })
    })

    it('includes gpu only when enabled', () => {
      const payload = buildSchemaPayload(
        createApplicationSchema({
          runtime: { computeTypes: ['standard'], gpu: { enabled: true, count: 4, type: 'a10g' } },
        }),
      )
      expect(payload.runtimeConfig.gpu).toEqual({ enabled: true, count: 4, type: 'a10g' })
    })

    it('drops empty inputs/outputs/tags/categories', () => {
      const payload = buildSchemaPayload(createApplicationSchema())
      expect(payload.inputs).toBeUndefined()
      expect(payload.tags).toBeUndefined()
      expect(payload.params).toBeUndefined()
    })

    it('round-trips parse -> build for parameters', () => {
      const original = {
        runtimeConfig: { cpu: 1024, memory: 2048, computeTypes: ['standard'] },
        paramSchema: [{ name: 'algo', type: 'enum', allowedValues: ['x', 'y'], defaultValue: 'x' }],
      }
      const rebuilt = buildSchemaPayload(parseApplication(original))
      expect(rebuilt.params).toEqual({ algo: 'x' })
      expect(rebuilt.paramSchema[0]).toMatchObject({ name: 'algo', type: 'enum', allowedValues: ['x', 'y'] })
    })
  })

  describe('flattenParams / extractDefaultParams', () => {
    it('omits params without a usable default', () => {
      const flat = flattenParams([
        createParameter({ name: 'a', defaultValue: 'v' }),
        createParameter({ name: 'b', defaultValue: null }),
        createParameter({ name: '', defaultValue: 'x' }),
      ])
      expect(flat).toEqual({ a: 'v' })
    })

    it('overlays workflow overrides on app defaults', () => {
      const params = [createParameter({ name: 'a', defaultValue: 'v' })]
      expect(extractDefaultParams(params, { a: 'override', b: '2' })).toEqual({ a: 'override', b: '2' })
    })
  })

  describe('toParamSchema', () => {
    it('produces the builder shape with undefined for missing defaults', () => {
      const out = toParamSchema([
        createParameter({ name: 'a', type: PARAM_TYPES.ENUM, allowedValues: ['x'], defaultValue: 'x' }),
        createParameter({ name: 'b', type: PARAM_TYPES.STRING, defaultValue: null }),
      ])
      expect(out[0]).toMatchObject({ name: 'a', validValues: ['x'], defaultValue: 'x' })
      expect(out[1].defaultValue).toBeUndefined()
      expect(out[1].validValues).toEqual([])
    })
  })

  describe('coerceParameterValue', () => {
    it('coerces by declared type', () => {
      expect(coerceParameterValue({ type: PARAM_TYPES.NUMBER }, '3.5')).toBe(3.5)
      expect(coerceParameterValue({ type: PARAM_TYPES.BOOLEAN }, 'true')).toBe(true)
      expect(coerceParameterValue({ type: PARAM_TYPES.BOOLEAN }, '0')).toBe(false)
      expect(coerceParameterValue({ type: PARAM_TYPES.STRING }, 5)).toBe('5')
      expect(coerceParameterValue({ type: PARAM_TYPES.NUMBER }, '')).toBeNull()
    })
  })

  describe('validateParameterValue', () => {
    it('enforces required, range and enum membership', () => {
      expect(validateParameterValue({ name: 'x', required: true }, '').valid).toBe(false)
      expect(validateParameterValue({ type: PARAM_TYPES.NUMBER, min: 0, max: 10 }, 5).valid).toBe(true)
      expect(validateParameterValue({ type: PARAM_TYPES.NUMBER, min: 0, max: 10 }, 99).valid).toBe(false)
      expect(validateParameterValue({ type: PARAM_TYPES.ENUM, allowedValues: ['a'] }, 'b').valid).toBe(false)
    })
  })

  describe('validateParameters', () => {
    it('flags duplicates, missing names, empty enums, and bad ranges', () => {
      const res = validateParameters([
        createParameter({ name: 'a', defaultValue: 'v' }),
        createParameter({ name: 'a' }),
        createParameter({ name: '' }),
        createParameter({ name: 'c', type: PARAM_TYPES.ENUM, allowedValues: [] }),
        createParameter({ name: 'd', type: PARAM_TYPES.NUMBER, min: 5, max: 1 }),
      ])
      expect(res.valid).toBe(false)
      expect(res.errors.join(' ')).toMatch(/Duplicate parameter name "a"/)
      expect(res.errors.join(' ')).toMatch(/missing a name/)
      expect(res.errors.join(' ')).toMatch(/no allowed values/)
      expect(res.errors.join(' ')).toMatch(/min is greater than max/)
    })

    it('passes a clean parameter list', () => {
      expect(validateParameters([createParameter({ name: 'a', defaultValue: 'v' })]).valid).toBe(true)
    })
  })

  describe('port compatibility', () => {
    it('matches on equal types or any', () => {
      expect(arePortsCompatible({ dataType: 'file' }, { dataType: 'file' })).toBe(true)
      expect(arePortsCompatible({ dataType: 'any' }, { dataType: 'file' })).toBe(true)
      expect(arePortsCompatible({ dataType: 'image' }, { dataType: 'file' })).toBe(false)
    })

    it('reports unmet required inputs when wiring two apps', () => {
      const source = { outputs: [{ name: 'o', dataType: 'file' }] }
      const target = { inputs: [{ name: 'i', dataType: 'image', required: true }] }
      const res = validateAppConnection(source, target)
      expect(res.compatible).toBe(false)
      expect(res.unmetInputs).toHaveLength(1)

      const ok = validateAppConnection(
        { outputs: [{ name: 'o', dataType: 'image' }] },
        target,
      )
      expect(ok.compatible).toBe(true)
    })
  })

  describe('buildManifest', () => {
    it('emits the $schema pointer and version, with name from meta', () => {
      const m = buildManifest(createApplicationSchema(), { name: 'My App' })
      expect(m.$schema).toBe(MANIFEST_SCHEMA_URL)
      expect(m.schemaVersion).toBe('1.0')
      expect(m.name).toBe('My App')
      // Always includes a runtime block with default compute types.
      expect(m.runtime.computeTypes).toEqual(['standard'])
    })

    it('keys parameter defaults as `default` (not defaultValue) and coerces by type', () => {
      const schema = createApplicationSchema({
        parameters: [
          createParameter({
            name: 'threshold',
            type: PARAM_TYPES.NUMBER,
            required: true,
            defaultValue: '5',
            min: 1,
            max: 20,
          }),
        ],
      })
      const m = buildManifest(schema, { name: 'X' })
      expect(m.parameters[0]).toMatchObject({
        name: 'threshold',
        type: 'number',
        required: true,
        default: 5,
        min: 1,
        max: 20,
      })
      expect(m.parameters[0]).not.toHaveProperty('defaultValue')
    })

    it('omits empty optional fields and unnamed parameters/ports', () => {
      const schema = createApplicationSchema({
        parameters: [createParameter({ name: '' })],
        inputs: [createPort({ name: 'in', dataType: 'image', required: true })],
        outputs: [createPort({ name: '' })],
      })
      const m = buildManifest(schema, {})
      expect(m).not.toHaveProperty('name')
      expect(m).not.toHaveProperty('parameters')
      expect(m).not.toHaveProperty('outputs')
      expect(m.inputs).toEqual([
        { name: 'in', dataType: 'image', required: true },
      ])
    })

    it('includes gpu only when enabled', () => {
      const off = buildManifest(createApplicationSchema(), { name: 'X' })
      expect(off.runtime).not.toHaveProperty('gpu')

      const schema = createApplicationSchema()
      schema.runtime.gpu = { enabled: true, count: 2, type: 'nvidia-t4' }
      const on = buildManifest(schema, { name: 'X' })
      expect(on.runtime.gpu).toEqual({ enabled: true, count: 2, type: 'nvidia-t4' })
    })
  })
})
