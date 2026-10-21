<template>
  <div class="proposed-dataset-list-item">
    <el-row type="flex" align="middle" :gutter="32">
      <el-col :sm="16">
        <div class="dataset-info">
          <div>
            <div class="proposal-title">
              <h2>
                <a
                  href="#"
                  @click.prevent="triggerRequest(DatasetProposalAction.VIEW)"
                >
                  {{ proposalName }}
                </a>
              </h2>
              <bf-pill v-if="status" :class="statusPillColor">
                {{ status }}
              </bf-pill>
            </div>
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

      <el-col :sm="8">
        <div v-if="canReview" class="dataset-actions">
          <bf-button
            class="compact"
            @click="triggerRequest(DatasetProposalAction.ACCEPT)"
          >
            Accept Request
          </bf-button>
          <bf-button
            class="secondary compact"
            @click="triggerRequest(DatasetProposalAction.REJECT)"
          >
            Reject Request
          </bf-button>
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
import BfPill from "@/components/shared/BfPill/BfPill.vue";

export default {
  name: "PublishingProposalsListItem",

  components: {
    BfButton,
    BfPill,
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

    statusPillColor: function () {
      const pillColors = {
        [ProposalStatus.SUBMITTED]: "yellow",
        [ProposalStatus.ACCEPTED]: "green",
        [ProposalStatus.REJECTED]: "red",
      };
      return pillColors[this.proposal.proposalStatus] || "";
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

.proposal-title {
  align-items: center;
  display: flex;
  gap: 8px;
}

.dataset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: flex-end;
}
</style>
