/*
  Guards the contract between what buildManifest() writes and the JSON Schema
  we publish at MANIFEST_SCHEMA_URL — the file authors' editors validate their
  app.yml against. These drifted apart once already (the schema rejected the
  very form the platform publishes), and nothing else catches it: the schema is
  a static asset, not imported by any code path.
*/
import fs from 'node:fs'
import path from 'node:path'
// The schema declares draft 2020-12, which is ajv's `2020` entry point.
import Ajv from 'ajv/dist/2020'

import {
  createApplicationSchema,
  createParameter,
  createPort,
  buildManifest,
  parseManifest,
  manifestToYaml,
  PARAM_TYPES,
} from './applicationSchema'

const schemaPath = path.resolve(
  process.cwd(),
  'public/static/schemas/app-manifest.v1.json',
)
const jsonSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))

// `deprecated` is an annotation; strict mode still objects to $ref siblings.
const ajv = new Ajv({ strict: false, allErrors: true })
const validate = ajv.compile(jsonSchema)

const check = (manifest) => {
  // $schema is emitted as a yaml-language-server directive, not a data key.
  const { $schema, ...body } = manifest
  const ok = validate(body)
  return { ok, errors: validate.errors }
}

const FULL = createApplicationSchema({
  resources: { cpu: 4096, memory: 16384 },
  runtime: { computeTypes: ['standard', 'gpu'] },
  parameters: [
    createParameter({
      name: 'threshold',
      type: PARAM_TYPES.NUMBER,
      defaultValue: '0.5',
      validValues: ['0.1', '0.5', '0.9'],
    }),
    createParameter({ name: 'channel', type: PARAM_TYPES.STRING }),
  ],
  inputs: [createPort({ name: 'recording', dataType: 'timeseries', required: true })],
  outputs: [createPort({ name: 'units', dataType: 'package' })],
  tags: ['ephys'],
  categories: ['Preprocessing'],
})

const META = {
  name: 'Spike Sorter',
  description: 'Sorts spikes.',
  applicationType: 'processor',
}

describe('app-manifest.v1.json', () => {
  it('accepts what buildManifest emits', () => {
    const { ok, errors } = check(buildManifest(FULL, META))
    expect(errors).toBeFalsy()
    expect(ok).toBe(true)
  })

  it('accepts a bare manifest', () => {
    const { ok, errors } = check(buildManifest(createApplicationSchema(), { name: 'X' }))
    expect(errors).toBeFalsy()
    expect(ok).toBe(true)
  })

  it('still accepts the legacy flat shape', () => {
    const { ok, errors } = check({
      schemaVersion: '1.0',
      name: 'Old App',
      applicationType: 'processor',
      resources: { cpu: 1024, memory: 2048 },
      runtime: { computeTypes: ['standard'], gpu: { enabled: true, count: 1 } },
      parameters: [{ name: 'mode', type: 'enum', default: 'fast', allowedValues: ['fast'] }],
    })
    expect(errors).toBeFalsy()
    expect(ok).toBe(true)
  })

  it('accepts a package type as a port dataType', () => {
    // The vocabulary is served by GET /packages/types, so the schema cannot
    // pin it to a fixed enum.
    const { ok, errors } = check({
      schemaVersion: '1.0',
      application: { name: 'X' },
      inputs: [{ name: 'recording', dataType: 'TimeSeries', required: true }],
      outputs: [{ name: 'units', dataType: 'Tabular' }],
    })
    expect(errors).toBeFalsy()
    expect(ok).toBe(true)
  })

  it('rejects a manifest with no application name at all', () => {
    expect(check({ schemaVersion: '1.0' }).ok).toBe(false)
  })

  it('rejects a gpu compute type written the old way at the top level', () => {
    // `gpu` is a runtime concern; a top-level key is a typo, not a shape.
    expect(check({ schemaVersion: '1.0', name: 'X', gpu: true }).ok).toBe(false)
  })

  it('round-trips: emitted YAML parses back to the same runtime', () => {
    const yaml = manifestToYaml(buildManifest(FULL, META))
    const { schema } = parseManifest(yaml)
    expect(schema.resources).toEqual({ cpu: 4096, memory: 16384 })
    expect(schema.runtime.computeTypes).toEqual(['standard', 'gpu'])
  })
})
