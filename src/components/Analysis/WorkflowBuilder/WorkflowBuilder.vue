<template>
  <bf-stage element-loading-background="transparent">
    <bf-empty-page-state v-if="showEmptyState" class="empty">
      <img
        src="../../../assets/images/illustrations/illo-patient-data.svg"
        height="340"
        width="347"
        alt="Teams illustration"
      />
      <div v-if="!showEmptyState" class="copy">Hello!</div>
    </bf-empty-page-state>
    <template #actions>
      <bf-button @click="openCreateWorkflowDialog"> Create Workflow </bf-button>
    </template>
    <create-workflow-dialog
      v-model:dialog-visible="createWorkflowDialogVisible"
      @close="onCloseCreateWorkflowDialog"
    />
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";

import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import Request from "../../../mixins/request/index.js";
import CreateWorkflowDialog from "./CreateWorkflowDialog.vue";
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
    CreateWorkflowDialog,
  },

  props: {},

  mixins: [Request],

  data() {
    return {
      createWorkflowDialogVisible: false,
    };
  },

  async mounted() {
    try {
      // fetch data
    } catch (err) {
      console.error(err);
    }

    try {
      // fetch data
    } catch (err) {
      console.error(err);
    }
  },

  computed: {
    ...mapGetters(["activeOrganization", "config", "hasFeature"]),
    ...mapGetters(["activeOrganization", "userToken", "config", "hasFeature"]),
    ...mapState("analysisModule", ["applications"]),

    orgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
    showEmptyState: function () {
      return true;
    },

    beforeRouteEnter(to, from, next) {
      next((vm) => {
        if (vm.hasFeature("sandbox_org_feature")) {
          vm.$router.push({ name: "create-org" });
        }
      });
    },
  },

  methods: {
    ...mapActions("analysisModule", ["fetchApplications"]),

    openCreateWorkflowDialog: function () {
      this.createWorkflowDialogVisible = true;
    },

    onCloseCreateWorkflowDialog: function () {
      this.createWorkflowDialogVisible = false;
    },
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/element/dialog";

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
