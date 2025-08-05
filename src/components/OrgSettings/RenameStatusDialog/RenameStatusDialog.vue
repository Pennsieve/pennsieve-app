<template>
  <div>
    <el-dialog
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      class="light-header fixed-width simple"
      :show-close="false"
      @close="closeDialog"
    >

      <dialog-body>
        <IconWarningCircle
          :height="32"
          :width="32"
        />
        <h2>New Status Name</h2>
        <p>Are you sure you want to rename this status? This change will impact all datasets it has been applied to.</p>

        <div class="dialog-simple-buttons">
          <bf-button
            class="secondary"
            @click="closeDialog"
          >
            Cancel
          </bf-button>
          <bf-button
            class="primary"
            @click="renameStatus"
          >
            Continue
          </bf-button>
        </div>
      </dialog-body>
    </el-dialog>

  </div>
</template>

<script>
  import BfButton from '../../shared/bf-button/BfButton.vue'
  import BfDialogHeader from '../../shared/bf-dialog-header/BfDialogHeader.vue'
  import DialogBody from '../../shared/dialog-body/DialogBody.vue'
  import IconWarningCircle from "../../icons/IconWarningCircle.vue";


  export default {
    name: 'RenameStatusDialog',

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

      id: {
        type: Number,
        default: 0
      }
    },

    methods: {
      /**
       * Closes the dialog
       */
      closeDialog: function() {
        this.$emit('close-dialog')
      },

      renameStatus: function() {
        this.$emit('rename-status', this.id)
        this.closeDialog()
      }
    }
  }
</script>

<style scoped lang="scss">
  @use '../../../styles/theme';

  .svg-icon {
    color: theme.$app-primary-color;
  }
  .dialog-body {
    text-align: center
  }

  h2 {
    margin-bottom: 8px;
    font-size: 14px;
  }

  p {
    color: theme.$gray_4;
    font-size: 14px;
    font-weight: normal;
    line-height: 18px;
  }
</style>
