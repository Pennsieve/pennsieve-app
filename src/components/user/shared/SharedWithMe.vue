<template>
  <bf-stage slot="stage">



    <div class="shared-with-me">

      <!-- Workspaces Section -->
      <div class="section">
        <div class="section-header">
          <h2>Shared Workspaces</h2>
          <p class="section-description">A list of workspaces that you have access to. You can have access to many datasets within a workspace.</p>
        </div>

        <div v-if="sharedWorkspaces.length === 0" class="empty-state">
          <div class="empty-state-content">
            <IconOrganization :width="48" :height="48" color="#71747c" />
            <h3>No shared workspaces</h3>
            <p>You haven't been invited to any workspaces yet.</p>
          </div>
        </div>

        <div v-else class="workspace-grid">
          <WorkspaceCard
            v-for="workspace in sharedWorkspaces"
            :key="workspace.organization.id"
            :workspace="workspace"
          />
        </div>
      </div>

      <!-- Datasets Section -->
      <div class="section">
        <div class="section-header">
          <h2>Shared With Me</h2>
          <p class="section-description">A list of datasets shared with you from workspaces other than those listed above. Although you don't have access to the full workspace, you can still interact with these specific datasets.</p>
        </div>

        <div v-if="isLoadingDatasets" class="loading-state" v-loading="isLoadingDatasets">
          <p>Loading datasets...</p>
        </div>

        <div v-else-if="guestDatasets.length === 0" class="empty-state">
          <div class="empty-state-content">
            <IconDataset :width="48" :height="48" color="#71747c" />
            <h3>No guest dataset access</h3>
            <p>You haven't been invited to any datasets as a guest.</p>
          </div>
        </div>

        <div v-else class="dataset-list">
          <div class="dataset-list-header">
            <div class="dataset-search">
              <el-input
                v-model="datasetSearchQuery"
                class="dataset-search-input"
                placeholder="Search guest datasets..."
                @input="filterDatasets"
              >
                <template #prefix>
                  <IconMagnifyingGlass :height="20" :width="20" color="#71747c" />
                </template>
              </el-input>
            </div>
            <div class="dataset-count">
              {{ filteredGuestDatasets.length }} dataset{{ filteredGuestDatasets.length !== 1 ? 's' : '' }}
            </div>
          </div>

          <div class="dataset-grid">
            <div
              v-for="dataset in filteredGuestDatasets"
              :key="dataset.content.id"
              class="dataset-card"
              @click="navigateToDataset(dataset)"
            >
              <div class="dataset-card-content">
<!--                TODO: insert banner image-->
<!--                <div class="dataset-icon">-->
<!--                  <IconDataset :width="24" :height="24" color="currentColor" />-->
<!--                </div>-->
                <div class="dataset-info">
                  <div class="dataset-header">
                    <h3 class="dataset-name">{{ dataset.content.name }}</h3>
                    <span class="dataset-status-tag" :class="`status-${dataset.content.status.toLowerCase().replace('_', '-')}`">
                      {{ formatDatasetStatus(dataset.content.status) }}
                    </span>
                  </div>
                  <p class="dataset-org">{{ getDatasetOrganization(dataset) }}</p>
                  <p class="dataset-description" v-if="dataset.content.description">
                    {{ truncateDescription(dataset.content.description) }}
                  </p>
                  <div class="dataset-meta">
                    <span class="dataset-updated">Updated {{ formatDate(dataset.content.updatedAt) }}</span>
                  </div>
                </div>
                <div class="dataset-arrow">
                  <IconArrowRight :width="16" :height="16" color="currentColor" />
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination for datasets if needed -->
          <div v-if="filteredGuestDatasets.length > pageSize" class="pagination-container">
            <el-pagination
              :page-size="pageSize"
              :current-page="currentPage"
              layout="prev, pager, next"
              :total="filteredGuestDatasets.length"
              @current-change="onPageChange"
            />
          </div>
        </div>
      </div>
    </div>
  </bf-stage>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { propOr } from 'ramda'
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import IconOrganization from '@/components/icons/IconOrganization.vue'
import IconDataset from '@/components/icons/IconDataset.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconMagnifyingGlass from '@/components/icons/IconMagnifyingGlass.vue'
import WorkspaceCard from './WorkspaceCard.vue'
import { useGetToken } from '@/composables/useGetToken'

export default {
  name: 'SharedWithMe',

  components: {
    BfStage,
    IconOrganization,
    IconDataset,
    IconArrowRight,
    IconMagnifyingGlass,
    WorkspaceCard
  },

  data() {
    return {
      isLoadingDatasets: false,
      guestDatasets: [], // This would be fetched from API
      datasetSearchQuery: '',
      filteredGuestDatasets: [],
      currentPage: 1,
      pageSize: 20
    }
  },

  computed: {
    ...mapGetters([
      'organizations',
      'profile'
    ]),

    ...mapState([
      'activeOrganization'
    ]),

    // Filter to show only workspaces where the user is a member (not a guest)
    sharedWorkspaces() {
      if (!this.organizations || !Array.isArray(this.organizations)) {
        return []
      }

      // Filter out workspaces where the user is a guest
      // Show only workspaces where the user has full membership
      return this.organizations.filter(workspace => {
        // Check if the workspace has the isGuest flag set to true
        // If isGuest is true or the workspace is marked as guest, exclude it
        const isGuest = workspace.isGuest || workspace.organization?.isGuest
        return !isGuest
      })
    }
  },

  mounted() {
    this.loadGuestDatasets()
  },

  methods: {
    async loadGuestDatasets() {
      this.isLoadingDatasets = true
      try {
        // Get the user's authentication token
        const token = await useGetToken()
        
        // Fetch shared datasets from the API
        const response = await fetch('https://api2.pennsieve.net/datasets/shared-datasets?limit=100&offset=0', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch shared datasets: ${response.status}`)
        }

        const data = await response.json()
        
        // Transform the API response to match our component's data structure
        this.guestDatasets = data.datasets || []
        this.filteredGuestDatasets = [...this.guestDatasets]
      } catch (error) {
        console.error('Error loading guest datasets:', error)
        this.guestDatasets = []
        this.filteredGuestDatasets = []
      } finally {
        this.isLoadingDatasets = false
      }
    },

    filterDatasets() {
      if (!this.datasetSearchQuery.trim()) {
        this.filteredGuestDatasets = [...this.guestDatasets]
      } else {
        const query = this.datasetSearchQuery.toLowerCase()
        this.filteredGuestDatasets = this.guestDatasets.filter(dataset => 
          dataset.content.name.toLowerCase().includes(query) ||
          (dataset.content.description && dataset.content.description.toLowerCase().includes(query))
        )
      }
      this.currentPage = 1
    },

    navigateToWorkspace(workspace) {
      const orgId = workspace.organization.id
      this.$router.push({ name: 'datasets-list', params: { orgId } })
    },

    navigateToDataset(dataset) {
      // Navigate to the dataset in its organization context
      const orgId = dataset.content.workspaceNodeId
      const datasetId = dataset.content.id
      this.$router.push({ 
        name: 'dataset-overview', 
        params: { orgId, datasetId } 
      })
    },

    getWorkspaceRole(workspace) {
      // Determine user's role in the workspace
      if (propOr(false, 'isGuest', workspace)) {
        return 'Guest'
      }
      
      const userId = this.profile.id
      const administrators = propOr([], 'administrators', workspace)
      const owners = propOr([], 'owners', workspace)
      
      if (owners.some(owner => owner.id === userId)) {
        return 'Owner'
      } else if (administrators.some(admin => admin.id === userId)) {
        return 'Administrator'
      } else {
        return 'Collaborator'
      }
    },

    getDatasetOrganization(dataset) {
      // Get organization name for the dataset
      return dataset.content.workspaceName || 'Unknown Organization'
    },

    truncateDescription(description, maxLength = 120) {
      if (!description) return ''
      if (description.length <= maxLength) return description
      return description.substring(0, maxLength) + '...'
    },

    formatDatasetSize(sizeInBytes) {
      if (!sizeInBytes || sizeInBytes === 0) return '0 B'
      
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
      const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024))
      return Math.round(sizeInBytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
    },

    formatDatasetStatus(status) {
      if (!status || status === 'NO_STATUS') return 'No Status'
      
      // Convert status to human-readable format
      return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    },

    formatDate(dateString) {
      if (!dateString) return 'Unknown'
      
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now - date)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) return '1 day ago'
      if (diffDays < 7) return `${diffDays} days ago`
      if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
      if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`
      return `${Math.ceil(diffDays / 365)} years ago`
    },

    onPageChange(page) {
      this.currentPage = page
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.shared-with-me {
  // Component container
}

.page-header {
  text-align: center;
  margin-bottom: 48px;

  h1 {
    font-size: 32px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 12px 0;
  }

  .subtitle {
    font-size: 16px;
    color: theme.$gray_4;
    margin: 0;
  }
}

.section {
  margin-bottom: 64px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-header {
  margin-bottom: 32px;

  h2 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .section-description {
    font-size: 14px;
    color: theme.$gray_4;
    margin: 0;
    max-width: 600px;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  color: theme.$gray_4;

  p {
    margin-top: 16px;
    font-size: 14px;
  }
}

.empty-state {
  padding: 16px 24px;

  .empty-state-content {
    text-align: center;

    h3 {
      font-size: 18px;
      font-weight: 300;
      color: theme.$gray_5;
      margin: 16px 0 8px 0;
    }

    p {
      font-size: 14px;
      color: theme.$gray_4;
      margin: 0;
    }
  }
}

.workspace-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.workspace-card {
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  cursor: pointer;
  //transition: all 0.2s ease;

  &:hover {
    border-color: theme.$purple_2;
    //box-shadow: 0 4px 12px rgba(77, 98, 140, 0.15);
    //transform: translateY(-1px);

    .workspace-arrow {
      //transform: translateX(4px);
    }
  }
}

.workspace-card-content {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.workspace-icon {
  color: theme.$purple_2;
  flex-shrink: 0;
}

.workspace-info {
  flex: 1;
  min-width: 0;
}

.workspace-name {
  font-size: 16px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workspace-role {
  font-size: 12px;
  font-weight: 600;
  color: theme.$purple_2;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px 0;
}

.workspace-description {
  font-size: 14px;
  color: theme.$gray_4;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.workspace-arrow {
  color: theme.$gray_4;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.dataset-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.dataset-search {
  flex: 1;
  max-width: 400px;

  @media (max-width: 768px) {
    max-width: none;
  }
}

.dataset-search-input {
  .el-input__inner {
    height: 40px;
    border-radius: 8px;
  }
}

.dataset-count {
  font-size: 14px;
  color: theme.$gray_4;
  white-space: nowrap;
}

.dataset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.dataset-card {
  background: theme.$white;
  border: 1px solid theme.$gray_2;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: theme.$gray_3;
    background: theme.$gray_1;

    .dataset-arrow {
      transform: translateX(4px);
    }
  }
}

.dataset-card-content {
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.dataset-icon {
  color: theme.$purple_2;
  flex-shrink: 0;
  margin-top: 2px;
}

.dataset-info {
  flex: 1;
  min-width: 0;
}

.dataset-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.dataset-name {
  font-size: 16px;
  font-weight: 500;
  color: theme.$gray_6;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.dataset-status-tag {
  background: theme.$gray_1;
  color: theme.$gray_5;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px;
  white-space: nowrap;
  flex-shrink: 0;
  
}

.dataset-org {
  font-size: 12px;
  font-weight: 600;
  color: theme.$purple_2;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px 0;
}

.dataset-description {
  font-size: 14px;
  color: theme.$gray_4;
  margin: 0 0 12px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dataset-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: theme.$gray_4;

  @media (max-width: 480px) {
    flex-direction: column;
    gap: 4px;
  }
}

.dataset-arrow {
  color: theme.$gray_4;
  transition: transform 0.2s ease;
  flex-shrink: 0;
  margin-top: 2px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}
</style>