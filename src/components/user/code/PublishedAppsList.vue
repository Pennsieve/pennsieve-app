<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useStore } from 'vuex'
import { useRoute, useRouter } from 'vue-router'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconLink from '@/components/icons/IconLink.vue'

const store = useStore()
const router = useRouter()
const route = useRoute()

const applications = computed(
  () => store.state.analysisModule.applications || []
)
const deletingApplications = computed(
  () => store.state.analysisModule.deletingApplications || []
)
const isAppDeleting = (uuid) => deletingApplications.value.includes(uuid)
const isLoading = ref(false)
const expandedApps = ref(new Set())
const searchQuery = ref('')

const pageSize = 10
const currentPage = ref(1)

const parseGitHubDisplay = (sourceUrl) => {
  if (!sourceUrl) return null
  const match = sourceUrl.match(/github\.com\/([^/]+)\/([^/\s.]+)/)
  if (!match) return null
  return `${match[1]}/${match[2].replace(/\.git$/, '')}`
}

const repoName = (app) =>
  parseGitHubDisplay(app.sourceUrl) || 'Unknown repo'

const visibilityLabel = (app) => {
  if (typeof app?.isPrivate !== 'boolean') return null
  return app.isPrivate ? 'Private' : 'Public'
}

const filteredApplications = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return applications.value
  return applications.value.filter((app) => {
    const url = (app.sourceUrl || '').toLowerCase()
    const name = repoName(app).toLowerCase()
    const visibility = (visibilityLabel(app) || '').toLowerCase()
    const latest = (latestVersion(app)?.version || '').toLowerCase()
    return (
      url.includes(q) ||
      name.includes(q) ||
      visibility.includes(q) ||
      latest.includes(q)
    )
  })
})

const paginatedApplications = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredApplications.value.slice(start, start + pageSize)
})

watch(searchQuery, () => {
  currentPage.value = 1
})

const sortedVersions = (app) => {
  const versions = app.versions || []
  return [...versions].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )
}

const latestVersion = (app) => sortedVersions(app)[0]

const totalDeployments = (app) =>
  (app.versions || []).reduce(
    (sum, v) => sum + (v.deployments || []).length,
    0
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

const statusKey = (status) => {
  if (!status) return 'gray'
  const s = status.toLowerCase()
  if (['deployed', 'active', 'running'].includes(s)) return 'enabled'
  if (['registering', 'deploying', 're-deploying', 'pending'].includes(s))
    return 'pending'
  if (s.startsWith('error') || s === 'stopped' || s === 'failed')
    return 'failed'
  return 'gray'
}

const statusLabel = (status) => {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

const isExpanded = (uuid) => expandedApps.value.has(uuid)

const toggleExpansion = (uuid) => {
  const next = new Set(expandedApps.value)
  if (next.has(uuid)) next.delete(uuid)
  else next.add(uuid)
  expandedApps.value = next
}

const goToDetail = (app) => {
  if (!app?.uuid) return
  router.push({
    name: 'published-app-details',
    params: { uuid: app.uuid },
  })
}

const scrollToTargetApp = async () => {
  const targetUuid = route.query.app
  if (!targetUuid) return
  const idx = filteredApplications.value.findIndex(
    (a) => a.uuid === targetUuid
  )
  if (idx < 0) return
  // If the target is on a later page, jump to that page first.
  const targetPage = Math.floor(idx / pageSize) + 1
  if (currentPage.value !== targetPage) {
    currentPage.value = targetPage
  }
  await nextTick()
  const el = document.getElementById(`published-app-${targetUuid}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('flash-highlight')
    setTimeout(() => el.classList.remove('flash-highlight'), 1500)
  }
}

const fetchApps = async () => {
  isLoading.value = true
  try {
    await store.dispatch('analysisModule/fetchApplications', { force: true })
  } catch (err) {
    console.error('Failed to fetch applications:', err)
  } finally {
    isLoading.value = false
  }
  scrollToTargetApp()
}

watch(
  () => route.query.app,
  () => scrollToTargetApp()
)

onMounted(fetchApps)
</script>

<template>
  <div class="published-apps-container">
    <div class="info-section">
      <div class="info-card">
        <h3>App Store Publications</h3>
        <p>
          Repositories you've published to the Pennsieve App Store.
          Each GitHub release creates a new version that workflows can
          target, with deployment history tracked per version.
        </p>
        <div class="documentation-link">
          <a
            href="https://docs.pennsieve.io/docs/introduction-to-pennsieve-analysis"
            target="_blank"
            class="doc-link"
          >
            View Full Documentation
            <IconArrowRight
              :width="14"
              :height="14"
              style="margin-left: 4px;"
            />
          </a>
        </div>
      </div>
    </div>

    <div class="apps-section" v-loading="isLoading">
      <div class="apps-section-header">
        <h3>Published Applications</h3>
        <el-input
          v-if="applications.length > 0"
          v-model="searchQuery"
          placeholder="Search applications..."
          size="default"
          clearable
          class="apps-search-input"
        />
      </div>

      <div
        v-if="!isLoading && applications.length === 0"
        class="empty-state"
      >
        <p>
          No applications published yet. Enable
          <strong>Publish to App Store</strong> in a repository's publishing
          settings above to get started.
        </p>
      </div>

      <div
        v-else-if="filteredApplications.length === 0"
        class="empty-state"
      >
        <p>
          No applications match
          <strong>"{{ searchQuery }}"</strong>.
        </p>
      </div>

      <div v-else class="apps-grid">
        <div
          v-for="app in paginatedApplications"
          :id="`published-app-${app.uuid}`"
          :key="app.uuid"
          class="app-card"
          :class="{
            expanded: isExpanded(app.uuid),
            'is-deleting': isAppDeleting(app.uuid),
          }"
          :aria-busy="isAppDeleting(app.uuid)"
        >
          <div class="app-header">
            <div class="app-info">
              <h3>
                <button
                  type="button"
                  class="app-name-link"
                  @click="goToDetail(app)"
                >
                  {{ repoName(app) }}
                </button>
              </h3>
              <div class="app-subtitle">Pennsieve App Store</div>
              <div class="app-identifier">
                <strong>Application UUID:</strong> {{ app.uuid }}
              </div>
              <div class="app-tags">
                <span
                  v-if="visibilityLabel(app)"
                  class="tag"
                  :class="visibilityLabel(app).toLowerCase()"
                >
                  {{ visibilityLabel(app) }}
                </span>
                <span class="tag versions">
                  {{ (app.versions || []).length }}
                  {{
                    (app.versions || []).length === 1 ? 'version' : 'versions'
                  }}
                </span>
                <span
                  v-if="totalDeployments(app) > 0"
                  class="tag deployments"
                >
                  {{ totalDeployments(app) }}
                  {{
                    totalDeployments(app) === 1 ? 'deployment' : 'deployments'
                  }}
                </span>
              </div>
            </div>
            <div class="app-header-actions">
              <span v-if="isAppDeleting(app.uuid)" class="archiving-pill">
                Archiving...
              </span>
              <span
                v-else-if="latestVersion(app)"
                class="app-status-badge"
                :class="statusKey(latestVersion(app).status)"
              >
                {{ statusLabel(latestVersion(app).status) }}
              </span>
              <button
                class="expand-toggle"
                @click.stop="toggleExpansion(app.uuid)"
              >
                <span class="expand-text">
                  {{
                    isExpanded(app.uuid) ? 'Hide versions' : 'Show versions'
                  }}
                </span>
                <span
                  class="chevron-icon"
                  :class="{ expanded: isExpanded(app.uuid) }"
                >▼</span>
              </button>
            </div>
          </div>

          <div class="app-card-actions">
            <a
              v-if="app.sourceUrl"
              :href="app.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="card-action-link"
            >
              <IconLink :width="14" :height="14" />
              <span>View on GitHub</span>
            </a>
            <button
              type="button"
              class="card-action-link"
              @click="goToDetail(app)"
            >
              <span>View details</span>
              <span class="arrow">&rarr;</span>
            </button>
          </div>

          <transition name="expand">
            <div
              v-if="isExpanded(app.uuid)"
              class="app-expanded-content"
            >
              <div class="detail-header">
                <h4>Versions</h4>
              </div>

              <div
                v-if="sortedVersions(app).length === 0"
                class="empty-versions"
              >
                No versions yet
              </div>

              <div
                v-for="version in sortedVersions(app)"
                :key="version.uuid"
                class="version-row"
              >
                <div class="version-row-header">
                  <span class="version-tag">{{ version.version }}</span>
                  <span
                    class="version-status-badge"
                    :class="statusKey(version.status)"
                  >
                    {{ statusLabel(version.status) }}
                  </span>
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
                      class="deployment-status"
                      :class="statusKey(deployment.lastStatus)"
                    >
                      {{ statusLabel(deployment.lastStatus) }}
                    </span>
                    <span class="deployment-time">
                      {{ formatDate(deployment.initiatedAt) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>

      <el-pagination
        v-if="filteredApplications.length > 0"
        class="apps-pagination"
        :page-size="pageSize"
        :pager-count="5"
        :current-page="currentPage"
        layout="prev, pager, next"
        :total="filteredApplications.length"
        @current-change="currentPage = $event"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.published-apps-container {
  max-width: 1000px;
  margin: 0;
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

.apps-section {
  margin-bottom: 48px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0;
  }
}

.apps-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.apps-search-input {
  max-width: 320px;
}

.apps-pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  --el-pagination-hover-color: #{theme.$purple_3};
}

.empty-state {
  text-align: center;
  padding: 32px;
  background: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;

  p {
    margin: 0;
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
  }
}

.apps-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-card {
  background: white;
  border: 1px solid theme.$gray_2;
  padding: 20px;
  transition: border-color 0.2s ease, opacity 0.2s ease,
    box-shadow 0.4s ease, background-color 0.4s ease;

  &:hover {
    border-color: theme.$gray_3;
  }

  &.expanded {
    border-color: theme.$purple_2;
  }

  &.is-deleting {
    opacity: 0.5;
    pointer-events: none;
    filter: grayscale(0.5);
  }

  &.flash-highlight {
    border-color: theme.$purple_2;
    box-shadow: 0 0 0 4px rgba(80, 57, 247, 0.18);
    background-color: rgba(80, 57, 247, 0.04);
  }
}

.archiving-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(#F59E0B, 0.12);
  color: #B45309;
  border: 1px solid rgba(#F59E0B, 0.25);
}

.app-card-actions {
  display: flex;
  gap: 18px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid theme.$gray_2;
}

.card-action-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: theme.$purple_3;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  .arrow {
    transition: transform 0.15s ease;
  }

  &:hover .arrow {
    transform: translateX(2px);
  }
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.app-info {
  flex: 1;
  min-width: 0;

  h3 {
    font-size: 16px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .app-name-link {
    color: theme.$gray_6;
    text-decoration: none;
    transition: color 0.2s ease;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    cursor: pointer;
    text-align: left;

    &:hover {
      color: theme.$purple_2;
      text-decoration: underline;
    }
  }
}

.app-subtitle {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 6px;
  font-weight: 400;
}

.app-identifier,
.app-source {
  font-size: 13px;
  color: theme.$gray_5;
  margin-bottom: 4px;
  word-break: break-all;

  strong {
    color: theme.$gray_6;
    font-weight: 500;
  }
}

.app-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;

  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.private {
      background: rgba(#EF4444, 0.1);
      color: #DC2626;
    }

    &.public {
      background: rgba(#10B981, 0.1);
      color: #059669;
    }

    &.unknown {
      background: rgba(#6B7280, 0.1);
      color: #6B7280;
    }

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

.app-header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.app-status-badge {
  display: inline-block;
  text-align: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.gray {
    background: rgba(#6B7280, 0.1);
    color: #6B7280;
    border: 1px solid rgba(#6B7280, 0.2);
  }

  &.enabled {
    background: rgba(#10B981, 0.1);
    color: #059669;
    border: 1px solid rgba(#10B981, 0.2);
  }

  &.pending {
    background: rgba(#F59E0B, 0.1);
    color: #D97706;
    border: 1px solid rgba(#F59E0B, 0.2);
  }

  &.failed {
    background: rgba(#EF4444, 0.1);
    color: #DC2626;
    border: 1px solid rgba(#EF4444, 0.2);
  }
}

.expand-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  color: theme.$gray_5;
  transition: all 0.2s ease;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;

  &:hover {
    background: theme.$gray_1;
    color: theme.$purple_2;
  }

  .expand-text {
    white-space: nowrap;
  }

  .chevron-icon {
    font-size: 10px;
    transition: transform 0.2s ease;
    transform: rotate(0deg);

    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.app-expanded-content {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid theme.$gray_2;

  .detail-header {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid theme.$gray_2;

    h4 {
      font-size: 15px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
    }
  }

  .empty-versions {
    padding: 12px;
    color: theme.$gray_4;
    font-size: 13px;
    text-align: center;
  }
}

.version-row {
  padding: 12px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  margin-bottom: 10px;
  background: theme.$gray_1;

  &:last-child {
    margin-bottom: 0;
  }
}

.version-row-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.version-tag {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  color: theme.$gray_6;
}

.version-status-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-radius: 3px;

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

.version-date {
  font-size: 12px;
  color: theme.$gray_5;
  margin-left: auto;
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

.deployment-status {
  display: inline-block;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-radius: 2px;

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

.deployment-time {
  color: theme.$gray_5;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 2000px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
