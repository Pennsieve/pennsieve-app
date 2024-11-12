import { pathOr, propOr, head, compose, defaultTo } from 'ramda'
import { mapState } from 'vuex'

import Request from '../../mixins/request'
import {useGetToken} from "@/composables/useGetToken";

const getPkgId = compose(
  pathOr('', ['content', 'id']),
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
      viewerDataId: ''
    }
  },

  computed: {
    ...mapState([
      'config',
    ]),

    getViewerDataUrl: async function() {
      const apiUrl = propOr('', 'apiUrl', this.config)
      const pkgId = pathOr('', ['content', 'id'], this.pkg)
      const userToken = await useGetToken()

      if (apiUrl && pkgId && userToken) {
        return `${apiUrl}/packages/${pkgId}/view?api_key=${userToken}`
      }
    },

    getFileUrl: async function() {
      const apiUrl = propOr('', 'apiUrl', this.config)
      const pkgId = pathOr('', ['content', 'id'], this.pkg)
      const userToken = await useGetToken()

      if (apiUrl && pkgId && this.viewerDataId && userToken) {
        return `${apiUrl}/packages/${pkgId}/files/${this.viewerDataId}/presign/?api_key=${userToken}`
      }
    },
  },

  watch: {
    getViewerDataUrl: {
      handler: function(url) {
        if (url) {
          this.getViewerData()
        }
      },
      immediate: true
    },
  },

  methods: {
    /**
     * Request viewer data
     */
    getViewerData: function() {
      this.sendXhr(this.getViewerDataUrl)
        .then(this.handleGetViewerData.bind(this))
        .catch(this.handleXhrError.bind(this))
    },

    /**
     * Handle get viewer data hxr response
     * @param {Object} response
     */
    handleGetViewerData: function(response) {
      this.viewerDataId = getPkgId(response)
    }
  }
}
