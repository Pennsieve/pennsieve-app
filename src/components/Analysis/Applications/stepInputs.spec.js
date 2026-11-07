import { describe, it, expect } from 'vitest'
import { validateAppConnection, validateStepInputs } from './applicationSchema'

// A step that needs two things, each produced by a different upstream step.
const analysis = {
  inputs: [
    { name: 'recordings', mediaTypes: ['application/vnd.pennsieve.edf'], required: true },
    { name: 'annotations', mediaTypes: ['text/csv'], required: true },
  ],
}
const converter = { outputs: [{ name: 'edf', mediaTypes: ['application/vnd.pennsieve.edf'] }] }
const annotator = { outputs: [{ name: 'csv', mediaTypes: ['text/csv'] }] }
const imager = { outputs: [{ name: 'png', mediaTypes: ['image/png'] }] }

describe('validateStepInputs', () => {
  it('meets required inputs from all upstream steps together', () => {
    // Each link alone misses one required input...
    expect(validateAppConnection(converter, analysis).reason).toBe('unmet-required')
    expect(validateAppConnection(annotator, analysis).reason).toBe('unmet-required')
    // ...but the step is fully fed.
    const step = validateStepInputs([converter, annotator], analysis)
    expect(step.checked).toBe(true)
    expect(step.unmetRequired).toEqual([])
    expect(step.metInputs.map((i) => i.name)).toEqual(['recordings', 'annotations'])
  })

  it('names the required inputs no upstream step provides', () => {
    const step = validateStepInputs([converter, imager], analysis)
    expect(step.unmetRequired.map((i) => i.name)).toEqual(['annotations'])
  })

  it('has nothing unmet when the step has no required inputs', () => {
    const optional = { inputs: analysis.inputs.map((i) => ({ ...i, required: false })) }
    expect(validateStepInputs([converter], optional).unmetRequired).toEqual([])
  })
})
