<template>
  <div class="workflows-list-item-wrapper">
    <div
      v-if="workflow.status === 'NOT_STARTED' || workflow.status === ''"
      :class="computedClass"
      @click="$emit('select-workflow', workflow)"
    >
      <IconWaitingCircle class="icon neutral" />
      <div class="text">
        <div class="workflow-name">
          Workflow Run:
          {{ workflow.name.length ? workflow.name : "No Custom Name" }}
        </div>
        <div>Workflow UUID: {{ workflow.uuid }}</div>
        <div>Compute Node UUID: {{ workflow.computeNode.uuid }}</div>
        <div v-if="workflow.startedAt">
          Started At: {{ formatDateAndTimeFNS(workflow.startedAt) }}
        </div>
        <div v-if="workflow.status">Status: {{ workflow.status }}</div>
      </div>
    </div>
    <div
      v-if="workflow.status === 'STARTED'"
      :class="computedClass"
      @click="$emit('select-workflow', workflow)"
    >
      <IconWaitingCircle class="icon success" />
      <div class="text">
        <div class="workflow-name">
          Workflow Run:
          {{ workflow.name.length ? workflow.name : "No Custom Name" }}
        </div>
        <div>Workflow UUID: {{ workflow.uuid }}</div>
        <div>Compute Node UUID: {{ workflow.computeNode.uuid }}</div>
        <div>Started At: {{ formatDateAndTimeFNS(workflow.startedAt) }}</div>
        <div>Status: {{ workflow.status }}</div>
      </div>
      <div v-if="enableCancelWorkflow">
        <el-tooltip
          class="box-item"
          effect="dark"
          content="Cancel this workflow"
          placement="top-start"
        >
          <el-button :size="'default'" @click="showCancelWorkflowDialog">
            <el-icon>
              <CircleClose />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>
  </div>
  <div
    v-if="workflow.status === 'FAILED'"
    :class="computedClass"
    @click="$emit('select-workflow', workflow)"
  >
    <div class="icon failure">×</div>
    <div class="text">
      <div class="workflow-name">
        Workflow Run:
        {{ workflow.name.length ? workflow.name : "No Custom Name" }}
      </div>
      <div>Workflow UUID: {{ workflow.uuid }}</div>
      <div>Compute Node UUID: {{ workflow.computeNode.uuid }}</div>
      <div>Started At: {{ formatDateAndTimeFNS(workflow.startedAt) }}</div>
      <div>Completed At: {{ formatDateAndTimeFNS(workflow.completedAt) }}</div>
      <div>Status: {{ workflow.status }}</div>
    </div>
  </div>

  <div
    v-if="workflow.status === 'SUCCEEDED'"
    @click="$emit('select-workflow', workflow)"
  >
    <div :class="computedClass" @click="$emit('select-workflow', workflow)">
      <IconCheck class="icon completed" />
      <div class="text">
        <div class="workflow-name">
          Workflow Run:
          {{ workflow.name.length ? workflow.name : "No Custom Name" }}
        </div>
        <div>
          Workflow UUID: <br />
          {{ workflow.uuid }}
        </div>
        <div>Compute Node UUID: {{ workflow.computeNode.uuid }}</div>
        <div>Started At: {{ formatDateAndTimeFNS(workflow.startedAt) }}</div>
        <div>
          Completed At: {{ formatDateAndTimeFNS(workflow.completedAt) }}
        </div>
        <div>Status: {{ workflow.status }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import FormatDate from "../../../mixins/format-date";
import { CircleClose } from "@element-plus/icons-vue";
import { mapState, mapMutations } from "vuex";
import * as site from "../../../site-config/site.json";

export default {
  name: "WorkflowsListItem",

  emits: ["select-workflow"],

  components: {
    CircleClose,
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

  computed: {
    ...mapState("analysisModule", ["selectedWorkflowActivity"]),
    computedClass: function () {
      const workflow = this?.workflow?.uuid;

      const selectedWorkflow = this?.selectedWorkflowActivity?.uuid;

      const isSelected = workflow === selectedWorkflow;

      if (isSelected) {
        return "box selected";
      } else {
        return "box";
      }
    },
  },

  data: () => {
    return {
      enableCancelWorkflow: site.environment !== "prod",
    };
  },

  methods: {
    ...mapMutations("analysisModule", {
      showCancelWorkflowDialog: "SHOW_CANCEL_WORKFLOW_DIALOG",
    }),
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

/* Common styles for the box */
.box {
  display: flex;
  align-items: center;
  padding: 10px;
  margin: 5px 0;
  border: 1px solid theme.$gray_3;
  border-radius: 5px;
  font-family: Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: theme.$black;
  background-color: theme.$white;
  width: 425px;

  button {
    font-size: 26px;
  }
}

.box {
  &:hover {
    border: 2px solid theme.$black;
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
  border-color: theme.$status_green;
}

.success {
  color: theme.$status_green;
}

.failure {
  color: theme.$status_red;
}

.completed {
  color: theme.$status_green;
}

.neutral {
  color: theme.$gray_4;
}

.box.success .icon {
  background-color: theme.$white;
  color: theme.$status_green;
  box-sizing: border-box;
  font-weight: bold;
}

.box.completed .icon {
  background-color: theme.$gray_1;
  color: theme.$gray_4;
  box-sizing: border-box;
  font-weight: bold;
}

.selected {
  border: 2px solid theme.$black;
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
  color: theme.$gray_4;
}

.concepts-list-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .concept-list-count {
    color: theme.$gray_6;
  }
}

.workflows-list-item-wrapper {
  cursor: pointer;
}

.concepts-list-item-tooltip {
  max-width: 200px;
}
</style>
