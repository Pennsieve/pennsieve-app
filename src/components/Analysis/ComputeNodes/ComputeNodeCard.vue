<template>
  <div class="node-card">
    <div class="node-header">
      <div class="node-info">
        <h3>
          <router-link
            :to="{ name: 'compute-node-management', params: { nodeId: node.uuid } }"
            class="node-name-link"
          >
            {{ node.name }}
          </router-link>
        </h3>
        <div class="node-subtitle">
          {{ getAccountTypeLabel(node.account?.accountType) }} Account
        </div>
        <div class="node-description" v-if="node.description">
          {{ node.description }}
        </div>
        <div class="node-account">
          <strong>Account ID:</strong> {{ formatAccountId(node.account?.accountId) }}
        </div>
        <div class="node-identifier">
          <strong>Node UUID:</strong> {{ node.uuid }}
        </div>
        <div v-if="ownerName" class="node-owner">
          <strong>Node Owner:</strong> {{ ownerName }}
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
          <span v-if="node.enableLLMAccess === true || node.enableLLMAccess === 'true'" class="tag llm">LLM</span>
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
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'
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

const isNodeOwner = computed(() => {
  return props.node.ownerId === profile.value?.id
})

const canManagePermissions = computed(() => isNodeOwner.value)

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

function formatAccountId(accountId) {
  if (!accountId) return ''
  if (accountId.length === 12) {
    return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`
  }
  return accountId
}

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
      background: rgba(#6B7280, 0.1);
      color: #6B7280;
    }

    &.secure {
      background: rgba(#3B82F6, 0.1);
      color: #2563EB;
    }

    &.compliant {
      background: rgba(#8B5CF6, 0.1);
      color: #7C3AED;
    }

    &.llm {
      background: rgba(#10B981, 0.1);
      color: #059669;
    }
  }
}

.node-account,
.node-identifier,
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
    background: rgba(#6B7280, 0.1);
    color: #6B7280;
    border: 1px solid rgba(#6B7280, 0.2);
  }

  &.enabled {
    background: rgba(#10B981, 0.1);
    color: #059669;
    border: 1px solid rgba(#10B981, 0.2);
  }

  &.paused {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
    border: 1px solid rgba(#F59E0B, 0.2);
  }

  &.destroying {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
    border: 1px solid rgba(#F59E0B, 0.2);
  }

  &.failed {
    background: rgba(#EF4444, 0.1);
    color: #DC2626;
    border: 1px solid rgba(#EF4444, 0.2);
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
      background: rgba(#10B981, 0.08);
      border-color: rgba(#10B981, 0.2);

      &:hover {
        background: rgba(#10B981, 0.12);
        border-color: rgba(#10B981, 0.3);
      }
    }

    :deep(.el-input__inner) {
      color: #059669;
    }

    :deep(.el-select__caret) {
      color: #059669;
    }
  }

  &.paused {
    :deep(.el-select__wrapper) {
      background: rgba(#F59E0B, 0.08);
      border-color: rgba(#F59E0B, 0.2);

      &:hover {
        background: rgba(#F59E0B, 0.12);
        border-color: rgba(#F59E0B, 0.3);
      }
    }

    :deep(.el-input__inner) {
      color: #D97706;
    }

    :deep(.el-select__caret) {
      color: #D97706;
    }
  }
}
</style>
