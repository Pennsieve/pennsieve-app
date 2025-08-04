<template>
  <div class="dataset-settings-associated-publications">
    <h4>References</h4>
    <p class="mb-16">
      List references to other items that are associated with this dataset (e.g
      Publications, Protocols, and Other Datasets).
    </p>
    <bf-button
      class="secondary"
      @click="showAssociatedPublicationsDialog"
    >
      Add Reference
    </bf-button>
    <div v-loading="isLoading">
      <div
        v-for="referenceType in Object.keys(groupedReferences)"
        :key="referenceType"
        class="citation-list"
      >
        <p>{{ referenceHeading(referenceType) }}</p>
        <associated-publications-list
          v-for="pub in groupedReferences[referenceType]"
          :key="pub.doi"
          v-loading="isLoading"
          :publication="pub"
          :relationship="pub.relationshiptype"
          @add-reference="addReference"
          @remove-citation="removeCitation(pub, pub.relationship)"
        />
      </div>
    </div>
    <reference-types-dialog
      v-model:dialog-visible="publicationsDialogVisible"
      :url="externalPublicationsUrl"
      @add-reference="addReference"
      @close="closeReferenceDialog"
    />
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { pathOr, groupBy } from 'ramda'
import AssociatedPublicationsList from '../AssociatedPublicationsList/AssociatedPublicationsList.vue'
import ReferenceTypesDialog from '../ReferenceTypesDialog/ReferenceTypesDialog.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import Request from '../../../../mixins/request/index'
import { referenceTypeOptions } from '../../../../utils/constants'
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";
export default {
  name: 'DatasetAssociatedPublications',

  components: {
    AssociatedPublicationsList,
    ReferenceTypesDialog,
    BfButton
  },

  mixins: [Request],

  data() {
    return {
      doiList: [],
      isLoading: false,
      hasDuplicate: false,
      publicationsDialogVisible: false,
      referenceTypeValue: '',
      referenceTypeOptions,
      references: []
    }
  },

  computed: {
    ...mapGetters(['datasetLocked']),
    ...mapState(['config', 'dataset']),

    /**
     * Computes dataset Id
     * @returns {String}
     */
    datasetId: function() {
      return pathOr('', ['content', 'id'], this.dataset)
    },
    /**
     * GET External Publications URL
     * @returns {String}
     */
    externalPublicationsUrl: function() {
      if(!this.datasetId){return null}
      return `${this.config.apiUrl}/datasets/${
        this.datasetId
      }/external-publications`
    },
    /**
     * Groups references
     * @returns {Array}
     */
    groupedReferences: function() {
      return groupBy(item => item.relationshipType, this.references)
    }
  },

  mounted() {
    this.getExternalPublications()
  },

  methods: {

    closeReferenceDialog: function() {
      this.publicationsDialogVisible=false
    },
    /**
     * Get reference heading by value
     * @TODO optimize
     * @params {String} referenceType
     */
    referenceHeading: function(referenceType) {
      return this.referenceTypeOptions.filter(item => item.value === referenceType)[0].label
    },

    /**
     * Show Associated Publications Dialog
     */
    showAssociatedPublicationsDialog: function() {
      this.publicationsDialogVisible = true
    },
    /**
     * Gets external publications associated with dataset
     */
    getExternalPublications: function() {
      if (!this.externalPublicationsUrl) {
        return
      }

      this.isLoading = true
      useGetToken()
        .then(token => {
          const url = this.externalPublicationsUrl + `?api_key=${token}`
          return useSendXhr(url)
            .then(response => {
              this.isLoading = false
              this.references = response
            })
            .catch(() => {
              this.isLoading = false
              this.hasError = true
            })
        }).catch(err => useHandleXhrError(err))
    },

    /**
     * Adds DOI citation to dataset
     * @param {Object} doi
     * @param {String} refLabel
     * @param {String} refVal
     */
    addReference: function(doi, refLabel, refVal) {

      useGetToken()
        .then(token => {
          this.isLoading = true
          const url = typeof doi === 'object' && doi !== null
            ? this.externalPublicationsUrl +
            `?doi=${doi.doi}&api_key=${token}&relationshipType=${refVal}`
            : this.externalPublicationsUrl +
            `?doi=${doi}&api_key=${token}&relationshipType=${refVal}`

          return useSendXhr(url, {
            method: 'PUT'
          })
            .then(response => {
              this.isLoading = false
              this.checkForDuplicates(response)
              if (!this.hasDuplicate) {
                this.references.push(response)
              }
            })


        })
        .catch(useHandleXhrError)
        .finally(this.hasDuplicate = false)

    },

    /**
     * Checks if a DOI citation already exists in the list
     * @param {Object} response
     */
    checkForDuplicates: function(response) {
      this.references.forEach(ref => {
        if (response.doi === ref.doi && response.relationshipType === ref.relationshipType) {
          this.hasDuplicate = true
        }
      })
    },

    /**
     * Deletes a DOI citation from the list
     * @param {Object} doi
     */
    removeCitation: function(doi) {
      useGetToken()
        .then(token => {
          const url =
            this.externalPublicationsUrl +
            `?doi=${doi.doi}&api_key=${token}&relationshipType=${
              doi.relationshipType
            }`
          return useSendXhr(url, {
            method: 'DELETE'
          }).then(() => {
            this.references = this.references.filter(ref => ref !== doi)
          })

        })
        .catch(useHandleXhrError)
    }
  }
}
</script>

<style lang="scss" scoped>
@use '../../../../styles/theme';

.dataset-settings-associated-publications {
  .doi-input {
    max-width: 474px;
    margin-bottom: 8px;
  }

  .error {
    color: theme.$error-color;
  }

  .citation-list {
    p {
      font-weight: 500;
      margin-top: 10px;
    }
  }

  .bf-button {
    &.secondary {
      width: 135px;
      margin-bottom: 10px;
    }
  }
}
</style>
