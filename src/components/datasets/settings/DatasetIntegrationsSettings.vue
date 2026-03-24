<template>
  <bf-stage ref="bfStage" slot="stage">
    <template v-if="hasPermission">
      <div class="config-container">
        <div class="config-section">
          <div class="config-section-header">Integrations</div>
          <div class="config-section-content">
            <p class="section-description">
              Activate integrations for this dataset to allow third-party services to receive events and interact with your data.
              <a
                href="https://docs.pennsieve.io/docs/preventing-files-from-being-included-during-publishing"
                target="_blank"
              >
                Learn more
              </a>
            </p>

            <div v-if="integrations.length > 0" class="integration-list">
              <integrations-list-item
                v-for="integration in integrations"
                :key="integration.id"
                :integration="integration"
                :active-integrations="activeIntegrations"
                :enable-switch="true"
                @toggle-integration="toggleIntegration"
              />
            </div>

            <div v-else class="empty-inline">
              <p v-if="hasAdminRights">
                No integrations configured.
                <a href="#" @click.prevent="openAddIntegration">Add a global integration</a>
                to get started.
              </p>
              <p v-else>
                No integrations available. Contact your administrator to set up integrations.
              </p>
            </div>
          </div>
        </div>

        <div class="config-section">
          <div class="config-section-header danger-header">Danger Zone</div>
          <div class="config-section-content danger-content">
            <div class="danger-item">
              <div class="danger-info">
                <strong>Delete this dataset</strong>
                <p>Once deleted, this cannot be undone. Published datasets must be unpublished first.</p>
              </div>
              <bf-button
                class="red"
                :disabled="datasetLocked || !getPermission('owner') || datasetPublished"
                @click="onDeleteDatasetBtnClick"
              >
                Delete Dataset
              </bf-button>
            </div>
            <p
              v-if="!getPermission('owner')"
              class="danger-note"
            >
              Only owners can delete datasets. Contact
              <a :href="`mailto:${datasetOwnerEmail}`">{{ datasetOwnerName }}</a>
              to request deletion.
            </p>
          </div>
        </div>
      </div>

      <delete-dataset
        ref="deleteDatasetDialog"
        :dialog-visible="deleteDatasetDialogVisible"
        @delete-dataset-confirmed="submitDeleteDatasetRequest"
        @close="onCloseDeleteDialog"
      />
    </template>
    <template v-else>
      <bf-empty-page-state class="empty">
        <img
          src="/src/assets/images/illustrations/illo-collaboration.svg"
          height="240"
          width="247"
          alt="Teams illustration"
        />
        <div class="copy">
          <h2>
            You don't have permission to manage integrations for this dataset.
          </h2>
          <p>Only dataset managers can access this page.</p>
        </div>
      </bf-empty-page-state>
    </template>
  </bf-stage>
</template>

<script>
import Request from "@/mixins/request/index";
import DeleteDatasetMixin from "@/mixins/DeleteDataset";
import { mapGetters, mapState, mapActions } from "vuex";
import { pathOr, propOr } from "ramda";
import IntegrationsListItem from "../../Integrations/IntegrationsListItem/IntegrationsListItem.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import DeleteDataset from "./window/DeleteDataset.vue";
import DatasetSettingsIgnoreFiles from "./DatasetSettingsIgnoreFiles/DatasetSettingsIgnoreFiles.vue";
import { useGetToken } from "@/composables/useGetToken";
import {
  useHandleXhrError,
  useSendXhr,
} from "@/mixins/request/request_composable";

export default {
  name: "DatasetIntegrationsSettings",

  components: {
    IntegrationsListItem,
    BfEmptyPageState,
    BfButton,
    DeleteDataset,
    DatasetSettingsIgnoreFiles,
  },

  mixins: [Request, DeleteDatasetMixin],

  data() {
    return {
      activeIntegrations: [],
      isLoadingIntegrations: false,
      deleteDatasetDialogVisible: false,
    };
  },

  async mounted() {
    try {
      await this.fetchIntegrations();
    } catch (err) {
      console.error(err);
    }
  },

  props: {},

  computed: {
    ...mapGetters([
      "getPermission",
      "datasetLocked",
      "datasetOwner",
      "datasetOwnerHasOrcidId",
      "hasFeature",
      "activeOrganization",
    ]),
    ...mapState("integrationsModule", ["integrations"]),

    ...mapState([
      "dataset",
      "datasetDoi",
      "datasetContributors",
      "datasetDescription",
      "isDatasetOwner",
      "datasetBanner",
      "config",
    ]),

    orgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },

    hasAdminRights: function () {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
        const isOwner = propOr(false, "isOwner", this.activeOrganization);
        return isAdmin || isOwner;
      } else {
        return null;
      }
    },

    /**
     * Retrieves URL for ORCID redirect, based on environment
     * @returns {String}
     */
    getORCIDUrl: function () {
      const url = pathOr("", ["config", "ORCIDUrl"])(this);

      if (!url) {
        return "";
      }
      return url;
    },

    /**
     * Retrieves the API URL for adding ORCID
     * @returns {String}
     */
    getORCIDApiUrl: async function () {
      return useGetToken()
        .then((token) => {
          const url = pathOr("", ["config", "apiUrl"])(this);
          return `${url}/user/orcid?api_key=${token}`;
        })
        .catch((err) => console.log(err));
    },

    /**
     * Compute the license for the dataset
     * @returns {String}
     */
    datasetLicense: function () {
      return pathOr("Add a license", ["content", "license"], this.dataset);
    },

    /**
     * Compute if the user has permission to see the settings page
     * @returns {Boolean}
     */
    hasPermission: function () {
      return this.getPermission("manager");
    },

    datasetPublished: function () {
      return this.dataset.publication && !!this.dataset.publication.publishedDataset;
    },

    datasetOwnerName: function () {
      const firstName = propOr('', 'firstName', this.datasetOwner);
      const lastName = propOr('', 'lastName', this.datasetOwner);
      return `${firstName} ${lastName}`;
    },

    datasetOwnerEmail: function () {
      return propOr('', 'email', this.datasetOwner);
    },

    /**
     * Compute if the user has at least manager permissions
     * @returns {Boolean}
     */
    hasManagerPermissions: function () {
      return this.datasetRole !== "viewer"
        ? this.getPermission("manager")
        : false;
    },

    /**
     * Compute if the dataset has a DOI
     * @returns {Boolean}
     */
    hasDatasetDoi: function () {
      return Object.keys(this.datasetDoi).length;
    },

    /**
     * Compute if the dataset has a banner
     * @returns {Boolean}
     */
    hasBanner: function () {
      return this.datasetBanner !== "";
    },

    /**
     * Compute if the dataset has a subtitle
     * @returns {Boolean}
     */
    hasSubtitle: function () {
      const description = pathOr("", ["content", "description"], this.dataset);
      return Boolean(description);
    },

    /**
     * Compute if the dataset has tags
     * @returns {Boolean}
     */
    hasTags: function () {
      const tags = pathOr([], ["content", "tags"], this.dataset);
      return tags.length > 0;
    },

    /**
     * Compute if the dataset has a description
     * @returns {Boolean}
     */
    hasDescription: function () {
      return this.datasetDescription !== "";
    },

    /**
     * Compute if the dataset has a license
     * @returns {Boolean}
     */
    hasDatasetLicense: function () {
      return this.datasetLicense !== "Add a license";
    },

    /**
     * Compute if the dataset has tags
     * @returns {Boolean}
     */
    hasContributors: function () {
      return this.datasetContributors.length > 0;
    },
  },

  watch: {
    dataset: {
      handler: function (dataset) {
        if (pathOr(false, ["content", "id"], dataset)) {
          const url = `${this.config.apiUrl}/datasets/${dataset.content.id}/webhook`;
          this.isLoadingIntegrations = true;

          useGetToken()
            .then((token) => {
              return useSendXhr(url, {
                header: {
                  Authorization: `Bearer ${token}`,
                },
              }).then((response) => {
                this.activeIntegrations = response;
              });
            })
            .catch((err) => useHandleXhrError(err))
            .finally(() => {
              // Set loading state
              this.isLoadingIntegrations = false;
            });
        }
      },
      deep: true,
      immediate: true,
    },
    /**
     * Watches focusInput route query
     * to scroll into view for right items
     * @param {String} val
     */
    "$route.query.focusInput": {
      handler: function (val) {
        if (val === "dataciteDoi") {
          this.$nextTick(() => {
            this.$refs.dataciteDoi.$el.scrollIntoView();
          });
        }
        if (val === "orcidId") {
          this.$nextTick(() => {
            this.$refs.orcidId.$el.scrollIntoView();
          });
        }
        if (val === "inputAddContributor") {
          this.$nextTick(() => {
            this.$refs.inputAddContributor.$el.scrollIntoView();
          });
        }
      },
      immediate: true,
    },
  },

  methods: {
    ...mapActions(["updateProfile"]),
    ...mapActions("integrationsModule", ["fetchIntegrations"]),

    onDeleteDatasetBtnClick: function () {
      this.deleteDatasetDialogVisible = true;
    },

    onCloseDeleteDialog: function () {
      this.deleteDatasetDialogVisible = false;
    },

    toggleIntegration: function (item) {
      let method = "PUT";
      if (!item.isActive) {
        method = "DELETE";
      }

      useGetToken().then((token) => {
        const url = `${this.config.apiUrl}/datasets/${this.dataset.content.id}/webhook/${item.integration.id}`;
        this.sendXhr(url, {
          method: method,
          header: {
            Authorization: `Bearer ${token}`,
          },
        })
          .catch(this.handleXhrError.bind(this))
          .finally(() => {});
      });
    },

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
          self
            .getORCIDApiUrl()
            .then((url) => {
              return useSendXhr(url, {
                method: "POST",
                body: {
                  authorizationCode: this.oauthCode,
                },
              }).then((response) => {
                // response logic goes here
                self.oauthInfo = response;

                return self.updateProfile({
                  ...self.profile,
                  orcid: self.oauthInfo,
                });
              });
            })
            .catch(self.handleXhrError.bind(this));
        }
      });
    },

    /**
     * Compute checklist icon based on prop
     * @param {Boolean} prop
     * @returns {String}
     */
    computeChecklistIcon: function (prop = false) {
      return prop ? "icon-done-check-circle" : "icon-info";
    },
  },
};
</script>

<style lang="scss" scoped>
@use "../../../styles/theme";

.config-container {
  max-width: 640px;
}

.config-section {
  margin-bottom: 24px;
}

.config-section-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: theme.$gray_5;
  padding: 8px 0;
  margin: 0 0 16px;
  border-bottom: 1px solid theme.$gray_2;

}

.config-section-content {
  padding-bottom: 0;
}

.section-description {
  color: theme.$gray_5;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 16px;

  a {
    color: theme.$purple_3;
  }
}

.integration-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.empty-inline {
  padding: 16px;
  background: theme.$gray_1;
  border-radius: 4px;

  p {
    font-size: 13px;
    color: theme.$gray_5;
    margin: 0;

    a {
      color: theme.$purple_3;
    }
  }
}


.danger-header {
  color: theme.$red_2;
}

.danger-content {
  background: rgba(theme.$red_1, 0.03);
  border-radius: 4px;
  padding: 16px;
}

.danger-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  .danger-info {
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

  :deep(.bf-button.red) {
    background: white;
    color: theme.$red_2;
    border: 1px solid theme.$red_2;
    white-space: nowrap;

    &:hover {
      background: theme.$red_2;
      color: white;
    }
  }
}

.danger-note {
  font-size: 13px;
  color: theme.$gray_4;
  margin-top: 8px;
}
</style>
