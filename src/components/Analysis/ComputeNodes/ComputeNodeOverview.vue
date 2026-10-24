<script setup>
// A compute node's Overview tab: what it is, what it can do (editable by its
// owner), and what ran on it lately.
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import { getUserName, runDisplayName, statusLabel, statusDotClass } from '../RunMonitor/runHelpers'
import { nodeCapabilities, recentNodeRuns, relativeTime } from './computeNodeHelpers'

const props = defineProps({
  node: { type: Object, required: true },
  canManage: { type: Boolean, default: false },
  gpuTiers: { type: Array, default: () => [] },
})
const emit = defineEmits(['updated'])

const route = useRoute()
const store = useStore()
const computeResourcesStore = useComputeResourcesStore()

const profile = computed(() => store.state.profile)
const orgMembers = computed(() => store.state.orgMembers || [])
const isMyWorkspace = computed(() => !route.params.orgId)

const SCOPE_LABELS = { private: 'only the owner', workspace: 'everyone in the workspace', shared: 'shared users and teams' }
const ownerLine = computed(() => {
  const owner = getUserName(props.node.ownerId || props.node.userId, profile.value, orgMembers.value)
  if (!props.node.organizationId) return `Owned by ${owner}; only they can use it.`
  const scope = computeResourcesStore.getNodePermissions(props.node.uuid)?.accessScope
  return scope ? `Owned by ${owner}; used by ${SCOPE_LABELS[scope] || scope}.` : `Owned by ${owner}.`
})
const createdLine = computed(() => {
  const created = props.node.createdAt && new Date(props.node.createdAt)
  return created && !Number.isNaN(created.getTime())
    ? `Created ${created.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`
    : ''
})

// Name and description
const isEditingInfo = ref(false)
const isSavingInfo = ref(false)
const infoForm = ref({ name: '', description: '' })
function startEditingInfo() {
  infoForm.value = { name: props.node.name || '', description: props.node.description || '' }
  isEditingInfo.value = true
}
async function saveInfo() {
  isSavingInfo.value = true
  try {
    await computeResourcesStore.updateComputeNode(props.node.uuid, {
      name: infoForm.value.name || null,
      description: infoForm.value.description || null
    })
    emit('updated')
    isEditingInfo.value = false
    ElMessage.success('Compute node updated')
  } catch (error) {
    console.error('Failed to update node:', error)
    ElMessage.error('Failed to update compute node')
  } finally {
    isSavingInfo.value = false
  }
}

// Capabilities (AI models, GPUs, notebooks: one edit group)
const capabilities = computed(() => nodeCapabilities(props.node, props.gpuTiers))
const isEditingConfig = ref(false)
const isSavingConfig = ref(false)
const configForm = ref({})
function startEditingConfig() {
  configForm.value = {
    enableLLMAccess: !!props.node.enableLLMAccess,
    enableGpu: (props.node.maxGpuInstances || 0) > 0,
    gpuTier: props.node.gpuTier || 'small',
    maxGpuInstances: props.node.maxGpuInstances || 2,
    enableInteractive: (props.node.maxInteractiveSessions || 0) > 0,
    maxInteractiveSessions: props.node.maxInteractiveSessions || 2
  }
  isEditingConfig.value = true
}
async function saveConfig() {
  isSavingConfig.value = true
  try {
    await computeResourcesStore.updateComputeNodeConfig(props.node.uuid, {
      enableLLMAccess: configForm.value.enableLLMAccess,
      maxGpuInstances: configForm.value.enableGpu ? configForm.value.maxGpuInstances : 0,
      gpuTier: configForm.value.enableGpu ? configForm.value.gpuTier : 'small',
      maxInteractiveSessions: configForm.value.enableInteractive ? configForm.value.maxInteractiveSessions : 0
    })
    emit('updated')
    ElMessage.success('Capabilities updated')
    isEditingConfig.value = false
  } catch (error) {
    console.error('Failed to update node config:', error)
    ElMessage.error('Failed to update capabilities')
  } finally {
    isSavingConfig.value = false
  }
}

// Recent activity: the workspace's (or the user's) runs, this node's.
const runsLoading = ref(true)
const recentRuns = computed(() =>
  recentNodeRuns(store.getters['analysisModule/workflowInstances'] || [], props.node.uuid)
)
const runRoute = (run) => (isMyWorkspace.value
  ? { name: 'my-run-detail', params: { runId: run.uuid } }
  : { name: 'run-detail', params: { orgId: route.params.orgId, runId: run.uuid } })
onMounted(async () => {
  try {
    await store.dispatch('analysisModule/fetchWorkflowInstances')
  } finally {
    runsLoading.value = false
  }
})
</script>

<template>
  <div class="node-overview">
    <section class="cn-section">
      <div class="cn-section-head">
        <h3 class="cn-section-title">About</h3>
        <bf-button v-if="canManage && !isEditingInfo" class="small secondary" @click="startEditingInfo">Edit</bf-button>
        <div v-else-if="isEditingInfo" class="edit-actions">
          <bf-button class="small secondary" @click="isEditingInfo = false">Cancel</bf-button>
          <bf-button class="small" :processing="isSavingInfo" :disabled="isSavingInfo" @click="saveInfo">Save</bf-button>
        </div>
      </div>
      <div class="cn-card">
        <template v-if="!isEditingInfo">
          <p class="about-description">{{ node.description || 'No description.' }}</p>
          <p class="cn-muted">{{ ownerLine }}<template v-if="createdLine"> {{ createdLine }}.</template></p>
        </template>
        <div v-else class="info-form">
          <label>
            <span>Name</span>
            <el-input v-model="infoForm.name" placeholder="Node name" />
          </label>
          <label>
            <span>Description</span>
            <el-input v-model="infoForm.description" type="textarea" :rows="3" placeholder="What this node is for" />
          </label>
        </div>
      </div>
    </section>

    <section class="cn-section">
      <div class="cn-section-head">
        <h3 class="cn-section-title">What it can do</h3>
        <bf-button v-if="canManage && !isEditingConfig" class="small secondary" @click="startEditingConfig">Change</bf-button>
        <div v-else-if="isEditingConfig" class="edit-actions">
          <bf-button class="small secondary" @click="isEditingConfig = false">Cancel</bf-button>
          <bf-button class="small" :processing="isSavingConfig" :disabled="isSavingConfig" @click="saveConfig">Save</bf-button>
        </div>
      </div>

      <div v-if="!isEditingConfig" class="capabilities">
        <div v-for="c in capabilities" :key="c.key" class="capability" :class="{ 'is-off': !c.on }">
          <span class="capability-label">
            {{ c.label }}
            <span class="cn-pill" :class="{ 'is-on': c.on }">{{ c.on ? 'On' : 'Off' }}</span>
          </span>
          <span class="cn-muted">{{ c.detail }}</span>
        </div>
      </div>

      <div v-else class="cn-card">
        <dl class="cn-facts">
          <div>
            <dt>Notebooks</dt>
            <dd>
              <el-switch v-model="configForm.enableInteractive" />
              <template v-if="configForm.enableInteractive">
                <span class="cn-muted">Up to</span>
                <el-input-number v-model="configForm.maxInteractiveSessions" :min="1" :max="50" size="small" />
                <span class="cn-muted">at a time</span>
              </template>
            </dd>
          </div>
          <div>
            <dt>GPUs</dt>
            <dd>
              <el-switch v-model="configForm.enableGpu" />
              <template v-if="configForm.enableGpu">
                <el-select v-model="configForm.gpuTier" size="small" class="tier-select">
                  <el-option
                    v-for="tier in gpuTiers"
                    :key="tier.tier"
                    :label="`${tier.tier}: ${tier.gpu} (${tier.gpuMemoryGB} GB, $${tier.pricePerHour.toFixed(2)}/h)`"
                    :value="tier.tier"
                  />
                </el-select>
                <span class="cn-muted">up to</span>
                <el-input-number v-model="configForm.maxGpuInstances" :min="1" :max="10" size="small" />
              </template>
            </dd>
          </div>
          <div>
            <dt>AI models</dt>
            <dd>
              <el-switch v-model="configForm.enableLLMAccess" />
              <span class="cn-muted">Lets apps and chat on this node use large language models.</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="cn-section">
      <h3 class="cn-section-title">Recent activity</h3>
      <div v-if="runsLoading" class="cn-card cn-muted">Loading…</div>
      <ul v-else-if="recentRuns.length" class="cn-list">
        <li v-for="run in recentRuns" :key="run.uuid">
          <router-link :to="runRoute(run)" class="run-link">
            <span class="run-dot" :class="statusDotClass(run.status)" />
            <span class="run-name">{{ runDisplayName(run) }}</span>
          </router-link>
          <span class="cn-muted run-meta">
            {{ statusLabel(run.status) }}<template v-if="run.startedAt"> · {{ relativeTime(run.startedAt) }}</template>
          </span>
        </li>
      </ul>
      <p v-else class="cn-muted">Nothing has run on this node yet.</p>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/theme';
@use './computeNodePage';

.edit-actions {
  display: flex;
  gap: 8px;
}
.about-description {
  margin: 0 0 6px;
  font-size: 14px;
  line-height: 1.5;
  color: theme.$gray_6;
  white-space: pre-line;
}
.info-form {
  display: grid;
  gap: 12px;

  label {
    display: grid;
    gap: 4px;
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_5;
  }
}
.capabilities {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.capability {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.capability-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}
.tier-select {
  width: 280px;
}
.run-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: theme.$gray_6;
  text-decoration: none;

  &:hover .run-name {
    color: theme.$purple_3;
    text-decoration: underline;
  }
}
.run-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.run-meta {
  flex-shrink: 0;
}
.run-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: theme.$gray_3;

  &.dot-blue { background: theme.$teal_1; }
  &.dot-amber { background: theme.$orange_1; }
  &.dot-green { background: theme.$green_1; }
  &.dot-red { background: theme.$red_1; }
}
</style>
