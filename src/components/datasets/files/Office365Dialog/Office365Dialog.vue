<template>
  <el-dialog
    v-model="isOfficeDialogVisible"
    :show-close="false"
    @close="closeDialog"
  >
    <template #header>
      <bf-dialog-header
        slot="title"
        title="Office 365 Terms & Conditions"
      />
    </template>


    <dialog-body>
      <p class="mb-32">
        Opening this document with Office 365 will generate a short-lived public link.
        This file will temporarily become accessible to external users with the link and by Microsoft Services.
      </p>
      <p class="mb-32">
        View Microsoft's
        <a
          href="https://www.microsoft.com/en-us/servicesagreement/"
          target="_blank"
        >
          Terms and Conditions
        </a>
      </p>
      <el-checkbox v-model="checked">
        Don't show this warning again
      </el-checkbox>

      <p
        v-if="hasError"
        class="error mb-0 mt-8"
      >
        Sorry, an error has occurred. Please try again.
      </p>
    </dialog-body>

    <template #footer>
      <bf-button
        class="secondary"
        @click="closeDialog"
      >
        Cancel
      </bf-button>
      <bf-button
        :processing="isLoading"
        @click="acceptAgreement"
      >
        Accept
      </bf-button>
    </template>

  </el-dialog>
</template>

<script>
import Cookie from 'js-cookie'
import { pathOr, propOr, head } from 'ramda'
import { mapActions,  mapState, mapGetters } from 'vuex'

import BfButton from '../../../shared/bf-button/BfButton.vue'
import BfDialogHeader from '../../../shared/bf-dialog-header/BfDialogHeader.vue'
import DialogBody from '../../../shared/dialog-body/DialogBody.vue'
import Request from '../../../../mixins/request/index'
import {useGetToken} from "@/composables/useGetToken";
import {useSendXhr, useHandleXhrError} from "@/mixins/request/request_composable";

export default {
  name: 'Office365Dialog',

  components: {
    BfDialogHeader,
    DialogBody,
    BfButton
  },

  mixins: [Request],

  data: function() {
    return {
      sourceFile: [],
      awsURL: '',
      checked: false,
      isLoading: false,
      hasError: false
    }
  },

  computed: {
    ...mapState('filesModule', [
      'isOfficeDialogVisible',
      'officeFile',
      'shouldOpenOfficeFile',
    ]),

    ...mapGetters([ 'config']),

    /**
     * Computed property to generate endpoint url to retrieve
     * source files for package
     * @returns {String}
     */



  },

  watch: {
    shouldOpenOfficeFile: function(val) {
      if (val) {
        this.acceptAgreement()
      }
    }
  },

  methods: {
    ...mapActions('filesModule', [
      'closeOffice365Dialog'
    ]),

    /**
     * Computed property to generate endpoint url to retreive
     * package file information
     * @returns {String}
     */
    packageFilesUrl: async function() {
      const url = propOr('', 'apiUrl', this.config)
      const packageId = pathOr('', ['content', 'nodeId'], this.officeFile)
      const fileId = pathOr('', ['content', 'id'], head(this.sourceFile))

      return useGetToken()
        .then(token => {
          return `${url}/packages/${packageId}/files/${fileId}?api_key=${
            token
          }&short=true`
        })

    },

    sourceFilesUrl: async function() {
      const url = propOr('', 'apiUrl', this.config)
      const packageId = pathOr('', ['content', 'nodeId'], this.officeFile)

      return useGetToken()
        .then(token => {
          return `${url}/packages/${packageId}/sources?api_key=${token}`
        })
    },
    /**
     * Get package files endpoint call to get url to open in MS Office Viewer
     */
    getPackageFiles: function() {
      return this.packageFilesUrl()
        .then(url => {
          return useSendXhr(url)
            .then(response => {
              this.awsURL = response.url
              const finalURL = `https://view.officeapps.live.com/op/view.aspx?src=${this.awsURL}`
              window.open(finalURL, '_blank')
            })
            .catch(err => useHandleXhrError(err))
        })
    },

    /**
     * API call to get source files data for table
     */
    getSourceFiles: async function() {
      const url = await this.sourceFilesUrl();
        await this.sendXhr(url)
            .then(response => {
              this.sourceFile = response
            }).catch(this.handleXhrError.bind(this))
    },

    /**
     *  Accept Office 365 Agreement
     */
    acceptAgreement: async function() {
      if (this.checked) {
        Cookie.set('acceptedOffice365Terms', true)
      }

      // Reset error state
      this.hasError = false

      // Set loading state
      this.isLoading = true

      /**
       * Make the API calls to get source file
       * Then with that response, request the short URL
       * Finally, open the window for the office viewer and close the dialog
       */
      await this.getSourceFiles()
      this.getPackageFiles().then(()=>{
        this.closeDialog()
      }).catch(() => {
          // Set error state
          this.hasError = true
        })
        .finally(() => {
          // Reset loading state
          this.isLoading = false
        })
      // this.getSourceFiles()
      //   .then(() => this.getPackageFiles())
      //   .then(() => {
      //     this.closeDialog()
      //   })
      //   .catch(() => {
      //     // Set error state
      //     this.hasError = true
      //   })
      //   .finally(() => {
      //     // Reset loading state
      //     this.isLoading = false
      //   })
    },

    /**
     * Closes the dialog
     */
    closeDialog: function() {
      this.checked = false
      this.closeOffice365Dialog()
    }
  }
}
</script>

<style scoped lang="scss">
@import '../../../../assets/_variables.scss';

.text {
  margin-bottom: 30px;
}
.error {
  color: $error-color
}
</style>
