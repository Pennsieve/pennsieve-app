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

      <ul v-else class="notification-list">
        <li
          v-for="n in notifications"
          :key="n.id"
          class="notification-item"
          :class="{ unread: isUnread(n) }"
        >
          <div class="notification-title">{{ n.title || n.topic_name || 'Notification' }}</div>
          <div class="notification-message">{{ n.message || n.body || '' }}</div>
          <div class="notification-time">{{ relativeTime(n.created_at) }}</div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'
import IconNotifications from '../icons/IconNotifications.vue'
import { fetchSubscriptions } from '@/composables/useNotifications'

export default {
  name: 'NotificationBell',

  components: { IconNotifications },

  data() {
    return {
      open: false,
      pusherChannel: null,
    }
  },

  computed: {
    ...mapState(['profile']),
    ...mapState('notificationModule', ['notifications']),
    ...mapGetters('notificationModule', ['hasUnreadNotifications', 'unreadCount']),

    displayCount() {
      return this.unreadCount > 99 ? '99+' : this.unreadCount
    },
  },

  methods: {
    toggleDropdown() {
      this.open = !this.open
      if (this.open && this.profile.intId) {
        this.$store.dispatch('notificationModule/updateNotificationsLastSeen', {
          intId: this.profile.intId,
        })
      }
    },

    isUnread(notification) {
      const lastSeen = this.$store.state.notificationModule.notificationsLastSeen
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
      if (this.$refs.bellRef && !this.$refs.bellRef.contains(e.target)) {
        this.open = false
      }
    },

    async loadInitialNotifications() {
      try {
        const subscriptions = await fetchSubscriptions()
        if (Array.isArray(subscriptions) && subscriptions.length > 0) {
          const firstTopicId = subscriptions[0].topic_id
          await this.$store.dispatch('notificationModule/fetchNotifications', {
            topicId: firstTopicId,
          })
        }
      } catch (e) {
        // Subscriptions may not exist yet — that's fine
      }
    },

    subscribeToPusher() {
      const channelName = `user-${this.profile.intId}-notifications`
      this.pusherChannel = this.$pusher.subscribe(channelName)
      this.pusherChannel.bind('notification-event', this.onPushNotification.bind(this))
    },

    onPushNotification(data) {
      this.$store.commit('notificationModule/ADD_NOTIFICATION', data)
    },
  },

  async mounted() {
    document.addEventListener('click', this.onClickOutside)
    await this.loadInitialNotifications()
    this.subscribeToPusher()
  },

  beforeUnmount() {
    document.removeEventListener('click', this.onClickOutside)
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
  overflow-y: auto;
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
</style>
