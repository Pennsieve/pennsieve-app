<script setup></script>

<template>
  <div id="app-wrap">
    <router-view name="header" />
    <div id="main-wrap">
      <router-view v-show="primaryNavOpen" name="navigation" />
      <router-view v-show="secondaryNavOpen" name="navigationSecondary" />
      <router-view id="page" name="page" />
    </div>
  </div>

  <PsAnalytics />


</template>

<script>

import { mapGetters, mapState, mapActions } from 'vuex'
import { setPageTitle, setMeta } from './utils/meta'

import globalMessageHandler from './mixins/global-message-handler'
import {mergeAll, pathOr, propOr} from "ramda";
import EventBus from './utils/event-bus'
import Cookies from 'js-cookie'
import toQueryParams from "./utils/toQueryParams.js";
import PsAnalytics from './components/analytics/Analytics.vue'



export default {
  name: "app",

  components: {
    PsAnalytics
  },
  mixins: [
    globalMessageHandler,
  ],

  data() {
    return {
      defaultPageTitle: 'Sign In | Pennsieve',
      defaultPageDescription: 'Pennsieve secure Sign In page. Sign in to your Pennsieve customer account.',

    }
  },

  mounted() {
    this.$store.watch(this.getActiveOrganization, this.onActiveOrgChange.bind(this))
    EventBus.$on('reload-datasets', this.fetchDatasets)

    const token = Cookies.get('user_token')
    if (!token) {
      setPageTitle(this.defaultPageTitle)
      setMeta('name', 'description', this.defaultPageDescription)
    }
  },

  watch: {
    /**
     * Watch to compute new dataset list
     */
    '$route.params.orgId'(to, from) {
      if (to) {
        this.onSwitchOrganization({
          organization: {
            id: to
          }
        })
        this.$nextTick(() => {
          const token = Cookies.get('user_token')
          if (token) {
            this.bootUp(token)
          }
        })
      }
    },
    /**
     * Trigger API request when active organization is changed
     */
    activeOrganization: {
      handler: function(val, oldVal) {
        if (this.getDatasetsUrl && this.datasets.length === 0) {
          this.setActiveOrgSynced()
          this.fetchDatasets()
          this.fetchDatasetPublishedData()
          this.fetchCollections()
          this.fetchIntegrations()
          this.fetchDatasetStatuses()
        }

      },
      immediate: true
    },
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
      "userToken",
      "hasFeature",
      "hasOrcidOnboardingEvent",
      "isOrgSynced",
    ]),
    ...mapState('datasetModule', [
      'datasetSearchParams'
    ]),

    /**
     * Compute get datasets URL
     * @return {String}
     */
    getDatasetsUrl: function() {
      const params = toQueryParams(mergeAll({api_key: this.userToken}))
      return this.userToken
          ? `${this.config.apiUrl}/datasets/paginated?${params}&includeBannerUrl=true`
          : ''
    },

  },

  methods: {
    ...mapActions([
      'setDatasets',
      'setIsLoadingDatasets',
      'setBfTermsOfServiceVersion',
      'setActiveOrgSynced',
      'updateOrgDatasetStatuses',
      'setIsLoadingDatasetPublishedData',
      'setIsLoadingDatasetsError',
      'setDatasetPublishedData',
    ]),
    ...mapActions('datasetModule', [
      'updateDatasetTotalCount'
    ]),

    ...mapActions('collectionsModule', [
      'fetchCollections'
    ]),

    ...mapActions('integrationsModule', [
      'fetchIntegrations'
    ]),

    /**
     * Request critical data required for app to run properly
     * @param {String} userToken
     * @returns {Promise}
     */
    bootUp: function(userToken) {
      return this.getBfTermsOfService()
          .then(() => this.getProfileAndOrg(userToken))
          .then(() => {this.setActiveOrgSynced()})
          .then(() => this.getOnboardingEventStates(userToken))
          .then(() => this.fetchDatasetStatuses())
    },

    /**
     * Get all dataset status options for organization
     */
    fetchDatasetStatuses: function() {
      this.sendXhr(this.getDatasetStatusUrl,"").then(response => {
        this.updateOrgDatasetStatuses(response)
      })
          .catch(this.handleXhrError.bind(this))
    },

    /**
     * Get all status options for organization url
     * @returns {String}
     */
    getDatasetStatusUrl: function() {

      if (this.config.apiUrl && this.userToken && this.isOrgSynced) {
        const orgId = pathOr('', ['organization', 'id'], this.activeOrganization)
        return `${this.config.apiUrl}/organizations/${orgId}/dataset-status?api_key=${this.userToken}`
      } else {
        return "Not-found"
      }
    },

    /**
     * Get dataset publish data
     */
    fetchDatasetPublishedData: function() {
      this.setIsLoadingDatasetPublishedData(true)

      const url = `${this.config.apiUrl}/datasets/published?api_key=${this.userToken}`
      this.sendXhr(url)
          .then(response => {
            this.setDatasetPublishedData(response).then(() => {
              this.setIsLoadingDatasetPublishedData(false)
            })
          })
          .catch(this.handleXhrError.bind(this))
    },

    /**
     * Get datasets for active organization
     */
    fetchDatasets: function() {
      this.setIsLoadingDatasets(true)
          .then(() => this.sendXhr(this.getDatasetsUrl))
          .then(response => {
            this.setDatasetData(response)
            this.setIsLoadingDatasetsError(false)
          })
          .catch(() => {
            this.setDatasetData([])
            this.setIsLoadingDatasetsError(true)
          })
          .finally(() => this.setIsLoadingDatasets(false))
    },

    /**
     * Set dataset data
     * @param {Object} response
     */
    setDatasetData: function(response) {
      const datasets = propOr([], 'datasets', response)
      const datasetTotal = propOr(0, 'totalCount', response)
      return this.setDatasets(datasets)
          .then(() => {
            return this.updateDatasetTotalCount(datasetTotal)
          })
    },

    /**
     * Handles changes to active organization
     * @param {Object} activeOrg
     */
    onActiveOrgChange: function(activeOrg) {
      this.setPageMeta(activeOrg)
    },

    /**
     * Sets page meta for pages except home
     * @param {Object} activeOrg
     */
    setPageMeta: function(activeOrg) {
      const orgName = pathOr('', ['organization', 'name'], activeOrg)
      let pageTitle = `${orgName} | Pennsieve`
      let pageDescription = ''

      if (!orgName) {
        pageTitle = this.defaultPageTitle
        pageDescription = this.defaultPageDescription
      }

      setPageTitle(pageTitle)
      setMeta('name', 'description', pageDescription)
    },

    /**
     * Request user onboarding events
     * @param {String} userToken
     */
    getOnboardingEventStates: function(userToken) {
      return this.sendXhr(`${this.config.apiUrl}/onboarding/events?api_key=${userToken}`, {
        header: {
          'Authorization': `bearer ${userToken}`
        }
      })
          .then((response) =>  {
            this.updateOnboardingEvents(response)
            const hasAddedOrcid = response.includes('AddedOrcid')
            if (!hasAddedOrcid)  {
              this.updateShouldShowLinkOrcidDialog(true)
              // this.setLinkOrcidDialog()
            }
          })
          .catch(this.handleXhrError.bind(this))
    },

    /**
     * Get Pennsieve Terms of Service html
     * @returns {Promise}
     */
    getBfTermsOfService: function() {
      return fetch('/tos_html.txt')
          .then(response => response.text())
          .then(text => {
            // set Pennsieve terms of service version
            const bfTermsOfServiceVersion = this.getBfTermsVersion(text)
            return this.setBfTermsOfServiceVersion(bfTermsOfServiceVersion)
          })
    },

    /**
     * Find Bf.version meta tag and return the content value
     * @param {String} html
     * @returns {String}
     */
    getBfTermsVersion: function(html) {
      const div = document.createElement('div')
      div.innerHTML = this.$sanitize(html, ['html', 'head', 'meta'])

      const frag = document.createDocumentFragment()
      frag.appendChild(div)

      const metaTag = frag.querySelector(`meta[name="PS.version"]`)

      const content = metaTag.content

      // replace unnecessary characters if content is available
      return content ? content.replace(/\W|T/g, '') : ''
    },
  },
};
</script>

<style lang="scss">
@import "./assets/_variables.scss";

html,
body {
  font-family: $system-font;
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
