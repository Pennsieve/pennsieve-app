<template>
  <el-dialog>
    <template #header>
      <bf-dialog-header slot="title" title="Delete Application" />
    </template>
    <dialog-body> </dialog-body>
  </el-dialog>
</template>

<script>
import BfDialogHeader from "../../shared/bf-dialog-header/BfDialogHeader.vue";
import DialogBody from "../../shared/dialog-body/DialogBody.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";

export default {
  name: "DeleteApplicationDialog",
  components: {
    BfDialogHeader,
    DialogBody,
    BfButton,
  },
  props: {
    dialogVisible: {
      type: Boolean,
      default: false,
    },
  },
  data: function () {
    return {};
  },
  computed: {},
  methods: {},
};
</script>

<style lang="scss" scoped>
@import "../../../assets/_variables.scss";
h2 {
  font-size: 14px;
}
.dialog-simple-buttons {
  display: flex;
  margin-top: 16px;
  justify-content: center;
  .bf-button {
    margin-left: 8px;
  }
}
</style>
