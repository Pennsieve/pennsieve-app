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
            <template>
              <div v-if="email">
                <p class="dataset-meta">
                  Email address
                  <strong>{{ email }}</strong>
                </p>
              </div>
            </template>
          </div>
        </div>
      </el-col>

      <el-col :sm="4">
        <div class="bf-dataset-list-item-storage">
          <p class="bf-dataset-list-item-stat">
            <strong class="col-label publication-type">
              {{ publicationType }}
            </strong>
            Request Type
          </p>
        </div>
      </el-col>

      <el-col :span="4">
        <div class="bf-dataset-list-item-stat-align">
          <div class="dataset-actions">
            <div class="button-wrapper">
              <p>
                <a
                  href="#"
                  @click.prevent="triggerRequest(DatasetProposalAction.ACCEPT)"
                >
                  Accept Request
                </a>
              </p>
              <p>
                <a
                  href="#"
                  @click.prevent="triggerRequest(DatasetProposalAction.REJECT)"
                >
                  Reject Request
                </a>
              </p>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>
<script>
import FormatDate from "../../../mixins/format-date";
import { DatasetProposalAction } from "../../../utils/constants";
import { mapActions, mapGetters, mapState } from "vuex";

export default {
  name: "PublishingProposalsListItem",

  mixins: [FormatDate],

  props: {
    proposal: {
      type: Object,
      default: () => {},
    },
  },

  computed: {
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
      if (
        this.proposal.emailAddress.length &&
        this.proposal.emailAddress.trim().length
      ) {
        return this.proposal.emailAddress;
      } else {
        return "";
      }
    },

    storage: function () {
      return 0;
    },

    publicationType: function () {
      return "proposal";
    },

    DatasetProposalAction: function () {
      return DatasetProposalAction;
    },
  },

  methods: {
    ...mapActions("repositoryModule", ["acceptProposal", "rejectProposal"]),
    epochToISO: function (seconds) {
      let d = new Date(0);
      d.setUTCSeconds(seconds);
      return d.toISOString();
    },

    triggerRequest: function (request) {
      if (request === "accept") {
        this.acceptProposal(this.proposal);
      }
      if (request === "reject") {
        this.rejectProposal(this.proposal);
      }
      this.$emit(request, this.proposal);
    },
  },
};
</script>
<style scoped lang="scss">
@import "../../../assets/_variables.scss";
@import "../../../assets/_list-item.scss";

.list-item-status-wrapper {
  color: $gray_4;
  font-size: 12px;
  line-height: 18px;
  font-weight: normal;
  border-radius: 3px;
  width: 160px;
  padding-top: 3px;
  height: fit-content;

  p {
    margin: 0 0 2px !important;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding-left: 20px;
    max-width: 134px;
  }
}
.publishing-notice {
  display: flex;
  flex-direction: column;
  .publishing-notice-icon-line {
    display: flex;
    :first-child {
      margin-top: -1px;
    }
  }
}

.dataset-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  .secondary {
    margin-left: 16px;
  }
}

.publishing-info {
  margin: 24px 0 0 104px;
}
.error-notice {
  align-items: center;
  display: flex;
}

.error-notice-text {
  display: flex;
  flex-direction: column;
  .error-notice-icon-line {
    display: flex;
    :first-child {
      margin-top: -1px;
    }
  }
}

.publication-type {
  text-transform: capitalize;
}

.button-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;

  a {
    margin-bottom: 12px;
  }
}

@media only screen and (max-width: 1200px) {
  .list-item-status-wrapper {
    width: 70px;
    height: fit-content;
    padding-left: 5px;

    p {
      word-break: break-word;
    }
  }
}
</style>
