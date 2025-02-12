<template>
  <bf-stage>
    <div
      v-if="showManifests"
      class="bf-table"
    >
      <div class="bf-table-header">
        <el-row
          type="flex"
          align="middle"
          :gutter="1"
        >
          <el-col
            :sm="1"
            class="info"
          >
          </el-col>
          <el-col
            :sm="4"
            class="info"
          >
            Creator
          </el-col>
          <el-col
            :sm="10"
          >
            Manifest ID
          </el-col>
          <el-col
            :sm="4"
          >
            Date Created
          </el-col>
          <el-col
            :sm="2"
          >
            Status
          </el-col>
          <el-col
            :sm="3"
            :pull="2"
            class="menu"
          />
        </el-row>
      </div>
      <div>
        <upload-manifest
          v-for="manifest in this.sortedManifests"
          :key="manifest.id"
          class="bf-table-row"
          :item="manifest"
        />
      </div>
    </div>
    <bf-empty-page-state
      v-else
      class="empty"
    >
      <div v-if="isLoadingManifestsActivity">
        <div
          v-loading="true"
        />
      </div>
      <div v-else>
        <img
          src="/src/assets/images/illustrations/illo-add-files.svg"
          height="240"
          width="247"
          alt="Add Files illustration"
        >
        <div
          class="copy"
        >
          <h2>There are no upload manifests yet.</h2>
          <p>Upload manifests are created as part of the data upload workflow on Pennsieve.</p>
        </div>
      </div>

    </bf-empty-page-state>
  </bf-stage>
</template>

<script>
import { mapActions, mapState, mapGetters } from 'vuex'
import Cookies from 'js-cookie'
import { DATASET_ACTIVITY_ALL_CATEGORIES, DATASET_ACTIVITY_ALL_CONTRIBUTORS, DATASET_ACTIVITY_DATE_RANGE_30 } from '../../../utils/constants'

import DatasetActivityPanel from './DatasetActivityPanel/DatasetActivityPanel.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue'
import BfRafter from '../../shared/bf-rafter/BfRafter.vue'
import FilterMenu from '../../shared/FilterMenu/FilterMenu.vue'

import Request from '../../../mixins/request'
import Sorter from '../../../mixins/sorter'
import PaginationPageMenu from "../../shared/PaginationPageMenu/PaginationPageMenu.vue";
import UploadManifest from "./UploadManifest/UploadManifest.vue";
import BfStage from "../../layout/BfStage/BfStage.vue";
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'DatasetManifests',

  components: {
    BfStage,
    UploadManifest,
    BfButton,
    BfEmptyPageState,
    BfRafter,
    FilterMenu,
    DatasetActivityPanel,
    PaginationPageMenu
  },

  mixins: [
    Request,
    Sorter
  ],

  data() {
    return {
    }
  },

  computed: {
    ...mapGetters([
      'activeOrganization',
      'orgMembers',
      'config',
      'hasFeature',
      'profile'
    ]),

    ...mapState('datasetModule', [
      'datasetManifests',
      'isLoadingManifestsActivity'
    ]),

    ...mapGetters([
      'getOrgMembersById'
    ]),

    showManifests: function() {
      return this.datasetManifests && this.datasetManifests.length > 0
    },

    sortedManifests: function() {
      return this.datasetManifests.sort(function Comparator(a, b) {
        if (a.date_created < b.date_created) return 1;
        if (a.date_created > b.date_created) return -1;
        return 0;
      });
    },

    sortAnns: function(annArray) {
      annArray.sort(function Comparator(a, b) {
        if (a.start < b.start) return -1;
        if (a.start > b.start) return 1;
        return 0;
      });
    },

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
    getDatasetUsersUrl: async function() {
      useGetToken()
        .then((token) => {
          const datasetId = this.$route.params.datasetId
          return  `${this.config.apiUrl}/datasets/${datasetId}/collaborators/users?api_key=${token}`
        })
    },

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

  watch: {
    getDatasetUsersUrl: {
      handler: function() {
        this.getDatasetUsers()
      },
      immediate: true
    }
  },

  mounted () {
    this.fetchDatasetManifests()
  },

  methods: {
    ...mapActions('datasetModule', [
      'updateDatasetActivityCategory',
      'updateDatasetActivityUserId',
      'updateDatasetActivityDateRange',
      'updateDatasetActivityOrderDirection',
      'fetchDatasetActivity',
      'clearDatasetActivityState',
      'fetchDatasetManifests'
    ]),

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
      this.getDatasetUsersUrl
        .then((url) => {
          this.sendXhr(url)
            .then(datasetUsers => {
              this.datasetUsers = datasetUsers
            })
            .catch(() => {
              this.datasetUsers = []
            })
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
///deep/ .bf-stage-content {
//  display: flex;
//  flex-direction: column;
//}
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
.load-more {

}
</style>
