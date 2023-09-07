<template>
  <el-dialog
    class="simple"
    v-model="dialogVisible"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header="{ close, titleId, titleClass }">
      <bf-dialog-header title="Confirm Removal" />
    </template>

    <p>Are you sure you want to delete the following API key:</p>

      <p>Name: <b>{{ apiKey.name }}?</b></p>

    <p> Key: {{apiKey.key}}</p>
    <template #footer>
      <div class="dialog-simple-buttons">
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
      </div>
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
  name: 'DeleteApiKey',

  components: {
    BfButton,
    DialogBody,
    BfDialogHeader
  },

  mixins: [
    Request
  ],

  props: {
    apiKey: {
      type: Object,
      default: {
        name: '',
        key: ''
      },
    },
  },

  data() {
    return {
      dialogVisible: false,
      labelPosition: 'right'
    }
  },

  computed: {
    ...mapGetters([
      'profile',
      'activeOrganization',
      'userToken',
      'config'
    ]),
    apiKeyUrl: function() {
      const url = pathOr('', ['config', 'apiUrl'])(this)
      const apiKey = pathOr('', ['apiKey', 'key'])(this)
      const userToken = prop('userToken', this)

      if (!url || !apiKey || !userToken) {
        return ''
      }

      return `${url}/token/${apiKey}?api_key=${userToken}`
    }
  },

  methods: {
    ...mapActions([
      'updateProfile'
    ]),
    /**
     * Makes XHR call to update two factor auth status
     */
    sendRequest: function() {
      this.closeDialog()

      this.sendXhr(this.apiKeyUrl, {
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
          type: 'success',
          msg: 'API Key successfully deleted'
        }
      })

      this.$emit('api-key-deleted', { apiKey: this.apiKey, type: 'DELETED' })
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.dialogVisible = false
    }
  }
}
</script>
