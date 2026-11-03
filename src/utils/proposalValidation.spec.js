import { describe, it, expect } from 'vitest'
import { PROPOSAL_NAME_MAX_LENGTH, isValidProposalName, hasText } from './proposalValidation'

describe('isValidProposalName', () => {
  it('rejects empty, missing and whitespace-only names', () => {
    expect(isValidProposalName('')).toBe(false)
    expect(isValidProposalName(undefined)).toBe(false)
    expect(isValidProposalName(null)).toBe(false)
    expect(isValidProposalName('   ')).toBe(false)
  })

  it('accepts names up to the limit, ignoring surrounding whitespace', () => {
    expect(isValidProposalName('Mouse Cortex Imaging')).toBe(true)
    expect(isValidProposalName(`  ${'a'.repeat(PROPOSAL_NAME_MAX_LENGTH)}  `)).toBe(true)
  })

  it('rejects names over the limit', () => {
    expect(isValidProposalName('a'.repeat(PROPOSAL_NAME_MAX_LENGTH + 1))).toBe(false)
  })
})

describe('hasText', () => {
  it('treats whitespace-only as empty', () => {
    expect(hasText(' \n ')).toBe(false)
    expect(hasText(undefined)).toBe(false)
    expect(hasText('Description')).toBe(true)
  })
})
