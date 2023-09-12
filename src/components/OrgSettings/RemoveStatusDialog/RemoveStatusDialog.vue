<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="light-header fixed-width simple"
    :show-close="false"
    @close="closeDialog"
  >
    <dialog-body>
      <IconWarningCircle
        height="32"
        width="32"
        color="#2760ff"
      />
      <h2>Delete Status</h2>
      <p>Are you sure you want to Delete this status? Any datasets with this status applied will revert to "{{ replacementName }}".</p>

      <div class="dialog-simple-buttons">
        <bf-button
          class="secondary"
          @click="closeDialog"
        >
          Cancel
        </bf-button>
        <bf-button
          class="primary"
          @click="removeStatus"
        >
          Confirm
        </bf-button>
      </div>
    </dialog-body>
  </el-dialog>
</template>

<script>
  import BfButton from '../../shared/bf-button/BfButton.vue'
  import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
  import DialogBody from '../../shared/dialog-body/DialogBody.vue'
  import IconWarningCircle from "../../icons/IconWarningCircle.vue";

  export default {
    name: 'RemoveStatusDialog',

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

      replacementName: {
        type: String,
        default: ''
      }
    },

    methods: {
      /**
       * Closes the dialog
       */
      closeDialog: function() {
        this.$emit('close-dialog')
      },

      removeStatus: function() {
        this.$emit('remove-status')
        this.closeDialog()
      }
    }
  }
</script>

<style scoped lang="scss">
  @import '../../../assets/_variables.scss';

  .svg-icon {
    color: $app-primary-color;
  }
  .dialog-body {
    text-align: center
  }

  h2 {
    margin-bottom: 8px;
    font-size: 14px;
  }

  p {
    color: $gray_4;
    font-size: 14px;
    font-weight: normal;
    line-height: 18px;
  }

  .dialog-simple-buttons {
    display: flex;
    margin-top: 16px;
    justify-content: center;
    .bf-button{
      margin-left: 8px;
    }
  }
</style>
