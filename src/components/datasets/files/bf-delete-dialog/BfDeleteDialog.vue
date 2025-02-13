<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    data-cy="bfDeleteDialog"
    class="light-header fixed-width simple"
    :show-close="false"
    @close="closeDialog"
  >

    <dialog-body>
      <IconTrash
        class="mb-8"
        :height="32"
        :width="32"
      />
      <template v-if="callingFromDeleted"
      >
      <!-- THIS SHOULD BE DISABLED FOR NOW-->
      <h2>Delete {{ totalFiles }} {{ headline }}</h2>
      <p>Delete {{ copy }}. This action cannot be undone. </p>

      <div class="dialog-simple-buttons">
        <bf-button
          class="secondary"
          data-cy="closeDeleteDialog"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          class="red"
          data-cy="deleteFiles"
          @click="deletePermanently"
        >
          Delete
        </bf-button>
      </div>
      </template>
      <template v-else>
      <h2>Move {{ totalFiles }} {{ headline }} to the trash</h2>
      <p>{{ copy }} will be deleted permanently after 30 days. </p>

      <div class="dialog-simple-buttons">
        <bf-button
          class="secondary"
          data-cy="closeDeleteDialog"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          class="red"
          data-cy="deleteFiles"
          @click="deleteFiles"
        >
          Delete
        </bf-button>
      </div>
      </template>
    </dialog-body>
  </el-dialog>
</template>

<script>
  import BfButton from '../../../shared/bf-button/BfButton.vue'
  import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
  import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
  import BfFileLabel from '../bf-file/BfFileLabel.vue'
  import Request from '../../../../mixins/request/index'

  import { mapGetters } from 'vuex'
  import IconTrash from "../../../icons/IconTrash.vue";
  import {useGetToken} from "@/composables/useGetToken";
  import {useSendXhr} from "@/mixins/request/request_composable";

  export default {
    name: 'BfDeleteDialog',

    components: {
      IconTrash,
      BfDialogHeader,
      DialogBody,
      BfButton,
      BfFileLabel
    },

    mixins: [
      Request
    ],

    props: {
      dialogVisible: {
        type: Boolean,
        default: false
      },
      selectedFiles: {
        type: Array
      },
      callingFromDeleted: {
        type: Boolean,
        default: false
      },
      selectedDeletedFiles: {
        type: Array
      }
    },

    data: function() {
      return {
        visible: false
      }
    },

    computed: {
      ...mapGetters([
        'config'
      ]),



      /**
       * Compute total files
       * @return {Number}
       */
      totalFiles: function() {
        return this.selectedFiles.length
      },

      /**
       * Compute headline based on total files
       * @return {String}
       */
      headline: function() {
        return this.totalFiles > 1 ? 'items' : 'item'
      },

      /**
       * Compute copy based on total files
       * @return {String}
       */
      copy: function() {
        return this.totalFiles > 1 ? 'These items' : 'This item'
      }
    },

    watch: {
      /**
       * Watch file
       */
      file: function(file) {
        if (Object.keys(file).length) {
          this.packageForm.name = file.content.name
        }
      }
    },

    methods: {
      /**
       * Computes form URL based on type of action user is taking (rename vs creating)
       * @returns {String}
       */
      deleteUrl: async function() {
        return useGetToken()
          .then(token => {
            return `${this.config.apiUrl}/data/delete?api_key=${token}`
          })
      },

      //deletes files permenantly. NOTE: should have toast message that confirms
      deletePermanently: function(){
        const fileIds = this.selectedDeletedFiles.map(item => item.content.id)

        this.deleteUrl()
          .then(url => {
            this.sendXhr(url, {
              method: 'POST',
              body: { things: fileIds }
            })
              .then(response => {
                this.$emit('file-delete', response)
                const msg = 'File(s) permanently deleted.'
                EventBus.$emit('toast', {
                  detail: {
                    type: 'success',
                    msg
                  }
                })
                this.closeDialog()
              })
              .catch(response => {
                this.handleXhrError(response)
              })
          })

      },
      /**
       * Closes the dialog
       */
      closeDialog: function() {
        this.$emit('close')
      },

      deleteFiles: function() {
        const fileIds = this.selectedFiles.map(item => item.content.id)

        this.deleteUrl()
          .then(url => {
            useSendXhr(url, {
              method: 'POST',
              body: { things: fileIds }
            })
              .then(response => {
                this.$emit('file-delete', response)
                this.closeDialog()
              })
              .catch(response => {
                this.handleXhrError(response)
              })
          })


      }
    }
  }
</script>

<style scoped lang="scss">
  @import '../../../../assets/_variables.scss';
  .dialog-simple-buttons {
    display: flex;
    margin-top: 16px;
    justify-content: center;
    .bf-button{
      margin-left: 8px;
    }
  }
  .svg-icon {
    color: $app-primary-color;
  }
  .dialog-body {
    text-align: center
  }
</style>
