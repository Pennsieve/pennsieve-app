<template>
    <bf-stage
      slot="stage"
      element-loading-background="transparent"
    >
      <el-form
        ref="orgSettingsForm"
        label-position="top"
        :model="ruleForm"
        :rules="rules"
        @submit.native.prevent="updateOrg('orgSettingsForm')"
      >
        <el-form-item
          label="Organization Name"
          prop="orgName"
        >
          <el-input
            v-model="ruleForm.orgName"
            class="org-name"
            :disabled="!hasAdminRights"
          />
        </el-form-item>
        <bf-button
          v-if="hasAdminRights"
          @click="updateOrg('orgSettingsForm')"
        >
          Update
        </bf-button>
      </el-form>

      <div class="divider" />

      <div class="org-wrap">
        <h3>Dataset Statuses</h3>
        <p>Add custom statuses to new datasets based on your organization's unique workflow.</p>
        <div
          v-for="status in orgDatasetStatuses"
          :key="status.id"
          class="org-input-container"
        >
          <dataset-status-input
            :active-org-id="activeOrgId"
            :status="status"
            :created-new-status="createdNewStatus"
          />
        </div>
        <div class="buttons">
          <bf-button
            class="primary"
            :disabled="orgDatasetStatuses.length >= 20"
            @click="addStatus"
          >
            Add Status
          </bf-button>
        </div>

        <div class="divider" />

        <org-settings-data-use-agreements />

        <div class="divider" />
        <h3>Organization Data Usage</h3>
        <div class="storage-display-wrap">
          <div class="storage-display">
            <span class="number">
              {{ storageNumber }}
            </span>
            <span class="unit">
              {{ storageUnit }}
            </span>
          </div>
          <div class="storage-used">
            Storage Used
          </div>
        </div>
      </div>
    </bf-stage>

</template>

<script>
import {mapActions, mapGetters, mapState} from 'vuex'

import BfRafter from '../shared/bf-rafter/BfRafter.vue'
import BfButton from '../shared/bf-button/BfButton.vue'

import DatasetStatusInput from './DatasetStatusInput/DatasetStatusInput.vue'
import OrgSettingsDataUseAgreements from './OrgSettingsDataUseAgreements/OrgSettingsDataUseAgreements.vue'

import BfStorageMetricsMixin from '../../mixins/bf-storage-metrics'
import EventBus from '../../utils/event-bus'
import Sorter from '../../mixins/sorter'
import UserRoles from '../../mixins/user-roles'
import Request from '../../mixins/request'
import TableFunctions from '../../mixins/table-functions'

import {defaultTo, head, last, pathOr, propOr} from 'ramda'
import PaginationPageMenu from '../shared/PaginationPageMenu/PaginationPageMenu.vue'
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";

export default {
  name: 'OrgSettings',

  components: {
    BfRafter,
    BfButton,

    DatasetStatusInput,
    PaginationPageMenu,
    OrgSettingsDataUseAgreements
  },

  mixins: [BfStorageMetricsMixin, Sorter, UserRoles, Request, TableFunctions],

  data() {
    return {
      // allPeople: [],
      offset: 0,
      limit: 25,
      storageNumber: 0,
      storageUnit: 'B',
      ruleForm: {
        orgName: ''
      },
      rules: {
        orgName: [
          { required: true, message: 'Please provide a name', trigger: 'false' }
        ]
      },
      activeDatasetTemplate: {},
      createdNewStatus: false
    }
  },

  computed: {
    ...mapState([
      'activeOrganization',
      'config',
      'orgMembers',
      'datasets',
      'orgDatasetStatuses'
    ]),

    ...mapGetters(['hasFeature']),

    /**
     * Active organization id
     * @returns {String}
     */
    activeOrgId: function() {
      return pathOr('', ['organization', 'id'], this.activeOrganization)
    },


    hasAdminRights: function() {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, 'isAdmin', this.activeOrganization)
        const isOwner = propOr(false, 'isOwner', this.activeOrganization)
        return isAdmin || isOwner
      }

      return ''
    },

  },

  // needed for direct load
  watch: {
    activeOrganization: function(activeOrg) {
      this.handleGetOrg(activeOrg)
      this.getAllDatasetStatuses()

    },
  },

  // needed for switching routes
  mounted() {
    this.handleGetOrg(this.activeOrganization)
    this.getAllDatasetStatuses()
  },

  beforeRouteEnter(to, from, next) {
    next(vm => {
     if (vm.hasFeature('sandbox_org_feature')) {
      vm.$router.push({name: 'create-org'})
    }
    })
  },

  methods: {
    ...mapActions(['updateOrgDatasetStatuses']),


    /**
     * Get all dataset status options for organization
     */
    getAllDatasetStatuses: function() {
      useGetToken()
        .then(async token => {
          const url = `${this.config.apiUrl}/organizations/${this.activeOrgId}/dataset-status?api_key=${token}`
          return this.sendXhr(url,{})
            .then(response => {
              this.updateOrgDatasetStatuses(response)
            })
        })
        .catch(useHandleXhrError)
    },

    /**
     * Adds a new status to the list and updates list in vuex
     */
    addStatus: function() {
      const status = {
        displayName: '',
        color: '#71747C',
        placeholder: 'Enter status name...',
        isNew: true
      }
      this.updateOrgDatasetStatuses([...this.orgDatasetStatuses, status])
      this.createdNewStatus = true
    },

    /**
     * Successful organization update callback
     * @param {Object} org
     */
    handleGetOrg: function(org) {
      const storage = pathOr(0, ['organization', 'storage'], org)
      let formattedStorage = this.formatMetric(storage).split(' ')
      if (!head(formattedStorage).match(/\d/)) {
        formattedStorage = [0, 'B']
      }
      this.storageNumber = defaultTo(0, head(formattedStorage))
      this.storageUnit = defaultTo('B', last(formattedStorage))

      this.ruleForm.orgName = pathOr('', ['organization', 'name'], org)
    },
    /**
     * Handles key-pressed event
     */
    onHandleKeyPressed: function() {
      this.updateOrg('orgSettingsForm')
    },
    /**
     * Updates the organization
     * @param {String} formName
     */
    updateOrg: function(formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) {
          return
        }
        this.updateOrgRequest()
      })
    },
    /**
     * Update organization request
     */
    updateOrgRequest: function() {
      useGetToken()
        .then(token => {
          const url = `${this.config.apiUrl}/organizations/${this.activeOrganization.organization.id}?api_key=${token}`
          return useSendXhr(url, {
            method: 'PUT',
            body: {
              name: this.ruleForm.orgName
            }
          })
            .then(() => {
              EventBus.$emit('toast', {
                detail: {
                  type: 'MESSAGE',
                  msg: `${this.ruleForm.orgName} updated`
                }
              })
            })
        })
        .catch(useHandleXhrError)
    },
    /**
     * Makes call to resort table by column
     * @param {String} key
     */
    sortColumn: function(key) {
      this.offset = 0
      this.allPeople = this.returnSort(key, this.allPeople)
    },

    onDatasetTemplateMenuClick: function(name) {
      const options = {
        update: this.onUpdateDatasetTemplate,
        delete: this.onDeleteDatasetTemplate
      }

      const handler = options[name]

      if (typeof handler === 'function') {
        handler()
      }
    },

    /**
     * handle changing the page of results
     * @param {Number} page
     */
    onPaginationPageChange: function(page) {
      this.offset = (page - 1) * this.limit
    },

    /**
     * handle changing the number of results per page
     * @param {Number} limit
     */
    onUpdateLimit: function(limit) {
      this.offset = 0
      this.limit = limit
    }
  }
}
</script>

<style lang="scss" scoped>
@import '../../assets/variables.scss';

.org-name {
  max-width: 330px;
}

.org-wrap {
  p {
    margin-bottom: 28px;
  }
}

.buttons {
  margin-top: 32px;

  .primary {
    margin-right: 16px;
  }
}

::placeholder {
  font-style: italic;
}

.bf-menu {
  width: 202px;
  height: 99px;
  font-size: 14px;
  font-weight: normal;
  line-height: 32px;
  color: #000000;
  padding-top: 0;
}

.divider {
  background: $gray_2;
  height: 1px;
  margin: 50px 1px 40px 1px;
}
.storage-used {
  color: $gray_4;
  font-size: 12px;
  line-height: 14px;
}
.storage-display {
  line-height: 24px;
}
.storage-display .number {
  font-size: 28px;
}
.storage-display .unit {
  font-size: 12px;
  text-transform: uppercase;
  margin-left: 4px;
}
.storage-display-wrap {
  padding: 16px;
  background: $white;
  border: solid 1px $gray_2;
  border-radius: 5px;
  width: 296px;
  margin-bottom: 50px;
}
.col-spacer {
  height: 17px;
}
.dataset-templates {
  margin-top: 50px;
}
p {
  color: $gray_6;
  font-size: 14px;
  font-weight: normal;
  line-height: 18px;
}
.pagination-header {
  display: flex;
  justify-content: space-between
}
</style>
