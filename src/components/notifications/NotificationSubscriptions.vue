<template>
  <bf-stage
    slot="stage"
    v-loading="loading"
    element-loading-background="transparent"
  >
    <div v-if="topics.length" class="bf-table">
      <div class="bf-table-header">
        <el-row align="middle" :gutter="32">
          <el-col :span="20" class="col-label">Topic</el-col>
          <el-col :span="4" class="col-label">Email</el-col>
        </el-row>
      </div>

      <div
        v-for="topic in topics"
        :key="topic.topic_id"
        class="bf-table-row"
      >
        <el-row align="middle" :gutter="32">
          <el-col :span="20">
            <span class="topic-name">{{ topic.name }}</span>
            <span class="topic-description">{{ topic.description }}</span>
          </el-col>
          <el-col :span="4" class="col-toggle">
            <el-switch
              :model-value="isSubscribed(topic)"
              @change="(val) => handleToggle(topic, val)"
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
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import {
  fetchTopics,
  fetchSubscriptions,
  subscribe,
  toggleSubscription,
} from '@/composables/useNotifications'

const props = defineProps({
  scope: {
    type: String,
    default: 'org',
    validator: (v) => ['org', 'dataset'].includes(v),
  },
})

const store = useStore()

const loading = ref(false)
const topics = ref([])
const subscriptions = ref([])

// v1 is email only.
const EMAIL_ONLY = { email: true, push: false, sms: false }

// The BE validates the context against the topic's schema: only the fields
// the topic requires, all numeric IDs (not node IDs), nothing else.
function contextValue(field) {
  switch (field) {
    case 'organizationId':
      return store.state.activeOrganization?.organization?.intId
    case 'datasetId':
      return store.getters.datasetIntId
    case 'subjectUserId':
      return store.state.profile?.intId
  }
}

function buildContext(topic) {
  const ctx = {}
  for (const field of topic.context?.required ?? []) {
    ctx[field] = contextValue(field)
  }
  return ctx
}

function findSubscription(topic) {
  const ctx = buildContext(topic)
  return subscriptions.value.find(
    (s) =>
      s.topic_id === topic.topic_id &&
      Object.entries(ctx).every(([k, v]) => Number(s.context?.[k]) === v)
  )
}

function isSubscribed(topic) {
  const sub = findSubscription(topic)
  return !!sub && sub.enabled !== false
}

async function handleToggle(topic, enabled) {
  const topicId = topic.topic_id
  const context = buildContext(topic)

  if (enabled) {
    // POST upserts — creates or re-enables. notification_channels sits beside
    // the context fields and must name all three channels.
    const tempSub = { id: `temp-${Date.now()}`, topic_id: topicId, enabled: true, context }
    subscriptions.value.push(tempSub)

    try {
      const created = await subscribe(topicId, {
        ...context,
        notification_channels: EMAIL_ONLY,
      })
      const idx = subscriptions.value.indexOf(tempSub)
      if (idx !== -1) {
        subscriptions.value.splice(idx, 1, created)
      }
    } catch {
      const idx = subscriptions.value.indexOf(tempSub)
      if (idx !== -1) subscriptions.value.splice(idx, 1)
      ElMessage.error('Failed to subscribe. Please try again.')
    }
  } else {
    const existing = findSubscription(topic)
    if (!existing) return

    existing.enabled = false

    try {
      await toggleSubscription(existing.subscription_id, false)
    } catch {
      existing.enabled = true
      ElMessage.error('Failed to disable subscription. Please try again.')
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
    const requiresDataset = (t) => (t.context?.required ?? []).includes('datasetId')
    topics.value = props.scope === 'dataset'
      ? topicsData.filter(requiresDataset)
      : topicsData.filter((t) => !requiresDataset(t))
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
