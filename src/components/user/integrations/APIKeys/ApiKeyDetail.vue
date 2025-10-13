<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header="{ close, titleId, titleClass }">
      <bf-dialog-header
        title="Newly created API credentials"
        @close="closeDialog"
      />
    </template>

      <div class="api-key-message">
        For your protection, store your access keys securely and do not share them.
        You will not be able to access the key again once this window is closed.
      </div>
      <p><strong>Key:</strong> {{ apiKey.key }} </p>
      <p><strong>Secret:</strong> {{ apiKey.secret }}</p>

      <div class="copy-text">
        {{ copyText }}
      </div>

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
</template>

<script>
import BfButton from '@/components/shared/bf-button/BfButton.vue'
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'

export default {
  name: 'ApiKeyDetail',

  components: {
    BfButton,
    BfDialogHeader,
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
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
      labelPosition: 'right'
    }
  },

  methods: {
    /**
     * Copy API key to clipboard
     */
    copyApiKey: function() {
      try {
        const key = this.apiKey.key
        navigator.clipboard.writeText(key)
        this.copyText = 'API key copied to the clipboard.'

      } catch {
        this.copyText = 'Unable to copy key to the clipboard.'

      }

    },
    /**
     * Copy API secret to clipboard
     */
    copyApiSecret: function() {

      try {
        const secret = this.apiKey.secret
        navigator.clipboard.writeText(secret)
        this.copyText = 'API secret copied to the clipboard.'

      } catch {
        this.copyText = 'Unable to copy secret to the clipboard.'

      }

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

<style lang="scss" scoped>
@import '../../../../styles/_theme.scss';

.api-key-message {
  margin-bottom: 20px;
}

.copy-text {
  color: $green_1;
  height: 24px;
}
</style>
