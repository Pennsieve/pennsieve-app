// Notification subscriptions API layer.
//
// BE endpoints (api2):
//   GET    /integration/notification/topics
//   GET    /integration/notification/subscriptions
//   POST   /integration/notification/subscriptions/{topicId}  — body: { context: { channel, organizationId } }
//   DELETE /integration/notification/subscriptions/{topicId}
//
// Subscriptions returned from the BE nest channel info under `context`:
//   { subscription_id, topic_id, context: { channel: "email" | "in-app", organizationId } }

import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'

const BASE_URL = `${siteConfig.api2Url}/integration/notification`

async function authHeader() {
  const token = await useGetToken()
  return { Authorization: `Bearer ${token}` }
}

export async function fetchTopics() {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/topics`, { header })
}

export async function fetchSubscriptions() {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/subscriptions`, { header })
}

export async function subscribe(topicId, context) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/subscriptions/${topicId}`, {
    method: 'POST',
    header,
    body: { context },
  })
}

export async function unsubscribe(topicId, subscriptionId) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/subscriptions/${topicId}`, {
    method: 'DELETE',
    header,
  })
}
