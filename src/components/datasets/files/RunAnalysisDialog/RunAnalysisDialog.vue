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
      <!-- Step 1: Compute Node and Basic Settings -->
      <div v-show="shouldShow(1)">
        <div class="form-section">
          <label class="field-label" for="compute-node-select"
            >Compute Node *</label
          >
          <el-select
            id="compute-node-select"
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
        </div>

        <div class="form-section">
          <label class="field-label" for="target-directory"
            >Target Directory</label
          >
          <el-input
            id="target-directory"
            class="margin"
            v-model="targetDirectory"
            placeholder="Target Directory (optional)"
          />
        </div>

        <div class="form-section">
          <label class="field-label" for="workflow-name"
            >Workflow Run Name</label
          >
          <el-input
            id="workflow-name"
            class="margin"
            v-model="name"
            placeholder="Workflow Run Name (optional)"
          />
        </div>
      </div>

      <!-- Step 2: Choose Workflow Type -->
      <div v-show="shouldShow(2)">
        <div class="form-section">
          <label class="field-label">Workflow Type *</label>
          <el-radio-group
            v-model="workflowType"
            class="workflow-type-selection"
          >
            <el-radio label="named">Select Workflow</el-radio>
            <el-radio label="custom">Processor Selection (Legacy)</el-radio>
          </el-radio-group>
        </div>

        <!-- Named Workflow Selection -->
        <div v-if="workflowType === 'named'" class="form-section">
          <label class="field-label" for="workflow-select">Workflow *</label>
          <el-select
            id="workflow-select"
            class="margin"
            v-model="workflowValue"
            placeholder="Select Workflow"
            @change="setSelectedWorkflow(workflowValue)"
          >
            <el-option
              v-for="(item, i) in activeWorkflows"
              :key="i"
              :label="item.label"
              :value="item.name"
            ></el-option>
          </el-select>

          <!-- Workflow Details Section -->
          <div
            v-if="selectedWorkflow && selectedWorkflow.name"
            class="workflow-details"
          >
            <h3 class="details-title">Workflow Details</h3>
            <div class="details-content">
              <div class="detail-item">
                <strong>Name:</strong> {{ selectedWorkflow.name }}
              </div>
              <div class="detail-item" v-if="selectedWorkflow.description">
                <strong>Description:</strong> {{ selectedWorkflow.description }}
              </div>
              <div class="detail-item" v-if="selectedWorkflow.version">
                <strong>Version:</strong> {{ selectedWorkflow.version }}
              </div>
              <div class="detail-item" v-if="selectedWorkflow.computeNode">
                <strong>Compute Node:</strong>
                {{ selectedWorkflow.computeNode.name }}
              </div>
              <div class="detail-item" v-if="selectedWorkflow.author">
                <strong>Author:</strong> {{ selectedWorkflow.author }}
              </div>
              <div class="detail-item" v-if="selectedWorkflow.createdAt">
                <strong>Created:</strong>
                {{ formatDate(selectedWorkflow.createdAt) }}
              </div>
              <div
                class="detail-item"
                v-if="
                  selectedWorkflow.processors &&
                  selectedWorkflow.processors.length
                "
              >
                <strong>Processors:</strong>
                <div class="processors-list">
                  <span
                    class="processor"
                    v-for="processor in selectedWorkflow.processors"
                    :key="processor.sourceUrl"
                  >
                    <a
                      :href="getProcessorUrl(processor)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="processor-link"
                    >
                      {{ getProcessorUrl(processor) }}
                    </a>
                  </span>
                </div>
              </div>
              <div
                class="detail-item"
                v-if="selectedWorkflow.tags && selectedWorkflow.tags.length"
              >
                <strong>Tags:</strong>
                <span
                  class="tag"
                  v-for="tag in selectedWorkflow.tags"
                  :key="tag"
                  >{{ tag }}</span
                >
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Workflow Selection -->
        <div v-if="workflowType === 'custom'" class="custom-workflow-section">
          <div class="form-section">
            <label class="field-label" for="preprocessor-select"
              >Preprocessor *</label
            >
            <el-select
              id="preprocessor-select"
              class="margin"
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
          </div>

          <div class="form-section">
            <label class="field-label" for="processor-select"
              >Processor *</label
            >
            <el-select
              id="processor-select"
              class="margin"
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
          </div>

          <div class="form-section">
            <label class="field-label" for="postprocessor-select"
              >Postprocessor *</label
            >
            <el-select
              id="postprocessor-select"
              class="margin"
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
        </div>
      </div>

      <!-- Step 3: Parameters -->
      <div v-show="shouldShow(3)">
        <div v-if="workflowType === 'named'">
          <div v-if="!selectedWorkflowHasParams()">
            The selected Workflow has no parameter values.
          </div>
          <el-form v-if="selectedWorkflowHasParams()">
            <el-form-item prop="parameters" id="paramsInput">
              <el-table
                :data="selectedWorkflowParams"
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

        <div v-if="workflowType === 'custom'">
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
      </div>

      <!-- Step 4: File Selection -->
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
  name: "IntegratedAnalysisDialog",

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
      workflowType: "named", // 'named' or 'custom'

      // Compute Node
      computeNodeOptions: [],
      computeNodeValue: "",
      selectedComputeNode: {},

      // Named Workflow
      workflowOptions: [],
      workflowValue: "",
      selectedWorkflow: {},
      selectedWorkflowParams: [],

      // Custom Workflow
      preprocessorOptions: [],
      preprocessorValue: "",
      selectedPreprocessor: {},
      processorOptions: [],
      processorValue: "",
      selectedProcessor: {},
      postprocessorOptions: [],
      postprocessorValue: "",
      selectedPostprocessor: {},
      selectedProcessorParams: [],

      // File Management
      filesLoading: false,
      file: {
        content: {
          name: "",
        },
      },
      files: [],
      ancestorList: [],
      offset: 0,
      limit: 500,
      tableResultsTotalCount: 0,

      // General
      targetDirectory: "",
      name: "",
      clearSelectedValues: false,
      warningMessage: "",
    };
  },
  computed: {
    ...mapState("analysisModule", [
      "computeNodes",
      "workflows",
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
    proceedText: function () {
      return this.processStep === 4 ? "Run Analysis" : "Next";
    },
    stepBackText: function () {
      return this.processStep > 1 ? "Back" : "Cancel";
    },
    activeWorkflows: function () {
      return this.workflows.filter((workflow) => workflow.isActive);
    },
  },

  watch: {
    computeNodes: function () {
      this.formatComputeNodeOptions();
    },
    workflows: function () {
      this.formatWorkflowOptions();
    },
    selectedComputeNode: function () {
      this.formatWorkflowOptions();
      this.formatPreprocessorOptions();
      this.formatProcessorOptions();
      this.formatPostprocessorOptions();

      // Clear selections when compute node changes
      this.workflowValue = "";
      this.selectedWorkflow = {};
      this.preprocessorValue = "";
      this.selectedPreprocessor = {};
      this.processorValue = "";
      this.selectedProcessor = {};
      this.postprocessorValue = "";
      this.selectedPostprocessor = {};
    },
    selectedWorkflow: function () {
      this.selectedWorkflowParams = [];
      if (this.selectedWorkflow && this.selectedWorkflow.params) {
        for (const [key, value] of Object.entries(
          this.selectedWorkflow.params
        )) {
          this.selectedWorkflowParams.push({ name: key, value: value });
        }
      }
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
    workflowType: function () {
      // Clear selections when workflow type changes
      this.workflowValue = "";
      this.selectedWorkflow = {};
      this.preprocessorValue = "";
      this.selectedPreprocessor = {};
      this.processorValue = "";
      this.selectedProcessor = {};
      this.postprocessorValue = "";
      this.selectedPostprocessor = {};
      this.warningMessage = "";
    },
  },

  mounted() {
    this.fetchFiles();
    this.fetchComputeNodes();
    this.fetchWorkflows();
    this.fetchApplications();
  },

  methods: {
    ...mapActions("analysisModule", [
      "setSelectedFiles",
      "clearSelectedFiles",
      "fetchComputeNodes",
      "fetchWorkflows",
      "fetchApplications",
      "updateFileCount",
    ]),

    handleClearSelectedValues: function () {
      this.clearSelectedValues = !this.clearSelected;
    },

    formatDate: function (dateString) {
      if (!dateString) return "";
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    },

    getProcessorUrl: function (processor) {
      if (
        processor.sourceUrl &&
        processor.sourceUrl.startsWith("git://github.com/")
      ) {
        return processor.sourceUrl.replace(
          "git://github.com/",
          "https://github.com/"
        );
      }
      return processor.sourceUrl;
    },

    getFilesUrl: async function () {
      return useGetToken().then((token) => {
        const baseUrl = "datasets";
        const id = this.datasetId;
        return `${this.config.apiUrl}/${baseUrl}/${id}?api_key=${token}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
      });
    },

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

    onClickLabel: function (file) {
      if (file.content.packageType !== "Collection") {
        return;
      }

      this.file = file;

      useGetToken()
        .then(async (token) => {
          const url = `${this.config.apiUrl}/packages/${file.content.id}?api_key=${token}&includeAncestors=true&limit=${this.limit}&offset=${this.offset}`;
          return this.sendXhr(url).then((response) => {
            this.files = [...response.children];

            if (file.content.packageType === "Collection") {
              const newAncestor =
                this.fileId && this.fileName
                  ? {
                      content: { id: this.fileId, name: this.fileName },
                    }
                  : null;

              this.file = file;

              if (
                newAncestor &&
                !this.ancestorList.some((a) => a.content.id === this.fileId)
              ) {
                this.ancestorList = [...this.ancestorList, newAncestor];
              }

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

    closeDialog: function () {
      this.$emit("close");
      this.processStep = 1;
      this.workflowType = "named";
      this.computeNodeValue = "";
      this.selectedComputeNode = {};
      this.workflowValue = "";
      this.selectedWorkflow = {};
      this.preprocessorValue = "";
      this.selectedPreprocessor = {};
      this.processorValue = "";
      this.selectedProcessor = {};
      this.postprocessorValue = "";
      this.selectedPostprocessor = {};
      this.clearSelectedFiles();
      this.updateFileCount();
      this.targetDirectory = "";
      this.name = "";
      this.handleClearSelectedValues();
      this.warningMessage = "";
    },

    advanceStep: async function (step) {
      let isValid = true;

      if (this.processStep === 1 && step === 1) {
        isValid = this.validateNode();
      }
      if (this.processStep === 2 && step === 1) {
        isValid = this.validateWorkflowSelection();
      }

      if (isValid) {
        this.processStep += step;
      }

      if (this.processStep === 0) {
        this.closeDialog();
      }

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

    validateWorkflowSelection: function () {
      if (this.workflowType === "named") {
        if (this.workflowValue) {
          this.warningMessage = "";
          return true;
        } else {
          this.warningMessage = "please select a workflow";
          return false;
        }
      } else if (this.workflowType === "custom") {
        if (
          this.preprocessorValue &&
          this.processorValue &&
          this.postprocessorValue
        ) {
          this.warningMessage = "";
          return true;
        } else {
          this.warningMessage = "please select all processors";
          return false;
        }
      }
      return false;
    },

    selectedWorkflowHasParams: function () {
      return this.selectedWorkflowParams.length > 0;
    },

    selectedProcessorHasParams: function () {
      return this.selectedProcessorParams.length > 0;
    },

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

      let body;

      if (this.workflowType === "named") {
        // Named workflow API callƒ
        let paramsObject = {};
        if (this.selectedWorkflowParams.length > 0) {
          let paramsEntries = [];
          this.selectedWorkflowParams.forEach((param) => {
            paramsEntries.push([param.name, param.value]);
          });
          paramsObject = Object.fromEntries(paramsEntries);
        }

        body = {
          datasetId: this.datasetId,
          packageIds: arrayOfPackageIds,
          computeNode: {
            uuid: this.selectedComputeNode.uuid,
            computeNodeGatewayUrl:
              this.selectedComputeNode.computeNodeGatewayUrl,
          },
          name: this.name,
          workflowUuid: this.selectedWorkflow.uuid,
          params: {
            target_path: this.targetDirectory,
            ...paramsObject,
          },
        };
      } else {
        // Custom workflow API call
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
            applicationContainerName:
              application.applicationContainerName || "",
            applicationType: application.applicationType || "",
            params: paramsObject,
            commandArguments: application.commandArguments || [],
          };
        };

        body = {
          datasetId: this.datasetId,
          packageIds: arrayOfPackageIds,
          computeNode: {
            uuid: this.selectedComputeNode.uuid,
            computeNodeGatewayUrl:
              this.selectedComputeNode.computeNodeGatewayUrl,
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
      }

      try {
        const userToken = await useGetToken();
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify(body),
        });

        if (response.ok || (response.status >= 200 && response.status < 300)) {
          EventBus.$emit("toast", {
            detail: {
              msg: "Your workflow has been successfully initiated!",
              type: "success",
            },
          });
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err) {
        console.error(err);
        EventBus.$emit("toast", {
          detail: {
            msg: "Failed to initiate workflow. Please try again.",
            type: "error",
          },
        });
      } finally {
        this.closeDialog();
      }
    },

    shouldShow: function (key) {
      return this.processStep === key;
    },

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

    formatWorkflowOptions: function () {
      if (!this.workflows) {
        return;
      }

      let filteredWorkflows = this.workflows;

      if (this.selectedComputeNode.uuid) {
        filteredWorkflows = this.workflows.filter(
          (workflow) =>
            workflow.computeNode &&
            this.selectedComputeNode.uuid === workflow.computeNode.uuid
        );
      }

      this.workflowOptions = filteredWorkflows.map((workflow) => {
        return {
          value: workflow.name,
          label: workflow.name,
        };
      });
    },

    formatProcessorOptions: function () {
      if (!this.processors || !this.selectedComputeNode.uuid) {
        this.processorOptions = [];
        return;
      }

      const filteredProcessors = this.processors.filter(
        (processor) =>
          processor.computeNode &&
          this.selectedComputeNode.uuid === processor.computeNode.uuid
      );

      this.processorOptions = filteredProcessors.map((processor) => {
        return {
          value: processor.name,
          label: processor.name,
        };
      });
    },

    formatPreprocessorOptions: function () {
      if (!this.preprocessors || !this.selectedComputeNode.uuid) {
        this.preprocessorOptions = [];
        return;
      }

      const filteredPreprocessors = this.preprocessors.filter(
        (preprocessor) =>
          preprocessor.computeNode &&
          this.selectedComputeNode.uuid === preprocessor.computeNode.uuid
      );

      this.preprocessorOptions = filteredPreprocessors.map((preprocessor) => {
        return {
          value: preprocessor.name,
          label: preprocessor.name,
        };
      });
    },

    formatPostprocessorOptions: function () {
      if (!this.postprocessors || !this.selectedComputeNode.uuid) {
        this.postprocessorOptions = [];
        return;
      }

      const filteredPostprocessors = this.postprocessors.filter(
        (postprocessor) =>
          postprocessor.computeNode &&
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

    setSelectedComputeNode: function (value) {
      this.selectedComputeNode = this.computeNodes.find(
        (computeNode) => computeNode.name === value
      );
    },

    setSelectedWorkflow: function (value) {
      this.selectedWorkflow = this.workflows.find(
        (workflow) => workflow.name === value
      );
    },

    setSelectedPreprocessor: function (value) {
      this.selectedPreprocessor = this.preprocessors.find(
        (preprocessor) =>
          preprocessor.name === value &&
          this.selectedComputeNode.uuid === preprocessor.computeNode.uuid
      );
    },

    setSelectedProcessor: function (value) {
      this.selectedProcessor = this.processors.find(
        (processor) =>
          processor.name === value &&
          this.selectedComputeNode.uuid === processor.computeNode.uuid
      );
    },

    setSelectedPostprocessor: function (value) {
      this.selectedPostprocessor = this.postprocessors.find(
        (postprocessor) =>
          postprocessor.name === value &&
          this.selectedComputeNode.uuid === postprocessor.computeNode.uuid
      );
    },

    navigateToFile: function (id) {
      this.fetchFilesForAnalysisDialog(this.offset, this.limit, id);
    },

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
@use "../../../../styles/theme";

.form-section {
  margin-bottom: 20px;

  .field-label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: theme.$gray_4;
    font-size: 14px;
  }
}

.workflow-type-selection {
  margin: 16px 0;

  .el-radio {
    margin-right: 24px;
    font-size: 14px;
  }
}

.custom-workflow-section {
  margin-top: 20px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.workflow-details {
  margin-top: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;

  .details-title {
    margin: 0 0 15px 0;
    color: theme.$gray_5;
    font-size: 16px;
    font-weight: 600;
  }

  .details-content {
    .detail-item {
      margin-bottom: 10px;
      font-size: 14px;
      line-height: 1.4;

      strong {
        color: theme.$gray_5;
        margin-right: 8px;
      }

      .tag {
        display: inline-block;
        background-color: theme.$purple_1;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        margin-right: 5px;
        margin-left: 5px;
      }

      .processors-list {
        margin-top: 5px;

        .processor {
          display: inline-block;
          margin-right: 8px;
          margin-bottom: 4px;
        }

        .processor-link {
          display: inline-block;
          background-color: #1a365d !important;
          color: white !important;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          text-decoration: none !important;
          transition: background-color 0.2s ease;

          &:hover {
            background-color: #2c5282 !important;
            text-decoration: none !important;
            color: white !important;
          }

          &:visited {
            color: white !important;
          }
        }

        .processor-text {
          display: inline-block;
          background-color: theme.$purple_2;
          color: white;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }
      }
    }

    .detail-item:last-child {
      margin-bottom: 0;
    }
  }
}

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
  color: theme.$purple_2;
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
  color: theme.$red_2;
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
