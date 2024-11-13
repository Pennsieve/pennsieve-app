<template>
  <el-dialog
    class="dark-header"
    :visible="visible"
    :show-close="false"
    @close="closeDialog"
  >
    <bf-dialog-header
      slot="title"
    />
    <dialog-body>
      <h2 slot="heading">
        Delete ORCID?
      </h2>
      <p>Are you sure you want to Delete this ORCID?</p>
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
    </dialog-body>
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
import {useGetToken} from "@/composables/useGetToken";
import {useHandleXhrError, useSendXhr} from "@/mixins/request/request_composable";

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

  },

  methods: {
    ...mapActions(['updateProfile']),
    /**
     * Makes XHR call to update two factor auth status
     */
    sendRequest: function() {
      useGetToken()
        .then(token => {
          const url = `${this.config.apiUrl}/user/orcid?api_key=${token}`

          return useSendXhr(url, {
            method: 'DELETE'
          })
            .then(resp => {
              EventBus.$emit('toast', {
                detail: {
                  type: 'MESSAGE',
                  msg: 'Your ORCID has been successfully removed'
                }
              })

              this.$emit('orcid-deleted-success', { orcid: 'orcid', type: 'DELETED' })
            })

        })
        .finally(() => this.closeDialog())
        .catch(useHandleXhrError.bind(this))
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
