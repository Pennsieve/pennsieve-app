import {
  fetchUserNotificationPrefs,
  initUserNotificationPrefs,
  patchNotificationsLastSeen,
  fetchNotificationsByTopic,
} from '@/composables/useNotifications'

const initialState = () => ({
  userNotificationPrefs: {},
  notifications: [],
  notificationsLastSeen: null,
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

  SET_NOTIFICATIONS(state, notifications) {
    state.notifications = notifications
  },

  SET_NOTIFICATIONS_LAST_SEEN_AT(state, timestamp) {
    state.notificationsLastSeen = timestamp
  },

  ADD_NOTIFICATION(state, notification) {
    state.notifications.unshift(notification)
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
    if (!state.notificationsLastSeen || state.notifications.length === 0) {
      return false
    }
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
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
