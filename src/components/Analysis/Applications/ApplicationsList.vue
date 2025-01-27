<template>
  <bf-stage element-loading-background="transparent">
    <template #actions>
      <bf-button
        :disabled="!isFeatureFlagEnabled || !hasAdminRights"
        @click="openCreateApplicationDialog"
      >
        Create Application
      </bf-button>
    </template>
    <div v-if="applications.length" class="application-list">
      <ApplicationsListItem
        v-for="application in applications"
        :key="application.id"
        :application="application"
        @open-delete-application="openDeleteApplicationDialog"
        @open-edit-application="openEditApplicationDialog"
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
        <h2>There are no applications yet</h2>
        <p>
          Applications allow users to run analytic scripts on data within the
          Pennsieve platform.
        </p>
      </div>

      <div v-if="!hasAdminRights" class="copy">
        <h2>{{ orgName }} doesn't have any applications yet.</h2>
        <p>
          Contact your administrator to get started working with Applications.
        </p>
      </div>
    </bf-empty-page-state>
    <create-application-dialog
      :dialog-visible="addApplicationDialogVisible"
      :application-edit.sync="applicationEdit"
      applicationType="Application"
      @add-application="onAddApplicationConfirm"
      @edit-application="onEditApplicationConfirm"
      @close="onCloseAddDialog"
    />
    <edit-application-dialog
      :dialog-visible="editApplicationDialogVisible"
      :application-edit.sync="applicationEdit"
      applicationType="Application"
      @add-application="onAddApplicationConfirm"
      @edit-application="onEditApplicationConfirm"
      @close="onCloseEditDialog"
    />
    <delete-application-dialog
      ref="deleteApplicationDialog"
      :dialog-visible="deleteApplicationDialogVisible"
      @delete="onDeleteApplicationConfirm"
      @close="onDeleteApplicationCloseDialog"
    />
  </bf-stage>
</template>

<script>
import { mapGetters, mapActions, mapState } from "vuex";

import BfRafter from "../../shared/bf-rafter/BfRafter.vue";
import BfButton from "../../shared/bf-button/BfButton.vue";
import BfEmptyPageState from "../../shared/bf-empty-page-state/BfEmptyPageState.vue";

import CreateApplicationDialog from "./CreateApplicationDialog.vue";
import EditApplicationDialog from "./EditApplicationDialog.vue";
import DeleteApplicationDialog from "./DeleteApplicationDialog.vue";
import ApplicationsListItem from "./ApplicationsListItem.vue";

import Sorter from "../../../mixins/sorter";
import UserRoles from "../../../mixins/user-roles";

import { pathOr, propOr } from "ramda";

import {
  isEnabledForAllDevOrgs,
  isEnabledForSpecificOrgs,
  isEnabledForTestOrgs,
} from "../../../utils/feature-flags.js";

export default {
  name: "ApplicationsList",

  components: {
    BfEmptyPageState,
    BfRafter,
    BfButton,
    ApplicationsListItem,
    CreateApplicationDialog,
    EditApplicationDialog,
    DeleteApplicationDialog,
  },

  mixins: [Sorter, UserRoles],

  data() {
    return {
      addApplicationDialogVisible: false,
      editApplicationDialogVisible: false,
      deleteApplicationDialogVisible: false,
      applicationEdit: {},
    };
  },
  mounted(){
    setInterval(() => {
      console.log("interval 1 min")
        //this.getApplicationsStatus();
    }, 60000); 
  },
  computed: {
    ...mapState(["activeOrganization", "userToken", "config"]),
    ...mapState("analysisModule", ["applications"]),

    isFeatureFlagEnabled: function () {
      const orgId = pathOr("", ["organization", "id"], this.activeOrganization);
      return (
        isEnabledForTestOrgs(orgId) ||
        isEnabledForSpecificOrgs(orgId) ||
        isEnabledForAllDevOrgs(this.config.apiUrl)
      );
    },

    hasAdminRights: function () {
      if (this.activeOrganization) {
        const isAdmin = propOr(false, "isAdmin", this.activeOrganization);
        const isOwner = propOr(false, "isOwner", this.activeOrganization);
        return isAdmin || isOwner;
      } else {
        return false;
      }
    },

    orgName: function () {
      return pathOr("", ["organization", "name"], this.activeOrganization);
    },
  },

  methods: {
    ...mapActions("analysisModule", [
      "fetchApplications",
      "createApplication",
      "deleteApplication",
      "editApplication",
    ]),

    /**
     * Methods to open/close modals
     */
    onDeleteApplicationCloseDialog: function () {
      this.deleteApplicationDialogVisible = false;
    },
    onCloseAddDialog: function () {
      this.addApplicationDialogVisible = false;
    },
    onCloseEditDialog: function () {
      this.editApplicationDialogVisible = false;
    },
    openCreateApplicationDialog: function () {
      this.addApplicationDialogVisible = true;
    },
    openEditApplication: function () {
      this.editApplicationDialogVisible = true;
    },
    openDeleteApplicationDialog: function (application) {
      this.$refs.deleteApplicationDialog.setApplication(application);
      this.deleteApplicationDialogVisible = true;
    },
    openEditApplicationDialog: function (application) {
      this.applicationEdit = application;
      this.editApplicationDialogVisible = true;
    },

    /**
     * Delete application via API
     * @param {Object} application
     */
    onDeleteApplicationConfirm: function (appliction) {
      this.deleteApplication(application.id);
      this.deleteApplicationDialogVisible = false;
    },

    /**
     * Update application via API
     * @param {Object} updatedApplication
     */
    onEditApplicationConfirm: function (updatedApplication) {
      this.editApplication(updatedApplication);
    },

    /**
     * Send add application request to API
     * @param {Object} application
     */
    onAddApplicationConfirm: function (application) {
      this.createApplication(application);
    },
    getApplicationsStatus: function(){
      this.applications = this.fetchApplications();
    }
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/variables";

.addApplicationContainer {
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

.application-list {
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
