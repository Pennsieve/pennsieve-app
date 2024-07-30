<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="add-integration-dialog fixed-width"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Create Application" />
    </template>

    <dialog-body>
      <el-form
        :model="application"
        label-position="top"
        @submit.native.prevent="handleCreateApplication"
      >
        <el-form-item prop="name">
          <template #label>
            Name <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.name"
            placeholder="ex: my-analysis-application"
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
              v-model="application.description"
              type="textarea"
              :rows="5"
              :maxlength="255"
              placeholder="Add a description to help others understand what the application does"
              :show-word-limit="true"
            />
          </div>
        </el-form-item>
        <el-form-item prop="applicationType">
          <template #label>
            Application Type <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.applicationType"
            class="input-property"
            filterable
            placeholder="Choose an application type"
          >
            <el-option
              v-for="item in typeItems"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="resoucesCpu">
          <template #label>
            CPU <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.resources.cpu"
            placeholder="ex: 2048"
            autofocus
          />
        </el-form-item>
        <el-form-item prop="resoucesMemory">
          <template #label>
            Memory <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.resources.memory"
            placeholder="ex: 4096"
            autofocus
          />
        </el-form-item>
        <el-form-item prop="integrationType">
          <template #label>
            Compute Node <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.computeNode"
            class="input-property"
            filterable
            placeholder="Choose a Compute Node"
          >
            <el-option
              v-for="computeNode in computeNodes"
              :key="computeNode.name"
              :label="computeNode.name"
              :value="computeNode"
            />
          </el-select>
        </el-form-item>
        <el-form-item prop="sourceType">
          <template #label>
            Source Type <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.source.type"
            placeholder="ex: github"
            autofocus
          />
        </el-form-item>
        <el-form-item prop="sourceUrl">
          <template #label>
            Source Url <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.source.url"
            placeholder="ex: git://github.com/MyOrg/my-repo"
            autofocus
          />
        </el-form-item>
      </el-form>
    </dialog-body>

    <!-- Overview buttons -->
    <template #footer>
      <bf-button @click="handleCreateApplication">
        Create Application
      </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import { mapState, mapGetters, mapActions } from "vuex";

import BfButton from "../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";
import EventBus from "../../../utils/event-bus";

/**
 * Returns the default values for a property
 * @returns {Object}
 */
const defaultApplicationFormValues = () => ({
  name: "",
  description: "",
  applicationType: "",
  resources: {
    cpu: "",
    memory: "",
  },
  account: {
    uuid: "",
    accountId: "",
    accountType: "",
  },
  computeNode: {
    value: "",
    label: "",
    uuid: "",
    efsId: "",
  },
  source: {
    type: "",
    url: "",
  },
  environment: "",
});

export default {
  name: "AddApplicationDialog",

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
      application: defaultApplicationFormValues(),
      typeItems: [
        {
          value: "processor",
          label: "Processor",
        },
        {
          value: "preprocessor",
          label: "Preprocessor",
        },
        {
          value: "postprocessor",
          label: "Postprocessor",
        },
      ],
    };
  },

  computed: {
    ...mapState(["userToken", "config"]),
    ...mapState("analysisModule", ["computeNodes"]),
    ...mapGetters("analysisModule", ["getAnalysisAccounts"]),
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

  mounted() {
    this.fetchComputeNodes();
  },

  methods: {
    ...mapActions("analysisModule", ["fetchComputeNodes", "createApplication"]),
    /**
     * Validation Methods
     */
    validUrl: function (str) {},

    validateName: function (rule, value, callback) {},
    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.$emit("close", false);
      this.application = defaultApplicationFormValues();
    },

    /**
     * POST to API to create new application
     */
    handleCreateApplication: async function () {
      const accountDetails = {
        uuid: this.application.computeNode.account.uuid,
        efsId: this.application.computeNode.account.accountId,
        accountType: this.application.computeNode.account.accountType,
      };
      const computeNodeDetails = {
        uuid: this.application.computeNode.uuid,
        efsId: this.application.computeNode.efsId,
      };
      const formattedNewApplication = {
        ...this.application,
        account: accountDetails,
        computeNode: computeNodeDetails,
      };
      try {
        await this.createApplication(formattedNewApplication);
        EventBus.$emit("toast", {
          detail: {
            type: "success",
            msg: "Your request has been successfully submitted.",
          },
        });
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
