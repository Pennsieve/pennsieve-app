<script setup>
import { useRoute } from "vue-router";
let route = useRoute();

</script>

<template>
  <div id="app-wrap">

    <router-view name="header" />
    <div class="session-info" v-if="showSessionTimer">
      <div>
        {{ sessionTokenMessage }}
      </div>
      <div
        class="refresh-action"
        v-if="!sessionTimedOut"
        @click="onRefreshToken"
      >
        Refresh
      </div>
    </div>

    <div id="main-wrap">
      <router-view name="navigation" v-if="primaryNavOpen" />
      <router-view
        name="navigationSecondary"
        v-if="!route.meta.hideSecondaryNav"
      />
      <router-view name="page" id="page" />
    </div>
  </div>

  <!--  <bf-upload ref="bfUpload" />-->

  <pennsieve-upload
    ref="pennsieveUpload"
    v-model:dialogVisible="showUploadDialog"
  />

  <PsAnalytics />

  <bf-download-file ref="downloadFile" />

  <office-365-dialog />


</template>

<script>
import { mapGetters, mapState, mapActions } from "vuex";
import { setPageTitle, setMeta } from "./utils/meta";

import globalMessageHandler from "./mixins/global-message-handler";
import {mergeDeepRight, pathOr, propOr} from "ramda";
import EventBus from "./utils/event-bus";
import toQueryParams from "./utils/toQueryParams.js";

import PsAnalytics from "./components/analytics/Analytics.vue";
import BfDownloadFile from "./components/bf-download-file/BfDownloadFile.vue";
import request from "./mixins/request";
import PennsieveUpload from "./components/PennsieveUpload/PennsieveUpload.vue";
import Office365Dialog from "@/components/datasets/files/Office365Dialog/Office365Dialog.vue";
import {useGetToken} from "@/composables/useGetToken";


export default {
  name: "app",

  components: {
    PennsieveUpload,
    PsAnalytics,
    BfDownloadFile,
  },
  mixins: [globalMessageHandler, request],

  data() {
    return {
      showUploadDialog: false,
      defaultPageTitle: "Sign In | Pennsieve",
      defaultPageDescription:
        "Pennsieve secure Sign In page. Sign in to your Pennsieve customer account.",
      sessionTimedOut: false,
      showSessionTimerThreshold: 120,
      sessionLogoutThreshold: 5,
      loadingTimeout: 30000, // 30 seconds
    };
  },
  async mounted() {
    this.$store.watch(
      this.getActiveOrganization,
      this.onActiveOrgChange.bind(this)
    );

  },

  computed: {
    ...mapState([
      "datasets",
      "primaryNavOpen",
      "secondaryNavOpen",
      "environment",
      "searchModalVisible",
      "isLinkOrcidDialogVisible",
    ]),
    ...mapGetters([
      "activeOrganization",
      "getActiveOrganization",
      "config",
      "hasFeature",
      "hasOrcidOnboardingEvent",
      "isOrgSynced",
    ]),
    ...mapState("datasetModule", ["datasetSearchParams"]),
    sessionTokenMessage: function () {
      if (this.sessionTimedOut) {
        return "Logged out due to inactivity.";
      } else {
        return (
          "Your session will expire in: " +
          (this.sessionTimer() - this.sessionLogoutThreshold) +
          " seconds."
        );
      }
    },

    /**
     * Indicate that we should start showing message that the user will be logged out
     * due to inactivity starting at 5 min. before the session expires.
     *
     * The user can either manually refresh, or take some action on the site that
     * calls the platform as we automatically refresh on Xhr calls.
     * @returns {boolean}
     */
    showSessionTimer: function () {
      return !!(
        this.sessionTimedOut ||
        (this.sessionTimer() &&
          this.sessionTimer() < this.showSessionTimerThreshold)
      );
    },




  },

  methods: {
    ...mapActions([
      "setDatasets",
      "setIsLoadingDatasets",
      "setBfTermsOfServiceVersion",
      "setActiveOrgSynced",
      "updateOrgDatasetStatuses",
      "setIsLoadingDatasetPublishedData",
      "setIsLoadingDatasetsError",
      "setDatasetPublishedData",
      "setSessionTimer",
    ]),
    ...mapActions("datasetModule", ["updateDatasetTotalCount"]),
    ...mapGetters(["sessionTimer"]),

    ...mapActions("collectionsModule", ["fetchCollections"]),

    ...mapActions("integrationsModule", ["fetchIntegrations"]),
    ...mapActions("analysisModule", [
      "fetchComputeNodes",
      "fetchApplications",
      "fetchComputeResourceAccounts",
    ]),
    ...mapGetters(["getCognitoUser", "sessionTimer"]),
    callGlobalCustomEvent() {
      EventBus.$emit("redirect-detected");
    },

    /**
     * Compute get datasets URL
     * @return {String}
     */
    getDatasetsUrl: async function () {
      return useGetToken().then((t) => {
        const params = toQueryParams(
          mergeDeepRight(this.datasetSearchParams, { api_key: t })
        );
        return `${this.config.apiUrl}/datasets/paginated?${params}&includeBannerUrl=true`
      })

    },
    /**
     * Get all status options for organization url
     * @returns {String}
     */
    getDatasetStatusUrl: async function () {

      return useGetToken().then((token) => {
        const orgId = pathOr(
          "",
          ["organization", "id"],
          this.activeOrganization
        )
        return `${this.config.apiUrl}/organizations/${orgId}/dataset-status?api_key=${token}`;


      })
    },

    onRefreshToken: function () {
      this.refreshToken();
    },
    recaptchaVerified(response) {},
    recaptchaExpired() {
      this.$refs.vuetcha.reset();
    },
    recaptchaFailed() {},
    recaptchaError(reason) {},
    /**
     * Manually refresh token.
     */
    refreshToken: async function () {
      await fetchAuthSession({ forceRefresh: true });

    },

    beforeUnmount: function () {
      clearInterval(this.interval);
    },


    /**
     * Set dataset data
     * @param {Object} response
     */
    setDatasetData: function (response) {
      const datasets = propOr([], "datasets", response);
      const datasetTotal = propOr(0, "totalCount", response);
      return this.setDatasets(datasets).then(() => {
        return this.updateDatasetTotalCount(datasetTotal);
      });
    },

    /**
     * Handles changes to active organization
     * @param {Object} activeOrg
     */
    onActiveOrgChange: function (activeOrg) {
      this.setPageMeta(activeOrg);
    },

    /**
     * Sets page meta for pages except home
     * @param {Object} activeOrg
     */
    setPageMeta: function (activeOrg) {
      const orgName = pathOr("", ["organization", "name"], activeOrg);
      let pageTitle = `${orgName} | Pennsieve`;
      let pageDescription = "";

      if (!orgName) {
        pageTitle = this.defaultPageTitle;
        pageDescription = this.defaultPageDescription;
      }

      setPageTitle(pageTitle);
      setMeta("name", "description", pageDescription);
    },

    /**
     * Request user onboarding events
     * @param {String} userToken
     */
    getOnboardingEventStates: function (userToken) {
      return this.sendXhr(
        `${this.config.apiUrl}/onboarding/events?api_key=${userToken}`,
        {
          header: {
            Authorization: `bearer ${userToken}`,
          },
        }
      )
        .then((response) => {
          this.updateOnboardingEvents(response);
          const hasAddedOrcid = response.includes("AddedOrcid");
          if (!hasAddedOrcid) {
            this.updateShouldShowLinkOrcidDialog(true);
            // this.setLinkOrcidDialog()
          }
        })
        .catch(this.handleXhrError.bind(this));
    },

    /**
     * Get Pennsieve Terms of Service html
     * @returns {Promise}
     */
    getBfTermsOfService: function () {
      return fetch("/tos_html.txt")
        .then((response) => response.text())
        .then((text) => {
          // set Pennsieve terms of service version
          const bfTermsOfServiceVersion = this.getBfTermsVersion(text);
          return this.setBfTermsOfServiceVersion(bfTermsOfServiceVersion);
        });
    },

    /**
     * Find Bf.version meta tag and return the content value
     * @param {String} html
     * @returns {String}
     */
    getBfTermsVersion: function (html) {
      const div = document.createElement("div");
      div.innerHTML = this.$sanitize(html, ["html", "head", "meta"]);

      const frag = document.createDocumentFragment();
      frag.appendChild(div);

      const metaTag = frag.querySelector(`meta[name="PS.version"]`);

      const content = metaTag.content;

      // replace unnecessary characters if content is available
      return content ? content.replace(/\W|T/g, "") : "";
    },
  },
};
</script>

<style scoped lang="scss">
@import "./assets/_variables.scss";
.refresh-action {
  color: $purple_3;
  margin: 0 16px;
  text-decoration: underline;
  cursor: pointer;
}
.session-info {
  background-color: $purple_tint;
  height: 30px;
  display: flex;
  align-items: center;
  padding: 8px 16px;
  font-weight: 500;
  color: $purple_2;
}
</style>

<style lang="scss">
@import "./assets/_variables.scss";
@import url("https://fonts.googleapis.com/css2?family=EB+Garamond:ital@0;1&family=Roboto:wght@100;300;400;500;700&display=swap");

html,
body {
  font-family: $system-font;
  font-weight: 300;
  font-size: 14px;
  line-height: 17px;
}

body {
  background-color: $white;
  color: $text-color;
  margin: 0;
  min-height: 100vh;
}

// Hide only visually, but have it available for screenreaders: h5bp.com
.visually-hidden {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
}

.login-form {
  @extend .visually-hidden;
}

#app-wrap {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

#main-wrap {
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
}

#page {
  flex: 1;
  overflow: auto;
}
</style>
