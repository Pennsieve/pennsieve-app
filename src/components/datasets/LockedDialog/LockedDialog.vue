<template>
  <div>
    <el-dialog
      class="locked-dialog"
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      :append-to-body="true"
      :show-close="false"
      @close="toggleVisible"
    >
      <template #header>
        <bf-dialog-header
          title="Review process">
        </bf-dialog-header>
      </template>

      <dialog-body>
        <IconLock
          class="mb-8"
          :height="32"
          :width="32"
        />
        <h2>This dataset is under review</h2>
        <p>
          This dataset is currently awaiting review by Publishers within your organization.
          We’ve locked this dataset temporarily to follow protocol
          and will send you an email once the dataset status has changed.
        </p>
        <div class="dialog-simple-buttons">
          <bf-button @click.prevent="toggleVisible">
            Got It
          </bf-button>
        </div>
      </dialog-body>
    </el-dialog>
  </div>
</template>

<script>
  import BfButton from '../../shared/bf-button/BfButton.vue';
  import DialogBody from '../../shared/dialog-body/DialogBody.vue';
  import IconLockFilled from "../../icons/IconLock.vue";
  import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
  export default {
    name: 'LockedDialog',
    components: {
      BfDialogHeader,
      IconLockFilled,
      BfButton,
      DialogBody
    },
    props: {
      dialogVisible: {
        type: Boolean,
        default: false
      },
    },
    methods: {
      /**
     * Toggles modal to be visible or not
     */
    toggleVisible: function() {
      this.$emit('close')
    },
    },
  }
</script>

<style lang="scss" scoped>
@use '../../../styles/theme';
@use '../../../styles/element/dialog';

 .locked-dialog {
   .el-dialog__header {
      border-bottom: none;
    }
    text-align: center;
    p {
      font-weight: normal;
      color: theme.$gray_6;
      padding: 8px 0;
    }
  }
</style>