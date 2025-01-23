<template>
  <bf-stage element-loading-background="transparent">
    <bf-empty-page-state v-if="showEmptyState" class="empty">
      <img
        src="../../../assets/images/illustrations/illo-collaboration.svg"
        height="240"
        width="247"
        alt="Teams illustration"
      />
      <div v-if="hasAdminRights" class="copy">
        <h2>There are no Compute Nodes registered for {{ orgName }} yet.</h2>
        <p>
          Compute Nodes are associated with an Account, and allow users in your
          organization to access compute resources to run data analysis
          applications workflows. Contact Pennsieve Support to get started with
          registering Compute Nodes for {{ orgName }}.
        </p>
      </div>
      <div v-if="!hasAdminRights" class="copy">
        <h2>{{ orgName }} doesn't have any compute nodes yet.</h2>
        <p>
          Contact your administrator to get started working with Compute Nodes
        </p>
      </div>
    </bf-empty-page-state>
    <template #actions>
      <bf-button
        :disabled="!isFeatureFlagEnabled || !hasAdminRights"
        @click="openCreateComputeNodeDialog"
      >
        Create Compute Node
      </bf-button>
    </template>
    <div v-if="computeNodes.length > 0" class="integration-list">
      <compute-nodes-list-item
        v-for="computeNode in computeNodes"
        :key="computeNode.uuid"
        :computeNode="computeNode"
      />
    </div>
    <create-compute-node-dialog
      :dialog-visible="createComputeNodeDialogVisible"
      @close="onCloseCreateComputeNodeDialog"
    />
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";

import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import Request from "../../../mixins/request";
import CreateComputeNodeDialog from "./CreateComputeNodeDialog.vue";

import ComputeNodesListItem from "./ComputeNodesListItem.vue";
import { pathOr, propOr } from "ramda";
import {
  isEnabledForSpecificOrgs,
  isEnabledForTestOrgs,
  isEnabledForAllDevOrgs,
} from "../../../utils/feature-flags.js";
import { useGetToken } from "@/composables/useGetToken";

export default {
  name: "ComputeNodesList",

  components: {
    BfEmptyPageState,
    BfRafter,
    BfButton,
    ComputeNodesListItem,
  },

  props: {},

  mixins: [Request],

  data() {
    return {
      createComputeNodeDialogVisible: false,
    };
  },

  async mounted() {
    try {
      this.fetchComputeNodes();
    } catch (err) {
      console.error(err);
    }

    try {
      this.fetchComputeResourceAccounts();
    } catch (err) {
      console.error(err);
    }
  },

  computed: {
    ...mapGetters(["activeOrganization", "config", "hasFeature"]),
    ...mapGetters(["activeOrganization", "userToken", "config", "hasFeature"]),
    ...mapState("analysisModule", ["computeNodesLoaded", "computeNodes"]),

    orgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
    showEmptyState: function () {
      return this.computeNodesLoaded && !this.computeNodes.length;
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
    isFeatureFlagEnabled: function () {
      const orgId = pathOr("", ["organization", "id"], this.activeOrganization);
      return (
        isEnabledForTestOrgs(orgId) ||
        isEnabledForSpecificOrgs(orgId) ||
        isEnabledForAllDevOrgs(this.config.apiUrl)
      );
    },
  },

  beforeRouteEnter(to, from, next) {
    next((vm) => {
      if (vm.hasFeature("sandbox_org_feature")) {
        vm.$router.push({ name: "create-org" });
      }
    });
  },

  methods: {
    ...mapActions("analysisModule", [
      "fetchComputeNodes",
      "fetchComputeResourceAccounts",
    ]),

    openCreateComputeNodeDialog: function () {
      this.createComputeNodeDialogVisible = true;
    },
    onCloseCreateComputeNodeDialog: function () {
      this.createComputeNodeDialogVisible = false;
    },
    /**
     * Model URL
     * @returns {String}
     */
    getIntegrationUrl: function () {
      return `${this.config.apiUrl}/webhooks`;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/variables";

.addIntegrationContainer {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
}

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.integration-list {
  display: flex;
  flex-direction: column;
  flex-flow: wrap;
  margin: 16px 0;
}

.description {
  max-width: 500px;
}

.reg-button {
  align-self: flex-start;
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
