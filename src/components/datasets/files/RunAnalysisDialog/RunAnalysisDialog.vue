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
      <div v-show="shouldShow(1)">Step One</div>
      <div v-show="shouldShow(2)">Step Two</div>
      <div v-show="shouldShow(3)">Step Three</div>
      <div v-show="shouldShow(4)">Step Four</div>
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
import EventBus from "../../../../utils/event-bus";
import { pathOr } from "ramda";

import { mapGetters, mapState, mapActions } from "vuex";

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
    };
  },

  computed: {
    ...mapGetters([]),
    ...mapActions("analysisModule", ["fetchComputeNodes"]),
    ...mapState(["computeNodes"]),
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

  watch: {},

  mounted() {},

  methods: {
    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.$emit("close");
      this.processStep = 1;
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
        console.log("processStep", this.processStep);
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
  },
};
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";
</style>
