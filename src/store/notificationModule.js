import {
  fetchUserNotificationPrefs,
  initUserNotificationPrefs,
  patchNotificationsLastSeen,
  fetchNotificationMessages,
} from '@/composables/useNotifications'

// ── Mock data for testing pagination ──
const USE_MOCK = true

const MOCK_NOTIFICATIONS = (() => {
  const items = []
  const now = Date.now()

  // 5 brand-new unread notifications
  items.push({
    notification_id: 'new-1',
    title: 'Dataset published successfully',
    message: 'Your dataset "Cardiac MRI Study" has been published and is now publicly available.',
    created_at: new Date(now - 10 * 1000).toISOString(), // 10s ago
  })
  items.push({
    notification_id: 'new-2',
    title: 'New collaborator added',
    message: 'Jane Smith was added as a manager to "EEG Recordings Q3".',
    created_at: new Date(now - 15 * 1000).toISOString(), // 15s ago
  })
  items.push({
    notification_id: 'new-3',
    title: 'File upload complete',
    message: '12 files were successfully uploaded to "Brain Imaging Atlas".',
    created_at: new Date(now - 20 * 1000).toISOString(), // 20s ago
  })
  items.push({
    notification_id: 'new-4',
    title: 'Permission updated',
    message: 'You were granted editor access to "Longitudinal Aging Study".',
    created_at: new Date(now - 25 * 1000).toISOString(), // 25s ago
  })
  items.push({
    notification_id: 'new-5',
    title: 'Dataset status changed',
    message: 'Dataset "Proteomics Panel" moved from "In Review" to "Completed".',
    created_at: new Date(now - 30 * 1000).toISOString(), // 30s ago
  })

  // 70 older notifications for pagination testing
  const titles = [
    'File upload complete',
    'Dataset status changed',
    'New comment on record',
    'Permission updated',
    'Integration webhook fired',
    'Export ready for download',
    'Model schema updated',
    'Collection modified',
    'Dataset embargo lifted',
    'Storage quota warning',
  ]
  const messages = [
    'The upload of 24 files to "Brain Imaging" has finished processing.',
    'Dataset "Genomics Panel" moved from "In Review" to "Completed".',
    'Alex Chen commented on patient record #4021.',
    'Your role on "Longitudinal Study" was changed to editor.',
    'Webhook "Slack notifier" triggered for event dataset.update.',
    'Your CSV export (1.2 GB) is ready to download.',
    'The "Participant" model schema was updated with 3 new fields.',
    'Collection "2024 Publications" was updated with 2 new datasets.',
    'The embargo period for "Clinical Trial Phase II" has ended.',
    'Your workspace is at 85% of its storage quota.',
  ]

  for (let i = 0; i < 70; i++) {
    items.push({
      notification_id: `mock-${i}`,
      title: titles[i % titles.length],
      message: messages[i % messages.length],
      created_at: new Date(now - (i + 1) * 24 * 60 * 60 * 1000).toISOString(), // 1d, 2d, 3d... ago
    })
  }

  return items
})()

function getMockPage({ offset = 0, limit = 50 }) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        messages: MOCK_NOTIFICATIONS.slice(offset, offset + limit),
        totalCount: MOCK_NOTIFICATIONS.length,
      })
    }, 400) // simulate network delay
  })
}
// ── End mock data ──

const initialState = () => ({
  userNotificationPrefs: {},
  notifications: [],
  notificationsLastSeen: null,
  totalCount: 0,
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    const _initialState = initialState()
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },

  SET_USER_NOTIFICATION_PREFS(state, prefs) {
    state.userNotificationPrefs = prefs
    if (prefs.notificationsLastSeen) {
      state.notificationsLastSeen = prefs.notificationsLastSeen
    }
  },

  SET_NOTIFICATIONS(state, { notifications, totalCount }) {
    state.notifications = notifications
    state.totalCount = totalCount
  },

  APPEND_NOTIFICATIONS(state, { notifications, totalCount }) {
    state.notifications = state.notifications.concat(notifications)
    state.totalCount = totalCount
  },

  SET_NOTIFICATIONS_LAST_SEEN_AT(state, timestamp) {
    state.notificationsLastSeen = timestamp
  },

  ADD_NOTIFICATION(state, notification) {
    state.notifications.unshift(notification)
    state.totalCount += 1
  },
}

export const actions = {
  async fetchUserNotificationPrefs({ commit }, { intId }) {
    try {
      const prefs = await fetchUserNotificationPrefs(intId)
      if (prefs) {
        commit('SET_USER_NOTIFICATION_PREFS', prefs)
      }
      return prefs
    } catch (e) {
      return null
    }
  },

  async initUserNotificationPrefs({ commit }, { intId }) {
    try {
      const prefs = await initUserNotificationPrefs(intId)
      if (prefs) {
        commit('SET_USER_NOTIFICATION_PREFS', prefs)
      }
      return prefs
    } catch (e) {
      console.error('Failed to init notification prefs', e)
    }
  },

  async updateNotificationsLastSeen({ commit, state }, { intId }) {
    // Skip PATCH if user prefs record hasn't been created yet
    if (!state.userNotificationPrefs || !state.userNotificationPrefs.userId) {
      return
    }
    const now = new Date().toISOString()
    commit('SET_NOTIFICATIONS_LAST_SEEN_AT', now)
    try {
      await patchNotificationsLastSeen(intId, state.userNotificationPrefs)
    } catch (e) {
      console.error('Failed to update notificationsLastSeen', e)
    }
  },

  async fetchNotifications({ commit }, { offset = 0, limit = 50 } = {}) {
    try {
      const data = USE_MOCK
        ? await getMockPage({ offset, limit })
        : await fetchNotificationMessages({ offset, limit })
      const list = Array.isArray(data) ? data : (data?.messages ?? [])
      const totalCount = data?.totalCount ?? list.length

      if (offset === 0) {
        commit('SET_NOTIFICATIONS', { notifications: list, totalCount })
      } else {
        commit('APPEND_NOTIFICATIONS', { notifications: list, totalCount })
      }

      return list
    } catch (e) {
      return []
    }
  },
}

export const getters = {
  hasUnreadNotifications(state) {
    if (state.notifications.length === 0) return false
    if (!state.notificationsLastSeen) return true
    const lastSeen = new Date(state.notificationsLastSeen).getTime()
    return state.notifications.some(
      n => new Date(n.created_at).getTime() > lastSeen
    )
  },

  unreadCount(state) {
    if (!state.notificationsLastSeen) return state.notifications.length
    const lastSeen = new Date(state.notificationsLastSeen).getTime()
    return state.notifications.filter(
      n => new Date(n.created_at).getTime() > lastSeen
    ).length
  },

  hasMoreNotifications(state) {
    return state.notifications.length < state.totalCount
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
