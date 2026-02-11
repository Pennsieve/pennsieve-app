<template>
  <bf-stage element-loading-background="transparent">
    <div v-if="sortedWorkflows.length" class="workflow-list">
      <NamedWorkflowListItem
        v-for="workflow in sortedWorkflows"
        :key="workflow.id"
        :workflow="workflow"
      />
    </div>
    <bf-empty-page-state v-else class="empty">
      <img
        src="../../../assets/images/illustrations/illo-collaboration.svg"
        height="240"
        width="247"
        alt="Teams illustration"
      />
      <div v-if="hasAdminRights" class="copy">
        <h2>There are no workflows yet</h2>
        <p>
          Workflows allow users to run analytic scripts on data within the
          Pennsieve platform.
        </p>
      </div>

      <div v-if="!hasAdminRights" class="copy">
        <h2>{{ orgName }} doesn't have any workflows yet.</h2>
        <p>Contact your administrator to get started working with Workflows.</p>
      </div>
    </bf-empty-page-state>
  </bf-stage>
</template>

<script>
import { mapState, mapActions } from "vuex";

import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import NamedWorkflowListItem from "./NamedWorkflowListItem.vue";

import { pathOr, propOr } from "ramda";

export default {
  name: "NamedWorkflowList",

  components: {
    BfEmptyPageState,
    BfRafter,
    NamedWorkflowListItem,
  },

  computed: {
    ...mapState(["activeOrganization"]),
    ...mapState("analysisModule", ["workflows"]),

    sortedWorkflows: function () {
      return [...this.workflows].sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1;
        }
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA;
      });
    },

    hasAdminRights: function () {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
        const isOwner = propOr(false, "isOwner", this.activeOrganization);
        return isAdmin || isOwner;
      } else {
        return false;
      }
    },

    orgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
  },

  methods: {
    ...mapActions("analysisModule", ["fetchWorkflows"]),
  },

  mounted() {
    this.fetchWorkflows();
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.workflow-list {
  display: flex;
  flex-direction: column;
  flex-flow: wrap;
  margin: 16px 0;
}

.copy {
  h2 {
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
  }

  p {
    color: #71747c;
    font-size: 14px;
    line-height: 16px;
    text-align: center;
    margin-bottom: 16px;
  }
}
</style>
