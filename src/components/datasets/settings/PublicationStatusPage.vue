<template>
  <bf-stage ref="bfStage" slot="stage">
    <template v-if="hasPermission">
      <div class="publishing-container">
        <data-card
          v-if="hasManagerPermissions"
          class="mb-24 grey compact"
          title="Pre-Publication Checklist"
          :padding="false"
        >
          <checklist-item
            :route="{
              name: 'dataset-settings-general',
              query: { focusInput: 'inputDescription' },
            }"
            cta="Add a subtitle"
            :is-complete="hasSubtitle"
          >
            gives others a brief description of your dataset.
          </checklist-item>

          <checklist-item
            :is-complete="hasTags"
            :route="{
              name: 'dataset-settings-general',
              query: { focusInput: 'inputTags' },
            }"
            cta="Add tags"
          >
            make it easier for people to find your dataset in Discover.
          </checklist-item>

          <checklist-item
            :is-complete="hasDescription"
            cta="Add a description"
            :route="{
              name: 'dataset-overview',
              query: { editDescription: true },
            }"
          >
            provide a detailed overview of your dataset.
          </checklist-item>

          <checklist-item
            :is-complete="hasBanner"
            cta="Add an image"
            :route="{
              name: 'dataset-settings-general',
              query: { focusInput: 'bannerImage' },
            }"
          >
            help your dataset stand out in listings.
          </checklist-item>

          <checklist-item
            :is-complete="hasContributors"
            cta="Add contributors"
            :route="{
              name: 'publication-settings',
              query: { focusInput: 'inputAddContributor' },
            }"
          >
            list the people who contributed to this dataset.
          </checklist-item>

          <checklist-item
            :is-complete="hasDatasetLicense"
            cta="Add a license"
            :route="{
              name: 'publication-settings',
              query: { focusInput: 'inputLicense' },
            }"
          >
            let others know how they can use this data.
          </checklist-item>

          <checklist-item
            :is-complete="hasDatasetDoi"
            cta="Reserve a DOI"
            :route="{
              name: 'publication-settings',
              query: { focusInput: 'dataciteDoi' },
            }"
          >
            reserve a DataCite DOI for published research.
          </checklist-item>

          <checklist-item
            :is-complete="datasetOwnerHasOrcidId"
            :externalLinkUrl="getROrcidLink()"
            externalLinkText="Link ORCID Account"
            :enableLink="isDatasetOwner"
          >
            <template v-if="isDatasetOwner">
              link your ORCID iD to distinguish yourself from other researchers.
            </template>
            <template v-else>
              the dataset owner needs to link their ORCID iD.
            </template>
          </checklist-item>
        </data-card>

        <div class="pub-section">
          <div class="pub-section-header">DOI Registration</div>
          <div class="pub-section-content">
            <dataset-settings-doi ref="dataciteDoi" />
          </div>
        </div>

        <div class="pub-section">
          <div class="pub-section-header">Submit for Publication</div>
          <div class="pub-section-content">
            <dataset-settings-publishing
              :orcid-api-url="getORCIDApiUrl"
              :orcid-url="getORCIDUrl"
            />
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <bf-empty-page-state class="empty">
        <img
          src="/src/assets/images/illustrations/illo-collaboration.svg"
          height="240"
          width="247"
          alt="Publishing illustration"
        />
        <div class="copy">
          <h2>You don't have permission to manage publishing for this dataset.</h2>
          <p>Only dataset managers can access this page.</p>
        </div>
      </bf-empty-page-state>
    </template>
  </bf-stage>
</template>

<script>
import { mapGetters, mapState, mapActions } from "vuex";
import { pathOr } from "ramda";
import { useGetToken } from "@/composables/useGetToken";
import Request from "../../../mixins/request/index";
import BfStage from "../../layout/BfStage/BfStage.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import DataCard from "../../shared/DataCard/DataCard.vue";
import ChecklistItem from "../../shared/ChecklistItem/ChecklistItem.vue";
import DatasetSettingsPublishing from "./DatasetSettingsPublishing/DatasetSettingsPublishing.vue";
import DatasetSettingsDoi from "./DatasetSettingsDoi/DatasetSettingsDoi.vue";

export default {
  name: "PublicationStatusPage",

  components: {
    BfStage,
    BfEmptyPageState,
    DataCard,
    ChecklistItem,
    DatasetSettingsPublishing,
    DatasetSettingsDoi,
  },

  mixins: [Request],

  computed: {
    ...mapGetters([
      "getPermission",
      "datasetLocked",
      "datasetOwner",
      "datasetOwnerHasOrcidId",
      "hasFeature",
      "activeOrganization",
      "config",
    ]),

    ...mapState([
      "dataset",
      "datasetDoi",
      "datasetContributors",
      "datasetDescription",
      "isDatasetOwner",
      "datasetBanner",
      "profile",
    ]),

    hasPermission() {
      return this.getPermission("manager");
    },

    hasManagerPermissions() {
      return this.getPermission("manager");
    },

    hasSubtitle() {
      return Boolean(pathOr("", ["content", "description"], this.dataset));
    },

    hasTags() {
      return pathOr([], ["content", "tags"], this.dataset).length > 0;
    },

    hasDescription() {
      return this.datasetDescription !== "";
    },

    hasBanner() {
      return this.datasetBanner !== "";
    },

    hasContributors() {
      return this.datasetContributors.length > 0;
    },

    hasDatasetLicense() {
      const license = pathOr("", ["content", "license"], this.dataset);
      return Boolean(license);
    },

    hasDatasetDoi() {
      return Object.keys(this.datasetDoi).length > 0;
    },

    getORCIDUrl() {
      return pathOr("", ["config", "ORCIDUrl"])(this) || "";
    },

    getORCIDApiUrl() {
      return useGetToken()
        .then((token) => {
          const url = pathOr("", ["config", "apiUrl"])(this);
          return `${url}/user/orcid?api_key=${token}`;
        })
        .catch(() => "");
    },
  },

  methods: {
    getROrcidLink() {
      return this.config.environment === 'prod'
        ? 'https://discover.pennsieve.io/user/profile'
        : 'https://discover.pennsieve.net/user/profile';
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.publishing-container {
  max-width: 640px;
}

.mb-24 {
  margin-bottom: 24px;
}

.pub-section {
  margin-bottom: 24px;
}

.pub-section-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_5;
  padding: 8px 0;
  margin: 0 0 16px;
  border-bottom: 1px solid theme.$gray_2;
}

.pub-section-content {
  padding-bottom: 0;
}

.empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 48px 24px;

  .copy {
    h2 {
      font-size: 16px;
      font-weight: 600;
      color: theme.$gray_6;
      margin: 16px 0 8px;
    }

    p {
      color: theme.$gray_5;
      font-size: 13px;
      line-height: 1.5;
    }
  }
}
</style>
