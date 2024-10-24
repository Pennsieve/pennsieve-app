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
        :rules="rules"
        label-position="top"
        ref="form"
        @submit.native.prevent="handleCreateApplication"
      >
        <el-form-item prop="name">
          <template #label>
            Name <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.name"
            placeholder="my-analysis-application"
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

        <el-form-item prop="resources.cpu">
          <template #label>
            CPU <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.resources.cpu"
            placeholder="2048"
            autofocus
          />
        </el-form-item>

        <el-form-item prop="resources.memory">
          <template #label>
            Memory <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="application.resources.memory"
            placeholder="4096"
            autofocus
          />
        </el-form-item>

        <el-form-item prop="computeNode">
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
        <el-form-item prop="source.type">
          <template #label>
            Source Type <span class="label-helper"> required </span>
          </template>
          <el-select
            ref="enum"
            v-model="application.source.type"
            class="input-property"
            filterable
            placeholder="Choose a Source Type"
          >
            <el-option
              v-for="item in sourceItems"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item prop="source.url">
          <template #label>
            Source Url <span class="label-helper"> required </span>
            <span class="url-format-info"> Format: github.com/owner/repo </span>
          </template>
          <el-input
            v-model="application.source.url"
            placeholder="github.com/owner/repo"
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
});

export default {
  name: "CreateApplicationDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
  },

  props: {
    dialogVisible: Boolean,
  },

  data() {
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
      sourceItems: [
        {
          value: "github",
          label: "Github",
        },
      ],
      rules: {
        name: [
          {
            required: true,
            message: "Please input the application name",
            trigger: "blur",
          },
          {
            max: 50,
            message: "Name cannot exceed 50 characters",
            trigger: "blur",
          },
        ],
        description: [
          {
            required: true,
            message: "Please input the description",
            trigger: "blur",
          },
        ],
        applicationType: [
          {
            required: true,
            message: "Please select an application type",
            trigger: "change",
          },
        ],
        "resources.cpu": [
          { required: true, message: "Please input the CPU", trigger: "blur" },
        ],
        "resources.memory": [
          {
            required: true,
            message: "Please input the memory",
            trigger: "blur",
          },
        ],
        computeNode: [
          { validator: this.validateComputeNode, trigger: "change" },
        ],
        "source.type": [
          {
            required: true,
            message: "Please input the source type",
            trigger: "change",
          },
        ],
        "source.url": [
          {
            required: true,
            message: "Please input the source URL",
            trigger: "blur",
          },
          {
            pattern: "^github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$",
            message: "Source URL must be in the format github.com/owner/repo",
            trigger: "blur",
          },
        ],
      },
    };
  },

  computed: {
    ...mapState(["userToken", "config"]),
    ...mapState("analysisModule", ["computeNodes"]),
  },

  mounted() {
    this.fetchComputeNodes();
  },

  methods: {
    ...mapActions("analysisModule", ["fetchComputeNodes", "createApplication"]),
    validateComputeNode(rule, value, callback) {
      if (!value || !value.uuid) {
        callback(new Error("Please select a compute node"));
      } else {
        callback();
      }
    },

    /**
     * Closes the dialog
     */
    closeDialog() {
      this.$emit("close", false);
      this.application = defaultApplicationFormValues();
      this.$refs.form.clearValidate();
    },

    /**
     * POST to API to create new application
     */
    async handleCreateApplication() {
      this.$refs.form.validate(async (valid) => {
        if (valid) {
          const accountDetails = {
            uuid: this.application.computeNode.account.uuid,
            accountId: this.application.computeNode.account.accountId,
            accountType: this.application.computeNode.account.accountType,
          };
          const computeNodeDetails = {
            uuid: this.application.computeNode.uuid,
            efsId: this.application.computeNode.efsId,
          };
          const formattedResources = {
            cpu: Number(this.application.resources.cpu),
            memory: Number(this.application.resources.memory),
          };
          const formattedSource = {
            type: this.application.source.type,
            url: `git://${this.application.source.url}`,
          };
          const formattedNewApplication = {
            ...this.application,
            account: accountDetails,
            computeNode: computeNodeDetails,
            resources: formattedResources,
            source: formattedSource,
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
        }
      });
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
