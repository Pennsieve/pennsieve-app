import {
  fetchUserNotificationPrefs,
  initUserNotificationPrefs,
  patchNotificationsLastSeen,
  fetchNotificationMessages,
} from '@/composables/useNotifications'

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
      const data = await fetchNotificationMessages({ offset, limit })
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
