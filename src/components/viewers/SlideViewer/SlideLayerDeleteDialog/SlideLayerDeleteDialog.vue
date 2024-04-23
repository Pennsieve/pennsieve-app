<template>
  <el-dialog
    class="simple"
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="close"
    @closed="onClosed"
  >
    <bf-dialog-header slot="title" />
    <dialog-body>
      <IconWarningCircle
        class="mb-16"
        :height="32"
        :width="32"
        color="#e94b4b"
      />
      <h2>Delete layer?</h2>
      <p>
        Are you sure you want to delete this layer? This will remove any associated annotations and <strong>can not be undone</strong>.
      </p>
      <div class="dialog-simple-buttons">
        <bf-button
          class="secondary"
          @click="$emit('cancel')"
        >
          Cancel
        </bf-button>
        <bf-button
          class="red"
          :processing="isProcessing"
          @click="$emit('delete', layer)"
        >
          Delete
        </bf-button>
      </div>
    </dialog-body>
  </el-dialog>
</template>

<script>
import {
  pathOr
} from 'ramda'

import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
import BfButton from '../../../shared/bf-button/BfButton.vue'
import IconWarningCircle from "../../../icons/IconWarningCircle.vue";

export default {
  name: 'SlideLayerDeleteDialog',

  components: {
    IconWarningCircle,
    BfDialogHeader,
    DialogBody,
    BfButton
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false
    },
    layer: {
      type: Object,
      default: () => {
        return {}
      }
    }
  },

  data: function () {
    return {
      isProcessing: false
    }
  },

  methods: {
    /**
     * Emit event to update the synced property
     */
    close: function() {
      this.$emit('cancel')
    },

    /**
     * Callback after the dialog has closed
     * Reset dialog
     */
    onClosed: function() {
      this.isProcessing = false
      this.$emit('update:layer', {})
    }
  }
}
</script>

<style lang="scss" scoped>

h2 {
  color: #000;
  font-size: 14px;
  list-style: 16px;
  margin: 0 0 8px;
}
</style>
