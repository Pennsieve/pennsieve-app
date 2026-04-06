<template>
  <div class="storage-nodes-form">
    <div class="section-header">
      <div>
        <h2>Storage Nodes</h2>
        <p class="section-description">
          Storage nodes provide external storage locations for datasets in this workspace.
          Creation and management of storage nodes is currently handled by Pennsieve administrators.
          Contact <a href="mailto:support@pennsieve.net">support@pennsieve.net</a> to request a new storage node.
        </p>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state" v-loading="true" element-loading-background="transparent">
      <div style="height: 120px" />
    </div>

    <template v-else-if="showEmptyState">
      <div class="empty-state">
        <p>No storage nodes are attached to this workspace.</p>
        <p class="empty-hint">
          Contact <a href="mailto:support@pennsieve.net">support@pennsieve.net</a> to request a storage node for this workspace.
        </p>
      </div>
    </template>

    <template v-else>
      <div class="nodes-list">
        <storage-node-card
          v-for="node in storageNodes"
          :key="node.uuid"
          :node="node"
          :has-admin-rights="hasAdminRights"
          :is-updating="isNodeUpdating(node.uuid)"
          @update-status="handleStatusUpdate"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useStorageResourcesStore } from '@/stores/storageResourcesStore'
import StorageNodeCard from './StorageNodeCard.vue'

const store = useStore()
const storageResourcesStore = useStorageResourcesStore()

const activeOrganization = computed(() => store.getters.activeOrganization)
const currentOrganization = computed(() => activeOrganization.value?.organization)
const orgId = computed(() => currentOrganization.value?.nodeId || currentOrganization.value?.id)

const hasAdminRights = computed(() => {
  if (activeOrganization.value) {
    return activeOrganization.value.isAdmin || activeOrganization.value.isOwner
  }
  return false
})

const statusOrder = { 'enabled': 0, 'disabled': 1 }

const storageNodes = computed(() => {
  const scope = orgId.value ? `workspace:${orgId.value}` : 'account-owner'
  const nodes = storageResourcesStore.getScopedStorageNodes(scope) || []
  return [...nodes].sort((a, b) => {
    const statusA = statusOrder[(a.status || 'enabled').toLowerCase()] ?? 2
    const statusB = statusOrder[(b.status || 'enabled').toLowerCase()] ?? 2
    if (statusA !== statusB) return statusA - statusB
    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
  })
})

const isLoading = computed(() => {
  const scope = orgId.value ? `workspace:${orgId.value}` : 'account-owner'
  return storageResourcesStore.isScopeLoading(scope)
})

const showEmptyState = computed(() => !isLoading.value && storageNodes.value.length === 0)

function isNodeUpdating(nodeId) {
  return storageResourcesStore.isNodeUpdating(nodeId)
}

async function handleStatusUpdate(node, newStatus) {
  try {
    await storageResourcesStore.updateStorageNode(node.uuid, { status: newStatus })
    ElMessage.success(`Storage node status updated to ${newStatus}`)
  } catch (error) {
    console.error('Failed to update storage node status:', error)
    ElMessage.error('Failed to update storage node status')
  }
}

onMounted(() => {
  if (orgId.value) {
    storageResourcesStore.fetchStorageNodes(orgId.value)
  }
})
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.storage-nodes-form {
  max-width: 800px;
}

.section-header {
  margin-bottom: 24px;

  h2 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .section-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0;

    a {
      color: theme.$purple_3;
    }
  }
}

.nodes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  padding: 40px 24px;
  text-align: center;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;

  p {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 8px 0;
  }

  .empty-hint {
    font-size: 13px;
    color: theme.$gray_4;
  }
}

.loading-state {
  min-height: 120px;
}
</style>
