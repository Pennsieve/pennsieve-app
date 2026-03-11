<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import IconRemove from '@/components/icons/IconRemove.vue'
import IconCopyDocument from '@/components/icons/IconCopyDocument.vue'
import ComputeNodeSecrets from './ComputeNodeSecrets.vue'

const route = useRoute()
const router = useRouter()
const store = useStore()
const computeResourcesStore = useComputeResourcesStore()

const profile = computed(() => store.state.profile)
const activeOrganization = computed(() => store.getters.activeOrganization)
const orgMembers = computed(() => store.state.orgMembers || [])
const teams = computed(() => store.state.teams || [])

// Route params
const nodeUuid = computed(() => route.params.nodeId)
const orgId = computed(() => route.params.orgId)

// Component state
const computeNode = ref(null)
const isLoading = ref(false)
const isUpdating = ref(false)
const isEditingInfo = ref(false)
const editingData = ref({})
const showDestroyDialog = ref(false)
const isDestroying = ref(false)

// Permissions via Pinia store
const nodePermissions = computed(() => computeResourcesStore.getNodePermissions(nodeUuid.value))
const isLoadingPermissions = computed(() => computeResourcesStore.isNodePermissionsLoading(nodeUuid.value))
const isUpdatingPermissions = computed(() => computeResourcesStore.isNodeUpdating(nodeUuid.value))

const localAccessScope = ref('private')
const isUpdatingScope = ref(false)
const sharedUsers = computed(() => nodePermissions.value?.sharedWithUsers || [])
const sharedTeams = computed(() => nodePermissions.value?.sharedWithTeams || [])

// Dialog state
const showAddUserDialog = ref(false)
const showAddTeamDialog = ref(false)
const selectedUserId = ref('')
const selectedTeamId = ref('')

// Check if current user is the owner of the node
const isNodeOwner = computed(() => {
  return computeNode.value?.ownerId === profile.value?.id
})

const canManagePermissions = computed(() => isNodeOwner.value)

const deploymentModeDescription = computed(() => {
  const mode = (computeNode.value?.deploymentMode || 'basic').toLowerCase()
  switch (mode) {
    case 'basic':
      return 'A cost-effective setup ideal for development and testing. Processors have direct internet access and use standard encryption. Best suited for non-production workloads and proof-of-concepts.'
    case 'secure':
      return 'A production-ready setup with enhanced security. Processors run in an isolated network with controlled internet access. All data is encrypted with dedicated keys, and network activity is logged for auditing.'
    case 'compliant':
      return 'Designed for regulated environments such as healthcare and government. Processors have no internet access — all communication stays within the cloud provider\'s private network. Includes dedicated encryption keys and full network audit logging. Suitable for HIPAA and NIST 800-171 compliance.'
    default:
      return ''
  }
})

const hasAdminRights = computed(() => {
  if (activeOrganization.value) {
    return activeOrganization.value.isAdmin || activeOrganization.value.isOwner
  }
  return false
})

// Available users for sharing (exclude owner and already shared users)
const availableUsers = computed(() => {
  if (!computeNode.value) return []
  const sharedUserIds = new Set(sharedUsers.value)
  return orgMembers.value.filter(member =>
    !sharedUserIds.has(member.id) &&
    member.id !== profile.value?.id
  )
})

// Available teams for sharing (exclude already shared teams)
const availableTeams = computed(() => {
  const sharedTeamIds = new Set(sharedTeams.value)
  return teams.value.filter(team => !sharedTeamIds.has(team.team.id))
})

// Sync localAccessScope with store data
watch(nodePermissions, (newPermissions) => {
  if (!isUpdatingScope.value && newPermissions && typeof newPermissions === 'object' && !newPermissions.error) {
    if (newPermissions.hasOwnProperty('accessScope')) {
      localAccessScope.value = newPermissions.accessScope || 'private'
    }
  }
}, { immediate: true })

// Helpers
async function copyUuid() {
  try {
    await navigator.clipboard.writeText(computeNode.value.uuid)
    ElMessage.success('UUID copied to clipboard')
  } catch {
    ElMessage.error('Failed to copy')
  }
}

function formatAccountId(accountId) {
  if (!accountId) return ''
  if (accountId.length === 12) {
    return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`
  }
  return accountId
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

function getUserName(userId) {
  if (!userId) return 'Unknown'
  if (profile.value && (profile.value.id === userId || profile.value.intId === userId)) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || 'You'
  }
  const member = orgMembers.value.find(m => m.id === userId || m.intId === userId)
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || 'Unknown User'
  }
  return String(userId).includes(':') ? String(userId).split(':').pop() : String(userId)
}

function getTeamName(teamId) {
  const team = teams.value.find(t => t.team.id === teamId)
  return team ? team.team.name : 'Unknown Team'
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
  if (!node?.status) return 'Pending'
  const status = node.status.toLowerCase()
  switch (status) {
    case 'pending': return 'Pending'
    case 'enabled': case 'active': case 'running': case 'ready': return 'Enabled'
    case 'paused': case 'stopped': case 'disabled': return 'Paused'
    case 'destroying': return 'Destroying'
    default: return 'Pending'
  }
}

// Data fetching
onMounted(async () => {
  await fetchComputeNode()
  await Promise.all([
    computeResourcesStore.fetchNodePermissions(nodeUuid.value),
    computeResourcesStore.fetchAllowedProcessors(nodeUuid.value),
  ])
})

async function fetchComputeNode() {
  isLoading.value = true
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
    } else {
      ElMessage.error('Failed to load compute node details')
      router.push({ name: 'compute-nodes', params: { orgId: orgId.value } })
    }
  } catch (error) {
    console.error('Failed to fetch compute node:', error)
    ElMessage.error('Failed to load compute node details')
    router.push({ name: 'compute-nodes', params: { orgId: orgId.value } })
  } finally {
    isLoading.value = false
  }
}

// Node info editing
function startEditingInfo() {
  isEditingInfo.value = true
  editingData.value = {
    name: computeNode.value.name || '',
    description: computeNode.value.description || ''
  }
}

function cancelEditingInfo() {
  isEditingInfo.value = false
  editingData.value = {}
}

async function saveNodeInfo() {
  isUpdating.value = true
  try {
    await computeResourcesStore.updateComputeNode(nodeUuid.value, {
      name: editingData.value.name || null,
      description: editingData.value.description || null
    })
    // Refresh local data
    await fetchComputeNode()
    cancelEditingInfo()
    ElMessage.success('Compute node updated successfully')
  } catch (error) {
    console.error('Failed to update node:', error)
    ElMessage.error('Failed to update compute node')
  } finally {
    isUpdating.value = false
  }
}

// Status management
async function updateStatus(newStatus) {
  try {
    await computeResourcesStore.updateComputeNodeStatus(nodeUuid.value, newStatus)
    computeNode.value = { ...computeNode.value, status: newStatus }
    ElMessage.success(`Status updated to ${newStatus}`)
  } catch (error) {
    console.error('Failed to update status:', error)
    ElMessage.error('Failed to update compute node status')
  }
}

// Permissions management
async function handleAccessScopeChange(newValue) {
  isUpdatingScope.value = true
  try {
    await computeResourcesStore.updateAccessScope(nodeUuid.value, newValue)
    ElMessage.success(`Access scope updated to ${newValue}`)
  } catch (error) {
    localAccessScope.value = nodePermissions.value?.accessScope || 'private'
    ElMessage.error('Failed to update access scope')
  } finally {
    isUpdatingScope.value = false
  }
}

function openAddUserDialog() {
  selectedUserId.value = ''
  showAddUserDialog.value = true
}
function closeAddUserDialog() {
  selectedUserId.value = ''
  showAddUserDialog.value = false
}
function openAddTeamDialog() {
  selectedTeamId.value = ''
  showAddTeamDialog.value = true
}
function closeAddTeamDialog() {
  selectedTeamId.value = ''
  showAddTeamDialog.value = false
}

async function addUserAccess() {
  if (!selectedUserId.value) return
  try {
    await computeResourcesStore.addUserAccess(nodeUuid.value, selectedUserId.value)
    ElMessage.success('User access granted successfully')
    closeAddUserDialog()
  } catch (error) {
    ElMessage.error('Failed to grant user access')
  }
}

async function removeUserAccess(userId) {
  try {
    await computeResourcesStore.removeUserAccess(nodeUuid.value, userId)
    ElMessage.success('User access revoked successfully')
  } catch (error) {
    ElMessage.error('Failed to revoke user access')
  }
}

async function addTeamAccess() {
  if (!selectedTeamId.value) return
  try {
    await computeResourcesStore.addTeamAccess(nodeUuid.value, selectedTeamId.value)
    ElMessage.success('Team access granted successfully')
    closeAddTeamDialog()
  } catch (error) {
    ElMessage.error('Failed to grant team access')
  }
}

async function removeTeamAccess(teamId) {
  try {
    await computeResourcesStore.removeTeamAccess(nodeUuid.value, teamId)
    ElMessage.success('Team access revoked successfully')
  } catch (error) {
    ElMessage.error('Failed to revoke team access')
  }
}

// Allowed Processors
const allowedProcessors = computed(() => computeResourcesStore.getNodeAllowedProcessors(nodeUuid.value))
const isLoadingAllowedProcessors = computed(() => computeResourcesStore.isNodeAllowedProcessorsLoading(nodeUuid.value))
const isEditingProcessors = ref(false)
const editingProcessorsList = ref([])
const newProcessorUrl = ref('')
const isSavingProcessors = ref(false)

const processorAccessMode = computed(() => {
  return allowedProcessors.value.length === 0 ? 'open' : 'restricted'
})

const availableApplications = computed(() => {
  const apps = store.state.analysisModule?.applications || []
  const seen = new Set()
  return apps.filter(app => {
    if (!app.source?.url) return false
    if (seen.has(app.source.url)) return false
    seen.add(app.source.url)
    return true
  })
})

function startEditingProcessors() {
  editingProcessorsList.value = [...allowedProcessors.value]
  isEditingProcessors.value = true
  store.dispatch('analysisModule/fetchApplications')
}

function cancelEditingProcessors() {
  isEditingProcessors.value = false
  editingProcessorsList.value = []
  newProcessorUrl.value = ''
}

function addProcessorEntry(url) {
  if (!url || editingProcessorsList.value.includes(url)) return
  editingProcessorsList.value.push(url)
}

function addProcessorFromSelect(url) {
  addProcessorEntry(url)
}

function addProcessorManual() {
  const url = newProcessorUrl.value.trim()
  if (!url) return
  addProcessorEntry(url)
  newProcessorUrl.value = ''
}

function removeProcessorEntry(index) {
  editingProcessorsList.value.splice(index, 1)
}

async function saveAllowedProcessors() {
  isSavingProcessors.value = true
  try {
    await computeResourcesStore.updateAllowedProcessors(nodeUuid.value, editingProcessorsList.value)
    ElMessage.success('Allowed processors updated successfully')
    isEditingProcessors.value = false
    newProcessorUrl.value = ''
  } catch (error) {
    ElMessage.error('Failed to update allowed processors')
  } finally {
    isSavingProcessors.value = false
  }
}

// Update deployment (provisioner image)
const isEditingDeployment = ref(false)
const isUpdatingDeployment = ref(false)
const deploymentForm = ref({ provisionerImage: '', provisionerImageTag: '' })

function startEditingDeployment() {
  deploymentForm.value = {
    provisionerImage: computeNode.value?.provisionerImage || '',
    provisionerImageTag: computeNode.value?.provisionerImageTag || ''
  }
  isEditingDeployment.value = true
}

function cancelEditingDeployment() {
  isEditingDeployment.value = false
  deploymentForm.value = { provisionerImage: '', provisionerImageTag: '' }
}

async function saveDeployment() {
  if (!deploymentForm.value.provisionerImage || !deploymentForm.value.provisionerImageTag) {
    ElMessage.warning('Both image and tag are required')
    return
  }
  isUpdatingDeployment.value = true
  try {
    await computeResourcesStore.updateComputeNodeDeployment(nodeUuid.value, {
      provisionerImage: deploymentForm.value.provisionerImage,
      provisionerImageTag: deploymentForm.value.provisionerImageTag
    })
    ElMessage.success('Compute node update initiated')
    isEditingDeployment.value = false
  } catch (error) {
    console.error('Failed to update deployment:', error)
    ElMessage.error('Failed to update compute node deployment')
  } finally {
    isUpdatingDeployment.value = false
  }
}

// Destroy node
async function confirmDestroyNode() {
  isDestroying.value = true
  try {
    await computeResourcesStore.deleteComputeNode(nodeUuid.value)
    ElMessage.success('Compute node destroyed successfully')
    showDestroyDialog.value = false
    router.push({ name: 'compute-nodes', params: { orgId: orgId.value } })
  } catch (error) {
    console.error('Failed to destroy compute node:', error)
    ElMessage.error('Failed to destroy compute node')
  } finally {
    isDestroying.value = false
  }
}


</script>

<template>
  <bf-stage element-loading-background="transparent" v-loading="isLoading">
    <div class="compute-node-management" v-if="computeNode">
      <!-- Node Header -->
      <div class="node-header-section">
        <div class="node-header-top">
          <h1>{{ computeNode.name }}</h1>
          <div class="node-header-right">
            <div class="node-status-control" v-if="canManagePermissions && getStatusForNode(computeNode) !== 'Pending' && getStatusForNode(computeNode) !== 'Destroying'">
              <el-select
                :model-value="getStatusForNode(computeNode)"
                @change="updateStatus"
                :loading="isUpdatingPermissions"
                size="default"
                :class="['status-select', getStatusForNode(computeNode).toLowerCase()]"
              >
                <el-option label="Enabled" value="Enabled" />
                <el-option label="Paused" value="Paused" />
              </el-select>
            </div>
            <span v-else class="status-badge" :class="getStatusForNode(computeNode).toLowerCase()">
              {{ getStatusForNode(computeNode) }}
            </span>
          </div>
        </div>
        <p class="node-subtitle">
          {{ getAccountTypeLabel(computeNode.account?.accountType) }} Compute Node
        </p>
        <p class="node-description" v-if="computeNode.description">
          {{ computeNode.description }}
        </p>
      </div>

      <!-- Node Information Section -->
      <div class="management-section">
        <div class="section-header">
          <h2>Node Information</h2>
          <div class="section-actions">
            <bf-button
              v-if="!isEditingInfo && canManagePermissions"
              @click="startEditingInfo"
              class="secondary small"
            >
              Edit
            </bf-button>
            <div v-else-if="isEditingInfo" class="edit-actions">
              <bf-button
                @click="saveNodeInfo"
                :loading="isUpdating"
                class="primary small"
              >
                Save
              </bf-button>
              <bf-button
                @click="cancelEditingInfo"
                class="secondary small"
              >
                Cancel
              </bf-button>
            </div>
          </div>
        </div>

        <div class="info-content">
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value" v-if="!isEditingInfo">{{ computeNode.name }}</span>
            <div class="info-value" v-else>
              <el-input v-model="editingData.name" placeholder="Enter node name" size="default" />
            </div>
          </div>

          <div class="info-row">
            <span class="info-label">Description:</span>
            <span class="info-value" v-if="!isEditingInfo">
              <span v-if="computeNode.description">{{ computeNode.description }}</span>
              <span v-else class="empty-value">No description set</span>
            </span>
            <div class="info-value" v-else>
              <el-input v-model="editingData.description" type="textarea" placeholder="Enter node description" :rows="3" size="default" />
            </div>
          </div>

          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">
              <span class="status-badge" :class="getStatusForNode(computeNode).toLowerCase()">
                {{ getStatusForNode(computeNode) }}
              </span>
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">Account Type:</span>
            <span class="info-value">{{ getAccountTypeLabel(computeNode.account?.accountType) }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Account ID:</span>
            <span class="info-value mono">{{ formatAccountId(computeNode.account?.accountId) }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Node UUID:</span>
            <span class="info-value mono">
              {{ computeNode.uuid }}
              <button class="copy-button" @click="copyUuid" title="Copy to clipboard">
                <IconCopyDocument :width="14" :height="14" />
              </button>
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">Created By:</span>
            <span class="info-value">{{ getUserName(computeNode.ownerId || computeNode.userId) }}</span>
          </div>

          <div class="info-row">
            <span class="info-label">Created At:</span>
            <span class="info-value">{{ formatDate(computeNode.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Deployment Configuration Section -->
      <div class="management-section">
        <div class="section-header">
          <h2>Deployment Configuration</h2>
          <div class="section-actions" v-if="canManagePermissions">
            <template v-if="!isEditingDeployment">
              <button class="processor-edit-button" @click="startEditingDeployment">Update</button>
            </template>
            <template v-else>
              <button class="processor-edit-button" :disabled="isUpdatingDeployment" @click="saveDeployment">
                {{ isUpdatingDeployment ? 'Updating...' : 'Update' }}
              </button>
              <button class="processor-cancel-button" @click="cancelEditingDeployment">Cancel</button>
            </template>
          </div>
        </div>
        <div class="info-content">
          <div class="info-row">
            <span class="info-label">Mode:</span>
            <span class="info-value">
              <span class="deployment-mode-detail">
                <span class="mode-header">
                  <span class="tag" :class="computeNode.deploymentMode || 'basic'">
                    {{ (computeNode.deploymentMode || 'basic').charAt(0).toUpperCase() + (computeNode.deploymentMode || 'basic').slice(1) }}
                  </span>
                </span>
                <span class="mode-explanation">{{ deploymentModeDescription }}</span>
              </span>
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">LLM Access:</span>
            <span class="info-value">
              <span class="deployment-mode-detail">
                <span class="mode-header">
                  <span v-if="computeNode.enableLLMAccess" class="tag llm">Enabled</span>
                  <span v-else class="tag disabled">Disabled</span>
                </span>
                <span class="mode-explanation" v-if="computeNode.enableLLMAccess">
                  Workflows on this node can use large language models for AI-powered processing.
                </span>
                <span class="mode-explanation" v-else>
                  LLM-based processors are not available on this node.
                </span>
              </span>
            </span>
          </div>

          <div class="info-row">
            <span class="info-label">Provisioner:</span>
            <template v-if="isEditingDeployment">
              <span class="info-value">
                <div class="deployment-form">
                  <div class="deployment-form-row">
                    <label class="deployment-form-label">Image</label>
                    <el-input v-model="deploymentForm.provisionerImage" placeholder="e.g. pennsieve/compute-node-aws-provisioner-v2" size="default" />
                  </div>
                  <div class="deployment-form-row">
                    <label class="deployment-form-label">Tag</label>
                    <el-input v-model="deploymentForm.provisionerImageTag" placeholder="e.g. 20260310-1" size="default" />
                  </div>
                </div>
              </span>
            </template>
            <template v-else>
              <span v-if="computeNode.provisionerImage" class="info-value mono">{{ computeNode.provisionerImage }}:{{ computeNode.provisionerImageTag }}</span>
              <span v-else class="info-value empty-value">Not set</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Access & Permissions Section -->
      <div class="management-section" v-loading="isLoadingPermissions">
        <div class="section-header">
          <h2>Access & Permissions</h2>
        </div>

        <div class="permissions-content" v-if="!isLoadingPermissions && (canManagePermissions || nodePermissions.accessScope)">
          <div class="info-content">
            <div class="info-row" v-if="nodePermissions.owner">
              <span class="info-label">Owner:</span>
              <span class="info-value">{{ getUserName(nodePermissions.owner) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Access Scope:</span>
              <span class="info-value">
                <el-select
                  v-if="canManagePermissions"
                  v-model="localAccessScope"
                  @change="handleAccessScopeChange"
                  :loading="isUpdatingPermissions"
                  size="small"
                  class="access-scope-select"
                >
                  <el-option label="Private - Only I can access" value="private" />
                  <el-option label="Workspace - All workspace members can access" value="workspace" />
                  <el-option label="Shared - Specific users and teams" value="shared" />
                </el-select>
                <span v-else class="access-scope-badge" :class="localAccessScope">
                  {{ localAccessScope === 'private' ? 'Private' : localAccessScope === 'workspace' ? 'Workspace' : 'Shared' }}
                </span>
                <span v-if="!canManagePermissions" class="scope-description-text">
                  <span v-if="localAccessScope === 'private'">Only the owner can access this compute node</span>
                  <span v-else-if="localAccessScope === 'workspace'">All workspace members can access this compute node</span>
                  <span v-else>Shared with specific users and teams</span>
                </span>
              </span>
            </div>
          </div>

          <!-- Shared Users -->
          <div v-if="localAccessScope === 'shared'" class="sharing-section">
            <div class="shared-subsection">
              <div class="subsection-header">
                <h3>Shared Users</h3>
                <bf-button @click="openAddUserDialog" v-if="canManagePermissions" class="small primary">
                  Add User
                </bf-button>
              </div>
              <div v-if="sharedUsers.length > 0" class="shared-list">
                <div v-for="userId in sharedUsers" :key="userId" class="shared-item">
                  <span class="shared-name">{{ getUserName(userId) }}</span>
                  <button
                    v-if="canManagePermissions"
                    @click="removeUserAccess(userId)"
                    :disabled="isUpdatingPermissions"
                    class="remove-button"
                    title="Remove access"
                  >
                    <IconRemove :width="16" :height="16" />
                  </button>
                </div>
              </div>
              <div v-else class="empty-shared">No users have been granted access yet</div>
            </div>

            <div class="shared-subsection">
              <div class="subsection-header">
                <h3>Shared Teams</h3>
                <bf-button @click="openAddTeamDialog" v-if="canManagePermissions" class="small primary">
                  Add Team
                </bf-button>
              </div>
              <div v-if="sharedTeams.length > 0" class="shared-list">
                <div v-for="teamId in sharedTeams" :key="teamId" class="shared-item">
                  <span class="shared-name">{{ getTeamName(teamId) }}</span>
                  <button
                    v-if="canManagePermissions"
                    @click="removeTeamAccess(teamId)"
                    :disabled="isUpdatingPermissions"
                    class="remove-button"
                    title="Remove access"
                  >
                    <IconRemove :width="16" :height="16" />
                  </button>
                </div>
              </div>
              <div v-else class="empty-shared">No teams have been granted access yet</div>
            </div>
          </div>
        </div>

        <div v-else-if="!isLoadingPermissions && !canManagePermissions && !nodePermissions.accessScope" class="no-permissions-message">
          <p>You don't have permission to view or manage access settings for this compute node.</p>
        </div>
      </div>

      <!-- Secrets Section -->
      <div class="management-section">
        <div class="section-header">
          <h2>Secrets</h2>
        </div>
        <ComputeNodeSecrets :node-id="nodeUuid" :is-owner="isNodeOwner" />
      </div>

      <!-- Allowed Processors Section -->
      <div class="management-section" v-if="isNodeOwner" v-loading="isLoadingAllowedProcessors">
        <div class="section-header">
          <h2>Allowed Processors</h2>
          <div class="section-actions">
            <span v-if="!isEditingProcessors" class="processor-mode-badge" :class="processorAccessMode">
              {{ processorAccessMode === 'open' ? 'Open — All Allowed' : 'Restricted' }}
            </span>
            <button v-if="!isEditingProcessors" @click="startEditingProcessors" class="processor-edit-button">
              Configure
            </button>
            <template v-else>
              <button @click="saveAllowedProcessors" :disabled="isSavingProcessors" class="processor-edit-button">
                {{ isSavingProcessors ? 'Saving...' : 'Save' }}
              </button>
              <button @click="cancelEditingProcessors" class="processor-cancel-button">
                Cancel
              </button>
            </template>
          </div>
        </div>

        <!-- Read-only view -->
        <div v-if="!isEditingProcessors" class="processors-content">
          <div v-if="processorAccessMode === 'open'" class="processors-empty">
            No processor restrictions configured — all processors are allowed
          </div>
          <div v-else>
            <p class="processors-description">Only the following processors are allowed to run on this node. Data targets and service processors are always allowed.</p>
            <div class="processors-list">
              <div v-for="(url, index) in allowedProcessors" :key="index" class="processor-item">
                <span class="processor-url">{{ url }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit view -->
        <div v-else class="processors-edit">
          <p class="processors-description">Add processor source URLs to restrict this node. Leave empty for open access. Data targets and service processors are always allowed.</p>

          <!-- Add from known applications -->
          <div class="add-processor-row">
            <el-select
              placeholder="Pick from known applications..."
              filterable
              @change="addProcessorFromSelect"
              :model-value="''"
              style="flex: 1"
              popper-class="processor-select-popper"
            >
              <el-option
                v-for="app in availableApplications"
                :key="app.uuid"
                :label="app.name"
                :value="app.source.url"
              >
                <div style="display: flex; flex-direction: column; line-height: 1.4; padding: 2px 0;">
                  <span style="font-size: 14px;">{{ app.name }}</span>
                  <span style="font-size: 12px; color: #9ca3af; font-family: 'Courier New', monospace;">{{ app.source.url }}</span>
                </div>
              </el-option>
            </el-select>
          </div>

          <!-- Manual entry -->
          <div class="add-processor-row">
            <el-input
              v-model="newProcessorUrl"
              placeholder="git://github.com/org/repo"
              @keyup.enter="addProcessorManual"
            />
            <bf-button @click="addProcessorManual" class="secondary small" :disabled="!newProcessorUrl.trim()">
              Add
            </bf-button>
          </div>

          <!-- Current list -->
          <div v-if="editingProcessorsList.length > 0" class="processors-list">
            <div v-for="(url, index) in editingProcessorsList" :key="index" class="processor-item">
              <span class="processor-url">{{ url }}</span>
              <button @click="removeProcessorEntry(index)" class="remove-button" title="Remove">
                <IconRemove :width="16" :height="16" />
              </button>
            </div>
          </div>
          <div v-else class="processors-empty">No processors in whitelist — all processors will be allowed (open mode)</div>

          <bf-button
            v-if="editingProcessorsList.length > 0"
            @click="editingProcessorsList = []"
            class="secondary small"
            style="margin-top: 8px"
          >
            Clear All (Switch to Open)
          </bf-button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="management-section danger-section" v-if="canManagePermissions">
        <div class="section-header">
          <h2>Danger Zone</h2>
        </div>
        <div class="destroy-content">
          <div class="destroy-info">
            <p>Permanently destroy this compute node and all its associated infrastructure.</p>
          </div>
          <bf-button
            @click="showDestroyDialog = true"
            :disabled="isDestroying"
            class="danger-button"
          >
            Destroy Compute Node
          </bf-button>
        </div>
      </div>
    </div>

    <!-- Add User Dialog -->
    <el-dialog v-model="showAddUserDialog" title="Add User Access" width="500px" :close-on-click-modal="true">
      <div class="add-access-dialog">
        <p>Select a user to grant access to this compute node:</p>
        <el-select v-model="selectedUserId" placeholder="Select a user" style="width: 100%" size="default" filterable>
          <el-option v-for="user in availableUsers" :key="user.id" :label="`${user.firstName} ${user.lastName}`" :value="user.id">
            <div class="user-option">
              <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
              <span class="user-email">{{ user.email }}</span>
            </div>
          </el-option>
        </el-select>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeAddUserDialog">Cancel</el-button>
          <el-button type="primary" @click="addUserAccess" :disabled="!selectedUserId" :loading="isUpdatingPermissions">
            Grant Access
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Add Team Dialog -->
    <el-dialog v-model="showAddTeamDialog" title="Add Team Access" width="500px" :close-on-click-modal="true">
      <div class="add-access-dialog">
        <p>Select a team to grant access to this compute node:</p>
        <el-select v-model="selectedTeamId" placeholder="Select a team" style="width: 100%" size="default" filterable>
          <el-option v-for="team in availableTeams" :key="team.team.id" :label="team.team.name" :value="team.team.id" />
        </el-select>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeAddTeamDialog">Cancel</el-button>
          <el-button type="primary" @click="addTeamAccess" :disabled="!selectedTeamId" :loading="isUpdatingPermissions">
            Grant Access
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Destroy Compute Node Dialog -->
    <el-dialog v-model="showDestroyDialog" title="Destroy Compute Node" width="480px" :close-on-click-modal="false">
      <div class="destroy-node-dialog" v-if="computeNode">
        <div class="warning-section">
          <div class="warning-content">
            <h4>Are you sure you want to destroy this compute node?</h4>
            <p class="warning-message">
              Destroying <strong>{{ computeNode.name }}</strong> will permanently remove this compute node
              and all its associated infrastructure including running tasks.
            </p>
            <p class="impact-message">This action cannot be undone.</p>
          </div>
        </div>
        <div class="node-summary">
          <div class="summary-row"><strong>Node Name:</strong> {{ computeNode.name }}</div>
          <div class="summary-row"><strong>Account:</strong> {{ formatAccountId(computeNode.account?.accountId) }}</div>
          <div class="summary-row"><strong>Node UUID:</strong> {{ computeNode.uuid }}</div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showDestroyDialog = false">Cancel</el-button>
          <el-button type="danger" @click="confirmDestroyNode" :loading="isDestroying">Destroy Node</el-button>
        </div>
      </template>
    </el-dialog>
  </bf-stage>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.compute-node-management {
  max-width: 900px;
  margin: 0;
  padding: 0;
}

.node-header-section {
  margin-bottom: 32px;

  .node-header-top {
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

  .node-subtitle {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 8px 0;
  }

  .node-tags {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;

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

  .node-description {
    font-size: 16px;
    color: theme.$gray_5;
    margin: 12px 0 0 0;
    line-height: 1.5;
  }
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;

  &.enabled {
    background: rgba(#10B981, 0.1);
    color: #059669;
  }

  &.paused {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
  }

  &.pending {
    background: rgba(#6B7280, 0.1);
    color: #6B7280;
  }

  &.destroying {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
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
    height: 32px;
    padding: 8px 16px;
  }

  &.enabled :deep(.el-select__wrapper) {
    background: rgba(#10B981, 0.1);
    color: #059669;
    border: 1px solid rgba(#10B981, 0.2);
  }

  &.paused :deep(.el-select__wrapper) {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
    border: 1px solid rgba(#F59E0B, 0.2);
  }
}

.node-status-control {
  flex-shrink: 0;
}

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

  &.danger-section {
    border-color: rgba(theme.$red_2, 0.2);

    .section-header {
      border-bottom-color: rgba(theme.$red_2, 0.2);

      h2 {
        color: theme.$red_2;
      }
    }
  }
}

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

      .copy-button {
        background: none;
        border: none;
        cursor: pointer;
        color: theme.$gray_4;
        padding: 2px 4px;
        margin-left: 6px;
        border-radius: 3px;
        vertical-align: middle;
        transition: all 0.2s ease;

        &:hover {
          color: theme.$purple_2;
          background: rgba(theme.$purple_1, 0.1);
        }
      }

      .deployment-mode-detail {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .mode-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mode-explanation {
          color: theme.$gray_5;
          font-size: 13px;
          line-height: 1.5;
        }
      }

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

        &.disabled {
          background: rgba(#6B7280, 0.1);
          color: #6B7280;
        }
      }
    }
  }
}

.permissions-content {
  .access-scope-select {
    min-width: 300px;

    :deep(.el-select__wrapper) {
      border-radius: 4px;
    }
  }

  .access-scope-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-right: 12px;

    &.private {
      background: rgba(theme.$gray_5, 0.1);
      color: theme.$gray_6;
    }

    &.workspace {
      background: rgba(theme.$purple_1, 0.1);
      color: theme.$purple_2;
    }

    &.shared {
      background: rgba(theme.$teal_1, 0.1);
      color: theme.$teal_2;
    }
  }

  .scope-description-text {
    color: theme.$gray_5;
    font-size: 13px;
    margin-left: 12px;
  }

  .sharing-section {
    margin-top: 24px;

    .shared-subsection {
      margin-bottom: 32px;

      &:last-child {
        margin-bottom: 0;
      }

      .subsection-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        h3 {
          font-size: 16px;
          font-weight: 500;
          color: theme.$gray_6;
          margin: 0;
        }
      }

      .shared-list {
        border: 1px solid theme.$gray_2;
        border-radius: 6px;
        padding: 8px;

        .shared-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-radius: 4px;
          transition: background 0.2s ease;

          &:hover {
            background: theme.$gray_1;
          }

          .shared-name {
            font-size: 14px;
            color: theme.$gray_6;
          }

          .remove-button {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: theme.$gray_4;
            border-radius: 4px;
            transition: all 0.2s ease;

            &:hover:not(:disabled) {
              background: theme.$red_2;
              color: white;
            }

            &:disabled {
              cursor: not-allowed;
              opacity: 0.5;
            }
          }
        }
      }

      .empty-shared {
        padding: 24px;
        text-align: center;
        color: theme.$gray_4;
        font-size: 14px;
        background: theme.$gray_1;
        border-radius: 6px;
      }
    }
  }
}

.no-permissions-message {
  padding: 24px;
  background: theme.$gray_1;
  border-radius: 6px;
  text-align: center;

  p {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_5;
  }
}

.destroy-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;

  .destroy-info p {
    font-size: 13px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.5;
  }
}

.danger-button {
  background: white;
  color: theme.$red_2;
  border: 1px solid theme.$red_2;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    background: theme.$red_1;
    color: white;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Dialog styles
.add-access-dialog {
  p {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: theme.$gray_6;
  }

  .user-option {
    display: flex;
    flex-direction: column;

    .user-name {
      font-size: 14px;
      color: theme.$gray_6;
    }

    .user-email {
      font-size: 12px;
      color: theme.$gray_5;
    }
  }
}

.destroy-node-dialog {
  .warning-section {
    margin-bottom: 24px;
    padding: 20px;
    background: rgba(theme.$red_1, 0.05);
    border: 1px solid rgba(theme.$red_1, 0.15);

    .warning-content {
      h4 {
        font-size: 16px;
        font-weight: 600;
        color: theme.$gray_6;
        margin: 0 0 12px 0;
      }

      .warning-message {
        font-size: 14px;
        color: theme.$gray_6;
        margin: 0 0 12px 0;
        line-height: 1.5;

        strong { font-weight: 600; }
      }

      .impact-message {
        font-size: 13px;
        color: theme.$red_2;
        margin: 0;
        font-weight: 500;
      }
    }
  }

  .node-summary {
    padding: 16px;
    background: theme.$gray_1;
    border: 1px solid theme.$gray_2;

    .summary-row {
      display: flex;
      align-items: center;
      font-size: 14px;
      margin-bottom: 8px;

      &:last-child { margin-bottom: 0; }

      strong {
        color: theme.$gray_6;
        font-weight: 600;
        min-width: 100px;
        margin-right: 8px;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.processor-edit-button,
.processor-cancel-button {
  background: theme.$purple_1;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: theme.$purple_2;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.processor-cancel-button {
  background: white;
  color: theme.$gray_5;
  border: 1px solid theme.$gray_3;

  &:hover {
    border-color: theme.$gray_4;
    color: theme.$gray_6;
    background: white;
  }
}

.processor-mode-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 8px;

  &.open {
    background: rgba(#10B981, 0.1);
    color: #059669;
    border: 1px solid rgba(#10B981, 0.2);
  }
  &.restricted {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
    border: 1px solid rgba(#F59E0B, 0.2);
  }
}

.processors-description {
  font-size: 13px;
  color: theme.$gray_5;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.add-processor-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.processors-list {
  border: 1px solid theme.$gray_2;
  border-radius: 6px;
  padding: 8px;

  .processor-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-radius: 4px;
    transition: background 0.2s ease;

    &:hover {
      background: theme.$gray_1;
    }

    .processor-url {
      font-size: 13px;
      font-family: 'Courier New', monospace;
      color: theme.$gray_6;
    }

    .remove-button {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: theme.$gray_4;
      border-radius: 4px;
      transition: all 0.2s ease;

      &:hover {
        background: theme.$red_2;
        color: white;
      }
    }
  }
}

.processors-empty {
  padding: 24px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
  background: theme.$gray_1;
  border-radius: 6px;
}

:deep(.bf-button) {
  &.small {
    padding: 6px 12px;
    font-size: 13px;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

.deployment-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deployment-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.deployment-form-label {
  font-size: 12px;
  font-weight: 500;
  color: theme.$gray_5;
}
</style>

<style lang="scss">
.processor-select-popper .el-select-dropdown__item {
  height: auto;
  padding: 8px 12px;
  line-height: 1.4;
}
</style>
