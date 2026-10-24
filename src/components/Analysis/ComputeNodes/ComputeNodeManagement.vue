<script setup>
// A compute node's page, in a workspace (/:orgId/analysis/compute-nodes/:nodeId)
// or in My Workspace (/my-workspace/compute-nodes/:nodeId), which has no
// orgId. A header (name, status, where it runs) over tabs like the other
// Analysis pages': Overview, Access, Settings, Reference data and Advanced.
// The tab is in the URL (?tab=); older section links (#quotas) land on the
// tab that section is on.
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import ComputeNodeOverview from './ComputeNodeOverview.vue'
import ComputeNodeAccess from './ComputeNodeAccess.vue'
import ComputeNodeAllowedApps from './ComputeNodeAllowedApps.vue'
import ComputeNodeAdvanced from './ComputeNodeAdvanced.vue'
import ComputeNodeSecrets from './ComputeNodeSecrets.vue'
import ComputeNodeLayers from './ComputeNodeLayers.vue'
import ComputeNodeQuotas from './ComputeNodeQuotas.vue'
import ComputeNodeLLMBudget from './ComputeNodeLLMBudget.vue'
import { NODE_TABS, nodeTab, nodeStatus, canToggleStatus, nodeSubtitle } from './computeNodeHelpers'

const route = useRoute()
const router = useRouter()
const store = useStore()
const computeResourcesStore = useComputeResourcesStore()

const profile = computed(() => store.state.profile)
const activeOrganization = computed(() => store.getters.activeOrganization)

const nodeUuid = computed(() => route.params.nodeId)
const orgId = computed(() => route.params.orgId)
const listRoute = computed(() => orgId.value
  ? { name: 'compute-nodes', params: { orgId: orgId.value } }
  : { name: 'my-compute-nodes' })

const computeNode = ref(null)
const isLoading = ref(true)
// Why the node couldn't be shown: 'not-found' (404, or no access) or 'error'.
const loadError = ref('')
const gpuTiers = ref([])

const isNodeOwner = computed(() => computeNode.value?.ownerId === profile.value?.id)
const hasAdminRights = computed(() => {
  if (activeOrganization.value) {
    return activeOrganization.value.isAdmin || activeOrganization.value.isOwner
  }
  return false
})
// Mirrors the API: the node owner, the account owner, or a workspace admin
// when the account is Admin Managed in that workspace.
const canManage = computed(() => {
  if (!computeNode.value) return false
  return isNodeOwner.value ||
    (!!profile.value?.id && computeNode.value.account?.ownerId === profile.value.id) ||
    (hasAdminRights.value && computeResourcesStore.isNodeAdminManaged(computeNode.value))
})
// A node with no organization is the owner's alone: it can't be shared with
// users, teams or a workspace, and the API refuses any attempt.
const isPersonalNode = computed(() => !!computeNode.value && !computeNode.value.organizationId)

const status = computed(() => nodeStatus(computeNode.value))
const subtitle = computed(() => nodeSubtitle(computeNode.value, { isOwner: isNodeOwner.value }))

const tab = computed({
  get: () => nodeTab(route.query, route.hash),
  set: (v) => router.replace({ query: { ...route.query, tab: v === 'overview' ? undefined : v }, hash: '' }),
})

onMounted(async () => {
  await fetchComputeNode()
  if (!computeNode.value) return
  await Promise.all([
    (orgId.value
      ? computeResourcesStore.fetchComputeNodes(orgId.value)
      : computeResourcesStore.fetchUserOwnedComputeNodes()).catch(() => {}),
    computeResourcesStore.fetchNodePermissions(nodeUuid.value),
    computeResourcesStore.fetchAllowedProcessors(nodeUuid.value),
    computeResourcesStore.fetchGpuTiers(activeOrganization.value?.organization?.id).then(tiers => {
      gpuTiers.value = tiers || []
    }).catch(() => {}),
    // Admins need the workspace's account enablements to know if this node is Admin Managed
    hasAdminRights.value && computeNode.value?.organizationId
      ? computeResourcesStore.fetchWorkspaceComputeAccounts(computeNode.value.organizationId).catch(() => {})
      : Promise.resolve(),
  ])
  // A section link (#quotas) scrolls to its section once its tab is shown.
  if (route.hash) {
    await nextTick()
    document.querySelector(route.hash)?.scrollIntoView({ block: 'start' })
  }
})

async function fetchComputeNode() {
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      computeNode.value = await response.json()
      loadError.value = ''
    } else {
      loadError.value = [403, 404].includes(response.status) ? 'not-found' : 'error'
    }
  } catch (error) {
    console.error('Failed to fetch compute node:', error)
    loadError.value = 'error'
  } finally {
    isLoading.value = false
  }
}

const isUpdatingStatus = ref(false)
async function toggleStatus() {
  const next = status.value === 'Enabled' ? 'Paused' : 'Enabled'
  isUpdatingStatus.value = true
  try {
    await computeResourcesStore.updateComputeNodeStatus(nodeUuid.value, next)
    computeNode.value = { ...computeNode.value, status: next }
    ElMessage.success(next === 'Paused' ? 'Node paused' : 'Node resumed')
  } catch (error) {
    console.error('Failed to update status:', error)
    ElMessage.error('Failed to change the node status')
  } finally {
    isUpdatingStatus.value = false
  }
}

const STATUS_PILL = { Enabled: 'is-on', Paused: 'is-warn', Destroying: 'is-bad', Failed: 'is-bad' }
const STATUS_TEXT = { Enabled: 'Running', Paused: 'Paused', Pending: 'Setting up', Destroying: 'Being destroyed', Failed: 'Failed' }
</script>

<template>
  <div class="compute-node-page">
    <div v-if="isLoading" class="state-placeholder">
      <div class="skeleton skeleton--title" />
      <div class="skeleton skeleton--line" />
      <div class="skeleton skeleton--block" />
    </div>

    <div v-else-if="!computeNode" class="state-empty">
      <h3>{{ loadError === 'not-found' ? 'Compute node not found' : "This compute node couldn't be loaded" }}</h3>
      <p>
        {{ loadError === 'not-found'
          ? "It may have been destroyed, or you don't have access to it."
          : 'Something went wrong. Try again in a moment.' }}
      </p>
      <router-link :to="listRoute" class="state-link">All compute nodes</router-link>
    </div>

    <template v-else>
      <header class="node-header">
        <div class="node-heading">
          <div class="node-title-row">
            <h2 class="node-title">{{ computeNode.name }}</h2>
            <span class="cn-pill" :class="STATUS_PILL[status]">{{ STATUS_TEXT[status] }}</span>
          </div>
          <p class="node-subtitle">{{ subtitle }}</p>
        </div>
        <bf-button
          v-if="canManage && canToggleStatus(computeNode)"
          class="secondary small"
          :processing="isUpdatingStatus"
          :disabled="isUpdatingStatus"
          @click="toggleStatus"
        >
          {{ status === 'Enabled' ? 'Pause node' : 'Resume node' }}
        </bf-button>
      </header>

      <div class="node-toolbar">
        <div class="node-views" role="tablist">
          <button
            v-for="t in NODE_TABS"
            :key="t.key"
            role="tab"
            class="node-view"
            :class="{ active: tab === t.key }"
            :aria-selected="tab === t.key"
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <ComputeNodeOverview
        v-if="tab === 'overview'"
        :node="computeNode"
        :can-manage="canManage"
        :gpu-tiers="gpuTiers"
        @updated="fetchComputeNode"
      />

      <ComputeNodeAccess
        v-else-if="tab === 'access'"
        :node="computeNode"
        :can-manage="canManage"
        :personal="isPersonalNode"
      />

      <div v-else-if="tab === 'settings'" class="node-settings">
        <section class="cn-section">
          <h3 class="cn-section-title">Secrets</h3>
          <ComputeNodeSecrets :node-id="nodeUuid" :is-owner="isNodeOwner" />
        </section>

        <ComputeNodeAllowedApps v-if="isNodeOwner" :node-id="nodeUuid" />

        <template v-if="canManage">
          <!-- The node-wide AI budget is the cap the governor enforces on
               every call, chat and apps alike; per-user quotas only gate
               chat, on top of it. Anchors #llm-budget and #quotas are what
               older links (the chat panel's "Manage quotas") target. -->
          <section v-if="computeNode.enableLLMAccess" id="llm-budget" class="cn-section">
            <h3 class="cn-section-title">AI budget</h3>
            <ComputeNodeLLMBudget :node-id="nodeUuid" :is-owner="isNodeOwner" />
          </section>
          <section v-if="computeNode.enableLLMAccess && !isPersonalNode" id="quotas" class="cn-section">
            <h3 class="cn-section-title">Per-user AI quotas</h3>
            <p class="cn-blurb">
              Optional caps per user, on top of the node's AI budget. They only gate chat; apps are
              governed by the node budget alone.
            </p>
            <ComputeNodeQuotas :node-id="nodeUuid" :is-owner="isNodeOwner" />
          </section>
          <p v-if="!computeNode.enableLLMAccess" class="cn-muted">
            The AI budget and quotas appear here once AI models are turned on, on the Overview tab.
          </p>
        </template>
      </div>

      <section v-else-if="tab === 'reference-data'" id="reference-data" class="cn-section">
        <ComputeNodeLayers :node-id="nodeUuid" :is-owner="isNodeOwner" />
      </section>

      <ComputeNodeAdvanced
        v-else-if="tab === 'advanced'"
        :node="computeNode"
        :can-manage="canManage"
        @updated="fetchComputeNode"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/theme';
@use './computeNodePage';

.compute-node-page {
  margin: 0;
  padding: 20px 32px;
}
.node-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.node-heading {
  min-width: 0;
}
.node-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.node-title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  font-weight: 500;
  color: theme.$gray_6;
}
.node-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: theme.$gray_5;
}
// The tabs, as the Notebooks and Workflows tabs' Live/Builder switch.
.node-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.node-views {
  display: inline-flex;
  flex-wrap: wrap;
  padding: 2px;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  background: theme.$gray_1;
}
.node-view {
  padding: 5px 14px;
  border: none;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$gray_5;
  cursor: pointer;

  &:hover {
    color: theme.$purple_3;
  }
  &.active {
    background: theme.$white;
    color: theme.$purple_3;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}
.state-empty {
  padding: 48px 24px;
  text-align: center;

  h3 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: theme.$gray_6;
  }
  p {
    margin: 0 0 16px;
    font-size: 14px;
    color: theme.$gray_5;
  }
}
.state-link {
  font-size: 14px;
  color: theme.$purple_3;
}
.skeleton {
  border-radius: 4px;
  background: theme.$gray_1;
  animation: skeleton-pulse 1.4s ease-in-out infinite;

  &--title {
    width: 240px;
    height: 22px;
    margin-bottom: 10px;
  }
  &--line {
    width: 180px;
    height: 14px;
    margin-bottom: 24px;
  }
  &--block {
    height: 160px;
  }
}
@keyframes skeleton-pulse {
  50% {
    opacity: 0.5;
  }
}
</style>
