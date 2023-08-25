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
</template>

<script>

import { mapGetters, mapState, mapActions } from 'vuex'

import globalMessageHandler from './mixins/global-message-handler'

export default {
  name: "app",

  mixins: [
    globalMessageHandler,
  ],

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
  },

  methods: {

    ...mapActions([
      'setBfTermsOfServiceVersion',
      'setActiveOrgSynced'

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
  background-color: $gray_1;
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
