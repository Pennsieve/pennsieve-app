<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconApi from '@/components/icons/IconApi.vue'
import IconRemove from '@/components/icons/IconRemove.vue'
import IconInfo from '@/components/icons/IconInfo.vue'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'

const store = useStore()
const computeResourcesStore = useComputeResourcesStore()
const profile = computed(() => store.state.profile)
const orgMembers = computed(() => store.state.orgMembers || [])

// Use Pinia store for compute resources data
const computeResources = computed(() => computeResourcesStore.computeAccounts)
const isLoading = computed(() => computeResourcesStore.isLoadingComputeAccounts)

const expandedResources = ref(new Set())
const editingResources = ref(new Set())
const editingData = ref({})
const workspaceOperations = ref(new Set())
const showAddWorkspaceDialog = ref(false)
const showRemoveWorkspaceDialog = ref(false)
const selectedResourceForWorkspace = ref(null)
const selectedWorkspaceForRemoval = ref(null)
const newWorkspaceAccess = ref({ isPublic: false, organizationId: null })

// State for compute nodes per account - now handled by store
const isLoadingComputeNodes = ref(new Set()) // Keep for individual resource loading states

// Use scoped compute nodes from store
const ACCOUNT_OWNER_SCOPE = 'account-owner'
const allComputeNodes = computed(() => {
  return computeResourcesStore.getScopedComputeNodes(ACCOUNT_OWNER_SCOPE)
})
const computeNodesLoaded = computed(() => computeResourcesStore.isScopedCacheValid(ACCOUNT_OWNER_SCOPE))

// Get current organization from store
const currentOrganization = computed(() => store.getters.activeOrganization?.organization)

const hasNoResources = computed(() => { return computeResources.value.length === 0 })

// Get workspaces where user has admin rights
const adminWorkspaces = computed(() => {
  const organizations = store.state.organizations || []
  const currentUserId = profile.value?.id
  
  if (!currentUserId) return []
  
  return organizations.filter(org => {
    // Use isAdmin property to check if user has admin rights
    return org.isAdmin === true
  }).map(org => ({
    id: org.organization?.id || org.id,
    name: org.organization?.name || org.name,
    role: org.role || (org.isAdmin ? 'admin' : 'viewer')
  }))
})

// Compute enabled workspaces for current org
const getEnabledWorkspacesForCurrentOrg = (resource) => {
  if (!currentOrganization.value) return []
  return resource.enabledWorkspaces?.filter(
    ws => ws.organizationId === currentOrganization.value.id
  ) || []
}

// Format account ID for display
const formatAccountId = (accountId) => {
  if (!accountId) return ''
  // Add dashes for AWS account IDs (12 digits)
  if (accountId.length === 12) {
    return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`
  }
  return accountId
}

onMounted(async () => {
  await computeResourcesStore.fetchComputeAccounts()
  // Fetch all compute nodes once when component mounts using scoped caching
  await fetchAllComputeNodes()
})


// Fetch all compute nodes once and cache them using scoped store
async function fetchAllComputeNodes() {
  try {
    await computeResourcesStore.fetchScopedComputeNodes(ACCOUNT_OWNER_SCOPE)
  } catch (error) {
    console.error('Failed to fetch all compute nodes:', error)
  }
}

function toggleResourceExpansion(resourceUuid) {
  const newExpanded = new Set(expandedResources.value)
  if (newExpanded.has(resourceUuid)) {
    newExpanded.delete(resourceUuid)
  } else {
    newExpanded.add(resourceUuid)
    // Ensure compute nodes are loaded when expanding
    fetchComputeNodesForAccount()
  }
  expandedResources.value = newExpanded
}

function isResourceExpanded(resourceUuid) {
  return expandedResources.value.has(resourceUuid)
}

function isResourceEditing(resourceUuid) {
  return editingResources.value.has(resourceUuid)
}

function isResourceUpdating(resourceUuid) {
  return computeResourcesStore.isNodeUpdating(resourceUuid)
}

function startEditing(resource) {
  const newEditing = new Set(editingResources.value)
  newEditing.add(resource.uuid)
  editingResources.value = newEditing
  
  // Initialize editing data with current values
  editingData.value[resource.uuid] = {
    name: resource.name || '',
    description: resource.description || '',
    status: resource.status || 'enabled'
  }
}

function cancelEditing(resourceUuid) {
  const newEditing = new Set(editingResources.value)
  newEditing.delete(resourceUuid)
  editingResources.value = newEditing
  
  // Clear editing data
  delete editingData.value[resourceUuid]
}

async function saveChanges(resource) {
  const resourceUuid = resource.uuid
  const changes = editingData.value[resourceUuid]
  
  if (!changes) return
  
  try {
    await computeResourcesStore.updateAccount(resourceUuid, {
      name: changes.name || null,
      description: changes.description || null,
      status: changes.status
    })
    
    // Exit editing mode
    cancelEditing(resourceUuid)
  } catch (error) {
    console.error('Failed to update resource:', error)
    // Handle error - maybe show a toast notification
  }
}

async function updateStatus(resource, newStatus) {
  const resourceUuid = resource.uuid
  
  try {
    await computeResourcesStore.updateAccountStatus(resourceUuid, newStatus)
  } catch (error) {
    console.error('Failed to update resource status:', error)
  }
}

function getResourceTypeLabel(type) {
  switch (type) {
    case 'AWS': return 'Amazon Web Services'
    case 'GCP': return 'Google Cloud Platform'
    case 'AZURE': return 'Microsoft Azure'
    default: return type || 'Unknown'
  }
}

function getStatusForResource(resource) {
  // Use the status field if available, otherwise default to 'enabled'
  // Status can be 'enabled' or 'paused'
  return resource.status ? resource.status.toLowerCase() : 'enabled'
}


function formatDate(timestamp) {
  if (!timestamp) return 'N/A'
  
  // Handle different date formats
  let date
  if (typeof timestamp === 'string') {
    // Handle ISO string format like "2025-09-09 20:09:53.21578262 +0000 UTC"
    date = new Date(timestamp)
  } else if (typeof timestamp === 'number') {
    // Handle Unix timestamp
    date = new Date(timestamp * 1000)
  } else {
    return 'N/A'
  }
  
  if (isNaN(date.getTime())) {
    return 'N/A'
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Get user name from org members
function getUserName(userId) {
  if (!userId) return 'Unknown'
  
  // Check if it's the current user
  if (profile.value && profile.value.id === userId) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || 'You'
  }
  
  // Look for user in org members
  const member = orgMembers.value.find(m => m.id === userId)
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || 'Unknown User'
  }
  
  // Return the user ID if we can't find the name
  return userId.split(':').pop() || userId
}

// Workspace management functions
function openRemoveWorkspaceDialog(resource, organizationId) {
  selectedResourceForWorkspace.value = resource
  selectedWorkspaceForRemoval.value = organizationId
  showRemoveWorkspaceDialog.value = true
}

function closeRemoveWorkspaceDialog() {
  showRemoveWorkspaceDialog.value = false
  selectedResourceForWorkspace.value = null
  selectedWorkspaceForRemoval.value = null
}

function confirmRemoveWorkspace() {
  if (!selectedResourceForWorkspace.value || !selectedWorkspaceForRemoval.value) return
  
  removeWorkspaceAccess(selectedResourceForWorkspace.value, selectedWorkspaceForRemoval.value)
  closeRemoveWorkspaceDialog()
}

async function removeWorkspaceAccess(resource, organizationId) {
  const operationKey = `${resource.uuid}-${organizationId}`
  const newOperations = new Set(workspaceOperations.value)
  newOperations.add(operationKey)
  workspaceOperations.value = newOperations
  
  try {
    await computeResourcesStore.removeWorkspaceAccess(resource.uuid, organizationId)
  } catch (error) {
    console.error('Failed to remove workspace access:', error)
  } finally {
    // Remove from operations set
    const newOperations = new Set(workspaceOperations.value)
    newOperations.delete(operationKey)
    workspaceOperations.value = newOperations
  }
}

async function addWorkspaceAccess(resource, organizationId, isPublic) {
  const operationKey = `${resource.uuid}-add`
  const newOperations = new Set(workspaceOperations.value)
  newOperations.add(operationKey)
  workspaceOperations.value = newOperations
  
  try {
    await computeResourcesStore.addWorkspaceAccess(resource.uuid, organizationId, isPublic)
    
    // Close dialog and reset form
    closeAddWorkspaceDialog()
  } catch (error) {
    console.error('Failed to add workspace access:', error)
    
    // Check if the error indicates the account is already enabled
    if (error.message && error.message.includes('account already enabled for workspace')) {
      // Show toast message for already enabled workspace
      ElMessage.warning({
        message: 'This compute resource is already enabled for the selected workspace.',
        duration: 4000
      })
    } else {
      // Show generic error message
      ElMessage.error({
        message: 'Failed to add workspace access. Please try again.',
        duration: 4000
      })
    }
  } finally {
    // Remove from operations set
    const newOperations = new Set(workspaceOperations.value)
    newOperations.delete(operationKey)
    workspaceOperations.value = newOperations
  }
}

function openAddWorkspaceDialog(resource) {
  selectedResourceForWorkspace.value = resource
  newWorkspaceAccess.value = { 
    isPublic: false, 
    organizationId: adminWorkspaces.value.length === 1 ? adminWorkspaces.value[0].id : null 
  }
  showAddWorkspaceDialog.value = true
}

function closeAddWorkspaceDialog() {
  showAddWorkspaceDialog.value = false
  selectedResourceForWorkspace.value = null
  newWorkspaceAccess.value = { isPublic: false, organizationId: null }
}

function getWorkspaceNameById(organizationId) {
  // First check admin workspaces
  const adminWorkspace = adminWorkspaces.value.find(ws => ws.id === organizationId)
  if (adminWorkspace) {
    return adminWorkspace.name
  }
  
  // Then check all organizations in store
  const organizations = store.state.organizations || []
  // Ensure organizations is an array
  const orgsArray = Array.isArray(organizations) ? organizations : []
  const org = orgsArray.find(org => {
    const orgId = org.organization?.id || org.id
    return orgId === organizationId
  })
  
  if (org) {
    return org.organization?.name || org.name
  }
  
  return 'Unknown Workspace'
}

function isWorkspaceOperationLoading(resource, organizationId = null) {
  if (organizationId) {
    return workspaceOperations.value.has(`${resource.uuid}-${organizationId}`)
  }
  return workspaceOperations.value.has(`${resource.uuid}-add`)
}

function handleAddWorkspace() {
  if (!selectedResourceForWorkspace.value || !newWorkspaceAccess.value.organizationId) return
  
  addWorkspaceAccess(
    selectedResourceForWorkspace.value,
    newWorkspaceAccess.value.organizationId,
    newWorkspaceAccess.value.isPublic
  )
}

function isAddWorkspaceDisabled() {
  return !newWorkspaceAccess.value.organizationId || 
         (selectedResourceForWorkspace.value && isWorkspaceOperationLoading(selectedResourceForWorkspace.value))
}

// Ensure compute nodes are loaded from the cached store
function fetchComputeNodesForAccount() {
  // If nodes aren't loaded yet, trigger a scoped fetch
  if (!computeNodesLoaded.value) {
    fetchAllComputeNodes()
  }
  // Note: No need to manually filter and store - getComputeNodesForResource will handle this reactively
}

function isLoadingComputeNodesForResource(resourceUuid) {
  return isLoadingComputeNodes.value.has(resourceUuid) || computeResourcesStore.isScopeLoading(ACCOUNT_OWNER_SCOPE)
}

function getComputeNodesForResource(resourceUuid) {
  // Find the resource by UUID to get the accountId
  const resource = computeResources.value.find(r => r.uuid === resourceUuid)
  if (!resource) return []
  
  // Filter nodes from store cache by accountId
  return allComputeNodes.value.filter(node => 
    node.account?.accountId === resource.accountId
  )
}

// Node status functions for display
function getNodeStatusForDisplay(node) {
  // Return the actual node status - should be 'Pending', 'Enabled', or 'Paused'
  const status = node.status
  
  // Normalize the status to expected values
  if (!status) return 'Pending'
  
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  
  // Map any legacy or alternative status values if needed
  switch(normalizedStatus) {
    case 'Pending':
    case 'Enabled':
    case 'Paused':
      return normalizedStatus
    case 'Active':
    case 'Running':
    case 'Ready':
      return 'Enabled'
    case 'Stopped':
    case 'Disabled':
      return 'Paused'
    default:
      return 'Pending'
  }
}

</script>

<template>
  <div class="compute-resources-container">
    <div class="resources-content">
<!--      <div class="header-section">-->
<!--        <div class="header-text">-->
<!--          <h2>Compute Resources</h2>-->
<!--          <p class="intro-text">-->
<!--            View and manage your external compute accounts that are connected to Pennsieve for data processing and analysis workflows.-->
<!--          </p>-->
<!--        </div>-->
<!--      </div>-->
      
      <!-- Setup Information Section -->
      <div class="info-section">
        <div class="info-card">
          <h3>Setting Up Compute Resources</h3>
          <p>
            Compute resources are your personal cloud accounts (AWS) that you register with Pennsieve through the Pennsieve Agent.
            As the owner of these accounts, you control which workspaces have access to create compute nodes on your infrastructure.
            Once configured, they will appear here where you can view their status and manage workspace access permissions.
          </p>
          <p class="info-note">
            <strong>User Ownership Model:</strong> You own and pay for these compute resources, but you can share them with workspace members to enable collaborative data analysis.
            Compute nodes created from your resources can be shared with different permission levels (private, workspace-wide, or user-specific access).
          </p>
          <div class="setup-steps" v-if="hasNoResources">
            <h4>Quick Setup Guide:</h4>
            <ol>
              <li>Configure your AWS account using the AWS CLI</li>
              <li>Download and configure the Pennsieve Agent</li>
              <li>Use the Pennsieve Agent to register your AWS account</li>
              <li>Share your compute resource with workspaces where you want to enable collaborative analysis</li>
              <li>Workspace members can then create compute nodes on your resources through the Analysis > Compute Nodes section</li>
            </ol>
          </div>
          <div class="documentation-link">
            <a href="https://docs.pennsieve.io/docs/registering-a-compute-resource" target="_blank" class="doc-link">
              View Full Documentation
              <IconArrowRight :width="14" :height="14" style="margin-left: 4px;" />
            </a>
          </div>
        </div>
      </div>

      <!-- Resources List -->
      <div class="resources-section" v-loading="isLoading">
        <h3>Your Compute Resources</h3>
        
        <div v-if="computeResources.length === 0 && !isLoading" class="empty-state">
          <div class="empty-icon">
            <IconApi :width="48" :height="48" />
          </div>
          <h3>No Compute Resources Found</h3>
          <p>
            You don't have any compute resources configured yet. 
            Please refer to the setup guide above or contact your administrator to get started.
          </p>
        </div>

        <div v-else class="resources-grid">
          <div 
            v-for="resource in computeResources" 
            :key="resource.uuid"
            class="resource-card"
            :class="{ expanded: isResourceExpanded(resource.uuid) }"
          >
            <div 
              class="resource-header clickable"
              @click="toggleResourceExpansion(resource.uuid)"
            >
              <div class="resource-info">
                <h3>
                  <span v-if="resource.name">{{ resource.name }}</span>
                  <span v-else>{{ getResourceTypeLabel(resource.accountType) }} Account</span>
                </h3>
                <div class="resource-subtitle" v-if="resource.name">
                  {{ getResourceTypeLabel(resource.accountType) }} Account
                </div>
                <div class="resource-description" v-if="resource.description">
                  {{ resource.description }}
                </div>
                <div class="resource-account">
                  <strong>Account ID:</strong> {{ formatAccountId(resource.accountId) }}
                </div>
<!--                <div class="resource-role" v-if="resource.roleName">-->
<!--                  <strong>Role:</strong> {{ resource.roleName }}-->
<!--                </div>-->
<!--                <div class="resource-owner" v-if="resource.userId">-->
<!--                  <strong>Owner:</strong> {{ getUserName(resource.userId) }}-->
<!--                </div>-->
              </div>
              <div class="resource-header-actions">
                <div class="resource-status-badge" @click.stop>
                  <el-select 
                    :model-value="getStatusForResource(resource)"
                    @change="(value) => updateStatus(resource, value)"
                    :loading="isResourceUpdating(resource.uuid)"
                    size="small"
                    :class="['status-select', getStatusForResource(resource)]"
                    @click.stop
                  >
                    <el-option label="Enabled" value="Enabled" />
                    <el-option label="Paused" value="Paused" />
                  </el-select>
                </div>
                <button class="expand-toggle" @click.stop="toggleResourceExpansion(resource.uuid)">
                  <span class="expand-text">{{ isResourceExpanded(resource.uuid) ? 'Hide Details' : 'Show Details' }}</span>
                  <span class="chevron-icon" :class="{ expanded: isResourceExpanded(resource.uuid) }">▼</span>
                </button>
              </div>
            </div>
            
            <transition name="expand">
              <div v-if="isResourceExpanded(resource.uuid)" class="resource-expanded-content">
                <div class="detail-section">
                  <div class="detail-header">
                    <h4>Account Information</h4>
                    <div class="detail-actions">
                      <bf-button 
                        v-if="!isResourceEditing(resource.uuid)" 
                        @click="startEditing(resource)" 
                        class="secondary small"
                      >
                        Edit
                      </bf-button>
                      <div v-else class="edit-actions">
                        <bf-button 
                          @click="saveChanges(resource)" 
                          :loading="isResourceUpdating(resource.uuid)"
                          class="primary small"
                        >
                          Save
                        </bf-button>
                        <bf-button 
                          @click="cancelEditing(resource.uuid)" 
                          class="secondary small"
                        >
                          Cancel
                        </bf-button>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Editable Name -->
                  <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value" v-if="!isResourceEditing(resource.uuid)">
                      <span v-if="resource.name">{{ resource.name }}</span>
                      <span v-else class="empty-value">No name set</span>
                    </span>
                    <div class="detail-value" v-else>
                      <el-input 
                        v-model="editingData[resource.uuid].name"
                        placeholder="Enter resource name"
                        size="small"
                      />
                    </div>
                  </div>
                  
                  <!-- Editable Description -->
                  <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value" v-if="!isResourceEditing(resource.uuid)">
                      <span v-if="resource.description">{{ resource.description }}</span>
                      <span v-else class="empty-value">No description set</span>
                    </span>
                    <div class="detail-value" v-else>
                      <el-input 
                        v-model="editingData[resource.uuid].description"
                        type="textarea"
                        placeholder="Enter resource description"
                        :rows="2"
                        size="small"
                      />
                    </div>
                  </div>
                  
                  <!-- Status (editable in edit mode) -->
                  <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value" v-if="!isResourceEditing(resource.uuid)">
                      <span class="status-text" :class="{ paused: getStatusForResource(resource) === 'paused' }">
                        {{ getStatusForResource(resource) === 'paused' ? 'Paused' : 'Enabled' }}
                      </span>
                    </span>
                    <div class="detail-value" v-else>
                      <el-select 
                        v-model="editingData[resource.uuid].status"
                        size="small"
                      >
                        <el-option label="Enabled" value="enabled" />
                        <el-option label="Paused" value="paused" />
                      </el-select>
                    </div>
                  </div>
                  
                  <div class="detail-row">
                    <span class="detail-label">Account Type:</span>
                    <span class="detail-value">{{ getResourceTypeLabel(resource.accountType) }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Account ID:</span>
                    <span class="detail-value">{{ formatAccountId(resource.accountId) }}</span>
                  </div>
                  <div class="detail-row" v-if="resource.roleName">
                    <span class="detail-label">Role Name:</span>
                    <span class="detail-value">
                      {{ resource.roleName }}
                      <el-tooltip 
                        content="This is the role in the external account that allows Pennsieve to deploy infrastructure for analysis pipelines."
                        placement="top"
                        effect="dark"
                      >
                        <IconInfo :width="14" :height="14" class="info-icon" />
                      </el-tooltip>
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Resource UUID:</span>
                    <span class="detail-value mono">{{ resource.uuid }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Owner:</span>
                    <span class="detail-value">{{ getUserName(resource.ownerId || resource.userId) }}</span>
                  </div>
                </div>
                
                <div class="detail-section">
                  <div class="detail-header">
                    <h4>Workspace Access</h4>
                    <div class="detail-actions">
                      <bf-button 
                        @click="openAddWorkspaceDialog(resource)" 
                        :loading="isWorkspaceOperationLoading(resource)"
                        class="primary small"
                      >
                        Add Workspace
                      </bf-button>
                    </div>
                  </div>
                  
                  <div v-if="resource.enabledWorkspaces && resource.enabledWorkspaces.length > 0" class="workspace-access-list">
                    <div 
                      v-for="workspace in resource.enabledWorkspaces" 
                      :key="workspace.organizationId"
                      class="workspace-access-item"
                    >
                      <div class="workspace-content">
                        <div class="workspace-org">
                          <strong>{{ getWorkspaceNameById(workspace.organizationId) }}</strong>
                        </div>
                        <div class="workspace-meta">
                          <span class="workspace-badge" :class="{ public: workspace.isPublic }">
                            {{ workspace.isPublic ? 'Admin Managed' : 'Private' }}
                          </span>
                          <span class="workspace-info">
                            Enabled by {{ getUserName(workspace.enabledBy) }} on {{ formatDate(workspace.enabledAt) }}
                          </span>
                        </div>
                      </div>
                      <div class="workspace-actions">
<!--                        <router-link -->
<!--                          :to="{ -->
<!--                            name: 'compute-nodes',-->
<!--                            params: { orgId: workspace.organizationId }-->
<!--                          }"-->
<!--                          class="manage-nodes-button"-->
<!--                          title="Manage compute nodes"-->
<!--                        >-->
<!--                          <IconSettings :width="16" :height="16" />-->
<!--                        </router-link>-->
                        <button 
                          @click="openRemoveWorkspaceDialog(resource, workspace.organizationId)" 
                          :disabled="isWorkspaceOperationLoading(resource, workspace.organizationId)"
                          class="remove-workspace-button"
                          :title="'Remove workspace access'"
                        >
                          <IconRemove :width="16" :height="16" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div v-else class="no-workspaces">
                    <p>No workspaces are currently enabled for this resource.</p>
                    <p class="add-workspace-hint">Click "Add Workspace" to enable access for this organization.</p>
                  </div>
                </div>
                
                <!-- Compute Nodes Section -->
                <div class="detail-section">
                  <div class="detail-header">
                    <h4>Compute Nodes</h4>
                    <div class="detail-actions">
                      <span v-if="isLoadingComputeNodesForResource(resource.uuid)" class="loading-text">
                        Loading nodes...
                      </span>
                    </div>
                  </div>
                  
                  <div v-loading="isLoadingComputeNodesForResource(resource.uuid)" class="compute-nodes-content">
                    <div v-if="getComputeNodesForResource(resource.uuid).length > 0" class="compute-nodes-list">
                      <div 
                        v-for="node in getComputeNodesForResource(resource.uuid)" 
                        :key="node.uuid"
                        class="compute-node-item"
                      >
                        <div class="node-content">
                          <div class="node-name">
                            <strong>{{ node.name || 'Unnamed Node' }}</strong>
                          </div>
                          <div class="node-info">
                            <span class="node-workspace">{{ getWorkspaceNameById(node.organizationId) }}</span>
                            <span class="node-separator">•</span>
                            <span class="node-owner">{{ getUserName(node.ownerId || node.userId) }}</span>
                          </div>
                        </div>
                        <div class="node-actions">
                          <div class="node-status">
                            <span :class="['node-status-badge', getNodeStatusForDisplay(node).toLowerCase()]">
                              {{ getNodeStatusForDisplay(node) }}
                            </span>
                          </div>
<!--                          <router-link -->
<!--                            :to="{ -->
<!--                              name: 'compute-node-management',-->
<!--                              params: { orgId: node.organizationId, nodeId: node.uuid }-->
<!--                            }"-->
<!--                            class="manage-node-button"-->
<!--                            title="Manage this compute node"-->
<!--                          >-->
<!--                            <IconSettings :width="16" :height="16" />-->
<!--                          </router-link>-->
                        </div>
                      </div>
                    </div>
                    
                    <div v-else-if="!isLoadingComputeNodesForResource(resource.uuid)" class="no-compute-nodes">
                      <p>No compute nodes are currently deployed for this account.</p>
                      <p class="compute-nodes-hint">Compute nodes are created when you run analysis workflows in workspaces that have access to this compute resource.</p>
                    </div>
                  </div>
                </div>
                
              </div>
            </transition>
            
            <div class="resource-workspaces" v-if="!isResourceExpanded(resource.uuid) && resource.enabledWorkspaces && resource.enabledWorkspaces.length > 0">
              <div class="workspace-header">
                <strong>Enabled Workspaces:</strong>
                <span class="workspace-count">({{ resource.enabledWorkspaces.length }})</span>
              </div>
              <div class="workspace-list">
                <div 
                  v-for="workspace in getEnabledWorkspacesForCurrentOrg(resource)" 
                  :key="workspace.organizationId"
                  class="workspace-item"
                >
                  <span class="workspace-badge" :class="{ public: workspace.isPublic }">
                    {{ workspace.isPublic ? 'Public' : 'Private' }}
                  </span>
                  <span class="workspace-details">
                    Enabled by {{ getUserName(workspace.enabledBy) }} on {{ formatDate(workspace.enabledAt) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Usage Guidelines -->
<!--      <div class="guidelines-section">-->
<!--        <h3>Usage Guidelines</h3>-->
<!--        <div class="guidelines-grid">-->
<!--          <div class="guideline-item">-->
<!--            <h4>🔐 Security Best Practices</h4>-->
<!--            <p>Use IAM roles with minimal required permissions. Avoid using root account credentials.</p>-->
<!--          </div>-->
<!--          <div class="guideline-item">-->
<!--            <h4>💰 Cost Management</h4>-->
<!--            <p>Monitor your cloud usage regularly and set up billing alerts to avoid unexpected charges.</p>-->
<!--          </div>-->
<!--          <div class="guideline-item">-->
<!--            <h4>🌍 Region Selection</h4>-->
<!--            <p>Choose regions close to your data and users for optimal performance and compliance.</p>-->
<!--          </div>-->
<!--        </div>-->
<!--      </div>-->
    </div>
    
    <!-- Add Workspace Access Dialog -->
    <el-dialog
      v-model="showAddWorkspaceDialog"
      title="Add Workspace Access"
      width="500px"
      :close-on-click-modal="true"
    >
      <div v-if="selectedResourceForWorkspace" class="add-workspace-dialog">
        <div class="dialog-section">
          <h4>Resource</h4>
          <div class="resource-info-summary">
            <strong>
              {{ selectedResourceForWorkspace.name || getResourceTypeLabel(selectedResourceForWorkspace.accountType) + ' Account' }}
            </strong>
            <span class="account-id">{{ formatAccountId(selectedResourceForWorkspace.accountId) }}</span>
          </div>
        </div>
        
        <div class="dialog-section">
          <h4>Workspace Access Settings</h4>
          
          <div class="form-field">
            <label>Select Workspace</label>
            <el-select 
              v-model="newWorkspaceAccess.organizationId"
              placeholder="Choose a workspace where you have admin rights"
              style="width: 100%"
              size="default"
            >
              <el-option
                v-for="workspace in adminWorkspaces"
                :key="workspace.id"
                :label="workspace.name"
                :value="workspace.id"
              >
                <div class="workspace-option">
                  <div class="workspace-name">{{ workspace.name }}</div>
                  <div class="workspace-role">{{ workspace.role === 'owner' ? 'Owner' : 'Admin' }}</div>
                </div>
              </el-option>
            </el-select>
            <div class="field-help" v-if="adminWorkspaces.length === 0">
              <p class="warning">
                <strong>No admin workspaces found:</strong> You need admin or owner permissions in a workspace to add compute resource access.
              </p>
            </div>
          </div>
          
          <div class="form-field" v-if="newWorkspaceAccess.organizationId">
            <label>Access Type</label>
            <el-radio-group v-model="newWorkspaceAccess.isPublic">
              <el-radio :value="false">Private Access</el-radio>
              <el-radio :value="true">Admin Managed</el-radio>
            </el-radio-group>
            <div class="field-help">
              <p v-if="!newWorkspaceAccess.isPublic">
                <strong>Private Access:</strong> Only you can manage compute nodes for this resource in this workspace.
              </p>
              <p v-else>
                <strong>Admin Managed:</strong> Workspace administrators can manage compute nodes for this resource.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <bf-button @click="closeAddWorkspaceDialog" class="secondary">
            Cancel
          </bf-button>
          <bf-button 
            @click="handleAddWorkspace" 
            :loading="selectedResourceForWorkspace && isWorkspaceOperationLoading(selectedResourceForWorkspace)"
            :disabled="isAddWorkspaceDisabled()"
            class="primary"
          >
            Add Access
          </bf-button>
        </div>
      </template>
    </el-dialog>

    <!-- Remove Workspace Confirmation Dialog -->
    <el-dialog
      v-model="showRemoveWorkspaceDialog"
      title="Remove Workspace Access"
      width="480px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedResourceForWorkspace && selectedWorkspaceForRemoval" class="remove-workspace-dialog">
        <div class="warning-section">
          <div class="warning-icon">⚠️</div>
          <div class="warning-content">
            <h4>Are you sure you want to remove workspace access?</h4>
            <p class="warning-message">
              Removing workspace access for <strong>{{ getWorkspaceNameById(selectedWorkspaceForRemoval) }}</strong> 
              will also remove any compute nodes associated with this compute resource in that workspace.
            </p>
            <p class="impact-message">
              This action cannot be undone. Any running compute jobs may be affected.
            </p>
          </div>
        </div>

        <div class="resource-workspace-summary">
          <div class="summary-row">
            <strong>Compute Resource:</strong> 
            {{ selectedResourceForWorkspace.name || getResourceTypeLabel(selectedResourceForWorkspace.accountType) + ' Account' }}
          </div>
          <div class="summary-row">
            <strong>Workspace:</strong> 
            {{ getWorkspaceNameById(selectedWorkspaceForRemoval) }}
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <bf-button @click="closeRemoveWorkspaceDialog" class="secondary">
            Cancel
          </bf-button>
          <bf-button 
            @click="confirmRemoveWorkspace" 
            :loading="selectedResourceForWorkspace && selectedWorkspaceForRemoval && isWorkspaceOperationLoading(selectedResourceForWorkspace, selectedWorkspaceForRemoval)"
            class="danger"
          >
            Remove Access
          </bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.compute-resources-container {
  max-width: 1000px;
  margin: 16px;
}

h2 {
  font-weight: 300;
  font-size: 24px;
  color: theme.$gray_6;
  margin-bottom: 8px;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  gap: 24px;
}

.header-text {
  flex: 1;
}

.intro-text {
  font-size: 16px;
  color: theme.$gray_5;
  margin: 0;
  line-height: 1.5;
}

.header-actions {
  flex-shrink: 0;
}

.resources-section {
  margin-bottom: 48px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;

  .empty-icon {
    color: theme.$gray_4;
    margin-bottom: 24px;
  }

  h3 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 24px 0;
    line-height: 1.5;
  }
}

.resources-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.resource-card {
  background: white;
  border: 1px solid theme.$gray_2;
  //border-radius: 8px;
  padding: 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
    //box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.expanded {
    border-color: theme.$purple_2;
    //box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;

  &.clickable {
    cursor: pointer;
    user-select: none;
  }
}

.resource-info {
  flex: 1;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .resource-type {
    font-size: 13px;
    color: theme.$gray_5;
    margin-bottom: 4px;
  }

  .resource-status {
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
  }
}

.resource-header-actions {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.expand-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  color: theme.$gray_5;
  transition: all 0.2s ease;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 13px;
  font-weight: 500;

  &:hover {
    background: theme.$gray_1;
    color: theme.$purple_2;
  }

  //&:focus {
  //  outline: none;
  //  box-shadow: 0 0 0 2px rgba(theme.$purple_2, 0.2);
  //}

  .expand-text {
    white-space: nowrap;
  }

  .chevron-icon {
    font-size: 12px;
    transition: transform 0.2s ease;
    transform: rotate(0deg);
    flex-shrink: 0;

    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.resource-details {
  font-size: 13px;
  color: theme.$gray_5;

  .detail-item {
    margin-bottom: 4px;

    strong {
      color: theme.$gray_6;
    }
  }
}

.guidelines-section {
  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin-bottom: 16px;
  }
}

.guidelines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.guideline-item {
  padding: 16px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 6px;

  h4 {
    font-size: 14px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  p {
    font-size: 13px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.4;
  }
}

// Dialog styles
.resource-form {
  .form-field {
    margin-bottom: 16px;

    label {
      display: block;
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 500;
      color: theme.$gray_6;
    }
  }

  .form-input, .form-select, .form-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 12px;
    border: 1px solid theme.$gray_3;
    border-radius: 4px;
    font-size: 14px;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: theme.$purple_2;
    }
  }

  .form-textarea {
    resize: vertical;
    font-family: inherit;
  }

  .security-note {
    margin-top: 16px;
    padding: 12px;
    background: rgba(theme.$orange_1, 0.1);
    border: 1px solid rgba(theme.$orange_1, 0.2);
    border-radius: 4px;

    p {
      margin: 0;
      font-size: 13px;
      color: theme.$gray_6;
      line-height: 1.4;
    }
  }
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

// Add Workspace Dialog Styles
.add-workspace-dialog {
  .dialog-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    h4 {
      font-size: 16px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid theme.$gray_2;
    }
  }

  .resource-info-summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: theme.$gray_1;
    border-radius: 6px;

    strong {
      color: theme.$gray_6;
      font-size: 14px;
    }

    .account-id {
      font-size: 13px;
      color: theme.$gray_5;
      font-family: 'Courier New', monospace;
    }
  }

  .organization-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: theme.$gray_1;
    border-radius: 6px;

    strong {
      color: theme.$gray_6;
      font-size: 14px;
    }

    .org-id {
      font-size: 12px;
      color: theme.$gray_5;
      font-family: 'Courier New', monospace;
    }
  }

  .form-field {
    margin-bottom: 20px;

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: theme.$gray_6;
    }

    .field-help {
      margin-top: 12px;
      
      p {
        margin: 0;
        padding: 12px;
        background: theme.$gray_1;
        border-radius: 6px;
        font-size: 13px;
        line-height: 1.4;
        color: theme.$gray_5;

        strong {
          color: theme.$gray_6;
        }
      }
    }
  }

  // ElementPlus radio group styling
  :deep(.el-radio-group) {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-radio {
      margin-right: 0;
      
      .el-radio__label {
        font-size: 14px;
        color: theme.$gray_6;
        font-weight: 500;
      }
    }
  }
}

// Button modifications
:deep(.bf-button) {
  &.small {
    padding: 6px 8px;
    font-size: 12px;
    
    svg {
      width: 14px;
      height: 14px;
    }
  }

  &.danger {
    &:hover {
      background: theme.$red_1;
      border-color: theme.$red_1;
      color: white;
    }
  }
}

// Info Section Styles
.info-section {
  margin-bottom: 32px;
}

.info-card {
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  padding: 24px;

  h3 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  p {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0 0 12px 0;
  }

  .info-note {
    background: rgba(theme.$purple_1, 0.1);
    border-left: 3px solid theme.$purple_1;
    padding: 12px;
    margin: 16px 0;
    border-radius: 4px;
  }

  .setup-steps {
    margin: 20px 0;

    h4 {
      font-size: 15px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 12px 0;
    }

    ol {
      margin: 0;
      padding-left: 24px;

      li {
        font-size: 14px;
        color: theme.$gray_5;
        line-height: 1.6;
        margin-bottom: 8px;
      }
    }
  }

  .documentation-link {
    margin-top: 16px;

    .doc-link {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      background: theme.$purple_3;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s ease;

      &:hover {
        background: theme.$purple_2;
      }
    }
  }
}

// Resource card additional styles
.resource-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 6px;
  font-weight: 400;
}

.resource-description {
  font-size: 14px;
  color: theme.$gray_5;
  margin: 8px 0;
  line-height: 1.4;
}

.resource-account,
.resource-role,
.resource-owner {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 4px;

  strong {
    color: theme.$gray_6;
    font-weight: 500;
  }
}

.resource-status-badge {
  .status-indicator {
    padding: 4px 12px;
    border-radius: 12px;
    color: white;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .status-select {
    min-width: 90px;
    
    :deep(.el-select__wrapper) {
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      text-transform: capitalize;
      letter-spacing: 0.25px;
      height: 28px;
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
    
    // Status-specific colors - more subtle approach
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
    
    // Loading state
    &.is-loading :deep(.el-select__wrapper) {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.resource-expanded-content {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid theme.$gray_2;

  .detail-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid theme.$gray_2;
      
      h4 {
        font-size: 15px;
        font-weight: 500;
        color: theme.$gray_6;
        margin: 0;
        line-height: 1.2;
      }
      
      .detail-actions {
        margin-top: -2px; // Align buttons optically with header text
        
        .edit-actions {
          display: flex;
          gap: 8px;
        }
      }
    }

    .detail-row {
      display: flex;
      padding: 8px 0;
      font-size: 14px;

      .detail-label {
        flex: 0 0 140px;
        color: theme.$gray_5;
        font-weight: 500;
      }

      .detail-value {
        flex: 1;
        color: theme.$gray_6;

        &.mono {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          background: theme.$gray_1;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .info-icon {
          margin-left: 8px;
          color: theme.$gray_4;
          cursor: help;
          vertical-align: middle;
          
          &:hover {
            color: theme.$purple_2;
          }
        }

        .status-text {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          background: rgba(theme.$green_1, 0.1);
          color: theme.$green_1;

          &.paused {
            background: rgba(#F59E0B, 0.1);
            color: #F59E0B;
          }
        }
        
        .empty-value {
          color: theme.$gray_4;
          font-style: italic;
        }
        
        // Style for form elements in edit mode
        :deep(.el-input) {
          margin: 0;
          
          .el-input__wrapper {
            border-radius: 4px;
            
            &:hover {
              box-shadow: 0 0 0 1px theme.$gray_3;
            }
            
            &.is-focus {
              box-shadow: 0 0 0 1px theme.$purple_2;
            }
          }
        }
        
        :deep(.el-textarea) {
          .el-textarea__inner {
            border-radius: 4px;
            font-family: inherit;
            
            &:hover {
              border-color: theme.$gray_3;
            }
            
            &:focus {
              border-color: theme.$purple_2;
            }
          }
        }
        
        :deep(.el-select) {
          width: 120px;
          
          .el-select__wrapper {
            border-radius: 4px;
            
            &:hover {
              box-shadow: 0 0 0 1px theme.$gray_3;
            }
            
            &.is-focused {
              box-shadow: 0 0 0 1px theme.$purple_2;
            }
          }
        }
      }
    }

    .no-workspaces {
      text-align: center;
      padding: 24px;
      
      p {
        color: theme.$gray_5;
        font-size: 14px;
        margin: 0 0 8px 0;
        
        &.add-workspace-hint {
          font-size: 13px;
          color: theme.$gray_4;
        }
      }
    }
  }

  .workspace-access-list {
    .workspace-access-item {
      display: flex;
      align-items: flex-start;
      padding: 12px;
      background: theme.$gray_1;
      margin-bottom: 12px;
      gap: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .workspace-content {
        flex: 1;

        .workspace-org {
          font-size: 13px;
          color: theme.$gray_6;
          margin-bottom: 8px;
        }

        .workspace-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          color: theme.$gray_5;

          .workspace-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 500;
            background: theme.$gray_2;
            color: theme.$gray_6;

            &.public {
              background: rgba(theme.$green_1, 0.1);
              color: theme.$green_1;
            }
          }

          .workspace-info {
            flex: 1;
          }
        }
      }

      .workspace-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
        margin-top: 2px; // Align with content
      }
    }
  }
}

.resource-workspaces {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid theme.$gray_2;

  .workspace-header {
    font-size: 13px;
    color: theme.$gray_6;
    margin-bottom: 8px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;

    .workspace-count {
      color: theme.$gray_5;
      font-weight: normal;
      font-size: 12px;
    }
  }

  .workspace-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 12px;
    color: theme.$gray_5;

    .workspace-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      background: theme.$gray_2;
      color: theme.$gray_6;

      &.public {
        background: rgba(theme.$green_1, 0.1);
        color: theme.$green_1;
      }
    }

    .workspace-details {
      flex: 1;
    }
  }
}

// Vue transition styles for smooth expansion
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-10px);
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  transform: translateY(0);
}

// Workspace dropdown option styling
.workspace-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  .workspace-name {
    font-weight: 500;
    color: theme.$gray_6;
  }

  .workspace-role {
    font-size: 12px;
    color: theme.$gray_5;
    background: theme.$gray_1;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    font-weight: 500;
  }
}

// Warning styling for field help
:deep(.field-help) {
  p.warning {
    background: rgba(#F59E0B, 0.1) !important;
    border: 1px solid rgba(#F59E0B, 0.2);
    color: #92400E !important;

    strong {
      color: #92400E !important;
    }
  }
}

// Manage nodes button styles
.manage-nodes-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: theme.$gray_1;
  color: theme.$gray_5;
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    background: theme.$purple_1;
    color: white;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(theme.$purple_1, 0.2);
  }
}

// Remove workspace button styles
.remove-workspace-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: theme.$gray_1;
  color: theme.$gray_5;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: theme.$red_2;
    color: white;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(theme.$red_1, 0.2);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    
    &:hover {
      background: theme.$gray_1;
      color: theme.$gray_5;
    }
  }
}

// Remove Workspace Dialog Styles
.remove-workspace-dialog {
  .warning-section {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
    padding: 20px;
    background: rgba(#F59E0B, 0.05);
    border: 1px solid rgba(#F59E0B, 0.15);
    border-radius: 8px;

    .warning-icon {
      font-size: 24px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .warning-content {
      flex: 1;

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

        strong {
          color: theme.$gray_6;
          font-weight: 600;
        }
      }

      .impact-message {
        font-size: 13px;
        color: #D97706;
        margin: 0;
        font-weight: 500;
        line-height: 1.4;
      }
    }
  }

  .resource-workspace-summary {
    padding: 16px;
    background: theme.$gray_1;
    border-radius: 6px;
    border: 1px solid theme.$gray_2;

    .summary-row {
      display: flex;
      align-items: center;
      font-size: 14px;
      margin-bottom: 8px;
      
      &:last-child {
        margin-bottom: 0;
      }

      strong {
        color: theme.$gray_6;
        font-weight: 600;
        min-width: 140px;
        margin-right: 8px;
      }
    }
  }
}

// Compute Nodes Section Styles
.compute-nodes-content {
  .compute-nodes-list {
    .compute-node-item {
      display: flex;
      align-items: flex-start;
      padding: 12px;
      //background: theme.$gray_1;
      //border-radius: 6px;
      margin-bottom: 12px;
      gap: 12px;
      //border: 1px solid theme.$gray_2;
      transition: all 0.2s ease;

      &:last-child {
        margin-bottom: 0;
      }

      &:hover {
        background: rgba(theme.$purple_1, 0.05);
        border-color: rgba(theme.$purple_1, 0.2);
      }

      .node-content {
        flex: 1;

        .node-name {
          margin-bottom: 6px;

          strong {
            font-size: 14px;
            color: theme.$gray_6;
            font-weight: 500;
          }
        }

        .node-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: theme.$gray_5;

          .node-workspace {
            font-weight: 500;
          }

          .node-separator {
            color: theme.$gray_4;
          }

        }
      }

      .node-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-shrink: 0;
        margin-top: 2px;

        .node-status {
          .node-status-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 2px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            
            // Status colors
            &.pending {
              background: rgba(theme.$gray_4, 0.15);
              color: theme.$gray_5;
              border: 1px solid rgba(theme.$gray_4, 0.3);
            }
            
            &.enabled {
              background: rgba(#10B981, 0.1);
              color: theme.$green_2;
              border: 1px solid rgba(#10B981, 0.2);
            }
            
            &.paused {
              background: rgba(#F59E0B, 0.1);
              color: theme.$orange_2;
              border: 1px solid rgba(#F59E0B, 0.2);
            }
          }
          
          .node-status-select {
            min-width: 80px;
            
            :deep(.el-select__wrapper) {
              border: 1px solid transparent;
              border-radius: 2px;
              font-size: 11px;
              font-weight: 500;
              text-transform: capitalize;
              letter-spacing: 0.25px;
              height: 24px;
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
              font-size: 11px;
              font-weight: 500;
            }
            
            :deep(.el-select__caret) {
              color: theme.$gray_4;
            }
            
            // Status-specific colors - same as account state tags
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
            
            &.disabled {
              :deep(.el-select__wrapper) {
                background: rgba(theme.$gray_4, 0.08);
                border-color: rgba(theme.$gray_4, 0.2);
                
                &:hover {
                  background: rgba(theme.$gray_4, 0.12);
                  border-color: rgba(theme.$gray_4, 0.3);
                }
              }
              
              :deep(.el-input__inner) {
                color: theme.$gray_5;
              }
              
              :deep(.el-select__caret) {
                color: theme.$gray_5;
              }
            }
          }
        }
      }
    }
  }

  .no-compute-nodes {
    text-align: center;
    padding: 24px;
    
    p {
      color: theme.$gray_5;
      font-size: 14px;
      margin: 0 0 8px 0;
      line-height: 1.4;
      
      &.compute-nodes-hint {
        font-size: 13px;
        color: theme.$gray_4;
      }
    }
  }

  .loading-text {
    font-size: 13px;
    color: theme.$gray_4;
    font-style: italic;
  }
}

// Manage node button styles
.manage-node-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: theme.$gray_2;
  color: theme.$gray_5;
  text-decoration: none;
  transition: all 0.2s ease;
  
  &:hover {
    background: theme.$purple_1;
    color: white;
    transform: translateY(-1px);
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(theme.$purple_1, 0.2);
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .header-section {
    flex-direction: column;
    align-items: stretch;
  }

  .resources-grid {
    grid-template-columns: 1fr;
  }

  .guidelines-grid {
    grid-template-columns: 1fr;
  }

  .compute-nodes-content {
    .compute-nodes-list {
      .compute-node-item {
        .node-content {
          .node-details {
            grid-template-columns: 1fr;
          }
        }
      }
    }
  }
}
</style>