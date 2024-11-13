<template>
  <div class="org-settings-data-use-agreements">
    <div class="header mb-24">
      <div class="heading">
        <h3 class="mb-0 mt-0">
          Data Use Agreements
        </h3>
        <a
          href="https://docs.pennsieve.io/docs/data-use-agreements"
          class="ml-8"
          target="_blank"
        >
          What’s this?
        </a>
      </div>
      <bf-button @click="isDialogVisible = true">
        Add New Agreement
      </bf-button>
    </div>

    <div>
      <data-use-agreement-list-item
        v-for="dataUseAgreement in dataUseAgreements"
        :key="dataUseAgreement.id"
        :data-use-agreement="dataUseAgreement"
        @delete="deleteDataUseAgreement"
        @edit="openEditDataUseAgreement"
        @make-default="makeDataUseAgreementDefault"
      />
    </div>

    <data-use-agreement-update-dialog
      :dialog-visible="isDialogVisible"
      :data-use-agreement.sync="editableDataUseAgreement"
      @close="closeDataUseAgreementDialog"
      @add-data-use-agreement="addDataUseAgreement"
      @edit-data-use-agreement="editDataUseAgreement"
    />
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex'

import BfButton from '../../shared/bf-button/BfButton.vue'
import DataUseAgreementListItem from './DataUseAgreementListItem/DataUseAgreementListItem.vue'
import DataUseAgreementUpdateDialog from './DataUseAgreementUpdateDialog/DataUseAgreementUpdateDialog.vue'
import Request from '../../../mixins/request'
import EventBus from '../../../utils/event-bus'
import {useSendXhr} from "@/mixins/request/request_composable";
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'OrgSettingsDataUseAgreements',

  components: {
    BfButton,
    DataUseAgreementListItem,
    DataUseAgreementUpdateDialog
  },

  mixins: [
    Request
  ],

  data() {
    return {
      isDialogVisible: false,
      editableDataUseAgreement: {}
    }
  },

  computed:  {
    ...mapState([
      'activeOrganization',
      'config',
      'dataUseAgreements',
    ]),

    /**
     * Compute data use agreement URL
     * @returns {String}
     */
    dataUseAgreementUrl: function() {
      return `${this.config.apiUrl}/organizations/${this.activeOrganization.organization.id}/data-use-agreements`
    }
  },

  methods: {
    ...mapActions([
      'createDataUseAgreement',
      'removeDataUseAgreement',
      'updateDataUseAgreement',
      'updateDefaultDataUseAgreement'
    ]),

    closeDataUseAgreementDialog: function() {
      this.isDialogVisible = false
    },
    /**
     * Delete data use agreement and remove it from the list
     * @param {Object} dataUseAgreement
     */
    deleteDataUseAgreement: function(dataUseAgreement) {
      useGetToken()
        .then(token => {
          const { id } = dataUseAgreement
          const url = `${this.dataUseAgreementUrl}/${id}?api_key=${token}`
          return useSendXhr(url, {
            method: 'DELETE'
          })
            .then((e) => {
              return this.removeDataUseAgreement(id)
            })
        })
        .catch( error => {
            this.handleXhrError(err)
            EventBus.$emit('toast', {
              detail: {
                msg: 'There was an error deleting the agreement: ' + err.message,
                type: 'error'
              }
            })
        })
    },

    /**
     * Create data use agreement and add it to the list
     * @param {Object} dataUseAgreement
     */
    addDataUseAgreement: async function(dataUseAgreement) {

      useGetToken()
        .then(async token => {
          const url = `${this.dataUseAgreementUrl}?api_key=${token}`
          return this.sendXhr(url, {
            method: 'POST',
            body: dataUseAgreement
          })
            .then(agreement => {
              return this.createDataUseAgreement(agreement)
            })
        })
        .finally(this.isDialogVisible = false)
        .catch (error => {
          this.handleXhrError()
          EventBus.$emit('toast', {
            detail: {
              msg: 'There was an error creating the agreement',
              type: 'error'
            }
          })
        })

    },

    /**
     * Create data use agreement and add it to the list
     * @param {Object} dataUseAgreement
     */
    openEditDataUseAgreement: function(dataUseAgreement) {
      this.editableDataUseAgreement = { ...dataUseAgreement }
      this.isDialogVisible = true
    },

    /**
     * Update data use agreement
     * @param {Object} dataUseAgreement
     */
    editDataUseAgreement: function(dataUseAgreement) {

      useGetToken()
        .then(token => {
          const { id } = dataUseAgreement
          const url = `${this.dataUseAgreementUrl}/${id}?api_key=${token}`
          return useSendXhr(url, {
            method: 'PUT',
            body: dataUseAgreement
          })
            .then(() => {
              this.updateDataUseAgreement({ ...dataUseAgreement })
            })
        })
        .finally(this.isDialogVisible = false)
        .catch((e) => {
          this.handleXhrError(e)
          EventBus.$emit('toast', {
            detail: {
              msg: 'There was an error updating the agreement',
              type: 'error'
            }
          })
        })


    },

    /**
     * Make data use agreement default,
     * which will also make the current default
     * agreement not default
     * @param {Object} dataUseAgreement
     */
    makeDataUseAgreementDefault: function(dataUseAgreement) {
      const updatedDataUseAgreement = {
        ...dataUseAgreement,
        isDefault: true
      }
      const { id } = dataUseAgreement

      useGetToken()
        .then(token => {
          const url = `${this.dataUseAgreementUrl}/${id}?api_key=${token}`

          return useSendXhr(url, {
            method: 'PUT',
            body: updatedDataUseAgreement
          })
            .then(() => {
              this.updateDefaultDataUseAgreement({ ...updatedDataUseAgreement })
            })
        })
        .catch((err) => {
          this.handleXhrError(err)
          EventBus.$emit('toast', {
            detail: {
              msg: 'There was an error making the agreement default',
              type: 'error'
            }
          })
        })
    }
  }
}
</script>

<style lang="scss" scoped>
.header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.heading {
  align-items: center;
  display: flex;
}
</style>
