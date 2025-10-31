v<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      :show-close="false"
      @close="closeDialog"
    >
      <template #header="{ close, titleId, titleClass }">
        <bf-dialog-header
          title="Newly Created API Credentials"
        />
      </template>

      <dialog-body>
        <div class="api-key-message">
          For your protection, store your access keys securely and do not share them.
          You will not be able to access the key again once this window is closed.
        </div>
        <p><strong>Key:</strong> {{ apiKey.key }} </p>
        <p><strong>Secret:</strong> {{ apiKey.secret }}</p>

        <div class="copy-text">
          {{ copyText }}
        </div>
      </dialog-body>

      <template #footer>
        <bf-button
          class="secondary"
          @click="copyApiKey"
        >
          Copy API Key
        </bf-button>
        <bf-button
          class="secondary"
          @click="copyApiSecret"
        >
          Copy API Secret
        </bf-button>
      </template>
    </el-dialog>

  </div>
</template>

<script>

import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../shared/bf-button/BfButton.vue'
import {copyText} from "vue3-clipboard";
import EventBus from "../../../utils/event-bus";

export default {
  name: 'ApiKeyDetail',

  components: {
    BfButton,
    BfDialogHeader,
    DialogBody
  },

  props: {
    apiKey: {
      type: Object,
      default: {
        name: '',
        key: '',
        secret: '',
      },
    },
  },

  data() {
    return {
      copyText: '',
      dialogVisible: false,
      labelPosition: 'right'
    }
  },

  methods: {
    /**
     * Copy API key to clipboard
     */
    copyApiKey: function() {
      const key = this.apiKey.key
      copyText(key, undefined, (error, event) => {
        if (error) {
          this.copyText = 'Unable to copy key to the clipboard.'
        } else {
          this.copyText = 'API key copied to the clipboard.'
        }
      })

    },
    /**
     * Copy API secret to clipboard
     */
    copyApiSecret: function() {
      const secret = this.apiKey.secret
      copyText(secret, undefined, (error, event) => {
        if (error) {
          this.copyText = 'Unable to copy secret to the clipboard.'
        } else {
          this.copyText = 'API secret copied to the clipboard.'
        }
      })
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

<style lang="scss" scoped>
@use '../../../styles/theme';
@use '../../../styles/element/dialog';

.api-key-message {
  margin-bottom: 20px;
}

.copy-text {
  color: theme.$green_1;
  height: 24px;
}
</style>
