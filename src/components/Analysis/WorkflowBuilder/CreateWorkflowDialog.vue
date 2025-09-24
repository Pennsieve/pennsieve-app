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
        :model="workflow"
        :rules="rules"
        ref="workflowForm"
        label-position="top"
        @submit.native.prevent="handleCreateWorkflow"
      >
        <el-form-item prop="name">
          <template #label>
            <span>Name</span>
            <span class="label-helper"> required </span>
          </template>
          <el-input
            v-model="workflow.name"
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
              v-model="workflow.description"
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
              v-model="app.name"
              class="input-property"
              placeholder="Choose an App"
              @change="(value) => onAppSelectionChange(index, value)"
            >
              <el-option
                v-for="application in applications"
                :key="application.uuid"
                :label="application.name"
                :value="application.uuid"
              />
            </el-select>
          </el-form-item>

          <!-- Only show dependencies if this app is selected AND there are previous apps -->
          <el-form-item
            v-if="app.name && getPreviousApps(index).length > 0"
            class="dependency-selection"
          >
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
                  prevApp.name
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

const defaultWorkflowValues = () => ({
  name: "",
  description: "",
  apps: [],
});

const getDefaultAppSelections = () => [{ name: null, dependencies: [] }];

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
      workflow: defaultWorkflowValues(),
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
            trigger: "submit",
          },
        ],
      },
    };
  },

  async mounted() {
    try {
      await this.fetchApplications();
    } catch (error) {
      console.error("Error fetching applications:", error);
    }
  },

  computed: {
    ...mapState(["userToken", "config"]),
    ...mapState("analysisModule", ["applications"]),
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
        this.updateWorkflowApps();
      },
      deep: true,
    },
  },

  methods: {
    ...mapActions("analysisModule", ["fetchApplications", "createWorkflow"]),

    resetForm() {
      this.workflow = defaultWorkflowValues();
      this.appSelections = getDefaultAppSelections();
      this.updateWorkflowApps();

      // Clear form validation errors
      this.$nextTick(() => {
        if (this.$refs.workflowForm) {
          this.$refs.workflowForm.clearValidate();
        }
      });
    },

    addApp() {
      this.appSelections.push({ name: null, dependencies: [] });
      this.updateWorkflowApps();
    },

    removeApp(index) {
      this.appSelections.splice(index, 1);

      // Clean up dependencies that reference the removed app
      this.appSelections.forEach((app) => {
        if (app.dependencies) {
          // Remove dependencies that reference indices >= the removed index
          app.dependencies = app.dependencies
            .filter((depIndex) => depIndex < index)
            // Adjust indices for apps that come after the removed one
            .map((depIndex) => depIndex);
        }
      });

      this.updateWorkflowApps();
    },

    getPreviousApps(currentIndex) {
      return this.appSelections
        .slice(0, currentIndex)
        .filter((app) => app.name);
    },

    getAppDisplayName(appUuid) {
      // Find application by UUID and return name
      const application = this.applications.find((app) => app.uuid === appUuid);
      return application?.name || appUuid;
    },

    formatDependencies(dependencies) {
      return dependencies
        .map((depIndex) => {
          const app = this.appSelections[depIndex];
          if (app && app.name) {
            const displayName = this.getAppDisplayName(app.name);
            return `App ${depIndex + 1} (${displayName})`;
          }
          return `App ${depIndex + 1}`;
        })
        .join(", ");
    },

    onAppSelectionChange(index, value) {
      // Set the selected app UUID
      this.appSelections[index].name = value;

      // Clear dependencies for apps that come after the changed one
      // since the workflow structure may have changed
      for (let i = index + 1; i < this.appSelections.length; i++) {
        this.appSelections[i].dependencies = this.appSelections[
          i
        ].dependencies.filter((depIndex) => depIndex < index + 1);
      }

      this.updateWorkflowApps();
    },

    updateWorkflowApps() {
      this.workflow.apps = this.appSelections
        .filter((app) => app.name)
        .map((app) => app.name); // Now contains UUIDs
    },
    validateApps(rule, value, callback) {
      const hasEmptyApp = this.appSelections.some((app) => !app.name);
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

    async handleCreateWorkflow() {
      if (!this.$refs.workflowForm) {
        console.error("Form ref not found");
        return;
      }

      this.$refs.workflowForm.validate(async (valid) => {
        if (valid) {
          const processors = this.appSelections
            .filter((app) => app.name)
            .map((app, index) => {
              // Find the app data by UUID since app.name now contains UUID
              const appData = this.applications.find(
                (application) => application.uuid === app.name
              );

              // Build dependsOn array based on selected dependencies
              const dependsOn = (app.dependencies || []).map((depIndex) => {
                const dependentApp = this.appSelections[depIndex];
                const dependentAppData = this.applications.find(
                  (application) => application.uuid === dependentApp.name
                );

                return {
                  sourceUrl: dependentAppData?.source?.url,
                };
              });

              return {
                sourceUrl: appData?.source?.url,
                dependsOn: dependsOn,
              };
            });

          const formattedWorkflow = {
            name: this.workflow.name,
            description: this.workflow.description,
            processors: processors,
          };

          try {
            const result = await this.createWorkflow(formattedWorkflow);
            EventBus.$emit("toast", {
              detail: {
                type: "success",
                msg: "Your request to create a Workflow has been initiated.",
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
