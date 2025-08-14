<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="light-header fixed-width simple"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" />
    </template>

    <dialog-body>
      <h2>Withdraw Dataset?</h2>
      <p>
        Withdraw your dataset from the review process.
      </p>

      <p>This will unlock the dataset and you can re-submit your dataset when it is ready for review.</p>

      <div class="dialog-simple-buttons">
        <bf-button
          class="secondary"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          @click="withdrawDataset"
        >
          Submit
        </bf-button>
      </div>
    </dialog-body>
  </el-dialog>
</template>

<script>
import BfDialogHeader from '@/components/shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '@/components/shared/dialog-body/DialogBody.vue'
import BfButton from '@/components/shared/bf-button/BfButton.vue'
  export default {
    name: 'WithdrawDatasetDialog',

    components: {
      BfDialogHeader,
      DialogBody,
      BfButton
    },

    props: {
      dialogVisible: {
        type: Boolean,
        default: false
      },
    },

    methods: {
      /**
       * Closes the dialog
      */
      closeDialog: function() {
        this.$emit('on-close')
      },

      /**
       * Emit event when clicking withdraw button
       */
      withdrawDataset: function() {
        this.$emit('on-withdraw')
      }
    },
  }
</script>

<style lang="scss" scoped>
.dialog-body {
  .dialog-simple-buttons {
    margin-top: 40px;

    :first-child {
      margin-right: 8px;
    }

  }

  p {
    color: #000;
  }

  h2 {
    margin-bottom: 21px;
  }
}
</style>
