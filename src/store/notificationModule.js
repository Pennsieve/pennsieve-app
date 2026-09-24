import {
  fetchUserNotificationPrefs,
  initUserNotificationPrefs,
  patchNotificationsLastSeen,
  fetchNotificationsByTopic,
} from '@/composables/useNotifications'

const initialState = () => ({
  userNotificationPrefs: {},
  notifications: [],
  notificationsLastSeenAt: null,
})

export const state = initialState()

export const mutations = {
  CLEAR_STATE(state) {
    const _initialState = initialState()
    Object.keys(_initialState).forEach(key => state[key] = _initialState[key])
  },

  SET_USER_NOTIFICATION_PREFS(state, prefs) {
    state.userNotificationPrefs = prefs
    if (prefs.notificationsLastSeenAt) {
      state.notificationsLastSeenAt = prefs.notificationsLastSeenAt
    }
  },

  SET_NOTIFICATIONS(state, notifications) {
    state.notifications = notifications
  },

  SET_NOTIFICATIONS_LAST_SEEN_AT(state, timestamp) {
    state.notificationsLastSeenAt = timestamp
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

  async updateNotificationsLastSeen({ commit }, { intId }) {
    const now = new Date().toISOString()
    commit('SET_NOTIFICATIONS_LAST_SEEN_AT', now)
    try {
      await patchNotificationsLastSeen(intId)
    } catch (e) {
      console.error('Failed to update notificationsLastSeenAt', e)
    }
  },

  async fetchNotifications({ commit }, { topicId }) {
    try {
      const data = await fetchNotificationsByTopic(topicId)
      const list = Array.isArray(data) ? data : (data?.notifications ?? [])
      commit('SET_NOTIFICATIONS', list)
      return list
    } catch (e) {
      return []
    }
  },
}

export const getters = {
  hasUnreadNotifications(state) {
    if (!state.notificationsLastSeenAt || state.notifications.length === 0) {
      return false
    }
    const lastSeen = new Date(state.notificationsLastSeenAt).getTime()
    return state.notifications.some(
      n => new Date(n.created_at).getTime() > lastSeen
    )
  },

  unreadCount(state) {
    if (!state.notificationsLastSeenAt) return state.notifications.length
    const lastSeen = new Date(state.notificationsLastSeenAt).getTime()
    return state.notifications.filter(
      n => new Date(n.created_at).getTime() > lastSeen
    ).length
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
