<template>
  <bf-stage slot="stage">
  <div class="section">
    <div class="section-header">
      <p class="section-description">A list of datasets shared with you from workspaces other than those you're a member of. Although you don't have access to the full workspace, you can still interact with these specific datasets.</p>
    </div>

    <div v-if="isLoadingDatasets" class="loading-state" v-loading="isLoadingDatasets">
      <p>Loading datasets...</p>
    </div>

    <div v-else-if="guestDatasets.length === 0" class="empty-state">
      <div class="empty-state-content">
        <IconCompass :width="48" :height="48" color="#71747c" />
        <h3>No datasets available</h3>
        <p>You haven't been invited to any datasets outside your workspaces.</p>
      </div>
    </div>

    <div v-else class="dataset-list">
      <!-- Pagination Controls -->
      <div class="dataset-list-controls mb-8">
        <div class="dataset-list-controls-menus">
          <pagination-page-menu
            class="mr-24"
            pagination-item-label="Datasets"
            :page-size="pageSize"
            @update-page-size="updatePageSize"
          />
        </div>

        <el-pagination
          :page-size="pageSize"
          :pager-count="5"
          :current-page="currentPage"
          layout="prev, pager, next"
          :total="totalCount"
          @current-change="onPageChange"
        />
      </div>

      <div class="dataset-grid">
        <div
          v-for="dataset in filteredGuestDatasets"
          :key="dataset.content.id"
          class="dataset-card"
          @click="navigateToDataset(dataset)"
        >
          <div class="dataset-card-content">
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

      <div class="pagination-container">
        <el-pagination
          :page-size="pageSize"
          :current-page="currentPage"
          layout="prev, pager, next"
          :total="totalCount"
          @current-change="onPageChange"
        />
      </div>
    </div>
  </div>
  </bf-stage>
</template>

<script>
import BfStage from '@/components/layout/BfStage/BfStage.vue'
import IconArrowRight from '@/components/icons/IconArrowRight.vue'
import IconCompass from '@/components/icons/IconCompass.vue'
import PaginationPageMenu from '@/components/shared/PaginationPageMenu/PaginationPageMenu.vue'
import { useGetToken } from '@/composables/useGetToken'
import * as siteConfig from '@/site-config/site.json'

export default {
  name: 'SharedDatasets',

  components: {
    BfStage,
    IconArrowRight,
    IconCompass,
    PaginationPageMenu,
  },

  data() {
    return {
      isLoadingDatasets: false,
      guestDatasets: [],
      filteredGuestDatasets: [],
      currentPage: 1,
      pageSize: 20,
      totalCount: 0,
    }
  },

  mounted() {
    this.loadGuestDatasets()
  },

  methods: {
    async loadGuestDatasets() {
      this.isLoadingDatasets = true
      try {
        const token = await useGetToken()
        const offset = (this.currentPage - 1) * this.pageSize

        const response = await fetch(`${siteConfig.api2Url}/datasets/shared-datasets?limit=${this.pageSize}&offset=${offset}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch shared datasets: ${response.status}`)
        }

        const data = await response.json()

        this.guestDatasets = data.datasets || []
        this.filteredGuestDatasets = [...this.guestDatasets]
        this.totalCount = data.totalCount || data.datasets?.length || 0
      } catch (error) {
        console.error('Error loading guest datasets:', error)
        this.guestDatasets = []
        this.filteredGuestDatasets = []
        this.totalCount = 0
      } finally {
        this.isLoadingDatasets = false
      }
    },

    navigateToDataset(dataset) {
      const orgId = dataset.content.workspaceNodeId
      const datasetId = dataset.content.id
      this.$router.push({
        name: 'dataset-overview',
        params: { orgId, datasetId }
      })
    },

    getDatasetOrganization(dataset) {
      return dataset.content.workspaceName || 'Unknown Organization'
    },

    truncateDescription(description, maxLength = 120) {
      if (!description) return ''
      if (description.length <= maxLength) return description
      return description.substring(0, maxLength) + '...'
    },

    formatDatasetStatus(status) {
      if (!status || status === 'NO_STATUS') return 'No Status'
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
      this.loadGuestDatasets()
    },

    updatePageSize(newPageSize) {
      this.pageSize = newPageSize
      this.currentPage = 1
      this.loadGuestDatasets()
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.section {
  margin-bottom: 64px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-header {
  margin-bottom: 32px;

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

.dataset-list-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  margin-top: 24px;
}
</style>
