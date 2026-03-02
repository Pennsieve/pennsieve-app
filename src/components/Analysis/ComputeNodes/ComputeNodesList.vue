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
import ComputeNodeCard from './ComputeNodeCard.vue'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'

const props = defineProps({
  orgId: String
})

const store = useStore()
const computeResourcesStore = useComputeResourcesStore()
const profile = computed(() => store.state.profile)
const activeOrganization = computed(() => store.getters.activeOrganization)
const orgMembers = computed(() => store.state.orgMembers || [])
const orgId = computed(() => props.orgId)

// Use Pinia store for compute nodes data - use scoped system
const computeNodes = computed(() => {
  // For organization context, use workspace scope
  const scope = orgId.value ? `workspace:${orgId.value}` : 'account-owner'
  return computeResourcesStore.getScopedComputeNodes(scope) || []
})
const isLoading = computed(() => {
  const scope = orgId.value ? `workspace:${orgId.value}` : 'account-owner'
  return computeResourcesStore.isScopeLoading(scope)
})

const expandedNodes = ref(new Set())
const editingNodes = ref(new Set())
const editingData = ref({})
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
// Computes if any Compute Resources are available
const hasNoResources = computed(() => { return computeNodes.value.length === 0 })


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
  try {
    // Get organization ID from Vuex store
    const orgId = currentOrganization.value?.nodeId || currentOrganization.value?.id
    await computeResourcesStore.fetchComputeNodes(orgId)
  } catch (error) {
    console.error('Failed to fetch compute nodes:', error)
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
  return computeResourcesStore.isNodeUpdating(nodeUuid)
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
  
  computeResourcesStore.setNodeUpdating(nodeUuid, true)
  
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
      
      // Refresh the compute nodes to get the updated data
      await fetchComputeNodes()
      
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
    computeResourcesStore.setNodeUpdating(nodeUuid, false)
  }
}

async function updateStatus(node, newStatus) {
  try {
    await computeResourcesStore.updateNodeStatus(node.uuid, newStatus)
    ElMessage.success(`Compute node ${newStatus.toLowerCase()}`)
  } catch (error) {
    console.error('Failed to update node status:', error)
    ElMessage.error('Failed to update node status')
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
      // Refresh the compute nodes list after deletion
      await fetchComputeNodes()
      
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
              Compute nodes are computational resources deployed on individual user's cloud accounts that process and analyze Pennsieve data.
              Each compute node is created from a Compute Resource (AWS account) owned by a specific user, but can be shared with other users in workspaces to enable collaborative data analysis.
            </p>
            <p class="info-note">
              <strong>Note:</strong> Compute Resources are associated with individual users who own the cloud accounts. 
              Compute nodes created from these resources can be shared across workspace members with different permission levels (private, workspace, or shared access).
            </p>
            <div class="setup-steps" v-if="hasNoResources">
              <h4>Quick Setup Guide:</h4>
              <ol>
                <li>Ensure your AWS account is registered as a Compute Resource</li>
                <li>Click "Create Compute Node" to set up a new node</li>
                <li>Configure the node with a name and description</li>
                <li>Manage node status (enabled/paused) as needed</li>
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
                  Compute Nodes are created from user-owned Compute Resources (cloud accounts) and can be shared
                  with workspace members to enable collaborative data analysis. Workspace administrators can create nodes
                  from available compute resources and manage access permissions. Click "Create Compute Node" above to get started.
                </p>
              </div>
              <div v-else class="copy">
                <h2>{{ orgName }} doesn't have any compute nodes yet.</h2>
                <p>
                  Contact your administrator to set up Compute Resources and create shared Compute Nodes for this workspace.
                </p>
              </div>
            </bf-empty-page-state>
          </div>

          <div v-else class="nodes-grid">
            <ComputeNodeCard 
              v-for="node in computeNodes" 
              :key="node.uuid"
              :node="node"
              :has-admin-rights="hasAdminRights"
              :is-updating="isNodeUpdating(node.uuid)"
              @update-status="updateStatus"
            />
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

.manage-button {
  background: theme.$purple_3;
  color: white;
  border: none;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 4px;
  transition: all 0.2s ease;
  min-height: 32px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  
  &:hover {
    background: theme.$purple_2;
    text-decoration: none;
    color: white;
  }
  
  &:active {
    transform: translateY(1px);
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