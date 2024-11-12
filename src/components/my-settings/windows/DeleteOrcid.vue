<template>
  <el-dialog
    class="dark-header"
    :modelValue="visible"
    @update:modelValue="visible = $event"
    :show-close="false"
    @close="closeDialog"
  >
    <template #title>
      <bf-dialog-header title="Delete ORCID Integration?"/>
    </template>

    <dialog-body>
<!--      <h2 slot="heading">-->
<!--        Delete ORCID?-->
<!--      </h2>-->
      <p style="max-width: 450px">Are you sure you want to remove your linked ORCID account from your Pennsieve user profile?</p>
      <li>
        You will no longer be able to submit datasets for publication.
      </li>
      <li>Published datasets will no longer be listed in you ORCID account</li>
      <li>Your ORCID profile will no longer be associated with a publication if you are a contributor</li>

    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        class="red"
        @click="sendRequest"
      >
        Confirm
      </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { pathOr, prop } from 'ramda'

import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'

import Request from '../../../mixins/request'
import EventBus from '../../../utils/event-bus'

export default {
  name: 'DeleteOrcid',

  components: {
    BfButton,
    DialogBody,
    BfDialogHeader
  },

  mixins: [Request],

  props: {
    visible: {
      type: Boolean,
      default: false
    },
  },

  data() {
    return {
      labelPosition: 'right'
    }
  },

  computed: {
    ...mapGetters(['profile', 'activeOrganization', 'config']),

    apiKeyUrl: function() {
      const url = pathOr('', ['config', 'apiUrl'])(this)
      const apiKey = pathOr('', ['apiKey', 'key'])(this)
      const userToken = prop('userToken', this)

      if (!url || !apiKey || !userToken) {
        return ''
      }

      return `${url}/token/${apiKey}?api_key=${userToken}`
    },

    /**
     * Retrieves API URL to delete ORCID
     */
    getORCIDApiUrl: function() {
      const url = this.config.apiUrl

      if (!url) {
        return ''
      }

      return `${url}/user/orcid?api_key=${this.userToken}`
    }
  },

  methods: {
    ...mapActions(['updateProfile']),
    /**
     * Makes XHR call to update two factor auth status
     */
    sendRequest: function() {
      this.closeDialog()
      if (!this.getORCIDApiUrl) {
        return
      }

      this.sendXhr(this.getORCIDApiUrl, {
        method: 'DELETE'
      })
        .then(this.handleXhrSuccess.bind(this))
        .catch(this.handleXhrError.bind(this))
    },
    /**
     * Handles successful two factor xhr response
     */
    handleXhrSuccess: function() {
      EventBus.$emit('toast', {
        detail: {
          type: 'MESSAGE',
          msg: 'Your ORCID has been successfully removed'
        }
      })

      this.$emit('orcid-deleted-success', { orcid: 'orcid', type: 'DELETED' })
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.$emit('orcid-close')
      //this.$emit('update:deleteOrcidDialog.dialogVisible', false)
      //dialogVisible
    }
  }
}
</script>
