<template>
  <el-dialog
    class="dark-header"
    :modelValue="visible"
    @update:modelValue="visible = $event"
    :show-close="false"
    @close="closeDialog"
  >
    <template #title>
      <bf-dialog-header title="Delete GitHub Integration?"/>
    </template>

    <dialog-body>
      <p style="max-width: 450px">Are you sure you want to remove your linked GitHub account from your Pennsieve user profile?</p>
      <li>Pennsieve will no longer track GitHub repositories in your account.</li>
      <li>GitHub releases will no longer result in Pennsieve GitHub Publications.</li>
      <li>You can no longer create Applications and Workflows on Pennsieve.</li>

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
  name: 'DeleteGitHub',

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
    ...mapGetters(['profile', 'activeOrganization', 'userToken', 'config']),

    /**
     * Retrieves API URL to delete ORCID
     */
    deleteGithubIntegrationUrl: function () {
      const url = pathOr("", ["api2Url"])(this.config);
      if (!url) {
        return "";
      }

      return `${url}/accounts/github/user`;
    },
  },

  methods: {
    ...mapActions(['updateProfile']),
    /**
     * Makes XHR call to update two factor auth status
     */
    sendRequest: function() {
      this.closeDialog()
      if (!this.deleteGithubIntegrationUrl) {
        return
      }

      this.sendXhr(this.deleteGithubIntegrationUrl, {
        method: 'DELETE',
        header: {
          'Authorization': `Bearer ${this.userToken}`
        },
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
          msg: 'Your GitHub account has been successfully removed'
        }
      })

      this.$emit('deleted-success', {})
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.$emit('close')
    }
  }
}
</script>
