<template>
  <div class="usage-analytics-view">
    <div class="analytics-header">
      <h3>Organization Data Usage</h3>
      <p class="analytics-description">
        Monitor your workspace's storage consumption and activity metrics.
      </p>
    </div>

    <div class="metrics-grid">
      <div class="metric-card storage-card">
        <div class="metric-header">
          <h4>Storage Used</h4>
          <div class="metric-icon">
            📊
          </div>
        </div>
        <div class="metric-value">
          <span class="number">{{ storageNumber }}</span>
          <span class="unit">{{ storageUnit }}</span>
        </div>
        <div class="metric-details">
          <p class="metric-subtitle">Total workspace storage</p>
        </div>
      </div>

      <div class="metric-card datasets-card">
        <div class="metric-header">
          <h4>Active Datasets</h4>
          <div class="metric-icon">
            📁
          </div>
        </div>
        <div class="metric-value">
          <span class="number">{{ datasetCount }}</span>
          <span class="unit">datasets</span>
        </div>
        <div class="metric-details">
          <p class="metric-subtitle">Currently in workspace</p>
        </div>
      </div>

      <div class="metric-card members-card">
        <div class="metric-header">
          <h4>Team Members</h4>
          <div class="metric-icon">
            👥
          </div>
        </div>
        <div class="metric-value">
          <span class="number">{{ memberCount }}</span>
          <span class="unit">members</span>
        </div>
        <div class="metric-details">
          <p class="metric-subtitle">Active workspace users</p>
        </div>
      </div>
    </div>

<!--    <div class="usage-chart-section">-->
<!--      <div class="chart-header">-->
<!--        <h4>Storage Breakdown</h4>-->
<!--        <p class="chart-description">-->
<!--          Detailed view of how your storage quota is being utilized.-->
<!--        </p>-->
<!--      </div>-->
<!--      -->
<!--      <div class="chart-placeholder">-->
<!--        <div class="placeholder-content">-->
<!--          <div class="placeholder-icon">📈</div>-->
<!--          <p>Detailed analytics charts coming soon</p>-->
<!--          <p class="placeholder-subtitle">-->
<!--            Track usage trends, growth patterns, and resource optimization recommendations.-->
<!--          </p>-->
<!--        </div>-->
<!--      </div>-->
<!--    </div>-->

<!--    <div class="usage-tips">-->
<!--      <div class="tips-header">-->
<!--        <h4>💡 Usage Tips</h4>-->
<!--      </div>-->
<!--      <div class="tips-content">-->
<!--        <ul>-->
<!--          <li>-->
<!--            <strong>Archive old datasets:</strong> Move inactive datasets to external storage to free up space-->
<!--          </li>-->
<!--          <li>-->
<!--            <strong>Optimize file formats:</strong> Use compressed formats where possible to reduce storage-->
<!--          </li>-->
<!--          <li>-->
<!--            <strong>Regular cleanup:</strong> Remove duplicate files and temporary analysis results-->
<!--          </li>-->
<!--          <li>-->
<!--            <strong>Monitor growth:</strong> Set up alerts for when storage usage reaches certain thresholds-->
<!--          </li>-->
<!--        </ul>-->
<!--      </div>-->
<!--    </div>-->
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import { pathOr, head, last, defaultTo } from 'ramda'
import BfStorageMetricsMixin from '../../../mixins/bf-storage-metrics'

export default {
  name: 'UsageAnalyticsView',

  mixins: [BfStorageMetricsMixin],

  data() {
    return {
      storageNumber: 0,
      storageUnit: 'B',
      totalDatasetCount: 0,
      isLoadingDatasets: false
    }
  },

  computed: {
    ...mapState([
      'activeOrganization',
      'datasets',
      'orgMembers'
    ]),

    datasetCount() {
      return this.totalDatasetCount || (this.datasets ? this.datasets.length : 0)
    },

    memberCount() {
      return this.orgMembers ? this.orgMembers.length : 0
    }
  },

  watch: {
    activeOrganization: {
      handler(activeOrg) {
        this.handleGetOrg(activeOrg)
        this.fetchDatasetCount()
      },
      immediate: true
    }
  },

  methods: {
    handleGetOrg(org) {
      const storage = pathOr(0, ['organization', 'storage'], org)
      let formattedStorage = this.formatMetric(storage).split(' ')
      
      if (!head(formattedStorage).match(/\d/)) {
        formattedStorage = [0, 'B']
      }
      
      this.storageNumber = defaultTo(0, head(formattedStorage))
      this.storageUnit = defaultTo('B', last(formattedStorage))
    },

    async fetchDatasetCount() {
      if (!this.activeOrganization) return

      this.isLoadingDatasets = true
      try {
        // Get datasets API URL
        const orgId = pathOr('', ['organization', 'id'], this.activeOrganization)
        const token = await this.$getToken()
        
        // Fetch datasets with a large limit to get total count
        const url = `${this.$store.state.config.apiUrl}/datasets?api_key=${token}&limit=10000&offset=0`
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        this.totalDatasetCount = data.length || 0
      } catch (error) {
        console.error('Error fetching dataset count:', error)
        // Fallback to current datasets length if available
        this.totalDatasetCount = this.datasets ? this.datasets.length : 0
      } finally {
        this.isLoadingDatasets = false
      }
    }
  }
}
</script>

<style scoped lang="scss">
@use '../../../styles/_theme.scss';

.usage-analytics-view {
  max-width: 700px;
}

.analytics-header {
  margin-bottom: 32px;

  h3 {
    font-size: 20px;
    font-weight: 500;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .analytics-description {
    font-size: 14px;
    color: theme.$gray_5;
    margin: 0;
    line-height: 1.5;
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 40px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.metric-card {
  background: white;
  border: 1px solid theme.$gray_2;
  //border-radius: 8px;
  padding: 20px;
  
  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h4 {
      font-size: 14px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-icon {
      font-size: 20px;
    }
  }

  .metric-value {
    margin-bottom: 8px;

    .number {
      font-size: 32px;
      font-weight: 600;
      color: theme.$gray_6;
      line-height: 1;
    }

    .unit {
      font-size: 14px;
      color: theme.$gray_4;
      text-transform: uppercase;
      margin-left: 8px;
      font-weight: 500;
    }
  }

  .metric-details {
    .metric-subtitle {
      font-size: 12px;
      color: theme.$gray_4;
      margin: 0;
    }
  }

  &.storage-card {
    border-left: 4px solid theme.$green_1;
  }

  &.datasets-card {
    border-left: 4px solid theme.$purple_2;
  }

  &.members-card {
    border-left: 4px solid theme.$teal_1;
  }
}

.usage-chart-section {
  margin-bottom: 40px;

  .chart-header {
    margin-bottom: 20px;

    h4 {
      font-size: 18px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0 0 8px 0;
    }

    .chart-description {
      font-size: 14px;
      color: theme.$gray_5;
      margin: 0;
    }
  }

  .chart-placeholder {
    background: theme.$gray_1;
    border: 2px dashed theme.$gray_3;
    border-radius: 8px;
    padding: 60px 40px;
    text-align: center;

    .placeholder-content {
      .placeholder-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      p {
        color: theme.$gray_5;
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 500;

        &.placeholder-subtitle {
          font-size: 14px;
          font-weight: 400;
        }
      }
    }
  }
}

.usage-tips {
  background: theme.$gray_1;
  border-radius: 8px;
  padding: 24px;

  .tips-header {
    margin-bottom: 16px;

    h4 {
      font-size: 16px;
      font-weight: 500;
      color: theme.$gray_6;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .tips-content {
    ul {
      margin: 0;
      padding-left: 20px;

      li {
        font-size: 14px;
        color: theme.$gray_5;
        line-height: 1.6;
        margin-bottom: 12px;

        &:last-child {
          margin-bottom: 0;
        }

        strong {
          color: theme.$gray_6;
        }
      }
    }
  }
}
</style>