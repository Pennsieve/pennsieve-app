<template>
  <div class="applications-list-item">
    <el-row class="info">
      <div class="application-title">
        {{ application.name }}
      </div>
    </el-row>
    <el-row>
      <p class="application-description">
        {{ application.description }}
      </p>
    </el-row>
    <el-row v-if="hasAdminRights" class="applications-update-app">
      <div class="update-button-div">
        <el-button
          @click="deployApplication"
          class="update-button"
          :disabled="updateButtonDisabled"
        >
          Update
        </el-button>
        <div v-if="isWaitingForResponse" class="icon-waiting mr-16">
          <bf-waiting-icon />
        </div>
      </div>
      <div>
        <el-row class="applications-status">
          <p>
            {{ updateStatusText }}
          </p>
        </el-row>
      </div>
    </el-row>
  </div>
</template>

<script>
import { mapActions, mapState } from "vuex";
import { find, propEq } from "ramda";
import FormatDate from "../../../mixins/format-date";
import Avatar from "../../shared/avatar/Avatar.vue";
import IconMenu from "../../icons/IconMenu.vue";
import EventBus from "../../../utils/event-bus";
import BfWaitingIcon from "../../shared/bf-waiting-icon/bf-waiting-icon.vue";

export default {
  name: "IntegrationListItem",

  components: {
    IconMenu,
    Avatar,
  },
  mixins: [FormatDate],

  props: {
    application: {
      type: Object,
      default: () => ({}),
    },
  },

  computed: {
    ...mapState(["activeOrganization"]),
    hasAdminRights: function () {
      if (this.activeOrganization) {
        const isAdmin = this.activeOrganization?.isAdmin ?? false;
        const isOwner = this.activeOrganization?.isOwner ?? false;
        return isAdmin || isOwner;
      } else {
        return false;
      }
    },
    updateStatusText: function () {
      if (
        ["registering", "deploying", "re-deploying", "pending"].includes(
          this.application.status
        )
      ) {
        return "application is " + this.application.status;
      } else if (this.application.status === "error") {
        return "applicaiton encountered an error";
      } else {
        return "application has been " + this.application.status;
      }
    },
    updateButtonDisabled: function () {
      if (
        ["registering", "deploying", "re-deploying", "pending"].includes(
          this.application.status
        ) ||
        this.isWaitingForResponse
      ) {
        return true;
      } else {
        return false;
      }
    },
  },

  data: function () {
    return {
      isActive: false,
      isWaitingForResponse: false,
      status: "deployed",
      integrationEdit: {
        type: Object,
        default: function () {
          return {};
        },
      },
    };
  },
  methods: {
    ...mapActions("analysisModule", ["updateApplication", "fetchApplications"]),
    deployApplication: async function () {
      this.isWaitingForResponse = true;
      try {
        const accountDetails = {
          uuid: this.application.account.uuid,
          accountId: this.application.account.accountId,
          accountType: this.application.account.accountType,
        };
        const destination = {
          type: this.application.destination.type,
          url: this.application.destination.url,
        };
        const formattedSource = {
          type: this.application.source.type,
          url: this.application.source.url,
        };
        const formattedUpdateDataset = {
          uuid: this.application.uuid,
          account: accountDetails,
          destination: destination,
          source: formattedSource,
        };

        await this.updateApplication(formattedUpdateDataset);
        EventBus.$emit("toast", {
          detail: {
            type: "success",
            msg: "Your request has been successfully submitted.",
          },
        });
      } catch (error) {
        console.error(error);
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: "There was a problem submitting your request.",
          },
        });
      } finally {
        await this.fetchApplications();
        this.isWaitingForResponse = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../../assets/_variables.scss";

.applications-list-item {
  width: 230px;
  height: 300px;
  border: 1px solid $gray_3;
  margin: 0 8px 16px 8px;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.application-title {
  font-size: 16px;
  margin: 16px 4px;
  color: black;
  text-align: center;
}

.application-description {
  font-size: 14px;
  color: $gray_5;
  min-height: 3em;
  max-width: 500px;
  margin: 8px;
  overflow-wrap: break-word;
}

.info {
  background: $purple_tint;
  padding: 8px;
}
.applications-update-app {
  flex-flow: row;
  height: 100%;
  width: 100%;
  align-items: end;
  margin: 8px;

  .applications-status {
    color: gray;
    margin-right: 15px;
    text-align: end;
    p {
      margin: 0%;
    }
  }

  .update-button-div {
    max-width: 33%;
    margin-right: 5px;
  }
  .update-button {
    background-color: #011f5b;
    color: white;
    &.disabled {
      opacity: 0.6;
    }
  }
}

.icon-waiting {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  height: 24px;
  justify-content: center;
  width: 24px;
}
</style>
