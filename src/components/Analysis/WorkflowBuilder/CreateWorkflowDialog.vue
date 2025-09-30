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

        <el-form-item class="workflow-mode-selector">
          <template #label>
            <span>Workflow Mode</span>
          </template>
          <el-radio-group v-model="workflowMode" @change="onWorkflowModeChange">
            <el-radio label="linear">Linear (automatic dependencies)</el-radio>
            <el-radio label="custom">Custom (manual dependencies)</el-radio>
          </el-radio-group>
          <div class="mode-description">
            <span v-if="workflowMode === 'linear'">
              Each app will automatically depend on the previous app in
              sequence.
            </span>
            <span v-else>
              You can manually define dependencies between apps.
            </span>
          </div>
        </el-form-item>

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
                :disabled="isAppAlreadySelected(application.uuid, index)"
              />
            </el-select>
          </el-form-item>

          <!-- Show warning if app is used multiple times -->
          <div
            v-if="app.name && isAppAlreadySelected(app.name, index)"
            class="duplicate-warning"
          >
            <i class="el-icon-warning"></i> This app is already used in this
            workflow
          </div>

          <!-- Only show dependencies if this app is selected AND there are previous apps AND in custom mode -->
          <el-form-item
            v-if="
              workflowMode === 'custom' &&
              app.name &&
              getPreviousApps(index).length > 0
            "
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
              @change="(value) => onDependencyChange(index, value)"
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

          <!-- Show linear dependency info -->
          <div
            v-if="workflowMode === 'linear' && app.name && index > 0"
            class="linear-dependency-info"
          >
            <i class="el-icon-link"></i>
            Depends on: App {{ index }} ({{
              getAppDisplayName(appSelections[index - 1].name)
            }})
          </div>
        </div>

        <!-- Display circular dependency error if exists -->
        <div v-if="circularDependencyError" class="circular-error">
          <i class="el-icon-warning"></i> {{ circularDependencyError }}
        </div>

        <!-- Display duplicate app error if exists -->
        <div v-if="duplicateAppError" class="circular-error">
          <i class="el-icon-warning"></i> {{ duplicateAppError }}
        </div>
      </el-form>
    </dialog-body>

    <template #footer>
      <bf-button
        @click="handleCreateWorkflow"
        :disabled="!!circularDependencyError || !!duplicateAppError"
      >
        Create Workflow
      </bf-button>
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
      workflowMode: "linear", // 'linear' or 'custom'
      circularDependencyError: null,
      duplicateAppError: null,
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
        this.checkForCircularDependencies();
        this.checkForDuplicateApps();
      },
      deep: true,
    },
  },

  methods: {
    ...mapActions("analysisModule", ["fetchApplications", "createWorkflow"]),

    resetForm() {
      this.workflow = defaultWorkflowValues();
      this.appSelections = getDefaultAppSelections();
      this.workflowMode = "linear";
      this.circularDependencyError = null;
      this.duplicateAppError = null;
      this.updateWorkflowApps();

      // Clear form validation errors
      this.$nextTick(() => {
        if (this.$refs.workflowForm) {
          this.$refs.workflowForm.clearValidate();
        }
      });
    },

    addApp() {
      const newIndex = this.appSelections.length;
      const newApp = { name: null, dependencies: [] };

      // In linear mode, if there are already apps, set dependency to the last app
      if (this.workflowMode === "linear" && newIndex > 0) {
        newApp.dependencies = [newIndex - 1];
      }

      this.appSelections.push(newApp);
      this.updateWorkflowApps();
    },

    removeApp(index) {
      this.appSelections.splice(index, 1);

      // In linear mode, update dependencies to maintain linear chain
      if (this.workflowMode === "linear") {
        this.appSelections.forEach((app, idx) => {
          if (idx > 0 && app.name) {
            app.dependencies = [idx - 1];
          } else {
            app.dependencies = [];
          }
        });
      } else {
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
      }

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
      // Check if this app is already selected elsewhere
      if (this.isAppAlreadySelected(value, index)) {
        // Revert the selection
        this.appSelections[index].name = null;
        this.appSelections[index].dependencies = [];

        const appName = this.getAppDisplayName(value);
        EventBus.$emit("toast", {
          detail: {
            type: "warning",
            msg: `"${appName}" is already used in this workflow. Each app can only be added once.`,
            duration: 4000,
          },
        });
        return;
      }

      // Set the selected app UUID
      this.appSelections[index].name = value;

      // In linear mode, automatically set dependency to previous app
      if (this.workflowMode === "linear" && index > 0) {
        this.appSelections[index].dependencies = [index - 1];
      } else {
        // Clear dependencies for apps that come after the changed one
        // since the workflow structure may have changed
        for (let i = index + 1; i < this.appSelections.length; i++) {
          this.appSelections[i].dependencies = this.appSelections[
            i
          ].dependencies.filter((depIndex) => depIndex < index + 1);
        }
      }

      this.updateWorkflowApps();
    },

    onDependencyChange(index, value) {
      this.appSelections[index].dependencies = value;
      this.checkForCircularDependencies();
    },

    onWorkflowModeChange(mode) {
      if (mode === "linear") {
        // Automatically set dependencies for all apps to previous app
        this.appSelections.forEach((app, index) => {
          if (index > 0 && app.name) {
            app.dependencies = [index - 1];
          } else {
            app.dependencies = [];
          }
        });
      } else {
        // In custom mode, clear all dependencies
        this.appSelections.forEach((app) => {
          app.dependencies = [];
        });
      }
      this.updateWorkflowApps();
      this.checkForCircularDependencies();
    },

    isAppAlreadySelected(appUuid, currentIndex) {
      // Check if this app is selected in any other position
      return this.appSelections.some(
        (app, index) => index !== currentIndex && app.name === appUuid
      );
    },

    checkForDuplicateApps() {
      const selectedApps = this.appSelections
        .map((app, index) => ({ uuid: app.name, index }))
        .filter((item) => item.uuid);

      const duplicates = selectedApps.filter(
        (item, index) =>
          selectedApps.findIndex((a) => a.uuid === item.uuid) !== index
      );

      if (duplicates.length > 0) {
        const firstDuplicate = duplicates[0];
        const appName = this.getAppDisplayName(firstDuplicate.uuid);
        this.duplicateAppError = `Cannot add the same app multiple times. "${appName}" is already used in this workflow.`;
      } else {
        this.duplicateAppError = null;
      }
    },

    checkForCircularDependencies() {
      // Build adjacency list for the dependency graph
      const graph = {};

      this.appSelections.forEach((app, index) => {
        if (app.name) {
          graph[index] = app.dependencies || [];
        }
      });

      // Detect cycles using DFS
      const visited = new Set();
      const recursionStack = new Set();

      const hasCycle = (node, path = []) => {
        if (recursionStack.has(node)) {
          // Found a cycle - build error message
          const cycleStart = path.indexOf(node);
          const cyclePath = [...path.slice(cycleStart), node];
          const appNames = cyclePath.map(
            (idx) =>
              `App ${idx + 1} (${this.getAppDisplayName(
                this.appSelections[idx].name
              )})`
          );
          this.circularDependencyError = `Circular dependency detected: ${appNames.join(
            " → "
          )}`;
          return true;
        }

        if (visited.has(node)) {
          return false;
        }

        visited.add(node);
        recursionStack.add(node);

        const dependencies = graph[node] || [];
        for (const dep of dependencies) {
          if (hasCycle(dep, [...path, node])) {
            return true;
          }
        }

        recursionStack.delete(node);
        return false;
      };

      // Check each node for cycles
      this.circularDependencyError = null;
      for (const node in graph) {
        if (!visited.has(parseInt(node))) {
          if (hasCycle(parseInt(node))) {
            return;
          }
        }
      }
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
      } else if (this.duplicateAppError) {
        callback(new Error(this.duplicateAppError));
      } else if (this.circularDependencyError) {
        callback(new Error(this.circularDependencyError));
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

      // Check for circular dependencies or duplicates before validation
      if (this.circularDependencyError) {
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: this.circularDependencyError,
            duration: 6000,
          },
        });
        return;
      }

      if (this.duplicateAppError) {
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: this.duplicateAppError,
            duration: 6000,
          },
        });
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

.duplicate-warning {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 4px;
  color: #fa8c16;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;

  i {
    font-size: 14px;
  }
}

.linear-dependency-info {
  margin-top: 8px;
  margin-left: 16px;
  padding: 8px 12px;
  background-color: #f0f9ff;
  border: 1px solid #b3e0ff;
  border-radius: 4px;
  color: #0066cc;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;

  i {
    font-size: 14px;
  }
}

.workflow-mode-selector {
  margin-top: 16px;
  margin-bottom: 16px;

  .mode-description {
    margin-top: 8px;
    font-size: 13px;
    color: theme.$gray_4;
    font-style: italic;
  }
}

.circular-error {
  margin-top: 16px;
  padding: 12px;
  background-color: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
  color: #f56c6c;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;

  i {
    font-size: 16px;
  }
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
