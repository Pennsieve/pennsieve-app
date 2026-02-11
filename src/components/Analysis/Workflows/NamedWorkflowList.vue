<template>
  <bf-stage element-loading-background="transparent">
    <div v-if="workflows.length" class="workflow-list-container">
      <div class="filter-bar">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          class="filter-btn"
          :class="{ active: statusFilter === option.value }"
          @click="statusFilter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="workflow-list">
        <NamedWorkflowListItem
          v-for="workflow in filteredWorkflows"
          :key="workflow.id"
          :workflow="workflow"
        />
      </div>
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

  data() {
    return {
      statusFilter: "active",
      filterOptions: [
        { label: "All", value: "all" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
    };
  },

  computed: {
    ...mapState(["activeOrganization"]),
    ...mapState("analysisModule", ["workflows"]),

    filteredWorkflows: function () {
      let filtered = this.workflows;
      if (this.statusFilter === "active") {
        filtered = filtered.filter((w) => w.isActive);
      } else if (this.statusFilter === "inactive") {
        filtered = filtered.filter((w) => !w.isActive);
      }
      return [...filtered].sort((a, b) => {
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

.workflow-list-container {
  margin: 16px 0;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding: 0 8px;
}

.filter-btn {
  padding: 6px 16px;
  border: 1px solid theme.$gray_3;
  border-radius: 4px;
  background: white;
  color: theme.$gray_5;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: theme.$purple_1;
    color: theme.$purple_1;
  }

  &.active {
    background: theme.$purple_1;
    border-color: theme.$purple_1;
    color: white;
  }
}

.workflow-list {
  display: flex;
  flex-direction: column;
  flex-flow: wrap;
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
