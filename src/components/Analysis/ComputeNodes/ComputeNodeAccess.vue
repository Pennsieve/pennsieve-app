<script setup>
// A compute node's Access tab: who owns it, who may use it (the access
// scope), and, for a shared node, the users and teams it's shared with.
import { ref, computed, watch } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'
import { useComputeResourcesStore } from '@/stores/computeResourcesStore'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import IconRemove from '@/components/icons/IconRemove.vue'
import { getUserName } from '../RunMonitor/runHelpers'

const props = defineProps({
  node: { type: Object, required: true },
  // Whether the user may change access (the node's owner).
  canManage: { type: Boolean, default: false },
  // A node with no organization is the owner's alone and can't be shared.
  personal: { type: Boolean, default: false },
})

const store = useStore()
const computeResourcesStore = useComputeResourcesStore()

const profile = computed(() => store.state.profile)
const orgMembers = computed(() => store.state.orgMembers || [])
const teams = computed(() => store.state.teams || [])
const nodeId = computed(() => props.node.uuid)

const nodePermissions = computed(() => computeResourcesStore.getNodePermissions(nodeId.value))
const isLoadingPermissions = computed(() => computeResourcesStore.isNodePermissionsLoading(nodeId.value))
const isUpdatingPermissions = computed(() => computeResourcesStore.isNodeUpdating(nodeId.value))

const localAccessScope = ref('private')
const isUpdatingScope = ref(false)
const sharedUsers = computed(() => nodePermissions.value?.sharedWithUsers || [])
const sharedTeams = computed(() => nodePermissions.value?.sharedWithTeams || [])

const SCOPES = {
  private: { label: 'Private', detail: 'Only the owner can use this node.' },
  workspace: { label: 'Workspace', detail: 'Everyone in the workspace can use this node.' },
  shared: { label: 'Shared', detail: 'The users and teams below can use this node.' },
}
const scope = computed(() => SCOPES[localAccessScope.value] || SCOPES.private)

// Sync localAccessScope with store data
watch(nodePermissions, (p) => {
  if (!isUpdatingScope.value && p && typeof p === 'object' && !p.error && Object.prototype.hasOwnProperty.call(p, 'accessScope')) {
    localAccessScope.value = p.accessScope || 'private'
  }
}, { immediate: true })

const userName = (id) => getUserName(id, profile.value, orgMembers.value)
function teamName(teamId) {
  const team = teams.value.find(t => t.team.id === teamId)
  return team ? team.team.name : 'Unknown team'
}

// Available users for sharing (exclude the user and those already shared)
const availableUsers = computed(() => {
  const shared = new Set(sharedUsers.value)
  return orgMembers.value.filter(m => !shared.has(m.id) && m.id !== profile.value?.id)
})
const availableTeams = computed(() => {
  const shared = new Set(sharedTeams.value)
  return teams.value.filter(t => !shared.has(t.team.id))
})

async function handleAccessScopeChange(newValue) {
  isUpdatingScope.value = true
  try {
    await computeResourcesStore.updateAccessScope(nodeId.value, newValue)
    ElMessage.success(`Access changed to ${SCOPES[newValue]?.label || newValue}`)
  } catch (error) {
    localAccessScope.value = nodePermissions.value?.accessScope || 'private'
    ElMessage.error('Failed to change who can use this node')
  } finally {
    isUpdatingScope.value = false
  }
}

const showAddUserDialog = ref(false)
const showAddTeamDialog = ref(false)
const selectedUserId = ref('')
const selectedTeamId = ref('')

function openAddUserDialog() {
  selectedUserId.value = ''
  showAddUserDialog.value = true
}
function openAddTeamDialog() {
  selectedTeamId.value = ''
  showAddTeamDialog.value = true
}

async function addUserAccess() {
  if (!selectedUserId.value) return
  try {
    await computeResourcesStore.addUserAccess(nodeId.value, selectedUserId.value)
    ElMessage.success('User access granted')
    showAddUserDialog.value = false
  } catch (error) {
    ElMessage.error('Failed to grant user access')
  }
}
async function removeUserAccess(userId) {
  try {
    await computeResourcesStore.removeUserAccess(nodeId.value, userId)
    ElMessage.success('User access revoked')
  } catch (error) {
    ElMessage.error('Failed to revoke user access')
  }
}
async function addTeamAccess() {
  if (!selectedTeamId.value) return
  try {
    await computeResourcesStore.addTeamAccess(nodeId.value, selectedTeamId.value)
    ElMessage.success('Team access granted')
    showAddTeamDialog.value = false
  } catch (error) {
    ElMessage.error('Failed to grant team access')
  }
}
async function removeTeamAccess(teamId) {
  try {
    await computeResourcesStore.removeTeamAccess(nodeId.value, teamId)
    ElMessage.success('Team access revoked')
  } catch (error) {
    ElMessage.error('Failed to revoke team access')
  }
}
</script>

<template>
  <div class="node-access" v-loading="isLoadingPermissions">
    <section class="cn-section">
      <h3 class="cn-section-title">Who can use this node</h3>
      <div v-if="!isLoadingPermissions && (canManage || nodePermissions.accessScope || personal)" class="cn-card">
        <dl class="cn-facts">
          <div>
            <dt>Owner</dt>
            <dd>{{ userName(nodePermissions.owner || node.ownerId || node.userId) }}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>
              <template v-if="personal">
                <span class="cn-pill">Private</span>
                <span class="cn-muted">A personal node: only you can use it, and it can't be shared.</span>
              </template>
              <template v-else-if="canManage">
                <el-select
                  v-model="localAccessScope"
                  @change="handleAccessScopeChange"
                  :loading="isUpdatingPermissions"
                  size="small"
                  class="scope-select"
                >
                  <el-option label="Private: only the owner" value="private" />
                  <el-option label="Workspace: everyone in the workspace" value="workspace" />
                  <el-option label="Shared: specific users and teams" value="shared" />
                </el-select>
                <span class="cn-muted">{{ scope.detail }}</span>
              </template>
              <template v-else>
                <span class="cn-pill">{{ scope.label }}</span>
                <span class="cn-muted">{{ scope.detail }}</span>
              </template>
            </dd>
          </div>
        </dl>
      </div>
      <p v-else-if="!isLoadingPermissions" class="cn-muted">
        You can't see who has access to this node.
      </p>
    </section>

    <template v-if="localAccessScope === 'shared' && !personal">
      <section class="cn-section">
        <div class="cn-section-head">
          <h3 class="cn-section-title">Users</h3>
          <button type="button" v-if="canManage" class="cn-action" @click="openAddUserDialog">+ Add user</button>
        </div>
        <ul v-if="sharedUsers.length" class="cn-list">
          <li v-for="userId in sharedUsers" :key="userId">
            <span>{{ userName(userId) }}</span>
            <button
              v-if="canManage"
              type="button"
              class="cn-icon-button"
              :disabled="isUpdatingPermissions"
              title="Remove access"
              @click="removeUserAccess(userId)"
            >
              <IconRemove :width="16" :height="16" />
            </button>
          </li>
        </ul>
        <p v-else class="cn-muted">No users have access yet.</p>
      </section>

      <section class="cn-section">
        <div class="cn-section-head">
          <h3 class="cn-section-title">Teams</h3>
          <button type="button" v-if="canManage" class="cn-action" @click="openAddTeamDialog">+ Add team</button>
        </div>
        <ul v-if="sharedTeams.length" class="cn-list">
          <li v-for="teamId in sharedTeams" :key="teamId">
            <span>{{ teamName(teamId) }}</span>
            <button
              v-if="canManage"
              type="button"
              class="cn-icon-button"
              :disabled="isUpdatingPermissions"
              title="Remove access"
              @click="removeTeamAccess(teamId)"
            >
              <IconRemove :width="16" :height="16" />
            </button>
          </li>
        </ul>
        <p v-else class="cn-muted">No teams have access yet.</p>
      </section>
    </template>

    <el-dialog v-model="showAddUserDialog" title="Add a user" width="480px">
      <p class="dialog-text">They'll be able to run workflows and notebooks on this node.</p>
      <el-select v-model="selectedUserId" placeholder="Select a user" class="dialog-select" filterable>
        <el-option v-for="user in availableUsers" :key="user.id" :label="`${user.firstName} ${user.lastName}`" :value="user.id">
          <div class="user-option">
            <span>{{ user.firstName }} {{ user.lastName }}</span>
            <span class="user-email">{{ user.email }}</span>
          </div>
        </el-option>
      </el-select>
      <template #footer>
        <div class="dialog-footer">
          <bf-button class="secondary" @click="showAddUserDialog = false">Cancel</bf-button>
          <bf-button :disabled="!selectedUserId || isUpdatingPermissions" @click="addUserAccess">Grant access</bf-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="showAddTeamDialog" title="Add a team" width="480px">
      <p class="dialog-text">Everyone in the team will be able to run workflows and notebooks on this node.</p>
      <el-select v-model="selectedTeamId" placeholder="Select a team" class="dialog-select" filterable>
        <el-option v-for="team in availableTeams" :key="team.team.id" :label="team.team.name" :value="team.team.id" />
      </el-select>
      <template #footer>
        <div class="dialog-footer">
          <bf-button class="secondary" @click="showAddTeamDialog = false">Cancel</bf-button>
          <bf-button :disabled="!selectedTeamId || isUpdatingPermissions" @click="addTeamAccess">Grant access</bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/theme';
@use './computeNodePage';

.scope-select {
  width: 300px;
}
.dialog-text {
  margin: 0 0 12px;
  font-size: 13px;
  color: theme.$gray_5;
}
.dialog-select {
  width: 100%;
}
.user-option {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.user-email {
  font-size: 12px;
  color: theme.$gray_4;
}
</style>
