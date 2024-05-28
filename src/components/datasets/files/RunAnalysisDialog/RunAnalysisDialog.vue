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
      <div v-show="shouldShow(3)">Select Files</div>
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

import { mapState, mapActions } from "vuex";

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
    };
  },

  computed: {
    ...mapActions("analysisModule", ["fetchComputeNodes"]),
    ...mapState("analysisModule", [
      "computeNodes",
      "preprocessors",
      "processors",
      "postprocessors",
    ]),
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
  },

  methods: {
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
    runAnalysis: function () {},
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
