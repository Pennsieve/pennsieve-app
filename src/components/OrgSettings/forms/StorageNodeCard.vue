<template>
  <div class="storage-node-card">
    <div class="node-header">
      <div class="node-info">
        <h3>{{ node.name }}</h3>
        <div class="node-subtitle">
          {{ getProviderLabel(node.providerType) }}
        </div>
        <div v-if="node.description" class="node-description">
          {{ node.description }}
        </div>
        <div class="node-details">
          <div class="detail-row">
            <strong>Location:</strong> {{ node.storageLocation }}
          </div>
          <div v-if="node.region" class="detail-row">
            <strong>Region:</strong> {{ node.region }}
          </div>
          <div v-if="node.accountName" class="detail-row">
            <strong>Compute Resource:</strong> {{ node.accountName }}
          </div>
          <div v-if="ownerName" class="detail-row">
            <strong>Owner:</strong> {{ ownerName }}
          </div>
        </div>
        <div class="node-tags">
          <span class="tag" :class="node.providerType">
            {{ (node.providerType || 'unknown').toUpperCase() }}
          </span>
        </div>
      </div>
      <div class="node-header-actions">
        <div class="node-status-badge" @click.stop v-if="hasAdminRights">
          <el-select
            :model-value="getStatusLabel(node.status)"
            @change="(value) => $emit('update-status', node, value)"
            :loading="isUpdating"
            size="small"
            :class="['status-select', getStatusLabel(node.status).toLowerCase()]"
            @click.stop
          >
            <el-option label="Enabled" value="Enabled" />
            <el-option label="Disabled" value="Disabled" />
          </el-select>
        </div>
        <div class="node-status-badge" v-else>
          <span :class="['status-label', getStatusLabel(node.status).toLowerCase()]">
            {{ getStatusLabel(node.status) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'

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

defineEmits(['update-status'])

const store = useStore()
const orgMembers = computed(() => store.state.orgMembers || [])
const profile = computed(() => store.state.profile)

const ownerName = computed(() => {
  const ownerId = props.node.accountOwnerId
  if (!ownerId) return null
  if (profile.value && profile.value.id === ownerId) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || 'You'
  }
  const member = orgMembers.value.find(m => m.id === ownerId)
  if (member) return `${member.firstName} ${member.lastName}`.trim()
  return ownerId.includes(':') ? ownerId.split(':').pop() : ownerId
})

function getProviderLabel(type) {
  switch (type) {
    case 's3': return 'Amazon S3'
    case 'azure-blob': return 'Azure Blob Storage'
    case 'local': return 'Local Storage'
    default: return type || 'Unknown'
  }
}

function getStatusLabel(status) {
  if (!status) return 'Enabled'
  switch (status.toLowerCase()) {
    case 'enabled': return 'Enabled'
    case 'disabled': return 'Disabled'
    default: return status
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.storage-node-card {
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

.node-details {
  margin-top: 8px;
}

.detail-row {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 4px;

  strong {
    color: theme.$gray_6;
    font-weight: 500;
  }
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

    &.s3 {
      background: rgba(#F59E0B, 0.1);
      color: #D97706;
    }

    &.azure-blob {
      background: rgba(#3B82F6, 0.1);
      color: #2563EB;
    }

    &.local {
      background: rgba(#6B7280, 0.1);
      color: #6B7280;
    }
  }
}

.node-header-actions {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.status-label {
  display: inline-block;
  text-align: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.enabled {
    background: rgba(#10B981, 0.1);
    color: #059669;
    border: 1px solid rgba(#10B981, 0.2);
  }

  &.disabled {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
    border: 1px solid rgba(#F59E0B, 0.2);
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

  &.enabled :deep(.el-select__wrapper) {
    background: rgba(#10B981, 0.1);
    color: #059669;
  }

  &.disabled :deep(.el-select__wrapper) {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
  }
}
</style>
