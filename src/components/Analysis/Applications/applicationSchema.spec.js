import {
  PARAM_TYPES,
  createApplicationSchema,
  createParameter,
  parseApplication,
  parseParameters,
  buildSchemaPayload,
  flattenParams,
  toParamSchema,
  portDataTypeOptions,
  extractDefaultParams,
  coerceParameterValue,
  validateParameterValue,
  validateParameters,
  arePortsCompatible,
  validateAppConnection,
  buildManifest,
  manifestToYaml,
  serializeManifestYaml,
  parseManifest,
  createPort,
  MANIFEST_SHAPES,
  detectManifestShape,
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

    it('treats a parameter with validValues as a choice, whatever its type', () => {
      const [untyped] = parseParameters({
        paramSchema: [{ name: 'algo', validValues: ['a', 'b'] }],
      })
      expect(untyped.type).toBe(PARAM_TYPES.ENUM)
      expect(untyped.validValues).toEqual(['a', 'b'])

      // The canonical manifest writes a dropdown as `type: string` with
      // validValues, so an explicit string type must not suppress it.
      const [stringy] = parseParameters({
        paramSchema: [{ name: 'mode', type: 'string', validValues: ['fast'] }],
      })
      expect(stringy.type).toBe(PARAM_TYPES.ENUM)

      // A number keeps its type and still carries its choices.
      const [numeric] = parseParameters({
        paramSchema: [{ name: 'threshold', type: 'number', validValues: ['0.1'] }],
      })
      expect(numeric.type).toBe(PARAM_TYPES.NUMBER)
      expect(numeric.validValues).toEqual(['0.1'])
    })

    it('treats a parameter with no default as required', () => {
      const [needed] = parseParameters({ paramSchema: [{ name: 'channel', type: 'string' }] })
      expect(needed.required).toBe(true)

      const [defaulted] = parseParameters({
        paramSchema: [{ name: 'mode', type: 'string', defaultValue: 'fast' }],
      })
      expect(defaulted.required).toBe(false)

      // An explicit flag still wins over the inference.
      const [explicit] = parseParameters({
        paramSchema: [{ name: 'channel', type: 'string', required: false }],
      })
      expect(explicit.required).toBe(false)
    })

    it('reads the legacy `allowedValues` / `default` keys', () => {
      const [p] = parseParameters({
        paramSchema: [{ name: 'algo', allowedValues: ['a'], default: 'a' }],
      })
      expect(p.validValues).toEqual(['a'])
      expect(p.defaultValue).toBe('a')
    })
  })

  describe('parseApplication', () => {
    it('normalizes runtimeConfig, computeTypes, tags, ports', () => {
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
      // "ecs" is mapped to "standard", and a legacy gpu block becomes the
      // "gpu" compute type rather than a capability of its own.
      expect(schema.runtime.computeTypes).toEqual(['standard', 'lambda', 'gpu'])
      expect(schema.runtime).not.toHaveProperty('gpu')
      expect(schema.inputs[0]).toMatchObject({ name: 'in', dataType: 'file', required: true })
      expect(schema.outputs[0]).toMatchObject({ name: 'out', dataType: 'package' })
      expect(schema.tags).toEqual(['mri'])
      expect(schema.categories).toEqual(['Segmentation'])
    })

    it('defaults gracefully for a bare application', () => {
      const schema = parseApplication({})
      expect(schema.runtime.computeTypes).toEqual(['standard'])
      expect(schema.parameters).toEqual([])
    })

    it('reads a bare boolean or count gpu as the gpu compute type', () => {
      expect(
        parseApplication({ runtimeConfig: { computeTypes: ['standard'], gpu: true } })
          .runtime.computeTypes,
      ).toEqual(['standard', 'gpu'])
      expect(
        parseApplication({ runtimeConfig: { gpu: 2 } }).runtime.computeTypes,
      ).toEqual(['gpu'])
      expect(
        parseApplication({ runtimeConfig: { computeTypes: ['gpu'], gpu: { enabled: true } } })
          .runtime.computeTypes,
      ).toEqual(['gpu'])
    })
  })

  describe('buildSchemaPayload', () => {
    it('emits runtimeConfig, flat params, and richer paramSchema together', () => {
      const schema = createApplicationSchema({
        resources: { cpu: 2048, memory: 4096 },
        runtime: { computeTypes: ['standard'] },
        parameters: [
          createParameter({ name: 'mode', type: PARAM_TYPES.STRING, defaultValue: 'fast' }),
          createParameter({ name: 'iters', type: PARAM_TYPES.NUMBER, required: true }),
        ],
      })
      const payload = buildSchemaPayload(schema)
      expect(payload.runtimeConfig).toMatchObject({ cpu: 2048, memory: 4096, computeTypes: ['standard'] })
      // flat params only include the param that actually has a default
      expect(payload.params).toEqual({ mode: 'fast' })
      expect(payload.paramSchema).toHaveLength(2)
      expect(payload.paramSchema[1]).toMatchObject({ name: 'iters', type: 'number', required: true })
    })

    it('carries gpu as a compute type, with no separate gpu block', () => {
      const payload = buildSchemaPayload(
        createApplicationSchema({ runtime: { computeTypes: ['standard', 'gpu'] } }),
      )
      expect(payload.runtimeConfig.computeTypes).toEqual(['standard', 'gpu'])
      expect(payload.runtimeConfig).not.toHaveProperty('gpu')
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
        paramSchema: [{ name: 'algo', type: 'enum', validValues: ['x', 'y'], defaultValue: 'x' }],
      }
      const rebuilt = buildSchemaPayload(parseApplication(original))
      expect(rebuilt.params).toEqual({ algo: 'x' })
      expect(rebuilt.paramSchema[0]).toMatchObject({ name: 'algo', type: 'enum', validValues: ['x', 'y'] })
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
        createParameter({ name: 'a', type: PARAM_TYPES.ENUM, validValues: ['x'], defaultValue: 'x' }),
        createParameter({ name: 'b', type: PARAM_TYPES.STRING, defaultValue: null }),
      ])
      expect(out[0]).toMatchObject({ name: 'a', validValues: ['x'], defaultValue: 'x' })
      expect(out[1].defaultValue).toBeUndefined()
      expect(out[1].validValues).toEqual([])
    })
  })

  describe('portDataTypeOptions', () => {
    const served = [
      { value: 'TimeSeries', label: 'Time Series' },
      { value: 'Tabular', label: 'Tabular' },
    ]

    it('offers "any" plus the package types the platform reports', () => {
      expect(portDataTypeOptions(served)).toEqual([
        { value: 'any', label: 'Any' },
        { value: 'TimeSeries', label: 'Time Series' },
        { value: 'Tabular', label: 'Tabular' },
      ])
    })

    it('keeps a type the manifest already declares but the server does not list', () => {
      // Otherwise opening an older app.yml would blank its port on save.
      const values = portDataTypeOptions(served, ['Slide', 'Tabular']).map((o) => o.value)
      expect(values).toEqual(['any', 'TimeSeries', 'Tabular', 'Slide'])
    })

    it('falls back to "any" alone before the packages call lands', () => {
      expect(portDataTypeOptions(undefined)).toEqual([{ value: 'any', label: 'Any' }])
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
      expect(validateParameterValue({ type: PARAM_TYPES.ENUM, validValues: ['a'] }, 'b').valid).toBe(false)
      // Choices bind on any type, not just enum.
      expect(validateParameterValue({ type: PARAM_TYPES.NUMBER, validValues: ['0.1'] }, '0.2').valid).toBe(false)
      expect(validateParameterValue({ type: PARAM_TYPES.NUMBER, validValues: ['0.1'] }, '0.1').valid).toBe(true)
    })
  })

  describe('validateParameters', () => {
    it('flags duplicates, missing names, empty enums, and bad ranges', () => {
      const res = validateParameters([
        createParameter({ name: 'a', defaultValue: 'v' }),
        createParameter({ name: 'a' }),
        createParameter({ name: '' }),
        createParameter({ name: 'c', type: PARAM_TYPES.ENUM, validValues: [] }),
        createParameter({ name: 'd', type: PARAM_TYPES.NUMBER, min: 5, max: 1 }),
      ])
      expect(res.valid).toBe(false)
      expect(res.errors.join(' ')).toMatch(/Duplicate parameter name "a"/)
      expect(res.errors.join(' ')).toMatch(/missing a name/)
      expect(res.errors.join(' ')).toMatch(/no valid values/)
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

    it('compares media types when both ports declare them', () => {
      // The backend manifest describes ports by mediaTypes, not dataType, so
      // without this both sides would fall back to `any` and always match.
      const nifti = { mediaTypes: ['application/x-nifti'] }
      const zarr = { mediaTypes: ['application/zarr'] }
      expect(arePortsCompatible(nifti, nifti)).toBe(true)
      expect(arePortsCompatible(nifti, zarr)).toBe(false)
      expect(
        arePortsCompatible({ mediaTypes: ['a/b', 'application/zarr'] }, zarr),
      ).toBe(true)
    })

    it('treats octet-stream and */* as wildcards', () => {
      // The generic pipeline port real manifests use — must not warn.
      expect(
        arePortsCompatible(
          { mediaTypes: ['application/octet-stream'] },
          { mediaTypes: ['application/x-nifti'] },
        ),
      ).toBe(true)
      expect(
        arePortsCompatible({ mediaTypes: ['image/png'] }, { mediaTypes: ['*/*'] }),
      ).toBe(true)
    })

    it('falls back to dataType when only one side declares media types', () => {
      expect(
        arePortsCompatible({ mediaTypes: ['image/png'] }, { dataType: 'any' }),
      ).toBe(true)
      expect(
        arePortsCompatible({ dataType: 'image' }, { mediaTypes: ['image/png'] }),
      ).toBe(true)
    })

    it('flags unmet inputs across two real manifest-shaped apps', () => {
      const source = { outputs: [{ name: 'out', mediaTypes: ['application/zarr'] }] }
      const target = {
        inputs: [
          { name: 'scan', mediaTypes: ['application/x-nifti'], required: true },
          { name: 'opt', mediaTypes: ['application/zarr'], required: false },
        ],
      }
      const res = validateAppConnection(source, target)
      expect(res.compatible).toBe(false)
      expect(res.reason).toBe('unmet-required')
      expect(res.unmetInputs.map((i) => i.name)).toEqual(['scan'])
    })

    it('flags an edge whose media types do not overlap, with no required input', () => {
      // app.yml declares no `required` flag, so every manifest-shaped input
      // parses as optional. Judging required inputs alone passed every edge.
      const source = { outputs: [{ name: 'out', mediaTypes: ['application/zarr'] }] }
      const target = {
        inputs: [{ name: 'scan', mediaTypes: ['application/x-nifti'] }],
      }
      const res = validateAppConnection(source, target)
      expect(res.compatible).toBe(false)
      expect(res.reason).toBe('no-overlap')
      expect(res.unmetInputs.map((i) => i.name)).toEqual(['scan'])
    })

    it('passes when one optional input of several matches', () => {
      const source = { outputs: [{ name: 'out', mediaTypes: ['application/zarr'] }] }
      const target = {
        inputs: [
          { name: 'scan', mediaTypes: ['application/x-nifti'] },
          { name: 'archive', mediaTypes: ['application/zarr'] },
        ],
      }
      expect(validateAppConnection(source, target).compatible).toBe(true)
    })

    it('does not judge an edge when either side declares no ports', () => {
      const zarr = { mediaTypes: ['application/zarr'] }
      expect(
        validateAppConnection({ outputs: [] }, { inputs: [{ name: 'i', ...zarr }] })
          .compatible,
      ).toBe(true)
      expect(
        validateAppConnection({ outputs: [{ name: 'o', ...zarr }] }, { inputs: [] })
          .compatible,
      ).toBe(true)
    })

    it('passes the generic octet-stream pipeline ports the reference manifest uses', () => {
      const port = { mediaTypes: ['application/octet-stream'] }
      const res = validateAppConnection(
        { outputs: [{ name: 'package', ...port }] },
        { inputs: [{ name: 'package', ...port }] },
      )
      expect(res.compatible).toBe(true)
    })

    it('names the inputs a match landed on, for positive feedback', () => {
      const source = { outputs: [{ name: 'out', mediaTypes: ['application/zarr'] }] }
      const target = {
        inputs: [
          { name: 'archive', mediaTypes: ['application/zarr'] },
          { name: 'scan', mediaTypes: ['application/x-nifti'] },
        ],
      }
      const res = validateAppConnection(source, target)
      expect(res.compatible).toBe(true)
      expect(res.metInputs.map((i) => i.name)).toEqual(['archive'])
    })

    it('reports no matched inputs when a side declares no ports', () => {
      // "Nothing to judge" must not be dressed up as a confirmed match.
      const res = validateAppConnection(
        { outputs: [] },
        { inputs: [{ name: 'i', mediaTypes: ['application/zarr'] }] },
      )
      expect(res.compatible).toBe(true)
      expect(res.metInputs).toEqual([])
    })
  })

  describe('buildManifest', () => {
    it('emits the version and metadata under `application`, with no $schema', () => {
      const m = buildManifest(createApplicationSchema(), {
        name: 'My App',
        description: 'Does things.',
        applicationType: 'processor',
      })
      expect(m).not.toHaveProperty('$schema')
      expect(m.schemaVersion).toBe('1.0')
      expect(m.application).toEqual({
        name: 'My App',
        description: 'Does things.',
        type: 'processor',
      })
      expect(m).not.toHaveProperty('name')
      // Always includes a runtime block with default compute types.
      expect(m.runtime.computeTypes).toEqual(['standard'])
    })

    it('puts cpu/memory on `runtime`, not in a `resources` block', () => {
      const m = buildManifest(
        createApplicationSchema({
          resources: { cpu: 1024, memory: 2048 },
          runtime: { computeTypes: ['gpu'] },
        }),
        { name: 'X' },
      )
      expect(m.runtime).toEqual({ cpu: 1024, memory: 2048, computeTypes: ['gpu'] })
      expect(m).not.toHaveProperty('resources')
    })

    it('writes parameters in the canonical defaultValue / validValues form', () => {
      const schema = createApplicationSchema({
        parameters: [
          createParameter({
            name: 'threshold',
            type: PARAM_TYPES.NUMBER,
            defaultValue: '0.5',
            validValues: ['0.1', '0.5', '0.9'],
            min: 1,
            max: 20,
          }),
          // A choice parameter is a string carrying validValues — the manifest
          // has no `enum` type.
          createParameter({
            name: 'mode',
            type: PARAM_TYPES.ENUM,
            defaultValue: 'fast',
            validValues: ['fast', 'accurate'],
          }),
          createParameter({ name: 'verbose', type: PARAM_TYPES.BOOLEAN, defaultValue: false }),
          // No default: required is implied, so it is not written out.
          createParameter({ name: 'channel', type: PARAM_TYPES.STRING, required: true }),
        ],
      })
      const m = buildManifest(schema, { name: 'X' })

      expect(m.parameters[0]).toMatchObject({
        name: 'threshold',
        type: 'number',
        defaultValue: '0.5',
        validValues: ['0.1', '0.5', '0.9'],
        min: 1,
        max: 20,
      })
      expect(m.parameters[1]).toMatchObject({
        name: 'mode',
        type: 'string',
        defaultValue: 'fast',
        validValues: ['fast', 'accurate'],
      })
      expect(m.parameters[2]).toMatchObject({ name: 'verbose', defaultValue: 'false' })
      expect(m.parameters[3]).toMatchObject({ name: 'channel', type: 'string' })

      // `required` is implied by the presence (or not) of a default, so it is
      // only written when the parameter contradicts that.
      m.parameters.forEach((p) => expect(p).not.toHaveProperty('required'))
      m.parameters.forEach((p) => expect(p).not.toHaveProperty('default'))
      m.parameters.forEach((p) => expect(p).not.toHaveProperty('allowedValues'))
    })

    it('writes `required` only when it contradicts the default', () => {
      const m = buildManifest(
        createApplicationSchema({
          parameters: [
            // Optional despite having no default.
            createParameter({ name: 'a', type: PARAM_TYPES.STRING, required: false }),
            // Required despite having one.
            createParameter({
              name: 'b',
              type: PARAM_TYPES.STRING,
              required: true,
              defaultValue: 'x',
            }),
          ],
        }),
        { name: 'X' },
      )
      expect(m.parameters[0].required).toBe(false)
      expect(m.parameters[1].required).toBe(true)
    })

    it('omits empty optional fields and unnamed parameters/ports', () => {
      const schema = createApplicationSchema({
        parameters: [createParameter({ name: '' })],
        inputs: [createPort({ name: 'in', dataType: 'image', required: true })],
        outputs: [createPort({ name: '' })],
      })
      const m = buildManifest(schema, {})
      expect(m).not.toHaveProperty('application')
      expect(m).not.toHaveProperty('parameters')
      expect(m).not.toHaveProperty('outputs')
      expect(m.inputs).toEqual([
        { name: 'in', dataType: 'image', required: true },
      ])
    })

    it('never writes a standalone gpu block', () => {
      const m = buildManifest(
        createApplicationSchema({ runtime: { computeTypes: ['standard', 'gpu'] } }),
        { name: 'X' },
      )
      expect(m.runtime.computeTypes).toEqual(['standard', 'gpu'])
      expect(m.runtime).not.toHaveProperty('gpu')
    })
  })

  describe('manifestToYaml', () => {
    it('never writes $schema as a data key', () => {
      const yaml = manifestToYaml(buildManifest(createApplicationSchema(), { name: 'X' }))
      expect(yaml).not.toMatch(/^\$schema:/m)
      expect(yaml).toMatch(/^ {2}name: X$/m)
    })

    it('emits a $schema carried by the manifest as a yaml-language-server directive', () => {
      const yaml = manifestToYaml({ $schema: 'https://example.test/s.json', schemaVersion: '1.0' })
      expect(yaml.startsWith('# yaml-language-server: $schema=https://example.test/s.json\n')).toBe(true)
      expect(yaml).not.toMatch(/^\$schema:/m)
    })
  })

  describe('parseManifest (round-trip)', () => {
    it('parses YAML text back into meta + editable schema', () => {
      const yaml = [
        'schemaVersion: "1.0"',
        'name: Spike Sorter',
        'description: Sorts spikes.',
        'applicationType: preprocessor',
        'categories:',
        '  - Preprocessing',
        'runtime:',
        '  computeTypes:',
        '    - standard',
        '  gpu:',
        '    enabled: true',
        '    count: 2',
        '    type: nvidia-t4',
        'resources:',
        '  cpu: 4096',
        '  memory: 16384',
        'parameters:',
        '  - name: threshold',
        '    type: number',
        '    required: true',
        '    default: 5',
        '    min: 1',
        '    max: 20',
        'inputs:',
        '  - name: recording',
        '    dataType: timeseries',
        '    required: true',
      ].join('\n')

      const { meta, schema } = parseManifest(yaml)
      expect(meta).toMatchObject({
        name: 'Spike Sorter',
        description: 'Sorts spikes.',
        applicationType: 'preprocessor',
        shape: MANIFEST_SHAPES.FLAT,
      })
      expect(schema.resources).toEqual({ cpu: 4096, memory: 16384 })
      // The legacy gpu block folds into the compute types.
      expect(schema.runtime.computeTypes).toEqual(['standard', 'gpu'])
      expect(schema.categories).toEqual(['Preprocessing'])
      // Manifest `default` maps back onto the editable `defaultValue`.
      expect(schema.parameters[0]).toMatchObject({
        name: 'threshold',
        type: 'number',
        required: true,
        defaultValue: 5,
        min: 1,
        max: 20,
      })
      expect(schema.inputs[0]).toMatchObject({
        name: 'recording',
        dataType: 'timeseries',
        required: true,
      })
    })

    it('round-trips serialize -> parse without loss of meaningful fields', () => {
      const original = createApplicationSchema({
        resources: { cpu: 2048, memory: 8192 },
        runtime: { computeTypes: ['standard', 'gpu'] },
        parameters: [
          createParameter({
            name: 'sorter',
            type: PARAM_TYPES.ENUM,
            defaultValue: 'kilosort',
            validValues: ['kilosort', 'mountainsort'],
          }),
        ],
        inputs: [createPort({ name: 'recording', dataType: 'timeseries', required: true })],
        outputs: [createPort({ name: 'units', dataType: 'package' })],
        tags: ['ephys'],
        categories: ['Preprocessing'],
      })
      const meta = { name: 'Spike Sorter', description: 'Sorts spikes.', applicationType: 'processor' }

      const yaml = serializeManifestYaml(original, meta)
      const parsed = parseManifest(yaml)

      expect(parsed.meta).toMatchObject(meta)
      // The re-serialized manifest object should be identical to the first.
      expect(buildManifest(parsed.schema, parsed.meta)).toEqual(
        buildManifest(original, meta),
      )
    })

    it('accepts an already-parsed object and falls back to defaults on partial input', () => {
      const { meta, schema } = parseManifest({ name: 'Only A Name' })
      expect(meta).toMatchObject({
        name: 'Only A Name',
        description: '',
        applicationType: 'processor',
      })
      expect(schema.runtime.computeTypes).toEqual(['standard'])
      expect(schema.parameters).toEqual([])
    })
  })
  /*
    The shape the backend actually serves in assets["app.yml"]. Verbatim from
    GET /applications/store/3da0ad0a-9cc0-4c22-94aa-2204eb41a77a so the fixture
    stays honest about what we have to read.
  */
  describe('parseManifest (nested backend shape)', () => {
    const NESTED_YAML = [
      '# yaml-language-server: $schema=./pennsieve-app-schema.json',
      'schemaVersion: 1.0.0',
      'application:',
      '  id: test-private-repo-3',
      '  name: test-private-repo-3',
      '  description: A private test app.',
      '  version: 1.0.1',
      '  type: processor',
      '  maintainers:',
      '    - name: edmore',
      '  tags:',
      '    - demo',
      'runtime:',
      '  cpu: 1024',
      '  memory: 2048',
      '  computeTypes:',
      '    - standard',
      '  timeoutSeconds: 300',
      'parameters:',
      '  - name: threshold',
      '    type: number',
      '    description: Detection threshold.',
      '    defaultValue: "0.5"',
      '    validValues:',
      '      - "0.1"',
      '      - "0.5"',
      '      - "0.9"',
      'commandArguments: []',
      'inputs:',
      '  - name: package_file',
      '    description: Pipeline package file.',
      '    mediaTypes:',
      '      - application/octet-stream',
      '    cardinality: one',
      '    required: true',
      'outputs:',
      '  - name: package_file',
      '    description: Pipeline package file.',
      '    mediaTypes:',
      '      - application/octet-stream',
    ].join('\n')

    it('detects the shape from the presence of an `application` mapping', () => {
      expect(detectManifestShape({ application: { name: 'x' } })).toBe(MANIFEST_SHAPES.NESTED)
      expect(detectManifestShape({ name: 'x' })).toBe(MANIFEST_SHAPES.FLAT)
      // An `application` that isn't a mapping must not be treated as nested.
      expect(detectManifestShape({ application: ['x'] })).toBe(MANIFEST_SHAPES.FLAT)
      expect(detectManifestShape(null)).toBe(MANIFEST_SHAPES.FLAT)
    })

    it('lifts metadata out of `application`', () => {
      const { meta } = parseManifest(NESTED_YAML)
      expect(meta).toMatchObject({
        name: 'test-private-repo-3',
        description: 'A private test app.',
        applicationType: 'processor',
        id: 'test-private-repo-3',
        version: '1.0.1',
        schemaVersion: '1.0.0',
        timeoutSeconds: 300,
        shape: MANIFEST_SHAPES.NESTED,
      })
      expect(meta.maintainers).toEqual([{ name: 'edmore', email: '' }])
    })

    it('reads cpu/memory off `runtime` rather than `resources`', () => {
      const { schema } = parseManifest(NESTED_YAML)
      expect(schema.resources).toEqual({ cpu: 1024, memory: 2048 })
      expect(schema.runtime.computeTypes).toEqual(['standard'])
    })

    it('honours `defaultValue` and `validValues` on parameters', () => {
      const { schema } = parseManifest(NESTED_YAML)
      expect(schema.parameters).toHaveLength(1)
      expect(schema.parameters[0]).toMatchObject({
        name: 'threshold',
        type: 'number',
        defaultValue: '0.5',
        validValues: ['0.1', '0.5', '0.9'],
        // It has a default, so it is not required.
        required: false,
      })
    })

    it('retains mediaTypes and cardinality on ports', () => {
      const { schema } = parseManifest(NESTED_YAML)
      expect(schema.inputs[0]).toMatchObject({
        name: 'package_file',
        mediaTypes: ['application/octet-stream'],
        cardinality: 'one',
        required: true,
      })
      expect(schema.outputs[0]).toMatchObject({
        name: 'package_file',
        mediaTypes: ['application/octet-stream'],
        required: false,
      })
    })

    it('takes tags from `application`', () => {
      const { schema } = parseManifest(NESTED_YAML)
      expect(schema.tags).toEqual(['demo'])
    })
  })

  /*
    The parameter form the platform actually publishes: `defaultValue` and
    `validValues` as strings, types limited to string/number/boolean, and no
    `required` key — a parameter without a default is required by definition.
    Reading it and writing it back must both land on exactly this shape.
  */
  describe('canonical parameter form', () => {
    const CANONICAL = [
      'schemaVersion: "1.0"',
      'name: Demo',
      'parameters:',
      '  - name: threshold',
      '    type: number',
      '    description: Detection threshold.',
      '    defaultValue: "0.5"',
      '    validValues:',
      '      - "0.1"',
      '      - "0.5"',
      '      - "0.9"',
      '  - name: mode',
      '    type: string',
      '    description: Processing mode.',
      '    defaultValue: fast',
      '    validValues:',
      '      - fast',
      '      - accurate',
      '  - name: verbose',
      '    type: boolean',
      '    description: Enable verbose logging.',
      '    defaultValue: "false"',
      '  - name: channel',
      '    type: string',
      '    description: Channel to analyze (no default, treated as required).',
    ].join('\n')

    it('reads it', () => {
      const { schema } = parseManifest(CANONICAL)
      expect(
        schema.parameters.map((p) => ({
          name: p.name,
          type: p.type,
          required: p.required,
          defaultValue: p.defaultValue,
          validValues: p.validValues,
        })),
      ).toEqual([
        {
          name: 'threshold',
          type: PARAM_TYPES.NUMBER,
          required: false,
          defaultValue: '0.5',
          validValues: ['0.1', '0.5', '0.9'],
        },
        {
          // `string` + validValues is a dropdown; the editable model calls
          // that an enum, and writes it back out as a string.
          name: 'mode',
          type: PARAM_TYPES.ENUM,
          required: false,
          defaultValue: 'fast',
          validValues: ['fast', 'accurate'],
        },
        {
          name: 'verbose',
          type: PARAM_TYPES.BOOLEAN,
          required: false,
          defaultValue: 'false',
          validValues: [],
        },
        {
          name: 'channel',
          type: PARAM_TYPES.STRING,
          required: true,
          defaultValue: null,
          validValues: [],
        },
      ])
    })

    it('writes it back unchanged', () => {
      const { meta, schema } = parseManifest(CANONICAL)
      expect(buildManifest(schema, meta).parameters).toEqual([
        {
          name: 'threshold',
          type: 'number',
          description: 'Detection threshold.',
          defaultValue: '0.5',
          validValues: ['0.1', '0.5', '0.9'],
        },
        {
          name: 'mode',
          type: 'string',
          description: 'Processing mode.',
          defaultValue: 'fast',
          validValues: ['fast', 'accurate'],
        },
        {
          name: 'verbose',
          type: 'boolean',
          description: 'Enable verbose logging.',
          defaultValue: 'false',
        },
        {
          name: 'channel',
          type: 'string',
          description: 'Channel to analyze (no default, treated as required).',
        },
      ])
    })

    it('hands the Workflow Builder a dropdown for every choice parameter', () => {
      const { schema } = parseManifest(CANONICAL)
      const byName = Object.fromEntries(
        toParamSchema(schema.parameters).map((p) => [p.name, p]),
      )
      // The number parameter carries choices too — the builder must not lose
      // them just because the type is not "enum".
      expect(byName.threshold.validValues).toEqual(['0.1', '0.5', '0.9'])
      expect(byName.mode.validValues).toEqual(['fast', 'accurate'])
      expect(byName.verbose.validValues).toEqual([])
      // No default reaches the builder as "required at run".
      expect(byName.channel).toMatchObject({ required: true, defaultValue: undefined })
    })
  })
})
