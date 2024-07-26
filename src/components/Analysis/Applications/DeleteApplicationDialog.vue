<template>
  <el-dialog
    class="light-header fixed-width simple"
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    :show-close="false"
    @close="close"
    @closed="onClosed"
  >
    <dialog-body>
      <IconWarningCircle :height="32" :width="32" color="#F25641" />
      <h2>Delete integration?</h2>

      <dialog-body>
        <div class="api-key-message">
          <p>
            Removing this integration will prevent any datasets within the
            workspace to invoke this integration and remove access for the
            integration to the datasets that enabled the integration.
          </p>
        </div>
      </dialog-body>

      <div class="dialog-simple-buttons">
        <bf-button class="secondary" @click="close"> Cancel </bf-button>
        <bf-button
          class="red"
          :processing="isProcessing"
          @click="removeIntegration"
        >
          Delete
        </bf-button>
      </div>
    </dialog-body>
  </el-dialog>
</template>

<script>
import BfDialogHeader from "../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../shared/dialog-body/DialogBody.vue";
import BfButton from "../shared/bf-button/BfButton.vue";
import IconWarningCircle from "../icons/IconWarningCircle.vue";

export default {
  name: "DeleteApplicationDialog",
  components: {
    IconWarningCircle,
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
  data: function () {
    return {
      isProcessing: false,
      deleteIntegration: {
        type: Object,
        default: () => {
          return {};
        },
      },
    };
  },
  computed: {},
  methods: {
    setIntegration: function (integration) {
      this.deleteIntegration = integration;
    },
    removeIntegration: function () {
      this.$emit("delete", this.deleteIntegration);
    },
    /**
     * Emit event to update the synced property
     */
    close: function () {
      this.$emit("close");
    },
    /**
     * Callback after the dialog has closed
     * Reset dialog
     */
    onClosed: function () {
      this.isProcessing = false;
    },
  },
};
</script>

<style lang="scss" scoped>
@import "../../assets/_variables.scss";
h2 {
  font-size: 14px;
}
.dialog-simple-buttons {
  display: flex;
  margin-top: 16px;
  justify-content: center;
  .bf-button {
    margin-left: 8px;
  }
}
</style>
