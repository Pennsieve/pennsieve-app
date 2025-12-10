<template>
  <div class="applications-list-item">
    <el-row class="info">
      <el-col :span="20" class="application-title">
        <span>{{ application.name }}</span>
      </el-col>
      <el-col :span="4" class="application-title">
        <el-col :sm="8">
          <el-dropdown
            class="options-icon"
            trigger="click"
            placement="bottom-end"
          >
            <span class="btn-file-menu el-dropdown-link">
              <IconMenu :height="20" :width="20" />
            </span>
            <template #dropdown>
              <el-dropdown-menu slot="dropdown" class="bf-menu" :offset="9">
                <el-dropdown-item
                  :disabled="!hasAdminRights"
                  @click.prevent="updateApplicationParams"
                >
                  <el-tooltip
                    disabled="hasAdminRights"
                    class="box-item"
                    effect="dark"
                    content="Only Admin users can edit application params"
                    placement="top-start"
                  >
                    Edit Application Params
                  </el-tooltip>
                </el-dropdown-item>

                <el-dropdown-item
                  @click="isDeleteApplicationDialogOpen = true"
                  :disabled="!hasAdminRights"
                >
                  <el-tooltip
                    disabled="hasAdminRights"
                    class="box-item"
                    effect="dark"
                    content="Only Admin users can delete applications"
                    placement="top-start"
                  >
                    Delete Application
                  </el-tooltip>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-col>
      </el-col>
    </el-row>
    <el-row>
      <p class="application-description">
        {{ application.description }}
      </p>
    </el-row>
    <el-row v-if="githubUrl" class="github-link-row">
      <a :href="githubUrl" target="_blank" rel="noopener noreferrer" class="github-link">
        <svg class="github-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        <span class="github-link-text">{{ githubDisplayUrl }}</span>
      </a>
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
    <el-dialog
      v-model="isDeleteApplicationDialogOpen"
      width="500"
      @close="isDeleteApplicationDialogOpen = false"
    >
      <template #header>
        <bf-dialog-header slot="title" title="Delete Application" />
      </template>
      <span> Would you like to delete this application? </span>
      <template #footer>
        <div class="dialog-footer">
          <bf-button
            class="secondary"
            @click="isDeleteApplicationDialogOpen = false"
            >No</bf-button
          >
          <bf-button @click="handleDeleteApplication">Yes</bf-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { mapActions, mapState } from "vuex";
import { find, propEq } from "ramda";
import FormatDate from "../../../mixins/format-date";
import EventBus from "../../../utils/event-bus";
import BfWaitingIcon from "../../shared/bf-waiting-icon/bf-waiting-icon.vue";
import { Setting } from "@element-plus/icons-vue";
import { CircleClose } from "@element-plus/icons-vue";

export default {
  name: "ApplicationsListItem",
  components: {
    Setting,
    CircleClose,
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
    githubUrl: function () {
      const sourceUrl = this.application?.source?.url;
      if (!sourceUrl) return null;
      // Convert git://github.com/owner/repo to https://github.com/owner/repo
      return sourceUrl.replace(/^git:\/\//, "https://");
    },
    githubDisplayUrl: function () {
      const sourceUrl = this.application?.source?.url;
      if (!sourceUrl) return null;
      // Extract owner/repo from git://github.com/owner/repo
      const match = sourceUrl.match(/github\.com\/(.+)/);
      return match ? match[1] : sourceUrl;
    },
    updateStatusText: function () {
      if (!this.status) return "Status unavailable";

      if (
        ["registering", "deploying", "re-deploying", "pending"].includes(
          this.status
        )
      ) {
        return `Application is ${this.status}`;
      }
      if (this.status.startsWith("error")) {
        return "Application encountered an error";
      }
      return `Application has been ${this.status}`;
    },
    updateButtonDisabled: function () {
      if (
        ["registering", "deploying", "re-deploying", "pending"].includes(
          this.status
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
      isWaitingForResponse: false,
      status: this.application.status,
      pusherChannel: null,
      isDeleteApplicationDialogOpen: false,
    };
  },

  methods: {
    ...mapActions("analysisModule", [
      "updateApplication",
      "fetchApplications",
      "deleteApplication",
    ]),
    handleDeleteApplication: async function () {
      try {
        await this.deleteApplication(this.application);

        EventBus.$emit("toast", {
          detail: {
            type: "success",
            msg: "Your request was successful. It may take some time to complete.",
          },
        });
      } catch (error) {
        EventBus.$emit("toast", {
          detail: {
            type: "error",
            msg: "Something went wrong, please try again later.",
          },
        });
      } finally {
        this.isDeleteApplicationDialogOpen = false;
      }
    },
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
        //await this.fetchApplications();
        this.isWaitingForResponse = false;
      }
    },
    updateApplicationParams: function () {
      this.$emit("open-edit-application-dialog", this.application);
    },
    /**
     * Open pusher channel for each List item
     *
     */
    setupPusherChannel() {
      const pusher = this.$pusher;

      if (!pusher || !this.application.uuid) return;

      // Subscribe to a unique channel
      this.channel = pusher.subscribe(`application-${this.application.uuid}`);
      //bind event name to channel
      this.channel.bind("application_status_event", (data) => {
        this.status = data.status;
      });
    },
    cleanupPusherChannel() {
      if (this.channel) {
        this.channel.unbind("application_status_event");
        this.channel.unsubscribe();
        this.channel = null;
      }
    },
  },

  mounted() {
    this.setupPusherChannel();
  },

  beforeUnmount() {
    this.cleanupPusherChannel();
  },
};
</script>

<style scoped lang="scss">
@use "../../../styles/theme";

.applications-list-item {
  width: 230px;
  height: 300px;
  border: 1px solid theme.$gray_3;
  margin: 0 8px 16px 8px;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.application-title {
  display: flex;
  font-size: 16px;
  color: black;
  justify-content: space-between;
  align-items: center;
}

.application-description {
  font-size: 14px;
  color: theme.$gray_5;
  min-height: 3em;
  max-width: 500px;
  margin: 8px;
  overflow-wrap: break-word;
}

.github-link-row {
  margin: 0 8px 8px 8px;
}

.github-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: theme.$gray_5;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s ease;

  &:hover {
    color: theme.$purple_1;
    text-decoration: underline;
  }
}

.github-icon {
  flex-shrink: 0;
}

.github-link-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.info {
  background: theme.$purple_tint;
  padding: 16px 8px;
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

.delete-application-container {
  display: flex;
  justify-content: flex-end;
  background: theme.$purple_tint;
}
</style>
