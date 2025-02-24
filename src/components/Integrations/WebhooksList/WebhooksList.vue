<template>
  <bf-page class="integrations-list">
    <bf-stage slot="stage" element-loading-background="transparent">
      <template #actions>
        <bf-button v-if="hasAdminRights" @click="openAddIntegration">
          Register Webhook
        </bf-button>
      </template>

      <div v-if="filteredWebhooks.length > 0" class="integration-list">
        <integrations-list-item
          v-for="integration in filteredWebhooks"
          :key="integration.id"
          :integration="integration"
          @open-remove-integration="openDeleteIntegrationDialog"
          @open-edit-integration="openEditIntegrationDialog"
        />
      </div>

      <bf-empty-page-state v-else class="empty">
        <img
          src="../../../assets/images/illustrations/illo-collaboration.svg"
          :height="240"
          :width="247"
          alt="Teams illustration"
        />
        <div class="copy">
          <h2>There are no Webhooks yet</h2>
          <p>
            Webhooks allow external services to be notified when certain events
            occur on Pennsieve.
          </p>
        </div>
        <div v-if="!hasAdminRights" class="copy">
          <h2>{{ orgName }} doesn't have any integrations yet.</h2>
          <p>
            Contact your administrator to get started working with Integrations.
          </p>
        </div>
      </bf-empty-page-state>
    </bf-stage>

    <add-edit-integration-dialog
      :dialog-visible="addEditIntegrationDialogVisible"
      :integration-edit.sync="integrationEdit"
      integrationType="Webhook"
      @add-integration="onAddIntegrationConfirm"
      @edit-integration="onEditIntegrationConfirm"
      @close="onCloseAddEditDialog"
    />

    <remove-integration-dialog
      ref="removeIntegrationDialog"
      :dialog-visible="removeIntegrationDialogVisible"
      @delete="onDeleteIntegrationConfirm"
      @close="onRemoveIntegrationCloseDialog"
    />

    <integration-api-key-details
      ref="apiKeyDetails"
      :dialog-visible="APIKeyDetailsVisible"
      @close="onApiKeyCloseDialog"
    />
  </bf-page>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";

import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";

import AddEditIntegrationDialog from "../AddEditIntegrationDialog.vue";
import IntegrationsListItem from "../IntegrationsListItem/IntegrationsListItem.vue";
import Sorter from "../../../mixins/sorter";
import UserRoles from "../../../mixins/user-roles";
import RemoveIntegrationDialog from "../removeIntegrationDialog.vue";

import { pathOr, propOr } from "ramda";
import DeleteApiKey from "../../my-settings/windows/DeleteApiKey.vue";
import IntegrationApiKeyDetails from "../integrationApiKeyDetails.vue";

export default {
  name: "WebhooksList",

  components: {
    IntegrationApiKeyDetails,
    DeleteApiKey,
    BfEmptyPageState,
    BfRafter,
    BfButton,
    IntegrationsListItem,
    AddEditIntegrationDialog,
    RemoveIntegrationDialog,
  },

  mixins: [Sorter, UserRoles],

  props: {
    integrations: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    return {
      addEditIntegrationDialogVisible: false,
      removeIntegrationDialogVisible: false,
      APIKeyDetailsVisible: false,
      integrationDelete: null,
      integrationEdit: {},
    };
  },

  computed: {
    ...mapGetters(["activeOrganization", "config", "hasFeature"]),

    filteredWebhooks: function () {
      let filteredArray = this.integrations.filter(
        (x) => !x.customTargets || x.customTargets.length == 0
      );

      return filteredArray;
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
    ...mapActions("integrationsModule", [
      "createIntegration",
      "removeIntegration",
      "editIntegration",
    ]),

    ...mapState([]),

    onApiKeyCloseDialog: function () {
      this.APIKeyDetailsVisisble = false;
    },
    onRemoveIntegrationCloseDialog: function () {
      this.removeIntegrationDialogVisible = false;
    },

    onCloseAddEditDialog: function () {
      this.integrationEdit = {};
      this.addEditIntegrationDialogVisible = false;
    },

    openDeleteIntegrationDialog: function (integration) {
      this.$refs.removeIntegrationDialog.setIntegration(integration);
      this.removeIntegrationDialogVisible = true;
    },
    onDeleteIntegrationConfirm: function (integration) {
      this.removeIntegration(integration.id);
      this.removeIntegrationDialogVisible = false;
    },
    openEditIntegrationDialog: function (integration) {
      this.integrationEdit = integration;
      this.addEditIntegrationDialogVisible = true;
    },
    /**
     * Open the add property dialog
     */
    openAddIntegration: function () {
      this.addEditIntegrationDialogVisible = true;
    },

    /**
     * Update integration via API
     * @param {Object} Integration
     */
    onEditIntegrationConfirm: function (integration) {
      let eventTargets = [];
      for (const [key, value] of Object.entries(integration.eventTypeList)) {
        if (value) {
          eventTargets.push(key);
        }
      }

      let integrationDTO = {
        id: integration.id,
        displayName: integration.displayName,
        description: integration.description,
        apiUrl: integration.apiUrl,
        isPrivate: !integration.isPublic,
        imageUrl: integration.imageUrl,
        isDefault: integration.isDefault,
        hasAccess: integration.hasAccess,
        targetEvents: eventTargets,
      };

      if (integration.secret) {
        integrationDTO.secret = integration.secret;
      }

      this.editIntegration(integrationDTO);
    },

    /**
     * Send add integration request to API
     * @param {Object} integration
     */
    onAddIntegrationConfirm: function (integration) {
      let eventTargets = [];
      for (const [key, value] of Object.entries(integration.eventTypeList)) {
        if (value) {
          eventTargets.push(key);
        }
      }

      let integrationDTO = {
        displayName: integration.displayName,
        secret: integration.secret,
        description: integration.description,
        apiUrl: integration.apiUrl,
        isPrivate: !integration.isPublic,
        imageUrl: integration.imageUrl,
        isDefault: integration.isDefault,
        hasAccess: integration.integrationType === "viewer" ? false : true,
        targetEvents: eventTargets,
      };

      this.createIntegration(integrationDTO).then((response) => {
        let detailPopup = this.$refs.apiKeyDetails;
        detailPopup.apiKey = {
          key: response.tokenSecret.key,
          secret: response.tokenSecret.secret,
        };
        this.APIKeyDetailsVisisble = true;
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
  //margin-left: 8px;
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
