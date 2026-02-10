<template>
  <div class="node-card" :class="{ expanded: isExpanded }">
    <div 
      class="node-header clickable"
      @click="toggleExpansion"
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
        <div class="node-status-badge" @click.stop v-if="canManagePermissions && getStatusForNode(node) !== 'Pending'">
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
        <button class="expand-toggle" @click.stop="toggleExpansion">
          <span class="expand-text">{{ isExpanded ? 'Hide Details' : 'Show Details' }}</span>
          <span class="chevron-icon" :class="{ expanded: isExpanded }">▼</span>
        </button>
      </div>
    </div>
    
    <transition name="expand">
      <div v-if="isExpanded" class="node-expanded-content">
        <div class="detail-section">
          <div class="detail-header">
            <h4>Node Information</h4>
            <div class="detail-actions">
              <button 
                v-if="!isEditing && canManagePermissions" 
                @click="startEditing" 
                class="edit-button"
              >
                Edit
              </button>
              <div v-else-if="isEditing" class="edit-actions">
                <button 
                  @click="saveChanges" 
                  :disabled="isUpdatingPermissions"
                  class="save-button"
                >
                  Save
                </button>
                <button 
                  @click="cancelEditing" 
                  class="cancel-button"
                >
                  Cancel
                </button>
              </div>
              <slot name="detail-actions" />
            </div>
          </div>
          
          <!-- Editable Name -->
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value" v-if="!isEditing">
              <span v-if="node.name">{{ node.name }}</span>
              <span v-else class="empty-value">No name set</span>
            </span>
            <div class="detail-value" v-else>
              <input 
                v-model="editingData.name"
                placeholder="Enter node name"
                class="edit-input"
              />
            </div>
          </div>
          
          <!-- Editable Description -->
          <div class="detail-row">
            <span class="detail-label">Description:</span>
            <span class="detail-value" v-if="!isEditing">
              <span v-if="node.description">{{ node.description }}</span>
              <span v-else class="empty-value">No description set</span>
            </span>
            <div class="detail-value" v-else>
              <textarea 
                v-model="editingData.description"
                placeholder="Enter node description"
                rows="2"
                class="edit-textarea"
              />
            </div>
          </div>
          
          <!-- Status (read-only) -->
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">
              <span class="status-text" :class="{ paused: getStatusForNode(node) === 'Paused' }">
                {{ getStatusForNode(node) }}
              </span>
            </span>
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
            <span class="detail-label">Created By:</span>
            <span class="detail-value">{{ getUserName(node.userId) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Created At:</span>
            <span class="detail-value">{{ formatDate(node.createdAt) }}</span>
          </div>
        </div>
        
        <!-- Permissions Section -->
        <div class="detail-section permissions-section" v-loading="isLoadingPermissions">
          <div class="detail-header">
            <h4>Access & Permissions</h4>
          </div>
          
          <div class="permissions-content" v-if="!isLoadingPermissions && (canManagePermissions || nodePermissions.accessScope)">
            <div class="access-scope-section">
              <div v-if="nodePermissions.owner" class="detail-row">
                <span class="detail-label">Owner:</span>
                <span class="detail-value">{{ getUserName(nodePermissions.owner) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Access Scope:</span>
                <span class="detail-value">
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
                  <span v-if="!canManagePermissions" class="scope-description">
                    <span v-if="localAccessScope === 'private'">Only the owner can access this compute node</span>
                    <span v-else-if="localAccessScope === 'workspace'">All workspace members can access this compute node</span>
                    <span v-else>Shared with specific users and teams</span>
                  </span>
                </span>
              </div>
            </div>
            
            <!-- Shared Users -->
            <div v-if="localAccessScope === 'shared'" class="shared-section">
              <div class="shared-header">
                <h5>Shared With Users</h5>
                <button @click="openAddUserDialog" class="add-button" v-if="canManagePermissions">
                  <span>+ Add User</span>
                </button>
              </div>
              <div v-if="sharedUsers.length > 0" class="shared-list">
                <div v-for="userId in sharedUsers" :key="userId" class="shared-item">
                  <span class="shared-name">{{ getUserName(userId) }}</span>
                  <button 
                    @click="removeUserAccess(userId)" 
                    class="remove-button" 
                    v-if="canManagePermissions"
                    title="Remove user access"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div v-else class="empty-list">
                <span>No users have been granted access</span>
              </div>
            </div>
            
            <!-- Shared Teams -->
            <div v-if="localAccessScope === 'shared'" class="shared-section">
              <div class="shared-header">
                <h5>Shared With Teams</h5>
                <button @click="openAddTeamDialog" class="add-button" v-if="canManagePermissions">
                  <span>+ Add Team</span>
                </button>
              </div>
              <div v-if="sharedTeams.length > 0" class="shared-list">
                <div v-for="teamId in sharedTeams" :key="teamId" class="shared-item">
                  <span class="shared-name">{{ getTeamName(teamId) }}</span>
                  <button 
                    @click="removeTeamAccess(teamId)" 
                    class="remove-button" 
                    v-if="canManagePermissions"
                    title="Remove team access"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div v-else class="empty-list">
                <span>No teams have been granted access</span>
              </div>
            </div>
          </div>
          
          <div v-else-if="!isLoadingPermissions && !canManagePermissions && !nodePermissions.accessScope" class="no-permissions-message">
            <p>You don't have permission to view or manage access settings for this compute node.</p>
          </div>
        </div>
      </div>
    </transition>
    
    <!-- Add User Dialog -->
    <el-dialog 
      v-model="showAddUserDialog" 
      title="Add User Access"
      width="500px"
    >
      <div class="dialog-content">
        <el-select
          v-model="selectedUserId"
          placeholder="Select a user"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="user in availableUsers"
            :key="user.id"
            :label="`${user.firstName} ${user.lastName}`"
            :value="user.id"
          />
        </el-select>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeAddUserDialog">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="addUserAccess"
            :disabled="!selectedUserId"
            :loading="isUpdatingPermissions"
          >
            Grant Access
          </el-button>
        </span>
      </template>
    </el-dialog>
    
    <!-- Add Team Dialog -->
    <el-dialog 
      v-model="showAddTeamDialog" 
      title="Add Team Access"
      width="500px"
    >
      <div class="dialog-content">
        <el-select
          v-model="selectedTeamId"
          placeholder="Select a team"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="team in availableTeams"
            :key="team.team.id"
            :label="team.team.name"
            :value="team.team.id"
          />
        </el-select>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeAddTeamDialog">Cancel</el-button>
          <el-button 
            type="primary" 
            @click="addTeamAccess"
            :disabled="!selectedTeamId"
            :loading="isUpdatingPermissions"
          >
            Grant Access
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useStore } from 'vuex'
import { ElMessage, ElSelect, ElOption } from 'element-plus'
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
const orgMembers = computed(() => store.state.orgMembers || [])
const teams = computed(() => store.state.teams || [])

const isExpanded = ref(false)

// Use Pinia store for permissions data
const nodePermissions = computed(() => computeResourcesStore.getNodePermissions(props.node.uuid))
const isLoadingPermissions = computed(() => computeResourcesStore.isNodePermissionsLoading(props.node.uuid))
const isUpdatingPermissions = computed(() => computeResourcesStore.isNodeUpdating(props.node.uuid))

// Check if current user is the owner of the node based on permissions
const isNodeOwner = computed(() => {
  const permissions = nodePermissions.value
  if (!permissions || !permissions.owner) {
    return false
  }
  const isOwner = permissions.owner === profile.value?.id
  return isOwner
})

// User can manage permissions if they are the owner
const canManagePermissions = computed(() => {
  return isNodeOwner.value
})

// Reactive permission data
const localAccessScope = ref('private')
const isUpdatingScope = ref(false)
const sharedUsers = computed(() => nodePermissions.value?.sharedWithUsers || [])
const sharedTeams = computed(() => nodePermissions.value?.sharedWithTeams || [])

// Sync localAccessScope with store data only on initial load or when not updating
watch(nodePermissions, (newPermissions) => {
  // Only sync if we're not in the middle of updating and we have valid data
  if (!isUpdatingScope.value && newPermissions && typeof newPermissions === 'object' && !newPermissions.error) {
    if (newPermissions.hasOwnProperty('accessScope')) {
      localAccessScope.value = newPermissions.accessScope || 'private'
    }
  }
}, { immediate: true })

// Handle scope changes
const handleAccessScopeChange = async (newValue) => {
  isUpdatingScope.value = true
  try {
    await updateAccessScope(newValue)
    // Keep the local value as the user selected it
    // Don't let the watcher override it
  } catch (error) {
    // Revert to previous store value on error
    localAccessScope.value = nodePermissions.value?.accessScope || 'private'
    throw error
  } finally {
    isUpdatingScope.value = false
  }
}

// Dialog state
const showAddUserDialog = ref(false)
const showAddTeamDialog = ref(false)
const selectedUserId = ref('')
const selectedTeamId = ref('')

// Editing state
const isEditing = ref(false)
const editingData = ref({})

// Computed properties for available users and teams
const availableUsers = computed(() => {
  // Filter out users who already have access
  return orgMembers.value.filter(member => 
    !sharedUsers.value.includes(member.id) &&
    member.id !== profile.value?.id // Don't include current user
  )
})

const availableTeams = computed(() => {
  // Filter out teams that already have access
  return teams.value.filter(team => 
    !sharedTeams.value.includes(team.team.id)
  )
})

// Fetch permissions immediately on mount to determine ownership
onMounted(async () => {
  // Always fetch permissions on mount to determine if user is owner
  if (Object.keys(nodePermissions.value).length === 0) {
    await computeResourcesStore.fetchNodePermissions(props.node.uuid)
  }
})

// Watch for expansion and fetch permissions when expanded (in case they weren't loaded)
watch(isExpanded, async (newValue) => {
  if (newValue && Object.keys(nodePermissions.value).length === 0) {
    await computeResourcesStore.fetchNodePermissions(props.node.uuid)
  }
})

function toggleExpansion() {
  isExpanded.value = !isExpanded.value
}

function getTeamName(teamId) {
  const team = teams.value.find(t => t.team.id === teamId)
  return team ? team.team.name : 'Unknown Team'
}

function formatAccountId(accountId) {
  if (!accountId) return ''
  // Add dashes for AWS account IDs (12 digits)
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
  
  // Normalize status to display values
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'enabled':
    case 'active':
    case 'running':
    case 'ready':
      return 'Enabled'
    case 'paused':
    case 'stopped':
    case 'disabled':
      return 'Paused'
    default:
      return 'Pending'
  }
}

async function updateAccessScope(newScope) {
  try {
    await computeResourcesStore.updateAccessScope(props.node.uuid, newScope)
    ElMessage.success(`Access scope updated to ${newScope}`)
  } catch (error) {
    console.error('Failed to update access scope:', error)
    ElMessage.error('Failed to update access scope')
  }
}

// Dialog functions
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

// User access functions
async function addUserAccess() {
  if (!selectedUserId.value) return
  
  try {
    await computeResourcesStore.addUserAccess(props.node.uuid, selectedUserId.value)
    ElMessage.success('User access granted successfully')
    closeAddUserDialog()
  } catch (error) {
    console.error('Failed to add user access:', error)
    ElMessage.error('Failed to grant user access')
  }
}

async function removeUserAccess(userId) {
  try {
    await computeResourcesStore.removeUserAccess(props.node.uuid, userId)
    ElMessage.success('User access revoked successfully')
  } catch (error) {
    console.error('Failed to remove user access:', error)
    ElMessage.error('Failed to revoke user access')
  }
}

// Team access functions
async function addTeamAccess() {
  if (!selectedTeamId.value) return
  
  try {
    await computeResourcesStore.addTeamAccess(props.node.uuid, selectedTeamId.value)
    ElMessage.success('Team access granted successfully')
    closeAddTeamDialog()
  } catch (error) {
    console.error('Failed to add team access:', error)
    ElMessage.error('Failed to grant team access')
  }
}

async function removeTeamAccess(teamId) {
  try {
    await computeResourcesStore.removeTeamAccess(props.node.uuid, teamId)
    ElMessage.success('Team access revoked successfully')
  } catch (error) {
    console.error('Failed to remove team access:', error)
    ElMessage.error('Failed to revoke team access')
  }
}

// Node editing functions  
function startEditing() {
  isEditing.value = true
  
  // Initialize editing data with current values
  editingData.value = {
    name: props.node.name || '',
    description: props.node.description || ''
  }
}

function cancelEditing() {
  isEditing.value = false
  editingData.value = {}
}

async function saveChanges() {
  const changes = editingData.value
  
  if (!changes) return
  
  try {
    await computeResourcesStore.updateComputeNode(props.node.uuid, {
      name: changes.name || null,
      description: changes.description || null
    })
    
    ElMessage.success('Compute node updated successfully')
    
    // Exit editing mode
    cancelEditing()
  } catch (error) {
    console.error('Failed to update compute node:', error)
    ElMessage.error('Failed to update compute node')
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
  display: inline-block;
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
}

.status-select {
  min-width: 90px;
  
  :deep(.el-select__wrapper) {
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    height: 28px;
    padding: 4px 12px;
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
  
  &.pending :deep(.el-select__wrapper) {
    background: rgba(#6B7280, 0.1);
    color: #6B7280;
    border: 1px solid rgba(#6B7280, 0.2);
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
        
        .edit-button,
        .save-button,
        .cancel-button {
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
            transform: translateY(-1px);
          }
          
          &:active {
            transform: translateY(0);
          }
          
          &:disabled {
            background: theme.$gray_4;
            color: white;
            cursor: not-allowed;
            transform: none;
            
            &:hover {
              background: theme.$gray_4;
              transform: none;
            }
          }
        }
        
        .cancel-button {
          background: theme.$gray_4;
          
          &:hover {
            background: theme.$gray_5;
          }
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
          //border-radius: 3px;
          
          &.small {
            font-size: 11px;
          }
        }

        .status-text {
          display: inline-block;
          padding: 2px 8px;
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
        
        // Form elements for editing
        .edit-input,
        .edit-textarea,
        .edit-select {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          padding: 6px 12px;
          border: 1px solid theme.$gray_3;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
          background: white;
          color: theme.$gray_6;
          
          &:focus {
            outline: none;
            border-color: theme.$purple_1;
            box-shadow: 0 0 0 2px rgba(theme.$purple_1, 0.2);
          }
        }
        
        .edit-textarea {
          resize: vertical;
          min-height: 60px;
          line-height: 1.4;
        }
        
        .edit-select {
          cursor: pointer;
        }
      }
    }
    
    // Permissions section styles
    &.permissions-section {
      margin-top: 20px;
    }
    
    .permissions-content {
      .access-scope-section {
        margin-bottom: 20px;
        
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
        
        .scope-description {
          color: theme.$gray_5;
          font-size: 13px;
          margin-left: 12px;
        }
        
        .access-scope-select {
          min-width: 250px;
          
          :deep(.el-select__wrapper) {
            border-radius: 4px;
          }
        }
      }
      
      .shared-section {
        margin-top: 16px;
        
        .shared-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          
          h5 {
            font-size: 14px;
            font-weight: 500;
            color: theme.$gray_6;
            margin: 0;
          }
          
          .add-button {
            background: theme.$purple_1;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            
            &:hover {
              background: theme.$purple_2;
              transform: translateY(-1px);
            }
            
            &:active {
              transform: translateY(0);
            }
          }
        }
        
        .shared-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          
          .shared-item {
            display: flex;
            align-items: center;
            gap: 8px;
            background: theme.$gray_1;
            padding: 6px 12px;
            border-radius: 4px;
            border: 1px solid theme.$gray_2;
            
            .shared-name {
              font-size: 13px;
              color: theme.$gray_6;
            }
            
            .remove-button {
              background: none;
              border: none;
              color: theme.$gray_4;
              font-size: 18px;
              line-height: 1;
              cursor: pointer;
              padding: 0 4px;
              transition: all 0.2s ease;
              
              &:hover {
                color: theme.$red_1;
                transform: scale(1.2);
              }
            }
          }
        }
        
        .empty-list {
          padding: 12px;
          background: theme.$gray_1;
          border-radius: 4px;
          text-align: center;
          
          span {
            color: theme.$gray_5;
            font-size: 13px;
            font-style: italic;
          }
        }
      }
      
      .no-sharing {
        padding: 16px;
        background: theme.$gray_1;
        border-radius: 4px;
        text-align: center;
        
        .empty-state-text {
          color: theme.$gray_5;
          font-size: 13px;
          margin: 0;
        }
      }
    }
    
    .no-permissions-message {
      padding: 16px;
      background: rgba(theme.$yellow_1, 0.05);
      border: 1px solid rgba(theme.$yellow_1, 0.2);
      border-radius: 4px;
      
      p {
        color: theme.$gray_6;
        font-size: 13px;
        margin: 0;
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
</style>