import { describe, it, expect } from 'vitest'
import { getProposalErrorMessage, isStaleProposalError } from './proposalErrorMessages'

const httpError = (status) => Object.assign(new Error(String(status)), { status })

describe('getProposalErrorMessage', () => {
  it('explains a 400 on submit', () => {
    expect(getProposalErrorMessage('submit', httpError(400))).toBe(
      "Could not submit the proposal. It may already have been submitted, or its repository's required questions may have changed. Refresh the page and check the proposal."
    )
  })

  it('mentions a duplicate dataset name for a 400 on accept', () => {
    expect(getProposalErrorMessage('accept', httpError(400))).toContain('already use this name')
  })

  it('explains a 400 on reject', () => {
    expect(getProposalErrorMessage('reject', httpError(400))).toContain('no longer awaiting review')
  })

  it('falls back to "try again" for codes without a known meaning', () => {
    expect(getProposalErrorMessage('save', httpError(500))).toBe(
      'Could not save the proposal. Please try again.'
    )
  })

  it('points at the connection when the request never got a response', () => {
    expect(getProposalErrorMessage('withdraw', new TypeError('Failed to fetch'))).toBe(
      'Could not withdraw the proposal. Check your connection and try again.'
    )
  })

  it('uses a custom first sentence when given one', () => {
    expect(
      getProposalErrorMessage('reject', httpError(400), { summary: 'Could not reject "Cortex".' })
    ).toBe('Could not reject "Cortex". It is no longer awaiting review.')
  })
})

describe('isStaleProposalError', () => {
  it('is true only for 400 and 404', () => {
    expect(isStaleProposalError(httpError(400))).toBe(true)
    expect(isStaleProposalError(httpError(404))).toBe(true)
    expect(isStaleProposalError(httpError(500))).toBe(false)
    expect(isStaleProposalError(new TypeError('Failed to fetch'))).toBe(false)
  })
})
