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
          class="margin-10"
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
        <div slot="body" class="bf-upload-body">
          <div class="bf-dataset-breadcrumbs">
            <breadcrumb-navigation
              is-light-background
              :ancestors="ancestorList"
              :file="file"
              :file-id="fileId"
              @navigate-breadcrumb="handleNavigateBreadcrumb(fileId)"
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
      <div v-show="shouldShow(4)">Run Analysis Workflow on Selected Files</div>
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

import { mapState, mapActions, mapGetters } from "vuex";

export default {
  name: "RunAnalysisDialog",

  components: {
    BfDialogHeader,
    DialogBody,
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
      preprocessorOptions: [],
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
      selectedFiles: [],
    };
  },
  computed: {
    ...mapState("analysisModule", [
      "computeNodes",
      "preprocessors",
      "processors",
      "postprocessors",
    ]),
    ...mapGetters(["userToken", "config"]),
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
    processorValue: function () {
      this.formatProcessorOptions();
    },
    preprocessorValue: function () {
      this.formatPreprocessorOptions();
    },
    postprocessorValue: function () {
      this.formatPostprocessorOptions();
    },
  },

  mounted() {
    this.formatComputeNodeOptions();
    this.formatPreprocessorOptions();
    this.formatProcessorOptions();
    this.formatPostprocessorOptions();
    this.fetchFiles();
  },

  methods: {
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
        console.log(this.ancestorList);
        this.file = file;
        this.navigateToFile(this.fileId);
      }
    },
    onFileSelect: function (val) {
      console.log("runs on file select with the value:", val);
      // we want to then take the selected file and assemble a cumulative array of selected files that we can select and deselect from.
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
    },
    /**
     * Manages the Multi Step Functionality
     */
    advanceStep: function (step) {
      this.processStep += step;
      if (this.processStep === 0) {
        this.closeDialog();
      }

      if (this.processStep > 4) {
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
      console.log("run Analysis has run");
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
      console.log("navigateToFile ran with the id:", id);
      this.fetchFilesAnalysisDialog(this.offset, this.limit, id);
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
        this.fetchFilesAnalysisDialog(this.offset, this.limit);
      }
    },
    /**
     * Navigate to file
     * @param {String} id
     */
    navigateToFile: function (root_node) {
      this.fetchFilesForAnalysisDialog(this.offset, this.limit, root_node);
    },
    fetchFilesForAnalysisDialog: function (
      offset,
      limit,
      root_node = undefined
    ) {
      const url = `${this.config.apiUrl}/packages/${file.content.id}?api_key=${this.userToken}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;

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

.flex {
  display: flex;
}

.margin {
  margin: 20px;
}
</style>
