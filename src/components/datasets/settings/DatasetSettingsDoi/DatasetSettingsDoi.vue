<template>
  <div class="dataset-settings-doi">
    <h3>
      Permanent Data Object Identifier (DOI)
    </h3>
    <p class="mb-16">
      Digital Object Identifiers allow you to reference your data in publications. DOIs make it easy for anyone to find your data.
    </p>
    <div class="doi-label">

      <div>
        <strong class="label-strong">
          {{ datasetDoi.doi }}
        </strong> {{ formattedDoi }}
      </div>

      <bf-button
        v-if="!hasDoi"
        class="primary"
        @click="requestDraftDoi"
      >
        Reserve a DataCite DOI
      </bf-button>
    </div>
  </div>
</template>

<script>
  import {
    mapActions,
    mapState
  } from 'vuex'
  import {
    pathOr
  } from 'ramda'

  import FormatDate from '../../../../mixins/format-date'
  import Request from '../../../../mixins/request'
  import BfButton from "../../../shared/bf-button/BfButton.vue";
  import {useGetToken} from "@/composables/useGetToken";
  import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";

  export default {
    name: 'DatasetSettingsDoi',

    components: {
      BfButton
    },

    mixins: [
      FormatDate,
      Request
    ],

    computed: {
      ...mapState([
        'config',
        'datasetDoi',
        'isLoadingDatasetDoi',
        'dataset'
      ]),

      /**
       * Computes if the dataset has a DOI
       * @returns {Boolean}
       */
      hasDoi: function() {
        return Object.keys(this.datasetDoi).length > 0
      },

      /**
       * Computes formatted DOI response
       * @returns {String}
       */
      formattedDoi: function() {
        if (this.hasDoi) {
          return ` updated on ${this.formatDate(this.datasetDoi.createdAt)}`
        }
        return ''
      }
    },

    methods: {
      ...mapActions([
        'setDatasetDoi',
        'setIsLoadingDatasetDoi'
      ]),

      /**
       * Retrieve DOI for dataset
       */
      getDoi: function() {

        useGetToken()
          .then(token => {
            const datasetId = pathOr('', ['content', 'id'], this.dataset)
            const url = `${this.config.apiUrl}/datasets/${datasetId}/doi?api_key=${token}`
            return useSendXhr(url)
              .then(data => {
                this.doi = data
                this.isRequestingDoi = false
              })
          })
          .catch(err => {
            this.isRequestingDoi = false
            this.handleXhrError(err)
          })
      },

      /**
       * Request Draft DOI
       */
      requestDraftDoi: function() {
        const title = pathOr('', ['content', 'name'], this.dataset)
        if (!title) {
          return
        }

        useGetToken()
          .then(token => {
            const datasetId = pathOr('', ['content', 'id'], this.dataset)
            const url = `${this.config.apiUrl}/datasets/${datasetId}/doi?api_key=${token}`
            this.setIsLoadingDatasetDoi(true)

            return useSendXhr(url, {
              method: 'POST',
              header: {
                Authorization: `bearer ${token}`
              },
              body: {
                title
              }
            })
              .then(response => {
                return this.setDatasetDoi(response)
              })

          })
          .catch(useHandleXhrError)
          .finally(() => {
            this.setIsLoadingDatasetDoi(false)
          })
      },
    }
  }
</script>

<style lang="scss" scoped>

  .doi-label {
    display: flex;
    justify-content: space-between;
  }

  p {
    color: #000;
  }

  .doi-label {
    color: #000;
  }
</style>
