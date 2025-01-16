<template>
  <div>
    <div v-if="isActive" class="box green-box" @click="$emit('select-workflow', workflow)">
      <IconWaitingCircle class="icon" />
      <div class="text">
        <div class="workflow-name">
          Workflow UUID: <br />
          {{ workflow.uuid }}
        </div>
        <div class="compute-node-name">
          Compute Node UUID: {{ workflow.computeNode.uuid }}
        </div>
        <div class="compute-node-name">Workflow UUID: {{ workflow.uuid }}</div>
        <div>Started At: {{ formatDateOnLocale(workflow.startedAt) }}</div>
      </div>
      <div>
        <el-tooltip class="box-item" effect="dark" content="Cancel this workflow" placement="top-start">
          <el-button size="medium" @click="showCancelWorkflowDialog">
            <el-icon>
              <CircleClose />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <div v-if="!isActive" class="box gray-box">
      <IconCheck class="icon" />
      <div class="text">
        <div class="workflow-name">
          Workflow UUID: <br />
          {{ workflow.uuid }}
        </div>
        <div class="compute-node-name">
          Compute Node UUID: {{ workflow.computeNode.uuid }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import IconWaitingCircle from "../icons/IconWaitingCircle.vue";
import IconCheck from "../icons/IconCheck.vue";
import FormatDate from "../../mixins/format-date";
import { CircleClose } from '@element-plus/icons-vue'
import { mapMutations } from 'vuex';

export default {
  name: "WorkflowsListItem",

  components: {
    CircleClose
  },

  props: {
    workflow: {
      type: Object,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },

  mixins: [FormatDate],

  data() {
    return {};
  },

  computed: {},

  methods: {
    ...mapMutations('analysisModule', { showCancelWorkflowDialog: 'SHOW_CANCEL_WORKFLOW_DIALOG' })
  },
};
</script>

<style lang="scss" scoped>
@import "../../assets/_variables";

/* Common styles for the box */
.box {
  display: flex;
  align-items: center;
  padding: 10px;
  margin: 5px 0;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-family: Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #000;
  background-color: #fff;
  width: 425px;

  button {
    font-size: 26px;
  }
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 26px;
}

.box.green-box {
  border-color: #14a758;
}

.box.green-box .icon {
  background-color: #fff;
  color: #14a758;
  box-sizing: border-box;
  font-weight: bold;
}

.box.gray-box {
  border-color: $gray_4;
}

.box.gray-box .icon {
  background-color: #fff;
  color: $gray_4;
  box-sizing: border-box;
  font-weight: bold;
}

.text {
  display: flex;
  flex-direction: column;
}

.text .workflow-name {
  font-weight: bold;
}

.text .compute-node-name {
  font-style: italic;
  color: #666;
}

.concepts-list-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .concept-list-count {
    color: $gray_6;
  }
}

.model-name {
  overflow: hidden;

  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
<style>
.concepts-list-item-tooltip {
  max-width: 200px;
}
</style>
