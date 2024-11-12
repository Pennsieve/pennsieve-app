<template>
  <login v-loading="isLoadingReadmeCredentials" />
</template>

<script>
import { mapState } from 'vuex'
import Cookies from 'js-cookie'

import Login from '../Login/Login.vue'

import Request from '../../mixins/request'
import {useGetToken} from "@/composables/useGetToken";

export default {
  name: 'DocsLogin',

  components: {
    Login
  },

  mixins: [
    Request
  ],

  data() {
    return {
      isLoadingReadmeCredentials: false
    }
  },

  computed: {
    ...mapState([
      'config',
    ])
  },


  /**
   * Get token from Cookie, this will work
   * for a when a user is already signed in to
   * the app
   */
  mounted: function() {
    this.getDocsLogin()

  },

  methods: {
    /**
     * Request Readme Credentials and then
     * redirect to Pennsieve Docs on success
     * @params {String} token
     */
    getDocsLogin: function() {
      this.isLoadingReadmeCredentials = true

      useGetToken()
        .then(token => {
          this.sendXhr(`${this.config.apiUrl}/session/readme-credentials?api_key=${token}`, { method: 'GET' })
            .then(response => window.location.replace(`${this.config.docsUrl}?auth_token=${response}`))
            .catch(this.handleXhrError.bind(this))
            .finally(() => {
              this.isLoadingReadmeCredentials = false
            })
        })


    }
  }
}
</script>

<style lang="scss" scoped>

</style>
