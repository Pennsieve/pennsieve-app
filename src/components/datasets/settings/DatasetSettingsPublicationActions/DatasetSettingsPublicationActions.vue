<template>
  <div class="post-publication-actions">
    <div class="action-row">
      <div class="action-info">
        <strong>Withdraw from review</strong>
        <p>Cancel the current publication request.</p>
      </div>
      <bf-button
        class="secondary"
        :disabled="(!isRequested) || !getPermission('owner')"
        @click="onWithdrawDataset"
      >
        Withdraw
      </bf-button>
    </div>

    <div class="action-row">
      <div class="action-info">
        <strong>Request revision</strong>
        <p>
          Publish a revision that updates dataset information.
          <a href="https://docs.pennsieve.io/docs/submitting-a-revised-dataset-for-publication" target="_blank">
            Learn more
          </a>
        </p>
      </div>
      <bf-button
        class="secondary"
        :disabled="(isPreviouslyPublished && isPublicationRemoval) || isDraft || isRequested || datasetLocked"
        @click="onRequestRevision"
      >
        Request Revision
      </bf-button>
    </div>
    <withdraw-dataset-dialog
      :dialog-visible="withdrawDatasetDialogVisible"
      @on-withdraw="triggerRequest(PublicationStatus.CANCELLED, publicationType)"
      @on-close="onCloseWithdraw"
    />
    <!-- <request-removal-dialog
      :dialog-visible="requestRemovalDialogVisible"
      @on-removal="triggerRequest(PublicationStatus.REQUESTED, PublicationType.REMOVAL)"
      @close="onCloseRemoval"
    /> -->
    <request-revision-dialog
      :dialog-visible="requestRevisionDialogVisible"
      @on-revision="triggerRequest(PublicationStatus.REQUESTED, PublicationType.REVISION)"
      @close="onCloseRevision"
    />
  </div>
</template>

<script>
import BfButton from '../../../shared/bf-button/BfButton.vue'
import WithdrawDatasetDialog from '../DatasetSettingsPublicationActions/WithdrawDatasetDialog/WithdrawDatasetDialog.vue'
import RequestRevisionDialog from '../DatasetSettingsPublicationActions/RequestRevisionDialog/RequestRevisionDialog.vue'
import RequestRemovalDialog from '../DatasetSettingsPublicationActions/RequestRemovalDialog/RequestRemovalDialog.vue'
import Request from '../../../../mixins/request/index'
import EventBus from '../../../../utils/event-bus.js'
import { PublicationStatus, PublicationType } from '../../../../utils/constants';
import { mapGetters, mapState, mapActions } from 'vuex'
import { pathOr, propOr } from 'ramda'
import {useGetToken} from "@/composables/useGetToken";
import {useSendXhr} from "@/mixins/request/request_composable";

const getPublicationSuffix = (publicationStatus) => {
   return publicationStatus === PublicationStatus.REQUESTED
      ? 'request'
      : publicationStatus === PublicationStatus.REJECTED
        ? 'reject'
        : publicationStatus === PublicationStatus.CANCELLED
          ? 'cancel'
          : 'accept'
}

export default {
    name: 'DatasetSettingsPublicationActions',

    components: {
      BfButton,
      WithdrawDatasetDialog,
      RequestRevisionDialog,
      RequestRemovalDialog
    },

    mixins: [Request],

    props: {
      canPublish: {
        type: Boolean,
        default: false
      }
    },

    data() {
      return {
        withdrawDatasetDialogVisible: false,
        requestRevisionDialogVisible: false,
        requestRemovalDialogVisible: false,
        PublicationStatus,
        PublicationType
      }
    },

    computed: {
      ...mapState([
        'dataset',
        'config',
      ]),
      ...mapGetters(['datasetLocked', 'getPermission']),

      /**
       * Returns dataset publication type
       * @returns {String}
       */
      publicationType: function() {
        const datasetPublicationType = pathOr('', ['publication', 'type'], this.dataset)
        return this.dataset.embargo
        ? PublicationType.EMBARGO
        : datasetPublicationType
      },

      /**
       * Checks if dataset is already published to Discover
       * @returns {Boolean}
       */
      isPublished: function() {
        const status = pathOr('', ['publication', 'status'], this.dataset)
        return status === PublicationStatus.COMPLETED
      },

      /**
       * Checks if dataset is in a draft status i.e. not yet published
       * @returns {Boolean}
       */
      isDraft: function() {
        const status = pathOr('', ['publication', 'status'], this.dataset)
        return status === PublicationStatus.DRAFT
      },

      /**
       * Checks if dataset is in a cancelled status i.e. not yet published
       * @returns {Boolean}
       */
      isCancelled: function() {
        const status = pathOr('', ['publication', 'status'], this.dataset)
        return status === PublicationStatus.CANCELLED
      },

      /**
       * Checks if dataset has been previously published to Discover.
       * This is required in order to make sure proper action buttons are enabled/disabled
       * @returns {Boolean}
       */
      isPreviouslyPublished: function() {
        const datasetPublication = propOr({}, 'publication', this.dataset)
        return datasetPublication.hasOwnProperty('publishedDataset')
      },

      /**
       * Checks if dataset is has been requested to be removed
       * @returns {Boolean}
       */
      isPublicationRemoval: function() {
        const datasetPublication = propOr({}, 'publication', this.dataset)
        return datasetPublication.status === PublicationStatus.COMPLETED && datasetPublication.type === PublicationType.REMOVAL
      },

      /**
       * Checks if publication has been requested for review
       * @returns {Boolean}
       */
      isRequested: function() {
        const status = pathOr('', ['publication', 'status'], this.dataset)
        return status === PublicationStatus.REQUESTED
      },

    },

    methods: {
      ...mapActions(['updateDataset']),
      /**
       * Opens withdraw dialog
       */
      onWithdrawDataset: function() {
        this.withdrawDatasetDialogVisible = true
      },

      /**
       * Closes withdraw dialog
       */
      onCloseWithdraw: function() {
        this.withdrawDatasetDialogVisible = false
      },

      /**
       * Closes removal dialog
       */
      onCloseRemoval: function() {
        this.requestRemovalDialogVisible = false
      },

      /**
       * Closes revision dialog
       */
      onCloseRevision: function() {
        this.requestRevisionDialogVisible= false
      },

      /**
       * Opens revision dialog
       */
      onRequestRevision: function() {
        this.requestRevisionDialogVisible = true
      },

      /**
       * Opens removal dialog
       */
      onRequestRemoval: function() {
        this.requestRemovalDialogVisible = true
      },

      /**
       * Closes all dialog windows
       */
      closeAllDialogs: function() {
        this.withdrawDatasetDialogVisible = false
        this.requestRevisionDialogVisible = false
        this.requestRemovalDialogVisible = false
      },

      /**
       * Handler for post publication errors
       * @param {String} publicationStatus
       * @param {String} publicationType
       */
      handleEndpointErrors: function(publicationStatus, publicationType) {
        const errMessage = publicationStatus === PublicationStatus.CANCELLED ? 'Withdraw is not possible at this time. Please refer to the status of this dataset.'
        : publicationType === PublicationType.REMOVAL ? 'Removal is not possible at this time. Please refer to the status of this dataset.' : 'Revision is not possible at this time. Please refer to the status of this dataset.'

        EventBus.$emit('toast', {
          detail: {
            type: 'error',
            msg: errMessage
          }
        })
         this.closeAllDialogs()
      },

      /**
       * Endpoint request method for post publication actions
       * @param {String} publicationStatus
       * @param {String} publicationType
       */
      triggerRequest: async function(publicationStatus, publicationType) {
      const publicationSuffix = getPublicationSuffix(publicationStatus)
        useGetToken()
          .then(token => {
            let url = ''
            if (this.dataset.publication.type === 'embargo') {
              url = `${this.config.apiUrl
              }/datasets/${this.dataset.content.id
              }/publication/${publicationSuffix
              }?publicationType=${publicationType
              }&api_key=${token
              }&embargoReleaseDate=${this.dataset.publication.embargoReleaseDate}`

            } else {
              url = `${this.config.apiUrl
              }/datasets/${this.dataset.content.id
              }/publication/${publicationSuffix
              }?publicationType=${publicationType
              }&api_key=${token}`
            }

            return useSendXhr(url, { method: 'POST' })
              .then(resp => {
                const message = publicationStatus === PublicationStatus.CANCELLED ? 'Your dataset has been successfully withdrawn from the review process.'
                  : publicationType === PublicationType.REMOVAL ? 'Your request for removal has been submitted.' : 'Your request for revision has been submitted.'

                EventBus.$emit('toast', {
                  detail: {
                    type: 'success',
                    msg: message
                  }
                })

                const updatedPublicationState = {
                  ...this.dataset.publication,
                  status: publicationStatus,
                  type: publicationType
                }
                const updatedDataset = {
                  ...this.dataset,
                  publication: updatedPublicationState
                }

                this.updateDataset(updatedDataset)

                this.closeAllDialogs()
              })

          })
          .catch(e => {
            this.handleXhrError(e)
            this.handleEndpointErrors(publicationStatus, publicationType)
          })
      },
    },
  }
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';
.post-publication-actions {
  margin-top: 8px;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid theme.$gray_2;

  &:last-child {
    border-bottom: none;
  }

  .action-info {
    flex: 1;

    strong {
      font-size: 14px;
      color: theme.$gray_6;
    }

    p {
      font-size: 13px;
      color: theme.$gray_5;
      margin: 4px 0 0;
      line-height: 1.5;

      a {
        color: theme.$purple_3;
      }
    }
  }
}

</style>
