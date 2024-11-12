import {
  mapActions,
  mapState
} from 'vuex'
import Request from '@/mixins/request/index'
import {useGetToken} from "@/composables/useGetToken";

export default {
  mixins: [
    Request
  ],

  computed: {
    ...mapState([
      'config',
    ])
  },

  methods: {
    ...mapActions([
      'setIsLoadingDatasetDoi',
      'setDatasetDoi'
    ]),

    /**
     * Get DOI for dataset
     * @param {String} datasetId
     */
    getDatasetDoi: function(datasetId) {
      this.setIsLoadingDatasetDoi(true)
      useGetToken()
          .then((token) => {
            this.setDatasetDoi('')
            const url = `${this.config.apiUrl}/datasets/${datasetId}/doi?api_key=${token}`
            this.sendXhr(url)
                .then(response => {
                  return this.setDatasetDoi(response)
                })
          })
          .catch(() => {
            this.handleXhrError.bind(this)
          })
          .finally(() => {
            this.setIsLoadingDatasetDoi(false)
          })
    },
  }
}
