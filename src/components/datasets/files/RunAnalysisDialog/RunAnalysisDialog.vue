<template>
  <el-dialog
    :modelValue="dialogVisible"
    data-cy="runAnalysisDialog"
    :show-close="true"
    @close="closeDialog"
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
        <div>Selected Files: {{ selectedFilesForAnalysis.length }}</div>
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
    };
  },
  computed: {
    ...mapState("analysisModule", [
      "computeNodes",
      "preprocessors",
      "processors",
      "postprocessors",
      "selectedFilesForAnalysis",
    ]),
    ...mapGetters(["userToken", "config"]),

    /**
     * Item has files
     */
    // hasFiles: function () {
    //   return this.files.length > 0;
    // },
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
      return this.processStep === 3 ? "Run Analysis" : "Next";
    },
    stepBackText: function () {
      return this.processStep > 1 ? "Back" : "Cancel";
    },
  },

  watch: {
    computeNodes: function () {
      this.formatComputeNodeOptions();
    },
    processors: function () {
      this.formatProcessorOptions();
    },
    preprocessors: function () {
      this.formatPreprocessorOptions();
    },
    postprocessors: function () {
      this.formatPostprocessorOptions();
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
      "setSelectedFile",
      "fetchComputeNodes",
      "fetchApplications",
    ]),
    /**
     * Get files URL for dataset
     * @returns {String}
     */
    getFilesUrl: function () {
      if (this.config.apiUrl && this.userToken) {
        const baseUrl = "datasets";
        const id = this.datasetId;

        return `${this.config.apiUrl}/${baseUrl}/${id}?api_key=${this.userToken}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
      }
    },
    /**
     * Send API request to get files for item
     */
    fetchFiles: function () {
      this.sendXhr(this.getFilesUrl())
        .then((response) => {
          this.files = [...response.children];
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

      const url = `${this.config.apiUrl}/packages/${file.content.id}?api_key=${this.userToken}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;

      this.sendXhr(url)
        .then((response) => {
          this.files = [...response.children];
        })
        .catch((response) => {
          this.handleXhrError(response);
        });

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
    },
    onFileSelect: function (selectedFiles) {
      if (this.selectedFilesForAnalysis.length) {
        selectedFiles.forEach((file) => {
          const condition = !this.selectedFilesForAnalysis.find(
            (globalSelectedFile) =>
              globalSelectedFile.content.id === file.content.id
          );
          if (condition) {
            this.setSelectedFile(file);
          }
          return;
        });
      } else {
        this.setSelectedFiles(selectedFiles);
      }
      if (selectedFiles.length === 0) {
        this.clearSelectedFiles();
      }

      // this.setSelectedFiles(selectedFiles);
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
      this.targetDirectory = "";
    },
    /**
     * Manages the Multi Step Functionality
     */
    advanceStep: function (step) {
      this.processStep += step;
      if (this.processStep === 0) {
        this.closeDialog();
      }

      if (this.processStep > 3) {
        try {
          this.runAnalysis();
        } catch {
        } finally {
          this.closeDialog();
        }
      }
    },
    /**
     * Run Analaysis Workflow on Selected Files
     */
    runAnalysis: function () {
      const url = `${this.config.api2Url}/workflows/instances`;

      const packageIds = this.selectedFilesForAnalysis.map((file) => {
        return pathOr("", ["content", "id"], file);
      });

      const formatApplication = (application) => {
        return {
          uuid: application.uuid || "",
          applicationId: application.applicationId || "",
          applicationContainerName: application.applicationContainerName || "",
          applicationType: application.applicationType || "",
          params: application.params || {},
          commandArguments: application.commandArguments || [],
        };
      };

      const body = {
        datasetId: this.datasetId,
        packageIds: packageIds,
        computeNode: {
          uuid: this.selectedComputeNode.uuid,
          computeNodeGatewayUrl: this.selectedComputeNode.computeNodeGatewayUrl,
        },
        workflow: [
          formatApplication(this.selectedPreprocessor),
          formatApplication(this.selectedProcessor),
          formatApplication(this.selectedPostprocessor),
        ],
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
              msg: "Your workflow has been successfully initiated!",
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
      this.processorOptions = this.processors.map((processor) => {
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
      this.preprocessorOptions = this.preprocessors.map((preprocessor) => {
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
      this.postprocessorOptions = this.postprocessors.map((postprocessor) => {
        return {
          value: postprocessor.name,
          label: postprocessor.name,
        };
      });
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
        (preprocessor) => preprocessor.name === value
      );
    },
    /**
     * Set Selected Processor
     */
    setSelectedProcessor: function (value) {
      this.selectedProcessor = this.processors.find(
        (processor) => processor.name === value
      );
    },
    /**
     * Set Selected Postprocessor
     */
    setSelectedPostprocessor: function (value) {
      this.selectedPostprocessor = this.postprocessors.find(
        (postprocessor) => postprocessor.name === value
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
      let url;
      if (this.ancestorList.length === 0) {
        url = this.getFilesUrl();
      } else {
        url = `${this.config.apiUrl}/packages/${id}?api_key=${this.userToken}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
      }

      this.sendXhr(url)
        .then((response) => {
          this.files = [...response.children];
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
  max-height: 450px;
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
</style>
