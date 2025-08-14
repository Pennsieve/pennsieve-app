<template>
  <div class="workflows-list scrolling-list">
    <h2 class="heading">Workflows</h2>
    <template v-if="workflowInstances.length > 0">
      <div
        class="workflows-list-loading-wrap"
        element-loading-background="#fff"
      >
        <div class="workflows-list-wrap-scroll">
          <div class="workflows-list-wrap">
            <!-- Display API data -->
            <div>
              <WorkflowsListItem
                v-for="(workflow, index) in workflowInstances"
                :key="index"
                :workflow="workflow"
                :is-active="isActive(workflow)"
                @select-workflow="handleWorkflowClick"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-if="!workflowInstances.length && !isLoading">
      <div class="no-workflows">There are no Workflows at this time.</div>
    </template>
  </div>
</template>

<script>
import { mapState, mapActions } from "vuex";

import AutoFocus from "../../../mixins/auto-focus/index";
import WorkflowsListItem from "./WorkflowsListItem.vue";

export default {
  name: "ModelsList",

  emits: ["click", "shouldReset"],

  components: {},

  mixins: [AutoFocus],

  props: {
    shouldReset: {
      type: Boolean,
      default: false,
    },
    scrollingList: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      isLoading: false,
    };
  },

  computed: {
    ...mapState("analysisModule", [
      "workflowInstances",
      "selectedWorkflowActivity",
    ]),
  },

  watch: {
    /**
     * Reset the component
     */
    shouldReset: function (val) {
      if (val) {
        this.searchText = "";
        this.$emit("shouldReset", false);
      }
    },
  },

  methods: {
    ...mapActions("analysisModule", ["setSelectedWorkflowActivity"]),
    clickModel: function (ev) {
      this.$emit("click", ev);
    },
    /**
     * Allow user to press enter key to navigate to the first item in the list
     */
    onEnter: function () {
      if (this.isInputFocused) {
        const modelLink = this.$el.querySelector(".concepts-list-item a");
        if (modelLink && this.searchText !== "") {
          modelLink.click();
        }
      }
    },
    isActive: function (workflow) {
      // if the workflow does not contain a completedAt property, it is active
      return !workflow.completedAt;
    },
    handleWorkflowClick: function (workflow) {
      this.setSelectedWorkflowActivity(workflow);
    },
  },
  mounted: async function () {
    this.autoFocus();
    this.isLoading = true;
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

:deep(.workflows-list.scrolling-list.input-wrap) {
  padding: 0 0 0 16px;
}

.el-input__inner {
  background: theme.$gray_1;
  border: none;
  border-bottom: 1px solid theme.$gray_3;
  border-radius: 0;
  padding-left: 32px;
}

.workflows-list.scrolling-list {
  box-sizing: border-box;
  height: 100%;
  display: flex;
  flex-direction: column;

  .workflows-list-wrap-scroll {
    box-sizing: border-box;
    flex: 1;
    overflow-y: auto;
    padding: 0 0 16px 8px;
  }

  .workflows-list-loading-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .input-wrap {
    padding: 8px 8px 0 8px;
  }

  .el-input {
    margin-bottom: 0;
  }
}

.workflows-list-wrap {
  background: theme.$gray_1;
  padding: 16px;
}
.group-key {
  line-height: 1;
  margin: 0;
  min-width: 20px;
}
.icon-search {
  color: theme.$app-primary-color;
}
.empty-concepts {
  img {
    height: 78px;
    width: 99px;
  }
}

.heading {
  margin: 15px;
  color: theme.$purple_3;
}

.no-workflows {
  padding: 16px;
  color: theme.$gray_3;
  text-align: center;
}
</style>
