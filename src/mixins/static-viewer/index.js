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
      viewerDataId: '',
      fileUrl: ''
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
      const apiUrl = propOr('', 'apiUrl', this.config)
      const pkgId = pathOr('', ['content', 'id'], this.pkg)

      // return `${apiUrl}/packages/${pkgId}/files/${this.viewerDataId}/presign/`
      const fileUrlData = await useGetToken()
      .then(token => {
        return `${apiUrl}/packages/${pkgId}/files/${this.viewerDataId}?api_key=${token}`
      })

      this.fileUrl = fileUrlData;

      return fileUrlData
    },

    /**
     * Handle get viewer data xhr response
     * @param {Object} response
     */
    handleGetViewerData: function(response) {
      this.viewerDataId = getPkgId(response)
      this.getFileUrl()
    }
  }
}
