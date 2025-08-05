<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="add-integration-dialog fixed-width"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Edit Compute Node" />
    </template>

    <dialog-body>
      <el-form
        :model="computeNode"
        :rules="rules"
        ref="computeNodeForm"
        label-position="top"
        @submit.native.prevent="handleEditComputeNode"
      >
        <el-form-item prop="name">
          <template #label>
            <span>Name</span>
            <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="computeNode.name"
            :value="selectedComputeNode.name"
            autofocus
          />
        </el-form-item>

        <el-form-item prop="description">
          <template #label>
            <span>Description</span>
            <span class="label-helper"> required </span>
          </template>
          <div class="text-area-wrapper">
            <el-input
              ref="input"
              v-model="computeNode.description"
              :value="selectedComputeNode.description"
              type="textarea"
              :rows="5"
              :maxlength="255"
              placeholder="Add a short description of the compute node"
              :show-word-limit="true"
            />
          </div>
        </el-form-item>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button @click="handleEditComputeNode"> Submit </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapState, mapActions } from "vuex";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";
import EventBus from "../../../utils/event-bus";

const defaultComputeNodeFormValues = () => ({
  name: "",
  description: "",
  uuid: null,
});

export default {
  name: "CreateComputeNodeDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
  },

  props: {
    dialogVisible: Boolean,
    selectedComputeNode: Object,
  },

  data() {
    return {
      computeNode: defaultComputeNodeFormValues(),
      rules: {
        name: [
          { required: true, message: "Please input a name", trigger: "blur" },
        ],
        description: [
          {
            required: true,
            message: "Please input a description",
            trigger: "blur",
          },
        ],
      },
      selectedValue: null,
    };
  },
  mounted() {
    this.selectedValue = this.selectedComputeNode.account.accountId;
    this.computeNode.name = this.selectedComputeNode.name;
    this.computeNode.description = this.selectedComputeNode.description;
    this.computeNode.uuid = this.selectedComputeNode.uuid;
  },

  computed: {
    ...mapState(["userToken", "config"]),
    ...mapState("analysisModule", ["computeResourceAccounts"]),
  },

  methods: {
    ...mapActions("analysisModule", ["editComputeNode"]),
    isSelected(accountId) {
      return this.selectedComputeNode?.account?.accountId === accountId
        ? true
        : false;
    },

    closeDialog() {
      this.computeNode = defaultComputeNodeFormValues();
      this.$emit("close", false);
      this.$refs.computeNodeForm.clearValidate();
    },

    async handleEditComputeNode() {
      this.$refs.computeNodeForm.validate(async (valid) => {
        if (valid) {
          const formattedComputeNode = {
            ...this.computeNode,
          };

          try {
            const result = await this.editComputeNode(formattedComputeNode);
            EventBus.$emit("toast", {
              detail: {
                type: "success",
                msg: "Your request to create a Compute Node has been initiated.",
                duration: 8000,
              },
            });
          } catch (error) {
            console.error(error);
            EventBus.$emit("toast", {
              detail: {
                type: "error",
                msg: "There was a problem submitting your request.",
                duration: 6000,
              },
            });
          } finally {
            this.closeDialog();
          }
        }
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.text-area-wrapper {
  width: 100%;
}

.add-integration-dialog {
  .el-form-item {
    .el-form-item__label {
      font-weight: 500;
      color: theme.$gray_5;
    }
    &.is-error {
      .el-form-item__label {
        color: red;
      }
    }
  }

  .required-label {
    color: red;
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
    border: 1px solid theme.$gray_5;
  }

  .el-checkbox__label,
  .el-form-item__label {
    color: theme.$gray_6;
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
    color: theme.$gray_4;
    line-height: 16px;
  }
  .info {
    font-size: 12px;
    color: theme.$gray_4;
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
}
</style>
