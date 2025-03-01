<template>
  <bf-stage slot="stage">
    <!-- update profile -->
    <el-form
      id="update-profile-form"
      ref="updateProfileForm"
      :model="ruleForm"
      :rules="rules"
      label-position="top"
    >
      <el-form-item label="First Name" prop="firstName">
        <el-input v-model="ruleForm.firstName" />
      </el-form-item>
      <el-form-item
        id="input-middle-initial"
        label="Middle Initial"
        prop="middleInitial"
      >
        <el-input v-model="ruleForm.middleInitial" :maxlength="1" />
      </el-form-item>
      <el-form-item label="Last Name" prop="lastName">
        <el-input v-model="ruleForm.lastName" />
      </el-form-item>
      <el-form-item label="Title" prop="credential">
        <el-input v-model="ruleForm.credential" />
      </el-form-item>
      <el-form-item label="Degree" prop="degree">
        <degree-select v-model="ruleForm.degree" />
      </el-form-item>
      <el-form-item>
        <bf-button @click="handleUpdateProfileSubmit">
          Update Profile
        </bf-button>
      </el-form-item>
    </el-form>
    <div class="divider" />
    <!-- reset password -->
    <!--      TODO: bring this back, need to update to directly hit Cognito instead of a non-existing API call.-->

    <el-row>
      <el-col :span="12">
        <h2>Password</h2>
        <p>
          To reset your password, please log out and use the 'forgot my
          password' link on the login page. We'll send you an email containing a
          link to reset your password.
        </p>
      </el-col>
    </el-row>
    <div class="divider" />
    <!-- email reset -->
    <el-row>
      <el-col :span="12">
        <h2>Email</h2>
        <el-row class="mb-20">
          <p>We'll send you an email to confirm your new preferred address.</p>
        </el-row>
        <!-- change div info -->
        <el-form
          id="update-email-form"
          ref="updateEmailForm"
          :model="emailForm"
          :rules="emailRules"
          @submit.native.prevent="handleUpdateEmailSubmit"
        >
          <el-form-item prop="email">
            <el-input v-model="emailForm.email" />
          </el-form-item>
          <el-form-item>
            <bf-button
              :disabled="isEmailButtonDisabled"
              @click="handleUpdateEmailSubmit"
            >
              Update Email
            </bf-button>
          </el-form-item>
        </el-form>
      </el-col>
    </el-row>
    <div class="divider" />
    <!-- two-factor auth -->
    <el-row>
      <el-col :span="12">
        <h2>Two-Factor Authentication</h2>
        <el-row class="mb-20">
          <p>
            Keep your account secure by providing a security code from a trusted
            device each time you sign in. Two-factor authentication requires the
            free
            <a href="https://authy.com/download/" target="_blank"> Authy </a>
            app for iOS or Android.
          </p>
        </el-row>
        <el-row class="two-factor-wrap" justify="space-between">
          <el-col :span="12">
            <div class="two-factor-status-wrap">
              <span class="status-text">
                Status: {{ authEnabled ? "On" : "Off" }}
              </span>
              <span class="status-icon" :class="{ enabled: authEnabled }">
                <IconLock
                  :isLocked="authEnabled"
                  :height="20"
                  :width="20"
                  color="currentColor"
                />
              </span>
            </div>
          </el-col>
          <el-col :span="12" class="two-factor-col-btn">
            <bf-button @click="handleTwoFactorBtnClick(authEnabled)">
              {{ authEnabled ? "Disable" : "Enable" }}
            </bf-button>
          </el-col>
        </el-row>
      </el-col>
    </el-row>
    <div class="divider" />
    <!-- api keys -->
    <el-row>
      <el-col :span="12">
        <h2>API Keys</h2>
        <el-row v-if="hasApiKeys">
          <p>
            This is the list of API keys associated with your account and
            organization.
          </p>
        </el-row>
        <el-row class="mb-20">
          <bf-button @click="openApiKeyWindow('createApiKeyDialog')">
            Create API Key
          </bf-button>
        </el-row>
        <el-row class="mb-20">
          <template v-if="!hasApiKeys">
            <p>
              There are no API keys associated with this account and
              organization.
            </p>
          </template>
          <template v-else>
            <div
              v-loading="isApiKeysLoading"
              class="bf-table"
              element-loading-background="transparent"
            >
              <div class="bf-table-header">
                <el-row type="flex" :gutter="20">
                  <el-col>
                    <button
                      :class="[isSorting('name') ? 'sort-active' : '']"
                      @click="sortColumn('name')"
                    >
                      Name
                      <IconSort
                        color="currentColor"
                        :class="[
                          this.sortDirection === 'desc' ? 'svg-flip' : '',
                        ]"
                      />
                    </button>
                  </el-col>
                </el-row>
              </div>
              <div
                v-for="apiKey in apiKeys"
                :key="apiKey.key"
                class="bf-table-row"
                :item="apiKey"
              >
                <el-row align="middle">
                  <el-col :span="16">
                    <span>
                      {{ apiKey.name }}
                    </span>
                  </el-col>
                  <el-col :span="8" class="api-key-col-delete-btn">
                    <button
                      @click="openApiKeyWindow('deleteApiKeyDialog', apiKey)"
                    >
                      <IconRemove :height="10" :width="10" color="black" />
                    </button>
                  </el-col>
                </el-row>
              </div>
            </div>
          </template>
        </el-row>
      </el-col>
    </el-row>

    <div class="divider" />
    <!-- ORCID -->
    <el-row>
      <el-col :span="12">
        <h2 id="orcid-id">ORCID</h2>
        <div v-if="!hasOrcidId">
          <p>
            Connect your Pennsieve Profile to your ORCID.
            <a
              href="https://docs.pennsieve.io/docs/orcid-ids-on-the-pennsieve-platform"
            >
              Learn More
            </a>
          </p>

          <button id="connect-orcid-button" @click="openORCID">
            <img
              id="orcid-id-icon"
              src="../../assets/images/orcid_24x24.png"
              width="24"
              height="24"
              alt="Logo for ORCID"
            />
            Register or Connect your ORCID iD
          </button>
        </div>
        <!--        <el-row v-else>-->
        <div v-else>
          <p class="orcid-success-text">
            Below is the ORCID associated with your Pennsieve account.
            <a
              href="https://docs.pennsieve.io/docs/orcid-ids-on-the-pennsieve-platform"
              target="_blank"
            >
              Learn More
            </a>
          </p>
          <div v-if="!loading" class="integration-success">
            <img src="../../assets/images/orcid.png" alt="orcid image" />
            <el-row
              class="orcid-success-info"
              align="middle"
              alt="Logo for ORCID"
            >
              <el-col>
                <a :href="getORCIDResultUrl" target="_blank">
                  {{ getORCIDResultUrl }}
                </a>
              </el-col>
            </el-row>
            <el-col class="delete orcid-delete-button">
              <button @click="isDeleteOrcidDialogVisible = true">
                <IconRemove :height="10" :width="10" color="black" />
              </button>
            </el-col>
          </div>
          <!--          <div v-else class="orcid-waiting">-->
          <!--            <el-row>-->
          <!--              <div v-loading="loading" class="orcid-loader" />-->
          <!--            </el-row>-->
          <!--          </div>-->
          <el-row class="mt-20" v-if="!publishToOrcid">
            <el-tooltip
              placement="right"
              content="Authorize Pennsieve to update ORCID with all of your Published Datasets"
            >
              <bf-button @click="openORCID">
                Update ORCID Publish Preferences
              </bf-button>
            </el-tooltip>
          </el-row>
        </div>
        <!--        </el-row>-->
      </el-col>
    </el-row>

    <create-two-factor ref="addTwoFactorDialog" @change-status="changeStatus" />

    <delete-two-factor
      ref="deleteTwoFactorDialog"
      @change-status="changeStatus"
    />

    <create-api-key
      ref="createApiKeyDialog"
      @api-key-created="updateApiKeys"
      :api-keys="apiKeys"
    />

    <delete-api-key
      ref="deleteApiKeyDialog"
      :api-key="apiKey"
      @api-key-deleted="updateApiKeys"
    />

    <api-key-detail ref="apiKeyDetailDialog" :api-key="apiKey" />

    <delete-orcid
      ref="deleteOrcidDialog"
      :visible="isDeleteOrcidDialogVisible"
      @orcid-deleted-success="updateORCID"
      @orcid-close="updateORCID2"
    />

    <delete-git-hub
      ref="deleteGitHubDialog"
      :visible="isDeleteGitHubDialogVisible"
      @deleted-success="updateGitHub"
      @close="closeGitHubDialog"
    />
  </bf-stage>
</template>

<script>
import { mapActions, mapGetters, mapState } from "vuex";
import EventBus from "../../utils/event-bus";
import {getCurrentUser} from "aws-amplify/auth";

import { pathOr, propOr, prop, has } from "ramda";

import BfRafter from "../shared/bf-rafter/BfRafter.vue";
import BfButton from "../shared/bf-button/BfButton.vue";
import CreateTwoFactor from "./windows/CreateTwoFactor.vue";
import DeleteTwoFactor from "./windows/DeleteTwoFactor.vue";
import CreateApiKey from "./windows/CreateApiKey.vue";
import DeleteApiKey from "./windows/DeleteApiKey.vue";
import DeleteOrcid from "./windows/DeleteOrcid.vue";
import ApiKeyDetail from "./windows/ApiKeyDetail.vue";
import DegreeSelect from "../shared/DegreeSelect/DegreeSelect.vue";

import Request from "../../mixins/request";
import Sorter from "../../mixins/sorter";
import IconRemove from "../icons/IconRemove.vue";
import IconSort from "../icons/IconSort.vue";
import {useGetToken} from "@/composables/useGetToken";
import IconLock from "@/components/icons/IconLock.vue";
import IconGitHub from "@/components/icons/IconGitHub.vue";
import DeleteGitHub from "@/components/my-settings/windows/DeleteGitHub.vue";
import { isEnabledForTestOrgs } from "../../utils/feature-flags";
import {useSendXhr} from "@/mixins/request/request_composable";

export default {
  name: "MySettingsContainer",

  components: {
    DeleteGitHub,
    IconGitHub,
    IconLock,
    IconSort,
    IconRemove,
    BfRafter,
    BfButton,
    CreateTwoFactor,
    DegreeSelect,
    DeleteTwoFactor,
    CreateApiKey,
    DeleteApiKey,
    DeleteOrcid,
    ApiKeyDetail,
  },

  mixins: [Request, Sorter],

  data() {
    return {
      emailButtonDisabled: false,
      sortDirection: "asc",
      apiKeys: [],
      mfaStatus: false,
      isApiKeysLoading: true,
      ruleForm: {
        firstName: "",
        middleInitial: "",
        lastName: "",
        credential: "",
        degree: null,
      },
      rules: {
        firstName: [
          {
            required: true,
            message: "Please provide your first name",
            trigger: "false",
          },
        ],
        lastName: [
          {
            required: true,
            message: "Please provide your last name",
            trigger: "false",
          },
        ],
      },
      emailForm: {
        email: "",
      },
      emailRules: {
        email: [
          {
            required: true,
            message: "Please provide your new email address",
            trigger: false,
          },
        ],
      },
      oauthWindow: "",
      oauthCode: "",
      orcidInfo: {},
      loading: false,
      isDeleteOrcidDialogVisible: false,
      isDeleteGitHubDialogVisible: false,
      prevEmail: "",
      apiKey: {
        name: "",
        key: "",
      },
    };
  },

  computed: {
    ...mapState([
      "profile",
      "activeOrganization",
      "config",
      "cognitoUser",
      "gitHubProfile",
    ]),

    ...mapGetters(["hasOrcidId", "publishToOrcid"]),

    hasGithubProfile: function () {
      return has("login", this.gitHubProfile);
    },

    windowLocation: function () {
      return window.location.origin;
    },

    /**
     * Checks whether or not auth is enabled
     * @returns {Boolean}
     */
    authEnabled: function () {
      return (
        this.cognitoUser.preferredMFA === "SOFTWARE_TOKEN_MFA" ||
        this.cognitoUser.challengeName === "SOFTWARE_TOKEN_MFA" ||
        this.mfaStatus
      );
    },

    hasApiKeys: function () {
      return this.apiKeys.length > 0;
    },

    getApiKeysUrl: async function () {
      const url = pathOr("", ["config", "apiUrl"])(this);

      return await useGetToken()
        .then(token => {
          return `${url}/token?api_key=${token}`;
        })

    },

    /**
     * Retrieves URL for ORCID redirect, based on environment
     */
    getORCIDUrl: function () {
      const url = pathOr("", ["config", "ORCIDUrl"])(this);

      if (!url) {
        return "";
      }
      return url;
    },

    /**
     * Retrieves Url to display with name once ORCID is connected to user profile
     */
    getORCIDResultUrl: function () {
      const env = pathOr("N/A", ["environment"], this.config);
      const orcid = pathOr("", ["orcid", "orcid"], this.profile);

      return env === "dev"
        ? `https://sandbox.orcid.org/${orcid}`
        : `https://orcid.org/${orcid}`;
    },

    getGitHubAppUrl: function () {
      const url = pathOr("", ["config", "GitHubAppUrl"])(this);

      if (!url) {
        return "";
      }
      return url;
    },

    isEmailButtonDisabled: function () {
      return this.emailButtonDisabled;
    },
    activeOrganizationId: function () {
      return pathOr(
        "Organization",
        ["organization", "id"],
        this.activeOrganization
      );
    },
    showFeatureForTestOrgs: function () {
      return isEnabledForTestOrgs(this.activeOrganizationId);
    },
  },

  watch: {
    profile: function (profile) {
      this.setRuleFormData(profile);
    },
    getApiKeysUrl: function (url) {
      if (!url) {
        return;
      }
      this.getApiKeys();
    },
  },
  mounted() {
    this.setRuleFormData(this.profile);
    this.setEmailFormData(this.profile.email);
    this.getApiKeys();
    this.scrollToElement();
    this.getCognitoUser();
    this.prevEmail = this.profile.email;
  },

  methods: {
    ...mapActions([
      "updateProfile",
      "updateGithubProfile",
      "updateCognitoUser",
    ]),

    changeStatus: function (val) {
      this.mfaStatus = val;
    },

    closeGitHubDialog: function () {
      this.isDeleteGitHubDialogVisible = false;
    },

    updateGitHub: function () {
      this.updateGithubProfile({});
    },

    /**
     * Get current authenticated Cognito user
     */
    getCognitoUser: function () {
      getCurrentUser()
        .then((user) => {
          this.updateCognitoUser(user);
        })
        .catch(this.handleXhrError.bind(this));
    },

    /**
     * Scroll to element
     */
    scrollToElement: function () {
      const scrollTo = pathOr("", ["query", "scrollTo"], this.$route);
      if (scrollTo && this.$el) {
        const scrollToEl = this.$el.querySelector(`#${scrollTo}`);
        if (scrollToEl) {
          scrollToEl.scrollIntoView();

          // Remove query
          this.$router.replace({ query: {} });
        }
      }
    },

    /**
     * Makes call to re-sort table by column
     * @param {String} key
     */
    sortColumn: function (key) {
      this.apiKeys = this.returnSort(key, this.apiKeys);
    },
    /**
     * Opens proper two factor dialog
     * @param {Boolean} hasAuthyId
     */
    handleTwoFactorBtnClick: function (authEnabled) {
      if (!authEnabled) {
        this.$refs.addTwoFactorDialog.dialogVisible = true;
      } else {
        this.$refs.deleteTwoFactorDialog.dialogVisible = true;
      }
    },
    /**
     * Update profile form data
     */
    setRuleFormData: function (profile) {
      if (!profile) {
        return;
      }
      const { firstName, lastName, credential, degree, middleInitial } =
        profile;

      this.ruleForm = {
        firstName,
        lastName,
        credential,
        degree,
        middleInitial,
      };
    },
    setEmailFormData: function (newEmail) {
      const email = newEmail;
      this.emailForm = {
        email,
      };
    },
    /**
     * Validates user profile form
     */
    handleUpdateProfileSubmit: function () {
      this.$refs.updateProfileForm.validate((valid) => {
        if (!valid) {
          return;
        }

        this.submitUpdateProfileRequest();
      });
    },

    //validate email form
    handleUpdateEmailSubmit: function () {
      var temp = this.$refs.updateEmailForm;
      //UNCOMMENT AFTER DEBUGGING:
      /*
      this.$refs.updateEmailForm.validate(valid => {
        if (!valid){
          return
        }

        this.submitUpdateEmailRequest()
      })
      */
      this.submitUpdateEmailRequest();
    },
    /**
     * Makes XHR call to update a user profile
     */
    submitUpdateProfileRequest: function () {
      useGetToken()
        .then(token => {
          const url = `${this.config.apiUrl}/user?api_key=${token}`
          return this.sendXhr(url, {
            method: "PUT",
            body: {
              organization: this.profile.preferredOrganization,
              email: this.profile.email,
              url: this.profile.url,
              color: this.profile.color,
              ...this.ruleForm,
            },
          })

        })
        .then(this.handleUpdateProfileXhrSuccess.bind(this))
        .catch(this.handleXhrError.bind(this));
    },
    //XHR call to update email address
    submitUpdateEmailRequest: function () {
      this.emailButtonDisabled = true;

      useGetToken()
        .then(token => {
          const url =`${this.config.apiUrl}/user/email?api_key=${token}`
          return useSendXhr(url, {
            method: "PUT",
            body: {
              organization: this.profile.preferredOrganization,
              url: this.profile.url,
              color: this.profile.color,
              userRequestedChange: true,
              ...this.emailForm,
              ...this.ruleForm,
            },
          })
        })
        .then(this.handleUpdateEmailXhrSuccess.bind(this))
        .catch(this.handleXhrEmailError.bind(this));
    },
    /**
     * Handles successful two factor xhr response
     * @param {Object} response
     */
    handleUpdateProfileXhrSuccess: function (response) {
      this.emailButtonDisabled = false;
      EventBus.$emit("toast", {
        detail: {
          type: "success",
          msg: "Profile Updated",
        },
      });
      this.updateProfile({
        ...this.profile,
        ...response,
      });
    },
    /**
     * Handles successful two factor xhr response
     * @param {Object} response
     */
    handleUpdateEmailXhrSuccess: function (response) {
      EventBus.$emit("toast", {
        detail: {
          type: "success",
          msg: "Email Successfully Updated",
        },
      });

      //NOTE: Should update profile with email update
      this.updateProfile({
        ...this.profile,
        ...response,
      });
    },

    handleXhrEmailError: function (response) {
      EventBus.$emit("toast", {
        detail: {
          type: "error",
          msg: "ERROR: Email was not successfully updated. Please try again or use another email.",
        },
      });
    },
    /**
     * Fetches api keys for logged in user
     */
    getApiKeys: function () {

      this.getApiKeysUrl
        .then(url => {
          this.sendXhr(url)
            .then((response) => {
              this.apiKeys = this.returnSort("name", response);
              this.isApiKeysLoading = false;
            })
            .catch(this.handleXhrError.bind(this));
        })


    },
    /**
     * Update API keys after CREATE & DELETE XHR calls
     * @param {Object} payload
     */
    updateApiKeys: function (payload) {
      const { apiKey, type } = payload;
      const apiKeys = [...this.apiKeys];

      if (type === "CREATED") {
        // render api key detail dialog
        this.openApiKeyWindow("apiKeyDetailDialog", apiKey);

        // add key to list
        apiKeys.push(payload.apiKey);

        // update keys list
        this.apiKeys = this.returnSort("name", apiKeys);
      } else if (type === "DELETED") {
        const index = this.apiKeys.findIndex((item) => item.key === apiKey.key);
        apiKeys.splice(index, 1);
        this.apiKeys = this.returnSort("name", apiKeys);
      }
    },

    /**
     * Function that's called after ORCID is deleted
     */
    updateORCID: function () {
      this.isDeleteOrcidDialogVisible = false;
      this.updateProfile({
        ...this.profile,
        orcid: {},
      });
    },
    updateORCID2: function () {
      this.isDeleteOrcidDialogVisible = false;
    },

    /**
     * Open api key dialog
     * @param {String} refName
     * @param {Object} apiKey
     */
    openApiKeyWindow: function (refName, apiKey = {}) {
      this.apiKey = apiKey;

      const dialog = this.$refs[refName];
      dialog.dialogVisible = true;
    },
    /**
     * Logout the user
     */
    logout: function () {
      EventBus.$emit("logout");
    },

    openGitHub: function () {
      this.oauthWindow = window.open(
        `${this.getGitHubAppUrl}?redirect_uri=${this.windowLocation}`,
        "_blank",
        "toolbar=no, scrollbars=yes, width=600, height=800, top=200, left=500"
      );
      const self = this;
      window.addEventListener("message", function (event) {
        if (
          event.data &&
          event.data.source &&
          event.data.source === "github-redirect-response" &&
          event.data.code
        ) {
          this.oauthCode = event.data.code;
          if (this.oauthCode !== "") {
            if (!self.getGitHubApiUrl) {
              return;
            }

            self
              .sendXhr(self.getGitHubApiUrl, {
                method: "POST",
                header: {
                  Authorization: `Bearer ${self.userToken}`,
                },
                body: {
                  code: this.oauthCode,
                  installation_id: event.data.installationId,
                },
              })
              .then((response) => {
                // TODO: Handle the Authentication token
                // response logic goes here
                self.updateGithubProfile(response);

                // self.oauthInfo = response;
                //
                // self.updateProfile({
                //   ...self.profile,
                //   orcid: self.oauthInfo,
                // });

                EventBus.$emit("toast", {
                  detail: {
                    type: "success",
                    msg: "Your GitHub account has been successfully added",
                  },
                });
              })
              .catch(self.handleXhrError.bind(this));
          }
        }
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
        if (
          event.data &&
          event.data.source &&
          event.data.source === "orcid-redirect-response" &&
          event.data.code
        ) {
          this.oauthCode = event.data.code;
          if (this.oauthCode !== "") {

            useGetToken()
              .then(token => {
                const url = `${self.config.apiUrl}/user/orcid?api_key=${token}`;
                return useSendXhr(url, {
                  method: "POST",
                  body: {
                    authorizationCode: {
                      source: "orcid-redirect-response",
                      code: this.oauthCode,
                    },
                  },
                })
                  .then((response) => {
                    // response logic goes here
                    self.oauthInfo = response;

                    self.updateProfile({
                      ...self.profile,
                      orcid: self.oauthInfo,
                    });

                    EventBus.$emit("toast", {
                      detail: {
                        type: "success",
                        msg: "Your ORCID has been successfully added",
                      },
                    });
                  })
              })
              .catch(self.handleXhrError.bind(this));
          }
        }
      });
    },

    /**
     * Opens deleteORCID modal
     * @param {String} refName
     */
    openORCIDWindow: function () {
      this.$refs.deleteOrcidDialog.dialogVisible = true;
    },
  },
};
</script>

<style scoped lang="scss">
@import "../../assets/_variables";

.mt-20 {
  margin-top: 20px;
}

.mb-20 {
  margin-bottom: 20px;
}

p {
  font-size: 13px;
}

.divider {
  background: $gray_2;
  height: 1px;
  margin: 19px 1px 20px 1px;
}

.two-factor-wrap {
  background: white;
  border: 1px solid #dadada;
  height: 48px;
  max-width: 560px;
}

.two-factor-status-wrap {
  margin: 12px 0 0 15px;

  .status-text {
    vertical-align: bottom;
  }

  .status-icon {
    color: red;

    &.enabled {
      color: green;
    }
  }
}

.two-factor-col-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-right: 4px;

  .bf-button {
    margin-top: 3px;
  }
}

.api-key-col-delete-btn {
  display: flex;
  flex-direction: row-reverse;
  padding-right: 16px;

  button {
    color: $gray_4;
    &:hover,
    &:focus {
      cursor: pointer;
      color: $purple_1;
    }
  }
}

.bf-table {
  min-width: 540px;
}

.bf-table-row {
  .el-row {
    height: 40px;
  }
}

#connect-orcid-button {
  border: 1px solid #d3d3d3;
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

.integration-success {
  border: solid 1px #dadada;
  padding: 10px;
  display: flex;
  flex-direction: row;
  background: #fff;
  align-content: center;
  align-items: center;

  .link {
    margin-left: 20px;
  }

  .delete {
    flex: 1;
    text-align: right;
  }

  .orcid-waiting {
    padding-top: 30px;
    padding-bottom: 20px;
    flex: 1;
  }

  .orcid-waiting {
    padding-top: 30px;
    padding-bottom: 20px;
    flex: 1;
  }

  .orcid-success-info {
    .orcid-success-text {
      margin-left: 10px;
      margin-top: 8px;
      margin-bottom: 0;

      a {
        margin-left: 3px;
      }
    }

    a {
      margin-left: 10px;
    }
  }

  img {
    width: 30px;
    height: 30px;
  }

  .orcid-delete-button {
    flex: 1;
    flex-direction: row-reverse;

    button {
      color: $gray_4;
      margin-top: 7px;
      &:hover,
      &:focus {
        cursor: pointer;
        color: $purple_1;
      }
    }
  }

  .el-row--flex.is-align-middle {
    flex: 25;
  }
}
#update-profile-form {
  .el-form-item__content {
    max-width: 330px;
  }
}
</style>
