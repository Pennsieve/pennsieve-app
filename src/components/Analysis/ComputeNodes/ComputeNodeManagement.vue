<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import IconArrowLeft from '@/components/icons/IconArrowLeft.vue'
import IconInfo from '@/components/icons/IconInfo.vue'
import IconRemove from '@/components/icons/IconRemove.vue'
import IconPerson from '@/components/icons/IconPerson.vue'
import IconTeam from '@/components/icons/IconTeam.vue'

const route = useRoute()
const router = useRouter()
const store = useStore()
const profile = computed(() => store.state.profile)
const activeOrganization = computed(() => store.getters.activeOrganization)
const orgMembers = computed(() => store.state.orgMembers || [])
const teams = computed(() => store.state.teams || [])

// Component state
const computeNode = ref(null)
const permissions = ref(null)
const isLoading = ref(false)
const isUpdating = ref(false)
const isEditingInfo = ref(false)
const editingData = ref({})

// Permission management state
const accessScope = ref('private')
const sharedUsers = ref([])
const sharedTeams = ref([])
const showAddUserDialog = ref(false)
const showAddTeamDialog = ref(false)
const selectedUserId = ref('')
const selectedTeamId = ref('')
const isUpdatingPermissions = ref(false)

// Get node UUID from route
const nodeUuid = computed(() => route.params.nodeId)
const orgId = computed(() => route.params.orgId)

// Get current organization from store
const currentOrganization = computed(() => store.getters.activeOrganization?.organization)

// Check if user has admin rights
const hasAdminRights = computed(() => {
  if (activeOrganization.value) {
    return activeOrganization.value.isAdmin || activeOrganization.value.isOwner
  }
  return false
})

// Check if current user is the owner of the node
const isNodeOwner = computed(() => {
  return computeNode.value?.userId === profile.value?.id
})

// Check if user can manage permissions (must be owner)
const canManagePermissions = computed(() => isNodeOwner.value)

// Available users for sharing (exclude owner and already shared users)
const availableUsers = computed(() => {
  if (!computeNode.value) return []
  const ownerId = computeNode.value.userId
  const sharedUserIds = new Set(sharedUsers.value)
  return orgMembers.value.filter(member => 
    member.id !== ownerId && !sharedUserIds.has(member.id)
  )
})

// Available teams for sharing (exclude already shared teams)
const availableTeams = computed(() => {
  const sharedTeamIds = new Set(sharedTeams.value)
  return teams.value.filter(team => !sharedTeamIds.has(team.id))
})

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

// Get team name
const getTeamName = (teamId) => {
  const team = teams.value.find(t => t.id === teamId)
  return team ? team.name : teamId.split(':').pop() || teamId
}

// Get account type label
const getAccountTypeLabel = (type) => {
  switch (type) {
    case 'AWS': return 'Amazon Web Services'
    case 'GCP': return 'Google Cloud Platform'
    case 'AZURE': return 'Microsoft Azure'
    default: return type || 'Unknown'
  }
}

// Get status for node
const getStatusForNode = (node) => {
  return node?.status || 'Enabled'
}

// Get access scope label
const getAccessScopeLabel = (scope) => {
  switch (scope) {
    case 'private':
      return 'Private - Only you can access this node'
    case 'workspace':
      return 'Workspace - All workspace members can access this node'
    case 'shared':
      return 'Shared - Specific users and teams can access this node'
    default:
      return 'Unknown'
  }
}

onMounted(() => {
  fetchComputeNode()
  fetchPermissions()
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
      console.error('Failed to fetch compute node:', response.status, response.statusText)
      ElMessage.error('Failed to load compute node details')
      // Navigate back to list
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

async function fetchPermissions() {
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}/permissions`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      permissions.value = data
      accessScope.value = data.accessScope || 'private'
      sharedUsers.value = data.sharedWithUsers || []
      sharedTeams.value = data.sharedWithTeams || []
    } else if (response.status === 403) {
      // User doesn't have permission to view permissions
      console.log('User cannot view permissions for this node')
    } else {
      console.error('Failed to fetch permissions:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('Failed to fetch permissions:', error)
  }
}


function startEditingInfo() {
  isEditingInfo.value = true
  editingData.value = {
    name: computeNode.value.name || '',
    description: computeNode.value.description || '',
    status: computeNode.value.status || 'Enabled'
  }
}

function cancelEditingInfo() {
  isEditingInfo.value = false
  editingData.value = {}
}

async function saveNodeInfo() {
  isUpdating.value = true
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: editingData.value.name,
        description: editingData.value.description,
        // Note: Status updates might need different endpoint/method
      })
    })
    
    if (response.ok) {
      const updatedNode = await response.json()
      computeNode.value = { ...computeNode.value, ...updatedNode }
      cancelEditingInfo()
      ElMessage.success('Compute node updated successfully')
    } else {
      console.error('Failed to update node:', response.status, response.statusText)
      ElMessage.error('Failed to update compute node')
    }
  } catch (error) {
    console.error('Failed to update node:', error)
    ElMessage.error('Failed to update compute node')
  } finally {
    isUpdating.value = false
  }
}

async function updateAccessScope(newScope) {
  isUpdatingPermissions.value = true
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}/permissions`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accessScope: newScope
      })
    })
    
    if (response.ok) {
      const updatedPermissions = await response.json()
      permissions.value = updatedPermissions
      accessScope.value = newScope
      
      // Clear shared lists if switching to private or workspace
      if (newScope === 'private') {
        sharedUsers.value = []
        sharedTeams.value = []
      }
      
      ElMessage.success(`Access scope updated to ${newScope}`)
    } else {
      console.error('Failed to update access scope:', response.status, response.statusText)
      ElMessage.error('Failed to update access scope')
      // Revert the change
      accessScope.value = permissions.value?.accessScope || 'private'
    }
  } catch (error) {
    console.error('Failed to update access scope:', error)
    ElMessage.error('Failed to update access scope')
    accessScope.value = permissions.value?.accessScope || 'private'
  } finally {
    isUpdatingPermissions.value = false
  }
}

async function addUserAccess() {
  if (!selectedUserId.value) return
  
  isUpdatingPermissions.value = true
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}/permissions/users`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: selectedUserId.value
      })
    })
    
    if (response.ok) {
      sharedUsers.value.push(selectedUserId.value)
      // If scope was private or workspace, it should now be shared
      if (accessScope.value !== 'shared') {
        accessScope.value = 'shared'
      }
      ElMessage.success('User access granted successfully')
      closeAddUserDialog()
    } else {
      console.error('Failed to add user access:', response.status, response.statusText)
      ElMessage.error('Failed to grant user access')
    }
  } catch (error) {
    console.error('Failed to add user access:', error)
    ElMessage.error('Failed to grant user access')
  } finally {
    isUpdatingPermissions.value = false
  }
}

async function removeUserAccess(userId) {
  isUpdatingPermissions.value = true
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}/permissions/users/${userId}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      sharedUsers.value = sharedUsers.value.filter(id => id !== userId)
      ElMessage.success('User access revoked successfully')
    } else {
      console.error('Failed to remove user access:', response.status, response.statusText)
      ElMessage.error('Failed to revoke user access')
    }
  } catch (error) {
    console.error('Failed to remove user access:', error)
    ElMessage.error('Failed to revoke user access')
  } finally {
    isUpdatingPermissions.value = false
  }
}

async function addTeamAccess() {
  if (!selectedTeamId.value) return
  
  isUpdatingPermissions.value = true
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}/permissions/teams`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamId: selectedTeamId.value
      })
    })
    
    if (response.ok) {
      sharedTeams.value.push(selectedTeamId.value)
      // If scope was private or workspace, it should now be shared
      if (accessScope.value !== 'shared') {
        accessScope.value = 'shared'
      }
      ElMessage.success('Team access granted successfully')
      closeAddTeamDialog()
    } else {
      console.error('Failed to add team access:', response.status, response.statusText)
      ElMessage.error('Failed to grant team access')
    }
  } catch (error) {
    console.error('Failed to add team access:', error)
    ElMessage.error('Failed to grant team access')
  } finally {
    isUpdatingPermissions.value = false
  }
}

async function removeTeamAccess(teamId) {
  isUpdatingPermissions.value = true
  try {
    const token = await useGetToken()
    const url = `${siteConfig.api2Url}/compute/resources/compute-nodes/${nodeUuid.value}/permissions/teams/${teamId}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      sharedTeams.value = sharedTeams.value.filter(id => id !== teamId)
      ElMessage.success('Team access revoked successfully')
    } else {
      console.error('Failed to remove team access:', response.status, response.statusText)
      ElMessage.error('Failed to revoke team access')
    }
  } catch (error) {
    console.error('Failed to remove team access:', error)
    ElMessage.error('Failed to revoke team access')
  } finally {
    isUpdatingPermissions.value = false
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

function goBack() {
  router.push({ name: 'compute-nodes', params: { orgId: orgId.value } })
}
</script>

<template>
  <bf-stage element-loading-background="transparent" v-loading="isLoading">
    <template #actions>
      <bf-button @click="goBack" class="secondary">
        <IconArrowLeft :width="16" :height="16" style="margin-right: 4px;" />
        Back to Compute Nodes
      </bf-button>
    </template>
    
    <div class="compute-node-management" v-if="computeNode">
      <!-- Node Header -->
      <div class="node-header-section">
        <h1>{{ computeNode.name }}</h1>
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
              v-if="!isEditingInfo && hasAdminRights" 
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
          <!-- Editable Name -->
          <div class="info-row">
            <span class="info-label">Name:</span>
            <span class="info-value" v-if="!isEditingInfo">
              {{ computeNode.name }}
            </span>
            <div class="info-value" v-else>
              <el-input 
                v-model="editingData.name"
                placeholder="Enter node name"
                size="default"
              />
            </div>
          </div>
          
          <!-- Editable Description -->
          <div class="info-row">
            <span class="info-label">Description:</span>
            <span class="info-value" v-if="!isEditingInfo">
              <span v-if="computeNode.description">{{ computeNode.description }}</span>
              <span v-else class="empty-value">No description set</span>
            </span>
            <div class="info-value" v-else>
              <el-input 
                v-model="editingData.description"
                type="textarea"
                placeholder="Enter node description"
                :rows="3"
                size="default"
              />
            </div>
          </div>
          
          <!-- Status -->
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">
              <span class="status-badge" :class="getStatusForNode(computeNode).toLowerCase()">
                {{ getStatusForNode(computeNode) }}
              </span>
            </span>
          </div>
          
          <!-- Account Information -->
          <div class="info-row">
            <span class="info-label">Account Type:</span>
            <span class="info-value">{{ getAccountTypeLabel(computeNode.account?.accountType) }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">Account ID:</span>
            <span class="info-value mono">{{ formatAccountId(computeNode.account?.accountId) }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">Node Identifier:</span>
            <span class="info-value mono">{{ computeNode.identifier }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">Node UUID:</span>
            <span class="info-value mono">{{ computeNode.uuid }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">Gateway URL:</span>
            <span class="info-value mono">{{ computeNode.computeNodeGatewayUrl || 'N/A' }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">Created By:</span>
            <span class="info-value">{{ getUserName(computeNode.userId) }}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">Created At:</span>
            <span class="info-value">{{ formatDate(computeNode.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Permissions Section -->
      <div class="management-section" v-if="canManagePermissions">
        <div class="section-header">
          <h2>Access & Permissions</h2>
          <el-tooltip 
            content="Only the node owner can manage permissions"
            placement="top"
            v-if="!canManagePermissions"
          >
            <IconInfo :width="16" :height="16" class="info-icon" />
          </el-tooltip>
        </div>
        
        <div class="permissions-content">
          <!-- Access Scope Selection -->
          <div class="access-scope-section">
            <h3>Access Scope</h3>
            <el-radio-group 
              v-model="accessScope" 
              @change="updateAccessScope"
              :disabled="!canManagePermissions || isUpdatingPermissions"
              class="scope-radio-group"
            >
              <el-radio value="private" class="scope-radio">
                <div class="scope-option">
                  <div class="scope-title">Private</div>
                  <div class="scope-description">Only you can access this compute node</div>
                </div>
              </el-radio>
              <el-radio value="workspace" class="scope-radio">
                <div class="scope-option">
                  <div class="scope-title">Workspace</div>
                  <div class="scope-description">All members of this workspace can access this compute node</div>
                </div>
              </el-radio>
              <el-radio value="shared" class="scope-radio">
                <div class="scope-option">
                  <div class="scope-title">Shared</div>
                  <div class="scope-description">Share with specific users and teams</div>
                </div>
              </el-radio>
            </el-radio-group>
          </div>

          <!-- Shared Users and Teams (only visible when scope is 'shared') -->
          <div v-if="accessScope === 'shared'" class="sharing-section">
            <!-- Shared Users -->
            <div class="shared-subsection">
              <div class="subsection-header">
                <h3>
                  <IconPerson :width="18" :height="18" style="margin-right: 6px; vertical-align: middle;" />
                  Shared Users
                </h3>
                <bf-button 
                  @click="openAddUserDialog"
                  :disabled="!canManagePermissions"
                  class="small primary"
                >
                  Add User
                </bf-button>
              </div>
              
              <div v-if="sharedUsers.length > 0" class="shared-list">
                <div 
                  v-for="userId in sharedUsers" 
                  :key="userId"
                  class="shared-item"
                >
                  <span class="shared-name">{{ getUserName(userId) }}</span>
                  <button 
                    @click="removeUserAccess(userId)"
                    :disabled="!canManagePermissions || isUpdatingPermissions"
                    class="remove-button"
                    title="Remove access"
                  >
                    <IconRemove :width="16" :height="16" />
                  </button>
                </div>
              </div>
              <div v-else class="empty-shared">
                No users have been granted access yet
              </div>
            </div>

            <!-- Shared Teams -->
            <div class="shared-subsection">
              <div class="subsection-header">
                <h3>
                  <IconTeam :width="18" :height="18" style="margin-right: 6px; vertical-align: middle;" />
                  Shared Teams
                </h3>
                <bf-button 
                  @click="openAddTeamDialog"
                  :disabled="!canManagePermissions"
                  class="small primary"
                >
                  Add Team
                </bf-button>
              </div>
              
              <div v-if="sharedTeams.length > 0" class="shared-list">
                <div 
                  v-for="teamId in sharedTeams" 
                  :key="teamId"
                  class="shared-item"
                >
                  <span class="shared-name">{{ getTeamName(teamId) }}</span>
                  <button 
                    @click="removeTeamAccess(teamId)"
                    :disabled="!canManagePermissions || isUpdatingPermissions"
                    class="remove-button"
                    title="Remove access"
                  >
                    <IconRemove :width="16" :height="16" />
                  </button>
                </div>
              </div>
              <div v-else class="empty-shared">
                No teams have been granted access yet
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No permissions message -->
      <div class="management-section" v-else-if="permissions && !canManagePermissions">
        <div class="section-header">
          <h2>Access & Permissions</h2>
        </div>
        <div class="no-permissions-message">
          <p>Only the owner of this compute node can manage permissions.</p>
          <p>Current owner: <strong>{{ getUserName(computeNode.userId) }}</strong></p>
        </div>
      </div>
    </div>

    <!-- Add User Dialog -->
    <el-dialog
      v-model="showAddUserDialog"
      title="Add User Access"
      width="500px"
      :close-on-click-modal="true"
    >
      <div class="add-access-dialog">
        <p>Select a user to grant access to this compute node:</p>
        <el-select
          v-model="selectedUserId"
          placeholder="Select a user"
          style="width: 100%"
          size="default"
          filterable
        >
          <el-option
            v-for="user in availableUsers"
            :key="user.id"
            :label="`${user.firstName} ${user.lastName}`"
            :value="user.id"
          >
            <div class="user-option">
              <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
              <span class="user-email">{{ user.email }}</span>
            </div>
          </el-option>
        </el-select>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <bf-button @click="closeAddUserDialog" class="secondary">
            Cancel
          </bf-button>
          <bf-button 
            @click="addUserAccess" 
            :loading="isUpdatingPermissions"
            :disabled="!selectedUserId"
            class="primary"
          >
            Grant Access
          </bf-button>
        </div>
      </template>
    </el-dialog>

    <!-- Add Team Dialog -->
    <el-dialog
      v-model="showAddTeamDialog"
      title="Add Team Access"
      width="500px"
      :close-on-click-modal="true"
    >
      <div class="add-access-dialog">
        <p>Select a team to grant access to this compute node:</p>
        <el-select
          v-model="selectedTeamId"
          placeholder="Select a team"
          style="width: 100%"
          size="default"
          filterable
        >
          <el-option
            v-for="team in availableTeams"
            :key="team.id"
            :label="team.name"
            :value="team.id"
          />
        </el-select>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <bf-button @click="closeAddTeamDialog" class="secondary">
            Cancel
          </bf-button>
          <bf-button 
            @click="addTeamAccess" 
            :loading="isUpdatingPermissions"
            :disabled="!selectedTeamId"
            class="primary"
          >
            Grant Access
          </bf-button>
        </div>
      </template>
    </el-dialog>
  </bf-stage>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.compute-node-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.node-header-section {
  margin-bottom: 32px;
  
  h1 {
    font-size: 28px;
    font-weight: 300;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }
  
  .node-subtitle {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 8px 0;
  }
  
  .node-description {
    font-size: 16px;
    color: theme.$gray_5;
    margin: 12px 0 0 0;
    line-height: 1.5;
  }
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
    
    .info-icon {
      color: theme.$gray_4;
      cursor: help;
      
      &:hover {
        color: theme.$purple_2;
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
      }
    }
  }
}

.permissions-content {
  .access-scope-section {
    margin-bottom: 32px;
    
    h3 {
      font-size: 16px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 16px 0;
    }
    
    .scope-radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      
      .scope-radio {
        border: 1px solid theme.$gray_2;
        border-radius: 8px;
        padding: 16px;
        transition: all 0.2s ease;
        
        &:hover {
          border-color: theme.$purple_1;
          background: rgba(theme.$purple_1, 0.02);
        }
        
        :deep(.el-radio__input.is-checked + .el-radio__label) {
          color: inherit;
        }
        
        :deep(.el-radio__label) {
          width: 100%;
        }
        
        .scope-option {
          .scope-title {
            font-size: 15px;
            font-weight: 500;
            color: theme.$gray_6;
            margin-bottom: 4px;
          }
          
          .scope-description {
            font-size: 13px;
            color: theme.$gray_5;
          }
        }
      }
    }
  }
  
  .sharing-section {
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
          display: flex;
          align-items: center;
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
    margin: 0 0 8px 0;
    font-size: 14px;
    color: theme.$gray_5;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    strong {
      color: theme.$gray_6;
    }
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

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

// Button styles
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
</style>