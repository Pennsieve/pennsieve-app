<template>
  <div v-if="isActive" class="box green-circle">
    <div class="icon">●</div>
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

  <div v-if="!isActive" class="box red-x">
    <div class="icon">✖</div>
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
  width: 425px; /* Adjust the width as needed */
}

/* Style for the icon (circle or X) */
.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 16px;
}

/* Green circle box styles */
.box.green-circle {
  border-color: #0f0; /* Green border */
}

.box.green-circle .icon {
  background-color: #0f0; /* Green circle background */
  color: #fff; /* White icon color */
}

/* Red X box styles */
.box.red-x {
  border-color: #f00; /* Red border */
}

.box.red-x .icon {
  background-color: #f00; /* Red circle background */
  color: #fff; /* White icon color */
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
