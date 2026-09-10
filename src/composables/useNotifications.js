// Notification subscriptions API layer.
//
// USE_MOCK flag: set to `true` to bypass the real API and return fake data
// for local development. Set to `false` when the BE topics/subscriptions
// endpoints are populated and ready.
//
// ⚠️  IMPORTANT: USE_MOCK must be `false` before merging to main / deploying
//    to any promoted environment. Mock data is for local dev only.
//
// BE endpoints (api2):
//   GET    /integration/notification/topics
//   GET    /integration/notification/subscriptions
//   POST   /integration/notification/subscriptions/{topicId}  — body: { channel, organizationId }
//   DELETE /integration/notification/subscriptions/{topicId}
//
// Subscriptions returned from the BE nest channel info under `context`:
//   { id, topicId, context: { channel: "email" | "in-app", organizationId } }

import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'

// ──────────────────────────────────────────────
// Toggle this to `false` when BE is ready.
// Must be `false` before deploying to any env.
// ──────────────────────────────────────────────
const USE_MOCK = true

// ── Mock data (only used when USE_MOCK is true) ──
const MOCK_TOPICS = [
  { id: 'topic-1', name: 'Dataset Created', description: 'A new dataset is created in the workspace' },
  { id: 'topic-2', name: 'Publishing Requested', description: 'A dataset has been submitted for publishing review' },
  { id: 'topic-3', name: 'Publishing Accepted', description: 'A dataset publishing request has been approved' },
  { id: 'topic-4', name: 'Dataset Published', description: 'A dataset has been published to Pennsieve Discover' },
  { id: 'topic-5', name: 'Member Invited', description: 'A new member has been invited to the workspace' },
]

const MOCK_SUBSCRIPTIONS = [
  { id: 'sub-1', topicId: 'topic-1', context: { channel: 'email', organizationId: 'mock-org' } },
  { id: 'sub-2', topicId: 'topic-1', context: { channel: 'in-app', organizationId: 'mock-org' } },
  { id: 'sub-3', topicId: 'topic-4', context: { channel: 'email', organizationId: 'mock-org' } },
]

const BASE_URL = `${siteConfig.api2Url}/integration/notification`

async function authHeader() {
  const token = await useGetToken()
  return { Authorization: `Bearer ${token}` }
}

export async function fetchTopics() {
  if (USE_MOCK) {
    return Promise.resolve(MOCK_TOPICS)
  }
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/topics`, { header })
}

export async function fetchSubscriptions() {
  if (USE_MOCK) {
    return Promise.resolve(MOCK_SUBSCRIPTIONS)
  }
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/subscriptions`, { header })
}

export async function subscribe(topicId, context) {
  if (USE_MOCK) {
    const id = `sub-${Date.now()}`
    console.log('[mock] subscribe', { topicId, context, id })
    return Promise.resolve({ id, topicId, context })
  }
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/subscriptions/${topicId}`, {
    method: 'POST',
    header,
    body: context,
  })
}

export async function unsubscribe(topicId, subscriptionId) {
  if (USE_MOCK) {
    console.log('[mock] unsubscribe', { topicId, subscriptionId })
    return Promise.resolve()
  }
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/subscriptions/${topicId}`, {
    method: 'DELETE',
    header,
  })
}
