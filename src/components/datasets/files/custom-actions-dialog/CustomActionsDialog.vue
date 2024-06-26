<template>
  <el-dialog
    :modelValue="visible"
    data-cy="customActionsDialog"
    class="bf-delete-dialog"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header title="Execute Application" slot="title" />
    </template>
    <dialog-body>
      <div class="flex">
        <h2>Execute on {{ totalFiles }} {{ headline }}</h2>
        <el-select
          v-model="value"
          placeholder="Select Application"
          @change="setApplication(value)"
        >
          <el-option
            v-for="(item, i) in options"
            :key="i"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
      </div>
      <br />

      <el-input
        v-model="targetDirectory"
        placeholder="Target Directory (optional)"
      />
    </dialog-body>
    <template #footer>
      <bf-button
        class="secondary"
        data-cy="closeDeleteDialog"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        v-if="isLoading"
        data-cy="run-custom-event"
        @click="runCustomEvent"
        :disabled="false"
      >
        Execute
      </bf-button>
      <bf-button
        v-if="!isLoading"
        data-cy="run-custom-event"
        @click="runCustomEvent"
        :disabled="false"
      >
        Execute
      </bf-button>
    </template>
  </el-dialog>
</template>

<script>
import BfButton from "../../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../../shared/dialog-body/DialogBody.vue";
import Request from "../../../../mixins/request/index";
import EventBus from "../../../../utils/event-bus";
import { pathOr } from "ramda";

import { mapGetters, mapState } from "vuex";

export default {
  name: "BfDeleteDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
  },

  mixins: [Request],

  props: {
    selectedFiles: {
      type: Array,
      default: () => {},
    },
    callingFromDeleted: {
      type: Boolean,
      default: false,
    },
    selectedDeletedFiles: {
      type: Array,
      default: () => {},
    },
  },
  data: function () {
    return {
      visible: false,
      options: [],
      value: "",
      selectedApplication: {},
      isLoading: false,
      dataIsLoading: true,
      targetDirectory: "",
    };
  },

  computed: {
    ...mapGetters([
      "userToken",
      "config",
      "dataset",
      "activeOrganization",
      "userToken",
    ]),
    ...mapState("integrationsModule", ["integrations"]),
    /**
     * Checks for whether submit action should be allowed
     * @returns {Boolean}
     */
    disableRunAction: function () {
      return "false";
    },

    /**
     * Compute total files
     * @return {Number}
     */
    totalFiles: function () {
      return this.selectedFiles.length;
    },

    /**
     * Compute headline based on total files
     * @return {String}
     */
    headline: function () {
      return this.totalFiles > 1 ? "items" : "item";
    },

    /**
     * Compute copy based on total files
     * @return {String}
     */
    copy: function () {
      return this.totalFiles > 1 ? "these items" : "this item";
    },
  },

  watch: {
    /**
     * Watch file
     */
    file: function (file) {
      if (Object.keys(file).length) {
        this.packageForm.name = file.content.name;
      }
    },
    integrations: function () {
      this.formatCustomIntegrationsOptions();
    },
  },

  mounted() {
    this.formatCustomIntegrationsOptions();
  },

  methods: {
    /**
     * Set Application to be run
     */
    setApplication: function (value) {
      this.selectedApplication = this.integrations.find(
        (integration) => integration.name === value
      );
    },
    /**
     * Access integrations from global state and format options for input select
     */
    formatCustomIntegrationsOptions: function () {
      this.options = this.integrations
        .map((integration) => {
          const [eventTargetType] = [...integration.eventTargets];
          if (eventTargetType === "CUSTOM") {
            return {
              value: integration.name,
              label: integration.displayName,
            };
          }
        })
        .filter(function (element) {
          return element !== undefined;
        });
    },

    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.visible = false;
    },

    /**
     * Makes API Call to run custom event on target
     */

    runCustomEvent: function () {
      const url = `${this.config.api2Url}/integrations`;

      const packageIds = this.selectedFiles.map((file) => {
        return pathOr("", ["content", "id"], file);
      });

      const body = {
        applicationId: this.selectedApplication.id,
        datasetId: pathOr("", ["content", "id"], this.dataset),
        packageIds: packageIds,
        params: {
          target_path: this.targetDirectory,
        },
      };
      this.sendXhr(url, {
        method: "POST",
        header: {
          Authorization: `Bearer ${this.userToken}`,
        },
        body: body,
      })
        .then((response) => {
          EventBus.$emit("toast", {
            detail: {
              msg: "The selected event has been successfully initiated!",
              type: "success",
            },
          });
          this.closeDialog();
        })
        .catch((response) => {
          this.handleXhrError(response);
          EventBus.$emit("toast", {
            detail: {
              msg: "Sorry! There was an issue initiating your event",
              type: "error",
            },
          });
          this.closeDialog();
          this.targetDirectory = "";
          this.selectedApplication = {};
          this.value = "";
        });
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";

.secondary {
  margin-right: 8px;
}
.svg-icon {
  color: $app-primary-color;
}

.flex {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
