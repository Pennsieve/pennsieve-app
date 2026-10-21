// Live-update channels, matching pennsieve-go-core pkg/realtime and the
// events authorizer (docs/realtime-appsync-design.md in pennsieve-go-core).
// Node IDs (N:dataset:<uuid>) and bare UUIDs are both accepted.

export function stripNodePrefix(id) {
  const value = (id || '').trim()
  return value.startsWith('N:') ? value.slice(value.lastIndexOf(':') + 1) : value
}

// Upload rows for a dataset (`upload-event`).
export const datasetChannel = (datasetId) => `/datasets/${stripNodePrefix(datasetId)}`

// Build/deploy status for an application (`application_status_event`).
export const applicationChannel = (applicationId) => `/applications/${stripNodePrefix(applicationId)}`

// Every run in a workspace, or of a user with no workspace
// (`workflow-run-status`, `workflow-processor-status`).
export function runScopeChannel(organizationId, userId) {
  const org = stripNodePrefix(organizationId)
  return org ? `/runs/org-${org}/*` : `/runs/user-${stripNodePrefix(userId)}/*`
}

// One run's events.
export function runChannel(organizationId, userId, runId) {
  return runScopeChannel(organizationId, userId).replace(/\*$/, stripNodePrefix(runId))
}

// The Pusher channel a path maps to, for environments still on Pusher.
export function pusherChannelName(path) {
  const [namespace, first] = path.replace(/^\//, '').split('/')
  switch (namespace) {
    case 'datasets':
      return `dataset-${first}`
    case 'applications':
      return `application-${first}`
    case 'runs':
      if (first?.startsWith('org-')) return `organization-${first.slice(4)}-analytics`
      if (first?.startsWith('user-')) return `user-${first.slice(5)}-analytics`
  }
  throw new Error(`realtime: no Pusher channel for ${path}`)
}
