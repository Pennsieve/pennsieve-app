<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'

import BfStage from '@/components/layout/BfStage/BfStage.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import EventBus from '@/utils/event-bus'

const props = defineProps({
  uuid: {
    type: String,
    default: '',
  },
})

const route = useRoute()
const router = useRouter()
const store = useStore()

const profile = computed(() => store.state.profile)
const orgMembers = computed(() => store.state.orgMembers || [])

const detail = ref(null)
const isLoading = ref(false)
const detailError = ref('')
const permissions = ref([])
const permissionsLoading = ref(false)
const permissionsError = ref('')

const versionsPageSize = 5
const versionsPage = ref(1)

const showDeleteDialog = ref(false)
const isDeleting = ref(false)

const versionsExpanded = ref(true)

// Permissions edit state
const isEditingPermissions = ref(false)
const editVisibility = ref('private')
const editUsers = ref([])
const editTeams = ref([])
const editWorkspaces = ref([])
const isSavingPermissions = ref(false)
const showAddUserDialog = ref(false)
const showAddTeamDialog = ref(false)
const selectedAddUserId = ref(null)
const selectedAddTeamId = ref(null)

const teams = computed(() => store.state.teams || [])

const activeOrgId = computed(
  () =>
    detail.value?.organizationId ||
    (permissions.value || []).find((p) => p.organizationId)?.organizationId ||
    store.state.activeOrganization?.organization?.id ||
    null
)

const appUuid = computed(() => props.uuid || route.params.uuid)

const backToCodeRoute = computed(() => ({
  name: 'my-code',
  query: { tab: 'published', app: appUuid.value },
}))

/* Helpers */
const parseGitHubRepo = (sourceUrl) => {
  if (!sourceUrl) return null
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/\s.]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

const parseGitHubDisplay = (sourceUrl) => {
  const info = parseGitHubRepo(sourceUrl)
  return info ? `${info.owner}/${info.repo}` : null
}

const repoName = computed(
  () => parseGitHubDisplay(detail.value?.sourceUrl) || 'Unknown repo'
)

const sortedVersions = computed(() => {
  const versions = detail.value?.versions || []
  return [...versions].sort(
    (a, b) =>
      (new Date(b.createdAt).getTime() || 0) -
      (new Date(a.createdAt).getTime() || 0)
  )
})

const versionsPageCount = computed(() =>
  Math.max(1, Math.ceil(sortedVersions.value.length / versionsPageSize))
)

const paginatedVersions = computed(() => {
  const start = (versionsPage.value - 1) * versionsPageSize
  return sortedVersions.value.slice(start, start + versionsPageSize)
})

const totalDeployments = computed(() =>
  (detail.value?.versions || []).reduce(
    (sum, v) => sum + (v.deployments || []).length,
    0
  )
)

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleString()
  } catch {
    return dateString
  }
}

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

const organizations = computed(() => store.state.organizations || [])

const getWorkspaceName = (workspaceId) => {
  if (!workspaceId) return null
  const match = organizations.value.find(
    (o) => o.organization?.id === workspaceId ||
           o.organization?.intId === workspaceId
  )
  return match?.organization?.name || null
}

const statusKey = (status) => {
  if (!status) return 'gray'
  const s = status.toLowerCase()
  if (['deployed', 'active', 'running'].includes(s)) return 'enabled'
  if (['registering', 'deploying', 're-deploying', 'pending'].includes(s))
    return 'pending'
  if (s.startsWith('error') || s === 'stopped' || s === 'failed') return 'failed'
  return 'gray'
}

const statusLabel = (status) => {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

const permissionEntityType = (perm) =>
  perm.entityType || perm.granteeType || (perm.userId
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
  if (type === 'team') return `Team: ${perm.teamName || id}`
  if (type === 'workspace' || type === 'organization') {
    const name =
      perm.organizationName ||
      perm.workspaceName ||
      getWorkspaceName(id) ||
      id
    return `Workspace: ${name}`
  }
  if (id) return type ? `${type}: ${id}` : id
  return 'Unknown'
}

const permissionRole = (perm) =>
  perm.accessType ||
  perm.role ||
  perm.permission ||
  perm.accessLevel ||
  '—'

/* Permissions edit helpers */
const splitPermissions = (perms) => {
  const users = []
  const teams = []
  const workspaces = []
  for (const p of perms || []) {
    const type = permissionEntityType(p)
    const id = permissionEntityId(p)
    if (!id) continue
    const organizationId = p.organizationId || activeOrgId.value
    if (type === 'user') {
      users.push({ entityId: id, organizationId })
    } else if (type === 'team') {
      teams.push({ entityId: id, organizationId, teamName: p.teamName })
    } else if (type === 'workspace' || type === 'organization') {
      workspaces.push({
        entityId: id,
        organizationId,
        organizationName: p.organizationName || p.workspaceName,
      })
    }
  }
  return { users, teams, workspaces }
}

const startEditingPermissions = () => {
  const split = splitPermissions(permissions.value)
  editUsers.value = split.users
  editTeams.value = split.teams
  editWorkspaces.value = split.workspaces
  editVisibility.value = isAppPublic.value ? 'public' : 'private'
  isEditingPermissions.value = true
}

const cancelEditingPermissions = () => {
  isEditingPermissions.value = false
}

const deletingApplications = computed(
  () => store.state.analysisModule.deletingApplications || []
)
const isAppDeleting = computed(() =>
  deletingApplications.value.includes(appUuid.value)
)

const isCurrentUser = (id) =>
  !!id &&
  (id === profile.value?.id || id === profile.value?.intId)

const isAppOwner = computed(() => isCurrentUser(detail.value?.ownerId))

// Visibility is sourced from the `isPrivate` flag on the application.
// `isPrivate === false` ⇒ public; everything else (true / undefined) ⇒ private.
const isAppPublic = computed(() => detail.value?.isPrivate === false)

const visibilityLabel = computed(() => {
  if (typeof detail.value?.isPrivate !== 'boolean') return null
  return detail.value.isPrivate ? 'Private' : 'Public'
})

const canEditPermissions = computed(
  () => isAppOwner.value && !isAppPublic.value
)

const editPermissionsTooltip = computed(() => {
  if (isAppPublic.value) {
    return 'Only Private Repos allow Owners to update permissions'
  }
  if (!isAppOwner.value) {
    return 'Only Application Owners Can Update Permissions'
  }
  return ''
})

const removeEditUser = (idx) => {
  const user = editUsers.value[idx]
  if (user && isCurrentUser(user.entityId)) return
  editUsers.value.splice(idx, 1)
}
const removeEditTeam = (idx) => editTeams.value.splice(idx, 1)

const availableAddableUsers = computed(() => {
  const taken = new Set(editUsers.value.map((u) => u.entityId))
  return orgMembers.value.filter((m) => m.id && !taken.has(m.id))
})

const availableAddableTeams = computed(() => {
  const taken = new Set(editTeams.value.map((t) => t.entityId))
  return teams.value.filter((t) => t.team?.id && !taken.has(t.team.id))
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

const savePermissions = async () => {
  if (!appUuid.value) return
  isSavingPermissions.value = true
  try {
    const orgId = activeOrgId.value
    const usersOut = editUsers.value.map((u) => ({
      entityId: u.entityId,
      organizationId: u.organizationId || orgId,
    }))
    // Defense-in-depth: ensure the current user is in the users list.
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
      uuid: appUuid.value,
      payload,
    })
    ElMessage.success('Permissions updated')
    isEditingPermissions.value = false
    // Refresh permissions and detail (visibility may have changed)
    await loadDetail(appUuid.value)
  } catch (err) {
    console.error(err)
    ElMessage.error('Failed to update permissions')
  } finally {
    isSavingPermissions.value = false
  }
}

/* Fetch */
const loadDetail = async (uuid) => {
  detail.value = null
  permissions.value = []
  detailError.value = ''
  permissionsError.value = ''
  versionsPage.value = 1
  if (!uuid) return
  isLoading.value = true
  permissionsLoading.value = true
  try {
    const [detailResult, permsResult] = await Promise.allSettled([
      store.dispatch('analysisModule/fetchApplication', uuid),
      store.dispatch('analysisModule/fetchApplicationPermissions', uuid),
    ])

    if (detailResult.status === 'fulfilled' && detailResult.value) {
      detail.value = detailResult.value
    } else {
      console.error(detailResult.reason)
      detailError.value =
        'This repository is not published to the App Store yet.'
      ElMessage.error('Failed to load application details')
    }

    if (permsResult.status === 'fulfilled') {
      const data = permsResult.value
      permissions.value = Array.isArray(data)
        ? data
        : Array.isArray(data?.access)
          ? data.access
          : Array.isArray(data?.permissions)
            ? data.permissions
            : []
    } else {
      console.error(permsResult.reason)
      permissionsError.value = 'Failed to load permissions'
    }
  } finally {
    isLoading.value = false
    permissionsLoading.value = false
  }
}

watch(appUuid, (uuid) => loadDetail(uuid))
onMounted(() => loadDetail(appUuid.value))

/* Delete */
const confirmDelete = async () => {
  if (!detail.value) return
  isDeleting.value = true
  showDeleteDialog.value = false
  try {
    await store.dispatch('analysisModule/deleteApplication', detail.value)
    EventBus.$emit('toast', {
      detail: {
        type: 'success',
        msg: 'Your request was successful. It may take some time to complete.',
      },
    })
    // Refresh the applications list so the My Code view either reflects
    // the deletion or keeps the in-flight marker until the backend finishes.
    store
      .dispatch('analysisModule/fetchApplications', { force: true })
      .catch(() => {})
    router.push({
      name: 'my-code',
      query: { tab: 'published', app: appUuid.value },
    })
  } catch (error) {
    console.error(error)
    EventBus.$emit('toast', {
      detail: {
        type: 'error',
        msg: 'Something went wrong, please try again later.',
      },
    })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <bf-stage element-loading-background="transparent" v-loading="isLoading">
    <div v-if="detailError && !detail" class="app-not-found">
      <p>{{ detailError }}</p>
      <router-link :to="backToCodeRoute" class="back-link">
        &larr; Back to My Code
      </router-link>
    </div>

    <div
      v-else-if="detail"
      class="application-management"
      :class="{ 'is-deleting': isAppDeleting }"
      :aria-busy="isAppDeleting"
    >
      <!-- Back link -->
      <div class="app-breadcrumb">
        <router-link :to="backToCodeRoute" class="back-link">
          &larr; Back to Published Applications
        </router-link>
      </div>

      <!-- Header -->
      <div class="app-header-section">
        <div class="app-header-top">
          <h1>{{ repoName }}</h1>
          <div class="app-header-status">
            <span v-if="isAppDeleting" class="archiving-pill">
              Archiving...
            </span>
            <span
              v-if="visibilityLabel"
              class="visibility-pill"
              :class="visibilityLabel.toLowerCase()"
            >
              {{ visibilityLabel }}
            </span>
          </div>
        </div>
        <p class="app-subtitle">Pennsieve App Store</p>
        <div class="app-tags">
          <span class="tag versions">
            {{ (detail.versions || []).length }}
            {{ (detail.versions || []).length === 1 ? 'version' : 'versions' }}
          </span>
          <span v-if="totalDeployments > 0" class="tag deployments">
            {{ totalDeployments }}
            {{ totalDeployments === 1 ? 'deployment' : 'deployments' }}
          </span>
        </div>
      </div>

      <!-- Application Information -->
      <div class="management-section">
        <div class="section-header">
          <h2>Application Information</h2>
        </div>
        <div class="info-content">
          <div class="info-row">
            <span class="info-label">Repository</span>
            <span class="info-value">{{ repoName }}</span>
          </div>
          <div v-if="detail.sourceUrl" class="info-row">
            <span class="info-label">Source URL</span>
            <a
              :href="detail.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="info-value mono"
            >{{ detail.sourceUrl }}</a>
          </div>
          <div v-if="detail.sourceType" class="info-row">
            <span class="info-label">Source Type</span>
            <span class="info-value">{{ detail.sourceType }}</span>
          </div>
          <div v-if="visibilityLabel" class="info-row">
            <span class="info-label">Visibility</span>
            <span class="info-value">{{ visibilityLabel }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Application UUID</span>
            <span class="info-value mono small">{{ detail.uuid }}</span>
          </div>
          <div v-if="detail.ownerId" class="info-row">
            <span class="info-label">Owner</span>
            <span class="info-value">{{ getUserName(detail.ownerId) }}</span>
          </div>
          <div v-if="detail.createdAt" class="info-row">
            <span class="info-label">Created</span>
            <span class="info-value">{{ formatDate(detail.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Versions -->
      <div class="management-section">
        <button
          type="button"
          class="section-header section-header-toggle"
          :aria-expanded="versionsExpanded"
          @click="versionsExpanded = !versionsExpanded"
        >
          <h2>Versions ({{ sortedVersions.length }})</h2>
          <span
            class="chevron-icon"
            :class="{ expanded: versionsExpanded }"
          >▼</span>
        </button>
        <template v-if="versionsExpanded">
          <div v-if="sortedVersions.length === 0" class="empty-state">
            No versions yet
          </div>
          <div
            v-for="version in paginatedVersions"
            :key="version.uuid"
            class="version-card"
          >
            <div class="version-header">
              <span class="version-tag">{{ version.version }}</span>
              <span
                class="status-badge"
                :class="statusKey(version.status)"
              >{{ statusLabel(version.status) }}</span>
              <span class="version-date">
                Released {{ formatDate(version.createdAt) }}
              </span>
            </div>
            <div
              v-if="(version.deployments || []).length > 0"
              class="deployments-list"
            >
              <div class="deployments-label">
                Deployments ({{ version.deployments.length }})
              </div>
              <div
                v-for="deployment in version.deployments"
                :key="deployment.deploymentId"
                class="deployment-row"
              >
                <span
                  class="status-badge status-badge-sm"
                  :class="statusKey(deployment.lastStatus)"
                >{{ statusLabel(deployment.lastStatus) }}</span>
                <span class="deployment-time">
                  {{ formatDateTime(deployment.initiatedAt) }}
                </span>
              </div>
            </div>
          </div>
          <el-pagination
            v-if="versionsPageCount > 1"
            class="versions-pagination"
            :page-size="versionsPageSize"
            :pager-count="5"
            :current-page="versionsPage"
            layout="prev, pager, next"
            :total="sortedVersions.length"
            small
            @current-change="versionsPage = $event"
          />
        </template>
      </div>

      <!-- Permissions -->
      <div class="management-section">
        <div class="section-header">
          <h2>Permissions ({{ permissions.length }})</h2>
          <div class="section-actions">
            <template v-if="isEditingPermissions">
              <bf-button
                class="secondary small"
                @click="cancelEditingPermissions"
                :disabled="isSavingPermissions"
              >Cancel</bf-button>
              <bf-button
                class="primary small"
                @click="savePermissions"
                :loading="isSavingPermissions"
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
              <span class="info-value perm-role">
                {{ permissionRole(perm) }}
              </span>
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
                  @click="openAddUserDialog"
                  :disabled="availableAddableUsers.length === 0"
                >+ Add User</bf-button>
              </div>
              <div v-if="editUsers.length === 0" class="edit-empty">
                No users
              </div>
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
                  @click="removeEditUser(i)"
                  title="Remove"
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
                  @click="openAddTeamDialog"
                  :disabled="availableAddableTeams.length === 0"
                >+ Add Team</bf-button>
              </div>
              <div v-if="editTeams.length === 0" class="edit-empty">
                No teams
              </div>
              <div
                v-else
                v-for="(team, i) in editTeams"
                :key="team.entityId"
                class="edit-permission-row"
              >
                <span class="edit-permission-label">
                  {{ team.teamName || team.entityId }}
                </span>
                <button
                  class="remove-perm-btn"
                  type="button"
                  @click="removeEditTeam(i)"
                  title="Remove"
                >&times;</button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Danger Zone -->
      <div class="management-section danger-section">
        <div class="section-header">
          <h2>Danger Zone</h2>
        </div>
        <div class="delete-content">
          <div class="delete-info">
            <p>
              Archive this application to remove it from active workspaces.
              Workflows that reference this application will no longer be
              able to run it, but the underlying record is preserved.
            </p>
          </div>
          <div class="danger-action">
            <el-tooltip
              :content="
                isAppOwner
                  ? ''
                  : 'Only Application Owners Can Archive Applications'
              "
              placement="top"
              :disabled="isAppOwner"
            >
              <span class="archive-button-wrap">
                <bf-button class="danger-button" disabled>
                  Archive Application
                </bf-button>
              </span>
            </el-tooltip>
            <span class="coming-soon-tag">Coming Soon</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add User Permission Dialog -->
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

    <!-- Add Team Permission Dialog -->
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

    <!-- Delete Confirmation Dialog -->
    <el-dialog
      v-model="showDeleteDialog"
      title="Delete Application"
      width="480px"
      :close-on-click-modal="false"
    >
      <div v-if="detail" class="delete-app-dialog">
        <h4>Are you sure you want to delete this application?</h4>
        <p class="warning-message">
          Deleting <strong>{{ repoName }}</strong> will permanently remove
          this application and all of its versions from the Pennsieve App
          Store.
        </p>
        <p class="impact-message">This action cannot be undone.</p>
        <div class="app-summary">
          <div class="summary-row">
            <strong>Repository:</strong> {{ repoName }}
          </div>
          <div class="summary-row">
            <strong>Application UUID:</strong> {{ detail.uuid }}
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showDeleteDialog = false">Cancel</el-button>
          <el-button
            type="danger"
            :loading="isDeleting"
            @click="confirmDelete"
          >
            Delete Application
          </el-button>
        </div>
      </template>
    </el-dialog>
  </bf-stage>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.application-management {
  max-width: 900px;
  margin: 0;
  padding: 0;
  transition: opacity 0.2s ease;

  &.is-deleting {
    opacity: 0.5;
    pointer-events: none;
    filter: grayscale(0.5);
  }
}

.app-header-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.archiving-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(#F59E0B, 0.12);
  color: #B45309;
  border: 1px solid rgba(#F59E0B, 0.25);
}

.app-breadcrumb {
  margin-bottom: 24px;

  .back-link {
    color: theme.$purple_3;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
}

.app-not-found {
  text-align: center;
  padding: 48px 24px;
  color: theme.$gray_4;
  font-size: 14px;

  .back-link {
    display: inline-block;
    margin-top: 12px;
    color: theme.$purple_3;
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
}

.app-header-section {
  margin-bottom: 40px;

  .app-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }

  h1 {
    font-size: 28px;
    font-weight: 300;
    color: theme.$gray_6;
    margin: 0;
  }

  .app-subtitle {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0 0 12px 0;
  }
}

.visibility-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(#6B7280, 0.1);
  color: #6B7280;

  &.private {
    background: rgba(#EF4444, 0.1);
    color: #DC2626;
  }

  &.public {
    background: rgba(#10B981, 0.1);
    color: #059669;
  }
}

.app-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.versions {
      background: rgba(theme.$purple_2, 0.1);
      color: theme.$purple_2;
    }

    &.deployments {
      background: rgba(#F59E0B, 0.1);
      color: #D97706;
    }
  }
}

.management-section {
  background: white;
  border: 1px solid theme.$gray_2;
  margin-bottom: 32px;
  padding: 28px 32px;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid theme.$gray_2;

    h2 {
      font-size: 20px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
    }

    .section-link {
      color: theme.$purple_3;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  &.danger-section {
    border-color: rgba(theme.$red_2, 0.2);

    .section-header {
      border-bottom-color: rgba(theme.$red_2, 0.2);
      margin-bottom: 20px;
      padding-bottom: 16px;

      h2 {
        color: theme.$red_2;
      }
    }
  }
}

.delete-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  .delete-info p {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
  }
}

.danger-action {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  .danger-button[disabled],
  :deep(.bf-button.danger-button:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.coming-soon-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #fff3cd;
  color: #856404;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 12px;
  line-height: 1.2;
}

.delete-app-dialog {
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
  }

  .impact-message {
    font-size: 13px;
    color: #D97706;
    margin: 0 0 16px 0;
    font-weight: 500;
  }

  .app-summary {
    background: theme.$gray_1;
    border: 1px solid theme.$gray_2;
    border-radius: 6px;
    padding: 16px;

    .summary-row {
      font-size: 13px;
      margin-bottom: 6px;

      &:last-child {
        margin-bottom: 0;
      }

      strong {
        color: theme.$gray_6;
        margin-right: 6px;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.info-content {
  .info-row {
    display: flex;
    padding: 14px 0;
    border-bottom: 1px solid theme.$gray_1;
    gap: 16px;

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
      word-break: break-word;

      &.mono {
        font-family: 'Courier New', monospace;
        font-size: 13px;
        background: theme.$gray_1;
        padding: 4px 8px;
        border-radius: 4px;

        &.small {
          font-size: 11px;
        }
      }

      &.perm-role {
        text-transform: capitalize;
      }
    }

    a.info-value {
      color: theme.$purple_3;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: theme.$gray_4;
  font-size: 14px;
  font-style: italic;
}

/* Versions */
.version-card {
  padding: 14px 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  margin-bottom: 12px;
  background: theme.$gray_1;

  &:last-child {
    margin-bottom: 0;
  }
}

.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.version-tag {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 600;
  color: theme.$gray_6;
}

.version-date {
  font-size: 12px;
  color: theme.$gray_5;
  margin-left: auto;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-radius: 3px;

  &.status-badge-sm {
    font-size: 9px;
    padding: 1px 6px;
  }

  &.gray {
    background: rgba(#6B7280, 0.15);
    color: #6B7280;
  }
  &.enabled {
    background: rgba(#10B981, 0.15);
    color: #059669;
  }
  &.pending {
    background: rgba(#F59E0B, 0.15);
    color: #D97706;
  }
  &.failed {
    background: rgba(#EF4444, 0.15);
    color: #DC2626;
  }
}

.deployments-list {
  border-top: 1px solid theme.$gray_2;
  padding-top: 8px;
  margin-top: 10px;
}

.deployments-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: theme.$gray_5;
  margin-bottom: 6px;
}

.deployment-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
  font-size: 11px;
}

.deployment-time {
  color: theme.$gray_5;
}

.versions-pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
  --el-pagination-hover-color: #{theme.$purple_3};
}

.section-header .section-actions {
  display: flex;
  gap: 8px;
}

// Wrappers around disabled buttons so el-tooltip still receives hover
// events (disabled buttons swallow them in some browsers). Heavily dim
// the inner button so it reads unmistakably disabled.
.edit-permissions-wrap,
.archive-button-wrap {
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
  gap: 24px;
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

  .role-select {
    width: 120px;
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

    &.role {
      margin-bottom: 0;
    }
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

.section-header-toggle {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid theme.$gray_2;
  padding: 0 0 20px 0;
  margin: 0 0 28px 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: left;

  &:hover h2 {
    color: theme.$purple_2;
  }
}

.chevron-icon {
  font-size: 12px;
  color: theme.$gray_5;
  transition: transform 0.2s ease;
  transform: rotate(-90deg);

  &.expanded {
    transform: rotate(0deg);
  }
}
</style>
