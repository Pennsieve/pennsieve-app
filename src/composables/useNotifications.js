// Notification subscriptions API layer.
//
// BE endpoints (api2):
//   GET    /notification/topics
//   GET    /notification/subscriptions
//   POST   /notification/topic/{topicId}/subscription?organization_id={org node id}
//          — body: the context, flat
//          (e.g. { organizationId, datasetId }), plus optional notification_channels
//   PATCH  /notification/subscription/{subscriptionId}?organization_id={org node id}
//          — body: { enabled: boolean }
//   GET    /notification/messages                      — all notifications for the user
//
// Subscriptions are disabled rather than deleted (history is kept).
// Context fields come from the topic's schema (topic.context.required) and are
// numeric IDs: organizationId, plus datasetId or subjectUserId by topic scope.
// Unknown fields are rejected. notification_channels, if sent, must be exactly
// { email, push, sms } booleans; omitted, the user's preferences apply.

import * as siteConfig from '@/site-config/site.json'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'

const BASE_URL = `${siteConfig.api2Url}/notification`

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

// The gateway authorizer only sees the URL, so writes name the workspace
// there too (as its node ID); the body's numeric organizationId is for the
// service.
const workspaceQuery = (organizationNodeId) =>
  `organization_id=${encodeURIComponent(organizationNodeId)}`

export async function subscribe(topicId, context, organizationNodeId) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/topic/${topicId}/subscription?${workspaceQuery(organizationNodeId)}`, {
    method: 'POST',
    header,
    body: context,
  })
}

export async function toggleSubscription(subscriptionId, enabled, organizationNodeId) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/subscription/${subscriptionId}?${workspaceQuery(organizationNodeId)}`, {
    method: 'PATCH',
    header,
    body: { enabled },
  })
}

export async function fetchUserNotificationPrefs(userId) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/user/${userId}`, { header })
}

export async function initUserNotificationPrefs(userId) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/user/${userId}`, {
    method: 'POST',
    header,
  })
}

export async function patchNotificationsLastSeen(userId, currentPrefs) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/user/${userId}`, {
    method: 'PATCH',
    header,
    body: {
      ...currentPrefs,
      notificationsLastSeen: new Date().toISOString(),
    },
  })
}

export async function fetchNotificationMessages({ offset = 0, limit = 50 } = {}) {
  const header = await authHeader()
  return useSendXhr(`${BASE_URL}/messages?offset=${offset}&limit=${limit}`, {
    header,
  })
}
