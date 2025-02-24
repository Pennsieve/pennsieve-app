import { mapGetters } from 'vuex'
import {useGetToken} from "@/composables/useGetToken";

const confirmMessage = 'You have unsaved changes. Are you sure you want to continue?'

export default {

  data() {
    return {
      changedProperties: []
    }
  },

  computed: {

    /**
     * Computed value if component has changes
     * @returns {Boolean}
     */
    hasChanges: function() {
      return this.changedProperties.length > 0
    }
  },

  mounted: function() {
    // Warn user that changes have been made and they are unsaved
    window.addEventListener('beforeunload', this.onBeforeUnload)
  },

  unmounted: function() {
    // Warn user that changes have been made and they are unsaved
    window.removeEventListener('beforeunload', this.onBeforeUnload)
  },

  /**
   * Trap the user if logged in
   */
  beforeRouteLeave (to, from, next) {
    this.beforeRouteLeaveHandler(to, from, next)
  },

  methods: {
    async beforeRouteLeaveHandler(to, from, next) {
      const userToken = await useGetToken()
      if (userToken) {
        if (this.confirmLossOfChanges()) {
          next()
          this.onConfirmLossOfChanges()
        }
      } else {
        next()
      }
    },
    /**
     * Beforeunload, confirm if users want to leave because they have changes
     */
    onBeforeUnload: function(evt) {
      if (this.hasChanges) {
        return evt.returnValue = confirmMessage
      }
    },

    /**
     * Alert the user there are unsaved changes and they will be lost.
     * @returns {Boolean}
     */
    confirmLossOfChanges: function() {
      if (this.hasChanges) {
        return window.confirm(confirmMessage)
      }

      return true
    }
  }
}
