<template>
  <div class="proposed-dataset-list-item">
    
    <el-row type="flex" :gutter="4">
      <el-col :sm="16">
        <div class="dataset-info">
          <div>
            <h2>
              <a
                href="#"
                @click.prevent="triggerRequest(DatasetProposalAction.VIEW)"
              >
                {{ proposalName }}
              </a>
            </h2>
            <p class="dataset-meta">
              Submitted by
              <strong>{{ owner }}</strong>
            </p>
            <p class="dataset-meta">
              Submitted on
              <strong>{{ updated }}</strong>
            </p>
            <p v-if="email" class="dataset-meta">
              Email address
              <strong>{{ email }}</strong>
            </p>
          </div>
        </div>
      </el-col>

      <el-col :sm="4">
        <div class="bf-dataset-list-item-storage">
          <p
            v-if="status"
            class="bf-dataset-list-item-stat proposal-status"
          >
            <span class="status-label">Status</span>
            <strong class="status-value">{{ status }}</strong>
          </p>
        </div>
      </el-col>

      <el-col :span="4">
        <div class="bf-dataset-list-item-stat-align">
          <div v-if="canReview" class="dataset-actions">
            <div class="button-wrapper">
              <bf-button
                @click="triggerRequest(DatasetProposalAction.ACCEPT)"
              >
                Accept Request
              </bf-button>
              <bf-button
                class="secondary"
                @click="triggerRequest(DatasetProposalAction.REJECT)"
              >
                Reject Request
              </bf-button>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>
<script>
import { mapGetters } from "vuex";
import FormatDate from "../../../mixins/format-date";
import { DatasetProposalAction, ProposalStatus } from "../../../utils/constants";
import BfButton from "@/components/shared/bf-button/BfButton.vue";

export default {
  name: "PublishingProposalsListItem",

  components: {
    BfButton,
  },

  mixins: [FormatDate],

  props: {
    proposal: {
      type: Object,
      default: () => {},
    },
  },

  computed: {
    ...mapGetters(["isUserPublisher"]),

    /**
     * Only a proposal still awaiting review can be accepted or rejected; the
     * list also shows already-decided proposals.
     */
    canReview: function () {
      return (
        this.isUserPublisher &&
        this.proposal.proposalStatus === ProposalStatus.SUBMITTED
      );
    },

    status: function () {
      const labels = {
        [ProposalStatus.SUBMITTED]: "Awaiting review",
        [ProposalStatus.ACCEPTED]: "Accepted",
        [ProposalStatus.REJECTED]: "Rejected",
        [ProposalStatus.WITHDRAWN]: "Withdrawn",
        [ProposalStatus.DRAFT]: "Draft",
      };
      const proposalStatus = this.proposal.proposalStatus;
      return proposalStatus
        ? labels[proposalStatus] || proposalStatus
        : "";
    },

    /**
     * Compute title of dataset proposl
     */
    proposalName: function () {
      return this.proposal.name;
    },
    /**
     * Compute formatted timestamp
     * @returns {String}
     */
    updated: function () {
      let epochSeconds = 0;
      if (this.proposal.submittedAt) {
        epochSeconds = this.proposal.submittedAt;
      } else {
        epochSeconds = this.proposal.updatedAt;
      }
      let isoTimestamp = this.epochToISO(epochSeconds);
      return this.formatDate(isoTimestamp);
    },
    /**
     * Compute owner of dataset
     * @returns {String}
     */
    owner: function () {
      return this.proposal.ownerName;
    },
    //proposer's email will render if the email is provided adn not an empty string
    email() {
      return this.proposal.emailAddress?.trim() || "";
    },

    DatasetProposalAction: function () {
      return DatasetProposalAction;
    },
  },

  methods: {
    epochToISO: function (seconds) {
      let d = new Date(0);
      d.setUTCSeconds(seconds);
      return d.toISOString();
    },

    triggerRequest: function (request) {
      // The parent raises a confirmation dialog and performs the action from
      // there; acting here as well would accept/reject twice, unconfirmed.
      this.$emit(request, this.proposal);
    },
  },
};
</script>
<style scoped lang="scss">
@use "../../../styles/theme";
@use "../../../styles/list-item";

.dataset-actions {
  display: flex;
  justify-content: flex-end;
}

.proposal-status {
  text-align: left;
}

.status-label {
  color: theme.$gray_4;
  display: block;
  padding-bottom: 8px;
}

.status-value {
  color: theme.$text-color;
}

.button-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 160px;
}
</style>
