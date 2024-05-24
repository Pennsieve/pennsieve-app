<template>
  <el-dialog
    :modelValue="dialogVisible"
    data-cy="runAnalysisDialog"
    :show-close="true"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header title="Run Analysis" slot="title" />
    </template>
    <dialog-body> </dialog-body>
    <template #footer> </template>
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
    return {};
  },

  computed: {
    ...mapGetters([]),
    ...mapState(),
  },

  watch: {},

  mounted() {},

  methods: {
    /**
     * Closes the dialog
     */
    closeDialog: function () {
      this.$emit("close");
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../../assets/_variables.scss";
</style>
