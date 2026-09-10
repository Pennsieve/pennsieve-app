<template>
  <div class="notification-subscriptions" v-loading="loading">
    <h2 class="section-title">Notification Preferences</h2>
    <p class="section-description">
      Choose which notifications you'd like to receive and how.
    </p>

    <div class="subscriptions-table" v-if="topics.length">
      <div class="table-header">
        <span class="col-topic">Topic</span>
        <span class="col-toggle">Email</span>
        <span class="col-toggle">In-app</span>
      </div>

      <div
        v-for="topic in topics"
        :key="topic.id"
        class="table-row"
      >
        <div class="col-topic">
          <span class="topic-name">{{ topic.name }}</span>
          <span class="topic-description">{{ topic.description }}</span>
        </div>
        <div class="col-toggle">
          <el-switch
            :model-value="isSubscribed(topic.id, 'email')"
            @change="(val) => handleToggle(topic.id, 'email', val)"
          />
        </div>
        <div class="col-toggle">
          <el-switch
            :model-value="isSubscribed(topic.id, 'in-app')"
            @change="(val) => handleToggle(topic.id, 'in-app', val)"
          />
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="empty-state">
      No notification topics available.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  fetchTopics,
  fetchSubscriptions,
  subscribe,
  unsubscribe,
} from '@/composables/useNotifications'

const route = useRoute()

const loading = ref(false)
const topics = ref([])
const subscriptions = ref([])

function isSubscribed(topicId, channel) {
  return subscriptions.value.some(
    (s) => s.topicId === topicId && s.context?.channel === channel
  )
}

function findSubscription(topicId, channel) {
  return subscriptions.value.find(
    (s) => s.topicId === topicId && s.context?.channel === channel
  )
}

async function handleToggle(topicId, channel, enabled) {
  const orgId = route.params.orgId

  if (enabled) {
    // Optimistic update
    const tempSub = { id: `temp-${Date.now()}`, topicId, context: { channel, organizationId: orgId } }
    subscriptions.value.push(tempSub)

    try {
      const created = await subscribe(topicId, { channel, organizationId: orgId })
      // Replace temp with real subscription
      const idx = subscriptions.value.indexOf(tempSub)
      if (idx !== -1) {
        subscriptions.value.splice(idx, 1, created)
      }
    } catch {
      // Rollback
      const idx = subscriptions.value.indexOf(tempSub)
      if (idx !== -1) subscriptions.value.splice(idx, 1)
      ElMessage.error('Failed to subscribe. Please try again.')
    }
  } else {
    const existing = findSubscription(topicId, channel)
    if (!existing) return

    // Optimistic remove
    const idx = subscriptions.value.indexOf(existing)
    subscriptions.value.splice(idx, 1)

    try {
      await unsubscribe(topicId, existing.id)
    } catch {
      // Rollback
      subscriptions.value.splice(idx, 0, existing)
      ElMessage.error('Failed to unsubscribe. Please try again.')
    }
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const [topicsData, subsData] = await Promise.all([
      fetchTopics(),
      fetchSubscriptions(),
    ])
    topics.value = topicsData
    subscriptions.value = subsData
  } catch {
    ElMessage.error('Failed to load notification preferences.')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
@use "../../styles/theme";

.notification-subscriptions {
  max-width: 720px;
  padding: 32px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
}

.section-description {
  color: theme.$gray_4;
  font-size: 14px;
  margin: 0 0 24px;
}

.subscriptions-table {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  overflow: hidden;
}

.table-header {
  background: theme.$gray_1;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_4;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 16px;
  border-top: 1px solid theme.$gray_2;
}

.col-topic {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.topic-name {
  font-size: 14px;
  font-weight: 500;
}

.topic-description {
  font-size: 13px;
  color: theme.$gray_4;
}

.col-toggle {
  width: 80px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.empty-state {
  color: theme.$gray_4;
  font-size: 14px;
  padding: 32px 0;
  text-align: center;
}
</style>
