<template>
  <bf-stage
    slot="stage"
    v-loading="loading"
    element-loading-background="transparent"
  >
    <div v-if="topics.length" class="bf-table">
      <div class="bf-table-header">
        <el-row align="middle" :gutter="32">
          <el-col :span="16" class="col-label">Topic</el-col>
          <el-col :span="4" class="col-label">Email</el-col>
          <el-col :span="4" class="col-label">In-app</el-col>
        </el-row>
      </div>

      <div
        v-for="topic in topics"
        :key="topic.topic_id"
        class="bf-table-row"
      >
        <el-row align="middle" :gutter="32">
          <el-col :span="16">
            <span class="topic-name">{{ topic.name }}</span>
            <span class="topic-description">{{ topic.description }}</span>
          </el-col>
          <el-col :span="4" class="col-toggle">
            <el-switch
              :model-value="isSubscribed(topic.topic_id, 'email')"
              @change="(val) => handleToggle(topic.topic_id, 'email', val)"
            />
          </el-col>
          <el-col :span="4" class="col-toggle">
            <el-switch
              :model-value="isSubscribed(topic.topic_id, 'in-app')"
              @change="(val) => handleToggle(topic.topic_id, 'in-app', val)"
            />
          </el-col>
        </el-row>
      </div>
    </div>

    <bf-empty-page-state v-else-if="!loading" class="empty">
      <div class="copy">
        <h2>No notification topics available.</h2>
        <p>Check back later for notification preferences.</p>
      </div>
    </bf-empty-page-state>
  </bf-stage>
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
    (s) => s.topic_id === topicId && s.context?.channel === channel
  )
}

function findSubscription(topicId, channel) {
  return subscriptions.value.find(
    (s) => s.topic_id === topicId && s.context?.channel === channel
  )
}

async function handleToggle(topicId, channel, enabled) {
  const orgId = route.params.orgId

  if (enabled) {
    // Optimistic update
    const tempSub = { id: `temp-${Date.now()}`, topic_id: topicId, context: { channel, organizationId: orgId } }
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
@use "../../styles/element/table";

:deep(.bf-table) {
  min-height: auto;
}

.col-label {
  color: theme.$gray_4;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.col-toggle {
  display: flex;
  align-items: center;
}

.topic-name {
  font-size: 14px;
  font-weight: 500;
  display: block;
}

.topic-description {
  font-size: 13px;
  color: theme.$gray_4;
  display: block;
  margin-top: 2px;
}

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 85px 190px;
}

.copy {
  h2 {
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
  }

  p {
    color: theme.$gray_4;
    font-size: 14px;
    line-height: 16px;
  }
}
</style>
