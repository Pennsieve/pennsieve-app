<template>
  <div>
    <el-dialog
      :modelValue="dialogVisible"
      @update:modelValue="dialogVisible = $event"
      class="remove-dataset-dialog simple"
      :show-close="false"
      @close="closeDialog"
    >
      <bf-dialog-header slot="title" />
      <dialog-body>
        <h2>Request Removal?</h2>
        <p>
          Request removal from the Publishers within your organization to remove
          your public dataset from Pennsieve Discover
        </p>

        <p>This action cannot be undone.</p>

        <div class="dialog-simple-buttons">
          <bf-button class="secondary" @click="closeDialog"> Cancel </bf-button>
          <bf-button @click="removeDataset"> Submit </bf-button>
        </div>
      </dialog-body>
    </el-dialog>
  </div>
</template>

<script>
import BfDialogHeader from "@/components/shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "@/components/shared/dialog-body/DialogBody.vue";
import BfButton from "@/components/shared/bf-button/BfButton.vue";
export default {
  name: "RequestRevisionDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
  },

  props: {
    dialogVisible: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.$emit("close");
    },

    /**
     * Removes dataset from publication on Pennsieve Discover
     */
    removeDataset: function () {
      this.$emit("on-removal");
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../../../styles/theme";
@use "../../../../../styles/element/dialog";

.dialog-body {
  .dialog-simple-buttons {
    margin-top: 40px;

    :first-child {
      margin-right: 8px;
    }
  }

  p {
    color: #000;
    margin-bottom: 15px;
  }

  h2 {
    margin-bottom: 21px;
  }
}
</style>
