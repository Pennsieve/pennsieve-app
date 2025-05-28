<template>
  <el-dialog
    :modelValue="dialogVisible"
    data-cy="runAnalysisDialog"
    :show-close="true"
    @close="closeDialog"
    v-if="processStep < lastProcessStep"
    fullscreen
  >
    <template #header>
      <bf-dialog-header slot="title" title="Run Analysis Workflow" />
    </template>

    <dialog-body>
      <div v-show="shouldShow(1)">
        <el-select
          class="margin"
          v-model="computeNodeValue"
          placeholder="Select Compute Node"
          @change="setSelectedComputeNode(computeNodeValue)"
        >
          <el-option
            v-for="(item, i) in computeNodeOptions"
            :key="i"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
        <el-input
          class="margin"
          v-model="targetDirectory"
          placeholder="Target Directory (optional)"
        />
        <el-input
          class="margin"
          v-model="name"
          placeholder="Workflow Run Name (optional)"
        />
      </div>
      <div v-show="shouldShow(2)">
        <el-select
          class="margin flex"
          v-model="preprocessorValue"
          placeholder="Select Preprocessor"
          @change="setSelectedPreprocessor(preprocessorValue)"
        >
          <el-option
            v-for="(item, i) in preprocessorOptions"
            :key="i"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
        <el-select
          class="margin flex"
          v-model="processorValue"
          placeholder="Select Processor"
          @change="setSelectedProcessor(processorValue)"
        >
          <el-option
            v-for="(item, i) in processorOptions"
            :key="i"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
        <el-select
          class="margin flex"
          v-model="postprocessorValue"
          placeholder="Select Postprocessor"
          @change="setSelectedPostprocessor(postprocessorValue)"
        >
          <el-option
            v-for="(item, i) in postprocessorOptions"
            :key="i"
            :label="item.label"
            :value="item.value"
          ></el-option>
        </el-select>
      </div>
      <div v-show="shouldShow(3)">
        <div v-if="!selectedProcessorHasParams()">
          The selected Processor has no parameter values.
        </div>
        <el-form v-if="selectedProcessorHasParams()">
          <el-form-item prop="parameters" id="paramsInput">
            <el-table
              :data="selectedProcessorParams"
              max-height="250"
              :border="true"
            >
              <el-table-column label="Name">
                <template #default="scope">
                  <el-input v-model="scope.row.name" disabled></el-input>
                </template>
              </el-table-column>
              <el-table-column label="Value">
                <template #default="scope">
                  <el-input
                    v-model="scope.row.value"
                    placeholder="Enter value"
                  ></el-input>
                </template>
              </el-table-column>
            </el-table>
          </el-form-item>
        </el-form>
      </div>
      <div v-show="shouldShow(4)">
        <div>Selected Files: {{ fileCount }}</div>
        <div slot="body" class="bf-upload-body">
          <div class="bf-dataset-breadcrumbs">
            <breadcrumb-navigation
              is-light-background
              :ancestors="ancestorList"
              :file="file"
              :file-id="fileId"
              @navigate-breadcrumb="handleNavigateBreadcrumb"
            />
          </div>
          <div class="table-container">
            <files-table
              :data="files"
              :clear-selected-values="clearSelectedValues"
              withinRunAnalysisDialog
              :enable-download="false"
              @selection-change="onFileSelect"
              @click-file-label="onClickLabel"
            />
          </div>
        </div>
      </div>
    </dialog-body>

    <template #footer>
      <bf-button class="secondary" @click="advanceStep(-1)">
        {{ stepBackText }}
      </bf-button>
      <bf-button @click="advanceStep(1)">
        {{ proceedText }}
      </bf-button>
      <div class="warning-message-div">
        {{ warningMessage }}
      </div>
    </template>
  </el-dialog>
</template>

<script>
import BfButton from "../../../shared/bf-button/BfButton.vue";
import BfDialogHeader from "../../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../../shared/dialog-body/DialogBody.vue";
import Request from "../../../../mixins/request/index";
import { isEmpty, pathOr, propOr } from "ramda";
import EventBus from "../../../../utils/event-bus";
import { mapState, mapActions, mapGetters } from "vuex";
import FilesTable from "../../../FilesTable/FilesTable.vue";
import { useGetToken } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";

export default {
  name: "RunAnalysisDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    FilesTable,
    BfButton,
  },

  mixins: [Request],

  props: {
    dialogVisible: {
      type: Boolean,
      default: false,
    },
    datasetId: {
      type: String,
      default: "",
    },
  },
  data: function () {
    return {
      processStep: 1,
      lastProcessStep: 5,
      computeNodeOptions: [],
      computeNodeValue: "",
      selectedComputeNode: {},
      preprocessorOptions: [],
      preprocessorValue: "",
      selectedPreprocessor: {},
      processorOptions: [],
      processorValue: "",
      selectedProcessor: {},
      postprocessorOptions: [],
      postprocessorValue: "",
      selectedPostprocessor: {},
      filesLoading: false,
      file: {
        content: {
          name: "",
        },
      },
      files: [],
      ancestorList: [],
      offset: 0,
      limit: 100,
      tableResultsTotalCount: 0,
      targetDirectory: "",
      name: "",
      clearSelectedValues: false,
      warningMessage: "",
      selectedProcessorParams: [],
      warningMessage: "",
    };
  },
  computed: {
    ...mapState("analysisModule", [
      "computeNodes",
      "preprocessors",
      "processors",
      "postprocessors",
      "selectedFilesForAnalysis",
      "fileCount",
    ]),
    ...mapGetters(["config"]),

    fileId() {
      return pathOr(
        propOr("", "node_id", this.file),
        ["content", "id"],
        this.file
      );
    },
    fileName() {
      return pathOr(
        propOr("", "name", this.file),
        ["content", "name"],
        this.file
      );
    },
    /**
     * Computes create property CTA
     * @returns {String}
     */
    proceedText: function () {
      return this.processStep === 4 ? "Run Analysis" : "Next";
    },
    stepBackText: function () {
      return this.processStep > 1 ? "Back" : "Cancel";
    },
  },

  watch: {
    computeNodes: function () {
      this.formatComputeNodeOptions();
    },
    selectedComputeNode: function () {
      this.formatPreprocessorOptions();
      this.formatProcessorOptions();
      this.formatPostprocessorOptions();
    },
    selectedProcessor: function () {
      this.selectedProcessorParams = [];
      if (this.selectedProcessor && this.selectedProcessor.params) {
        for (const [key, value] of Object.entries(
          this.selectedProcessor.params
        )) {
          this.selectedProcessorParams.push({ name: key, value: value });
        }
      }
    },
  },

  mounted() {
    this.fetchFiles();
    this.fetchComputeNodes();
    this.fetchApplications();
  },

  methods: {
    ...mapActions("analysisModule", [
      "setSelectedFiles",
      "clearSelectedFiles",
      "fetchComputeNodes",
      "fetchApplications",
      "updateFileCount",
    ]),
    handleClearSelectedValues: function () {
      this.clearSelectedValues = !this.clearSelected;
    },
    /**
     * Get files URL for dataset
     * @returns {String}
     */
    getFilesUrl: async function () {
      return useGetToken().then((token) => {
        const baseUrl = "datasets";
        const id = this.datasetId;
        return `${this.config.apiUrl}/${baseUrl}/${id}?api_key=${token}&includeAncestors=true&limit=1000`;
      });
    },
    /**
     * Send API request to get files for item
     */
    fetchFiles: function () {
      this.getFilesUrl()
        .then((url) => {
          this.sendXhr(url).then((response) => {
            this.files = [...response.children];
          });
        })
        .catch((response) => {
          this.handleXhrError(response);
        });
    },
    /**
     * Handler for clicking file
     * @param {Object} file
     */
    onClickLabel: function (file) {
      if (file.content.packageType !== "Collection") {
        return;
      }

      this.file = file;
      this.fileId = file.content.id;
      this.fileName = file.content.name;

      useGetToken()
        .then(async (token) => {
          const url = `${this.config.apiUrl}/packages/${file.content.id}?api_key=${token}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
          return this.sendXhr(url).then((response) => {
            this.files = [...response.children];

            if (file.content.packageType === "Collection") {
              //If we click on a folder, we want to add that folder to the ancestors list
              if (this.fileId && this.fileName) {
                this.ancestorList.push({
                  content: {
                    id: this.fileId,
                    name: this.fileName,
                  },
                });
              }
              this.file = file;
              this.navigateToFile(this.fileId);
            }
          });
        })
        .catch((response) => {
          this.handleXhrError(response);
        });
    },
    onFileSelect: function (selectedFiles, parentId) {
      this.setSelectedFiles({ selectedFiles, parentId });
      this.updateFileCount();
    },
    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.$emit("close");
      this.processStep = 1;
      this.computeNodeValue = "";
      this.selectedComputeNode = {};
      this.preprocessorValue = "";
      this.selectedPreprocessor = {};
      this.processorValue = "";
      this.selectedProcessor = {};
      this.postprocessorValue = "";
      this.selectedPostprocessor = {};
      this.clearSelectedFiles();
      this.updateFileCount();
      this.targetDirectory = "";
      this.handleClearSelectedValues();
    },
    /**
     * Manages the Multi Step Functionality
     */
    advanceStep: async function (step) {
      let isValid = true;

      if (this.processStep === 1 && step === 1) {
        isValid = this.validateNode();
      }
      if (this.processStep === 2 && step === 1) {
        isValid = this.validateProcessors();
      }
      if (isValid) {
        this.processStep += step;
      }
      // When you click Cancel
      if (this.processStep === 0) {
        this.closeDialog();
      }
      // When you click "Run Analysis"
      if (this.processStep > 4) {
        await this.runAnalysis();
      }
    },
    validateNode: function () {
      if (this.computeNodeValue) {
        this.warningMessage = "";
        return true;
      } else {
        this.warningMessage = "please select a compute node";
        return false;
      }
    },
    /**
     * validate to make sure all processors have been assigned
     */
    validateProcessors: function () {
      if (
        this.preprocessorValue &&
        this.processorValue &&
        this.postprocessorValue
      ) {
        this.warningMessage = "";
        return true;
      } else {
        this.warningMessage = "please select a value for all processors";
        return false;
      }
    },
    selectedProcessorHasParams: function () {
      if (this.selectedProcessorParams.length > 0) {
        return true;
      } else {
        return false;
      }
    },
    /**
     * Run Analysis Workflow on Selected Files
     */
    runAnalysis: async function () {
      const url = `${this.config.api2Url}/workflows/instances`;

      let arrayOfPackageIds = [];
      const keysInSelectedFilesForAnalysisArray = Object.keys(
        this.selectedFilesForAnalysis
      );

      keysInSelectedFilesForAnalysisArray.forEach((key) => {
        const ids = this.selectedFilesForAnalysis[key].map((file) => {
          return pathOr("", ["content", "id"], file);
        });

        arrayOfPackageIds = [...arrayOfPackageIds, ...ids];
      });

      const formatApplication = (application, parameters) => {
        let paramsObject = {};
        if (parameters != null) {
          let paramsEntries = [];
          parameters.forEach((param) => {
            paramsEntries.push([param.name, param.value]);
          });
          paramsObject = Object.fromEntries(paramsEntries);
        }
        return {
          name: application.name || "",
          description: application.description || "",
          uuid: application.uuid || "",
          applicationId: application.applicationId || "",
          applicationContainerName: application.applicationContainerName || "",
          applicationType: application.applicationType || "",
          params: paramsObject,
          commandArguments: application.commandArguments || [],
        };
      };

      const body = {
        datasetId: this.datasetId,
        packageIds: arrayOfPackageIds,
        computeNode: {
          uuid: this.selectedComputeNode.uuid,
          computeNodeGatewayUrl: this.selectedComputeNode.computeNodeGatewayUrl,
        },
        name: this.name,
        workflow: [
          formatApplication(this.selectedPreprocessor, null),
          formatApplication(
            this.selectedProcessor,
            this.selectedProcessorParams
          ),
          formatApplication(this.selectedPostprocessor, null),
        ],
        params: {
          target_path: this.targetDirectory,
        },
      };

      const token = await useGetToken();

      try {
        this.sendXhr(url, {
          method: "POST",
          header: {
            Authorization: `Bearer ${token}`,
          },
          body: body,
        });

        EventBus.$emit("toast", {
          detail: {
            msg: "Your workflow has been successfully initiated!",
            type: "success",
          },
        });
      } catch (err) {
        console.error(err);
        this.closeDialog();
      } finally {
        this.closeDialog();
        this.targetDirectory = "";
        this.selectedApplication = {};
        this.value = "";
      }
    },
    /**
     * Determines if tab content is active
     * @param {number} key
     * @param {String} type
     * @returns {Boolean}
     */
    shouldShow: function (key) {
      return this.processStep === key;
    },
    /**
     * Access integrations from global state and format options for input select
     */
    formatComputeNodeOptions: function () {
      if (!this.computeNodes) {
        return;
      }
      this.computeNodeOptions = this.computeNodes.map((computeNode) => {
        return {
          value: computeNode.name,
          label: computeNode.name,
        };
      });
    },
    /**
     * Access processors from global state and format options for input select
     */
    formatProcessorOptions: function () {
      const filteredProcessors = this.processors.filter(
        (processor) =>
          this.selectedComputeNode.uuid === processor.computeNode.uuid
      );

      this.processorOptions = filteredProcessors.map((processor) => {
        return {
          value: processor.name,
          label: processor.name,
        };
      });
    },
    /**
     * Access preprocessors from global state and format options for input select
     */
    formatPreprocessorOptions: function () {
      const filteredPreprocessors = this.preprocessors.filter(
        (preprocessor) =>
          this.selectedComputeNode.uuid === preprocessor.computeNode.uuid
      );
      this.preprocessorOptions = filteredPreprocessors.map((preprocessor) => {
        return {
          value: preprocessor.name,
          label: preprocessor.name,
        };
      });
    },
    /**
     * Access postprocessors from global state and format options for input select
     */
    formatPostprocessorOptions: function () {
      const filteredPostprocessors = this.postprocessors.filter(
        (postprocessor) =>
          this.selectedComputeNode.uuid === postprocessor.computeNode.uuid
      );
      this.postprocessorOptions = filteredPostprocessors.map(
        (postprocessor) => {
          return {
            value: postprocessor.name,
            label: postprocessor.name,
          };
        }
      );
    },
    /**
     * Set Selected Compute Node
     */
    setSelectedComputeNode: function (value) {
      this.selectedComputeNode = this.computeNodes.find(
        (computeNode) => computeNode.name === value
      );
    },
    /**
     * Set Selected Preprocessor
     */
    setSelectedPreprocessor: function (value) {
      this.selectedPreprocessor = this.preprocessors.find(
        (preprocessor) =>
          preprocessor.name === value &&
          this.selectedComputeNode.uuid === preprocessor.computeNode.uuid
      );
    },
    /**
     * Set Selected Processor
     */
    setSelectedProcessor: function (value) {
      this.selectedProcessor = this.processors.find(
        (processor) =>
          processor.name === value &&
          this.selectedComputeNode.uuid === processor.computeNode.uuid
      );
    },
    /**
     * Set Selected Postprocessor
     */
    setSelectedPostprocessor: function (value) {
      this.selectedPostprocessor = this.postprocessors.find(
        (postprocessor) =>
          postprocessor.name === value &&
          this.selectedComputeNode.uuid === postprocessor.computeNode.uuid
      );
    },
    /**
     * Navigate to file
     * @param {String} id
     */
    navigateToFile: function (id) {
      this.fetchFilesForAnalysisDialog(this.offset, this.limit, id);
    },
    /**
     * Handler for breadcrumb overflow navigation
     * @param {String} id
     */
    handleNavigateBreadcrumb: function (id = "") {
      if (!isEmpty(id)) {
        this.navigateToFile(id);
        let index = this.ancestorList.findIndex(
          (item) => item.content.id == id
        );
        if (index >= 0) {
          this.file = this.ancestorList[index];
          if (this.ancestorList.length - index - 1 > 0)
            this.ancestorList.splice(
              index,
              this.ancestorList.length - index - 1
            );
          else this.ancestorList.splice(0, this.ancestorList.length);
        }
      } else {
        this.ancestorList = [];
        this.file = {};
        this.fetchFilesForAnalysisDialog(this.offset, this.limit, id);
      }
    },
    fetchFilesForAnalysisDialog: function (offset, limit, id = null) {
      useGetToken()
        .then(async (token) => {
          let url;
          if (this.ancestorList.length === 0) {
            url = await this.getFilesUrl();
          } else {
            url = `${this.config.apiUrl}/packages/${id}?api_key=${token}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
          }

          return this.sendXhr(url).then((response) => {
            this.files = [...response.children];
          });
        })
        .catch((response) => {
          this.handleXhrError(response);
        });
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";

.table-container {
  overflow-y: scroll;
  display: block;
  max-height: 650px;
  margin-top: 1px;
}

.flex {
  display: flex;
}

.margin {
  margin: 20px;
}

.lds-ring {
  /* change color here */
  color: #1c4c5b;
}
.lds-ring,
.lds-ring div {
  box-sizing: border-box;
}
.lds-ring {
  display: inline-block;
  position: relative;
  width: 80px;
  height: 80px;
}
.lds-ring div {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 64px;
  height: 64px;
  margin: 8px;
  border: 8px solid currentColor;
  border-radius: 50%;
  animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: currentColor transparent transparent transparent;
}
.lds-ring div:nth-child(1) {
  animation-delay: -0.45s;
}
.lds-ring div:nth-child(2) {
  animation-delay: -0.3s;
}
.lds-ring div:nth-child(3) {
  animation-delay: -0.15s;
}
@keyframes lds-ring {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.warning-message-div {
  color: red;
  margin: 3px;
}
</style>

<style lang="scss">
#paramsInput {
  .cell {
    white-space: normal;
    max-height: unset;
  }
}
</style>
