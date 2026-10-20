import { pathOr, propOr, head, compose, defaultTo } from 'ramda'
import { mapState } from 'vuex'

import Request from '../../mixins/request'
import {useGetToken} from "@/composables/useGetToken";
import EventBus from '../../utils/event-bus'
import { viewFileUrl } from '@/utils/viewFileUrl'
import { isScanPendingError, SCAN_POLL_MS, SCAN_POLL_LIMIT } from '@/utils/scan-status'

// The file /view returns first: a derived view, else a file, else the source.
const getViewFile = compose(
  defaultTo({}),
  head,
  defaultTo([])
)

export default {

  mixins: [
    Request
  ],

  props: ['pkg'],

  data() {
    return {
      viewerDataId: '',
      viewFile: {},
      fileUrl: '',
      // download-service is holding the file until its malware scan
      // finishes; the link is asked for again until it is released.
      scanPending: false,
      scanRetryTimer: null,
      scanRetryCount: 0
    }
  },

  computed: {
    ...mapState([
      'config',
    ]),

    getViewerDataUrl: function() {
      const apiUrl = propOr('', 'apiUrl', this.config)
      const pkgId = pathOr('', ['content', 'id'], this.pkg)

      return `${apiUrl}/packages/${pkgId}/view`
    },


  },

  watch: {
    getViewerDataUrl: {
      handler: function(url) {
        if (url) {
          useGetToken()
              .then(token => {
                const fullUrl = `${url}?api_key=${token}`
                this.getViewerData(fullUrl)
              })

        }
      },
      immediate: true
    },
  },

  methods: {
    /**
     * Request viewer data
     */
    getViewerData: async function(url) {
      return this.sendXhr(url)
        .then(this.handleGetViewerData.bind(this))
        .catch(this.handleXhrError.bind(this))
    },

    getFileUrl: async function() {
      const packageId = pathOr('', ['content', 'id'], this.pkg)
      const datasetId = pathOr('', ['content', 'datasetNodeId'], this.pkg)
      try {
        const fileUrl = await viewFileUrl({ datasetId, packageId, file: this.viewFile }, { config: this.config })
        this.scanPending = false
        this.fileUrl = fileUrl
        return fileUrl
      } catch (err) {
        if (isScanPendingError(err)) {
          this.onScanPending(packageId)
          return
        }
        console.error(err)
      }
    },

    /**
     * The file is still being scanned: let the page say so (FileDetails
     * shows Scanning) and ask for the link again shortly.
     */
    onScanPending: function(packageId) {
      this.scanPending = true
      EventBus.$emit('download-scan-pending', { packageId })
      clearTimeout(this.scanRetryTimer)
      if (this.scanRetryCount >= SCAN_POLL_LIMIT) return
      this.scanRetryCount += 1
      this.scanRetryTimer = setTimeout(() => this.getFileUrl(), SCAN_POLL_MS)
    },

    /**
     * Handle get viewer data xhr response
     * @param {Object} response
     */
    handleGetViewerData: function(response) {
      this.viewFile = getViewFile(response)
      this.viewerDataId = pathOr('', ['content', 'id'], this.viewFile)
      this.scanRetryCount = 0
      this.getFileUrl()
    }
  },

  beforeUnmount() {
    clearTimeout(this.scanRetryTimer)
  }
}
