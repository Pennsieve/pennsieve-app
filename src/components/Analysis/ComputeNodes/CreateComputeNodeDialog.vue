<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="add-integration-dialog fixed-width"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Create Compute Node" />
    </template>

    <dialog-body>
      <el-form
        :model="computeNode"
        label-position="top"
        @submit.native.prevent="handleCreateComputeNode"
      >
        <el-form-item prop="name">
          <template #label>
            Name <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="computeNode.name"
            placeholder="ex: my-compute-node"
            autofocus
          />
        </el-form-item>

        <el-form-item prop="description">
          <template #label>
            Description <span class="label-helper"> required </span>
          </template>
          <div class="text-area-wrapper">
            <el-input
              ref="input"
              v-model="computeNode.description"
              type="textarea"
              :rows="5"
              :maxlength="255"
              placeholder="Add a short description of the compute node"
              :show-word-limit="true"
            />
          </div>
        </el-form-item>
        <el-form-item prop="accountUuid">
          <template #label>
            Account UUID <span class="label-helper"></span>
          </template>
          <el-input
            v-model="computeNode.account.uuid"
            placeholder="the account UUID"
            autofocus
          />
        </el-form-item>
        <el-form-item prop="accountId">
          <template #label>
            Account Id <span class="label-helper"></span>
          </template>
          <el-input
            v-model="computeNode.account.accountId"
            placeholder="the account id"
            autofocus
          />
        </el-form-item>
        <el-form-item prop="accountType">
          <template #label>
            Account Type <span class="label-helper"></span>
          </template>
          <el-input
            v-model="computeNode.account.accountType"
            placeholder="the account type"
            autofocus
          />
        </el-form-item>

        <el-form-item prop="environment">
          <template #label>
            Environment <span class="label-helper"></span>
          </template>
          <el-input
            v-model="computeNode.environment"
            placeholder="ex: production"
            autofocus
          />
        </el-form-item>
      </el-form>
    </dialog-body>

    <!-- Overview buttons -->
    <template #footer>
      <bf-button @click="handleCreateComputeNode">
        Create Compute Node
      </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapState, mapGetters, mapActions } from "vuex";

import BfButton from "../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";

/**
 * Returns the default values for a property
 * @returns {Object}
 */
const defaultComputeNodeFormValues = () => ({
  name: "",
  description: "",
  account: {
    uuid: "",
    accountId: "",
    accountType: "",
  },
  environment: "",
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
  },
  data: function () {
    return {
      computeNode: defaultComputeNodeFormValues(),
    };
  },

  computed: {
    ...mapState(["userToken", "config"]),
  },

  watch: {
    /**
     * Watch name and set form model to the value
     * @param {String} val
     */
    name: function (val) {
      this.application.name = val;
    },
    description: function (val) {
      this.application.description = val;
    },
  },

  mounted() {},

  methods: {
    ...mapActions("analysisModule", ["createComputeNode"]),
    closeDialog: function () {
      this.$emit("close", false);
    },

    /**
     * POST to API to create new application
     */
    handleCreateComputeNode: async function () {
      try {
        await this.createComputeNode(this.computeNode);
      } catch (error) {
        console.error(error);
      } finally {
        this.computeNode = defaultComputeNodeFormValues();
        this.closeDialog();
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

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
}
</style>
