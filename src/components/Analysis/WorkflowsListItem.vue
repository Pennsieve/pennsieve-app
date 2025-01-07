<template>
  <div v-if="isActive" class="box green-circle">
    <IconWaitingCircle class="icon" />
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

  <div v-if="!isActive" class="box gray-circle">
    <IconWaitingCircle class="icon" />
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
</template>

<script>
import IconRemove from "../icons/IconRemove.vue";
import IconWaitingCircle from "../icons/IconWaitingCircle.vue";
import CircleIcon from "../shared/CircleIcon/CircleIcon.vue";

export default {
  name: "WorkflowsListItem",

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

  data() {
    return {};
  },

  computed: {},

  mounted: function () {
    console.log("workflow", this.workflow);
  },

  methods: {},
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
}

/* Style for the icon (circle or X) */
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

/* Green circle box styles */
.box.green-circle {
  border-color: #14a758;
}

.box.green-circle .icon {
  background-color: #fff;
  color: #14a758;
  box-sizing: border-box;
  font-weight: bold;
}

/* Gray circle box styles */
.box.gray-circle {
  border-color: $gray_4;
}

.box.gray-circle .icon {
  background-color: #fff;
  color: $gray_4;
  box-sizing: border-box;
  font-weight: bold;
}

/* Red X box styles */
.box.red-x {
  border-color: #c14d49; /* Red border */
}

.box.red-x .icon {
  background-color: #fff;
  color: #c14d49; /* Red icon color */
  font-weight: bold; /* Make the 'X' stand out */
  border: none; /* No border for the 'X' */
}

/* Text styles (Optional, if further customization is needed) */
.text {
  display: flex;
  flex-direction: column;
}

.text .workflow-name {
  font-weight: bold;
}

.text .compute-node-name {
  font-style: italic;
  color: #666; /* Gray text */
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
