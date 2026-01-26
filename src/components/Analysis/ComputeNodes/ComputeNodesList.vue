<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import BfEmptyPageState from '@/components/shared/bf-empty-page-state/BfEmptyPageState.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import CreateComputeNodeDialog from './CreateComputeNodeDialog.vue'

const store = useStore()
const profile = computed(() => store.state.profile)
const activeOrganization = computed(() => store.getters.activeOrganization)
const orgMembers = computed(() => store.state.orgMembers || [])

const computeNodes = ref([])
const isLoading = ref(false)
const expandedNodes = ref(new Set())
const editingNodes = ref(new Set())
const editingData = ref({})
const isUpdating = ref(new Set())
const createComputeNodeDialogVisible = ref(false)
const deleteNodeDialogVisible = ref(false)
const selectedNodeForDeletion = ref(null)

// Get current organization from store
const currentOrganization = computed(() => store.getters.activeOrganization?.organization)

// Compute organization name
const orgName = computed(() => currentOrganization.value?.name || '')

// Check if user has admin rights
const hasAdminRights = computed(() => {
  if (activeOrganization.value) {
    return activeOrganization.value.isAdmin || activeOrganization.value.isOwner
  }
  return false
})

// Check if user is owner
const isOwner = computed(() => activeOrganization.value?.isOwner || false)

// Show empty state when no nodes exist
const showEmptyState = computed(() => !isLoading.value && computeNodes.value.length === 0)

// Format account ID for display
const formatAccountId = (accountId) => {
  if (!accountId) return ''
  // Add dashes for AWS account IDs (12 digits)
  if (accountId.length === 12) {
    return `${accountId.slice(0, 4)}-${accountId.slice(4, 8)}-${accountId.slice(8)}`
  }
  return accountId
}

// Format date
const formatDate = (dateString) => {
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

// Get user name from org members
const getUserName = (userId) => {
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

onMounted(() => {
  fetchComputeNodes()
})

async function fetchComputeNodes() {
  isLoading.value = true
  try {
    const token = await useGetToken()
    const orgId = currentOrganization.value?.id
    if (!orgId) {
      console.error('No organization ID found')
      return
    }
    
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes?organization_id=${orgId}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      computeNodes.value = data || []
    } else {
      console.error('Failed to fetch compute nodes:', response.status, response.statusText)
      computeNodes.value = []
    }
  } catch (error) {
    console.error('Failed to fetch compute nodes:', error)
    computeNodes.value = []
  } finally {
    isLoading.value = false
  }
}

function toggleNodeExpansion(nodeUuid) {
  const newExpanded = new Set(expandedNodes.value)
  if (newExpanded.has(nodeUuid)) {
    newExpanded.delete(nodeUuid)
  } else {
    newExpanded.add(nodeUuid)
  }
  expandedNodes.value = newExpanded
}

function isNodeExpanded(nodeUuid) {
  return expandedNodes.value.has(nodeUuid)
}

function isNodeEditing(nodeUuid) {
  return editingNodes.value.has(nodeUuid)
}

function isNodeUpdating(nodeUuid) {
  return isUpdating.value.has(nodeUuid)
}

function startEditing(node) {
  const newEditing = new Set(editingNodes.value)
  newEditing.add(node.uuid)
  editingNodes.value = newEditing
  
  // Initialize editing data with current values
  editingData.value[node.uuid] = {
    name: node.name || '',
    description: node.description || '',
    status: node.status || 'Enabled'
  }
}

function cancelEditing(nodeUuid) {
  const newEditing = new Set(editingNodes.value)
  newEditing.delete(nodeUuid)
  editingNodes.value = newEditing
  
  // Clear editing data
  delete editingData.value[nodeUuid]
}

async function saveChanges(node) {
  const nodeUuid = node.uuid
  const changes = editingData.value[nodeUuid]
  
  if (!changes) return
  
  // Add to updating set
  const newUpdating = new Set(isUpdating.value)
  newUpdating.add(nodeUuid)
  isUpdating.value = newUpdating
  
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid}`
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: changes.name || null,
        description: changes.description || null,
        status: changes.status
      })
    })
    
    if (response.ok) {
      const updatedNode = await response.json()
      
      // Update the node in the list
      const index = computeNodes.value.findIndex(n => n.uuid === nodeUuid)
      if (index !== -1) {
        computeNodes.value[index] = {
          ...computeNodes.value[index],
          ...updatedNode
        }
      }
      
      // Exit editing mode
      cancelEditing(nodeUuid)
      
      ElMessage.success('Compute node updated successfully')
    } else {
      console.error('Failed to update node:', response.status, response.statusText)
      ElMessage.error('Failed to update compute node')
    }
  } catch (error) {
    console.error('Failed to update node:', error)
    ElMessage.error('Failed to update compute node')
  } finally {
    // Remove from updating set
    const newUpdating = new Set(isUpdating.value)
    newUpdating.delete(nodeUuid)
    isUpdating.value = newUpdating
  }
}

async function updateStatus(node, newStatus) {
  const nodeUuid = node.uuid
  
  // Add to updating set
  const newUpdating = new Set(isUpdating.value)
  newUpdating.add(nodeUuid)
  isUpdating.value = newUpdating
  
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid}`
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: newStatus
      })
    })
    
    if (response.ok) {
      const updatedNode = await response.json()
      
      // Update the node in the list
      const index = computeNodes.value.findIndex(n => n.uuid === nodeUuid)
      if (index !== -1) {
        computeNodes.value[index] = {
          ...computeNodes.value[index],
          ...updatedNode
        }
      }
      
      ElMessage.success(`Compute node ${newStatus.toLowerCase()}`)
    } else {
      console.error('Failed to update node status:', response.status, response.statusText)
      ElMessage.error('Failed to update node status')
    }
  } catch (error) {
    console.error('Failed to update node status:', error)
    ElMessage.error('Failed to update node status')
  } finally {
    // Remove from updating set
    const newUpdating = new Set(isUpdating.value)
    newUpdating.delete(nodeUuid)
    isUpdating.value = newUpdating
  }
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
  // Use the status field, default to 'Enabled' if not present
  return node.status || 'Enabled'
}

function openCreateDialog() {
  createComputeNodeDialogVisible.value = true
}

function closeCreateDialog() {
  createComputeNodeDialogVisible.value = false
  // Refresh the list after creating
  fetchComputeNodes()
}

function openDeleteDialog(node) {
  selectedNodeForDeletion.value = node
  deleteNodeDialogVisible.value = true
}

function closeDeleteDialog() {
  selectedNodeForDeletion.value = null
  deleteNodeDialogVisible.value = false
}

async function confirmDeleteNode() {
  if (!selectedNodeForDeletion.value) return
  
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${selectedNodeForDeletion.value.uuid}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      // Remove from local list
      const index = computeNodes.value.findIndex(n => n.uuid === selectedNodeForDeletion.value.uuid)
      if (index !== -1) {
        computeNodes.value.splice(index, 1)
      }
      
      ElMessage.success('Compute node deleted successfully')
      closeDeleteDialog()
    } else {
      console.error('Failed to delete node:', response.status, response.statusText)
      ElMessage.error('Failed to delete compute node')
    }
  } catch (error) {
    console.error('Failed to delete node:', error)
    ElMessage.error('Failed to delete compute node')
  }
}
</script>

<template>
  <bf-stage element-loading-background="transparent">
    <template #actions>
      <bf-button
        :disabled="!hasAdminRights"
        @click="openCreateDialog"
      >
        Create Compute Node
      </bf-button>
    </template>
    
    <div class="compute-nodes-container">
      <div class="nodes-content">
        <!-- Setup Information Section -->
        <div class="info-section">
          <div class="info-card">
            <h3>Managing Compute Nodes</h3>
            <p>
              Compute nodes are computational resources within your cloud accounts that process and analyze your Pennsieve data.
              Each compute node is associated with a specific AWS account and can run analysis workflows on your datasets.
            </p>
            <p class="info-note">
              <strong>Note:</strong> Before creating compute nodes, ensure you have registered your AWS account as a Compute Resource.
              Compute nodes require an active AWS account with the proper permissions configured.
            </p>
            <div class="setup-steps">
              <h4>Quick Setup Guide:</h4>
              <ol>
                <li>Ensure your AWS account is registered as a Compute Resource</li>
                <li>Click "Create Compute Node" to set up a new node</li>
                <li>Configure the node with a name and description</li>
                <li>Manage node status (enabled/paused) as needed</li>
                <li>Monitor node activity and resource usage</li>
              </ol>
            </div>
            <div class="documentation-link">
              <a href="https://docs.pennsieve.io/docs/compute-nodes" target="_blank" class="doc-link">
                View Full Documentation
                <IconArrowRight :width="14" :height="14" style="margin-left: 4px;" />
              </a>
            </div>
          </div>
        </div>

        <!-- Nodes List -->
        <div class="nodes-section" v-loading="isLoading">
          <h3>Available Compute Nodes</h3>
          
          <div v-if="showEmptyState" class="empty-state">
            <bf-empty-page-state class="empty">
              <img
                src="../../../assets/images/illustrations/illo-collaboration.svg"
                height="240"
                width="247"
                alt="Teams illustration"
              />
              <div v-if="hasAdminRights" class="copy">
                <h2>There are no Compute Nodes registered for {{ orgName }} yet.</h2>
                <p>
                  Compute Nodes are associated with an Account, and allow users in your
                  organization to access compute resources to run data analysis
                  applications workflows. Click "Create Compute Node" above to get started.
                </p>
              </div>
              <div v-else class="copy">
                <h2>{{ orgName }} doesn't have any compute nodes yet.</h2>
                <p>
                  Contact your administrator to get started working with Compute Nodes
                </p>
              </div>
            </bf-empty-page-state>
          </div>

          <div v-else class="nodes-grid">
            <div 
              v-for="node in computeNodes" 
              :key="node.uuid"
              class="node-card"
              :class="{ expanded: isNodeExpanded(node.uuid) }"
            >
              <div 
                class="node-header clickable"
                @click="toggleNodeExpansion(node.uuid)"
              >
                <div class="node-info">
                  <h3>{{ node.name }}</h3>
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
                    <strong>Node ID:</strong> {{ node.identifier }}
                  </div>
                </div>
                <div class="node-header-actions">
                  <div class="node-status-badge" @click.stop>
                    <el-select 
                      :model-value="getStatusForNode(node)"
                      @change="(value) => updateStatus(node, value)"
                      :loading="isNodeUpdating(node.uuid)"
                      :disabled="!hasAdminRights"
                      size="small"
                      :class="['status-select', getStatusForNode(node).toLowerCase()]"
                      @click.stop
                    >
                      <el-option label="Enabled" value="Enabled" />
                      <el-option label="Paused" value="Paused" />
                    </el-select>
                  </div>
                  <button class="expand-toggle" @click.stop="toggleNodeExpansion(node.uuid)">
                    <span class="expand-text">{{ isNodeExpanded(node.uuid) ? 'Hide Details' : 'Show Details' }}</span>
                    <span class="chevron-icon" :class="{ expanded: isNodeExpanded(node.uuid) }">▼</span>
                  </button>
                </div>
              </div>
              
              <transition name="expand">
                <div v-if="isNodeExpanded(node.uuid)" class="node-expanded-content">
                  <div class="detail-section">
                    <div class="detail-header">
                      <h4>Node Information</h4>
                      <div class="detail-actions">
                        <bf-button 
                          v-if="!isNodeEditing(node.uuid) && hasAdminRights" 
                          @click="startEditing(node)" 
                          class="secondary small"
                        >
                          Edit
                        </bf-button>
                        <div v-else-if="isNodeEditing(node.uuid)" class="edit-actions">
                          <bf-button 
                            @click="saveChanges(node)" 
                            :loading="isNodeUpdating(node.uuid)"
                            class="primary small"
                          >
                            Save
                          </bf-button>
                          <bf-button 
                            @click="cancelEditing(node.uuid)" 
                            class="secondary small"
                          >
                            Cancel
                          </bf-button>
                        </div>
                        <bf-button 
                          v-if="isOwner && !isNodeEditing(node.uuid)" 
                          @click="openDeleteDialog(node)" 
                          class="danger small"
                        >
                          Delete
                        </bf-button>
                      </div>
                    </div>
                    
                    <!-- Editable Name -->
                    <div class="detail-row">
                      <span class="detail-label">Name:</span>
                      <span class="detail-value" v-if="!isNodeEditing(node.uuid)">
                        {{ node.name }}
                      </span>
                      <div class="detail-value" v-else>
                        <el-input 
                          v-model="editingData[node.uuid].name"
                          placeholder="Enter node name"
                          size="small"
                        />
                      </div>
                    </div>
                    
                    <!-- Editable Description -->
                    <div class="detail-row">
                      <span class="detail-label">Description:</span>
                      <span class="detail-value" v-if="!isNodeEditing(node.uuid)">
                        <span v-if="node.description">{{ node.description }}</span>
                        <span v-else class="empty-value">No description set</span>
                      </span>
                      <div class="detail-value" v-else>
                        <el-input 
                          v-model="editingData[node.uuid].description"
                          type="textarea"
                          placeholder="Enter node description"
                          :rows="2"
                          size="small"
                        />
                      </div>
                    </div>
                    
                    <!-- Status (editable in edit mode) -->
                    <div class="detail-row">
                      <span class="detail-label">Status:</span>
                      <span class="detail-value" v-if="!isNodeEditing(node.uuid)">
                        <span class="status-text" :class="{ paused: getStatusForNode(node) === 'Paused' }">
                          {{ getStatusForNode(node) }}
                        </span>
                      </span>
                      <div class="detail-value" v-else>
                        <el-select 
                          v-model="editingData[node.uuid].status"
                          size="small"
                        >
                          <el-option label="Enabled" value="Enabled" />
                          <el-option label="Paused" value="Paused" />
                        </el-select>
                      </div>
                    </div>
                    
                    <div class="detail-row">
                      <span class="detail-label">Account Type:</span>
                      <span class="detail-value">{{ getAccountTypeLabel(node.account?.accountType) }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Account ID:</span>
                      <span class="detail-value">{{ formatAccountId(node.account?.accountId) }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Node UUID:</span>
                      <span class="detail-value mono">{{ node.uuid }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Gateway URL:</span>
                      <span class="detail-value mono small">{{ node.computeNodeGatewayUrl || 'N/A' }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">EFS ID:</span>
                      <span class="detail-value mono">{{ node.efsId || 'N/A' }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Created By:</span>
                      <span class="detail-value">{{ getUserName(node.userId) }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Created At:</span>
                      <span class="detail-value">{{ formatDate(node.createdAt) }}</span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Create Compute Node Dialog -->
    <create-compute-node-dialog
      :dialog-visible="createComputeNodeDialogVisible"
      @close="closeCreateDialog"
    />
    
    <!-- Delete Node Confirmation Dialog -->
    <el-dialog
      v-model="deleteNodeDialogVisible"
      title="Delete Compute Node"
      width="480px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedNodeForDeletion" class="delete-node-dialog">
        <div class="warning-section">
          <div class="warning-icon">⚠️</div>
          <div class="warning-content">
            <h4>Are you sure you want to delete this compute node?</h4>
            <p class="warning-message">
              Deleting <strong>{{ selectedNodeForDeletion.name }}</strong> will permanently remove this compute node.
              Any running workflows on this node will be terminated.
            </p>
            <p class="impact-message">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div class="node-summary">
          <div class="summary-row">
            <strong>Node Name:</strong> 
            {{ selectedNodeForDeletion.name }}
          </div>
          <div class="summary-row">
            <strong>Account:</strong> 
            {{ formatAccountId(selectedNodeForDeletion.account?.accountId) }}
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <bf-button @click="closeDeleteDialog" class="secondary">
            Cancel
          </bf-button>
          <bf-button 
            @click="confirmDeleteNode" 
            class="danger"
          >
            Delete Node
          </bf-button>
        </div>
      </template>
    </el-dialog>
  </bf-stage>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.compute-nodes-container {
  max-width: 1000px;
  margin: 0;
}

h2 {
  font-weight: 300;
  font-size: 24px;
  color: theme.$gray_6;
  margin-bottom: 8px;
}

.nodes-content {
  padding: 0;
}

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

.nodes-section {
  margin-bottom: 48px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin-bottom: 16px;
  }
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;

  .empty {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
  }

  .copy {
    h2 {
      font-size: 16px;
      font-weight: 600;
      line-height: 16px;
      text-align: center;
      color: theme.$gray_6;
      margin: 16px 0;
    }

    p {
      color: theme.$gray_5;
      font-size: 14px;
      line-height: 16px;
      text-align: center;
      margin-bottom: 16px;
      max-width: 500px;
    }
  }
}

.nodes-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.node-card {
  background: white;
  border: 1px solid theme.$gray_2;
  padding: 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
  }

  &.expanded {
    border-color: theme.$purple_2;
  }
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  &.clickable {
    cursor: pointer;
    user-select: none;
  }
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

.node-account,
.node-identifier {
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
    
    // Status-specific colors
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

.node-expanded-content {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid theme.$gray_2;

  .detail-section {
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
        margin-top: -2px;
        display: flex;
        gap: 8px;
        
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
        word-break: break-all;

        &.mono {
          font-family: 'Courier New', monospace;
          font-size: 13px;
          background: theme.$gray_1;
          padding: 2px 6px;
          border-radius: 3px;
          
          &.small {
            font-size: 11px;
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

// Delete dialog styles
.delete-node-dialog {
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

  .node-summary {
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

// Button modifications
:deep(.bf-button) {
  &.small {
    padding: 6px 12px;
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

// Responsive adjustments
@media (max-width: 768px) {
  .nodes-grid {
    grid-template-columns: 1fr;
  }
}
</style>