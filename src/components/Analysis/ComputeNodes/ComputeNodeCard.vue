<template>
  <div class="node-card">
    <div class="node-header">
      <div class="node-info">
        <h3>
          <router-link
            :to="detailRoute"
            class="node-name-link"
          >
            {{ node.name }}
          </router-link>
        </h3>
        <div class="node-subtitle">
          {{ getAccountTypeLabel(node.account?.accountType) }} account
        </div>
        <div class="node-description" v-if="node.description">
          {{ node.description }}
        </div>
        <div v-if="ownerName" class="node-owner">
          Owned by {{ ownerName }}
        </div>
        <div class="node-tags">
          <el-tooltip
            :content="deploymentModeTooltip"
            placement="top"
            :show-after="300"
            :popper-style="{ maxWidth: '320px' }"
          >
            <span class="tag" :class="node.deploymentMode || 'basic'">
              {{ (node.deploymentMode || 'basic').charAt(0).toUpperCase() + (node.deploymentMode || 'basic').slice(1) }}
            </span>
          </el-tooltip>
          <span v-if="node.defaultComputeType" class="tag compute-type">{{ node.defaultComputeType }}</span>
          <span v-if="node.enableLLMAccess === true || node.enableLLMAccess === 'true'" class="tag llm">AI</span>
          <span v-if="node.maxGpuInstances > 0" class="tag gpu">GPU</span>
          <el-tooltip
            v-if="node.maxInteractiveSessions > 0"
            content="Runs notebook sessions"
            placement="top"
            :show-after="300"
          >
            <span class="tag interactive">Notebooks</span>
          </el-tooltip>
          <el-tooltip
            v-if="hasProvisionerUpdate && !canUpdateNode"
            :content="`This node is running version ${node.provisionerImageTag || 'latest'}. Version ${node.latestVersion} is available. The node owner or a workspace admin (if the node is Admin Managed) can update it.`"
            placement="top"
            :show-after="300"
            :popper-style="{ maxWidth: '320px' }"
          >
            <span class="tag update">Update available</span>
          </el-tooltip>
        </div>
      </div>
      <div class="node-header-actions">
        <div class="node-status-badge" @click.stop v-if="canManagePermissions && getStatusForNode(node) !== 'Pending' && getStatusForNode(node) !== 'Destroying' && getStatusForNode(node) !== 'Failed'">
          <el-select
            :model-value="getStatusForNode(node)"
            @change="(value) => updateStatus(value)"
            :loading="isUpdatingPermissions"
            size="small"
            :class="['status-select', getStatusForNode(node).toLowerCase()]"
            @click.stop
          >
            <el-option label="Enabled" value="Enabled" />
            <el-option label="Paused" value="Paused" />
          </el-select>
        </div>
        <div class="node-status-badge" @click.stop v-else>
          <span
            :class="['node-status-badge', getStatusForNode(node).toLowerCase()]"
          >
            {{ getStatusForNode(node) }}
          </span>
        </div>
      </div>
    </div>

    <div class="node-card-actions">
      <el-tooltip
        v-if="hasProvisionerUpdate && canUpdateNode"
        :content="`This node is running version ${node.provisionerImageTag || 'latest'}. Version ${node.latestVersion} is available. Updating re-provisions the node with the latest infrastructure changes in your cloud account and typically takes 6-8 minutes.`"
        placement="top"
        :show-after="300"
        :popper-style="{ maxWidth: '320px' }"
      >
        <button
          class="card-action-button update"
          :disabled="isUpdatingPermissions"
          @click.stop="updateNode"
        >
          {{ isUpdatingPermissions ? 'Updating...' : 'Update node' }}
        </button>
      </el-tooltip>
      <router-link
        :to="detailRoute"
        class="card-action-link"
      >
        <span>View details</span>
        <span class="arrow">&rarr;</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'

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

// Link to the node's page in the current context: the workspace's route under
// /:orgId, or My Workspace's when there is no workspace.
const route = useRoute()
const detailRoute = computed(() => ({
  name: route.params.orgId ? 'compute-node-management' : 'my-compute-node-management',
  params: { nodeId: props.node.uuid }
}))

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

const ownerName = computed(() => {
  const member = store.getters.getOrgMember(props.node.ownerId)
  if (member?.firstName) {
    return `${member.firstName} ${member.lastName}`.trim()
  }
  return null
})

const deploymentModeTooltip = computed(() => {
  const mode = (props.node.deploymentMode || 'basic').toLowerCase()
  switch (mode) {
    case 'basic':
      return 'Basic — Lowest cost option for development and testing. Processors run with direct internet access. Uses standard AWS encryption.'
    case 'secure':
      return 'Secure — Production-ready with network isolation. Processors run in private subnets with full internet access via NAT. Includes KMS encryption and network audit logs.'
    case 'compliant':
      return 'Compliant — For regulated environments (HIPAA, NIST). No internet access — all traffic stays within the AWS network. Includes KMS encryption and network audit logs.'
    default:
      return ''
  }
})

function getAccountTypeLabel(type) {
  switch (type) {
    case 'AWS': return 'Amazon Web Services'
    case 'GCP': return 'Google Cloud Platform'
    case 'AZURE': return 'Microsoft Azure'
    default: return type || 'Unknown'
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

.node-card {
  background: white;
  border: 1px solid theme.$gray_2;
  padding: 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
  }
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.node-info {
  flex: 1;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .node-name-link {
    color: theme.$gray_6;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: theme.$purple_2;
      text-decoration: underline;
    }
  }
}

.node-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 6px;
  font-weight: 400;
}

.node-description {
  font-size: 14px;
  color: theme.$gray_5;
  margin: 8px 0;
  line-height: 1.4;
}

.node-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.basic {
      background: rgba(theme.$gray_4, 0.1);
      color: theme.$gray_4;
    }

    &.secure {
      background: rgba(theme.$teal_1, 0.1);
      color: theme.$teal_2;
    }

    &.compliant {
      background: rgba(theme.$purple_1, 0.1);
      color: theme.$purple_2;
    }

    &.llm {
      background: rgba(theme.$green_1, 0.1);
      color: theme.$green_2;
    }

    &.gpu {
      background: rgba(theme.$orange_1, 0.1);
      color: theme.$orange_2;
    }

    &.interactive {
      background: rgba(theme.$purple_3, 0.1);
      color: theme.$purple_3; /* brand navy */
    }

    &.update {
      background: rgba(theme.$orange_1, 0.12);
      color: theme.$orange_2;
    }
  }
}

.node-owner {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 4px;

  strong {
    color: theme.$gray_6;
    font-weight: 500;
  }
}

.node-header-actions {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.node-status-badge {
  display: inline-block;
  text-align: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.pending {
    background: rgba(theme.$gray_4, 0.1);
    color: theme.$gray_4;
    border: 1px solid rgba(theme.$gray_4, 0.2);
  }

  &.enabled {
    background: rgba(theme.$green_1, 0.1);
    color: theme.$green_2;
    border: 1px solid rgba(theme.$green_1, 0.2);
  }

  &.paused {
    background: rgba(theme.$orange_1, 0.1);
    color: theme.$orange_2;
    border: 1px solid rgba(theme.$orange_1, 0.2);
  }

  &.destroying {
    background: rgba(theme.$orange_1, 0.1);
    color: theme.$orange_2;
    border: 1px solid rgba(theme.$orange_1, 0.2);
  }

  &.failed {
    background: rgba(theme.$red_1, 0.1);
    color: theme.$red_2;
    border: 1px solid rgba(theme.$red_1, 0.2);
  }
}

.status-select {
  min-width: 120px;

  :deep(.el-select__wrapper) {
    min-width: 120px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    height: 28px;
    padding: 4px 12px;
    transition: all 0.2s ease;
    box-shadow: none;

    &:hover {
      border-color: theme.$gray_3;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    &.is-focused {
      border-color: theme.$purple_2;
      box-shadow: 0 0 0 2px rgba(theme.$purple_2, 0.1);
    }
  }

  :deep(.el-input__inner) {
    color: theme.$gray_6;
    text-align: left;
    font-size: 12px;
    font-weight: 500;
  }

  :deep(.el-select__caret) {
    color: theme.$gray_4;
  }

  &.enabled {
    :deep(.el-select__wrapper) {
      background: rgba(theme.$green_1, 0.08);
      border-color: rgba(theme.$green_1, 0.2);

      &:hover {
        background: rgba(theme.$green_1, 0.12);
        border-color: rgba(theme.$green_1, 0.3);
      }
    }

    :deep(.el-input__inner) {
      color: theme.$green_2;
    }

    :deep(.el-select__caret) {
      color: theme.$green_2;
    }
  }

  &.paused {
    :deep(.el-select__wrapper) {
      background: rgba(theme.$orange_1, 0.08);
      border-color: rgba(theme.$orange_1, 0.2);

      &:hover {
        background: rgba(theme.$orange_1, 0.12);
        border-color: rgba(theme.$orange_1, 0.3);
      }
    }

    :deep(.el-input__inner) {
      color: theme.$orange_2;
    }

    :deep(.el-select__caret) {
      color: theme.$orange_2;
    }
  }
}

.node-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid theme.$gray_2;
  flex-wrap: wrap;
}

.card-action-button {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 4px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &.update {
    background: rgba(theme.$orange_1, 0.12);
    border: 1px solid rgba(theme.$orange_1, 0.4);
    color: theme.$orange_2;

    &:hover:not(:disabled) {
      background: rgba(theme.$orange_1, 0.2);
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.card-action-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$purple_3;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  .arrow {
    transition: transform 0.15s ease;
  }

  &:hover .arrow {
    transform: translateX(2px);
  }
}
</style>
