<template>
  <bf-stage element-loading-background="transparent">
    <template #actions>
      <bf-button
        v-if="hasAdminRights && isFeatureFlagEnabled()"
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

    <bf-empty-page-state v-else class="empty">
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
import CreateComputeNodeDialog from "../../Analysis/ComputeNodes/CreateComputeNodeDialog.vue";

import ComputeNodesListItem from "../ComputeNodesListItem/ComputeNodesListItem.vue";
import { pathOr, propOr } from "ramda";
import {
  isEnabledForImmuneHealth,
  isEnabledForTestOrgs,
} from "../../../utils/feature-flags.js";

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
      computeNodes: [],
      createComputeNodeDialogVisible: false,
    };
  },

  created() {
    this.fetchComputeNodes();
  },

  computed: {
    ...mapGetters(["activeOrganization", "userToken", "config", "hasFeature"]),

    hasAdminRights: function () {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
        const isOwner = propOr(false, "isOwner", this.activeOrganization);
        return isAdmin || isOwner;
      } else {
        return null;
      }
    },
    orgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
  },

  watch: {},

  beforeRouteEnter(to, from, next) {
    next((vm) => {
      if (vm.hasFeature("sandbox_org_feature")) {
        vm.$router.push({ name: "create-org" });
      }
    });
  },

  methods: {
    ...mapActions([]),
    ...mapState([]),

    isFeatureFlagEnabled: function () {
      const orgId = pathOr("", ["organization", "id"], this.activeOrganization);
      return isEnabledForTestOrgs(orgId) || isEnabledForImmuneHealth(orgId);
    },

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
      if (this.config.apiUrl && this.userToken) {
        return `${this.config.apiUrl}/webhooks`;
      }

      return "";
    },
    /**
     * Fetches Compute Nodes
     */
    // TODO: Use the fetchComputeNodes method in the analysisModule instead
    fetchComputeNodes: function () {
      const url = `${this.config.api2Url}/compute-nodes`;

      this.sendXhr(url, {
        method: "GET",
        header: {
          Authorization: `Bearer ${this.userToken}`,
        },
      })
        .then((response) => {
          this.computeNodes = response;
        })
        .catch((response) => {
          this.handleXhrError(response);
          EventBus.$emit("toast", {
            detail: {
              msg: "Sorry! There was an issue fetching your data",
              type: "error",
            },
          });
        });
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
