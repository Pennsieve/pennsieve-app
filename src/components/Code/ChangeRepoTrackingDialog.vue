<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="fixed-width"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Change Tracking" />
    </template>

    <dialog-body>
       <p>Please confirm if you would like to update the tracking on this repo:</p>
       <p>
         <strong>{{repo.name}}</strong>
       </p>
    </dialog-body>
    <!-- Buttons -->
    <template #footer>
      <bf-button v-if="startTrackingMode" @click="handleEnableTracking">
        Enable Tracking
      </bf-button>
      <bf-button v-if="stopTrackingMode" @click="handleDisableTracking">
        Disable Tracking
      </bf-button>
      <bf-button class="secondary" @click="closeDialog"> Cancel </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapState, mapGetters, mapActions } from "vuex";
import BfButton from "../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../shared/dialog-body/DialogBody.vue";
import EventBus from "../../utils/event-bus";

export default {
  name: "ChangeRepoTrackingDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
  },

  props: {
    dialogVisible: {
      type: Boolean,
      required: true,
      default: false,
    },
    repo: {
      type: Object,
      required: true,
   },
    startTrackingMode: {
      type: Boolean,
      required: true,
      default: false,
    },
    stopTrackingMode: {
      type: Boolean,
      required: true,
      default: false,
    },
  },

  data() {
    return {};
  },

  computed: {
    ...mapState(["userToken", "config"]),
    ...mapState("codeReposModule", ["myRepos"]),
  },

  methods: {
    ...mapActions("codeReposModule", [
      "enableRepoTracking",
      "disableRepoTracking",
      "fetchMyRepos",
      "myReposPaginationParams",
      "myReposCount",
    ]),

    /**
     * Closes the dialog
     */
    closeDialog() {
      this.$emit("close", false);
    },

    /**
     * POST to API to Enable Tracking
     */
    async handleEnableTracking() {
      try {
        await this.enableRepoTracking({repo: this.repo})
          .then(response => {
            if (response.status=="enabled") {
              EventBus.$emit("toast", {
                detail: {
                  type: "success",
                  msg: "Your request has been successfully submitted.",
                },
              });
              this.repo.tracking = true;
            } else {
              EventBus.$emit("toast", {
                detail: {
                  type: "error",
                  msg: "Your request was not successful.",
                },
              });
            }
          })
      } catch (error) {
        console.error(error);
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: "There was a problem submitting your request.",
          },
        });
      } finally {
        this.closeDialog();
      }
    },
    /**
     * POST to API to Disable Tracking
     */
    async handleDisableTracking() {
      try {
        await this.disableRepoTracking({ repo: this.repo });
        EventBus.$emit("toast", {
          detail: {
            type: "success",
            msg: "Your request has been successfully submitted.",
          },
        });
        this.repo.tracking = false;
      } catch (error) {
        console.error(error);
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: "There was a problem submitting your request.",
          },
        });
      } finally {
        this.closeDialog();
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables.scss";

.text-area-wrapper {
  width: 100%;
}

.add-integration-dialog {
  .el-form-item {
    .el-form-item__label {
      font-weight: 500;
      color: $gray_5;
    }
  }

  .el-select {
    &.input-property {
      width: 100%;

      &.target {
        max-width: 200px;
        margin-right: 8px;
      }

      &.filter {
        margin-right: 8px;
      }
    }
  }

  .item-field {
    margin-bottom: 24px;
    &.has-enums {
      margin-bottom: 14px;
    }
  }

  .el-checkbox {
    &.input-property {
      width: 100%;
    }
  }

  .check-description {
    margin-left: 25px;
    line-height: 1em;
  }
  .el-checkbox__inner {
    border: 1px solid $gray_5;
  }

  .el-checkbox__label,
  .el-form-item__label {
    color: $gray_6;
    font-weight: 400;
  }

  .targetOptions {
    flex-direction: row;
    display: flex;
    margin: 8px 0;
  }

  .disabled-label {
    color: #c0c4cc;
    cursor: not-allowed;
    margin-top: 10px;
  }

  .label {
    margin-top: 10px;
  }

  .el-select-group,
  .el-select-dropdown__item {
    padding-bottom: 10px;
  }
  .item-checkbox .el-form-item__content {
    line-height: 1em;
  }
  #item-concept-title {
    #current-name {
      margin-left: 24px;
    }
  }
  .info {
    font-size: 12px;
    color: $gray_4;
    line-height: 16px;
  }
  .info {
    font-size: 12px;
    color: $gray_4;
    &.disabled-label {
      color: #c0c4cc;
      cursor: not-allowed;
      margin-top: -18px;
      height: 26px;
      margin-left: 25px;
    }
  }
  .el-form-item {
    .el-form-item__label {
      text-align: left;
    }
  }
  .el-dialog {
    height: auto;
    width: 524px;
  }
  .el-dialog__footer {
    width: 100%;
  }

  .string-sub-type {
    display: flex;
    flex-direction: row;
  }

  .url-format-info {
    display: block;
    font-size: 12px;
    color: $gray_6;
    margin-top: 4px;
  }

  .url-format-info a {
    color: $primary-color;
    text-decoration: none;
  }

  .url-format-info a:hover {
    text-decoration: underline;
  }
}
</style>
