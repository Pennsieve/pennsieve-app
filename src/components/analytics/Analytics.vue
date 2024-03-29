<template />

<script>
  import { mapGetters } from 'vuex'
  import * as site from '../../site-config/site.json'
  import EventBus from '../../utils/event-bus'
  import { pathOr, compose, last, split, prop, propOr, defaultTo, find, pathEq } from 'ramda'

  export default {
    name: 'PsAnalytics',
    computed: {
      ...mapGetters([
        'getActiveOrganization',
        'activeOrganization',
        'organizations',
        'profile'
      ]),

      /**
       * Active organization name
       * @returns {String}
       */
      activeOrgName: function () {
        return pathOr('', ['organization', 'name'], this.activeOrganization)
      },

      /**
       * Active organization id
       * @returns {String}
       */
      activeOrgId: function () {
        return pathOr('', ['organization', 'id'], this.activeOrganization)
      }
    },

    /**
     * Life cycle method
     */
    mounted: function () {
      // Custom event handlers
      // EventBus.$on('track-event', this.trackEvent.bind(this))
      // Intercom
      // this.$store.watch(this.getActiveOrganization, this.bootIntercom.bind(this))
    },

    beforeUnmount() {
      // EventBus.$off('track-event', this.trackEvent.bind(this))
    },

    methods: {
      /**
       * Registers the user with Intercom when an active organization is set or changes.
       */
      // bootIntercom: function () {
        // const isProduction = location.href.indexOf('app.pennsieve.') >= 0
        // const intercomAppId = isProduction ? 'tmzdtqj9' : 'tmzdtqj9'
        //
        // const userId = propOr('', 'id', this.profile)
        // const userEmail = propOr('', 'email', this.profile)

        // Intercom('boot', {
        //   app_id: intercomAppId,
        //   user_id: userId,
        //   email: userEmail,
        //   company: {
        //     'id': this.activeOrgId,
        //     'name': this.activeOrgName,
        //     'subscriptionState': pathOr('', ['organization', 'subscriptionState', 'type'], this.activeOrganization),
        //     'features': pathOr([], ['organization', 'features'], this.activeOrganization).join(', '),
        //     'environment': site.environment
        //   }
        // })
      // },

      // /**
      //  * Generic event handler for Intercom
      //  * @param {Object} evt
      //  */
      // trackEvent: function (evt) {
      //   const eventName = propOr('', 'name', evt)
      //   const meta = propOr({}, 'meta', evt)
      //   if (eventName) {
      //     Intercom('trackEvent', eventName, meta)
      //   }
      // },


      /**
       * Returns the last part of the Pennsieve user id for Heap Analytics tracking.
       * This function is point-free so you just need to pass it an id such as:
       * `N:user:4edcd1d9-1b25-4860-abdf-79140d069450`
       * @param {String}
       * @return String
       */
      getPennsieveId: compose(
          last,
          split(':'),
          defaultTo('')
      ),

      /**
       * Returns Heap data structure for analytics
       * @param {String} preferredOrgId
       * @param {Array} organizationsList
       * @return {Object}
       */
      getOrgName: (preferredOrgId, organizationsList) => compose(
          pathOr('', ['organization', 'name']),
          find(pathEq(['organization', 'id'], preferredOrgId))
      )(organizationsList),

      /**
       * Returns the user data object for Heap Analytics tracking.
       * @param {Object} evt
       * @return Object
       */
      getUserData: function (evt) {
        const data = prop('detail', evt)
        if (!data) {
          return {}
        }
        const preferredOrg = propOr('', 'preferredOrganization', data)
        const orgName = this.getOrgName(preferredOrg, this.organizations)
        const id = this.getPennsieveId(data.id)
        return {
          'Pennsieve ID': id,
          'First Name': data.firstName,
          'Last Name': data.lastName,
          'Email': data.email,
          'Title': data.credential,
          'Organization': orgName
        }
      }
    }
  }
</script>
