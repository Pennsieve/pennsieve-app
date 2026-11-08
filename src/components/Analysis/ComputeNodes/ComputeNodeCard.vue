<template>
  <!--
    A compute node, as the Library draws a workflow: a white card with its
    name (and its status, only when it isn't Enabled), two lines of
    description, its tier badge with what it runs in quiet grey, its budget
    inline when it has one, and one muted line of where it runs, whose it is
    and its provisioner, the actions on hover. The whole card opens the
    node's page.
  -->
  <div
    class="cn-card-tile"
    :class="{ 'is-off': ['Paused', 'Failed', 'Destroying'].includes(statusLabel) }"
    :style="{ '--tier': tier.color }"
    role="link"
    tabindex="0"
    @click="openNode"
    @keydown.enter="openNode"
  >
    <div class="tile-title">
      <router-link :to="detailRoute" class="tile-name" @click.stop>{{ node.name }}</router-link>
      <el-tooltip v-if="node.platform" content="Pennsieve's compute node, open to every user." placement="top">
        <span class="official-mark" @click.stop>
          <IconPennsieveMark :width="14" :height="14" color="currentColor" />
        </span>
      </el-tooltip>
      <span v-if="statusLabel !== 'Enabled'" class="tile-badge" :class="`status-${statusLabel.toLowerCase()}`">
        {{ statusLabel }}{{ statusLabel === 'Updating' && node.pendingProvisionerImageTag ? ` to ${node.pendingProvisionerImageTag}` : '' }}
      </span>
    </div>

    <p class="tile-description">{{ node.description || 'No description.' }}</p>

    <!-- Its tier, then what it runs: neutral, so the badge is the colour -->
    <div class="tile-caps">
      <NodeTierBadge :node="node" />
      <template v-for="(chip, i) in chips" :key="chip.key">
        <span v-if="i > 0" class="sep">·</span>
        <el-tooltip :content="chip.detail" placement="top" :show-after="300">
          <span class="tile-cap" :class="{ 'tile-cap--warn': chip.kind === 'update' }">
            <el-icon v-if="CAP_ICONS[chip.kind]" class="tile-cap-icon"><component :is="CAP_ICONS[chip.kind]" /></el-icon>
            {{ chip.label }}
          </span>
        </el-tooltip>
      </template>
    </div>

    <!-- What the caller has left to spend on this node, once known. Only
         nodes with spend caps show it (the meter hides itself otherwise). -->
    <PipelineBudgetMeter
      v-if="meterBudget"
      class="tile-budget"
      inline
      :budget="meterBudget"
      :spend-axes="meterSpendAxes"
      :concurrency-axes="meterConcurrencyAxes"
      :level="meterLevel"
      :per-run-usd="meterPerRunUsd"
      :loading="meterLoading"
      :error="meterError"
      @click.stop
    />

    <div class="tile-foot">
      <!-- Where it runs, whose it is, its provisioner: one muted line -->
      <span class="tile-version" :title="footLine">{{ footLine }}</span>
      <span class="tile-actions" @click.stop>
        <el-tooltip
          v-if="hasProvisionerUpdate && canUpdateNode"
          :content="`Version ${node.latestVersion} is available. Updating re-provisions the node in your cloud account and typically takes 6-8 minutes.`"
          placement="top"
          :show-after="300"
          :popper-style="{ maxWidth: '320px' }"
        >
          <button type="button" class="tile-action tile-action--warn" :disabled="isUpdatingPermissions" @click="updateNode">
            {{ isUpdatingPermissions ? 'Updating…' : `Update to ${node.latestVersion}` }}
          </button>
        </el-tooltip>
        <el-tooltip
          v-else-if="canRetrySetup"
          content="Its last deploy or update failed. Retrying runs the same version again in your cloud account, continuing from what it set up, and typically takes 6-8 minutes."
          placement="top"
          :show-after="300"
          :popper-style="{ maxWidth: '320px' }"
        >
          <button type="button" class="tile-action tile-action--warn" :disabled="isUpdatingPermissions" @click="retrySetup">
            {{ isUpdatingPermissions ? 'Retrying…' : 'Retry setup' }}
          </button>
        </el-tooltip>
        <button
          v-if="canManagePermissions && statusLabel === 'Enabled'"
          type="button"
          class="tile-action"
          :disabled="isUpdatingPermissions"
          @click="updateStatus('Paused')"
        >
          Pause
        </button>
        <button
          v-else-if="canManagePermissions && statusLabel === 'Paused'"
          type="button"
          class="tile-action"
          :disabled="isUpdatingPermissions"
          @click="updateStatus('Enabled')"
        >
          Resume
        </button>
        <button type="button" class="tile-action tile-action--open" @click="openNode">Open</button>
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import IconPennsieveMark from '../../icons/IconPennsieveMark.vue'
import { deploymentMode, nodeCapabilities } from './computeNodeHelpers'
import NodeTierBadge from './NodeTierBadge.vue'
import { Cpu, MagicStick, Notebook } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import { usePipelineBudgetStore } from '@/stores/pipelineBudgetStore'
import PipelineBudgetMeter from './PipelineBudgetMeter.vue'

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  isUpdating: {
    type: Boolean,
    default: false
  },
  hasAdminRights: {
    type: Boolean,
    default: false
  }
})

const store = useStore()
const computeResourcesStore = useComputeResourcesStore()
const profile = computed(() => store.state.profile)

const isUpdatingPermissions = computed(() => computeResourcesStore.isNodeUpdating(props.node.uuid))

// The caller's remaining pipeline budget on this node, from the same read the
// run-creation gate uses (pipelineBudgetStore). Fetched per card; the store
// dedupes and keeps stale numbers on a failed refresh.
const budgetStore = usePipelineBudgetStore()
const meterBudget = computed(() => budgetStore.getBudget(props.node.uuid))
const meterSpendAxes = computed(() => budgetStore.spendAxes(props.node.uuid))
const meterConcurrencyAxes = computed(() => budgetStore.concurrencyAxes(props.node.uuid))
const meterLevel = computed(() => budgetStore.warningLevel(props.node.uuid))
const meterPerRunUsd = computed(() => budgetStore.perRunUsd(props.node.uuid))
const meterLoading = computed(() => budgetStore.isLoading(props.node.uuid))
const meterError = computed(() => budgetStore.getError(props.node.uuid))
onMounted(() => budgetStore.fetch(props.node.uuid))

// Link to the node's page in the current context: the workspace's route under
// /:orgId, or My Workspace's when there is no workspace.
const route = useRoute()
const router = useRouter()
const detailRoute = computed(() => ({
  name: route.params.orgId ? 'compute-node-management' : 'my-compute-node-management',
  params: { nodeId: props.node.uuid }
}))
const openNode = () => router.push(detailRoute.value)

const statusLabel = computed(() => getStatusForNode(props.node))
// What it runs, each with a small icon (Element Plus's).
const CAP_ICONS = { notebooks: Notebook, gpu: Cpu, ai: MagicStick }
// The foot line: "AWS · Owned by … · Provisioner v1.36.3".
const footLine = computed(() =>
  [
    shortAccountType(props.node.account?.accountType),
    ownerName.value && `Owned by ${ownerName.value}`,
    props.node.provisionerImageTag && `Provisioner ${props.node.provisionerImageTag}`,
  ]
    .filter(Boolean)
    .join(' · ')
)
// Its tier, for the card's accent stripe (the badge shows the name).
const tier = computed(() => deploymentMode(props.node))
// What the node runs, as the Library's app chips: notebooks, GPUs, AI
// models when on, and an update when one is waiting for someone else.
const chips = computed(() => {
  const on = nodeCapabilities(props.node).filter((c) => c.on)
    .map((c) => ({ key: c.key, label: c.label, detail: c.detail, kind: c.key }))
  if (hasProvisionerUpdate.value && !canUpdateNode.value) {
    on.push({
      key: 'update', kind: 'update', label: 'Update available',
      detail: `Version ${props.node.latestVersion} is available; the node owner or a workspace admin can update it.`,
    })
  }
  return on
})

const isNodeOwner = computed(() => {
  return props.node.ownerId === profile.value?.id
})

const canManagePermissions = computed(() => isNodeOwner.value)

// Mirrors the API: node owner, account owner, or a workspace admin when the account is Admin Managed
const canUpdateNode = computed(() =>
  isNodeOwner.value ||
  (!!profile.value?.id && props.node.account?.ownerId === profile.value.id) ||
  (props.hasAdminRights && computeResourcesStore.isNodeAdminManaged(props.node))
)
const hasProvisionerUpdate = computed(() => props.node.updateAvailable === true && !!props.node.latestVersion)
// A failed node with no newer version to update to: its setup can be run
// again at the version it has (the API takes a failed node's update).
const canRetrySetup = computed(() => statusLabel.value === 'Failed' && canUpdateNode.value && !!props.node.provisionerImageTag)

const ownerName = computed(() => {
  const member = store.getters.getOrgMember(props.node.ownerId)
  if (member?.firstName) {
    return `${member.firstName} ${member.lastName}`.trim()
  }
  return null
})


function shortAccountType(type) {
  switch (type) {
    case 'AWS': return 'AWS'
    case 'GCP': return 'Google Cloud'
    case 'AZURE': return 'Azure'
    default: return type || ''
  }
}

function getStatusForNode(node) {
  if (!node.status) return 'Pending'
  const status = node.status.toLowerCase()
  switch (status) {
    case 'pending': return 'Pending'
    case 'enabled': case 'active': case 'running': case 'ready': return 'Enabled'
    case 'paused': case 'stopped': case 'disabled': return 'Paused'
    case 'destroying': return 'Destroying'
    case 'failed': return 'Failed'
    case 'updating': return 'Updating'
    default: return 'Pending'
  }
}

async function updateStatus(newStatus) {
  try {
    await computeResourcesStore.updateComputeNodeStatus(props.node.uuid, newStatus)
    ElMessage.success(`Status updated to ${newStatus}`)
  } catch (error) {
    console.error('Failed to update compute node status:', error)
    ElMessage.error('Failed to update compute node status')
  }
}

// Run a failed node's setup again, at the version it has
async function retrySetup() {
  try {
    await computeResourcesStore.updateComputeNodeDeployment(props.node.uuid, {
      provisionerImage: props.node.provisionerImage || computeResourcesStore.DEFAULT_PROVISIONER_IMAGE,
      provisionerImageTag: props.node.provisionerImageTag
    })
    ElMessage.success('Retrying the compute node setup. This typically takes 6-8 minutes.')
  } catch (error) {
    console.error('Failed to retry compute node setup:', error)
    ElMessage.error('Failed to retry the compute node setup')
  }
}

// Re-provision the node with the newest released provisioner tag (never "latest")
async function updateNode() {
  const targetTag = props.node.latestVersion
  if (!targetTag) return
  try {
    await computeResourcesStore.updateComputeNodeDeployment(props.node.uuid, {
      provisionerImage: props.node.provisionerImage || computeResourcesStore.DEFAULT_PROVISIONER_IMAGE,
      provisionerImageTag: targetTag
    })
    ElMessage.success(`Updating compute node to ${targetTag}. This typically takes 6-8 minutes.`)
  } catch (error) {
    console.error('Failed to update compute node:', error)
    ElMessage.error('Failed to update compute node')
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

/* As the Library's cards: white, square, a quiet border that turns purple
   on hover, the actions only then. */
.cn-card-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  min-height: 150px;
  padding: 14px 16px 12px;
  border: 1px solid theme.$gray_2;
  background: theme.$white;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: theme.$purple_1;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    outline: none;
  }
  &:hover .tile-actions,
  &:focus-within .tile-actions {
    opacity: 1;
  }
  &.is-off {
    opacity: 0.75;
  }
  /* A light tint of its tier's colour, a 2px stripe down the left (the
     badge is the tier's marker): over the padding, so nothing moves. */
  &::before {
    content: '';
    position: absolute;
    top: -1px;
    bottom: -1px;
    left: -1px;
    width: 2px;
    background: var(--tier);
    opacity: 0.45;
    pointer-events: none;
  }
}

.tile-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: theme.$gray_6;
  text-decoration: none;
  &:hover {
    color: theme.$purple_3;
  }
}
/* Pennsieve's mark sits where the badges do, as on an official workflow. */
.official-mark {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;
  color: theme.$purple_3;
}
.official-mark + .tile-badge {
  margin-left: 0;
}
/* The node's status, top right, as the Library's badges. */
.tile-badge {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 3px;
  background: theme.$gray_0;
  color: theme.$gray_5;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  /* Only states that need a look show (Enabled doesn't). */
  &.status-paused,
  &.status-disabled,
  &.status-updating,
  &.status-pending,
  &.status-destroying {
    background: theme.$orange_tint;
    color: theme.$orange_2;
  }
  &.status-failed {
    background: theme.$red_tint;
    color: theme.$red_2;
  }
}

.tile-description {
  display: -webkit-box;
  flex-shrink: 0;
  margin: 0;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.4;
  color: theme.$gray_5;
  word-break: break-word;
}

/* The tier badge, then what the node runs in quiet grey, with icons. */
.tile-caps {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_5;

  .sep {
    color: theme.$gray_3;
  }
}
.tile-caps > .tier-badge {
  margin-right: 4px;
}
.tile-cap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tile-cap-icon {
  font-size: 12px;
  color: theme.$gray_4;
}
/* An update waiting for someone else: the one cap that asks for a look. */
.tile-cap--warn {
  color: theme.$orange_2;
}

.tile-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  margin-top: auto;
  padding-top: 6px;
}
.tile-version {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: theme.$gray_4;
}
.tile-actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.tile-action {
  white-space: nowrap;
  padding: 3px 10px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: theme.$white;
  font: inherit;
  font-size: 12px;
  color: theme.$gray_6;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: theme.$purple_1;
    color: theme.$purple_3;
  }
  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
  &--open {
    border-color: theme.$purple_3;
    background: theme.$purple_3;
    color: theme.$white;
    &:hover:not(:disabled) {
      background: theme.$purple_2;
      color: theme.$white;
    }
  }
  &--warn {
    border-color: theme.$orange_1;
    color: theme.$orange_2;
    &:hover:not(:disabled) {
      background: theme.$orange_tint;
      border-color: theme.$orange_1;
      color: theme.$orange_2;
    }
  }
}
@media (hover: none) {
  .tile-actions {
    opacity: 1;
  }
}
</style>
