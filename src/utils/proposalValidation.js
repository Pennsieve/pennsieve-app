export const PROPOSAL_NAME_MAX_LENGTH = 255

export function isValidProposalName(name) {
  const trimmedName = (name || '').trim()
  return trimmedName.length > 0 && trimmedName.length <= PROPOSAL_NAME_MAX_LENGTH
}

export function hasText(value) {
  return (value || '').trim().length > 0
}
