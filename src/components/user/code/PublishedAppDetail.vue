<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import { ElMessage } from 'element-plus'

import BfStage from '@/components/layout/BfStage/BfStage.vue'
import EventBus from '@/utils/event-bus'
import { useGetToken } from '@/composables/useGetToken'
import { useSendXhr } from '@/mixins/request/request_composable'
import AppPermissions from './AppPermissions.vue'
import AppArchiveToggle from './AppArchiveToggle.vue'

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

const versionsPageSize = 5
const versionsPage = ref(1)

const showDeleteDialog = ref(false)
const isDeleting = ref(false)

const versionsExpanded = ref(true)

const appUuid = computed(() => props.uuid || route.params.uuid)

const backToCodeRoute = computed(() => ({
  name: 'my-code',
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

const deletingApplications = computed(
  () => store.state.analysisModule.deletingApplications || []
)
const isAppDeleting = computed(() =>
  deletingApplications.value.includes(appUuid.value)
)

// Visibility is sourced from the `isPrivate` flag on the application.
// `isPrivate === false` ⇒ public; everything else (true / undefined) ⇒ private.
const isAppPublic = computed(() => detail.value?.isPrivate === false)

const visibilityLabel = computed(() => {
  if (typeof detail.value?.isPrivate !== 'boolean') return null
  return detail.value.isPrivate ? 'Private' : 'Public'
})

/* Fetch */
const loadDetail = async (uuid) => {
  detail.value = null
  detailError.value = ''
  versionsPage.value = 1
  if (!uuid) return
  isLoading.value = true
  try {
    // Ensure org members and teams are loaded — getPrimaryData() in main.js
    // may not have run if the user navigated here via a userRoute (e.g. my-workspace).
    // The permissions editor relies on this data. Fall back to
    // preferredOrganization / first org when activeOrganization is not set.
    const orgId = store.state.activeOrganization?.organization?.id
      || store.state.profile?.preferredOrganization
      || store.state.organizations?.[0]?.organization?.id
    const needsMembers = orgId && !store.state.orgMembers?.length
    const needsTeams = orgId && !store.state.teams?.length
    const orgDataPromise = (needsMembers || needsTeams)
      ? useGetToken().then((token) => {
          const base = `${store.state.config.apiUrl}/organizations/${orgId}`
          return Promise.all([
            needsMembers
              ? useSendXhr(`${base}/members?api_key=${token}`).then((r) => store.dispatch('updateOrgMembers', r))
              : Promise.resolve(),
            needsTeams
              ? useSendXhr(`${base}/teams?api_key=${token}`).then((r) => store.dispatch('updateTeams', r))
              : Promise.resolve(),
          ])
        }).catch((err) => console.warn('Failed to load org data:', err))
      : Promise.resolve()

    const [detailResult] = await Promise.allSettled([
      store.dispatch('analysisModule/fetchApplication', uuid),
      orgDataPromise,
    ])

    if (detailResult.status === 'fulfilled' && detailResult.value) {
      detail.value = detailResult.value
    } else {
      console.error(detailResult.reason)
      detailError.value =
        'This repository is not published to the App Store yet.'
      ElMessage.error('Failed to load application details')
    }
  } finally {
    isLoading.value = false
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

/* Archive / restore — handled by the shared AppArchiveToggle component. */
const isArchived = computed(() => detail.value?.status === 'archived')

// Keep the local detail in sync when the archive toggle changes status.
const onArchiveChange = (status) => {
  if (detail.value) detail.value = { ...detail.value, status }
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
          &larr; Back to My Repos
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
            <!-- <div
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
            </div> -->
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
        <app-permissions
          :uuid="detail.uuid"
          :owner-id="detail.ownerId"
          :is-public="isAppPublic"
          :organization-id="detail.organizationId"
          @updated="loadDetail(appUuid)"
        />
      </div>

      <!-- Danger Zone -->
      <div class="management-section danger-section">
        <div class="section-header">
          <h2>Danger Zone</h2>
        </div>
        <div class="delete-content">
          <div class="delete-info">
            <p v-if="isArchived">
              This application is archived and hidden from active workspaces.
              Restore it to make it available to workflows again.
            </p>
            <p v-else>
              Archive this application to remove it from active workspaces.
              Workflows that reference this application will no longer be
              able to run it, but the underlying record is preserved and can
              be restored later.
            </p>
          </div>
          <div class="danger-action">
            <app-archive-toggle
              :uuid="detail.uuid"
              :owner-id="detail.ownerId"
              :source-url="detail.sourceUrl"
              :status="detail.status"
              @change="onArchiveChange"
            />
          </div>
        </div>
      </div>
    </div>

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

.archive-toggle-wrap {
  display: inline-flex;
  align-items: center;
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
