<template>
  <bf-stage
    slot="stage"
    v-loading="isLoading"
    element-loading-background="transparent"
  >
    <template #actions>
      <bf-button class="primary" @click="startNewRequest">
        New Request
      </bf-button>
    </template>

    <div v-if="hasProposals" class="integration-list">
      <request-list-item
        v-for="request in datasetProposals"
        :key="request.id"
        :datasetRequest="request"
        @edit="editDatasetProposal"
        @remove="removeDatasetProposalRequest"
        @submit="submitDatasetProposalRequest"
        @withdraw="withdrawDatasetProposalRequest"
        @open-dataset="openDatasetRequest"
      />
    </div>

    <bf-empty-page-state v-if="!hasProposals" class="empty-state">
      <img
        class="add-proposal-img"
        src="/src/assets/images/illustrations/illo-datasets.svg"
        alt="Add datasets illustration"
      />
      <h2>Create a dataset proposal</h2>
      You have not created any dataset proposals yet.
      <p>
        Create a
        <strong><a href="#" @click="startNewRequest">New Request</a></strong> to
        get started.
      </p>
    </bf-empty-page-state>

    <request-survey
      :dialog-visible="requestModalVisible"
      :dataset-request="activeRequest"
      @create-proposal="createProposal"
      @update-proposal="updateProposal"
      @close="closeRequestsurvey"
    />

    <confirmation-dialog
      :dialog-visible="confirmationDialogVisible"
      :action="confirmationDialog.action"
      :action-message="confirmationDialog.actionMessage"
      :resource="confirmationDialog.resource"
      :info-message="confirmationDialog.infoMessage"
      :warning-message="confirmationDialog.warningMessage"
      :acknowledgements="confirmationDialog.acknowledgements"
      :confirm-action-label="confirmationDialog.confirmActionLabel"
      :cancel-action-label="confirmationDialog.cancelActionLabel"
      @close="confirmationDialogVisible = false"
      @confirmed="confirmedAction"
    />
  </bf-stage>
</template>

<script>
import { mapState, mapActions, mapGetters } from "vuex";
import BfButton from "../shared/bf-button/BfButton.vue";
import RequestListItem from "./request-list-item/RequestListItem.vue";
import RequestSurvey from "./request-survey/RequestSurvey.vue";
import ConfirmationDialog from "../shared/ConfirmationDialog/ConfirmationDialog.vue";
import BfEmptyPageState from "../shared/bf-empty-page-state/BfEmptyPageState.vue";
import EventBus from "../../utils/event-bus";

export default {
  name: "SubmitDatasets",

  components: {
    ConfirmationDialog,
    BfButton,
    RequestListItem,
    RequestSurvey,
    BfEmptyPageState,
  },
  computed: {
    ...mapState("repositoryModule", ["requestModalVisible"]),
    ...mapGetters("repositoryModule", ["getRepositoryByNodeId"]),
    ...mapState("repositoryModule", ["datasetProposals"]),

    hasProposals: function () {
      return this.datasetProposals.length > 0;
    },
  },
  data() {
    return {
      isLoading: false,
      activeRequest: {},
      confirmationDialogVisible: false,
      confirmationDialog: {
        action: "",
        actionMessage: "",
        resource: {},
        infoMessage: "",
        warningMessage: "",
        acknowledgements: [],
        confirmActionLabel: "",
        cancelActionLabel: "",
      },
    };
  },

  methods: {
    ...mapGetters(["organizations"]),
    ...mapActions("repositoryModule", [
      "updateRequestModalVisible",
      "setSelectedRepo",
      "setSelectedProposal",
      "clearSelectedRepo",
      "fetchProposals",
      "storeNewProposal",
      "storeChangedProposal",
      "removeProposal",
      "submitProposal",
      "withdrawProposal",
    ]),

    closeRequestsurvey: function () {
      this.updateRequestModalVisible(false);
    },
    resetConfirmation: function () {
      this.confirmationDialogVisible = false;
      this.confirmationDialog = {
        action: "",
        actionMessage: "",
        resource: {},
        infoMessage: "",
        warningMessage: "",
        acknowledgements: [],
        confirmActionLabel: "",
        cancelActionLabel: "",
      };
    },

    editDatasetProposal: function (proposal) {
      if (proposal) {
        this.activeRequest = proposal;
        this.setSelectedProposal(proposal);
      }
      // set the selected repository, if one is designated on the proposal
      if (proposal && proposal.repositoryId) {
        let repository = this.getRepositoryByNodeId(
          proposal.organizationNodeId
        );
        if (repository) {
          this.setSelectedRepo(repository);
        }
      }
      this.updateRequestModalVisible(true);
    },

    confirmedAction: async function (event) {
      this.resetConfirmation();
      if (event.action && event.resource) {
        switch (event.action) {
          case "delete":
            this.removeDatasetProposal(event.resource).catch((err) =>
              console.error(err)
            );
            break;
          case "submit":
            this.submitDatasetProposal(event.resource).catch((err) =>
              console.error(err)
            );
            break;
          case "withdraw":
            this.withdrawDatasetProposal(event.resource).catch((err) =>
              console.error(err)
            );
            break;
        }
      }
    },

    removeDatasetProposal: async function (proposal) {
      this.removeProposal(proposal)
        .then(() => this.fetchProposals())
        .catch((err) => console.error(err));
    },

    submitDatasetProposal: async function (proposal) {
      this.submitProposal(proposal)
        .then(() => this.fetchProposals())
        .catch((err) => console.error(err));
    },

    withdrawDatasetProposal: async function (proposal) {
      this.withdrawProposal(proposal)
        .then(() => this.fetchProposals())
        .catch((err) => console.error(err));
    },

    removeDatasetProposalRequest: function (proposal) {
      this.resetConfirmation();
      this.confirmationDialog = {
        action: "delete",
        actionMessage: `Remove Dataset Proposal: "${proposal.name}"?`,
        resource: proposal,
        warningMessage:
          "This will delete the Dataset Proposal and cannot be undone.",
        confirmActionLabel: "Remove",
        cancelActionLabel: "Cancel",
      };
      this.confirmationDialogVisible = true;
    },

    submitDatasetProposalRequest: function (proposal) {
      let repositoryName = "???";
      let repository = this.getRepositoryByNodeId(proposal.organizationNodeId);
      if (repository) {
        repositoryName = repository.displayName;
      }
      this.resetConfirmation();
      this.confirmationDialog = {
        action: "submit",
        actionMessage: `Submit Dataset Proposal: "${proposal.name}"?`,
        resource: proposal,
        warningMessage: `This will submit the dataset proposal to ${repositoryName} for review and consideration.`,
        confirmActionLabel: "Submit",
        cancelActionLabel: "Cancel",
      };
      this.confirmationDialogVisible = true;
    },

    withdrawDatasetProposalRequest: function (proposal) {
      let repositoryName = "???";
      let repository = this.getRepositoryByNodeId(proposal.organizationNodeId);
      if (repository) {
        repositoryName = repository.displayName;
      }
      this.resetConfirmation();
      this.confirmationDialog = {
        action: "withdraw",
        actionMessage: `Withdraw Dataset Proposal: "${proposal.name}"?`,
        resource: proposal,
        warningMessage: `This will withdraw the request to review and consider the dataset proposal from ${repositoryName}.`,
        confirmActionLabel: "Withdraw",
        cancelActionLabel: "Cancel",
      };
      this.confirmationDialogVisible = true;
    },

    openDatasetRequest: function (proposal) {
      let evt = this.organizations().filter(
        (org) => org.organization.id === proposal.organizationNodeId
      )[0];
      evt.destination = {
        datasetNodeId: proposal.datasetNodeId,
        view: "overview",
      };
      EventBus.$emit("switch-organization", evt);
      // this.$router.push(`/${proposal.organizationNodeId}/datasets/${proposal.datasetNodeId}/overview`)
    },

    startNewRequest: function () {
      this.activeRequest = {};
      this.clearSelectedRepo();
      this.updateRequestModalVisible(true);
    },

    createProposal: async function (proposal) {
      // TODO: make storeNewProposal an async function
      // TODO: if storeNewProposal() succeeds, then call fetchProposals
      this.storeNewProposal(proposal)
        .then(() => this.fetchProposals())
        .catch((err) => console.error(err));
    },

    updateProposal: async function (proposal) {
      this.storeChangedProposal(proposal)
        .then(() => this.fetchProposals())
        .catch((err) => console.error(err));
    },
  },
};
</script>

<style scoped lang="scss">
.add-proposal-img {
  width: 100px;
}

.header-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

h1 {
  font-size: 22px;
  margin-bottom: 8px;
}

p {
  max-width: 760px;
}

.buttons {
  display: flex;
  flex-direction: row;
  justify-content: end;
}
.logo {
  width: 300px;
}

.content {
  margin-bottom: 42px;
}

.data-usage {
  text-align: right;
}
.col-spacer {
  height: 17px;
}
.pagination-header {
  display: flex;
  justify-content: space-between;
}

.empty-state {
  h2 {
    margin-top: 16px;
  }
}
</style>
