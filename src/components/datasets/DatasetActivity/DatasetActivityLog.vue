<template>
  <bf-stage>
    <div>
      <div class="activity-list-controls mb-16">
        <div class="activity-list-controls-menus">
          <filter-menu
            class="mr-24"
            :options="datasetDateRangeOptions"
            :selected-option="datasetActivityParams.dateRange"
            @select="updateDatasetActivityDateRange"
          />

          <filter-menu
            class="mr-24"
            :options="datasetCategoryOptions"
            :selected-option="datasetActivityParams.category"
            @select="updateDatasetActivityCategory"
          />

          <filter-menu
            class="mr-24"
            :options="datasetContributorOptions"
            :selected-option="datasetActivityParams.userId"
            @select="updateDatasetActivityUserId"
          />
        </div>
      </div>

      <div
        v-loading="isLoadingDatasetActivity"
        class="dataset-activity-wrap"
      >
        <div v-if="hasDatasetActivity">
          <dataset-activity-panel
            v-for="(evt, idx) in datasetActivity"
            :key="evt.timeRange.start+evt.timeRange.end"
            :event="evt"
            :previous-event="datasetActivity[idx-1]"
          />

          <div
            v-if="datasetActivityParams.cursor"
            class="btn-load-more-wrap"
          >
            <bf-button
              :processing="isLoadingDatasetActivity"
              processing-text="Loading More"
              @click="fetchDatasetActivity"
            >
              Load more
            </bf-button>
          </div>
        </div>

        <bf-empty-page-state
          v-if="!this.hasDatasetActivity"
          class="no-results-found-wrapper"
        >
          <img
            src="/src/assets/images/illustrations/spot-illos_no-recent-changes_dataset-activity.svg"
            height="80"
            width="107"
            alt="Illustration depicting no recent dataset activity"
          >
          <h2>No recent dataset activity</h2>
          <p>
            There have been no changes in the last 12 months
            <template v-if="isDownloadEnabled">
              <br> For a detailed history of this dataset,
              <a
                href="#"
                @click.prevent=""
              >
                download the activity log
              </a>
            </template>
          </p>
        </bf-empty-page-state>
      </div>
    </div>
  </bf-stage>

</template>

<script>
import { mapActions, mapState, mapGetters } from 'vuex'
import { DATASET_ACTIVITY_ALL_CATEGORIES,
  DATASET_ACTIVITY_ALL_CONTRIBUTORS,
  DATASET_ACTIVITY_DATE_RANGE_30,
  DATASET_ACTIVITY_DATE_RANGE_90,
  DATASET_ACTIVITY_DATE_RANGE_YEAR,
  DATASET_ACTIVITY_DATE_RANGE_2_YEAR,
  DATASET_ACTIVITY_DATE_RANGE_ALL
} from '../../../utils/constants'

import DatasetActivityPanel from './DatasetActivityPanel/DatasetActivityPanel.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue'
import FilterMenu from '../../shared/FilterMenu/FilterMenu.vue'

import Request from '../../../mixins/request'
import Sorter from '../../../mixins/sorter'
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'DatasetActivityLog',

  components: {
    BfButton,
    BfEmptyPageState,
    FilterMenu,
    DatasetActivityPanel
  },

  props: {
    orgId: {
      type: String,
      default: ''
    }
  },

  mixins: [
    Request,
    Sorter
  ],

  data() {
    return {
      isDownloadEnabled: false,
      datasetCategoryOptions: [
        {
          value: 'DATASET',
          label: 'Dataset Metadata',
        },
        {
          value: 'PACKAGES',
          label: 'Files',
        },
        {
          value: 'PERMISSIONS',
          label: 'Permissions',
        },
        {
          value: 'PUBLISHING',
          label: 'Publishing',
        },
        {
          value: 'MODELS_AND_RECORDS',
          label: 'Records/Models',
        },
        DATASET_ACTIVITY_ALL_CATEGORIES
      ],
      datasetDateRangeOptions: [
        DATASET_ACTIVITY_DATE_RANGE_30,
        DATASET_ACTIVITY_DATE_RANGE_90,
        DATASET_ACTIVITY_DATE_RANGE_YEAR,
        DATASET_ACTIVITY_DATE_RANGE_2_YEAR,
        DATASET_ACTIVITY_DATE_RANGE_ALL
      ],
      datasetUsers: []
    }
  },

  computed: {
    ...mapState([
      'orgMembers',
      'dataset',
      'config',
    ]),

    ...mapGetters('datasetModule', [
      'datasetActivity',
      'datasetActivityParams',
      'isLoadingDatasetActivity'
    ]),

    ...mapGetters([
      'getOrgMembersById'
    ]),

    /**
     * Compute if there is dataset activity
     * @returns {Boolean}
     */
    hasDatasetActivity: function() {
      return this.datasetActivity.length > 0
    },

    /**
     * Compute dataset icon sort direction
     * @returns {String}
     */
    sortIconDirection: function () {
      return this.datasetActivityParams.orderDirection === 'Asc' ? 'up' : 'down'
    },

    /**
     * Compute get dataset users URL
     * @returns {String}
     */


    /**
     * Compute dataset contributors
     * Get list of users from orgMembers, this will include
     * the intId for the users, which is needed for the
     * timeline endpoint
     * @returns {Array}
     */
    datasetContributorOptions: function() {
      const userIds = this.datasetUsers.map((member) => {
        return member.id
      })

      const users = this.returnSort('lastName', this.getOrgMembersById(userIds), 'asc')
      const contributors = users.map((member) => {
        return {
          value: member.intId,
          label: `${member.firstName} ${member.lastName}`
        }
      })

      return [
        ...contributors,
        DATASET_ACTIVITY_ALL_CONTRIBUTORS
      ]
    }
  },



  mounted () {
    this.clearDatasetActivityState()
    this.fetchDatasetActivity()
    this.getDatasetUsers()
  },

  methods: {
    ...mapActions('datasetModule', [
      'updateDatasetActivityCategory',
      'updateDatasetActivityUserId',
      'updateDatasetActivityDateRange',
      'updateDatasetActivityOrderDirection',
      'fetchDatasetActivity',
      'clearDatasetActivityState'
    ]),

    getDatasetUsersUrl: async function() {
      return useGetToken()
        .then((token) => {
          const datasetId = this.$route.params.datasetId
          return  `${this.config.apiUrl}/datasets/${datasetId}/collaborators/users?api_key=${token}`
        })
    },

    /**
     * Set sort direction
     */
    setSortDir: function () {
      const orderDirection = this.datasetActivityParams.orderDirection === 'Asc'
        ? 'Desc'
        : 'Asc'

      this.updateDatasetActivityOrderDirection(orderDirection)
    },

    /**
     * Get users with permissions to this dataset
     */
    getDatasetUsers: function() {
      this.getDatasetUsersUrl().then((url) => {
        this.sendXhr(url)
          .then((response) => {
            this.datasetUsers = response
          })
      })
        .catch(() => {
        this.datasetUsers = []
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.activity-list-controls {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.activity-list-controls-menus {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  .el-dropdown {
    flex-shrink: 0
  }
}
.dataset-activity {
  background: #fff;
}

.dataset-activity-wrap {
  flex: 1;
}
.btn-load-more-wrap {
  display: flex;
  justify-content: center;;
  margin-top: 32px;
}
.dataset-activity-panel {
  margin-bottom: 16px;
  &:not(:first-child).date-grouped {
    margin-top: 56px;
  }
}
</style>
