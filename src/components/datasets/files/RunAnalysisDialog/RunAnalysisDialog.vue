<template>
  <el-dialog
    :modelValue="dialogVisible"
    data-cy="runAnalysisDialog"
    :show-close="true"
    @close="closeDialog"
    v-if="processStep < lastProcessStep"
    class="run-analysis-dialog"
    width="900px"
  >
    <template #header>
      <bf-dialog-header slot="title" title="Run Analysis Workflow" />
    </template>

    <dialog-body>
      <!-- Step Indicator -->
      <div class="step-indicator">
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="step-item"
          :class="{
            active: processStep === index + 1,
            completed: processStep > index + 1,
          }"
        >
          <div class="step-number">
            <span v-if="processStep > index + 1" class="check-icon">&#10003;</span>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <div class="step-label">{{ step.title }}</div>
        </div>
      </div>

      <!-- Step Content Container -->
      <div class="step-content">
        <!-- Step 1: Configuration -->
        <div v-show="shouldShow(1)" class="step-panel">
          <div class="step-header">
            <h3 class="step-title">Configuration</h3>
            <p class="step-description">
              Select a compute node and configure basic settings for your
              analysis.
            </p>
          </div>

          <div class="config-layout">
            <!-- Required Section -->
            <div class="config-section">
              <div class="section-header">
                <span class="section-title">Compute Environment</span>
                <span class="section-badge required">Required</span>
              </div>
              <div class="section-content">
                <el-form label-position="top" class="analysis-form">
                  <el-form-item>
                    <template #label>
                      <span>Compute Node</span>
                    </template>
                    <div class="field-with-hint">
                      <el-select
                        v-model="computeNodeValue"
                        placeholder="Select a compute node"
                        @change="setSelectedComputeNode(computeNodeValue)"
                        class="config-select"
                      >
                        <el-option
                          v-for="(item, i) in enhancedComputeNodeOptions"
                          :key="i"
                          :label="item.label"
                          :value="item.value"
                          :disabled="item.disabled"
                        />
                      </el-select>
                      <p class="field-hint">
                        Choose where your analysis workflow will be executed.
                      </p>
                    </div>
                  </el-form-item>
                </el-form>
              </div>
            </div>

            <!-- Optional Section -->
            <div class="config-section">
              <div class="section-header">
                <span class="section-title">Additional Settings</span>
                <span class="section-badge optional">Optional</span>
              </div>
              <div class="section-content">
                <el-form label-position="top" class="analysis-form">
                  <div class="form-row">
                    <el-form-item class="form-col">
                      <template #label>
                        <span>Target Directory</span>
                      </template>
                      <el-input
                        v-model="targetDirectory"
                        placeholder="e.g., /output/results"
                      />
                      <p class="field-hint">
                        Where output files will be saved.
                      </p>
                    </el-form-item>

                    <el-form-item class="form-col">
                      <template #label>
                        <span>Workflow Run Name</span>
                      </template>
                      <el-input
                        v-model="name"
                        placeholder="e.g., Analysis Run 1"
                      />
                      <p class="field-hint">
                        A descriptive name to identify this run.
                      </p>
                    </el-form-item>
                  </div>
                </el-form>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Choose Workflow -->
        <div v-show="shouldShow(2)" class="step-panel">
          <div class="step-header">
            <h3 class="step-title">Select Workflow</h3>
            <p class="step-description">
              Choose a predefined workflow or configure a custom processor
              pipeline.
            </p>
          </div>

          <el-form label-position="top" class="analysis-form">
            <el-form-item>
              <template #label>
                <span>Workflow Type</span>
                <span class="label-required">*</span>
              </template>
              <el-radio-group v-model="workflowType" class="workflow-type-group">
                <el-radio-button label="named">
                  <div class="radio-content">
                    <span class="radio-title">Select Workflow</span>
                    <span class="radio-desc">Use a predefined workflow</span>
                  </div>
                </el-radio-button>
                <el-radio-button label="custom">
                  <div class="radio-content">
                    <span class="radio-title">Custom Pipeline</span>
                    <span class="radio-desc">Configure processors manually</span>
                  </div>
                </el-radio-button>
              </el-radio-group>
            </el-form-item>

            <!-- Named Workflow Selection -->
            <template v-if="workflowType === 'named'">
              <el-form-item>
                <template #label>
                  <span>Workflow</span>
                  <span class="label-required">*</span>
                </template>
                <el-select
                  v-model="workflowValue"
                  placeholder="Select Workflow"
                  @change="setSelectedWorkflow(workflowValue)"
                  class="full-width"
                >
                  <el-option
                    v-for="(item, i) in activeWorkflows"
                    :key="i"
                    :label="item.label"
                    :value="item.name"
                  />
                </el-select>
              </el-form-item>

              <!-- Workflow Details Card -->
              <div
                v-if="selectedWorkflow && selectedWorkflow.name"
                class="workflow-details-card"
              >
                <div class="card-header">
                  <h4 class="card-title">{{ selectedWorkflow.name }}</h4>
                  <span v-if="selectedWorkflow.version" class="version-badge">
                    v{{ selectedWorkflow.version }}
                  </span>
                </div>

                <p
                  v-if="selectedWorkflow.description"
                  class="card-description"
                >
                  {{ selectedWorkflow.description }}
                </p>

                <div class="card-meta">
                  <div v-if="selectedWorkflow.computeNode" class="meta-item">
                    <span class="meta-label">Compute Node</span>
                    <span class="meta-value">{{
                      selectedWorkflow.computeNode.name
                    }}</span>
                  </div>
                  <div v-if="selectedWorkflow.author" class="meta-item">
                    <span class="meta-label">Author</span>
                    <span class="meta-value">{{ selectedWorkflow.author }}</span>
                  </div>
                  <div v-if="selectedWorkflow.createdAt" class="meta-item">
                    <span class="meta-label">Created</span>
                    <span class="meta-value">{{
                      formatDate(selectedWorkflow.createdAt)
                    }}</span>
                  </div>
                </div>

                <div
                  v-if="
                    selectedWorkflow.processors &&
                    selectedWorkflow.processors.length
                  "
                  class="processors-section"
                >
                  <span class="section-label">Processors</span>
                  <div class="processors-list">
                    <a
                      v-for="processor in selectedWorkflow.processors"
                      :key="processor.sourceUrl"
                      :href="getProcessorUrl(processor)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="processor-chip"
                    >
                      {{ getProcessorUrl(processor) }}
                    </a>
                  </div>
                </div>

                <div
                  v-if="selectedWorkflow.tags && selectedWorkflow.tags.length"
                  class="tags-section"
                >
                  <span class="section-label">Tags</span>
                  <div class="tags-list">
                    <span
                      v-for="tag in selectedWorkflow.tags"
                      :key="tag"
                      class="tag-chip"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Custom Workflow Selection -->
            <template v-if="workflowType === 'custom'">
              <div class="custom-pipeline-section">
                <el-form-item>
                  <template #label>
                    <span>Preprocessor</span>
                    <span class="label-required">*</span>
                  </template>
                  <el-select
                    v-model="preprocessorValue"
                    placeholder="Select Preprocessor"
                    @change="setSelectedPreprocessor(preprocessorValue)"
                    class="full-width"
                  >
                    <el-option
                      v-for="(item, i) in preprocessorOptions"
                      :key="i"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <span>Processor</span>
                    <span class="label-required">*</span>
                  </template>
                  <el-select
                    v-model="processorValue"
                    placeholder="Select Processor"
                    @change="setSelectedProcessor(processorValue)"
                    class="full-width"
                  >
                    <el-option
                      v-for="(item, i) in processorOptions"
                      :key="i"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item>
                  <template #label>
                    <span>Postprocessor</span>
                    <span class="label-required">*</span>
                  </template>
                  <el-select
                    v-model="postprocessorValue"
                    placeholder="Select Postprocessor"
                    @change="setSelectedPostprocessor(postprocessorValue)"
                    class="full-width"
                  >
                    <el-option
                      v-for="(item, i) in postprocessorOptions"
                      :key="i"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>
              </div>
            </template>
          </el-form>
        </div>

        <!-- Step 3: Parameters -->
        <div v-show="shouldShow(3)" class="step-panel">
          <div class="step-header">
            <h3 class="step-title">Parameters</h3>
            <p class="step-description">
              Configure the parameters for your selected workflow or processor.
            </p>
          </div>

          <div v-if="workflowType === 'named'">
            <div v-if="!selectedWorkflowHasParams()" class="empty-state">
              <div class="empty-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 12h6M9 16h6" />
                </svg>
              </div>
              <p class="empty-text">
                The selected workflow has no configurable parameters.
              </p>
              <p class="empty-subtext">You can proceed to the next step.</p>
            </div>
            <div v-else class="params-table-wrapper">
              <el-table
                :data="selectedWorkflowParams"
                :border="false"
                class="params-table"
              >
                <el-table-column label="Parameter" width="200">
                  <template #default="scope">
                    <span class="param-name">{{ scope.row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Value">
                  <template #default="scope">
                    <el-input
                      v-model="scope.row.value"
                      placeholder="Enter value"
                    />
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>

          <div v-if="workflowType === 'custom'">
            <div v-if="!selectedProcessorHasParams()" class="empty-state">
              <div class="empty-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 12h6M9 16h6" />
                </svg>
              </div>
              <p class="empty-text">
                The selected processor has no configurable parameters.
              </p>
              <p class="empty-subtext">You can proceed to the next step.</p>
            </div>
            <div v-else class="params-table-wrapper">
              <el-table
                :data="selectedProcessorParams"
                :border="false"
                class="params-table"
              >
                <el-table-column label="Parameter" width="200">
                  <template #default="scope">
                    <span class="param-name">{{ scope.row.name }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="Value">
                  <template #default="scope">
                    <el-input
                      v-model="scope.row.value"
                      placeholder="Enter value"
                    />
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>

        <!-- Step 4: File Selection -->
        <div v-show="shouldShow(4)" class="step-panel">
          <div class="step-header">
            <h3 class="step-title">Select Files</h3>
            <p class="step-description">
              Choose the files to include in this analysis workflow.
            </p>
          </div>

          <div class="file-selection-header">
            <span class="selected-count">
              <strong>{{ fileCount }}</strong> file{{
                fileCount !== 1 ? "s" : ""
              }}
              selected
            </span>
          </div>

          <div class="file-browser">
            <div class="breadcrumb-wrapper">
              <breadcrumb-navigation
                is-light-background
                :ancestors="ancestorList"
                :file="file"
                :file-id="fileId"
                @navigate-breadcrumb="handleNavigateBreadcrumb"
              />
            </div>
            <div class="files-table-container">
              <analysis-files-table
                :data="files"
                :clear-selected-values="clearSelectedValues"
                @selection-change="onFileSelect"
                @click-file-label="onClickLabel"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Validation Message -->
      <div v-if="warningMessage" class="validation-message">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>{{ warningMessage }}</span>
      </div>
    </dialog-body>

    <template #footer>
      <div class="dialog-footer">
        <bf-button class="secondary" @click="advanceStep(-1)">
          {{ stepBackText }}
        </bf-button>
        <bf-button @click="advanceStep(1)">
          {{ proceedText }}
        </bf-button>
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
import { useComputeResourcesStore } from '@/stores/computeResourcesStore';
import FilesTable from "../../../FilesTable/FilesTable.vue";
import AnalysisFilesTable from "../../../FilesTable/AnalysisFilesTable.vue";
import BreadcrumbNavigation from "../BreadcrumbNavigation/BreadcrumbNavigation.vue";
import { useGetToken, useGetAllTokens } from "@/composables/useGetToken";
import { useSendXhr } from "@/mixins/request/request_composable";

export default {
  name: "IntegratedAnalysisDialog",

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
    AnalysisFilesTable,
    BreadcrumbNavigation,
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
    organizationId: {
      type: String,
      default: "",
    },
  },
  data: function () {
    return {
      processStep: 1,
      lastProcessStep: 5,
      workflowType: "named", // 'named' or 'custom'
      steps: [
        { title: "Configuration" },
        { title: "Workflow" },
        { title: "Parameters" },
        { title: "Files" },
      ],

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
      "workflows",
      "preprocessors",
      "processors",
      "postprocessors",
      "selectedFilesForAnalysis",
      "fileCount",
    ]),
    ...mapGetters(["config"]),

    // Compute nodes from the computeResourcesStore
    computeNodes() {
      const computeResourcesStore = useComputeResourcesStore()
      // Always use workspace scope if we're in an organization context
      // The organizationId should come from the current workspace context
      const currentOrgId = this.organizationId || this.$route.params.orgId || this.config.organizationId
      const scope = currentOrgId ? `workspace:${currentOrgId}` : 'account-owner'
      
      // Only return enabled nodes
      return computeResourcesStore.getScopedComputeNodes(scope)
        .filter(node => node.status === 'Enabled')
    },

    // Enhanced compute node options - nodes are already filtered by enabled status and organization
    enhancedComputeNodeOptions() {
      return this.computeNodes
        .map(node => ({
          value: node.uuid,
          label: node.name,
          disabled: false
        }))
    },

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

  async mounted() {
    this.fetchFiles();
    this.fetchWorkflows();
    this.fetchApplications();
    
    // Fetch compute nodes from computeResourcesStore instead of Vuex
    const computeResourcesStore = useComputeResourcesStore()
    const currentOrgId = this.organizationId || this.$route.params.orgId || this.config.organizationId
    const scope = currentOrgId ? `workspace:${currentOrgId}` : 'account-owner'
    await computeResourcesStore.fetchScopedComputeNodes(scope, currentOrgId)
  },

  methods: {
    ...mapActions("analysisModule", [
      "setSelectedFiles",
      "clearSelectedFiles",
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
      const url = `${this.config.api2Url}/compute/workflows/instances`;

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
        const tokens = await useGetAllTokens();
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
            "X-Refresh-Token": tokens.refreshToken,
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
      // Try to find the node directly from the computeNodes computed property first
      // This ensures we're using the same filtered list that populates the dropdown
      const nodeFromComputed = this.computeNodes.find(node => node.uuid === value)
      
      // Fallback to store lookup if not found in computed
      if (!nodeFromComputed) {
        const computeResourcesStore = useComputeResourcesStore()
        const currentOrgId = this.organizationId || this.$route.params.orgId || this.config.organizationId
        const scope = currentOrgId ? `workspace:${currentOrgId}` : 'account-owner'
        this.selectedComputeNode = computeResourcesStore.getComputeNodeById(value, scope) || {}
      } else {
        this.selectedComputeNode = nodeFromComputed
      }
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

// Step Indicator
.step-indicator {
  display: flex;
  justify-content: space-between;
  margin-bottom: 32px;
  padding: 0 16px;
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 16px;
    left: 48px;
    right: 48px;
    height: 2px;
    background-color: theme.$gray_2;
    z-index: 0;
  }
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
  flex: 1;

  .step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: theme.$gray_2;
    color: theme.$gray_4;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
    transition: all 0.2s ease;
  }

  .step-label {
    font-size: 12px;
    color: theme.$gray_4;
    font-weight: 500;
    text-align: center;
    transition: color 0.2s ease;
  }

  &.active {
    .step-number {
      background-color: theme.$purple_3;
      color: white;
    }
    .step-label {
      color: theme.$purple_3;
      font-weight: 600;
    }
  }

  &.completed {
    .step-number {
      background-color: theme.$green_1;
      color: white;
    }
    .step-label {
      color: theme.$gray_5;
    }
    .check-icon {
      font-size: 16px;
    }
  }
}

// Step Content
.step-content {
  min-height: 400px;
}

.step-panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid theme.$gray_2;

  .step-title {
    font-size: 18px;
    font-weight: 600;
    color: theme.$gray_6;
    margin: 0 0 8px 0;
  }

  .step-description {
    font-size: 14px;
    color: theme.$gray_4;
    margin: 0;
    line-height: 1.5;
  }
}

// Configuration Layout
.config-layout {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-section {
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  overflow: hidden;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background-color: white;
    border-bottom: 1px solid theme.$gray_2;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: theme.$gray_6;
  }

  .section-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    &.required {
      background-color: theme.$purple_tint;
      color: theme.$purple_3;
    }

    &.optional {
      background-color: theme.$gray_2;
      color: theme.$gray_5;
    }
  }

  .section-content {
    padding: 20px;
  }
}

.config-select {
  width: 100%;
  max-width: 400px;
  display: block;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-col {
  flex: 1;
}

.field-hint {
  font-size: 12px;
  color: theme.$gray_4;
  margin: 6px 0 0 0;
  line-height: 1.4;
}

// Form Styles
.analysis-form {
  .full-width {
    width: 100%;
  }

  .label-required {
    color: theme.$red_1;
    margin-left: 4px;
    font-weight: 400;
  }

  .label-optional {
    color: theme.$gray_4;
    font-size: 12px;
    font-weight: 400;
    margin-left: 8px;
  }
}

// Workflow Type Selection
.workflow-type-group {
  display: flex;
  gap: 12px;
  width: 100%;

  :deep(.el-radio-button) {
    flex: 1;

    .el-radio-button__inner {
      width: 100%;
      padding: 16px;
      border-radius: 8px !important;
      border: 1px solid theme.$gray_2 !important;
      box-shadow: none !important;
      height: auto;
      line-height: 1.4;
    }

    &.is-active .el-radio-button__inner {
      background-color: theme.$purple_tint;
      border-color: theme.$purple_3 !important;
      color: theme.$purple_3;
    }
  }

  .radio-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;

    .radio-title {
      font-weight: 600;
      font-size: 14px;
    }

    .radio-desc {
      font-size: 12px;
      color: theme.$gray_4;
      margin-top: 4px;
    }
  }
}

// Workflow Details Card
.workflow-details-card {
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: theme.$gray_6;
    margin: 0;
  }

  .version-badge {
    background-color: theme.$purple_1;
    color: white;
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .card-description {
    font-size: 14px;
    color: theme.$gray_5;
    line-height: 1.5;
    margin: 0 0 16px 0;
  }

  .card-meta {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 16px 0;
    border-top: 1px solid theme.$gray_2;
    border-bottom: 1px solid theme.$gray_2;
    margin-bottom: 16px;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .meta-label {
      font-size: 11px;
      color: theme.$gray_4;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-size: 13px;
      color: theme.$gray_6;
      font-weight: 500;
    }
  }

  .processors-section,
  .tags-section {
    margin-top: 12px;

    .section-label {
      display: block;
      font-size: 11px;
      color: theme.$gray_4;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
  }

  .processors-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .processor-chip {
    display: inline-block;
    background-color: theme.$purple_3;
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 0.2s ease;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      background-color: theme.$purple_2;
    }
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-chip {
    background-color: theme.$purple_tint;
    color: theme.$purple_3;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
}

// Custom Pipeline Section
.custom-pipeline-section {
  background-color: theme.$gray_1;
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  padding: 20px;
  margin-top: 8px;
}

// Empty State
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;

  .empty-icon {
    color: theme.$gray_3;
    margin-bottom: 16px;
  }

  .empty-text {
    font-size: 16px;
    color: theme.$gray_5;
    margin: 0 0 8px 0;
  }

  .empty-subtext {
    font-size: 14px;
    color: theme.$gray_4;
    margin: 0;
  }
}

// Parameters Table
.params-table-wrapper {
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  overflow: hidden;
}

.params-table {
  .param-name {
    font-weight: 500;
    color: theme.$gray_6;
  }
}

// File Selection
.file-selection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  .selected-count {
    font-size: 14px;
    color: theme.$gray_5;

    strong {
      color: theme.$purple_3;
    }
  }
}

.file-browser {
  border: 1px solid theme.$gray_2;
  border-radius: 8px;
  overflow: hidden;

  .breadcrumb-wrapper {
    padding: 12px 16px;
    background-color: theme.$gray_1;
    border-bottom: 1px solid theme.$gray_2;
  }

  .files-table-container {
    max-height: 450px;
    overflow-y: auto;
  }
}

// Validation Message
.validation-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: theme.$red_tint;
  border: 1px solid theme.$red_1;
  border-radius: 8px;
  margin-top: 16px;
  color: theme.$red_2;
  font-size: 14px;

  svg {
    flex-shrink: 0;
    color: theme.$red_1;
  }
}

// Dialog Footer
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

<style lang="scss">
.run-analysis-dialog {
  .el-dialog__body {
    padding: 24px 32px;
  }

  .el-form-item {
    margin-bottom: 20px;

    .el-form-item__label {
      font-weight: 500;
      color: #4d4d4d;
      padding-bottom: 8px;
    }
  }

  .params-table {
    .cell {
      white-space: normal;
      max-height: unset;
    }

    .el-table__header th {
      background-color: #f7f7f7;
      font-weight: 600;
    }
  }
}
</style>
