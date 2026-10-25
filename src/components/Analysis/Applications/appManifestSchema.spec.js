// The bundled app.yml schema (a copy of app-deploy-service's
// manifestschema/app-manifest.v1.json, published at
// https://schemas.pennsieve.io/app-manifest/v1.json): what the builder writes
// must follow it.
import { describe, it, expect } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import yaml from 'js-yaml'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import schemaJson from './app-manifest.v1.schema.json'
import {
  buildManifest,
  serializeManifestYaml,
  createApplicationSchema,
  createParameter,
  createPort,
  parseManifest,
  MANIFEST_SCHEMA_URL,
  PARAM_TYPES,
} from './applicationSchema'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(schemaJson)
const problems = () => (validate.errors || []).map((e) => `${e.instancePath} ${e.message}`).join('; ')

describe('the app.yml schema', () => {
  it('is the one generated manifests point at', () => {
    expect(schemaJson.$id).toBe(MANIFEST_SCHEMA_URL)
  })

  it('accepts what the builder writes', () => {
    const schema = createApplicationSchema({
      resources: { cpu: 1024, memory: 2048 },
      tags: ['eeg', 'spikes'],
      parameters: [
        createParameter({ name: 'THRESHOLD', type: PARAM_TYPES.NUMBER, defaultValue: 0.5, min: 0, max: 1, label: 'Threshold' }),
        createParameter({ name: 'MODE', type: PARAM_TYPES.ENUM, validValues: ['fast', 'accurate'], defaultValue: 'fast' }),
        createParameter({ name: 'VERBOSE', type: PARAM_TYPES.BOOLEAN, defaultValue: false }),
      ],
      inputs: [createPort({ name: 'recording', dataType: 'application/octet-stream', formats: ['http://edamontology.org/format_3998'], required: true })],
      outputs: [createPort({ name: 'spikes', mediaTypes: ['application/vnd.apache.parquet'] }), createPort({ name: 'anything' })],
    })
    const m = buildManifest(schema, {
      name: 'Spike detector',
      description: 'Finds spikes.',
      applicationType: 'processor',
      version: '1.2.0',
      maintainers: [{ name: 'Ada', email: 'ada@example.org', orcid: 'https://orcid.org/0000-0002-1825-0097' }],
      timeoutSeconds: 600,
    })
    expect(validate(m), problems()).toBe(true)
    expect(m.application.maintainers[0].orcid).toBe('0000-0002-1825-0097')
    expect(m.inputs[0]).toMatchObject({ mediaTypes: ['application/octet-stream'], formats: ['format_3998'], required: true })
    expect(m.outputs[1]).toEqual({ name: 'anything' })
  })

  it('accepts a live Jupyter session the builder writes', () => {
    const m = buildManifest(createApplicationSchema({ runtime: { computeTypes: ['standard'], interactive: true, sessionType: 'jupyter', kernel: 'r' } }), { name: 'R notebook' })
    expect(validate(m), problems()).toBe(true)
    expect(m.runtime).toMatchObject({ interactive: true, sessionType: 'jupyter', kernel: 'r' })
  })

  it('round-trips through YAML, with the editor directive on the first line', () => {
    const text = serializeManifestYaml(createApplicationSchema(), { name: 'X' })
    expect(text.split('\n')[0]).toBe(`# yaml-language-server: $schema=${MANIFEST_SCHEMA_URL}`)
    expect(validate(yaml.load(text)), problems()).toBe(true)
    expect(parseManifest(text).meta.name).toBe('X')
  })

  it('accepts the published example', () => {
    const text = readFileSync(resolve(__dirname, '../../../../public/static/schemas/app-manifest.v1.yml'), 'utf8')
    expect(validate(yaml.load(text)), problems()).toBe(true)
  })

  it('catches a typo', () => {
    expect(validate({ application: { name: 'x' }, runtime: { sesionType: 'jupyter' } })).toBe(false)
  })
})
