<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        slot="title"
        title="Dataset Change Detected"
      />
    </template>

    <dialog-body class="confirm-stale-update-body">
      <p>
        A contributor has made changes to this page.  Before your changes can be saved, you must reload the page.
      </p>
      <div>
        <p>
          <strong>
            Please note, changes you made will not be saved.
          </strong>
        </p>
      </div>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        class="primary"
        @click="onConfirmClick"
      >
        Reload Page
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
  import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue"
  import BfButton from "../../shared/bf-button/BfButton.vue"
  import DialogBody from "../../shared/dialog-body/DialogBody.vue"

  export default {

    components: {
      BfDialogHeader,
      BfButton,
      DialogBody
    },

    props: {
      dialogVisible: {
        type: Boolean,
        deafult: false
      }
    },

    methods: {
      /**
       * close the dialog
       */
      closeDialog: function() {
        this.$emit('close')
      },
      /**
       * closes the dialog and sends calls the provided sendRequest function
       */
      onConfirmClick: function() {
        const currentHref = window.location.href
        window.location.replace(currentHref)
      }
    }
  }
</script>

<style lang="scss" scoped>
  @import '../../../assets/_variables';
  .confirm-stale-update-body {
    p {
      color: $app-secondary-color
    }
  }
</style>