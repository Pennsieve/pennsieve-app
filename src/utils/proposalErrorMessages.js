// The publishing service returns errors with an empty body, so the status code
// is all we have. What each code means per action comes from the service's docs.
const failureReasons = {
  save: {
    404: 'It no longer exists. Refresh the page to see your current proposals.',
  },
  submit: {
    400: "It may already have been submitted, or its repository's required questions may have changed. Refresh the page and check the proposal.",
  },
  withdraw: {
    400: 'It may already have been accepted or rejected. Refresh the page to see its current status.',
  },
  remove: {
    404: 'It may already have been removed. Refresh the page to see your current proposals.',
  },
  accept: {
    400: 'Another dataset in this workspace may already use this name, or the proposal is no longer awaiting review.',
    401: 'Only publishers in this workspace can accept proposals.',
  },
  reject: {
    400: 'It is no longer awaiting review.',
    401: 'Only publishers in this workspace can reject proposals.',
  },
}

/**
 * @param {'save'|'submit'|'withdraw'|'remove'|'accept'|'reject'} action
 * @param {Error & { status?: number }} error - thrown by proposalStore
 * @param {{ summary?: string }} options - replaces the default first sentence
 */
export function getProposalErrorMessage(action, error, { summary } = {}) {
  const firstSentence = summary ?? `Could not ${action} the proposal.`

  // fetch rejects without a response when the request never reached the server
  if (!error?.status) {
    return `${firstSentence} Check your connection and try again.`
  }

  const reason = failureReasons[action]?.[error.status] ?? 'Please try again.'
  return `${firstSentence} ${reason}`
}

// 400/404 on a status change usually means the proposal changed elsewhere
// (another tab, or a publisher acted on it), so the list is stale
export function isStaleProposalError(error) {
  return error?.status === 400 || error?.status === 404
}
