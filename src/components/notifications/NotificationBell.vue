<template>
  <div v-if="profile.intId" class="notification-bell" ref="bellRef">
    <button class="bell-button" @click="toggleDropdown" aria-label="Notifications">
      <IconNotifications :width="20" :height="20" color="currentColor" />
      <span v-if="unreadCount > 0" class="unread-badge">{{ displayCount }}</span>
    </button>

    <div v-if="open" class="bell-dropdown">
      <div class="dropdown-header">
        <span class="dropdown-title">Notifications</span>
      </div>

      <div v-if="notifications.length === 0" class="dropdown-empty">
        No notifications yet
      </div>

      <ul v-else class="notification-list" @scroll="onListScroll">
        <li
          v-for="n in notifications"
          :key="n.notification_id"
          class="notification-item"
          :class="{ unread: isUnread(n) }"
        >
          <div class="notification-title">{{ n.title }}</div>
          <div class="notification-message">{{ n.message }}</div>
          <div class="notification-time">{{ relativeTime(n.created_at) }}</div>
        </li>
        <li v-if="loadingMore" class="notification-loading">Loading...</li>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import IconNotifications from '../icons/IconNotifications.vue'

export default {
  name: 'NotificationBell',

  components: { IconNotifications },

  data() {
    return {
      open: false,
      pusherChannel: null,
      loadingMore: false,
      lastSeenSnapshot: null,
    }
  },

  computed: {
    ...mapState(['profile']),
    ...mapState('notificationModule', ['notifications']),
    ...mapGetters('notificationModule', ['hasUnreadNotifications', 'unreadCount', 'hasMoreNotifications']),

    displayCount() {
      return this.unreadCount > 99 ? '99+' : this.unreadCount
    },
  },

  methods: {
    toggleDropdown() {
      this.open = !this.open
      if (this.open) {
        this.lastSeenSnapshot = this.$store.state.notificationModule.notificationsLastSeen
        if (this.profile.intId) {
          this.$store.dispatch('notificationModule/updateNotificationsLastSeen', {
            intId: this.profile.intId,
          })
        }
      }
    },

    isUnread(notification) {
      const lastSeen = this.lastSeenSnapshot
      if (!lastSeen) return true
      return new Date(notification.created_at).getTime() > new Date(lastSeen).getTime()
    },

    relativeTime(dateStr) {
      if (!dateStr) return ''
      const now = Date.now()
      const then = new Date(dateStr).getTime()
      const diffSec = Math.floor((now - then) / 1000)

      if (diffSec < 60) return 'just now'
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin}m ago`
      const diffHr = Math.floor(diffMin / 60)
      if (diffHr < 24) return `${diffHr}h ago`
      const diffDay = Math.floor(diffHr / 24)
      return `${diffDay}d ago`
    },

    onClickOutside(e) {
      if (!this.$refs.bellRef) return
      if (this.$refs.bellRef.contains(e.target)) return
      this.open = false
    },

    async loadInitialNotifications() {
      try {
        await this.$store.dispatch('notificationModule/fetchNotifications')
      } catch (e) {
        // Notifications may not exist yet — that's fine
      }
    },

    subscribeToPusher() {
      if (!this.profile.intId) return
      const channelName = `user-${this.profile.intId}-notifications`
      this.pusherChannel = this.$pusher.subscribe(channelName)
      this.pusherChannel.bind('notification-event', this.onPushNotification.bind(this))
    },

    onPushNotification(data) {
      this.$store.commit('notificationModule/ADD_NOTIFICATION', data)
    },

    async onListScroll(e) {
      const el = e.target
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
      if (!nearBottom || !this.hasMoreNotifications || this.loadingMore) return

      this.loadingMore = true
      const nextOffset = this.notifications.length
      try {
        const [list] = await Promise.all([
          this.$store.dispatch('notificationModule/fetchNotifications', { offset: nextOffset }),
          new Promise((r) => setTimeout(r, 1500)),
        ])
      } finally {
        this.loadingMore = false
      }
    },
  },

  watch: {
    'profile.intId': {
      immediate: true,
      handler(intId) {
        if (!intId) return
        this.loadInitialNotifications()
        this.subscribeToPusher()
      },
    },
  },

  mounted() {
    document.addEventListener('mousedown', this.onClickOutside)
  },

  beforeUnmount() {
    document.removeEventListener('mousedown', this.onClickOutside)
    if (this.pusherChannel) {
      this.pusherChannel.unbind('notification-event')
      this.$pusher.unsubscribe(this.pusherChannel.name)
    }
  },
}
</script>

<style scoped lang="scss">
@use '../../styles/_theme.scss';

.notification-bell {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 100;
}

.bell-button {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  color: theme.$gray_5;
  display: flex;
  align-items: center;

  &:hover {
    background: theme.$gray_1;
  }
}

.unread-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: theme.$red_1;
  border-radius: 8px;
  color: theme.$white;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

.bell-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 320px;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.dropdown-header {
  padding: 12px 16px;
  border-bottom: 1px solid theme.$gray_2;
}

.dropdown-title {
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
}

.dropdown-empty {
  padding: 24px 16px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 13px;
}

.notification-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.notification-item {
  padding: 12px 16px;
  border-bottom: 1px solid theme.$gray_1;
  cursor: default;

  &:last-child {
    border-bottom: none;
  }

  &.unread {
    background: theme.$purple_tint;
  }
}

.notification-title {
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_6;
  margin-bottom: 2px;
}

.notification-message {
  font-size: 12px;
  color: theme.$gray_4;
  line-height: 1.4;
}

.notification-time {
  font-size: 11px;
  color: theme.$gray_3;
  margin-top: 4px;
}

.notification-loading {
  padding: 8px 16px;
  text-align: center;
  font-size: 12px;
  color: theme.$gray_3;
}
</style>
