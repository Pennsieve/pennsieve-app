<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import IconRemove from '@/components/icons/IconRemove.vue'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import { useStorageResourcesStore } from '@/stores/storageResourcesStore'

const store = useStore()
const route = useRoute()
const router = useRouter()
const computeResourcesStore = useComputeResourcesStore()
const storageResourcesStore = useStorageResourcesStore()

const profile = computed(() => store.state.profile)
const orgMembers = computed(() => store.state.orgMembers || [])
const accountId = computed(() => route.params.accountId)

const ACCOUNT_OWNER_SCOPE = 'account-owner'

// Account data
const account = computed(() => {
  const accounts = computeResourcesStore.computeAccounts || []
  return accounts.find(a => a.uuid === accountId.value) || null
})

// Compute nodes for this account
const accountComputeNodes = computed(() => {
  const allNodes = computeResourcesStore.getScopedComputeNodes(ACCOUNT_OWNER_SCOPE) || []
  return allNodes.filter(node => node.account?.accountId === account.value?.accountId)
})

// Storage nodes for this account
const accountStorageNodes = computed(() => {
  const allNodes = storageResourcesStore.getScopedStorageNodes(ACCOUNT_OWNER_SCOPE) || []
  return allNodes.filter(node => node.accountUuid === accountId.value)
})

// Enabled workspaces from the account
const enabledWorkspaces = computed(() => account.value?.enabledWorkspaces || [])

// Group compute nodes by workspace
const computeNodesByWorkspace = computed(() => {
  const groups = {}
  for (const ws of enabledWorkspaces.value) {
    const wsNodes = accountComputeNodes.value.filter(n => n.organizationId === ws.organizationId)
    groups[ws.organizationId] = wsNodes
  }
  return groups
})

// Independent compute nodes (no organizationId)
const independentComputeNodes = computed(() => {
  return accountComputeNodes.value.filter(n => !n.organizationId)
})

// Admin workspaces
const adminWorkspaces = computed(() => {
  const organizations = store.state.organizations || []
  return organizations.filter(org => org.isAdmin === true).map(org => ({
    id: org.organization?.id || org.id,
    name: org.organization?.name || org.name,
    role: org.role || (org.isAdmin ? 'admin' : 'viewer')
  }))
})

// Edit state
const isEditing = ref(false)
const editingData = ref({ name: '', description: '' })

// Workspace dialogs
const showAddWorkspaceDialog = ref(false)
const showRemoveWorkspaceDialog = ref(false)
const selectedWorkspaceForRemoval = ref(null)
const newWorkspaceAccess = ref({ isPublic: false, enableCompute: true, enableStorage: true, organizationId: null })
const workspaceOperations = ref(new Set())

// Workspace expansion state
const expandedWorkspaces = ref(new Set())

function toggleWorkspaceExpansion(orgId) {
  const newSet = new Set(expandedWorkspaces.value)
  if (newSet.has(orgId)) {
    newSet.delete(orgId)
  } else {
    newSet.add(orgId)
  }
  expandedWorkspaces.value = newSet
}

function isWorkspaceExpanded(orgId) {
  return expandedWorkspaces.value.has(orgId)
}

function getComputeNodesForWorkspace(orgId) {
  return accountComputeNodes.value.filter(n => n.organizationId === orgId)
}

function getStorageNodesForWorkspace(orgId) {
  return accountStorageNodes.value.filter(n => {
    return (n.workspaces || []).some(ws => ws.workspaceId === orgId)
  })
}

// Loading
const isLoading = ref(true)

onMounted(async () => {
  try {
    await computeResourcesStore.fetchComputeAccounts()
    await Promise.all([
      computeResourcesStore.fetchScopedComputeNodes(ACCOUNT_OWNER_SCOPE),
      storageResourcesStore.fetchScopedStorageNodes(ACCOUNT_OWNER_SCOPE),
    ])
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    isLoading.value = false
  }
})

// Helpers
function formatAccountId(id) {
  if (!id) return ''
  if (id.length === 12) return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8)}`
  return id
}

function getResourceTypeLabel(type) {
  switch (type) {
    case 'AWS': return 'Amazon Web Services'
    case 'GCP': return 'Google Cloud Platform'
    case 'AZURE': return 'Microsoft Azure'
    default: return type || 'Unknown'
  }
}

function getWorkspaceNameById(orgId) {
  const ws = adminWorkspaces.value.find(w => w.id === orgId)
  if (ws) return ws.name
  const orgs = store.state.organizations || []
  const org = orgs.find(o => (o.organization?.id || o.id) === orgId)
  if (org) return org.organization?.name || org.name
  return orgId?.split(':').pop() || orgId
}

function getUserName(userId) {
  if (!userId) return 'Unknown'
  if (profile.value && profile.value.id === userId) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || 'You'
  }
  const member = orgMembers.value.find(m => m.id === userId)
  if (member) return `${member.firstName} ${member.lastName}`.trim() || 'Unknown User'
  return String(userId).includes(':') ? String(userId).split(':').pop() : String(userId)
}

function getNodeStatus(node) {
  if (!node.status) return 'Pending'
  const s = node.status.charAt(0).toUpperCase() + node.status.slice(1).toLowerCase()
  switch (s) {
    case 'Enabled': case 'Active': case 'Running': case 'Ready': return 'Enabled'
    case 'Paused': case 'Stopped': case 'Disabled': return 'Paused'
    case 'Pending': return 'Pending'
    case 'Destroying': return 'Destroying'
    case 'Failed': return 'Failed'
    default: return s
  }
}

function getStorageNodeStatus(status) {
  if (!status) return 'Enabled'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function getProviderTypeLabel(type) {
  switch (type) {
    case 's3': return 'Amazon S3'
    case 'azure-blob': return 'Azure Blob'
    case 'local': return 'Local'
    default: return type || 'Unknown'
  }
}

// Account editing
function startEditing() {
  editingData.value = {
    name: account.value?.name || '',
    description: account.value?.description || ''
  }
  isEditing.value = true
}

function cancelEditing() {
  isEditing.value = false
}

async function saveChanges() {
  try {
    await computeResourcesStore.updateAccount(accountId.value, {
      name: editingData.value.name || null,
      description: editingData.value.description || null,
    })
    isEditing.value = false
    ElMessage.success('Account updated')
  } catch (error) {
    console.error('Failed to update account:', error)
    ElMessage.error('Failed to update account')
  }
}

async function updateAccountStatus(newStatus) {
  try {
    await computeResourcesStore.updateAccountStatus(accountId.value, newStatus)
  } catch (error) {
    console.error('Failed to update status:', error)
    ElMessage.error('Failed to update status')
  }
}

// Compute workspace management
function getAvailableWorkspacesForCompute() {
  const enabledIds = enabledWorkspaces.value.map(ws => ws.organizationId)
  return adminWorkspaces.value.filter(ws => !enabledIds.includes(ws.id))
}

function openAddWorkspaceDialog() {
  const available = getAvailableWorkspacesForCompute()
  newWorkspaceAccess.value = {
    isPublic: false,
    enableCompute: true,
    enableStorage: true,
    organizationId: available.length === 1 ? available[0].id : null
  }
  showAddWorkspaceDialog.value = true
}

function closeAddWorkspaceDialog() {
  showAddWorkspaceDialog.value = false
  newWorkspaceAccess.value = { isPublic: false, enableCompute: true, enableStorage: true, organizationId: null }
}

async function handleAddWorkspace() {
  if (!newWorkspaceAccess.value.organizationId) return
  const opKey = `${accountId.value}-add`
  workspaceOperations.value.add(opKey)
  try {
    await computeResourcesStore.addWorkspaceAccess(
      accountId.value,
      newWorkspaceAccess.value.organizationId,
      newWorkspaceAccess.value.isPublic,
      newWorkspaceAccess.value.enableCompute,
      newWorkspaceAccess.value.enableStorage
    )
    closeAddWorkspaceDialog()
    ElMessage.success('Workspace enabled')
  } catch (error) {
    console.error('Failed to add workspace:', error)
    if (error.message?.includes('already enabled')) {
      ElMessage.warning('This account is already enabled for the selected workspace.')
    } else {
      ElMessage.error('Failed to enable workspace')
    }
  } finally {
    workspaceOperations.value.delete(opKey)
  }
}

function openRemoveWorkspaceDialog(orgId) {
  selectedWorkspaceForRemoval.value = orgId
  showRemoveWorkspaceDialog.value = true
}

function closeRemoveWorkspaceDialog() {
  showRemoveWorkspaceDialog.value = false
  selectedWorkspaceForRemoval.value = null
}

async function confirmRemoveWorkspace() {
  if (!selectedWorkspaceForRemoval.value) return
  const orgId = selectedWorkspaceForRemoval.value
  const opKey = `${accountId.value}-${orgId}`
  workspaceOperations.value.add(opKey)
  try {
    await computeResourcesStore.removeWorkspaceAccess(accountId.value, orgId)
    closeRemoveWorkspaceDialog()
    ElMessage.success('Workspace access removed')
  } catch (error) {
    console.error('Failed to remove workspace:', error)
    if (error.message?.includes('active compute or storage nodes') || error.message?.includes('409')) {
      ElMessage.warning('Cannot remove workspace access: active compute or storage nodes exist. Remove them first.')
    } else {
      ElMessage.error('Failed to remove workspace access')
    }
  } finally {
    workspaceOperations.value.delete(opKey)
  }
}

// Storage workspace management
function getAvailableWorkspacesForStorageNode(node) {
  const existingIds = (node?.workspaces || []).map(w => w.workspaceId)
  return adminWorkspaces.value.filter(ws => !existingIds.includes(ws.id))
}

function openAttachStorageDialog(node) {
  selectedStorageNode.value = node
  const available = getAvailableWorkspacesForStorageNode(node)
  newStorageWorkspace.value = {
    organizationId: available.length === 1 ? available[0].id : null,
    isDefault: false
  }
  showAttachStorageDialog.value = true
}

function closeAttachStorageDialog() {
  showAttachStorageDialog.value = false
  selectedStorageNode.value = null
  newStorageWorkspace.value = { organizationId: null, isDefault: false }
}

async function handleAttachStorageWorkspace() {
  if (!selectedStorageNode.value || !newStorageWorkspace.value.organizationId) return
  const nodeUuid = selectedStorageNode.value.uuid
  const opKey = `${nodeUuid}-attach`
  storageWorkspaceOperations.value.add(opKey)
  try {
    await storageResourcesStore.attachWorkspace(nodeUuid, newStorageWorkspace.value.organizationId, newStorageWorkspace.value.isDefault)
    await storageResourcesStore.fetchScopedStorageNodes(ACCOUNT_OWNER_SCOPE, null, true)
    closeAttachStorageDialog()
    ElMessage.success('Workspace attached to storage node')
  } catch (error) {
    console.error('Failed to attach workspace:', error)
    ElMessage.error('Failed to attach workspace')
  } finally {
    storageWorkspaceOperations.value.delete(opKey)
  }
}

function openDetachStorageDialog(node, workspaceId) {
  selectedStorageNode.value = node
  selectedStorageWorkspaceForDetach.value = workspaceId
  showDetachStorageDialog.value = true
}

function closeDetachStorageDialog() {
  showDetachStorageDialog.value = false
  selectedStorageNode.value = null
  selectedStorageWorkspaceForDetach.value = null
}

async function confirmDetachStorageWorkspace() {
  if (!selectedStorageNode.value || !selectedStorageWorkspaceForDetach.value) return
  const nodeUuid = selectedStorageNode.value.uuid
  const wsId = selectedStorageWorkspaceForDetach.value
  const opKey = `${nodeUuid}-${wsId}`
  storageWorkspaceOperations.value.add(opKey)
  try {
    await storageResourcesStore.detachWorkspace(nodeUuid, wsId)
    await storageResourcesStore.fetchScopedStorageNodes(ACCOUNT_OWNER_SCOPE, null, true)
    closeDetachStorageDialog()
    ElMessage.success('Workspace detached from storage node')
  } catch (error) {
    console.error('Failed to detach workspace:', error)
    ElMessage.error('Failed to detach workspace')
  } finally {
    storageWorkspaceOperations.value.delete(opKey)
  }
}

function isStorageOpLoading(nodeUuid) {
  return [...storageWorkspaceOperations.value].some(k => k.startsWith(nodeUuid))
}
</script>

<template>
  <bf-stage element-loading-background="transparent" v-loading="isLoading">
    <div class="resource-detail" v-if="account">
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header-top">
          <h1>{{ account.name || getResourceTypeLabel(account.accountType) + ' Account' }}</h1>
          <div class="page-header-right">
            <el-select
              :model-value="(account.status || 'Enabled')"
              @change="updateAccountStatus"
              size="default"
              :class="['status-select', (account.status || 'enabled').toLowerCase()]"
            >
              <el-option label="Enabled" value="Enabled" />
              <el-option label="Paused" value="Paused" />
            </el-select>
          </div>
        </div>
        <p class="page-subtitle">{{ getResourceTypeLabel(account.accountType) }} Account</p>
        <p class="page-description" v-if="account.description">{{ account.description }}</p>
      </div>

      <!-- Account Information Section -->
      <div class="management-section">
        <div class="section-header">
          <h2>Account Information</h2>
          <div class="section-actions">
            <bf-button v-if="!isEditing" @click="startEditing" class="secondary small">Edit</bf-button>
            <div v-else class="edit-actions">
              <bf-button @click="saveChanges" class="primary small">Save</bf-button>
              <bf-button @click="cancelEditing" class="secondary small">Cancel</bf-button>
            </div>
          </div>
        </div>
        <div class="info-content">
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value" v-if="!isEditing">{{ account.name || '' }}</span>
            <div class="info-value" v-else>
              <el-input v-model="editingData.name" placeholder="Account name" size="default" />
            </div>
          </div>
          <div class="info-row">
            <span class="info-label">Description:</span>
            <span class="info-value" v-if="!isEditing">
              <span v-if="account.description">{{ account.description }}</span>
              <span v-else class="empty-value">No description set</span>
            </span>
            <div class="info-value" v-else>
              <el-input v-model="editingData.description" type="textarea" placeholder="Description" :rows="2" size="default" />
            </div>
          </div>
          <div class="info-row">
            <span class="info-label">Account Type:</span>
            <span class="info-value">{{ getResourceTypeLabel(account.accountType) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Account ID:</span>
            <span class="info-value mono">{{ formatAccountId(account.accountId) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">UUID:</span>
            <span class="info-value mono">{{ account.uuid }}</span>
          </div>
        </div>
      </div>

      <!-- Workspace Access Section -->
      <div class="management-section">
        <div class="section-header">
          <h2>Workspace Access</h2>
          <div class="section-actions">
            <bf-button @click="openAddWorkspaceDialog" class="secondary small">Enable Workspace</bf-button>
          </div>
        </div>

        <p class="section-description">
          Enable workspaces to allow compute and storage node creation on this account.
          Click a workspace to view its compute and storage nodes.
        </p>

        <div v-if="enabledWorkspaces.length > 0" class="workspace-cards">
          <div
            v-for="ws in enabledWorkspaces"
            :key="ws.organizationId"
            class="workspace-card"
            :class="{ expanded: isWorkspaceExpanded(ws.organizationId) }"
          >
            <!-- Workspace header (always visible, clickable) -->
            <div class="workspace-card-header" @click="toggleWorkspaceExpansion(ws.organizationId)">
              <div class="workspace-card-info">
                <strong>{{ getWorkspaceNameById(ws.organizationId) }}</strong>
                <div class="workspace-badges">
                  <span class="badge" :class="ws.isPublic ? 'admin' : 'private'">
                    {{ ws.isPublic ? 'Admin Managed' : 'Private' }}
                  </span>
                  <span v-if="ws.enableCompute" class="badge compute">Compute</span>
                  <span v-if="ws.enableStorage" class="badge storage">Storage</span>
                </div>
              </div>
              <div class="workspace-card-actions">
                <button class="remove-button" @click.stop="openRemoveWorkspaceDialog(ws.organizationId)" title="Remove workspace access">
                  <IconRemove :width="14" :height="14" />
                </button>
                <span class="chevron" :class="{ open: isWorkspaceExpanded(ws.organizationId) }">▾</span>
              </div>
            </div>

            <!-- Expanded content -->
            <div v-if="isWorkspaceExpanded(ws.organizationId)" class="workspace-card-content">
              <!-- Compute Nodes sub-section -->
              <div class="ws-subsection">
                <h4>
                  Compute Nodes
                  <span class="subsection-count" v-if="getComputeNodesForWorkspace(ws.organizationId).length">
                    ({{ getComputeNodesForWorkspace(ws.organizationId).length }})
                  </span>
                </h4>
                <div v-if="getComputeNodesForWorkspace(ws.organizationId).length > 0" class="ws-node-list">
                  <div
                    v-for="node in getComputeNodesForWorkspace(ws.organizationId)"
                    :key="node.uuid"
                    class="ws-node-row"
                  >
                    <div class="ws-node-info">
                      <span class="ws-node-name">{{ node.name || 'Unnamed Node' }}</span>
                      <span class="ws-node-meta">{{ getUserName(node.ownerId || node.userId) }}</span>
                    </div>
                    <span :class="['status-badge', getNodeStatus(node).toLowerCase()]">
                      {{ getNodeStatus(node) }}
                    </span>
                  </div>
                </div>
                <div v-else class="empty-hint">No compute nodes in this workspace.</div>
              </div>

              <!-- Storage Nodes sub-section -->
              <div class="ws-subsection">
                <h4>
                  Storage Nodes
                  <span class="subsection-count" v-if="getStorageNodesForWorkspace(ws.organizationId).length">
                    ({{ getStorageNodesForWorkspace(ws.organizationId).length }})
                  </span>
                </h4>
                <div v-if="getStorageNodesForWorkspace(ws.organizationId).length > 0" class="ws-node-list">
                  <div
                    v-for="node in getStorageNodesForWorkspace(ws.organizationId)"
                    :key="node.uuid"
                    class="ws-node-row"
                  >
                    <div class="ws-node-info">
                      <span class="ws-node-name">{{ node.name || 'Unnamed Storage Node' }}</span>
                      <span class="ws-node-meta">
                        {{ node.storageLocation }}
                        <span class="meta-sep">·</span>
                        {{ getProviderTypeLabel(node.providerType) }}
                        <template v-if="node.region">
                          <span class="meta-sep">·</span>{{ node.region }}
                        </template>
                      </span>
                    </div>
                    <span :class="['status-badge', getStorageNodeStatus(node.status).toLowerCase()]">
                      {{ getStorageNodeStatus(node.status) }}
                    </span>
                  </div>
                </div>
                <div v-else class="empty-hint">No storage nodes in this workspace.</div>
              </div>
            </div>
          </div>

          <!-- Independent compute nodes (not in any workspace) -->
          <div v-if="independentComputeNodes.length > 0" class="workspace-card">
            <div class="workspace-card-header" @click="toggleWorkspaceExpansion('independent')">
              <div class="workspace-card-info">
                <strong>Organization-Independent</strong>
              </div>
              <div class="workspace-card-actions">
                <span class="chevron" :class="{ open: isWorkspaceExpanded('independent') }">▾</span>
              </div>
            </div>
            <div v-if="isWorkspaceExpanded('independent')" class="workspace-card-content">
              <div class="ws-subsection">
                <h4>Compute Nodes <span class="subsection-count">({{ independentComputeNodes.length }})</span></h4>
                <div class="ws-node-list">
                  <div
                    v-for="node in independentComputeNodes"
                    :key="node.uuid"
                    class="ws-node-row"
                  >
                    <div class="ws-node-info">
                      <span class="ws-node-name">{{ node.name || 'Unnamed Node' }}</span>
                      <span class="ws-node-meta">{{ getUserName(node.ownerId || node.userId) }}</span>
                    </div>
                    <span :class="['status-badge', getNodeStatus(node).toLowerCase()]">
                      {{ getNodeStatus(node) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          No workspaces enabled. Enable a workspace to allow resource creation.
        </div>
      </div>
    </div>

    <!-- Dialogs -->

    <!-- Enable Workspace for Compute Dialog -->
    <el-dialog v-model="showAddWorkspaceDialog" title="Enable Workspace" width="500px">
      <div class="dialog-content">
        <p class="dialog-description">
          Enabling a workspace allows compute and storage nodes to be created on this account
          within that workspace. Only workspaces where you have admin rights are shown.
        </p>
        <div class="form-field">
          <label>Select Workspace</label>
          <el-select v-model="newWorkspaceAccess.organizationId" placeholder="Choose a workspace" style="width: 100%" size="default">
            <el-option
              v-for="ws in getAvailableWorkspacesForCompute()"
              :key="ws.id" :label="ws.name" :value="ws.id"
            />
          </el-select>
          <p class="field-help" v-if="getAvailableWorkspacesForCompute().length === 0">
            All your admin workspaces are already enabled for this account.
          </p>
        </div>
        <div class="form-field" v-if="newWorkspaceAccess.organizationId">
          <label>Access Type</label>
          <el-checkbox v-model="newWorkspaceAccess.isPublic">
            Admin Managed
          </el-checkbox>
          <p class="field-help" v-if="!newWorkspaceAccess.isPublic">
            Only you can create and manage resources on this account in this workspace.
          </p>
          <template v-else>
            <p class="field-help">
              Workspace administrators can also create and manage resources on this account.
            </p>
            <div class="admin-permissions">
              <label>Admin Permissions</label>
              <el-checkbox v-model="newWorkspaceAccess.enableCompute">
                Can create compute nodes
              </el-checkbox>
              <el-checkbox v-model="newWorkspaceAccess.enableStorage">
                Can create storage nodes
              </el-checkbox>
            </div>
          </template>
        </div>
      </div>
      <template #footer>
        <bf-button class="secondary" @click="closeAddWorkspaceDialog">Cancel</bf-button>
        <bf-button class="primary" @click="handleAddWorkspace" :disabled="!newWorkspaceAccess.organizationId">Enable</bf-button>
      </template>
    </el-dialog>

    <!-- Remove Workspace Compute Access Dialog -->
    <el-dialog v-model="showRemoveWorkspaceDialog" title="Remove Workspace Access" width="480px" :close-on-click-modal="false">
      <div v-if="selectedWorkspaceForRemoval" class="dialog-content">
        <p class="warning-text">
          This will remove workspace access for <strong>{{ getWorkspaceNameById(selectedWorkspaceForRemoval) }}</strong>,
          preventing new compute and storage nodes from being created on this account in that workspace.
        </p>
        <p class="warning-text">
          If active compute or storage nodes exist in this workspace, they must be removed first.
        </p>
      </div>
      <template #footer>
        <bf-button class="secondary" @click="closeRemoveWorkspaceDialog">Cancel</bf-button>
        <bf-button class="red" @click="confirmRemoveWorkspace">Remove Access</bf-button>
      </template>
    </el-dialog>

  </bf-stage>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.resource-detail {
  max-width: 900px;
  margin: 0;
  padding: 0;
}

// Page header — matches ComputeNodeManagement .node-header-section
.page-header {
  margin-bottom: 32px;

  .page-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 8px;
  }

  h1 {
    font-size: 28px;
    font-weight: 300;
    color: theme.$gray_6;
    margin: 0;
  }

  .page-subtitle {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 8px 0;
  }

  .page-description {
    font-size: 16px;
    color: theme.$gray_5;
    margin: 12px 0 0 0;
    line-height: 1.5;
  }
}

// Status badge & select — matches ComputeNodeManagement
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;

  &.enabled { background: rgba(theme.$green_1, 0.1); color: theme.$green_2; }
  &.paused, &.disabled { background: rgba(theme.$orange_1, 0.1); color: theme.$orange_2; }
  &.pending { background: rgba(theme.$gray_4, 0.1); color: theme.$gray_4; }
  &.destroying { background: rgba(theme.$orange_1, 0.1); color: theme.$orange_2; }
  &.failed { background: rgba(theme.$red_1, 0.1); color: theme.$red_2; }
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
    height: 32px;
    padding: 8px 16px;
  }

  &.enabled :deep(.el-select__wrapper) {
    background: rgba(theme.$green_1, 0.1);
    color: theme.$green_2;
    border-color: rgba(theme.$green_1, 0.2);
  }

  &.paused :deep(.el-select__wrapper) {
    background: rgba(theme.$orange_1, 0.1);
    color: theme.$orange_2;
    border-color: rgba(theme.$orange_1, 0.2);
  }
}

// Card sections — matches ComputeNodeManagement .management-section
.management-section {
  background: white;
  border: 1px solid theme.$gray_2;
  margin-bottom: 24px;
  padding: 24px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid theme.$gray_2;

    h2 {
      font-size: 20px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
    }

    .section-actions {
      display: flex;
      gap: 8px;

      .edit-actions {
        display: flex;
        gap: 8px;
      }
    }
  }
}

.section-description {
  font-size: 14px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

// Info rows — matches ComputeNodeManagement .info-content
.info-content {
  .info-row {
    display: flex;
    padding: 12px 0;
    border-bottom: 1px solid theme.$gray_1;

    &:last-child {
      border-bottom: none;
    }

    .info-label {
      flex: 0 0 160px;
      color: theme.$gray_5;
      font-weight: 500;
      font-size: 14px;
    }

    .info-sublabel {
      display: block;
      font-size: 12px;
      font-weight: 400;
      color: theme.$gray_4;
      margin-top: 2px;
    }

    .info-value {
      flex: 1;
      color: theme.$gray_6;
      font-size: 14px;

      &.mono {
        font-family: 'Courier New', monospace;
        font-size: 13px;
        background: theme.$gray_1;
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-block;
      }

      .empty-value {
        color: theme.$gray_4;
        font-style: italic;
      }
    }
  }
}

// Workspace cards
.workspace-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workspace-card {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  overflow: hidden;
}

.workspace-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: theme.$gray_1;
  }

  strong {
    font-size: 14px;
    color: theme.$gray_6;
  }
}

.workspace-card-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workspace-card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chevron {
  color: theme.$gray_4;
  font-size: 16px;
  transition: transform 0.2s ease;

  &.open {
    transform: rotate(180deg);
  }
}

.workspace-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.workspace-card-content {
  border-top: 1px solid theme.$gray_2;
  padding: 0 20px 20px;
}

// Workspace sub-sections
.ws-subsection {
  padding-top: 20px;

  h4 {
    font-size: 14px;
    font-weight: 500;
    color: theme.$gray_5;
    margin: 0 0 12px 0;

    .subsection-count {
      font-weight: 400;
      color: theme.$gray_4;
    }
  }
}

.ws-node-list {
  display: flex;
  flex-direction: column;
}

.ws-node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid theme.$gray_1;

  &:last-child {
    border-bottom: none;
  }
}

.ws-node-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ws-node-name {
  font-size: 14px;
  font-weight: 500;
  color: theme.$gray_6;
}

.ws-node-meta {
  font-size: 12px;
  color: theme.$gray_4;
}

// Badges
.badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 3px;

  &.private { background: rgba(theme.$gray_4, 0.15); color: theme.$gray_5; }
  &.admin { background: rgba(theme.$purple_2, 0.1); color: theme.$purple_2; }
  &.compute { background: rgba(theme.$teal_1, 0.1); color: theme.$teal_2; }
  &.storage { background: rgba(theme.$orange_1, 0.1); color: theme.$orange_2; }
  &.default { background: rgba(theme.$green_1, 0.1); color: theme.$green_2; }
}

.meta-sep {
  margin: 0 4px;
  color: theme.$gray_3;
}

// Shared
.remove-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: theme.$gray_4;
  border-radius: 3px;
  display: flex;
  align-items: center;
  transition: all 0.15s ease;

  &:hover {
    color: theme.$red_1;
    background: rgba(theme.$red_1, 0.08);
  }
}

.empty-state {
  padding: 24px;
  text-align: center;
  font-size: 14px;
  color: theme.$gray_4;
}

.empty-hint {
  font-size: 13px;
  color: theme.$gray_4;
  font-style: italic;
  padding: 8px 0;
}

// Dialogs
.dialog-description {
  font-size: 14px;
  color: theme.$gray_5;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.dialog-content {
  .form-field {
    margin-bottom: 16px;

    > label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: theme.$gray_6;
      margin-bottom: 6px;
    }

    :deep(.el-checkbox) {
      display: flex;
      align-items: center;
      height: auto;

      .el-checkbox__label {
        line-height: 1.4;
      }
    }
  }

  .field-help {
    font-size: 13px;
    color: theme.$gray_5;
    margin-top: 6px;
    line-height: 1.4;
  }
}

:deep(.el-dialog__footer) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.admin-permissions {
  margin-top: 8px;
  padding: 12px 16px;
  background: theme.$gray_1;
  border-radius: 4px;

  > label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: theme.$gray_6;
    margin-bottom: 12px;
  }

  :deep(.el-checkbox) {
    display: flex;
    align-items: center;
    height: auto;
    margin-right: 0;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .el-checkbox__label {
      line-height: 1.4;
    }
  }
}

.dialog-summary {
  margin-bottom: 16px;
  padding: 10px 12px;
  background: theme.$gray_1;
  border-radius: 4px;

  strong { display: block; font-size: 14px; color: theme.$gray_6; }
  .summary-detail { font-size: 13px; color: theme.$gray_5; }
}

.warning-text {
  font-size: 14px;
  color: theme.$gray_6;
  line-height: 1.5;

  &.impact {
    color: theme.$red_1;
    font-weight: 500;
    margin-top: 8px;
  }
}
</style>
