import { describe, it, expect } from 'vitest'
import { load as loadYaml } from 'js-yaml'
import {
  parseManifest,
  buildManifest,
  arePortsCompatible,
  validateAppConnection,
  createPort,
  portDataTypeOptions,
  structureId,
  structureOptionsFor,
  structureMatches,
} from './applicationSchema'
import { validateManifestDoc } from './manifestValidation'

// An app.yml as repositories have it today: no conformsTo, no container.
const EXISTING = `application:
  name: EDF to NWB
  description: Converts EDF recordings to NWB.
  type: processor
runtime:
  cpu: 2048
  memory: 4096
inputs:
  - name: recording
    description: EDF recordings
    mediaTypes: [application/vnd.pennsieve.edf]
    required: true
outputs:
  - name: nwb
    mediaTypes: [application/x-hdf5]
    formats: [format_3590]
`

const STRUCTURED = `application:
  name: Segment
inputs:
  - name: study
    conformsTo: bids@1.9
  - name: images
    mediaTypes: [application/vnd.pennsieve.ome-zarr]
    container: directory
outputs:
  - name: labels
    mediaTypes: [application/vnd.pennsieve.ome-zarr]
`

describe('folder formats and structures in app.yml', () => {
  it('leaves an existing app.yml as it was: no new fields appear', () => {
    const { meta, schema } = parseManifest(EXISTING)
    const out = buildManifest(schema, meta)
    const before = loadYaml(EXISTING)
    expect(out.inputs).toEqual(before.inputs)
    expect(out.outputs).toEqual(before.outputs)
  })

  it('reads and writes conformsTo (with its version) and container', () => {
    const { meta, schema } = parseManifest(STRUCTURED)
    expect(schema.inputs[0]).toMatchObject({ conformsTo: 'bids@1.9', container: '' })
    expect(schema.inputs[1]).toMatchObject({ container: 'directory', conformsTo: '' })
    const out = buildManifest(schema, meta)
    expect(out.inputs[0]).toEqual({ name: 'study', conformsTo: 'bids@1.9' })
    expect(out.inputs[1]).toEqual({ name: 'images', mediaTypes: ['application/vnd.pennsieve.ome-zarr'], container: 'directory' })
    expect(out.outputs[0]).not.toHaveProperty('container')
  })

  it('only writes container when it is directory', () => {
    const { meta, schema } = parseManifest('application:\n  name: a\ninputs:\n  - name: x\n    mediaTypes: [a/b]\n    container: file\n')
    expect(buildManifest(schema, meta).inputs[0]).not.toHaveProperty('container')
  })

  it('passes the app.yml schema', () => {
    expect(validateManifestDoc(loadYaml(STRUCTURED))).toEqual({ valid: true, problems: [] })
    expect(validateManifestDoc(loadYaml(EXISTING))).toEqual({ valid: true, problems: [] })
  })

  it('reports an unknown container or a structure that is not a registry id', () => {
    const bad = loadYaml('application:\n  name: a\ninputs:\n  - name: x\n    container: folder\n  - name: y\n    conformsTo: BIDS 1.9\n')
    const text = JSON.stringify(validateManifestDoc(bad).problems)
    expect(text).toMatch(/container/)
    expect(text).toMatch(/conformsTo/)
  })

  it('matches structures by id, whatever the version', () => {
    const bids = createPort({ conformsTo: 'bids' })
    expect(arePortsCompatible(createPort({ conformsTo: 'bids@1.9' }), bids)).toBe(true)
    expect(arePortsCompatible(createPort({ conformsTo: 'ro-crate' }), bids)).toBe(false)
    // A folder of files with no structure doesn't feed a BIDS input.
    expect(arePortsCompatible(createPort({ mediaTypes: ['application/x-nifti'] }), bids)).toBe(false)
    expect(structureId('bids@1.9')).toBe('bids')
  })

  it('checks an edge into a BIDS input', () => {
    const into = { inputs: [{ name: 'study', conformsTo: 'bids', required: true }] }
    const ok = validateAppConnection({ outputs: [{ name: 'out', conformsTo: 'bids' }] }, into)
    expect(ok).toMatchObject({ checked: true, compatible: true })
    const no = validateAppConnection({ outputs: [{ name: 'out', mediaTypes: ['text/csv'] }] }, into)
    expect(no).toMatchObject({ checked: true, compatible: false })
  })

  it('offers the registry structures, plus ones app.yml names that it lacks', () => {
    const opts = structureOptionsFor([{ id: 'bids', name: 'BIDS' }], ['bids@1.9', 'my-layout'])
    expect(opts.map((o) => o.id)).toEqual(['bids', 'my-layout'])
    expect(structureMatches(opts[0], 'bid')).toBe(true)
    expect(structureMatches(opts[0], 'nwb')).toBe(false)
  })

  it('marks folder formats on the media type options', () => {
    const opts = portDataTypeOptions([
      { value: 'application/vnd.pennsieve.ome-zarr', label: 'x', name: 'OME-Zarr', kind: 'directory' },
      { value: 'text/csv', label: 'text/csv', name: 'CSV' },
    ])
    expect(opts.find((o) => o.value === 'application/vnd.pennsieve.ome-zarr').kind).toBe('directory')
    expect(opts.find((o) => o.value === 'text/csv')).not.toHaveProperty('kind')
  })
})
