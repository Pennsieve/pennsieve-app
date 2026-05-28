<script setup>
/*
  Shared application permissions manager.

  Renders the "Permissions" section for an App Store application: a read-only
  list plus an edit mode for granting/removing users, teams, and workspaces.
  Self-contained — it fetches and saves permissions itself and is reused by
  the single app view, the My Workspace app page, and the repo settings modal.
*/
import { computed, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'

import BfButton from '@/components/shared/bf-button/BfButton.vue'

const props = defineProps({
  // Application uuid whose permissions we manage.
  uuid: {
    type: String,
    required: true,
  },
  // Owner id of the application (used to decide who may edit).
  ownerId: {
    type: [String, Number],
    default: null,
  },
  // Whether the application is public. Permissions are only editable for
  // private applications owned by the current user.
  isPublic: {
    type: Boolean,
    default: false,
  },
  // Optional org context; falls back to the permissions payload / active org.
  organizationId: {
    type: [String, Number],
    default: null,
  },
})

const emit = defineEmits(['updated'])

const store = useStore()

const profile = computed(() => store.state.profile)
const orgMembers = computed(() => store.state.orgMembers || [])
const teams = computed(() => store.state.teams || [])
const organizations = computed(() => store.state.organizations || [])

/* Permissions data */
const permissions = ref([])
const permissionsLoading = ref(false)
const permissionsError = ref('')

/* Edit state */
const isEditingPermissions = ref(false)
const editVisibility = ref('private')
const editUsers = ref([])
const editTeams = ref([])
const editWorkspaces = ref([])
const isSavingPermissions = ref(false)
const showAddUserDialog = ref(false)
const showAddTeamDialog = ref(false)
const showAddWorkspaceDialog = ref(false)
const selectedAddUserId = ref(null)
const selectedAddTeamId = ref(null)
const selectedAddWorkspaceId = ref(null)

const activeOrgId = computed(
  () =>
    props.organizationId ||
    (permissions.value || []).find((p) => p.organizationId)?.organizationId ||
    store.state.activeOrganization?.organization?.id ||
    null
)

const isCurrentUser = (id) =>
  !!id && (id === profile.value?.id || id === profile.value?.intId)

const isAppOwner = computed(() => isCurrentUser(props.ownerId))

const canEditPermissions = computed(
  () => isAppOwner.value && !props.isPublic
)

const editPermissionsTooltip = computed(() => {
  if (props.isPublic) {
    return 'Only Private Repos allow Owners to update permissions'
  }
  if (!isAppOwner.value) {
    return 'Only Application Owners Can Update Permissions'
  }
  return ''
})

/* Name resolution */
const getUserName = (userId) => {
  if (!userId) return 'Unknown'
  if (
    profile.value &&
    (profile.value.id === userId || profile.value.intId === userId)
  ) {
    return `${profile.value.firstName} ${profile.value.lastName}`.trim() || 'You'
  }
  const member = orgMembers.value.find(
    (m) => m.id === userId || m.intId === userId
  )
  if (member) {
    return `${member.firstName} ${member.lastName}`.trim() || 'Unknown User'
  }
  return String(userId).includes(':')
    ? String(userId).split(':').pop()
    : String(userId)
}

const getWorkspaceName = (workspaceId) => {
  if (!workspaceId) return null
  const match = organizations.value.find(
    (o) =>
      o.organization?.id === workspaceId ||
      o.organization?.intId === workspaceId
  )
  return match?.organization?.name || null
}

const getTeamName = (teamId) => {
  if (!teamId) return null
  const match = teams.value.find(
    (t) => t.team?.id === teamId || t.team?.intId === teamId
  )
  return match?.team?.name || null
}

/* Permission shape helpers (the API uses a few different field names) */
const permissionEntityType = (perm) =>
  perm.entityType ||
  perm.granteeType ||
  (perm.userId
    ? 'user'
    : perm.teamId
      ? 'team'
      : perm.organizationId || perm.workspaceId
        ? 'workspace'
        : null)

const permissionEntityId = (perm) =>
  perm.entityRawId ||
  perm.userId ||
  perm.teamId ||
  perm.organizationId ||
  perm.workspaceId ||
  perm.granteeId ||
  null

const permissionLabel = (perm) => {
  const type = permissionEntityType(perm)
  const id = permissionEntityId(perm)
  if (type === 'user') return getUserName(id)
  if (type === 'team') {
    const name = perm.teamName || getTeamName(id) || id
    return `Team: ${name}`
  }
  if (type === 'workspace' || type === 'organization') {
    const name =
      perm.organizationName || perm.workspaceName || getWorkspaceName(id) || id
    return `Workspace: ${name}`
  }
  if (id) return type ? `${type}: ${id}` : id
  return 'Unknown'
}

const permissionRole = (perm) =>
  perm.accessType || perm.role || perm.permission || perm.accessLevel || '—'

/* Edit helpers */
const splitPermissions = (perms) => {
  const users = []
  const editTeamsList = []
  const workspaces = []
  for (const p of perms || []) {
    const type = permissionEntityType(p)
    const id = permissionEntityId(p)
    if (!id) continue
    const organizationId = p.organizationId || activeOrgId.value
    if (type === 'user') {
      users.push({ entityId: id, organizationId })
    } else if (type === 'team') {
      editTeamsList.push({ entityId: id, organizationId, teamName: p.teamName })
    } else if (type === 'workspace' || type === 'organization') {
      workspaces.push({
        entityId: id,
        organizationId,
        organizationName: p.organizationName || p.workspaceName,
      })
    }
  }
  return { users, teams: editTeamsList, workspaces }
}

const startEditingPermissions = () => {
  const split = splitPermissions(permissions.value)
  editUsers.value = split.users
  editTeams.value = split.teams
  editWorkspaces.value = split.workspaces
  editVisibility.value = props.isPublic ? 'public' : 'private'
  isEditingPermissions.value = true
}

const cancelEditingPermissions = () => {
  isEditingPermissions.value = false
}

const removeEditUser = (idx) => {
  const user = editUsers.value[idx]
  if (user && isCurrentUser(user.entityId)) return
  editUsers.value.splice(idx, 1)
}
const removeEditTeam = (idx) => editTeams.value.splice(idx, 1)
const removeEditWorkspace = (idx) => editWorkspaces.value.splice(idx, 1)

const availableAddableUsers = computed(() => {
  const taken = new Set(editUsers.value.map((u) => u.entityId))
  return orgMembers.value.filter((m) => m.id && !taken.has(m.id))
})

const availableAddableTeams = computed(() => {
  const taken = new Set(editTeams.value.map((t) => t.entityId))
  return teams.value.filter((t) => t.team?.id && !taken.has(t.team.id))
})

const availableAddableWorkspaces = computed(() => {
  const taken = new Set(editWorkspaces.value.map((w) => w.entityId))
  return organizations.value.filter(
    (o) =>
      o.organization?.id &&
      !taken.has(o.organization.id) &&
      o.organization.name?.toLowerCase() !== 'welcome'
  )
})

const openAddUserDialog = () => {
  selectedAddUserId.value = null
  showAddUserDialog.value = true
}
const confirmAddUser = () => {
  if (!selectedAddUserId.value) return
  editUsers.value.push({
    entityId: selectedAddUserId.value,
    organizationId: activeOrgId.value,
  })
  showAddUserDialog.value = false
}

const openAddTeamDialog = () => {
  selectedAddTeamId.value = null
  showAddTeamDialog.value = true
}
const confirmAddTeam = () => {
  if (!selectedAddTeamId.value) return
  const team = teams.value.find((t) => t.team?.id === selectedAddTeamId.value)
  editTeams.value.push({
    entityId: selectedAddTeamId.value,
    organizationId: activeOrgId.value,
    teamName: team?.team?.name,
  })
  showAddTeamDialog.value = false
}

const openAddWorkspaceDialog = () => {
  selectedAddWorkspaceId.value = null
  showAddWorkspaceDialog.value = true
}
const confirmAddWorkspace = () => {
  if (!selectedAddWorkspaceId.value) return
  const org = organizations.value.find(
    (o) => o.organization?.id === selectedAddWorkspaceId.value
  )
  editWorkspaces.value.push({
    entityId: selectedAddWorkspaceId.value,
    organizationId: selectedAddWorkspaceId.value,
    organizationName: org?.organization?.name,
  })
  showAddWorkspaceDialog.value = false
}

/* Fetch + save */
const loadPermissions = async (uuid) => {
  permissions.value = []
  permissionsError.value = ''
  isEditingPermissions.value = false
  if (!uuid) return
  permissionsLoading.value = true
  try {
    const data = await store.dispatch(
      'analysisModule/fetchApplicationPermissions',
      uuid
    )
    permissions.value = Array.isArray(data)
      ? data
      : Array.isArray(data?.access)
        ? data.access
        : Array.isArray(data?.permissions)
          ? data.permissions
          : []
  } catch (err) {
    console.error(err)
    permissionsError.value = 'Failed to load permissions'
  } finally {
    permissionsLoading.value = false
  }
}

const savePermissions = async () => {
  if (!props.uuid) return
  isSavingPermissions.value = true
  try {
    const orgId = activeOrgId.value
    const usersOut = editUsers.value.map((u) => ({
      entityId: u.entityId,
      organizationId: u.organizationId || orgId,
    }))
    // Defense-in-depth: ensure the current user stays in the users list.
    const meId = profile.value?.id || profile.value?.intId
    if (meId && !usersOut.some((u) => u.entityId === meId)) {
      usersOut.push({ entityId: meId, organizationId: orgId })
    }
    const payload = {
      visibility: editVisibility.value,
      users: usersOut,
      teams: editTeams.value.map((t) => ({
        entityId: t.entityId,
        organizationId: t.organizationId || orgId,
      })),
      workspaces: editWorkspaces.value.map((w) => ({
        entityId: w.entityId,
        organizationId: w.organizationId || orgId,
      })),
    }
    await store.dispatch('analysisModule/updateApplicationPermissions', {
      uuid: props.uuid,
      payload,
    })
    ElMessage.success('Permissions updated')
    isEditingPermissions.value = false
    await loadPermissions(props.uuid)
    emit('updated')
  } catch (err) {
    console.error(err)
    ElMessage.error('Failed to update permissions')
  } finally {
    isSavingPermissions.value = false
  }
}

watch(() => props.uuid, (uuid) => loadPermissions(uuid), { immediate: true })

defineExpose({ reload: () => loadPermissions(props.uuid) })
</script>

<template>
  <div class="app-permissions">
    <div class="section-header">
      <h2>Permissions ({{ permissions.length }})</h2>
      <div class="section-actions">
        <template v-if="isEditingPermissions">
          <bf-button
            class="secondary small"
            :disabled="isSavingPermissions"
            @click="cancelEditingPermissions"
          >Cancel</bf-button>
          <bf-button
            class="primary small"
            :loading="isSavingPermissions"
            @click="savePermissions"
          >Save</bf-button>
        </template>
        <el-tooltip
          v-else
          :content="editPermissionsTooltip"
          placement="top"
          :disabled="canEditPermissions"
        >
          <span class="edit-permissions-wrap">
            <bf-button
              class="secondary small"
              :disabled="!canEditPermissions"
              @click="canEditPermissions && startEditingPermissions()"
            >Edit</bf-button>
          </span>
        </el-tooltip>
      </div>
    </div>

    <div v-if="permissionsLoading" class="empty-state">Loading...</div>
    <div v-else-if="permissionsError" class="empty-state">
      {{ permissionsError }}
    </div>

    <!-- Read mode -->
    <template v-else-if="!isEditingPermissions">
      <div v-if="permissions.length === 0" class="empty-state">
        No permissions configured
      </div>
      <div v-else class="info-content">
        <div
          v-for="(perm, i) in permissions"
          :key="perm.uuid || perm.userId || perm.teamId || i"
          class="info-row"
        >
          <span class="info-label">{{ permissionLabel(perm) }}</span>
          <span class="info-value perm-role">{{ permissionRole(perm) }}</span>
        </div>
      </div>
    </template>

    <!-- Edit mode -->
    <template v-else>
      <div class="permissions-edit">
        <div class="edit-subsection">
          <div class="edit-subsection-header">
            <h4>Users ({{ editUsers.length }})</h4>
            <bf-button
              class="secondary small"
              :disabled="availableAddableUsers.length === 0"
              @click="openAddUserDialog"
            >+ Add User</bf-button>
          </div>
          <div v-if="editUsers.length === 0" class="edit-empty">No users</div>
          <div
            v-else
            v-for="(user, i) in editUsers"
            :key="user.entityId"
            class="edit-permission-row"
          >
            <span class="edit-permission-label">
              {{ getUserName(user.entityId) }}
              <span v-if="isCurrentUser(user.entityId)" class="self-tag">
                you
              </span>
            </span>
            <button
              v-if="!isCurrentUser(user.entityId)"
              class="remove-perm-btn"
              type="button"
              title="Remove"
              @click="removeEditUser(i)"
            >&times;</button>
            <span
              v-else
              class="remove-perm-btn-placeholder"
              aria-hidden="true"
            ></span>
          </div>
        </div>

        <div class="edit-subsection">
          <div class="edit-subsection-header">
            <h4>Teams ({{ editTeams.length }})</h4>
            <bf-button
              class="secondary small"
              :disabled="availableAddableTeams.length === 0"
              @click="openAddTeamDialog"
            >+ Add Team</bf-button>
          </div>
          <div v-if="editTeams.length === 0" class="edit-empty">No teams</div>
          <div
            v-else
            v-for="(team, i) in editTeams"
            :key="team.entityId"
            class="edit-permission-row"
          >
            <span class="edit-permission-label">
              {{ team.teamName || getTeamName(team.entityId) || team.entityId }}
            </span>
            <button
              class="remove-perm-btn"
              type="button"
              title="Remove"
              @click="removeEditTeam(i)"
            >&times;</button>
          </div>
        </div>

        <div class="edit-subsection">
          <div class="edit-subsection-header">
            <h4>Workspaces ({{ editWorkspaces.length }})</h4>
            <bf-button
              class="secondary small"
              :disabled="availableAddableWorkspaces.length === 0"
              @click="openAddWorkspaceDialog"
            >+ Add Workspace</bf-button>
          </div>
          <div v-if="editWorkspaces.length === 0" class="edit-empty">
            No workspaces
          </div>
          <div
            v-else
            v-for="(ws, i) in editWorkspaces"
            :key="ws.entityId"
            class="edit-permission-row"
          >
            <span class="edit-permission-label">
              {{ ws.organizationName || getWorkspaceName(ws.entityId) || ws.entityId }}
            </span>
            <button
              class="remove-perm-btn"
              type="button"
              title="Remove"
              @click="removeEditWorkspace(i)"
            >&times;</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Add User Dialog -->
    <el-dialog
      v-model="showAddUserDialog"
      title="Add User"
      width="480px"
      :close-on-click-modal="true"
    >
      <div class="add-perm-dialog">
        <p>Grant a user access to this application:</p>
        <el-select
          v-model="selectedAddUserId"
          placeholder="Select a user"
          size="default"
          filterable
          class="add-perm-select"
        >
          <el-option
            v-for="user in availableAddableUsers"
            :key="user.id"
            :label="`${user.firstName} ${user.lastName}`"
            :value="user.id"
          >
            <div class="user-option">
              <span class="user-name">
                {{ user.firstName }} {{ user.lastName }}
              </span>
              <span class="user-email">{{ user.email }}</span>
            </div>
          </el-option>
        </el-select>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showAddUserDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!selectedAddUserId"
            @click="confirmAddUser"
          >Add</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Add Team Dialog -->
    <el-dialog
      v-model="showAddTeamDialog"
      title="Add Team"
      width="480px"
      :close-on-click-modal="true"
    >
      <div class="add-perm-dialog">
        <p>Grant a team access to this application:</p>
        <el-select
          v-model="selectedAddTeamId"
          placeholder="Select a team"
          size="default"
          filterable
          class="add-perm-select"
        >
          <el-option
            v-for="t in availableAddableTeams"
            :key="t.team.id"
            :label="t.team.name"
            :value="t.team.id"
          />
        </el-select>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showAddTeamDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!selectedAddTeamId"
            @click="confirmAddTeam"
          >Add</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Add Workspace Dialog -->
    <el-dialog
      v-model="showAddWorkspaceDialog"
      title="Add Workspace"
      width="480px"
      :close-on-click-modal="true"
    >
      <div class="add-perm-dialog">
        <p>Grant a workspace access to this application:</p>
        <el-select
          v-model="selectedAddWorkspaceId"
          placeholder="Select a workspace"
          size="default"
          filterable
          class="add-perm-select"
        >
          <el-option
            v-for="o in availableAddableWorkspaces"
            :key="o.organization.id"
            :label="o.organization.name"
            :value="o.organization.id"
          />
        </el-select>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showAddWorkspaceDialog = false">Cancel</el-button>
          <el-button
            type="primary"
            :disabled="!selectedAddWorkspaceId"
            @click="confirmAddWorkspace"
          >Add</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/theme';

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 12px;

  h2 {
    font-size: 18px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0;
  }

  .section-actions {
    display: flex;
    gap: 8px;
  }
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
  font-style: italic;
}

.info-content {
  .info-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    padding: 12px 0;
    border-bottom: 1px solid theme.$gray_1;
    gap: 8px 10px;

    &:last-child {
      border-bottom: none;
    }

    .info-label {
      color: theme.$gray_6;
      font-weight: 500;
      font-size: 14px;
      word-break: break-word;
    }

    .info-value {
      color: theme.$gray_5;
      font-size: 14px;

      &.perm-role {
        text-transform: capitalize;
        padding: 2px 8px;
        border-radius: 10px;
        background: theme.$gray_1;
        color: theme.$gray_6;
        font-size: 12px;
        font-weight: 500;
      }
    }
  }
}

// Wrapper around the disabled Edit button so el-tooltip still receives hover.
.edit-permissions-wrap {
  display: inline-flex;

  :deep(button[disabled]),
  :deep(.bf-button:disabled),
  :deep(.bf-button.is-disabled) {
    opacity: 0.4;
    background-color: theme.$gray_2 !important;
    border-color: theme.$gray_3 !important;
    color: theme.$gray_4 !important;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.permissions-edit {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.edit-subsection {
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  padding: 16px 20px;

  .edit-subsection-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: theme.$gray_6;
    }
  }
}

.edit-empty {
  color: theme.$gray_4;
  font-size: 13px;
  font-style: italic;
  padding: 8px 0;
}

.edit-permission-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid theme.$gray_1;

  &:last-child {
    border-bottom: none;
  }

  .edit-permission-label {
    flex: 1;
    font-size: 14px;
    color: theme.$gray_6;
  }
}

.remove-perm-btn {
  background: none;
  border: none;
  color: theme.$red_2;
  font-size: 20px;
  line-height: 1;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(theme.$red_2, 0.08);
  }
}

.remove-perm-btn-placeholder {
  display: inline-block;
  width: 28px;
  height: 28px;
}

.self-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_5;
  background: theme.$gray_2;
  border-radius: 3px;
}

.add-perm-dialog {
  p {
    margin: 0 0 12px 0;
    color: theme.$gray_5;
    font-size: 14px;
  }

  .add-perm-select {
    width: 100%;
    margin-bottom: 12px;
  }

  .user-option {
    display: flex;
    flex-direction: column;
    line-height: 1.3;

    .user-name {
      font-size: 14px;
      color: theme.$gray_6;
    }

    .user-email {
      font-size: 12px;
      color: theme.$gray_4;
    }
  }
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
