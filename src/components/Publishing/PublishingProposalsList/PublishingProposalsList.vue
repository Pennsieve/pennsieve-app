<template>
  <bf-stage>
    <template #actions>
      <div class="actions-wrapper">
        <form
          class="mb-8 dataset-search-form"
          @submit.prevent
        >
          <el-input
            ref="input"
            v-model="searchQuery"
            class="dataset-search-input icon-prefix"
            placeholder="Find proposals"
            clearable
          >
            <template #prefix>
              <IconMagnifyingGlass
                :height="24"
                :width="24"
                color="#71747c"
              />
            </template>
          </el-input>
        </form>

        <div class="status-filter">
          <label class="status-filter-label">Showing</label>
          <el-select
            v-model="statusFilter"
            @change="onStatusFilterChange"
          >
            <el-option
              v-for="option in reviewStatuses"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
      </div>
    </template>

    <div>
      <p
      v-if="hasProposals"
      class="mb-24"
    >
      {{ searchHeading }}
    </p>

    <div class="dataset-list-controls mb-16">
      <div class="dataset-list-controls-menus">
        <pagination-page-menu
          class="mr-24"
          pagination-item-label="Datasets"
          :page-size="publishingSearchParams.limit"
          @update-page-size="onPageLimitChange"
        />

        <dataset-sort-menu
          class="mr-24"
          :order-by="publishingSearchParams.orderBy"
          @select="onDatasetSortSelect"
        />

        <button
          class="button-icon small icon-sort"
          @click="setSortDir"
        >
          <IconSort
            :class="[ sortIconDirection === 'down' ? 'svg-flip' : '' ]"
            color="currentColor"
            :dir="sortIconDirection"
            :height="20"
            :width="20"
          />
        </button>
      </div>

      <el-pagination
        :page-size="publishingSearchParams.limit"
        :pager-count="5"
        :current-page="curPage"
        layout="prev, pager, next"
        :total="matchingProposals.length"
        @current-change="onPaginationPageChange"
      />
    </div>
    <div
      v-loading="isLoadingDatasets"
      element-loading-background="#FBFBFD"
    >
      <div
        v-if="hasProposals && isLoadingDatasetsError === false"
        class="dataset-list-item-wrap"
      >
        <publishing-proposals-list-item
          v-for="proposal in visibleProposals"
          :key="proposal.nodeId"
          :proposal="proposal"
          @view="viewProposal"
          @accept="acceptDatasetProposalRequest"
          @reject="rejectDatasetProposalRequest"
        />
      </div>


      <bf-empty-page-state v-if="!hasProposals">
        {{ emptyStateMessage }}
      </bf-empty-page-state>

      <request-survey
        :dialog-visible="requestModalVisible"
        :proposal="selectedRequest"
        :repository="selectedRepository"
        :read-only="true"
        :show-review-actions="canReviewSelected"
        @accept="acceptDatasetProposalRequest"
        @reject="rejectDatasetProposalRequest"
        @close="closeProposalDialog"
      />

      <confirmation-dialog
        :dialog-visible="confirmationDialogVisible"
        :action="confirmationDialog.action"
        :action-message="confirmationDialog.actionMessage"
        :resource="confirmationDialog.resource"
        :info-message="confirmationDialog.infoMessage"
        :warning-message="confirmationDialog.warningMessage"
        :acknowledgements="confirmationDialog.acknowledgements"
        :confirm-action-label="confirmationDialog.confirmActionLabel"
        :cancel-action-label="confirmationDialog.cancelActionLabel"
        @close="confirmationDialogVisible = false"
        @confirmed="confirmedAction"
      />

    </div>
    </div>
  </bf-stage>
</template>

<script>
import {mapActions, mapGetters, mapState} from "vuex";
import { computed } from 'vue'
import { useProposalStore } from '@/stores/proposalStore'
import BfEmptyPageState from '../../shared/bf-empty-page-state/BfEmptyPageState.vue';
import PublishingProposalsListItem from "./PublishingProposalsListItem.vue";
import DatasetSortMenu from '../../datasets/DatasetSortMenu/DatasetSortMenu.vue'
import PaginationPageMenu from '../../shared/PaginationPageMenu/PaginationPageMenu.vue'
import RequestSurvey from "../../user/publishing/ProposalSurvey.vue";
import ConfirmationDialog from "../../shared/ConfirmationDialog/ConfirmationDialog.vue";
import IconMagnifyingGlass from "../../icons/IconMagnifyingGlass.vue";
import IconSort from "../../icons/IconSort.vue";
import EventBus from "../../../utils/event-bus";
import { ProposalStatus, ProposalReviewStatuses } from "../../../utils/constants";

export default {
  name: 'PublishingProposalsList',

  components: {
    IconSort,
    IconMagnifyingGlass,
    BfEmptyPageState,
    PublishingProposalsListItem,
    DatasetSortMenu,
    PaginationPageMenu,
    RequestSurvey,
    ConfirmationDialog
  },

  setup() {
    const proposalStore = useProposalStore()
    
    const requestModalVisible = computed(() => proposalStore.requestModalVisible)
    const getRepositoryByNodeId = computed(() => proposalStore.getRepositoryByNodeId)
    
    return {
      proposalStore,
      requestModalVisible,
      getRepositoryByNodeId
    }
  },

  props: {
    publicationStatus: {
      type: Array,
      default: () => {
        return ['requested']
      },
    }
  },

  beforeRouteEnter: function(to, from, next) {
    next(vm => {
      vm.getInitialData()
    })
  },

  watch: {
    // Otherwise a query that shortens the list leaves the user on a page that
    // no longer has any results on it
    searchQuery: function() {
      if (this.publishingSearchParams.offset !== 0) {
        this.updatePublishingOffset(0)
      }
    },
  },

  data() {
    return {
      isLoadingDatasetsError: false,
      searchQuery: '',
      statusFilter: ProposalStatus.SUBMITTED,
      selectedRequest: null,
      selectedRepository: {},
      confirmationDialogVisible: false,
      confirmationDialog: {
        action: '',
        actionMessage: '',
        resource: {},
        infoMessage: '',
        warningMessage: '',
        acknowledgements: [],
        confirmActionLabel: '',
        cancelActionLabel: '',
      },
    }
  },

  computed: {
    ...mapState('publishingModule', [
      'publishingSearchParams',
      'isLoadingDatasets'
    ]),

    ...mapGetters([
      'isUserPublisher'
    ]),

    ...mapGetters('publishingModule', [
      'getDatasets'
    ]),


    proposals: function() {
      return this.getDatasets(this.$route.name) || []
    },

    /**
     * The endpoint returns every proposal for the status in one response and
     * reports totalCount as the length of that list, so searching, sorting and
     * paging all happen here rather than in query parameters.
     */
    matchingProposals: function() {
      const query = this.searchQuery.trim().toLowerCase()

      const matches = query
        ? this.proposals.filter(proposal => {
            return [proposal.name, proposal.ownerName, proposal.emailAddress]
              .some(field => (field || '').toLowerCase().includes(query))
          })
        : [...this.proposals]

      const direction = this.publishingSearchParams.orderDirection === 'Asc' ? 1 : -1

      if (this.publishingSearchParams.orderBy === 'Name') {
        return matches.sort((a, b) => {
          return direction * (a.name || '').localeCompare(b.name || '', 'en', { numeric: true })
        })
      }

      // The sort menu is shared with the dataset tabs, so it also offers
      // accession number, which proposals do not have. Sort by date for
      // anything that isn't a name.
      const field = this.publishingSearchParams.orderBy === 'UpdatedAt'
        ? 'updatedAt'
        : 'submittedAt'

      return matches.sort((a, b) => {
        return direction * ((a[field] || a.updatedAt || 0) - (b[field] || b.updatedAt || 0))
      })
    },

    visibleProposals: function() {
      const offset = this.publishingSearchParams.offset
      return this.matchingProposals.slice(offset, offset + this.publishingSearchParams.limit)
    },

    hasProposals: function() {
      return this.visibleProposals.length > 0
    },

    reviewStatuses: function() {
      return ProposalReviewStatuses
    },

    // A proposal that has already been accepted or rejected is read-only
    canReviewSelected: function() {
      return Boolean(
        this.isUserPublisher &&
        this.selectedRequest &&
        this.selectedRequest.proposalStatus === ProposalStatus.SUBMITTED
      )
    },

    emptyStateMessage: function() {
      if (this.searchQuery.trim()) {
        return `No proposals match “${this.searchQuery.trim()}”`
      }
      const status = ProposalReviewStatuses
        .find(option => option.value === this.statusFilter)
      return status && status.value !== ProposalStatus.SUBMITTED
        ? `No ${status.label.toLowerCase()} dataset proposals`
        : 'No dataset proposals awaiting review'
    },

    /**
     * Compute the search heading
     * @returns {String}
     */
    searchHeading: function () {
      const total = this.matchingProposals.length
      const start = this.publishingSearchParams.offset + 1
      const pageRange = this.publishingSearchParams.limit * this.curPage
      const end = pageRange < total ? pageRange : total
      const query = this.searchQuery.trim()

      const searchHeading = `Displaying ${start}-${end} of ${total} results`

      return query === ''
        ? searchHeading
        : `${searchHeading} for “${query}”`
    },

    /**
     * Compute dataset icon sort direction
     * @returns {String}
     */
    sortIconDirection: function () {
      return this.publishingSearchParams.orderDirection === 'Asc' ? 'up' : 'down'
    },

    /**
     * Compute current page
     * @returns {Number}
     */
    curPage: function () {
      return this.publishingSearchParams.offset / this.publishingSearchParams.limit + 1
    },
  },

  methods: {
    ...mapActions('publishingModule', [
      'clearSearchParams',
      'fetchDatasetProposals',
      'updatePublishingSearchLimit',
      'updatePublishingSearchOrderBy',
      'updatePublishingSearchOrderDirection',
      'updatePublishingOffset'
    ]),

    getInitialData: function(){
      this.clearSearchParams()
        .then(() => {
          this.proposalStore.fetchRepositories()
          this.fetchDatasetProposals(this.statusFilter)
        })
    },

    /**
     * Switching status is a refetch; searching, sorting and paging are not.
     */
    onStatusFilterChange: function() {
      this.updatePublishingOffset(0)
      this.fetchDatasetProposals(this.statusFilter)
    },

    /**
     * Update the page limit
     * @param {Number} pageSize
     */
    onPageLimitChange: function(pageSize) {
      this.updatePublishingSearchLimit(pageSize)
    },

    /**
     * Update dataset sort
     * @param {Object} selection
     */
    onDatasetSortSelect: function(selection) {
      this.updatePublishingSearchOrderBy(selection.value)
    },

    /**
     * Set sort direction
     */
    setSortDir: function() {
      const orderDirection = this.publishingSearchParams.orderDirection === 'Asc'
        ? 'Desc'
        : 'Asc'

      this.updatePublishingSearchOrderDirection(orderDirection)
    },

    /**
     * Update offset
     * @param {Number} page
     */
    onPaginationPageChange: function(page) {
      const offset = (page - 1) * this.publishingSearchParams.limit
      this.updatePublishingOffset(offset)
    },

    viewProposal: function(proposal) {
      if (!proposal) {
        return
      }
      // set selected proposal
      this.selectedRequest = proposal
      this.proposalStore.setSelectedProposal(proposal)

      // set selected repo, so the repository questions render alongside
      // the submitted survey responses
      this.selectedRepository = proposal.organizationNodeId
        ? this.getRepositoryByNodeId(proposal.organizationNodeId)
        : {}
      this.proposalStore.setSelectedRepo(this.selectedRepository)

      // enable modal visibility
      this.proposalStore.updateRequestModalVisible(true)
    },

    closeProposalDialog: function() {
      this.proposalStore.updateRequestModalVisible(false)
      this.selectedRequest = null
      this.selectedRepository = {}
    },

    resetConfirmation: function() {
      this.confirmationDialogVisible = false
      this.confirmationDialog = {
        action: '',
        actionMessage: '',
        resource: {},
        infoMessage: '',
        warningMessage: '',
        acknowledgements: [],
        confirmActionLabel: '',
        cancelActionLabel: '',
      }
    },

    confirmedAction: async function(event) {
      this.closeProposalDialog()
      const { action, resource } = event
      this.resetConfirmation()
      if (!action || !resource) {
        return
      }

      try {
        switch (action) {
          case "accept":
            await this.acceptDatasetProposal(resource)
            EventBus.$emit('toast', {
              detail: {
                type: 'success',
                msg: `"${resource.name}" has been accepted.`
              }
            })
            break;
          case "reject":
            await this.rejectDatasetProposal(resource)
            EventBus.$emit('toast', {
              detail: {
                type: 'success',
                msg: `"${resource.name}" has been rejected.`
              }
            })
            break;
        }
      } catch (err) {
        console.error(err)
        EventBus.$emit('toast', {
          detail: {
            type: 'error',
            msg: `Failed to ${action} "${resource.name}". Please try again.`
          }
        })
      }
    },

    acceptDatasetProposalRequest: function(proposal) {
      // raise Confirmation Dialog
      this.closeProposalDialog()
      this.resetConfirmation()
      this.confirmationDialog = {
        action: 'accept',
        actionMessage: `Accept Dataset Proposal: "${proposal.name}"?`,
        resource: proposal,
        warningMessage: 'This will accept the Dataset Proposal.',
        confirmActionLabel: 'Accept',
        cancelActionLabel: 'Cancel',
      }
      this.confirmationDialogVisible = true
    },

    acceptDatasetProposal: async function(proposal) {
      await this.proposalStore.acceptProposal(proposal)
      await this.refreshProposals()
    },

    rejectDatasetProposalRequest: function(proposal) {
      // raise Confirmation Dialog
      this.closeProposalDialog()
      this.resetConfirmation()
      this.confirmationDialog = {
        action: 'reject',
        actionMessage: `Reject Dataset Proposal: "${proposal.name}"?`,
        resource: proposal,
        warningMessage: 'This will reject the Dataset Proposal.',
        confirmActionLabel: 'Reject',
        cancelActionLabel: 'Cancel',
      }
      this.confirmationDialogVisible = true
    },

    rejectDatasetProposal: async function(proposal) {
      await this.proposalStore.rejectProposal(proposal)
      await this.refreshProposals()
    },

    // Reloads the list; the same response also refreshes the "Proposed" tab count
    refreshProposals: async function() {
      await this.fetchDatasetProposals(this.statusFilter)
    },

  },
}
</script>
<style scoped lang="scss">
@use '../../../styles/theme';

.dataset-list-controls {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.dataset-list-controls-menus {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  .el-dropdown {
    flex-shrink: 0
  }
}
.dataset-search-form {
  max-width: 400px;
  width: 100%;
}
.actions-wrapper {
  display: flex;
  flex: 1;
  flex-direction: row;
  justify-content: space-between;

}
.status-filter {
  align-items: center;
  display: flex;
  gap: 8px;

  .status-filter-label {
    color: theme.$gray_4;
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  :deep(.el-select) {
    width: 180px;
  }
}
</style>
