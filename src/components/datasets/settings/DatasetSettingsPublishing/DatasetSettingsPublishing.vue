<template>
  <div class="publishing-workflow">
    <dataset-settings-publishing-loader
      v-if="isLoadingDatasetPublishedData"
    />

    <!-- Status Card -->
    <div class="status-card" :class="statusClass">
      <div class="status-info">
        <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
        <span v-if="isPublished && publishedDate" class="status-detail">
          Published on {{ publishedDate }}
        </span>
        <span v-else-if="publicationStatus === PublicationStatus.REQUESTED" class="status-detail">
          Awaiting review by the publishing team
        </span>
        <span v-else-if="publicationStatus === PublicationStatus.ACCEPTED" class="status-detail">
          Accepted — publication in progress
        </span>
        <span v-else-if="publicationStatus === PublicationStatus.FAILED" class="status-detail">
          Publication failed
        </span>
        <span v-else-if="hasBeenPublished" class="status-detail">
          Previously published on {{ publishedDate }}
        </span>
        <span v-else class="status-detail">
          Ready to submit for publication
        </span>
      </div>
      <a v-if="isPublished" target="_blank" :href="discoverLink" class="discover-link">
        View on Discover
      </a>
    </div>

    <!-- ORCID Warning -->
    <div v-if="getPermission('owner') && !datasetOwnerHasOrcidId && !isPublished" class="action-row warning-row">
      <div class="action-info">
        <strong>ORCID iD required</strong>
        <p>Link your ORCID iD before submitting for publication.</p>
      </div>
      <owner-orcid @open-orcid="openORCID" />
    </div>

    <!-- Readiness message -->
    <div v-if="!isPublished && !isRequested" class="readiness-message">
      <p v-if="canPublish" class="ready">
        Your checklist is complete. This dataset is ready to submit for review.
      </p>
      <p v-else class="not-ready">
        {{ incompleteMessage }}
      </p>
    </div>

    <!-- Submit Actions: the user picks exactly one pathway -->
    <div
      class="pathway-choice"
      :class="{ 'is-single': !canRequestEmbargo }"
      role="group"
      aria-label="Choose a publishing pathway"
    >
      <div class="pathway-card">
        <strong>{{ hasBeenPublished ? 'Publish a new version' : 'Ready to Publish' }}</strong>
        <p>{{ hasBeenPublished ? 'Request to publish an updated version to Discover.' : 'Submit dataset for standard publication review. While under review, the dataset will be locked until approved or rejected.' }}</p>
        <submit-for-publication
          class="pathway-action"
          :can-publish="canPublish"
          :dataset-id="datasetId"
          :is-requested="isRequested"
          :publication-type="PublicationType.PUBLICATION"
        />
      </div>

      <!-- A dataset already on Discover can't be pulled back under embargo -->
      <template v-if="canRequestEmbargo">
        <span class="pathway-divider" aria-hidden="true">OR</span>

        <div class="pathway-card">
          <strong>Ready to Publish under Embargo</strong>
          <p>Submit dataset for review with a scheduled embargo date before public release.</p>
          <submit-for-publication
            class="pathway-action"
            :can-publish="canPublish"
            :dataset-id="datasetId"
            :is-requested="isRequested"
            :publication-type="PublicationType.EMBARGO"
          />
        </div>
      </template>
    </div>

    <!-- Post-publication actions -->
    <dataset-settings-publication-actions :can-publish="canPublish" />
  </div>
</template>

<script>
import { mapActions, mapGetters, mapState } from "vuex";
import { all, defaultTo, path, pathOr, propOr } from "ramda";
import {
  PublicationStatus,
  PublicationType,
} from "../../../../utils/constants";
import DatasetSettingsPublishingLoader from "./DatasetSettingsPublishingLoader.vue";
import DatasetSettingsPublicationActions from "../DatasetSettingsPublicationActions/DatasetSettingsPublicationActions.vue";

import Request from "../../../../mixins/request";
import FormatDate from "../../../../mixins/format-date/index";
import OwnerOrcid from "./OwnerOrcid.vue";
import SubmitForPublication from "./SubmitForPublication.vue";
import StatusPublished from "./StatusPublished.vue";
import StatusRequested from "./StatusRequested.vue";
import StatusAccepted from "./StatusAccepted.vue";
import StatusFailed from "./StatusFailed.vue";
import SharingInfo from "./SharingInfo.vue";

export default {
  name: "DatasetSettingsPublishing",

  components: {
    StatusPublished,
    SubmitForPublication,
    OwnerOrcid,
    DatasetSettingsPublishingLoader,
    DatasetSettingsPublicationActions,
    StatusFailed,
    StatusRequested,
    StatusAccepted,
    SharingInfo,
  },

  mixins: [FormatDate, Request],

  props: {
    orcidAPIUrl: {
      type: String,
      default: "",
    },
    orcidUrl: {
      type: String,
      default: "",
    },
  },

  data: function () {
    return {
      isPublishing: false,
      isUnpublishing: false,
      oauthWindow: "",
      oauthCode: "",
      isPublisherRole: "",
      PublicationStatus,
      PublicationType,
    };
  },

  computed: {
    ...mapState([
      "dataset",
      "isLoadingDatasetPublishedData",
      "datasetBanner",
      "datasetContributors",
      "datasetDescription",
      "getPermission",
      "orgMembers",
    ]),
    ...mapGetters([
      "getPermission",
      "datasetOwner",
      "profile",
      "config",
      "datasetOwnerHasOrcidId",
      "datasetLocked",
      "getPublishedDataByIntId",
      "isUserSuperAdmin",
      "isUserPublisher",
    ]),

    /**
     * Get dataset tags
     * @returns {Array}
     */
    datasetTags: function () {
      return pathOr([], ["content", "tags"], this.dataset);
    },

    /**
     * Get datasetId
     * @returns {String}
     */
    datasetId: function () {
      return pathOr("", ["content", "id"], this.dataset);
    },

    /**
     * Returns the full dataset owner name
     * @returns {String}
     */
    datasetOwnerName: function () {
      const firstName = propOr("", "firstName", this.datasetOwner);
      const lastName = propOr("", "lastName", this.datasetOwner);
      return `${firstName} ${lastName}`;
    },

    /**
     * Returns the dataset owner email
     * @returns {String}
     */
    datasetOwnerEmail: function () {
      return propOr("", "email", this.datasetOwner);
    },

    /**
     * Compute if the publish button is disabled
     * @returns {Boolean}
     */
    canPublish: function () {
      const name = path(["content", "name"], this.dataset);
      const subtitle = path(["content", "description"], this.dataset);
      const license = path(["content", "license"], this.dataset);
      const contributors = this.datasetContributors;
      const banner = this.datasetBanner;
      const datasetDescription = this.datasetDescription;

      const isTrue = (item) => item === true;

      return all(isTrue, [
        Boolean(name),
        Boolean(subtitle),
        Boolean(banner),
        Boolean(license),
        this.datasetTags.length > 0,
        contributors.length > 0,
        Boolean(datasetDescription),
        Boolean(this.getPermission("owner")),
        Boolean(this.datasetOwnerHasOrcidId),
      ]);
    },

    incompleteItems: function () {
      const items = []
      if (!path(["content", "name"], this.dataset)) items.push("name")
      if (!path(["content", "description"], this.dataset)) items.push("subtitle")
      if (!this.datasetBanner) items.push("banner image")
      if (!path(["content", "license"], this.dataset)) items.push("license")
      if (!this.datasetTags.length) items.push("tags")
      if (!this.datasetContributors.length) items.push("contributors")
      if (!this.datasetDescription) items.push("description")
      if (!this.getPermission("owner")) items.push("owner permissions")
      if (!this.datasetOwnerHasOrcidId) items.push("dataset owner's ORCID iD")
      return items
    },

    incompleteMessage: function () {
      const items = this.incompleteItems
      if (items.length === 0) return ""
      if (items.length === 1 && items[0] === "owner permissions") {
        return "Only the dataset owner can submit for publication."
      }
      return `The following items are still needed: ${items.join(", ")}.`
    },

    statusLabel: function () {
      if (this.isPublished) return 'Published';
      if (this.publicationStatus === PublicationStatus.REQUESTED) return 'In Review';
      if (this.publicationStatus === PublicationStatus.ACCEPTED) return 'Accepted';
      if (this.publicationStatus === PublicationStatus.FAILED) return 'Failed';
      return 'Draft';
    },

    statusClass: function () {
      if (this.isPublished) return 'published';
      if (this.publicationStatus === PublicationStatus.REQUESTED) return 'in-review';
      if (this.publicationStatus === PublicationStatus.ACCEPTED) return 'accepted';
      if (this.publicationStatus === PublicationStatus.FAILED) return 'failed';
      return 'draft';
    },

    isRequested: function () {
      return this.publicationStatus === PublicationStatus.REQUESTED;
    },

    hasBeenPublished: function () {
      const publication = propOr({}, "publication", this.dataset);
      return publication.hasOwnProperty("publishedDataset");
    },

    /**
     * Embargo is only offered before a dataset is publicly released
     * @returns {Boolean}
     */
    canRequestEmbargo: function () {
      return !this.hasBeenPublished || this.publicationType === PublicationType.REMOVAL;
    },

    isPublished: function () {
      return (
        this.hasBeenPublished &&
        this.publicationStatus === PublicationStatus.COMPLETED &&
        this.publicationType !== PublicationType.REMOVAL
      );
    },

    /**
     * Compute dataset's current publication status
     * @returns {String}
     */
    publicationStatus: function () {
      return pathOr(
        PublicationStatus.DRAFT,
        ["publication", "status"],
        this.dataset
      );
    },

    /**
     * Compute dataset's current publication type
     * @returns {String}
     */
    publicationType: function () {
      return this.dataset.publication.type || "";
    },

    /**
     * Compute published data
     * @returns {Object}
     */
    publishedData: function () {
      const dataset = defaultTo({}, this.dataset);
      const datasetIntId = path(["content", "intId"], dataset);
      return this.getPublishedDataByIntId(datasetIntId);
    },

    /**
     * Compute published date
     * @returns {String}
     */
    publishedDate: function () {
      const date = propOr("", "lastPublishedDate", this.publishedData);
      return this.formatDate(date);
    },

    /**
     * Compute link for dataset on discover
     * @returns {String}
     */
    discoverLink: function () {
      const publishedDatasetId = propOr(
        1,
        "publishedDatasetId",
        this.publishedData
      );

      return this.config.environment === "prod"
        ? `https://discover.pennsieve.io/datasets/${publishedDatasetId}`
        : `https://discover.pennsieve.net/datasets/${publishedDatasetId}`;
    },
  },

  mounted() {
    // assign isPublisherRole based on user account
    this.orgMembers.forEach((member) => {
      if (member.id === this.profile.id) {
        // found a match!
        this.isPublisherRole = member.isPublisher;
      }
    });
  },

  methods: {
    ...mapActions([
      "addDatasetPublishedData",
      "updateDatasetPublishedData",
      "deleteDatasetPublishedData",
      "updateDataset",
      "updateProfile",
    ]),

    /**
     * Logic to connect to user's ORCID
     */
    openORCID: function () {
      this.oauthWindow = window.open(
        this.getORCIDUrl,
        "_blank",
        "toolbar=no, scrollbars=yes, width=500, height=600, top=500, left=500"
      );
      const self = this;
      window.addEventListener("message", function (event) {
        this.oauthCode = event.data;
        if (this.oauthCode !== "") {
          if (!self.getORCIDApiUrl) {
            return;
          }

          self
            .sendXhr(self.getORCIDApiUrl, {
              method: "POST",
              body: {
                authorizationCode: this.oauthCode,
              },
            })
            .then((response) => {
              // response logic goes here
              self.oauthInfo = response;

              self.updateProfile({
                ...self.profile,
                orcid: self.oauthInfo,
              });
            })
            .catch(self.handleXhrError.bind(this));
        }
      });
    },

    /**
     * Set published data
     * @param {Object} response
     */
    setPublishedData: function (response) {
      if (this.publicationStatus === PublicationStatus.DRAFT) {
        this.addDatasetPublishedData(response);
      } else {
        this.updateDatasetPublishedData(response);
      }

      // Set locked property on dataset
      const updatedDataset = merge(this.dataset, { locked: true });
      return this.updateDataset(updatedDataset);
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../../styles/theme";

.publishing-workflow {
  max-width: 640px;
}

.status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: 4px;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  margin-bottom: 24px;

  &.published {
    border-color: rgba(theme.$green_1, 0.3);
    background: rgba(theme.$green_1, 0.05);
  }

  &.in-review {
    border-color: rgba(theme.$orange_1, 0.3);
    background: rgba(theme.$orange_1, 0.05);
  }

  &.failed {
    border-color: rgba(theme.$red_1, 0.3);
    background: rgba(theme.$red_1, 0.05);
  }
}

.status-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 16px;
  white-space: nowrap;

  &.published {
    background: rgba(theme.$green_1, 0.15);
    color: theme.$green_1;
  }

  &.in-review {
    background: rgba(theme.$orange_1, 0.15);
    color: theme.$orange_2;
  }

  &.accepted {
    background: rgba(theme.$green_1, 0.15);
    color: theme.$green_1;
  }

  &.failed {
    background: rgba(theme.$red_1, 0.15);
    color: theme.$red_1;
  }

  &.draft {
    background: theme.$gray_2;
    color: theme.$gray_5;
  }
}

.status-detail {
  font-size: 13px;
  color: theme.$gray_5;
}

.discover-link {
  font-size: 13px;
  color: theme.$purple_3;
  white-space: nowrap;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 0;
  border-bottom: 1px solid theme.$gray_2;

  &:last-child {
    border-bottom: none;
  }

  &.warning-row {
    background: rgba(theme.$orange_1, 0.05);
    border: 1px solid rgba(theme.$orange_1, 0.2);
    border-radius: 4px;
    padding: 16px;
    margin-bottom: 16px;
  }

  .action-info {
    flex: 1;

    strong {
      font-size: 14px;
      color: theme.$gray_6;
    }

    p {
      font-size: 13px;
      color: theme.$gray_5;
      margin: 4px 0 0;
      line-height: 1.5;
    }
  }
}

.pathway-choice {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 16px;
  padding: 8px 0 24px;
  border-bottom: 1px solid theme.$gray_2;

  &.is-single {
    grid-template-columns: 1fr;
  }

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

.pathway-card {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid theme.$gray_2;
  border-radius: 4px;
  background: theme.$white;

  strong {
    font-size: 14px;
    color: theme.$gray_6;
  }

  p {
    font-size: 13px;
    color: theme.$gray_5;
    margin: 4px 0 16px;
    line-height: 1.5;
  }

  // Pin the button to the bottom so both cards' Submits line up
  // regardless of description length
  .pathway-action {
    margin-top: auto;
    align-self: center;
  }
}

.pathway-divider {
  align-self: center;
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid theme.$gray_2;
  background: theme.$gray_1;
  color: theme.$gray_5;
  font-size: 12px;
  font-weight: 600;
}

.readiness-message {
  margin-bottom: 16px;

  p {
    font-size: 13px;
    padding: 12px 16px;
    border-radius: 4px;
    margin: 0;

    &.ready {
      background: rgba(theme.$green_1, 0.05);
      border: 1px solid rgba(theme.$green_1, 0.2);
      color: theme.$green_1;
    }

    &.not-ready {
      background: rgba(theme.$orange_1, 0.05);
      border: 1px solid rgba(theme.$orange_1, 0.2);
      color: theme.$orange_2;
    }
  }
}

.discover-link {
  margin-top: -4px;
  text-decoration: underline;
  margin-left: 8px;
}

.published-btn-wrap {
  align-items: center;
  display: flex;
  .bf-button:first-child {
    margin-right: 16px;
  }
}

#connect-orcid-button {
  border: 1px solid theme.$gray_2;
  padding: 0.3em;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 1px 1px 3px #999;
  cursor: pointer;
  color: #999;
  font-weight: bold;
  font-size: 0.8em;
  line-height: 24px;
  vertical-align: middle;
}

#connect-orcid-button:hover {
  border: 1px solid #338caf;
  color: #338caf;
}

#orcid-id-icon {
  display: block;
  margin: 0 0.5em 0 0;
  padding: 0;
  float: left;
}
</style>
