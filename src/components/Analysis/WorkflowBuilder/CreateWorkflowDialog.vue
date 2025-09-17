<template>
  <el-dialog
    :modelValue="dialogVisible"
    @update:modelValue="dialogVisible = $event"
    class="add-integration-dialog fixed-width"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Create Workflow" />
    </template>

    <dialog-body>
      <el-form
        :model="computeNode"
        :rules="rules"
        ref="workflowForm"
        label-position="top"
        @submit.native.prevent="handleCreateComputeNode"
      >
        <el-form-item prop="name">
          <template #label>
            <span>Name</span>
            <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="computeNode.name"
            placeholder="ex: My Workflow"
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
              type="textarea"
              :rows="5"
              :maxlength="255"
              placeholder="Add a short description of the workflow"
              :show-word-limit="true"
            />
          </div>
        </el-form-item>

        <bf-button @click="addApp" type="button">Add an App</bf-button>

        <div
          v-for="(app, index) in appSelections"
          :key="index"
          class="app-selection-wrapper"
        >
          <el-form-item :prop="`apps.${index}`">
            <template #label>
              <div class="app-selection-header">
                <span>App Selection {{ index + 1 }}</span>
                <span class="label-helper"> required </span>
                <bf-button
                  v-if="appSelections.length > 1"
                  @click="removeApp(index)"
                  type="text"
                >
                  Remove
                </bf-button>
              </div>
            </template>
            <el-select
              ref="enum"
              v-model="app.account"
              class="input-property"
              placeholder="Choose an App"
              @change="onAppSelectionChange"
            >
              <el-option
                v-for="account in computeResourceAccounts"
                :key="account.accountId"
                :label="account.name || account.accountId"
                :value="account.accountId"
              />
            </el-select>
          </el-form-item>

          <el-form-item v-if="app.account" class="dependency-selection">
            <template #label>
              <span>Dependencies</span>
              <span class="label-helper"> optional </span>
            </template>
            <el-select
              v-model="app.dependencies"
              class="input-property"
              placeholder="Select dependencies (optional)"
              multiple
              collapse-tags
              collapse-tags-tooltip
            >
              <el-option
                v-for="(prevApp, prevIndex) in getPreviousApps(index)"
                :key="prevIndex"
                :label="`App ${prevIndex + 1}: ${getAppDisplayName(
                  prevApp.account
                )}`"
                :value="prevIndex"
              />
            </el-select>
            <div
              v-if="app.dependencies && app.dependencies.length > 0"
              class="dependency-info"
            >
              This app depends on: {{ formatDependencies(app.dependencies) }}
            </div>
          </el-form-item>
        </div>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button @click="handleCreateWorkflow"> Create Workflow </bf-button>
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
  apps: [],
});

const getDefaultAppSelections = () => [{ account: null, dependencies: [] }];

export default {
  name: "CreateWorkflowDialog",

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
      computeNode: defaultComputeNodeFormValues(),
      appSelections: getDefaultAppSelections(),
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
        apps: [
          {
            required: true,
            validator: this.validateApps,
            trigger: "change",
          },
        ],
      },
    };
  },

  computed: {
    ...mapState(["userToken", "config"]),
    ...mapState("analysisModule", ["computeResourceAccounts"]),
  },

  watch: {
    dialogVisible(newVal) {
      if (newVal) {
        // Reset the form when dialog opens
        this.resetForm();
      }
    },

    appSelections: {
      handler() {
        this.updateComputeNodeApps();
      },
      deep: true,
    },
  },

  methods: {
    ...mapActions("analysisModule", ["createComputeNode"]),

    resetForm() {
      this.computeNode = defaultComputeNodeFormValues();
      this.appSelections = getDefaultAppSelections();
      this.updateComputeNodeApps();

      // Clear form validation errors
      this.$nextTick(() => {
        if (this.$refs.workflowForm) {
          this.$refs.workflowForm.clearValidate();
        }
      });
    },

    addApp() {
      this.appSelections.push({ account: null, dependencies: [] });
      this.updateComputeNodeApps();
    },

    removeApp(index) {
      this.appSelections.splice(index, 1);
      // Clean up dependencies that reference the removed app
      this.appSelections.forEach((app) => {
        if (app.dependencies) {
          app.dependencies = app.dependencies
            .filter((depIndex) => depIndex < index)
            .map((depIndex) => (depIndex > index ? depIndex - 1 : depIndex));
        }
      });
      this.updateComputeNodeApps();
    },

    getPreviousApps(currentIndex) {
      return this.appSelections
        .slice(0, currentIndex)
        .filter((app) => app.account);
    },

    getAppDisplayName(accountId) {
      const account = this.computeResourceAccounts.find(
        (acc) => acc.accountId === accountId
      );
      return account?.name || accountId;
    },

    formatDependencies(dependencies) {
      return dependencies
        .map((depIndex) => {
          const app = this.appSelections[depIndex];
          const accountData = this.computeResourceAccounts.find(
            (acc) => acc.accountId === app.account
          );
          return `App ${depIndex + 1} (${accountData?.name || app.account})`;
        })
        .join(", ");
    },

    onAppSelectionChange() {
      // Clear dependencies if an app selection changes
      this.appSelections.forEach((app, index) => {
        if (app.dependencies) {
          app.dependencies = app.dependencies.filter((depIndex) => {
            return (
              this.appSelections[depIndex] &&
              this.appSelections[depIndex].account
            );
          });
        }
      });
      this.updateComputeNodeApps();
    },

    updateComputeNodeApps() {
      this.computeNode.apps = this.appSelections.map((app) => app.account);
    },

    validateApps(rule, value, callback) {
      const hasEmptyApp = this.appSelections.some((app) => !app.account);
      if (hasEmptyApp) {
        callback(new Error("Please select an app for all app selections"));
      } else {
        callback();
      }
    },

    closeDialog() {
      this.$emit("update:modelValue", false);
      this.$emit("close", false);
    },

    async handleCreateComputeNode() {
      // Update the computeNode apps before validation
      this.updateComputeNodeApps();

      if (!this.$refs.workflowForm) {
        console.error("Form ref not found");
        return;
      }

      this.$refs.workflowForm.validate(async (valid) => {
        if (valid) {
          const selectedAccounts = this.appSelections
            .filter((app) => app.account)
            .map((app, index) => {
              const accountData = this.computeResourceAccounts.find(
                (elem) => elem.accountId === app.account
              );
              return {
                ...accountData,
                dependencies: app.dependencies || [],
                order: index,
              };
            });

          const formattedWorkflow = {
            ...this.computeNode,
            processors: selectedAccounts,
          };

          try {
            const result = await this.createComputeNode(formattedWorkflow);
            EventBus.$emit("toast", {
              detail: {
                type: "success",
                msg: "Your request to create a Compute Node has been initiated.",
                duration: 8000,
              },
            });
            this.closeDialog();
          } catch (error) {
            console.error(error);
            EventBus.$emit("toast", {
              detail: {
                type: "error",
                msg: "There was a problem submitting your request.",
                duration: 6000,
              },
            });
          }
        }
      });
    },

    handleCreateWorkflow() {
      this.handleCreateComputeNode();
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.text-area-wrapper {
  width: 100%;
}

.app-selection-wrapper {
  margin-top: 16px;
}

.app-selection-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remove-app-btn {
  margin-left: auto;
  color: theme.$error-color;
  font-size: 12px;

  &:hover {
    color: darken(theme.$error-color, 10%);
  }
}

.dependency-selection {
  margin-top: 8px;
  margin-left: 16px;

  .el-form-item__label {
    font-size: 14px;
    font-weight: 400;
  }
}

.dependency-info {
  font-size: 12px;
  color: theme.$gray_4;
  margin-top: 4px;
  font-style: italic;
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
